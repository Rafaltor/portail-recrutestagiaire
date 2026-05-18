import { NextResponse } from "next/server";
import { readLinkedVisitorIds } from "@/lib/auth-linked-visitors";
import {
  countLikesTodayForVisitors,
  likesQuotaFromCount,
} from "@/lib/likes-quota-server";
import { tryGetSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const url = new URL(req.url);
  const visitorId = String(url.searchParams.get("visitorId") || "").trim();
  const linkedVisitorIds = readLinkedVisitorIds(
    userRes.user.user_metadata?.linked_visitor_ids,
  );
  if (visitorId && !linkedVisitorIds.includes(visitorId)) {
    linkedVisitorIds.push(visitorId);
  }

  try {
    const likesToday = await countLikesTodayForVisitors(
      supabaseServer,
      linkedVisitorIds,
    );
    return NextResponse.json(likesQuotaFromCount(likesToday), { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "quota_fetch_failed";
    return bad(message, 500);
  }
}
