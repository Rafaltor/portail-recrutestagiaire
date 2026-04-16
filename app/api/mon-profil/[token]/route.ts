import { NextResponse } from "next/server";
import { tryGetSupabaseServer } from "@/lib/supabase-server";
import {
  extractOwnerTokenFromCvPath,
  sanitizeProfileOwnerToken,
} from "@/lib/profile-owner-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  handle: string;
  job_title: string;
  city: string | null;
  status: string;
  cv_path: string;
  created_at: string;
  views_count?: number | null;
};

type VoteRow = {
  profile_id: string;
  value: number;
};

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const cleanToken = sanitizeProfileOwnerToken(token);
  if (!cleanToken) return bad("invalid_token", 404);

  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) return bad("server_misconfigured", 500);

  let profiles: ProfileRow[] = [];
  {
    const withViews = await supabaseServer
      .from("profiles")
      .select("id,handle,job_title,city,status,cv_path,created_at,views_count")
      .order("created_at", { ascending: false })
      .limit(600);
    if (!withViews.error) {
      profiles = (withViews.data ?? []) as ProfileRow[];
    } else {
      const withoutViews = await supabaseServer
        .from("profiles")
        .select("id,handle,job_title,city,status,cv_path,created_at")
        .order("created_at", { ascending: false })
        .limit(600);
      if (withoutViews.error) return bad(withoutViews.error.message, 500);
      profiles = (withoutViews.data ?? []) as ProfileRow[];
    }
  }
  const target = profiles.find(
    (p) => extractOwnerTokenFromCvPath(p.cv_path) === cleanToken,
  );
  if (!target) return bad("invalid_token", 404);

  const votesRes = await supabaseServer
    .from("votes")
    .select("profile_id,value")
    .limit(8000);
  if (votesRes.error) return bad(votesRes.error.message, 500);
  const votes = (votesRes.data ?? []) as VoteRow[];

  const byProfile = new Map<
    string,
    { likes: number; dislikes: number; score: number }
  >();
  for (const vote of votes) {
    const id = String(vote.profile_id || "");
    if (!id) continue;
    const v = Number(vote.value || 0);
    const prev = byProfile.get(id) ?? { likes: 0, dislikes: 0, score: 0 };
    if (v > 0) prev.likes += 1;
    if (v < 0) prev.dislikes += 1;
    prev.score += v;
    byProfile.set(id, prev);
  }

  const published = profiles
    .filter((p) => p.status === "published")
    .map((p) => {
      const agg = byProfile.get(p.id) ?? { likes: 0, dislikes: 0, score: 0 };
      return {
        id: p.id,
        score: agg.score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const rankIndex = published.findIndex((p) => p.id === target.id);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;

  const current = byProfile.get(target.id) ?? { likes: 0, dislikes: 0, score: 0 };
  const totalVotes = current.likes + current.dislikes;
  const likesRatio = totalVotes > 0 ? current.likes / totalVotes : null;

  return NextResponse.json(
    {
      profile: {
        id: target.id,
        handle: target.handle,
        jobTitle: target.job_title,
        city: target.city,
        status: target.status,
        createdAt: target.created_at,
      },
      stats: {
        cvViews: Number(target.views_count ?? 0),
        likes: current.likes,
        dislikes: current.dislikes,
        score: current.score,
        likesRatio,
        hasVotes: totalVotes > 0,
        rank,
        totalRanked: published.length,
      },
    },
    { status: 200 },
  );
}
