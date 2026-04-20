import type { Metadata } from "next";
import { siteUrl } from "@/lib/seo";
import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { HeaderMobileNav } from "@/components/HeaderMobileNav";
import { HeaderAccountLink } from "@/components/HeaderAccountLink";
import { RouteHtmlDataset } from "@/components/RouteHtmlDataset";
import "./globals.css";
import "./rs-shopify-header.css";
import "./rs-shopify-ui.css";
import "./portal-theme.css";

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
  return (
    <html lang="fr">
      <body className="rs-portal-body flex min-h-dvh flex-col text-[#0A0A0A]">
        <RouteHtmlDataset />
        <HeaderMobileNav />
        <div
          className="header-wrap rs-header rs-header--banner"
          role="banner"
          style={
            {
              ["--rs-header-bg-img"]: `url(//recrutestagiaire.eu/cdn/shop/files/geometric-glass-city-architecture.jpg?v=1776117913&width=2400)`,
            } as CSSProperties
          }
        >
          <div
            className="rs-header-kitsch-pop rs-header-kitsch-pop--brand"
            aria-hidden="true"
            style={
              {
                ["--rs-kitsch-pop-a"]: "#F472B6",
                ["--rs-kitsch-pop-b"]: "#e8e8f0",
                ["--rs-kitsch-pop-fg"]: "#0A0A0A",
              } as CSSProperties
            }
          >
            <span
              className="rs-header-kitsch-pop__deco rs-header-kitsch-pop__deco--a"
              aria-hidden="true"
            >
              ✦
            </span>
            <span
              className="rs-header-kitsch-pop__deco rs-header-kitsch-pop__deco--b"
              aria-hidden="true"
            >
              ✦
            </span>
            <div className="rs-header-kitsch-pop__track">
              {[
                "★ Portail du collectif ★ Nouvelles pièces — candidatures ouvertes ★ Mode, textile & rencontres ★",
                "★ Portail du collectif ★ Nouvelles pièces — candidatures ouvertes ★ Mode, textile & rencontres ★",
                "★ Portail du collectif ★ Nouvelles pièces — candidatures ouvertes ★ Mode, textile & rencontres ★",
                "★ Portail du collectif ★ Nouvelles pièces — candidatures ouvertes ★ Mode, textile & rencontres ★",
                "★ Portail du collectif ★ Nouvelles pièces — candidatures ouvertes ★ Mode, textile & rencontres ★",
                "★ Portail du collectif ★ Nouvelles pièces — candidatures ouvertes ★ Mode, textile & rencontres ★",
              ].map((t, i) => (
                <span key={i} className="rs-header-kitsch-pop__chunk">
                  {t}
                  &nbsp;•&nbsp;
                </span>
              ))}
            </div>
          </div>

          <div className="container">
            <header className="rs-header-two-tier" aria-label="En-tête du site">
              <div className="rs-header-main-row">
                <div className="rs-header-top-line">
                  <div className="rs-banner-top rs-header-pole-brand">
                    <a
                      className="nav-brand rs-nav-brand"
                      href="https://recrutestagiaire.eu"
                    >
                      <Image
                        className="rs-nav-brand__img"
                        src="/rs-logo-eu.png"
                        alt="Recrute Stagiaire"
                        width={177}
                        height={125}
                        priority
                        style={{ maxHeight: 40, height: "auto", width: "auto" }}
                      />
                      <span className="rs-nav-brand__name logo">
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

                <nav
                  className="rs-banner-nav rs-header-pole-tabs"
                  aria-label="Navigation principale"
                >
                <ul className="rs-subnav rs-subnav--buttons" role="menubar">
                  <li className="rs-subnav__item">
                    <button type="button" className="rs-subnav__trigger">
                      Offres
                    </button>
                    <ul className="rs-subnav__dropdown">
                      <li>
                        <a href="https://recrutestagiaire.eu/collections/abcdrs">Collection ABCDRS</a>
                      </li>
                      <li>
                        <a href="https://recrutestagiaire.eu/collections/les-stagiaires-de-base">
                          Les stagiaires de base
                        </a>
                      </li>
                    </ul>
                  </li>

                  <li className="rs-subnav__item is-active">
                    <button type="button" className="rs-subnav__trigger">
                      Candidatures
                    </button>
                    <ul className="rs-subnav__dropdown">
                      <li>
                        <Link href="/profils">Profils candidats</Link>
                      </li>
                      <li>
                        <Link href="/depot">Déposer sa candidature</Link>
                      </li>
                      <li>
                        <Link href="/swipe">Vote (swipe)</Link>
                      </li>
                    </ul>
                  </li>

                  <li className="rs-subnav__item">
                    <button type="button" className="rs-subnav__trigger">
                      Le collectif
                    </button>
                    <ul className="rs-subnav__dropdown">
                      <li>
                        <a href="https://recrutestagiaire.eu/pages/about">Histoire</a>
                      </li>
                      <li>
                        <a href="https://recrutestagiaire.eu/pages/contact">Contact</a>
                      </li>
                    </ul>
                  </li>
                </ul>
                </nav>
              </div>
            </header>
          </div>
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
