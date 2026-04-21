import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { siteUrl } from "@/lib/seo";
import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { HeaderMobileNav } from "@/components/HeaderMobileNav";
import { HeaderAccountLink } from "@/components/HeaderAccountLink";
import { PortalHeaderDrawer } from "@/components/PortalHeaderDrawer";
import { PortalHeaderNav } from "@/components/PortalHeaderNav";
import { RouteHtmlDataset } from "@/components/RouteHtmlDataset";
import "./globals.css";
import "./rs-shopify-header.css";
import "./rs-shopify-header-mobile.css";
import "./rs-shopify-ui.css";
import "./portal-theme.css";
import "./rs-modern-portal.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const RS_KITSCH_MARQUEE =
  "★ CANDIDATURES OUVERTES ★ OFFRE NON NÉGOCIABLE ★ DANS LA LIMITE DES STOCKS ★ ON A COMMENCÉ STAGIAIRES ★";

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
  return (
    <html lang="fr" data-rs-header-tab="offres">
      <body
        className={`rs-portal-body rs-portal-body--inter flex min-h-dvh flex-col text-[#0A0A0A] ${inter.variable}`}
      >
        <RouteHtmlDataset />
        <HeaderMobileNav />
        <div className="header-wrap rs-header rs-header--banner" role="banner">
          <div
            className="rs-header-kitsch-pop rs-header-kitsch-pop--brand"
            aria-hidden="true"
          >
            <div className="rs-header-kitsch-pop__track">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="rs-header-kitsch-pop__chunk">
                  {RS_KITSCH_MARQUEE}
                  &nbsp;•&nbsp;
                </span>
              ))}
            </div>
          </div>

          <div
            className="rs-header-body"
            style={
              {
                ["--rs-header-logo-col"]: "44px",
                ["--rs-header-logo-inset"]: "12px",
              } as CSSProperties
            }
          >
            <a
              className="rs-header-logo-tile nav-brand rs-nav-brand"
              href="https://recrutestagiaire.eu"
              aria-label="Recrute Stagiaire — boutique"
            >
              <Image
                className="rs-nav-brand__img rs-header-logo-tile__img"
                src="/rs-logo-eu.png"
                alt=""
                width={240}
                height={169}
                priority
              />
            </a>
            <div className="container">
              <header className="rs-header-two-tier" aria-label="En-tête du site">
                <div
                  className="rs-header-mobile-bar"
                  data-rs-header-mobile-bar
                >
                  <a
                    className="rs-header-mobile-bar__brand"
                    href="https://recrutestagiaire.eu"
                  >
                    <Image
                      className="rs-header-mobile-bar__logo"
                      src="/rs-logo-eu.png"
                      alt=""
                      width={128}
                      height={128}
                      priority
                    />
                    <span className="rs-header-mobile-bar__title">
                      RECRUTE STAGIAIRE
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
                      className="nav-brand rs-nav-brand rs-nav-brand--title-row"
                      href="https://recrutestagiaire.eu"
                    >
                      <span className="rs-nav-brand__name logo rs-nav-brand__name--headline">
                        RECRUTE STAGIAIRE
                      </span>
                    </a>
                  </div>

                  <div className="rs-banner-top__actions d-inline-flex align-items-center">
                    <a
                      href="https://recrutestagiaire.eu/cart"
                      className="abt-btn rs-caf-btn-dossier rs-banner-top__cart d-inline-flex align-items-center gap-2 text-nowrap text-decoration-none"
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

                    <HeaderAccountLink />
                  </div>
                </div>

                <PortalHeaderNav />
              </div>
              </header>
            </div>
          </div>
          <PortalHeaderDrawer />
        </div>

        <main className="rs-portal-main mx-auto w-full max-w-[980px] flex-1">
          {children}
        </main>

        <footer className="footer skin-dark-footer rs-footer-portal-simple">
          <div
            className="container mx-auto max-w-[980px] px-4 py-10"
            style={{ fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" }}
          >
            <div className="flex flex-col gap-6 border-b border-[#F0F0F0] pb-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <span className="text-sm font-bold tracking-wide text-[#0A0A0A]">
                  RECRUTE STAGIAIRE
                </span>
                <p className="m-0 max-w-xl text-sm font-normal leading-snug text-[#6B6B6B] sm:text-right">
                  Collectif artistique mode & textile, Paris — chaque vêtement est
                  une offre, chaque achat une candidature.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="https://www.instagram.com/recrutestagiaire.eu/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[#0A0A0A] no-underline hover:text-[#F472B6]"
                >
                  Instagram
                </a>
                <a
                  href="https://www.tiktok.com/@recrutestagiaire"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[#0A0A0A] no-underline hover:text-[#F472B6]"
                >
                  TikTok
                </a>
              </div>
            </div>
            <nav
              className="flex flex-wrap gap-x-5 gap-y-2 py-6 text-sm font-medium"
              aria-label="Pied de page"
            >
              <Link href="/profils" className="text-[#0A0A0A] no-underline hover:text-[#F472B6]">
                Profils
              </Link>
              <Link href="/depot" className="text-[#0A0A0A] no-underline hover:text-[#F472B6]">
                Déposer
              </Link>
              <a
                href="https://recrutestagiaire.eu/pages/about"
                className="text-[#0A0A0A] no-underline hover:text-[#F472B6]"
              >
                À propos
              </a>
              <a
                href="https://recrutestagiaire.eu/pages/contact"
                className="text-[#0A0A0A] no-underline hover:text-[#F472B6]"
              >
                Contact
              </a>
            </nav>
            <p className="m-0 text-xs font-normal text-[#6B6B6B]">
              © {new Date().getFullYear()} Recrute Stagiaire. Tous droits réservés.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
