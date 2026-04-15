import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const res = await supabaseServer
    .from("profiles")
    .select("id,handle,job_title,city,portfolio_url,cv_path,status")
    .eq("id", id)
    .maybeSingle();

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }
  const data = res.data as
    | {
        id: string;
        handle: string;
        job_title: string;
        city: string | null;
        portfolio_url: string | null;
        cv_path: string;
        status: string;
      }
    | null;
  if (!data || data.status !== "published") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      id: data.id,
      handle: data.handle,
      job_title: data.job_title,
      city: data.city,
      portfolio_url: data.portfolio_url,
      cv_path: data.cv_path,
      status: data.status,
    },
    { status: 200 },
  );
}

