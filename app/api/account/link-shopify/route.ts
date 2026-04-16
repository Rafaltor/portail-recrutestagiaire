import { NextResponse } from "next/server";
import { tryGetSupabaseServer } from "@/lib/supabase-server";
import {
  createShopifyCustomer,
  findShopifyCustomerIdByEmail,
} from "@/lib/shopify-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) return bad("server_misconfigured", 500);

  const authHeader = req.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  if (!accessToken) return bad("auth_required", 401);

  const { data: userRes, error: userErr } = await supabaseServer.auth.getUser(
    accessToken,
  );
  if (userErr || !userRes?.user) {
    return bad("invalid_session", 401);
  }

  const user = userRes.user;
  const email = user.email;
  if (!email) return bad("missing_user_email", 400);

  // 1) Find Shopify customer by email (Admin API search)
  let shopifyCustomerId: string | null = null;
  try {
    shopifyCustomerId = await findShopifyCustomerIdByEmail(email);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "shopify_error";
    return bad(msg, 500);
  }

  // Optional: auto-create Shopify customer if missing (requires write_customers)
  if (!shopifyCustomerId) {
    const allowCreate = process.env.SHOPIFY_AUTO_CREATE_CUSTOMER === "true";
    if (!allowCreate) return bad("shopify_customer_not_found", 404);
    try {
      shopifyCustomerId = await createShopifyCustomer(email);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "shopify_error";
      return bad(msg, 500);
    }
  }

  // 2) Persist link in Supabase (service role bypasses RLS)
  // Expected table (create it in Supabase SQL editor):
  // create table public.shopify_account_links (
  //   user_id uuid primary key references auth.users(id) on delete cascade,
  //   email text not null,
  //   shopify_customer_id text not null,
  //   created_at timestamptz not null default now()
  // );
  try {
    const existing = await supabaseServer
      .from("shopify_account_links")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (existing.data) {
      const up = await supabaseServer
        .from("shopify_account_links")
        .update({ email, shopify_customer_id: shopifyCustomerId })
        .eq("user_id", user.id);
      if (up.error) throw up.error;
    } else {
      const ins = await supabaseServer.from("shopify_account_links").insert({
        user_id: user.id,
        email,
        shopify_customer_id: shopifyCustomerId,
      });
      if (ins.error) throw ins.error;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "db_error";
    return bad(
      `db_error:${msg}. Create table shopify_account_links first.`,
      500,
    );
  }

  return NextResponse.json({ ok: true, shopifyCustomerId }, { status: 200 });
}

