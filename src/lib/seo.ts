import type { Metadata } from "next";

/** URL canonique du portail (partage OG / liens absolus) */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://portail.recrutestagiaire.eu";

/** Image par défaut pour Open Graph / Twitter (fichier dans /public) */
export const defaultOgImage = {
  url: `${siteUrl}/rs-logo-eu.png`,
  width: 3508,
  height: 2480,
  alt: "Recrute Stagiaire",
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
