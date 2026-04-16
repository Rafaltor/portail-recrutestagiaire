export async function getShopifyAdminAccessToken() {
  const store = process.env.SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!store || !clientId || !clientSecret) {
    throw new Error(
      "Missing Shopify env vars: SHOPIFY_STORE_DOMAIN / SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET",
    );
  }

  const url = `https://${store}/admin/oauth/access_token`;

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`shopify_token_failed:${r.status}:${txt.slice(0, 400)}`);
  }

  const j = (await r.json()) as { access_token?: string };
  const token = j.access_token;
  if (!token) throw new Error("shopify_token_missing_access_token");
  return token;
}

export async function findShopifyCustomerIdByEmail(email: string) {
  const store = process.env.SHOPIFY_STORE_DOMAIN;
  if (!store) throw new Error("Missing SHOPIFY_STORE_DOMAIN");

  const token = await getShopifyAdminAccessToken();

  // Shopify REST Admin API: GET /admin/api/{version}/customers/search.json?query=email:...
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-04";
  const query = `email:${email}`;
  const url = `https://${store}/admin/api/${apiVersion}/customers/search.json?query=${encodeURIComponent(
    query,
  )}`;

  const r = await fetch(url, {
    method: "GET",
    headers: { "X-Shopify-Access-Token": token },
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`shopify_search_failed:${r.status}:${txt.slice(0, 400)}`);
  }

  const j = (await r.json()) as {
    customers?: { id?: number }[];
  };

  const firstId = j.customers?.[0]?.id;
  if (!firstId) return null;
  return String(firstId);
}

