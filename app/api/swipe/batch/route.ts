import { NextResponse } from "next/server";
import { readLinkedVisitorIds } from "@/lib/auth-linked-visitors";
import { normalizeCvObjectKey } from "@/lib/cv-storage-path";
import { tryGetSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
}

type ProfileRow = {
  id: string;
  handle: string;
  job_title: string;
  city: string | null;
  portfolio_url: string | null;
  cv_path: string;
  likes: number | null;
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

async function fetchVotedProfileIds(
  visitorIds: string[],
): Promise<Set<string>> {
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
  const n = Math.max(1, Math.min(15, Number(searchParams.get("n") || "7")));
  const excludeRaw = String(searchParams.get("excludeIds") || "").trim();

  if (!visitorId) return bad("visitor_required");

  const excludeIds = excludeRaw
    ? excludeRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 200)
    : [];

  let visitorIdsForVotes: string[];
  let votedIds: Set<string>;
  try {
    visitorIdsForVotes = await resolveVisitorIdsForExclusion(req, visitorId);
    votedIds = await fetchVotedProfileIds(visitorIdsForVotes);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "votes_failed";
    return bad(`votes_failed:${msg}`, 500);
  }

  const excludeSet = new Set<string>([...excludeIds, ...votedIds]);

  const res = await supabaseServer
    .from("profiles")
    .select("id,handle,job_title,city,portfolio_url,cv_path,likes")
    .eq("status", "published")
    .limit(500);

  if (res.error) return bad(`profiles_failed:${res.error.message}`, 500);

  const candidates = ((res.data ?? []) as ProfileRow[]).filter(
    (p) => p.id && !excludeSet.has(p.id),
  );

  if (!candidates.length) {
    return NextResponse.json({ done: true, items: [] }, { status: 200 });
  }

  shuffleInPlace(candidates);
  const picked = candidates.slice(0, n);
  const done = candidates.length <= n;

  const items: {
    profile: {
      id: string;
      handle: string;
      job_title: string;
      city: string | null;
      portfolio_url: string | null;
    };
    cvUrl: string;
  }[] = [];

  for (const p of picked) {
    const cvPath = normalizeCvObjectKey(p.cv_path);
    if (!cvPath) continue;
    const signed = await supabaseServer.storage
      .from("cvs")
      .createSignedUrl(cvPath, 60 * 10);
    if (signed.error || !signed.data?.signedUrl) continue;
    items.push({
      profile: {
        id: p.id,
        handle: p.handle,
        job_title: p.job_title ?? "",
        city: p.city ?? null,
        portfolio_url: p.portfolio_url ?? null,
      },
      cvUrl: signed.data.signedUrl,
    });
  }

  if (!items.length && candidates.length > 0) {
    return bad("signed_url_failed", 500);
  }

  return NextResponse.json({ done, items }, { status: 200 });
}
