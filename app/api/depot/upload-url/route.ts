import { NextResponse } from "next/server";
import { tryGetSupabaseServer } from "@/lib/supabase-server";
import { generateProfileOwnerToken } from "@/lib/profile-owner-token";
import {
  assertDepotHandleAvailable,
  buildDepotCvPath,
  depotIpHash,
  depotRateLimitOrNull,
  normalizeDepotHandle,
  validateDepotFileMeta,
} from "@/lib/depot-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string, status = 400, retryAfterSec?: number) {
  return NextResponse.json(
    retryAfterSec != null ? { error: msg, retryAfterSec } : { error: msg },
    { status },
  );
}

export async function POST(req: Request) {
  try {
    const supabaseServer = tryGetSupabaseServer();
    if (!supabaseServer) return bad("server_misconfigured", 500);

    let body: { handle?: string; fileName?: string; fileSize?: number };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return bad("bad_json", 400);
    }

    const handle = String(body.handle || "").trim();
    const fileName = String(body.fileName || "").trim();
    const fileSize = Number(body.fileSize || 0);

    if (handle.length < 2) return bad("handle_required");
    const fileErr = validateDepotFileMeta(fileName, fileSize);
    if (fileErr) return bad(fileErr);

    const ipHash = depotIpHash(req);
    const { handleNorm, storedHandle, safeHandle, handleCandidates } =
      normalizeDepotHandle(handle);
    if (safeHandle.length < 1) return bad("handle_invalid");

    const rlUrl = depotRateLimitOrNull(`upload-url:${ipHash}`, 15, 60 * 60 * 1000);
    if (rlUrl) return bad("rate_limited", 429, rlUrl.retryAfterSec);

    const handleCheck = await assertDepotHandleAvailable(
      supabaseServer,
      handleCandidates,
    );
    if (handleCheck.error) {
      const status = handleCheck.error === "already_pending" ? 409 : 409;
      return bad(handleCheck.error, status);
    }

    const ownerToken = generateProfileOwnerToken();
    const path = buildDepotCvPath(safeHandle, ownerToken, fileName);

    const signed = await supabaseServer.storage
      .from("cvs")
      .createSignedUploadUrl(path, { upsert: false });
    if (signed.error || !signed.data?.signedUrl) {
      console.error("[depot] signed_upload_url_failed:", signed.error?.message);
      return bad(`upload_failed:${signed.error?.message ?? "signed_url"}`, 500);
    }

    return NextResponse.json({
      ok: true,
      signedUrl: signed.data.signedUrl,
      token: signed.data.token,
      path: signed.data.path ?? path,
      ownerToken,
      storedHandle,
    });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : "unknown";
    console.error("[depot] upload-url unhandled:", detail);
    return bad("internal_error", 500);
  }
}
