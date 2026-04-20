import { NextResponse } from "next/server";
import { normalizeCvObjectKey } from "@/lib/cv-storage-path";
import { tryGetSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const CV_BUCKET = "cvs";
const CV_BACKUP_BUCKET =
  process.env.ADMIN_CV_BACKUP_BUCKET?.trim() || "cvs-original-backups";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

type SupabaseServerClient = ReturnType<typeof tryGetSupabaseServer>;
type SupabaseServerReady = Exclude<SupabaseServerClient, null>;

async function buildPendingPreviewItem(
  supabaseServer: SupabaseServerReady,
  item: {
    id: string;
    handle: string;
    job_title: string;
    city: string | null;
    portfolio_url: string | null;
    cv_path: string;
    created_at: string;
    status: string;
    rejection_reason?: string | null;
  },
) {
  const cleanPath = normalizeCvObjectKey(item.cv_path);
  let cv_preview_url = "";
  let cv_original_url = "";
  if (cleanPath) {
    const signed = await supabaseServer.storage
      .from(CV_BUCKET)
      .createSignedUrl(cleanPath, 60 * 20);
    if (!signed.error && signed.data?.signedUrl) {
      cv_preview_url = signed.data.signedUrl;
    }
  }

  const backupFolder = `profiles/${item.id}`;
  const backupList = await supabaseServer.storage.from(CV_BACKUP_BUCKET).list(backupFolder, {
    limit: 1,
    sortBy: { column: "name", order: "desc" },
  });
  if (!backupList.error && backupList.data?.[0]?.name) {
    const latestPath = `${backupFolder}/${backupList.data[0].name}`;
    const backupSigned = await supabaseServer.storage
      .from(CV_BACKUP_BUCKET)
      .createSignedUrl(latestPath, 60 * 20);
    if (!backupSigned.error && backupSigned.data?.signedUrl) {
      cv_original_url = backupSigned.data.signedUrl;
    }
  }
  return {
    ...item,
    cv_preview_url,
    cv_original_url,
  };
}

function describeJobCategory(jobTitle: string) {
  const s = String(jobTitle || "").toLowerCase();
  if (!s) return "non_renseigne";
  if (/design|graph|ui|ux|artist|3d|motion/.test(s)) return "design";
  if (/dev|engineer|software|front|back|full/.test(s)) return "tech";
  if (/market|social|content|brand|com/.test(s)) return "marketing";
  if (/prod|project|chef|ops|operation/.test(s)) return "production";
  return "autre";
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if ("error" in admin) {
    if (admin.error === "unauthorized") return unauthorized();
    if (admin.error === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: admin.error }, { status: 500 });
  }
  const { supabaseServer } = admin;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "pending";

  const res = await supabaseServer
    .from("profiles")
    .select(
      "id,handle,job_title,city,portfolio_url,cv_path,created_at,status,rejection_reason",
    )
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(200);

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const rows = (res.data ?? []) as Array<{
    id: string;
    handle: string;
    job_title: string;
    city: string | null;
    portfolio_url: string | null;
    cv_path: string;
    created_at: string;
    status: string;
  }>;
  const items = await Promise.all(
    rows.map(async (row) => {
      const withPreview = await buildPendingPreviewItem(supabaseServer, row);
      return {
        ...withPreview,
        job_category: describeJobCategory(row.job_title),
      };
    }),
  );

  return NextResponse.json({ items }, { status: 200 });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin(req);
  if ("error" in admin) {
    if (admin.error === "unauthorized") return unauthorized();
    if (admin.error === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: admin.error }, { status: 500 });
  }
  const { supabaseServer } = admin;

  let body: { id?: string; status?: string; rejectionReason?: string };
  try {
    body = (await req.json()) as {
      id?: string;
      status?: string;
      rejectionReason?: string;
    };
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const id = String(body.id || "").trim();
  const status = String(body.status || "").trim();
  const rejectionReason = String(body.rejectionReason || "").trim().slice(0, 500);
  if (!id || (status !== "published" && status !== "rejected")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (status === "rejected" && !rejectionReason) {
    return NextResponse.json(
      { error: "rejection_reason_required" },
      { status: 400 },
    );
  }

  const res = await supabaseServer
    .from("profiles")
    .update({
      status,
      rejection_reason: status === "rejected" ? rejectionReason : null,
    })
    .eq("id", id);

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

