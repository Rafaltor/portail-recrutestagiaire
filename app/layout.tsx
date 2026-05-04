import type { Metadata } from "next";
import { Syne, Manrope } from "next/font/google";
import { siteUrl } from "@/lib/seo";
import Link from "next/link";
import Image from "next/image";
import { HeaderMobileNav } from "@/components/HeaderMobileNav";
import { HeaderAccountLink } from "@/components/HeaderAccountLink";
import { PortalHeaderDrawer } from "@/components/PortalHeaderDrawer";
import { PortalHeaderNav } from "@/components/PortalHeaderNav";
import { RouteHtmlDataset } from "@/components/RouteHtmlDataset";
import { ParisTicker } from "./ParisTicker";
import "./styles/index.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-dm",
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Recrute Stagiaire — Portail",
    template: "%s · Recrute Stagiaire",
  },
  description:
    "Label parisien : dépose ton CV créatif, la communauté vote, les meilleurs profils rejoignent le collectif.",
  applicationName: "Recrute Stagiaire",
  keywords: [
    "stage",
    "stagiaire",
    "mode",
    "textile",
    "design",
    "Paris",
    "collectif",
    "CV créatif",
    "recrutement",
    "portail candidature",
  ],
  authors: [{ name: "Recrute Stagiaire", url: "https://recrutestagiaire.eu" }],
  creator: "Recrute Stagiaire",
  publisher: "Recrute Stagiaire",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    siteName: "Recrute Stagiaire",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@recrutestagiaire",
    creator: "@recrutestagiaire",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVars = `${syne.variable} ${manrope.variable}`;

  return (
    <html lang="fr" data-rs-header-tab="offres" className={fontVars}>
      <body className="rs-portal-body rs-ds-paris rs-portal-header flex min-h-dvh flex-col text-[#0a0a0a]">
        <RouteHtmlDataset />
        <HeaderMobileNav />
        <div className="header-wrap rs-header z-50" role="banner">
          <ParisTicker />

          <div className="rs-header-body">
            <div className="container">
              <header className="rs-header-two-tier" aria-label="En-tête du site">
                <div className="rs-header-mobile-bar" data-rs-header-mobile-bar>
                  <Link
                    className="rs-header-mobile-bar__brand rs-ph-mbrand no-underline hover:no-underline"
                    href="https://recrutestagiaire.eu"
                  >
                    <Image
                      className="rs-header-mobile-bar__logo"
                      src="/rs-logo-eu.png"
                      alt="Recrute Stagiaire"
                      width={48}
                      height={48}
                      priority
                    />
                  </Link>
                  <span className="rs-header-mobile-bar__title">
                    <span className="rs-header-mobile-bar__title-line">
                      RECRUTE
                    </span>
                    <span className="rs-header-mobile-bar__title-line">
                      STAGIAIRE
                    </span>
                  </span>
                  <button
                    type="button"
                    className="rs-header-mobile-bar__menu-btn rs-header-burger-btn"
                    id="rs-header-mobile-menu-btn"
                    aria-expanded="false"
                    aria-controls="rs-header-drawer-panel"
                    data-rs-header-drawer-open
                  >
                    <span className="sr-only">Ouvrir le menu</span>
                    <span className="rs-header-burger" aria-hidden="true">
                      <span className="rs-header-burger__line" />
                      <span className="rs-header-burger__line" />
                      <span className="rs-header-burger__line" />
                    </span>
                  </button>
                </div>
                <div className="rs-header-main-row rs-header-main-row--desktop">
                  <div className="rs-header-top-line">
                    <div className="rs-banner-top rs-header-pole-brand rs-header-pole-title">
                      <a
                        className="nav-brand rs-nav-brand rs-nav-brand--title-row rs-ph-brandlink"
                        href="https://recrutestagiaire.eu"
                      >
                        <Image
                          src="/rs-logo-eu.png"
                          alt="Recrute Stagiaire"
                          width={80}
                          height={80}
                          className="rs-ph-brandlink-logo"
                          style={{ maxHeight: 80, width: "auto" }}
                          priority
                        />
                        <span className="rs-nav-brand__name logo rs-nav-brand__name--headline rs-ph-brandlink-title">
                          <span className="lg:hidden">RS</span>
                          <span className="hidden lg:inline">RECRUTE STAGIAIRE</span>
                        </span>
                      </a>
                    </div>

                    <PortalHeaderNav />

                    <div className="rs-banner-top__actions d-inline-flex align-items-center">
                      <Link
                        href="/depot"
                        className="rs-ph-cta text-decoration-none no-underline hover:no-underline"
                      >
                        Déposer mon CV
                      </Link>

                      <HeaderAccountLink className="!bg-[#0a0a0a] !text-white !border !border-[#0a0a0a] shadow-none hover:!bg-[#1a1a1a] hover:!text-white" />
                    </div>
                  </div>
                </div>
              </header>
            </div>
          </div>
          <PortalHeaderDrawer />
        </div>

        <main className="rs-portal-main mx-auto w-full min-w-0 max-w-full flex-1 overflow-x-clip pb-8">
          {children}
        </main>

        <footer className="footer skin-dark-footer rs-footer-portal-simple">
          <div className="container mx-auto max-w-[var(--rs-content-max,1200px)] px-4 py-10">
            <div className="flex flex-col gap-6 border-b border-[var(--gray-200)] pb-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <span className="text-sm font-bold tracking-wide text-[var(--color-ink)]">
                  RECRUTE STAGIAIRE
                </span>
                <p className="m-0 max-w-xl text-sm font-normal leading-snug text-[var(--gray-600)] sm:text-right">
                  Collectif artistique mode & textile, Paris — chaque vêtement est
                  une offre, chaque achat une candidature.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="https://www.instagram.com/recrutestagiaire.eu/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[var(--color-ink)] no-underline hover:text-[var(--color-brand)]"
                >
                  Instagram
                </a>
                <a
                  href="https://www.tiktok.com/@recrutestagiaire"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[var(--color-ink)] no-underline hover:text-[var(--color-brand)]"
                >
                  TikTok
                </a>
              </div>
            </div>
            <nav
              className="flex flex-wrap gap-x-5 gap-y-2 py-6 text-sm font-medium"
              aria-label="Pied de page"
            >
              <Link
                href="/profils"
                className="text-[var(--color-ink)] no-underline hover:text-[var(--color-brand)]"
              >
                Profils
              </Link>
              <Link
                href="/depot"
                className="text-[var(--color-ink)] no-underline hover:text-[var(--color-brand)]"
              >
                Déposer
              </Link>
              <a
                href="https://recrutestagiaire.eu/pages/about"
                className="text-[var(--color-ink)] no-underline hover:text-[var(--color-brand)]"
              >
                À propos
              </a>
              <a
                href="https://recrutestagiaire.eu/pages/contact"
                className="text-[var(--color-ink)] no-underline hover:text-[var(--color-brand)]"
              >
                Contact
              </a>
            </nav>
            <p className="m-0 text-xs font-normal text-[var(--gray-600)]">
              © {new Date().getFullYear()} Recrute Stagiaire. Tous droits réservés.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
