import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown = null;
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      body = (await req.json()) as unknown;
    } else {
      body = await req.text();
    }
  } catch {
    body = null;
  }
  console.warn("[CSP]", body);
  // report-uri endpoints should be fast and not leak details to clients
  return NextResponse.json({ ok: true }, { status: 204 });
}

