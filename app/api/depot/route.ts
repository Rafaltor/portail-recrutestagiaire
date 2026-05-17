import { NextResponse } from "next/server";
import { tryGetSupabaseServer } from "@/lib/supabase-server";
import { generateProfileOwnerToken } from "@/lib/profile-owner-token";
import { parseCvWithAffinda } from "@/lib/affinda";
import { isPdfUpload } from "@/lib/pdf-file";
import { DEPOT_API_MAX_BYTES } from "@/lib/depot-errors";
import {
  assertCvObjectExists,
  assertDepotHandleAvailable,
  assertDepotRateLimits,
  buildDepotCvPath,
  depotIpHash,
  depotProfileUrls,
  insertDepotProfile,
  normalizeDepotHandle,
} from "@/lib/depot-server";
import { extractOwnerTokenFromCvPath } from "@/lib/profile-owner-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function bad(msg: string, status = 400, retryAfterSec?: number) {
  return NextResponse.json(
    retryAfterSec != null ? { error: msg, retryAfterSec } : { error: msg },
    { status },
  );
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await finalizeDepotPost(req);
    }
    return await multipartDepotPost(req);
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : "unknown";
    console.error("[depot] POST unhandled:", detail);
    return bad("internal_error", 500);
  }
}

async function finalizeDepotPost(req: Request) {
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) return bad("server_misconfigured", 500);

  let body: {
    path?: string;
    ownerToken?: string;
    handle?: string;
    parsedJobTitle?: string;
    parsedSkills?: string;
    parsedCity?: string;
    accepted?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("bad_json", 400);
  }

  const path = String(body.path || "").trim();
  const ownerToken = String(body.ownerToken || "").trim();
  const handle = String(body.handle || "").trim();
  const parsedJobTitle = String(body.parsedJobTitle || "").trim();
  const parsedSkillsRaw = String(body.parsedSkills || "").trim();
  const parsedCity = String(body.parsedCity || "").trim();
  const accepted = body.accepted === true;

  if (!accepted) return bad("charte_required");
  if (handle.length < 2) return bad("handle_required");
  if (!path || !ownerToken) return bad("file_required");
  if (extractOwnerTokenFromCvPath(path) !== ownerToken) {
    return bad("bad_request", 400);
  }

  const ipHash = depotIpHash(req);
  const { handleNorm, storedHandle, safeHandle, handleCandidates } =
    normalizeDepotHandle(handle);
  if (safeHandle.length < 1) return bad("handle_invalid");

  const rl = assertDepotRateLimits(ipHash, handleNorm);
  if (rl.error) return bad(rl.error, 429, rl.retryAfterSec);

  const handleCheck = await assertDepotHandleAvailable(
    supabaseServer,
    handleCandidates,
  );
  if (handleCheck.error) {
    return bad(handleCheck.error, 409);
  }

  const exists = await assertCvObjectExists(supabaseServer, path);
  if (!exists.ok) return bad(exists.error, 400);

  const parsedSkills = parsedSkillsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);

  const insert = await insertDepotProfile(supabaseServer, {
    storedHandle,
    parsedJobTitle,
    parsedSkills,
    parsedCity,
    cvPath: path,
  });
  if (insert.error) {
    console.error("[depot] insert_failed:", insert.error.message);
    return bad(`insert_failed:${insert.error.message}`, 500);
  }

  return NextResponse.json(
    { ok: true, ...depotProfileUrls(req, ownerToken) },
    { status: 200 },
  );
}

/** Petit PDF uniquement — limite corps requête Vercel (~4,5 Mo). */
async function multipartDepotPost(req: Request) {
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) return bad("server_misconfigured", 500);

  const ipHash = depotIpHash(req);
  const form = await req.formData().catch(() => null);
  if (!form) return bad("bad_formdata");

  const handle = String(form.get("handle") || "").trim();
  const parsedJobTitle = String(form.get("parsedJobTitle") || "").trim();
  const parsedSkillsRaw = String(form.get("parsedSkills") || "").trim();
  const parsedCity = String(form.get("parsedCity") || "").trim();
  const accepted = String(form.get("accepted") || "") === "true";
  const file = form.get("cv");

  if (!accepted) return bad("charte_required");
  if (handle.length < 2) return bad("handle_required");
  if (!file || !(file instanceof File)) return bad("file_required");
  if (!isPdfUpload(file)) return bad("pdf_only");
  if (file.size > DEPOT_API_MAX_BYTES) return bad("file_too_large");

  const { handleNorm, storedHandle, safeHandle, handleCandidates } =
    normalizeDepotHandle(handle);
  if (safeHandle.length < 1) return bad("handle_invalid");

  const rl = assertDepotRateLimits(ipHash, handleNorm);
  if (rl.error) return bad(rl.error, 429, rl.retryAfterSec);

  const handleCheck = await assertDepotHandleAvailable(
    supabaseServer,
    handleCandidates,
  );
  if (handleCheck.error) return bad(handleCheck.error, 409);

  const ownerToken = generateProfileOwnerToken();
  const path = buildDepotCvPath(safeHandle, ownerToken, file.name);

  const upload = await supabaseServer.storage.from("cvs").upload(path, file, {
    upsert: false,
    contentType: "application/pdf",
  });
  if (upload.error) {
    console.error("[depot] upload_failed:", upload.error.message, path);
    return bad(`upload_failed:${upload.error.message}`, 500);
  }

  const parsedSkills = parsedSkillsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);

  const insert = await insertDepotProfile(supabaseServer, {
    storedHandle,
    parsedJobTitle,
    parsedSkills,
    parsedCity,
    cvPath: path,
  });
  if (insert.error) {
    console.error("[depot] insert_failed:", insert.error.message);
    return bad(`insert_failed:${insert.error.message}`, 500);
  }

  return NextResponse.json(
    { ok: true, ...depotProfileUrls(req, ownerToken) },
    { status: 200 },
  );
}

export async function PUT(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return analyzeFromStorage(req);
  }
  return analyzeFromMultipart(req);
}

async function analyzeFromStorage(req: Request) {
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) return bad("server_misconfigured", 500);

  let body: { path?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("bad_json", 400);
  }
  const path = String(body.path || "").trim();
  if (!path) return bad("file_required");

  const download = await supabaseServer.storage.from("cvs").download(path);
  if (download.error || !download.data) {
    return bad(`affinda_failed:storage_${download.error?.message ?? "missing"}`, 502);
  }
  const file = new File([await download.data.arrayBuffer()], "cv.pdf", {
    type: "application/pdf",
  });
  return runAffindaParse(file);
}

async function analyzeFromMultipart(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return bad("bad_formdata");
  const file = form.get("cv");
  if (!file || !(file instanceof File)) return bad("file_required");
  if (!isPdfUpload(file)) return bad("pdf_only");
  if (file.size > DEPOT_API_MAX_BYTES) return bad("file_too_large");
  return runAffindaParse(file);
}

async function runAffindaParse(file: File) {
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
          city: parsed.preview.city || "",
        },
      },
      { status: 200 },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "affinda_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
