import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateProfileOwnerToken } from "@/lib/profile-owner-token";
import { DEPOT_MAX_BYTES } from "@/lib/depot-errors";

declare global {
  var __rsDepotHits: Map<string, number[]> | undefined;
}

export function getDepotClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export function depotIpHash(req: Request): string {
  const ip = getDepotClientIp(req);
  const salt = process.env.DEPOT_IP_SALT || process.env.VOTE_IP_SALT;
  if (!salt) {
    console.warn("[depot] DEPOT_IP_SALT non défini — rate-limiting affaibli");
  }
  return crypto
    .createHash("sha256")
    .update(`${ip}|${salt ?? crypto.randomUUID()}`)
    .digest("hex")
    .slice(0, 48);
}

export function depotRateLimitOrNull(
  key: string,
  limit: number,
  windowMs: number,
): { retryAfterSec: number } | null {
  const now = Date.now();
  const map = (globalThis.__rsDepotHits ??= new Map<string, number[]>());
  const prev = map.get(key) ?? [];
  const next = prev.filter((t) => now - t < windowMs);
  next.push(now);
  map.set(key, next);
  return next.length > limit ? { retryAfterSec: Math.ceil(windowMs / 1000) } : null;
}

export function normalizeDepotHandle(handle: string) {
  const trimmed = handle.trim();
  const handleNorm = trimmed.replace(/^@/, "").toLowerCase();
  const storedHandle = trimmed.startsWith("@") ? trimmed : `@${handleNorm}`;
  const safeHandle = handleNorm
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const handleCandidates = Array.from(
    new Set([trimmed, handleNorm, `@${handleNorm}`, storedHandle].filter(Boolean)),
  );
  return { trimmed, handleNorm, storedHandle, safeHandle, handleCandidates };
}

export function buildDepotCvPath(
  safeHandle: string,
  ownerToken: string,
  fileName: string,
) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .slice(0, 80);
  return `pending/${safeHandle}/${ownerToken}-${Date.now()}-${safeName}`;
}

export async function assertDepotHandleAvailable(
  supabase: SupabaseClient,
  handleCandidates: string[],
) {
  const existing = await supabase
    .from("profiles")
    .select("id,status")
    .in("handle", handleCandidates)
    .limit(1);
  if (existing.error) {
    return { error: `check_failed:${existing.error.message}` as const };
  }
  if (existing.data && existing.data.length > 0) {
    const row = existing.data[0] as { status?: string };
    if (row.status === "pending") return { error: "already_pending" as const };
    return { error: "handle_taken" as const };
  }
  return { error: null };
}

export function assertDepotRateLimits(ipHash: string, handleNorm: string) {
  const rl1h = depotRateLimitOrNull(`ip:${ipHash}`, 5, 60 * 60 * 1000);
  if (rl1h) return { error: "rate_limited" as const, retryAfterSec: rl1h.retryAfterSec };
  const rl1d = depotRateLimitOrNull(`ipd:${ipHash}`, 20, 24 * 60 * 60 * 1000);
  if (rl1d) return { error: "rate_limited" as const, retryAfterSec: rl1d.retryAfterSec };
  const rlHandle = depotRateLimitOrNull(
    `iphandle:${ipHash}:${handleNorm}`,
    1,
    60 * 60 * 1000,
  );
  if (rlHandle) {
    return { error: "rate_limited_handle" as const, retryAfterSec: rlHandle.retryAfterSec };
  }
  return { error: null as null };
}

export async function assertCvObjectExists(
  supabase: SupabaseClient,
  path: string,
) {
  const folder = path.split("/").slice(0, -1).join("/");
  const name = path.split("/").pop() || "";
  const listed = await supabase.storage.from("cvs").list(folder, {
    search: name,
    limit: 1,
  });
  if (listed.error) {
    return { ok: false as const, error: `upload_failed:${listed.error.message}` };
  }
  const found = (listed.data ?? []).some((o) => o.name === name);
  if (!found) return { ok: false as const, error: "file_required" as const };
  return { ok: true as const };
}

export async function insertDepotProfile(
  supabase: SupabaseClient,
  input: {
    storedHandle: string;
    parsedJobTitle: string;
    parsedSkills: string[];
    parsedCity: string;
    cvPath: string;
  },
) {
  const inferredJobTitle =
    input.parsedJobTitle.length > 0 ? input.parsedJobTitle : "Candidature";
  const normalizedCity = input.parsedCity.length > 0 ? input.parsedCity : null;
  return supabase.from("profiles").insert({
    handle: input.storedHandle,
    job_title: inferredJobTitle,
    tags: input.parsedSkills.length > 0 ? input.parsedSkills : ["candidature"],
    portfolio_url: null,
    cv_path: input.cvPath,
    status: "pending",
    city: normalizedCity,
  });
}

export function depotProfileUrls(req: Request, ownerToken: string) {
  const origin = req.headers.get("origin") || "";
  const ALLOWED_ORIGINS = [
    "https://recrutestagiaire.eu",
    "https://www.recrutestagiaire.eu",
    "http://localhost:3000",
  ];
  const safeOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  const absoluteProfileUrl = safeOrigin
    ? `${safeOrigin}/mon-profil/${ownerToken}`
    : `/mon-profil/${ownerToken}`;
  return {
    ownerToken,
    profileUrl: `/mon-profil/${ownerToken}`,
    absoluteProfileUrl,
  };
}

export function validateDepotFileMeta(fileName: string, fileSize: number) {
  if (!fileName.trim()) return "file_required";
  if (fileSize <= 0) return "file_required";
  if (fileSize > DEPOT_MAX_BYTES) return "file_too_large";
  if (!fileName.toLowerCase().endsWith(".pdf")) return "pdf_only";
  return null;
}
