import type { Metadata } from "next";
import { HomeHowItWorks } from "@/components/HomeHowItWorks";
import { HomePanoramicHero } from "@/components/HomePanoramicHero";
import { HomeTopProfile } from "@/components/HomeTopProfile";
import { pageMetadata, siteUrl } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title:
    "Recrute Stagiaire — On a commencé stagiaires. Pourquoi pas vous ? · Portail",
  description:
    "Dépose ton CV créatif. La communauté vote. Les meilleurs rejoignent le collectif. Label parisien mode & textile.",
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
      <div className="rs-home-page rs-home-page--panorama">
        <HomePanoramicHero />

        <div className="rs-home-how-wrap px-2 py-6 sm:px-6 sm:py-10">
          <HomeHowItWorks />
        </div>

        <HomeTopProfile />
      </div>
    </>
  );
}
