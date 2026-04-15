import { NextResponse } from "next/server";
import { tryGetSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

type ProfileRow = {
  id: string;
  handle: string;
  cv_path: string;
};

export async function GET(req: Request) {
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) return bad("server_misconfigured", 500);

  const { searchParams } = new URL(req.url);
  const visitorId = String(searchParams.get("visitorId") || "").trim();
  if (!visitorId) return bad("visitor_required");

  const voted = await supabaseServer
    .from("votes")
    .select("profile_id")
    .eq("visitor_id", visitorId)
    .limit(2000);
  if (voted.error) return bad(`votes_failed:${voted.error.message}`, 500);

  const votedIds = (voted.data ?? [])
    .map((r) => String((r as { profile_id: string }).profile_id))
    .filter(Boolean);

  let q = supabaseServer
    .from("profiles")
    .select("id,handle,cv_path")
    .eq("status", "published")
    .limit(60);

  // Exclude already voted profiles (simple MVP strategy)
  if (votedIds.length > 0) {
    // supabase-js expects a string like "(id1,id2,...)"
    const escaped = votedIds
      .slice(0, 200)
      .map((id) => `"${id.replace(/"/g, "")}"`)
      .join(",");
    q = q.not("id", "in", `(${escaped})`);
  }

  const res = await q;
  if (res.error) return bad(`profiles_failed:${res.error.message}`, 500);

  const list = (res.data ?? []) as ProfileRow[];
  if (!list.length) {
    return NextResponse.json({ done: true }, { status: 200 });
  }

  const picked = list[Math.floor(Math.random() * list.length)]!;
  const cvPath = String(picked.cv_path || "").trim().replace(/^\/+/, "");
  const signed = await supabaseServer.storage
    .from("cvs")
    .createSignedUrl(cvPath, 60 * 10);

  if (signed.error || !signed.data?.signedUrl) {
    return bad(`signed_url_failed:${signed.error?.message ?? "unknown"}`, 500);
  }

  return NextResponse.json(
    {
      profile: { id: picked.id, handle: picked.handle },
      cvUrl: signed.data.signedUrl,
    },
    { status: 200 },
  );
}

