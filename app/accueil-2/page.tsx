import type { Metadata } from "next";
import { HomeHowItWorks } from "@/components/HomeHowItWorks";
import { HomePanoramicHero } from "@/components/HomePanoramicHero";
import { HomeTopProfile } from "@/components/HomeTopProfile";
import { pageMetadata, siteUrl } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title:
    "Recrute Stagiaire — Atelier panoramique · Portail",
  description:
    "Explore l'atelier du collectif. Dépose ton CV créatif, la communauté vote, les meilleurs rejoignent le label mode & textile parisien.",
  path: "/accueil-2",
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

export default function HomeAccueil2() {
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
