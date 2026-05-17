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

type ProfileRow = {
  id: string;
  handle: string;
  job_title: string;
  status: string;
  cv_path: string | null;
  likes: number | null;
  created_at?: string | null;
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Meilleurs profils publiés (par `profiles.likes` desc, l'agrégat est maintenu par
 * /api/vote à chaque scrutin). Renvoie toujours TOP_N cartes : si moins de TOP_N
 * profils publiés ont des votes positifs, on complète par les profils publiés les
 * plus récents pour ne jamais retourner une grille incomplète.
 */
export async function GET() {
  const supabase = tryGetSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500, headers: CORS },
    );
  }

  // Tous les profils publiés, classés par score (`likes` = somme des votes ±1)
  // puis par date de création pour départager les égalités.
  const profRes = await supabase
    .from("profiles")
    .select("id,handle,job_title,status,cv_path,likes,created_at")
    .eq("status", "published")
    .order("likes", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (profRes.error) {
    return NextResponse.json(
      { error: profRes.error.message },
      { status: 500, headers: CORS },
    );
  }

  const allPublished = (profRes.data ?? []) as ProfileRow[];

  // 1) Profils avec score > 0 (les vraies "meilleurs profils").
  const voted = allPublished.filter((p) => Number(p.likes ?? 0) > 0);

  // 2) Complétion : si moins de TOP_N profils votés, on prend les plus récents
  //    publiés (qui sont en fin de la liste triée par likes desc) pour remplir.
  const ordered: ProfileRow[] = [...voted.slice(0, TOP_N)];
  if (ordered.length < TOP_N) {
    const usedIds = new Set(ordered.map((p) => p.id));
    for (const p of allPublished) {
      if (ordered.length >= TOP_N) break;
      if (!usedIds.has(p.id)) {
        ordered.push(p);
        usedIds.add(p.id);
      }
    }
  }

  if (ordered.length === 0) {
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
    const p = ordered[i]!;
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
        const signed = await supabase.storage
          .from("cvs")
          .createSignedUrl(cvKey, 60 * 15);
        if (!signed.error && signed.data?.signedUrl) {
          cvUrl = signed.data.signedUrl;
        }
      }
    }

    profilesPayload.push({
      id: p.id,
      handle: p.handle,
      job_title: p.job_title,
      likes: Math.max(0, Number(p.likes ?? 0)),
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
