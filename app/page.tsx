import type { Metadata, Viewport } from "next";
import { HomeHowItWorks } from "@/components/HomeHowItWorks";
import { pageMetadata } from "@/lib/seo";
import { PortalDesktopPageHeader } from "@/components/PortalDesktopPageHeader";

export const metadata: Metadata = pageMetadata({
  title:
    "Recrute Stagiaire — On a commencé stagiaires. Pourquoi pas vous ? · Portail",
  description:
    "Dépose ton CV créatif. La communauté vote. Les meilleurs rejoignent le collectif. Label parisien mode & textile.",
  path: "/",
});

// Accueil volontairement "desktop sur mobile" (effet dézoom rétro)
export const viewport: Viewport = {
  width: 1180,
  viewportFit: "cover",
};

export default function Home() {
  return (
    <div className="grid gap-6">
      <PortalDesktopPageHeader
        eyebrow="Portail"
        title="On a commencé stagiaires. Pourquoi pas vous ?"
        actions={
          <div className="flex flex-wrap gap-2">
            <a className="rs-btn rs-btn--primary" href="/profils">
              Voir les profils
            </a>
            <a className="rs-btn rs-btn--ghost" href="/depot">
              Déposer un profil
            </a>
          </div>
        }
      />

      <div className="rs-panel rounded-lg p-6 lg:hidden">
        <h1 className="text-2xl font-black tracking-tight">
          On a commencé stagiaires. Pourquoi pas vous ?
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="rs-btn rs-btn--primary" href="/profils">
            Voir les profils
          </a>
          <a className="rs-btn rs-btn--ghost" href="/depot">
            Déposer un profil
          </a>
        </div>
      </div>

      <HomeHowItWorks />
    </div>
  );
}
