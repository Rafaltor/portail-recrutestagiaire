import { NextResponse } from "next/server";
import { tryGetSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function checkBasicAuth(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("basic ")) return false;
  try {
    const raw = Buffer.from(h.slice(6), "base64").toString("utf8");
    const [, pass] = raw.split(":", 2);
    return pass === expected;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!checkBasicAuth(req)) return unauthorized();
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "pending";

  const res = await supabaseServer
    .from("profiles")
    .select("id,handle,job_title,city,portfolio_url,cv_path,created_at,status")
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(200);

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  return NextResponse.json({ items: res.data ?? [] }, { status: 200 });
}

export async function PATCH(req: Request) {
  if (!checkBasicAuth(req)) return unauthorized();
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  let body: { id?: string; status?: string };
  try {
    body = (await req.json()) as { id?: string; status?: string };
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const id = String(body.id || "").trim();
  const status = String(body.status || "").trim();
  if (!id || (status !== "published" && status !== "rejected")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const res = await supabaseServer
    .from("profiles")
    .update({ status })
    .eq("id", id);

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

