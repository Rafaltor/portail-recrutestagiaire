import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
      <body className="min-h-dvh bg-zinc-50 text-zinc-900">
        <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
          {/* Bandeau kitsch (comme Shopify) */}
          <div className="border-b border-zinc-200 bg-[#ffd230] text-[#0015a3]">
            <div className="mx-auto w-full max-w-5xl overflow-hidden px-4 py-1 text-xs font-black uppercase tracking-wider">
              <div className="whitespace-nowrap">
                ★ Portail du collectif ★ Nouvelles pièces — candidatures ouvertes ★ Mode,
                textile & rencontres ★
              </div>
            </div>
          </div>

          {/* Top row: marque + dossier */}
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <a
              href="https://recrutestagiaire.eu"
              className="flex items-center gap-2 font-black tracking-tight text-zinc-950"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white">
                RS
              </span>
              <span className="leading-none">
                RECRUTE <span className="text-[#0015a3]">STAGIAIRE</span>
              </span>
            </a>

            <a
              href="https://recrutestagiaire.eu/cart"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-black text-zinc-900 hover:bg-zinc-100"
            >
              Mon dossier
            </a>
          </div>

          {/* Tabs row */}
          <nav className="border-t border-zinc-200 bg-white">
            <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-2">
              <div className="group relative">
                <a
                  href="https://recrutestagiaire.eu/collections/all"
                  className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-black text-zinc-900 hover:bg-zinc-50"
                >
                  Offres
                </a>
                <div className="invisible absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-zinc-200 bg-white p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                  <a
                    href="https://recrutestagiaire.eu/collections/abcdrs"
                    className="block rounded-md px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
                  >
                    Collection ABCDRS
                  </a>
                  <a
                    href="https://recrutestagiaire.eu/collections/les-stagiaires-de-base"
                    className="block rounded-md px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
                  >
                    Les stagiaires de base
                  </a>
                </div>
              </div>

              <div className="group relative">
                <Link
                  href="/profils"
                  className="rounded-md border border-zinc-200 bg-[#ffd230] px-4 py-2 text-sm font-black text-[#0015a3] hover:bg-[#ffdf62]"
                >
                  Candidatures
                </Link>
                <div className="invisible absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-zinc-200 bg-white p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                  <Link
                    href="/profils"
                    className="block rounded-md px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
                  >
                    Profils candidats
                  </Link>
                  <Link
                    href="/depot"
                    className="block rounded-md px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
                  >
                    Déposer sa candidature
                  </Link>
                  <Link
                    href="/swipe"
                    className="block rounded-md px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
                  >
                    Voter (Swipe)
                  </Link>
                </div>
              </div>

              <div className="group relative">
                <a
                  href="https://recrutestagiaire.eu/pages/about"
                  className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-black text-zinc-900 hover:bg-zinc-50"
                >
                  Le collectif
                </a>
                <div className="invisible absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border border-zinc-200 bg-white p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                  <a
                    href="https://recrutestagiaire.eu/pages/about"
                    className="block rounded-md px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
                  >
                    Histoire
                  </a>
                  <a
                    href="https://recrutestagiaire.eu/pages/contact"
                    className="block rounded-md px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
                  >
                    Contact
                  </a>
                </div>
              </div>
            </div>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
