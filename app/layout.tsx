import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
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

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 hover:text-zinc-950"
    >
      {children}
    </Link>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-zinc-50 text-zinc-900">
        <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="font-black tracking-tight text-zinc-950">
              Portail
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink href="/profils">Profils</NavLink>
              <NavLink href="/depot">Déposer</NavLink>
              <a
                href="https://recrutestagiaire.eu"
                className="rounded-md px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                Boutique →
              </a>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
