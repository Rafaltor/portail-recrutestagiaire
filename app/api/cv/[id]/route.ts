import { NextResponse } from "next/server";
import { normalizeCvObjectKey } from "@/lib/cv-storage-path";
import { tryGetSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isStorageObjectMissing(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("not found") ||
    m.includes("does not exist") ||
    m.includes("object not found") ||
    m.includes("no such file") ||
    m.includes("404")
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const intent = new URL(req.url).searchParams.get("intent");
  const isListPreview = intent === "preview";
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 },
    );
  }

  const profileRes = await supabaseServer
    .from("profiles")
    .select("id,cv_path,status")
    .eq("id", id)
    .maybeSingle();

  if (profileRes.error) {
    return NextResponse.json(
      { error: profileRes.error.message },
      { status: 500 },
    );
  }

  const profile = profileRes.data as
    | { id: string; cv_path: string; status: string }
    | null;

  if (!profile || profile.status !== "published") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const cvPath = normalizeCvObjectKey(profile.cv_path);
  if (!cvPath) {
    return NextResponse.json(
      { error: "cv_path_missing", code: "CV_PATH_MISSING" },
      { status: 422 },
    );
  }

  const signed = await supabaseServer.storage
    .from("cvs")
    .createSignedUrl(cvPath, 60 * 10);

  if (signed.error || !signed.data?.signedUrl) {
    const msg = signed.error?.message ?? "signed_url_failed";
    const status = isStorageObjectMissing(msg) ? 404 : 502;
    return NextResponse.json(
      {
        error: "cv_storage_failed",
        code: "CV_STORAGE_FAILED",
        detail: msg,
      },
      { status },
    );
  }

  /* Ne pas compter une « vue » pour les miniatures liste (/profils). */
  if (!isListPreview) {
    const viewsRes = await supabaseServer
      .from("profiles")
      .select("views_count")
      .eq("id", id)
      .maybeSingle();
    if (!viewsRes.error && viewsRes.data) {
      const current = Number(
        (viewsRes.data as { views_count?: number | null }).views_count ?? 0,
      );
      await supabaseServer
        .from("profiles")
        .update({ views_count: current + 1 })
        .eq("id", id);
    }
  }

  return NextResponse.json({ url: signed.data.signedUrl }, { status: 200 });
}

