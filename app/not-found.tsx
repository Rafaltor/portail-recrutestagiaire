import Link from "next/link";
import { PortalDesktopPageHeader } from "@/components/PortalDesktopPageHeader";

export default function NotFound() {
  return (
    <div className="grid gap-6">
      <PortalDesktopPageHeader
        eyebrow="Portail"
        title="Page introuvable"
        description="L’adresse n’existe pas ou a été déplacée. Reviens à l’accueil ou à la liste des profils."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="rs-btn rs-btn--primary px-5 text-center">
              Accueil
            </Link>
            <Link href="/profils" className="rs-btn rs-btn--ghost px-5 text-center">
              Profils
            </Link>
          </div>
        }
      />

      <div className="rs-panel rounded-lg p-6 lg:hidden">
        <h1 className="text-xl font-black tracking-tight">404 — Introuvable</h1>
        <p className="mt-2 text-sm text-[#0A0A0A]/85">
          Cette page n’existe pas. Utilise le menu ou les liens ci-dessous.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/" className="rs-btn rs-btn--primary">
            Accueil
          </Link>
          <Link href="/profils" className="rs-btn rs-btn--ghost">
            Profils
          </Link>
        </div>
      </div>
    </div>
  );
}
