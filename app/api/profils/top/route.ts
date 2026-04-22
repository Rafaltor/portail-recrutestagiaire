import { NextResponse } from "next/server";
import { normalizeCvObjectKey } from "@/lib/cv-storage-path";
import { tryGetSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const TOP_N = 3;

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

function topN(
  scores: Map<string, number>,
  n: number,
): { id: string; score: number }[] {
  return [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, score]) => ({ id, score }));
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Meilleurs profils publiés (score = somme des votes) sur la fenêtre glissante 7 jours,
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
  const winners = topN(scores, TOP_N);
  if (winners.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        profiles: [],
        profile: null,
        likes: 0,
        rank_label: "Profil N°1 cette semaine",
      },
      { status: 200, headers: CORS },
    );
  }

  const ids = winners.map((w) => w.id);
  const profRes = await supabase
    .from("profiles")
    .select("id,handle,job_title,status,cv_path")
    .in("id", ids)
    .eq("status", "published");

  if (profRes.error || !profRes.data?.length) {
    return NextResponse.json(
      {
        ok: true,
        profiles: [],
        profile: null,
        likes: winners[0]?.score ?? 0,
        rank_label: "Profil N°1 cette semaine",
      },
      { status: 200, headers: CORS },
    );
  }

  type ProfileRow = {
    id: string;
    handle: string;
    job_title: string;
    status: string;
    cv_path: string | null;
  };

  const byId = new Map(
    (profRes.data as ProfileRow[]).map((p) => [p.id, p] as const),
  );

  const ordered: { p: ProfileRow; score: number }[] = [];
  for (const w of winners) {
    const p = byId.get(w.id);
    if (p) ordered.push({ p, score: w.score });
  }

  const profilesPayload: {
    id: string;
    handle: string;
    job_title: string;
    likes: number;
    rank_label: string;
    profile_url: string;
    cv?: string;
    cv_url?: string;
  }[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const { p, score } = ordered[i]!;
    const rank = i + 1;
    const rank_label =
      rank === 1
        ? "Profil N°1 cette semaine"
        : rank === 2
          ? "Profil N°2 cette semaine"
          : "Profil N°3 cette semaine";

    let cvUrl = "";
    if (rank === 1) {
      const cvKey = normalizeCvObjectKey(p.cv_path);
      if (cvKey) {
        const signed = await supabase.storage.from("cvs").createSignedUrl(cvKey, 60 * 15);
        if (!signed.error && signed.data?.signedUrl) {
          cvUrl = signed.data.signedUrl;
        }
      }
    }

    profilesPayload.push({
      id: p.id,
      handle: p.handle,
      job_title: p.job_title,
      likes: score,
      rank_label,
      profile_url: `/profil/${encodeURIComponent(p.id)}`,
      ...(cvUrl ? { cv: cvUrl, cv_url: cvUrl } : {}),
    });
  }

  const first = profilesPayload[0] ?? null;

  return NextResponse.json(
    {
      ok: true,
      profiles: profilesPayload,
      profile: first,
      likes: first?.likes ?? 0,
      rank_label: first?.rank_label ?? "Profil N°1 cette semaine",
    },
    { status: 200, headers: CORS },
  );
}
