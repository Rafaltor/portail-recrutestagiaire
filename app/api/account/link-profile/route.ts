import { NextResponse } from "next/server";
import { tryGetSupabaseServer } from "@/lib/supabase-server";
import { sanitizeProfileOwnerToken } from "@/lib/profile-owner-token";
import { readLinkedProfileTokens } from "@/lib/auth-linked-tokens";

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

  let body: { token?: string };
  try {
    body = (await req.json()) as { token?: string };
  } catch {
    return bad("bad_json", 400);
  }
  const token = sanitizeProfileOwnerToken(String(body.token || ""));
  if (!token) return bad("invalid_token", 400);

  const { data: userRes, error: userErr } = await supabaseServer.auth.getUser(
    accessToken,
  );
  if (userErr || !userRes?.user) return bad("invalid_session", 401);
  const user = userRes.user;

  const profileRes = await supabaseServer
    .from("profiles")
    .select("id,handle,job_title,status,cv_path,created_at")
    .ilike("cv_path", `%/${token}-%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (profileRes.error) return bad(profileRes.error.message, 500);
  if (!profileRes.data) return bad("invalid_token", 404);

  const currentTokens = readLinkedProfileTokens(
    user.user_metadata?.linked_profile_tokens,
  );
  if (!currentTokens.includes(token)) currentTokens.push(token);

  const updatedMetadata = {
    ...(user.user_metadata ?? {}),
    linked_profile_tokens: currentTokens,
  };

  const updateRes = await supabaseServer.auth.admin.updateUserById(user.id, {
    user_metadata: updatedMetadata,
  });
  if (updateRes.error) return bad(updateRes.error.message, 500);

  return NextResponse.json(
    {
      ok: true,
      token,
      profile: {
        id: String(profileRes.data.id),
        handle: String(profileRes.data.handle || ""),
        jobTitle: String(profileRes.data.job_title || ""),
        status: String(profileRes.data.status || ""),
      },
    },
    { status: 200 },
  );
}
