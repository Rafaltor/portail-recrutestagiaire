"use client";

import Link from "next/link";
import { PortalAuthLink } from "@/components/PortalAuthLink";
import { boutiqueUrl } from "@/lib/seo";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

type HotspotDef = {
  id: string;
  label: string;
  top: number;
  left: number;
  href: string;
  auth?: boolean;
  mode?: "login" | "signup";
  external?: boolean;
};

/** Positions en % du wallpaper (largeur / hauteur de la couche panoramique). */
const HOTSPOTS: HotspotDef[] = [
  { id: "voter", label: "Voter", href: "/swipe", top: 40, left: 25, auth: true },
  {
    id: "depot",
    label: "Déposer son CV",
    href: "/depot",
    top: 55,
    left: 60,
    auth: true,
    mode: "signup",
  },
  { id: "atelier", label: "L'atelier", href: boutiqueUrl, top: 60, left: 90, external: true },
  { id: "espace", label: "Mon espace", href: "/mon-espace", top: 75, left: 70, auth: true },
];

const btnClass = "rs-home-hotspot__btn";

function HotspotButtonLabel({ spot }: { spot: HotspotDef }) {
  if (spot.id === "atelier") {
    return (
      <>
        L&apos;atelier
        <span className="rs-home-hotspot__arrow" aria-hidden="true">
          →
        </span>
      </>
    );
  }
  return spot.label;
}

function stopPan(e: ReactPointerEvent) {
  e.stopPropagation();
}

function HotspotLink({ spot }: { spot: HotspotDef }) {
  const style = {
    "--rs-hotspot-top": `${spot.top}%`,
    "--rs-hotspot-left": `${spot.left}%`,
  } as CSSProperties;

  let inner: ReactNode;
  if (spot.external) {
    inner = (
      <a href={spot.href} className={btnClass}>
        <HotspotButtonLabel spot={spot} />
      </a>
    );
  } else if (spot.auth) {
    inner = (
      <PortalAuthLink href={spot.href} mode={spot.mode} className={btnClass}>
        <HotspotButtonLabel spot={spot} />
      </PortalAuthLink>
    );
  } else {
    inner = (
      <Link href={spot.href} className={btnClass}>
        <HotspotButtonLabel spot={spot} />
      </Link>
    );
  }

  return (
    <div className="rs-home-hotspot" style={style} onPointerDown={stopPan}>
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
