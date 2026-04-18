import { NextResponse } from "next/server";
import crypto from "crypto";
import { tryGetSupabaseServer } from "@/lib/supabase-server";
import { generateProfileOwnerToken } from "@/lib/profile-owner-token";
import { parseCvWithAffinda } from "@/lib/affinda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

declare global {
  var __rsDepotHits: Map<string, number[]> | undefined;
}

function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function rateLimitOrNull(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const map = (globalThis.__rsDepotHits ??= new Map<string, number[]>());
  const prev = map.get(key) ?? [];
  const next = prev.filter((t) => now - t < windowMs);
  next.push(now);
  map.set(key, next);
  return next.length > limit ? { retryAfterSec: Math.ceil(windowMs / 1000) } : null;
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) return bad("server_misconfigured", 500);

  const ip = getClientIp(req);
  const salt =
    process.env.DEPOT_IP_SALT || process.env.VOTE_IP_SALT || "dev-salt";
  const ipHash = sha256(`${ip}|${salt}`).slice(0, 48);

  // Anti-spam: basic in-memory rate-limit (per instance)
  const rl1h = rateLimitOrNull(`ip:${ipHash}`, 5, 60 * 60 * 1000); // 5 depots / heure / IP-hash
  if (rl1h) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: rl1h.retryAfterSec },
      { status: 429 },
    );
  }
  const rl1d = rateLimitOrNull(`ipd:${ipHash}`, 20, 24 * 60 * 60 * 1000); // 20 / jour / IP-hash
  if (rl1d) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: rl1d.retryAfterSec },
      { status: 429 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) return bad("bad_formdata");

  const handle = String(form.get("handle") || "").trim();
  const candidateName = String(form.get("candidateName") || "").trim();
  const parsedEmail = String(form.get("parsedEmail") || "").trim().toLowerCase();
  const parsedJobTitle = String(form.get("parsedJobTitle") || "").trim();
  const parsedSkillsRaw = String(form.get("parsedSkills") || "").trim();
  const photoDetected = String(form.get("photoDetected") || "") === "true";
  const accepted = String(form.get("accepted") || "") === "true";
  const file = form.get("cv");

  if (!accepted) return bad("charte_required");
  if (handle.length < 2) return bad("handle_required");
  if (!file || !(file instanceof File)) return bad("file_required");
  if (file.type !== "application/pdf") return bad("pdf_only");
  if (file.size > 12 * 1024 * 1024) return bad("file_too_large");
  if (photoDetected) return bad("photo_forbidden");

  const parsedSkills = parsedSkillsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);

  const hasParsingPreview =
    candidateName.length > 0 || parsedEmail.length > 0 || parsedJobTitle.length > 0;
  if (!hasParsingPreview) return bad("affinda_preview_required");

  const handleNorm = handle.replace(/^@/, "").toLowerCase();
  const rlHandle = rateLimitOrNull(`iphandle:${ipHash}:${handleNorm}`, 1, 60 * 60 * 1000); // 2e tentative même pseudo / 1h
  if (rlHandle) {
    return NextResponse.json(
      { error: "rate_limited_handle", retryAfterSec: rlHandle.retryAfterSec },
      { status: 429 },
    );
  }

  // Anti-doublon: refuse un nouveau dépôt si un profil est déjà "pending" avec ce pseudo
  const existing = await supabaseServer
    .from("profiles")
    .select("id,status")
    .in("handle", [handle, handleNorm, `@${handleNorm}`])
    .eq("status", "pending")
    .limit(1);
  if (existing.error) return bad(`check_failed:${existing.error.message}`, 500);
  if (existing.data && existing.data.length > 0) return bad("already_pending", 409);

  const safeHandle = handle
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .slice(0, 60);
  const safeName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .slice(0, 80);
  const ownerToken = generateProfileOwnerToken();
  const path = `pending/${safeHandle}/${ownerToken}-${Date.now()}-${safeName}`;

  const upload = await supabaseServer.storage.from("cvs").upload(path, file, {
    upsert: false,
    contentType: "application/pdf",
  });
  if (upload.error) return bad(`upload_failed:${upload.error.message}`, 500);

  const inferredJobTitle = parsedJobTitle.length > 0 ? parsedJobTitle : "Candidature";

  const insert = await supabaseServer.from("profiles").insert({
    handle,
    job_title: inferredJobTitle,
    tags: parsedSkills,
    portfolio_url: null,
    cv_path: path,
    status: "pending",
    city: null,
  });
  if (insert.error) return bad(`insert_failed:${insert.error.message}`, 500);

  const origin = req.headers.get("origin") || "";
  const absoluteProfileUrl = origin
    ? `${origin}/mon-profil/${ownerToken}`
    : `/mon-profil/${ownerToken}`;

  return NextResponse.json(
    {
      ok: true,
      ownerToken,
      profileUrl: `/mon-profil/${ownerToken}`,
      absoluteProfileUrl,
    },
    { status: 200 },
  );
}

export async function PUT(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return bad("bad_formdata");
  const file = form.get("cv");
  if (!file || !(file instanceof File)) return bad("file_required");
  if (file.type !== "application/pdf") return bad("pdf_only");
  if (file.size > 12 * 1024 * 1024) return bad("file_too_large");
  try {
    const parsed = await parseCvWithAffinda(file);
    return NextResponse.json(
      {
        ok: true,
        parsed: {
          name: parsed.preview.name || "",
          email: parsed.preview.email || "",
          jobTitle: parsed.preview.jobTitle || "",
          skills: parsed.preview.skills || [],
          hasPhoto: !!parsed.preview.hasPhoto,
        },
      },
      { status: 200 },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "affinda_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

