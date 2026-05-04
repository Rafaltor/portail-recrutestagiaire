import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/profils", "/profil/", "/depot", "/connexion", "/swipe"],
        disallow: ["/api/", "/admin/", "/mon-espace/", "/mon-profil/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
