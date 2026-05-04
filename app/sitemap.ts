import type { MetadataRoute } from "next";
import { tryGetSupabaseServer } from "@/lib/supabase-server";
import { siteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/profils`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/swipe`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/depot`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/connexion`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  const supabase = tryGetSupabaseServer();
  if (!supabase) return staticRoutes;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,updated_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(500);

  const profileRoutes: MetadataRoute.Sitemap = (profiles ?? []).map((p) => ({
    url: `${siteUrl}/profil/${p.id}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...profileRoutes];
}
