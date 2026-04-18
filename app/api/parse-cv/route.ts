import { NextResponse } from "next/server";
import crypto from "crypto";
import { parseCvWithAffinda } from "@/lib/affinda-resume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

declare global {
  var __rsParseCvHits: Map<string, number[]> | undefined;
}

const MAX_BYTES = Number(process.env.AFFINDA_PARSE_MAX_BYTES) || 5 * 1024 * 1024;

const ALLOWED_EXT = new Set([
  "pdf",
  "doc",
  "docx",
  "txt",
  "rtf",
  "odt",
  "html",
  "htm",
  "png",
  "jpg",
  "jpeg",
  "tiff",
  "xls",
  "xlsx",
]);

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
  const map = (globalThis.__rsParseCvHits ??= new Map<string, number[]>());
  const prev = map.get(key) ?? [];
  const next = prev.filter((t) => now - t < windowMs);
  next.push(now);
  map.set(key, next);
  return next.length > limit ? { retryAfterSec: Math.ceil(windowMs / 1000) } : null;
}

function bad(msg: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: msg, ...extra }, { status });
}

export async function POST(req: Request) {
  if (!process.env.AFFINDA_API_KEY?.trim()) {
    return bad("affinda_not_configured", 503, {
      info: "Définir AFFINDA_API_KEY (variables d’environnement serveur).",
    });
  }

  const ip = getClientIp(req);
  const salt =
    process.env.DEPOT_IP_SALT || process.env.VOTE_IP_SALT || "dev-salt";
  const ipHash = sha256(`${ip}|${salt}`).slice(0, 48);

  const rl = rateLimitOrNull(`parse:${ipHash}`, 30, 60 * 60 * 1000);
  if (rl) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) return bad("bad_formdata");

  const file = form.get("cv") ?? form.get("file");
  if (!file || !(file instanceof File)) return bad("file_required");

  if (file.size > MAX_BYTES) {
    return bad("file_too_large", 400, { max: MAX_BYTES });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext)) return bad("file_type");

  const buf = new Uint8Array(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";

  try {
    const out = await parseCvWithAffinda(buf, file.name, mime);
    return NextResponse.json(out, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "affinda_error";
    if (msg === "affinda_not_configured") {
      return bad("affinda_not_configured", 503);
    }
    return NextResponse.json(
      { error: "affinda", details: msg },
      { status: 502 },
    );
  }
}
