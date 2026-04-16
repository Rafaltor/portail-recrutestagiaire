import { NextResponse } from "next/server";
import { tryGetSupabaseServer } from "@/lib/supabase-server";
import {
  extractOwnerTokenFromCvPath,
  sanitizeProfileOwnerToken,
} from "@/lib/profile-owner-token";
import { readLinkedProfileTokens } from "@/lib/auth-linked-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  cv_path: string;
  status: string;
  created_at: string;
  handle: string;
  job_title: string;
  city: string | null;
};

type VoteRow = {
  profile_id: string;
  value: number;
};

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const cleanToken = sanitizeProfileOwnerToken(token);
  if (!cleanToken) return bad("invalid_token", 404);

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
  const linkedTokens = readLinkedProfileTokens(
    userRes.user.user_metadata?.linked_profile_tokens,
  );
  if (!linkedTokens.includes(cleanToken)) return bad("forbidden", 403);

  const profilesRes = await supabaseServer
    .from("profiles")
    .select("id,cv_path,status,created_at,handle,job_title,city")
    .order("created_at", { ascending: false })
    .limit(1200);
  if (profilesRes.error) return bad(profilesRes.error.message, 500);
  const profiles = (profilesRes.data ?? []) as ProfileRow[];

  const versions = profiles
    .filter((p) => extractOwnerTokenFromCvPath(p.cv_path) === cleanToken)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  if (!versions.length) return bad("invalid_token", 404);

  const profileIds = versions.map((v) => v.id);
  const votesRes = await supabaseServer
    .from("votes")
    .select("profile_id,value")
    .in("profile_id", profileIds)
    .limit(8000);
  if (votesRes.error) return bad(votesRes.error.message, 500);
  const votes = (votesRes.data ?? []) as VoteRow[];

  const voteAgg = new Map<string, { likes: number; dislikes: number; score: number }>();
  for (const vote of votes) {
    const id = String(vote.profile_id || "");
    if (!id) continue;
    const v = Number(vote.value || 0);
    const prev = voteAgg.get(id) ?? { likes: 0, dislikes: 0, score: 0 };
    if (v > 0) prev.likes += 1;
    if (v < 0) prev.dislikes += 1;
    prev.score += v;
    voteAgg.set(id, prev);
  }

  const items = versions.map((v, i) => {
    const agg = voteAgg.get(v.id) ?? { likes: 0, dislikes: 0, score: 0 };
    return {
      id: v.id,
      versionIndex: versions.length - i,
      createdAt: v.created_at,
      handle: v.handle,
      jobTitle: v.job_title,
      city: v.city,
      status: v.status,
      cvPath: v.cv_path,
      likes: agg.likes,
      dislikes: agg.dislikes,
      score: agg.score,
    };
  });

  const evolution = items.map((item, i) => {
    if (i === items.length - 1) {
      return { id: item.id, deltaLikes: null, deltaDislikes: null, deltaScore: null };
    }
    const prev = items[i + 1];
    return {
      id: item.id,
      deltaLikes: item.likes - prev.likes,
      deltaDislikes: item.dislikes - prev.dislikes,
      deltaScore: item.score - prev.score,
    };
  });

  return NextResponse.json({ items, evolution }, { status: 200 });
}
