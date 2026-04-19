import { NextResponse } from "next/server";
import crypto from "crypto";
import { tryGetSupabaseServer } from "@/lib/supabase-server";
import { AUTH_LIKES_PER_DAY } from "@/lib/swipe-gating";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VoteBody = {
  profileId: string;
  value: 1 | -1;
  visitorId: string;
};

declare global {
  var __rsVoteHits: Map<string, number[]> | undefined;
}

function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function rateLimitOrNull(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const map = (globalThis.__rsVoteHits ??= new Map<string, number[]>());
  const prev = map.get(key) ?? [];
  const next = prev.filter((t) => now - t < windowMs);
  next.push(now);
  map.set(key, next);
  return next.length > limit ? { retryAfterSec: Math.ceil(windowMs / 1000) } : null;
}

function dayKeyUTC(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function readLinkedVisitorIds(raw: unknown) {
  if (!Array.isArray(raw)) return [] as string[];
  const out: string[] = [];
  for (const item of raw) {
    const clean = String(item || "").trim();
    if (!clean) continue;
    if (!out.includes(clean)) out.push(clean);
  }
  return out;
}

export async function POST(req: Request) {
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  let body: VoteBody;
  try {
    body = (await req.json()) as VoteBody;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const profileId = String(body.profileId || "").trim();
  const visitorId = String(body.visitorId || "").trim();
  const value = body.value;

  if (!profileId || !visitorId || (value !== 1 && value !== -1)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const salt = process.env.VOTE_IP_SALT || "dev-salt";
  const ipHash = sha256(`${ip}|${salt}`).slice(0, 48);

  const rl = rateLimitOrNull(ipHash, 25, 10 * 60 * 1000); // 25 votes / 10 min / IP-hash
  if (rl) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  // If authenticated, enforce 10 likes/day across linked visitor ids.
  const authHeader = req.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (accessToken && value === 1) {
    const { data: userRes, error: userErr } = await supabaseServer.auth.getUser(
      accessToken,
    );
    if (!userErr && userRes?.user) {
      const linkedVisitorIds = readLinkedVisitorIds(
        userRes.user.user_metadata?.linked_visitor_ids,
      );
      if (!linkedVisitorIds.includes(visitorId)) linkedVisitorIds.push(visitorId);
      if (linkedVisitorIds.length > 0) {
        const start = `${dayKeyUTC()}T00:00:00.000Z`;
        const end = `${dayKeyUTC()}T23:59:59.999Z`;
        const likesTodayRes = await supabaseServer
          .from("votes")
          .select("id", { count: "exact" })
          .in("visitor_id", linkedVisitorIds)
          .eq("value", 1)
          .gte("created_at", start)
          .lte("created_at", end);
        if (likesTodayRes.error) {
          return NextResponse.json(
            { error: likesTodayRes.error.message },
            { status: 500 },
          );
        }
        const likesToday = Number(likesTodayRes.count ?? 0);
        if (likesToday >= AUTH_LIKES_PER_DAY) {
          return NextResponse.json(
            { error: "likes_limit_reached", limit: AUTH_LIKES_PER_DAY },
            { status: 429 },
          );
        }
      }
    }
  }

  // Ensure profile exists and is published
  const p = await supabaseServer
    .from("profiles")
    .select("id,status")
    .eq("id", profileId)
    .maybeSingle();
  if (p.error) return NextResponse.json({ error: p.error.message }, { status: 500 });
  if (!p.data || p.data.status !== "published") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Read previous vote (if any)
  const prevRes = await supabaseServer
    .from("votes")
    .select("value")
    .eq("profile_id", profileId)
    .eq("visitor_id", visitorId)
    .maybeSingle();
  if (prevRes.error) {
    return NextResponse.json({ error: prevRes.error.message }, { status: 500 });
  }
  const prev = prevRes.data?.value ?? 0;

  /** Score agrégé sur le profil (colonne `likes` = somme des votes, hors sync manuelle). */
  const likesRes = await supabaseServer
    .from("profiles")
    .select("likes")
    .eq("id", profileId)
    .maybeSingle();
  if (likesRes.error) {
    return NextResponse.json({ error: likesRes.error.message }, { status: 500 });
  }
  const profileLikes = Number(likesRes.data?.likes ?? 0);
  /** Avis « reste de la communauté » avant d’appliquer le nouveau vote : on retire le vote actuel du visiteur. */
  const othersNet = profileLikes - prev;

  let aligned: boolean | null = null;
  if (othersNet > 0) aligned = value === 1;
  else if (othersNet < 0) aligned = value === -1;
  else aligned = null;

  let rhMessage: string;
  if (aligned === true) {
    rhMessage =
      "Tu es aligné avec le ressenti majoritaire sur ce CV — bon réflexe côté recrutement.";
  } else if (aligned === false) {
    rhMessage =
      "Tu te distingues de l’avis le plus partagé — ce n’est pas « faux », mais c’est un autre regard RH.";
  } else {
    rhMessage =
      "Pas encore de consensus clair : ton vote compte pour faire pencher la balance.";
  }

  const up = await supabaseServer.from("votes").upsert(
    {
      profile_id: profileId,
      visitor_id: visitorId,
      value,
      ip_hash: ipHash,
    },
    { onConflict: "profile_id,visitor_id" },
  );
  if (up.error) {
    return NextResponse.json({ error: up.error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      prev,
      value,
      rh: {
        aligned,
        othersNet,
        message: rhMessage,
      },
    },
    { status: 200 },
  );
}

