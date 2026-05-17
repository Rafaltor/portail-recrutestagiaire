import { NextResponse } from "next/server";
import { readLinkedVisitorIds } from "@/lib/auth-linked-visitors";
import { normalizeCvObjectKey } from "@/lib/cv-storage-path";
import { tryGetSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

type ProfileRow = {
  id: string;
  handle: string;
  job_title: string;
  city: string | null;
  portfolio_url: string | null;
  cv_path: string;
};

async function resolveVisitorIdsForExclusion(
  req: Request,
  visitorId: string,
): Promise<string[]> {
  const ids = new Set<string>([visitorId]);
  const authHeader = req.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) return [...ids];

  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) return [...ids];

  const { data: userRes } = await supabaseServer.auth.getUser(accessToken);
  if (!userRes?.user) return [...ids];

  for (const linked of readLinkedVisitorIds(
    userRes.user.user_metadata?.linked_visitor_ids,
  )) {
    ids.add(linked);
  }
  return [...ids];
}

async function fetchVotedProfileIds(visitorIds: string[]): Promise<Set<string>> {
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) return new Set();

  const voted = new Set<string>();
  for (const vid of visitorIds) {
    const res = await supabaseServer
      .from("votes")
      .select("profile_id")
      .eq("visitor_id", vid)
      .limit(5000);
    if (res.error) throw new Error(res.error.message);
    for (const row of res.data ?? []) {
      const id = String((row as { profile_id: string }).profile_id || "").trim();
      if (id) voted.add(id);
    }
  }
  return voted;
}

export async function GET(req: Request) {
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) return bad("server_misconfigured", 500);

  const { searchParams } = new URL(req.url);
  const visitorId = String(searchParams.get("visitorId") || "").trim();
  if (!visitorId) return bad("visitor_required");

  let votedIds: Set<string>;
  try {
    const visitorIds = await resolveVisitorIdsForExclusion(req, visitorId);
    votedIds = await fetchVotedProfileIds(visitorIds);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "votes_failed";
    return bad(`votes_failed:${msg}`, 500);
  }

  const res = await supabaseServer
    .from("profiles")
    .select("id,handle,job_title,city,portfolio_url,cv_path")
    .eq("status", "published")
    .limit(500);

  if (res.error) return bad(`profiles_failed:${res.error.message}`, 500);

  const list = ((res.data ?? []) as ProfileRow[]).filter(
    (p) => p.id && !votedIds.has(p.id),
  );

  if (!list.length) {
    return NextResponse.json({ done: true }, { status: 200 });
  }

  const picked = list[Math.floor(Math.random() * list.length)]!;
  const cvPath = normalizeCvObjectKey(picked.cv_path);
  if (!cvPath) {
    return bad("cv_path_missing", 422);
  }
  const signed = await supabaseServer.storage
    .from("cvs")
    .createSignedUrl(cvPath, 60 * 10);

  if (signed.error || !signed.data?.signedUrl) {
    return bad(`signed_url_failed:${signed.error?.message ?? "unknown"}`, 500);
  }

  return NextResponse.json(
    {
      profile: {
        id: picked.id,
        handle: picked.handle,
        job_title: picked.job_title ?? "",
        city: picked.city ?? null,
        portfolio_url: picked.portfolio_url ?? null,
      },
      cvUrl: signed.data.signedUrl,
    },
    { status: 200 },
  );
}
