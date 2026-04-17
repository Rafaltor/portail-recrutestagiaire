import { NextResponse } from "next/server";
import { tryGetSupabaseServer } from "@/lib/supabase-server";
import { readLinkedProfileTokens } from "@/lib/auth-linked-tokens";
import { readLinkedVisitorIds } from "@/lib/auth-linked-visitors";
import { extractOwnerTokenFromCvPath } from "@/lib/profile-owner-token";

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

export async function GET(req: Request) {
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) return bad("server_misconfigured", 500);

  const authHeader = req.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) return bad("auth_required", 401);

  const { data: userRes, error: userErr } = await supabaseServer.auth.getUser(
    accessToken,
  );
  if (userErr || !userRes?.user) return bad("invalid_session", 401);
  const user = userRes.user;

  const linkedProfileTokens = readLinkedProfileTokens(
    user.user_metadata?.linked_profile_tokens,
  );
  const linkedVisitorIds = readLinkedVisitorIds(
    user.user_metadata?.linked_visitor_ids,
  );

  let profiles: ProfileRow[] = [];
  {
    const withViews = await supabaseServer
      .from("profiles")
      .select("id,handle,job_title,city,status,cv_path,created_at,views_count")
      .order("created_at", { ascending: false })
      .limit(1200);
    if (!withViews.error) {
      profiles = (withViews.data ?? []) as ProfileRow[];
    } else {
      const withoutViews = await supabaseServer
        .from("profiles")
        .select("id,handle,job_title,city,status,cv_path,created_at")
        .order("created_at", { ascending: false })
        .limit(1200);
      if (withoutViews.error) return bad(withoutViews.error.message, 500);
      profiles = (withoutViews.data ?? []) as ProfileRow[];
    }
  }

  const candidateVersions = profiles.filter((p) =>
    linkedProfileTokens.includes(extractOwnerTokenFromCvPath(p.cv_path)),
  );

  const votesRes = await supabaseServer
    .from("votes")
    .select("profile_id,value,visitor_id")
    .limit(12000);
  if (votesRes.error) return bad(votesRes.error.message, 500);
  const votes = (votesRes.data ??
    []) as Array<VoteRow & { visitor_id: string | null }>;

  const profileVoteMap = new Map<
    string,
    { likes: number; dislikes: number; score: number }
  >();
  for (const vote of votes) {
    const id = String(vote.profile_id || "");
    if (!id) continue;
    const v = Number(vote.value || 0);
    const prev = profileVoteMap.get(id) ?? { likes: 0, dislikes: 0, score: 0 };
    if (v > 0) prev.likes += 1;
    if (v < 0) prev.dislikes += 1;
    prev.score += v;
    profileVoteMap.set(id, prev);
  }

  const published = profiles
    .filter((p) => p.status === "published")
    .map((p) => ({
      id: p.id,
      score: profileVoteMap.get(p.id)?.score ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
  const rankById = new Map<string, number>();
  published.forEach((p, i) => rankById.set(p.id, i + 1));

  const latestCandidate = candidateVersions[0] ?? null;
  const latestCandidateAgg = latestCandidate
    ? profileVoteMap.get(latestCandidate.id) ?? { likes: 0, dislikes: 0, score: 0 }
    : null;

  const voterVotes = votes.filter((v) =>
    linkedVisitorIds.includes(String(v.visitor_id || "")),
  );
  const likedIds = Array.from(
    new Set(
      voterVotes
        .filter((v) => Number(v.value || 0) > 0)
        .map((v) => String(v.profile_id || ""))
        .filter(Boolean),
    ),
  );
  const dislikedIds = Array.from(
    new Set(
      voterVotes
        .filter((v) => Number(v.value || 0) < 0)
        .map((v) => String(v.profile_id || ""))
        .filter(Boolean),
    ),
  );

  const candidate = latestCandidate
    ? {
        id: latestCandidate.id,
        token: extractOwnerTokenFromCvPath(latestCandidate.cv_path),
        handle: latestCandidate.handle,
        jobTitle: latestCandidate.job_title,
        city: latestCandidate.city,
        status: latestCandidate.status,
        createdAt: latestCandidate.created_at,
        stats: {
          cvViews: Number(latestCandidate.views_count ?? 0),
          likes: latestCandidateAgg?.likes ?? 0,
          dislikes: latestCandidateAgg?.dislikes ?? 0,
          score: latestCandidateAgg?.score ?? 0,
          likesRatio:
            latestCandidateAgg &&
            latestCandidateAgg.likes + latestCandidateAgg.dislikes > 0
              ? latestCandidateAgg.likes /
                (latestCandidateAgg.likes + latestCandidateAgg.dislikes)
              : null,
          rank: rankById.get(latestCandidate.id) ?? null,
          totalRanked: published.length,
        },
      }
    : null;

  const candidateHistory = candidateVersions.map((p) => {
    const agg = profileVoteMap.get(p.id) ?? { likes: 0, dislikes: 0, score: 0 };
    return {
      id: p.id,
      createdAt: p.created_at,
      handle: p.handle,
      jobTitle: p.job_title,
      status: p.status,
      likes: agg.likes,
      dislikes: agg.dislikes,
      score: agg.score,
      cvPath: p.cv_path,
      token: extractOwnerTokenFromCvPath(p.cv_path),
    };
  });

  const voter = {
    linkedVisitorIdsCount: linkedVisitorIds.length,
    totalVotes: voterVotes.length,
    likesGiven: voterVotes.filter((v) => Number(v.value || 0) > 0).length,
    dislikesGiven: voterVotes.filter((v) => Number(v.value || 0) < 0).length,
    uniqueProfilesLiked: likedIds.length,
    uniqueProfilesDisliked: dislikedIds.length,
    rewardProgress: {
      unlocked: false,
      nextMilestoneLikes: 10,
      currentLikes: likedIds.length,
    },
  };

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email ?? "",
      },
      role: candidate ? "candidate" : "voter",
      candidate,
      candidateHistory,
      voter,
      links: {
        monProfil: candidate?.token ? `/mon-profil/${candidate.token}` : null,
      },
    },
    { status: 200 },
  );
}

