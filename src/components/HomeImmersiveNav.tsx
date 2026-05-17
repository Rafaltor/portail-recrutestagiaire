"use client";

import Link from "next/link";
import { PortalAuthLink } from "@/components/PortalAuthLink";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

type HotspotDef = {
  id: string;
  label: string;
  top: number;
  left: number;
  href: string;
  auth?: boolean;
  mode?: "login" | "signup";
};

/** Positions en % du wallpaper (largeur / hauteur de la couche panoramique). */
const HOTSPOTS: HotspotDef[] = [
  { id: "voter", label: "Voter", href: "/swipe", top: 30, left: 20, auth: true },
  {
    id: "depot",
    label: "Déposer son CV",
    href: "/depot",
    top: 55,
    left: 50,
    auth: true,
    mode: "signup",
  },
  { id: "atelier", label: "Atelier", href: "/profils", top: 42, left: 38 },
  { id: "espace", label: "Mon espace", href: "/mon-espace", top: 65, left: 70, auth: true },
];

const btnClass = "rs-home-hotspot__btn";

function stopPan(e: ReactPointerEvent) {
  e.stopPropagation();
}

function HotspotLink({ spot }: { spot: HotspotDef }) {
  const style = {
    "--rs-hotspot-top": `${spot.top}%`,
    "--rs-hotspot-left": `${spot.left}%`,
  } as CSSProperties;

  const inner = spot.auth ? (
    <PortalAuthLink href={spot.href} mode={spot.mode} className={btnClass}>
      {spot.label}
    </PortalAuthLink>
  ) : (
    <Link href={spot.href} className={btnClass}>
      {spot.label}
    </Link>
  );

  return (
    <div
      className={`rs-home-hotspot${spot.id === "depot" ? " rs-home-hotspot--wide" : ""}`}
      style={style}
      onPointerDown={stopPan}
    >
      {inner}
    </div>
  );
}

export function HomeImmersiveNav() {
  return (
    <div className="rs-home-panorama__hotspots" aria-label="Navigation atelier">
      {HOTSPOTS.map((spot) => (
        <HotspotLink key={spot.id} spot={spot} />
      ))}
    </div>
  );
}
