import { NextResponse } from "next/server";
import { tryGetSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const cvPath = String(profile.cv_path || "").trim().replace(/^\/+/, "");
  const signed = await supabaseServer.storage
    .from("cvs")
    .createSignedUrl(cvPath, 60 * 10);

  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json(
      { error: signed.error?.message ?? "signed_url_failed" },
      { status: 500 },
    );
  }

  // Best effort: increment views counter when column exists.
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

  return NextResponse.json({ url: signed.data.signedUrl }, { status: 200 });
}

