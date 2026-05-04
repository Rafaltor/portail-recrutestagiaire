import type { Metadata } from "next";
import type { ReactNode } from "react";
import { tryGetSupabaseServer } from "@/lib/supabase-server";
import { pageMetadata, siteUrl } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = tryGetSupabaseServer();
  if (!supabase) return { title: "Profil — Recrute Stagiaire" };

  const { data } = await supabase
    .from("profiles")
    .select("handle,job_title,city,status")
    .eq("id", id)
    .maybeSingle();

  if (!data || data.status !== "published") {
    return { title: "Profil introuvable — Recrute Stagiaire" };
  }

  const handle = String(data.handle || "").replace(/^@/, "");
  const city = data.city ? `, basé·e à ${data.city}` : "";
  const title = `@${handle} — ${data.job_title} · Recrute Stagiaire`;
  const description = `CV créatif de @${handle}${city}. Profil ${data.job_title} soumis à la communauté Recrute Stagiaire — votez et découvrez ses créations.`;
  const url = `${siteUrl}/profil/${id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Recrute Stagiaire",
      locale: "fr_FR",
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function ProfilIdLayout({ children }: { children: ReactNode }) {
  return children;
}
