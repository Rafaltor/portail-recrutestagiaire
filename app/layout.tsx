import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./rs-shopify-header.css";

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
        <header className="header-wrap rs-header">
          <div className="rs-header-kitsch-pop rs-header-kitsch-pop--brand" aria-hidden="true">
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
      </body>
    </html>
  );
}
