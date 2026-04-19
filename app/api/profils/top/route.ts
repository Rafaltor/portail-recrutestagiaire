import { NextResponse } from "next/server";
import { tryGetSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function weekAgoIso() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

type VoteRow = { profile_id: string; value: number | null };

function aggregateScores(rows: VoteRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const id = String(r.profile_id || "").trim();
    if (!id) continue;
    const v = Number(r.value ?? 0);
    m.set(id, (m.get(id) ?? 0) + v);
  }
  return m;
}

function topEntry(scores: Map<string, number>): { id: string; score: number } | null {
  let best: { id: string; score: number } | null = null;
  for (const [id, score] of scores) {
    if (!best || score > best.score) best = { id, score };
  }
  return best;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Meilleur profil publié (score = somme des votes) sur la fenêtre glissante 7 jours,
 * avec repli sur tout l’historique si aucun vote récent.
 */
export async function GET() {
  const supabase = tryGetSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500, headers: CORS },
    );
  }

  let rows: VoteRow[] = [];
  const weekRes = await supabase
    .from("votes")
    .select("profile_id,value")
    .gte("created_at", weekAgoIso());
  if (weekRes.error) {
    return NextResponse.json(
      { error: weekRes.error.message },
      { status: 500, headers: CORS },
    );
  }
  rows = (weekRes.data ?? []) as VoteRow[];

  if (rows.length === 0) {
    const allRes = await supabase.from("votes").select("profile_id,value");
    if (allRes.error) {
      return NextResponse.json(
        { error: allRes.error.message },
        { status: 500, headers: CORS },
      );
    }
    rows = (allRes.data ?? []) as VoteRow[];
  }

  const scores = aggregateScores(rows);
  const winner = topEntry(scores);
  if (!winner || winner.score <= 0) {
    return NextResponse.json(
      {
        ok: true,
        profile: null,
        likes: 0,
        rank_label: "Profil N°1 cette semaine",
      },
      { status: 200, headers: CORS },
    );
  }

  const profRes = await supabase
    .from("profiles")
    .select("id,handle,job_title,status")
    .eq("id", winner.id)
    .eq("status", "published")
    .maybeSingle();

  if (profRes.error || !profRes.data) {
    return NextResponse.json(
      {
        ok: true,
        profile: null,
        likes: winner.score,
        rank_label: "Profil N°1 cette semaine",
      },
      { status: 200, headers: CORS },
    );
  }

  const p = profRes.data as {
    id: string;
    handle: string;
    job_title: string;
    status: string;
  };

  return NextResponse.json(
    {
      ok: true,
      profile: {
        id: p.id,
        handle: p.handle,
        job_title: p.job_title,
        likes: winner.score,
        rank_label: "Profil N°1 cette semaine",
        profile_url: `/profil/${encodeURIComponent(p.id)}`,
      },
    },
    { status: 200, headers: CORS },
  );
}
