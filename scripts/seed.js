#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const TOTAL_TARGET = 20;
const PLACEHOLDER_PDF_SOURCE_URL =
  "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
const DEFAULT_PREFIX = "seed_fake_ig_";

function readEnv(name) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : "";
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    dryRun: args.has("--dry-run"),
  };
}

function makeToken() {
  return crypto.randomBytes(16).toString("hex");
}

function makeHandle(index) {
  return `${DEFAULT_PREFIX}${String(index).padStart(2, "0")}`;
}

function makeFakeProfile(index, token) {
  const safeHandle = makeHandle(index);
  return {
    handle: `@${safeHandle}`,
    job_title: `Test Métier ${index}`,
    city: index % 2 === 0 ? "Paris" : "Lyon",
    tags: ["test", "seed", "fake-profile"],
    portfolio_url: `https://example.com/${safeHandle}`,
    cv_path: `seed/${safeHandle}/${token}-placeholder.pdf`,
    status: "published",
  };
}

async function downloadPlaceholderPdf(url) {
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`placeholder_download_failed:${r.status}`);
  }
  const ab = await r.arrayBuffer();
  const buf = Buffer.from(ab);
  if (!buf.length) {
    throw new Error("placeholder_empty");
  }
  return buf;
}

async function main() {
  const { dryRun } = parseArgs(process.argv);
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseKey = serviceRoleKey || anonKey;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "Missing env vars. Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const prefixPattern = `@${DEFAULT_PREFIX}%`;
  const existingRes = await supabase
    .from("profiles")
    .select("id,handle,status")
    .ilike("handle", prefixPattern)
    .limit(200);

  if (existingRes.error) {
    console.error(`Failed to read existing seed profiles: ${existingRes.error.message}`);
    process.exit(1);
  }

  const existing = existingRes.data || [];
  const existingHandles = new Set(
    existing
      .map((row) => String(row.handle || "").toLowerCase())
      .filter(Boolean),
  );

  const toInsert = [];
  for (let i = 1; i <= TOTAL_TARGET; i += 1) {
    const fake = makeFakeProfile(i, makeToken());
    if (existingHandles.has(fake.handle.toLowerCase())) continue;
    toInsert.push(fake);
  }

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "apply",
        targetTotal: TOTAL_TARGET,
        existingSeedProfiles: existing.length,
        toInsert: toInsert.length,
      },
      null,
      2,
    ),
  );

  if (toInsert.length === 0) {
    console.log("Nothing to insert. Seed target already satisfied.");
    return;
  }

  if (dryRun) {
    console.log("Dry run complete. No changes written.");
    return;
  }

  const placeholderPdf = await downloadPlaceholderPdf(PLACEHOLDER_PDF_SOURCE_URL);

  for (const row of toInsert) {
    const uploadRes = await supabase.storage.from("cvs").upload(row.cv_path, placeholderPdf, {
      upsert: false,
      contentType: "application/pdf",
    });
    if (uploadRes.error) {
      console.error(`Failed to upload placeholder PDF for ${row.handle}: ${uploadRes.error.message}`);
      process.exit(1);
    }
  }

  const insertRes = await supabase.from("profiles").insert(toInsert);
  if (insertRes.error) {
    console.error(`Failed to insert seed profiles: ${insertRes.error.message}`);
    process.exit(1);
  }

  console.log(`Inserted ${toInsert.length} fake published profiles successfully.`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Seed failed: ${msg}`);
  process.exit(1);
});
