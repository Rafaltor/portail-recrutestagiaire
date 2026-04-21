import type { Metadata } from "next";
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
      <body className="rs-portal-body flex min-h-dvh flex-col text-[#0A0A0A]">
        <RouteHtmlDataset />
        <HeaderMobileNav />
        <div
          className="header-wrap rs-header rs-header--banner"
          role="banner"
          style={
            {
              ["--rs-header-bg-img"]: `url(https://recrutestagiaire.eu/cdn/shop/files/geometric-glass-city-architecture.jpg?v=1776117913&width=2400)`,
            } as CSSProperties
          }
        >
          <div
            className="rs-header-kitsch-pop rs-header-kitsch-pop--brand"
            aria-hidden="true"
            style={
              {
                ["--rs-kitsch-pop-a"]: "#f472b6",
                ["--rs-kitsch-pop-b"]: "#e8e8f0",
                ["--rs-kitsch-pop-fg"]: "#f472b6",
              } as CSSProperties
            }
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
                ["--rs-header-logo-col"]: "124px",
                ["--rs-header-logo-inset"]: "14px",
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

        <footer className="footer skin-dark-footer">
          <div className="container" style={{ paddingTop: 26, paddingBottom: 18 }}>
            <div className="rs-footer-grid">
              <div className="rs-footer-col rs-footer-col-a">
                <div className="footer-widget">
                  <div className="footerLogo" style={{ marginBottom: 10 }}>
                    <span style={{ color: "#0A0A0A", fontWeight: 900, fontSize: 18 }}>
                      RECRUTE STAGIAIRE
                    </span>
                  </div>
                  <div className="footerText" style={{ maxWidth: 520 }}>
                    <p style={{ margin: 0, color: "rgba(10,10,10,0.72)" }}>
                      Collectif artistique mode & textile, Paris. Chaque vêtement
                      est une offre. Chaque achat, une candidature.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rs-footer-col rs-footer-col-b">
                <div className="footer-widget">
                  <h4 className="widget-title">Collections</h4>
                  <ul className="footer-menu">
                    <li>
                      <a href="https://recrutestagiaire.eu/collections/abcdrs">
                        Collection ABCDRS
                      </a>
                    </li>
                    <li>
                      <a href="https://recrutestagiaire.eu/collections/les-stagiaires-de-base">
                        Les stagiaires de base
                      </a>
                    </li>
                    <li>
                      <a href="https://recrutestagiaire.eu/collections/all">
                        Toutes les offres
                      </a>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="rs-footer-col rs-footer-col-c">
                <div className="footer-widget">
                  <h4 className="widget-title">Le collectif</h4>
                  <ul className="footer-menu">
                    <li>
                      <a href="https://recrutestagiaire.eu/pages/about">À propos</a>
                    </li>
                    <li>
                      <Link href="/profils">Profils candidats</Link>
                    </li>
                    <li>
                      <Link href="/depot">Déposer une candidature</Link>
                    </li>
                    <li>
                      <a href="https://recrutestagiaire.eu/pages/contact">Contact</a>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="rs-footer-col rs-footer-col-d">
                <div className="footer-bottom">
                  <div
                    className="container"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: 0,
                    }}
                  >
                    <p style={{ margin: 0 }}>
                      © {new Date().getFullYear()} Recrute Stagiaire. Tous droits
                      réservés.
                    </p>
                    <p style={{ margin: 0 }}>Paris, France</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
