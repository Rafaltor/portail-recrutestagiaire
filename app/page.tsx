import type { Metadata } from "next";
import Link from "next/link";
import { HomeHowItWorks } from "@/components/HomeHowItWorks";
import { HomeHeroStats } from "@/components/HomeHeroStats";
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
    <div className="grid gap-0">
      <section className="bg-[var(--white)] px-1 pb-12 pt-6 sm:px-2 sm:pt-10 md:pb-16">
        <div className="rs-hero-stagger mx-auto max-w-3xl text-center">
          <h1 className="rs-ds-h1 text-balance">
            On a commencé stagiaires. Pourquoi pas vous ?
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base font-normal leading-relaxed text-[var(--gray-600)]">
            Dépose ton CV. La communauté vote. Les meilleurs rejoignent le collectif.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/depot"
              className="rs-btn rs-btn--primary inline-flex justify-center px-5 py-2.5 text-center no-underline hover:no-underline"
            >
              Poste ton CV
            </Link>
            <Link
              href="/profils"
              className="rs-btn rs-btn--ghost inline-flex justify-center px-5 py-2.5 text-center no-underline hover:no-underline"
            >
              Voir les profils
            </Link>
          </div>
          <HomeHeroStats />
        </div>
      </section>

      <div className="mt-2 sm:mt-3">
        <HomeHowItWorks />
      </div>

      <HomeTopProfile />
    </div>
  );
}
