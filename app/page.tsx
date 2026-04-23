import type { Metadata } from "next";
import { HomeHowItWorks } from "@/components/HomeHowItWorks";
import { HomeHeroSplit } from "@/components/HomeHeroSplit";
import { HomeTopProfile } from "@/components/HomeTopProfile";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title:
    "Recrute Stagiaire — On a commencé stagiaires. Pourquoi pas vous ? · Portail",
  description:
    "Dépose ton CV créatif. La communauté vote. Les meilleurs rejoignent le collectif. Label parisien mode & textile.",
  path: "/",
});

export default function Home() {
  return (
    <div className="rs-home-page">
      <HomeHeroSplit />

      <div className="rs-home-how-wrap px-4 py-8 sm:px-6 sm:py-10">
        <HomeHowItWorks />
      </div>

      <HomeTopProfile />
    </div>
  );
}
