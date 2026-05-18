import type { Metadata } from "next";

/** URL canonique du portail (partage OG / liens absolus) */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://portail.recrutestagiaire.eu";

/** Boutique principale (site vitrine / Shopify). */
export const boutiqueUrl = "https://recrutestagiaire.eu";

/** Image par défaut pour Open Graph / Twitter (`app/opengraph-image.tsx`) */
export const defaultOgImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Recrute Stagiaire — Portail candidature créative",
} as const;

type PageSeoInput = {
  title: string;
  description: string;
  path: string;
};

export function pageMetadata({ title, description, path }: PageSeoInput): Metadata {
  const url = `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
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
      type: "website",
      images: [defaultOgImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [defaultOgImage.url],
    },
  };
}
