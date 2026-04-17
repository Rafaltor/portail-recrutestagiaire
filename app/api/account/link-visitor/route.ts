import { NextResponse } from "next/server";
import { tryGetSupabaseServer } from "@/lib/supabase-server";
import { readLinkedVisitorIds } from "@/lib/auth-linked-visitors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) return bad("server_misconfigured", 500);

  const authHeader = req.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) return bad("auth_required", 401);

  let body: { visitorId?: string };
  try {
    body = (await req.json()) as { visitorId?: string };
  } catch {
    return bad("bad_json", 400);
  }
  const visitorId = String(body.visitorId || "").trim().slice(0, 200);
  if (!visitorId) return bad("visitor_required", 400);

  const { data: userRes, error: userErr } = await supabaseServer.auth.getUser(
    accessToken,
  );
  if (userErr || !userRes?.user) return bad("invalid_session", 401);

  const user = userRes.user;
  const linkedVisitorIds = readLinkedVisitorIds(
    user.user_metadata?.linked_visitor_ids,
  );
  if (!linkedVisitorIds.includes(visitorId)) linkedVisitorIds.push(visitorId);

  const updateRes = await supabaseServer.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata ?? {}),
      linked_visitor_ids: linkedVisitorIds,
    },
  });
  if (updateRes.error) return bad(updateRes.error.message, 500);

  return NextResponse.json(
    {
      ok: true,
      visitorId,
      linkedVisitorIdsCount: linkedVisitorIds.length,
    },
    { status: 200 },
  );
}
