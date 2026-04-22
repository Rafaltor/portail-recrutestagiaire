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
    <div className="rs-home-page">
      <section className="rs-home-hero">
        <div className="rs-home-hero__grid relative z-[1]">
          <div className="rs-home-hero__copy rs-hero-stagger">
            <div className="rs-home-hero__badge">
              <span className="rs-home-hero__badge-dot" aria-hidden />
              Candidatures ouvertes
            </div>
            <h1 className="rs-ds-h1 text-balance">
              On a commencé{" "}
              <em className="not-italic text-[var(--accent)]">stagiaires</em>.
              <br className="hidden sm:block" /> Pourquoi pas vous ?
            </h1>
            <p className="rs-home-hero__lede text-pretty">
              Dépose ton CV. La communauté vote. Les meilleurs rejoignent le
              collectif — label parisien mode & textile.
            </p>
            <div className="rs-home-hero__actions">
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
          </div>
          <HomeHeroStats />
        </div>
      </section>

      <div className="rs-home-how-wrap">
        <HomeHowItWorks />
      </div>

      <HomeTopProfile />
    </div>
  );
}
