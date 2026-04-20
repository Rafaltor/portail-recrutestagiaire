import { NextResponse } from "next/server";
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
  cv_path: string;
  likes: number | null;
};

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

  const voted = await supabaseServer
    .from("votes")
    .select("profile_id")
    .eq("visitor_id", visitorId)
    .limit(4000);
  if (voted.error) return bad(`votes_failed:${voted.error.message}`, 500);

  const votedIds = (voted.data ?? [])
    .map((r) => String((r as { profile_id: string }).profile_id))
    .filter(Boolean)
    .slice(0, 4000);

  const allExcludes = Array.from(new Set([...excludeIds, ...votedIds])).slice(
    0,
    400,
  );

  /* Pas de tri par score ici : ordre aléatoire côté swipe (page /profils garde le classement). */
  let q = supabaseServer
    .from("profiles")
    .select("id,handle,cv_path,likes")
    .eq("status", "published")
    .limit(120);

  if (allExcludes.length > 0) {
    const escaped = allExcludes
      .map((id) => `"${id.replace(/"/g, "")}"`)
      .join(",");
    q = q.not("id", "in", `(${escaped})`);
  }

  const res = await q;
  if (res.error) return bad(`profiles_failed:${res.error.message}`, 500);

  const candidates = (res.data ?? []) as ProfileRow[];
  if (!candidates.length) {
    return NextResponse.json({ done: true, items: [] }, { status: 200 });
  }

  shuffleInPlace(candidates);
  const picked = candidates.slice(0, n);

  const items: { profile: { id: string; handle: string }; cvUrl: string }[] = [];
  for (const p of picked) {
    const cvPath = normalizeCvObjectKey(p.cv_path);
    if (!cvPath) continue;
    const signed = await supabaseServer.storage
      .from("cvs")
      .createSignedUrl(cvPath, 60 * 10);
    if (signed.error || !signed.data?.signedUrl) continue;
    items.push({
      profile: { id: p.id, handle: p.handle },
      cvUrl: signed.data.signedUrl,
    });
  }

  /* `done` = plus aucun profil publié hors exclus/votes en base — pas « aucune URL signée » sur ce tirage. */
  const done = candidates.length === 0;
  return NextResponse.json({ done, items }, { status: 200 });
}

