import { NextResponse } from "next/server";
import { tryGetSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) return bad("server_misconfigured", 500);

  const form = await req.formData().catch(() => null);
  if (!form) return bad("bad_formdata");

  const handle = String(form.get("handle") || "").trim();
  const jobTitle = String(form.get("jobTitle") || "").trim();
  const city = String(form.get("city") || "").trim();
  const tagsRaw = String(form.get("tags") || "").trim();
  const portfolioUrl = String(form.get("portfolioUrl") || "").trim();
  const accepted = String(form.get("accepted") || "") === "true";
  const file = form.get("cv");

  if (!accepted) return bad("charte_required");
  if (handle.length < 2) return bad("handle_required");
  if (jobTitle.length < 2) return bad("job_required");
  if (!file || !(file instanceof File)) return bad("file_required");
  if (file.type !== "application/pdf") return bad("pdf_only");
  if (file.size > 12 * 1024 * 1024) return bad("file_too_large");

  const safeHandle = handle
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .slice(0, 60);
  const safeName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .slice(0, 80);
  const path = `pending/${safeHandle}/${Date.now()}-${safeName}`;

  const upload = await supabaseServer.storage.from("cvs").upload(path, file, {
    upsert: false,
    contentType: "application/pdf",
  });
  if (upload.error) return bad(`upload_failed:${upload.error.message}`, 500);

  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);

  const insert = await supabaseServer.from("profiles").insert({
    handle,
    job_title: jobTitle,
    city: city || null,
    tags,
    portfolio_url: portfolioUrl || null,
    cv_path: path,
    status: "pending",
  });
  if (insert.error) return bad(`insert_failed:${insert.error.message}`, 500);

  return NextResponse.json({ ok: true }, { status: 200 });
}

