import type { Metadata } from "next";

/** URL canonique du portail (partage OG / liens absolus) */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://portail.recrutestagiaire.eu";

/** Image par défaut pour Open Graph / Twitter */
export const defaultOgImage = {
  url: "https://recrutestagiaire.eu/cdn/shop/files/rs-poleemploi.png?v=1776180029&width=1200",
  width: 1200,
  height: 1200,
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
