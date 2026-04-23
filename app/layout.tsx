import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import { siteUrl } from "@/lib/seo";
import Link from "next/link";
import { HeaderMobileNav } from "@/components/HeaderMobileNav";
import { HeaderAccountLink } from "@/components/HeaderAccountLink";
import { PortalHeaderDrawer } from "@/components/PortalHeaderDrawer";
import { PortalHeaderNav } from "@/components/PortalHeaderNav";
import { RouteHtmlDataset } from "@/components/RouteHtmlDataset";
import { ParisTicker } from "./ParisTicker";
import "./globals.css";
import "./rs-shopify-header.css";
import "./rs-shopify-header-mobile.css";
import "./rs-shopify-ui.css";
import "./portal-theme.css";
import "./rs-modern-portal.css";
import "./rs-ds-paris.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
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
  title: "Recrute Stagiaire — Portail",
  description:
    "Label parisien : dépose ton CV créatif, la communauté vote, les meilleurs profils rejoignent le collectif.",
  applicationName: "Recrute Stagiaire",
  icons: {
    icon: [{ url: "/rs-logo-eu.png", type: "image/png" }],
    apple: [{ url: "/rs-logo-eu.png" }],
  },
  openGraph: {
    siteName: "Recrute Stagiaire",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVars = `${syne.variable} ${dmSans.variable}`;

  return (
    <html lang="fr" data-rs-header-tab="offres" className={fontVars}>
      <body className="rs-portal-body rs-ds-paris flex min-h-dvh flex-col text-[#0a0a0a]">
        <RouteHtmlDataset />
        <HeaderMobileNav />
        <div
          className="header-wrap rs-header sticky top-0 z-50 min-h-16 border-b border-[#E8E8E8] bg-white/95 backdrop-blur-md"
          role="banner"
        >
          <ParisTicker />

          <div className="rs-header-body">
            <div className="container">
              <header className="rs-header-two-tier" aria-label="En-tête du site">
                <div className="rs-header-mobile-bar" data-rs-header-mobile-bar>
                  <a
                    className="rs-header-mobile-bar__brand rs-ph-mbrand"
                    href="https://recrutestagiaire.eu"
                  >
                    <span className="rs-ph-dot" aria-hidden />
                    <span className="rs-header-mobile-bar__title">
                      <span className="lg:hidden">RS</span>
                      <span className="hidden lg:inline">RECRUTE STAGIAIRE</span>
                    </span>
                  </a>
                  <button
                    type="button"
                    className="rs-header-mobile-bar__menu-btn"
                    id="rs-header-mobile-menu-btn"
                    aria-expanded="false"
                    aria-controls="rs-header-drawer-panel"
                    data-rs-header-drawer-open
                  >
                    <span className="sr-only">Ouvrir le menu</span>
                    <span
                      className="rs-header-mobile-bar__burger"
                      aria-hidden="true"
                    >
                      <span className="rs-header-mobile-bar__burger-line" />
                      <span className="rs-header-mobile-bar__burger-line" />
                      <span className="rs-header-mobile-bar__burger-line" />
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
                        <span className="rs-ph-dot" aria-hidden />
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
                        className="rs-ph-cta no-underline hover:no-underline !bg-[#f472b6] !px-7 !py-3 !text-[15px] !font-bold !text-white transition-colors duration-150 hover:!bg-[#db2777]"
                      >
                        Déposer mon CV
                      </Link>
                      <a
                        href="https://recrutestagiaire.eu/cart"
                        className="rs-nav-ghost-link abt-btn rs-caf-btn-dossier rs-banner-top__cart d-inline-flex align-items-center gap-2 text-nowrap text-decoration-none !border-0 !bg-transparent !text-[#6B6B6B] shadow-none hover:!text-[#f472b6]"
                        aria-label="Mon dossier"
                      >
                        <svg
                          className="rs-icon-dossier"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                          focusable="false"
                          stroke="currentColor"
                          strokeWidth="1.85"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.17 4.24a2 2 0 0 0-1.7-.9H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16Z" />
                        </svg>
                        <span className="rs-caf-btn-dossier__label">
                          <span className="rs-caf-btn-dossier__text rs-caf-btn-dossier__text--full">
                            Mon dossier
                          </span>
                          <span
                            className="rs-caf-btn-dossier__text rs-caf-btn-dossier__text--short"
                            aria-hidden="true"
                          >
                            Dossier
                          </span>
                        </span>
                      </a>

                      <HeaderAccountLink className="!border-0 !bg-transparent !text-[#6B6B6B] shadow-none hover:!text-[#f472b6]" />
                    </div>
                  </div>
                </div>
              </header>
            </div>
          </div>
          <PortalHeaderDrawer />
        </div>

        <main className="rs-portal-main mx-auto w-full flex-1 pb-8">
          {children}
        </main>

        <footer className="footer skin-dark-footer rs-footer-portal-simple">
          <div className="container mx-auto max-w-[var(--rs-content-max,1200px)] px-4 py-10">
            <div className="flex flex-col gap-6 border-b border-[var(--gray-200)] pb-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <span className="text-sm font-bold tracking-wide text-[var(--black)]">
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
                  className="text-sm font-medium text-[var(--black)] no-underline hover:text-[var(--accent)]"
                >
                  Instagram
                </a>
                <a
                  href="https://www.tiktok.com/@recrutestagiaire"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[var(--black)] no-underline hover:text-[var(--accent)]"
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
                className="text-[var(--black)] no-underline hover:text-[var(--accent)]"
              >
                Profils
              </Link>
              <Link
                href="/depot"
                className="text-[var(--black)] no-underline hover:text-[var(--accent)]"
              >
                Déposer
              </Link>
              <a
                href="https://recrutestagiaire.eu/pages/about"
                className="text-[var(--black)] no-underline hover:text-[var(--accent)]"
              >
                À propos
              </a>
              <a
                href="https://recrutestagiaire.eu/pages/contact"
                className="text-[var(--black)] no-underline hover:text-[var(--accent)]"
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
