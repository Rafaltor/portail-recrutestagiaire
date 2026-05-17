"use client";

import Link from "next/link";
import { PortalAuthLink } from "@/components/PortalAuthLink";

/** Navigation desktop (≥900px) — liens plats, design Paris. */
export function PortalHeaderNav() {
  return (
    <nav className="rs-ph-navdesk" aria-label="Navigation portail">
      <Link href="/profils">Profils candidats</Link>
      <PortalAuthLink href="/swipe">Voter</PortalAuthLink>
    </nav>
  );
}
