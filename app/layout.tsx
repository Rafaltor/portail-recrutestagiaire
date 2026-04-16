import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./rs-shopify-header.css";
import "./rs-shopify-ui.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portail — Recrute Stagiaire",
  description: "Portail candidatures (MVP)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-[#e8e8e8] text-[#212529]">
        <header
          className="header-wrap rs-header rs-header--banner"
          style={
            {
              ["--rs-header-bg-img"]: `url(//recrutestagiaire.eu/cdn/shop/files/geometric-glass-city-architecture.jpg?v=1776117913&width=2400)`,
            } as CSSProperties
          }
        >
          <div
            className="rs-header-kitsch-pop rs-header-kitsch-pop--brand"
            aria-hidden="true"
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
              <span className="rs-header-kitsch-pop__chunk">
                ★ Portail du collectif ★ Nouvelles pièces — candidatures ouvertes ★ Mode, textile & rencontres ★ •
              </span>
              <span className="rs-header-kitsch-pop__chunk">
                ★ Portail du collectif ★ Nouvelles pièces — candidatures ouvertes ★ Mode, textile & rencontres ★ •
              </span>
            </div>
          </div>

          <div className="container">
            <div className="rs-header-two-tier" aria-label="En-tête du site">
              <div className="rs-banner-top rs-header-pole-brand">
                <a className="nav-brand rs-nav-brand" href="https://recrutestagiaire.eu">
                  <Image
                    className="rs-nav-brand__img"
                    src="https://recrutestagiaire.eu/cdn/shop/t/22/assets/rs-logo-eu.png?v=176671118349166250451776112697"
                    alt="Recrute Stagiaire"
                    width={40}
                    height={34}
                    priority
                    style={{ height: 34, width: "auto" }}
                  />
                  <span className="rs-nav-brand__name logo">RECRUTE STAGIAIRE</span>
                </a>

                <a
                  href="https://recrutestagiaire.eu/cart"
                  className="abt-btn rs-caf-btn-dossier rs-banner-top__cart d-inline-flex align-items-center gap-1 text-decoration-none"
                >
                  <span className="rs-caf-btn-dossier__label">Mon dossier</span>
                </a>
              </div>

              <nav className="rs-banner-nav rs-header-pole-tabs" aria-label="Navigation principale">
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
                        <Link href="/swipe">Voter (Swipe)</Link>
                      </li>
                  <li>
                    <Link href="/connexion">Compte</Link>
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
          </div>
        </header>

        <main className="mx-auto w-full max-w-[980px] px-[10px] py-0">
          {children}
        </main>

        <footer className="footer skin-dark-footer">
          <div className="container" style={{ paddingTop: 26, paddingBottom: 18 }}>
            <div className="rs-footer-grid">
              <div className="rs-footer-col rs-footer-col-a">
                <div className="footer-widget">
                  <div className="footerLogo" style={{ marginBottom: 10 }}>
                    <span style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>
                      RECRUTE STAGIAIRE
                    </span>
                  </div>
                  <div className="footerText" style={{ maxWidth: 520 }}>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.78)" }}>
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
