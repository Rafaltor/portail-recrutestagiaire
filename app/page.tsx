import type { Metadata } from "next";
import { HomePanoramicHero } from "@/components/HomePanoramicHero";
import { pageMetadata, siteUrl } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Recrute Stagiaire · Portail",
  description:
    "Collectif mode & textile parisien — dépose ton CV créatif, vote, rejoins le label.",
  path: "/",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Recrute Stagiaire",
  url: siteUrl,
  sameAs: [
    "https://www.instagram.com/recrutestagiaire.eu/",
    "https://www.tiktok.com/@recrutestagiaire",
    "https://recrutestagiaire.eu",
  ],
  description:
    "Collectif artistique mode & textile parisien. Plateforme de dépôt et vote de CV créatifs pour stagiaires.",
  foundingLocation: {
    "@type": "Place",
    name: "Paris, France",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="rs-home-page rs-home-page--panorama rs-home-page--immersive">
        <HomePanoramicHero />
      </div>
    </>
  );
}
