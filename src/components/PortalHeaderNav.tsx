"use client";

import Link from "next/link";
import { PortalAuthLink } from "@/components/PortalAuthLink";

/** Navigation desktop (≥900px) — liens plats, design Paris. */
export function PortalHeaderNav() {
  return (
    <nav className="rs-ph-navdesk" aria-label="Navigation portail">
      <a href="https://recrutestagiaire.eu" rel="noopener noreferrer">
        Boutique
      </a>
      <Link href="/profils">Profils candidats</Link>
      <PortalAuthLink href="/swipe">Voter</PortalAuthLink>
      <a href="https://recrutestagiaire.eu/pages/about">Le collectif</a>
    </nav>
  );
}
