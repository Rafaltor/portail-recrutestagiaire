import { NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import { tryGetSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CV_BUCKET = "cvs";
const CV_BACKUP_BUCKET =
  process.env.ADMIN_CV_BACKUP_BUCKET?.trim() || "cvs-original-backups";

type RedactionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ProfileRow = {
  id: string;
  cv_path: string;
};

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function normalizePath(path: string) {
  return String(path || "").trim().replace(/^\/+/, "");
}

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function sanitizeRectangles(input: unknown): RedactionRect[] {
  if (!Array.isArray(input)) return [];
  const out: RedactionRect[] = [];
  for (const value of input) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const obj = value as Record<string, unknown>;
    const x = clamp01(Number(obj.x));
    const y = clamp01(Number(obj.y));
    const width = clamp01(Number(obj.width));
    const height = clamp01(Number(obj.height));
    if (width < 0.002 || height < 0.002) continue;
    if (x >= 1 || y >= 1) continue;
    out.push({
      x,
      y,
      width: Math.min(width, 1 - x),
      height: Math.min(height, 1 - y),
    });
    if (out.length >= 200) break;
  }
  return out;
}

async function requireAdmin(req: Request) {
  const supabaseServer = tryGetSupabaseServer();
  if (!supabaseServer) return { error: "server_misconfigured" as const };
  const authHeader = req.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) return { error: "unauthorized" as const };
  const { data: userRes, error: userErr } = await supabaseServer.auth.getUser(
    accessToken,
  );
  if (userErr || !userRes?.user) return { error: "unauthorized" as const };
  const role = String(userRes.user.app_metadata?.role || "").toLowerCase();
  const rolesRaw = userRes.user.app_metadata?.roles;
  const roles = Array.isArray(rolesRaw)
    ? rolesRaw.map((x) => String(x || "").toLowerCase())
    : [];
  const isAdmin = role === "admin" || roles.includes("admin");
  if (!isAdmin) return { error: "forbidden" as const };
  return { supabaseServer } as const;
}

async function getSignedUrlForPath(
  supabaseServer: NonNullable<ReturnType<typeof tryGetSupabaseServer>>,
  bucket: string,
  path: string,
) {
  const signed = await supabaseServer.storage.from(bucket).createSignedUrl(path, 60 * 20);
  if (signed.error || !signed.data?.signedUrl) return "";
  return signed.data.signedUrl;
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if ("error" in admin) {
    if (admin.error === "unauthorized") return bad("unauthorized", 401);
    if (admin.error === "forbidden") return bad("forbidden", 403);
    return bad("server_misconfigured", 500);
  }
  const { supabaseServer } = admin;

  let body: {
    profileId?: string;
    page?: number;
    rectangles?: RedactionRect[];
  };
  try {
    body = (await req.json()) as {
      profileId?: string;
      page?: number;
      rectangles?: RedactionRect[];
    };
  } catch {
    return bad("bad_json");
  }

  const profileId = String(body.profileId || "").trim();
  const pageIndex = Math.max(1, Number(body.page || 1));
  const rectangles = sanitizeRectangles(body.rectangles);
  if (!profileId) return bad("profile_id_required");
  if (!rectangles.length) return bad("rectangles_required");

  const profileRes = await supabaseServer
    .from("profiles")
    .select("id,cv_path")
    .eq("id", profileId)
    .limit(1)
    .maybeSingle();
  if (profileRes.error) return bad(`profile_lookup_failed:${profileRes.error.message}`, 500);
  const profile = profileRes.data as ProfileRow | null;
  if (!profile) return bad("profile_not_found", 404);
  const cvPath = normalizePath(profile.cv_path);
  if (!cvPath) return bad("cv_path_missing", 400);

  const originalDownload = await supabaseServer.storage.from(CV_BUCKET).download(cvPath);
  if (originalDownload.error || !originalDownload.data) {
    return bad(`cv_download_failed:${originalDownload.error?.message || "missing"}`, 500);
  }
  const originalBytes = new Uint8Array(await originalDownload.data.arrayBuffer());

  const backupPath = `profiles/${profile.id}/${Date.now()}-${cvPath.split("/").pop() || "cv.pdf"}`;
  const backupUpload = await supabaseServer.storage
    .from(CV_BACKUP_BUCKET)
    .upload(backupPath, originalBytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (backupUpload.error) {
    return bad(`backup_upload_failed:${backupUpload.error.message}`, 500);
  }

  const pdfDoc = await PDFDocument.load(originalBytes);
  const pages = pdfDoc.getPages();
  const page = pages[pageIndex - 1];
  if (!page) return bad("page_out_of_range");
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  for (const rect of rectangles) {
    const x = rect.x * pageWidth;
    const width = rect.width * pageWidth;
    const height = rect.height * pageHeight;
    const yTop = rect.y * pageHeight;
    const y = pageHeight - yTop - height;
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: rgb(0, 0, 0),
      borderColor: rgb(0, 0, 0),
      borderWidth: 0,
    });
  }

  const maskedBytes = await pdfDoc.save();
  const overwrite = await supabaseServer.storage.from(CV_BUCKET).upload(cvPath, maskedBytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (overwrite.error) {
    return bad(`cv_overwrite_failed:${overwrite.error.message}`, 500);
  }

  const cvPreviewUrl = await getSignedUrlForPath(supabaseServer, CV_BUCKET, cvPath);
  const cvOriginalUrl = await getSignedUrlForPath(supabaseServer, CV_BACKUP_BUCKET, backupPath);

  return NextResponse.json(
    {
      ok: true,
      item: {
        id: profile.id,
        cv_preview_url: cvPreviewUrl,
        cv_original_url: cvOriginalUrl,
      },
    },
    { status: 200 },
  );
}
