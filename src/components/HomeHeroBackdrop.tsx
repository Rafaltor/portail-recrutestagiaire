"use client";

import { useEffect, useState } from "react";

/** Fichiers dans public/ (sans <img> = pas d’icône « cassée »). */
const RASTER = [
  "/background-portail.png",
  "/swipe-stamps/background-portail.png",
  "/swipe-stamps/background_portail.jpg",
  "/swipe-stamps/background-portail.jpg",
  "/swipe-stamps/background-portail.jpeg",
  "/swipe-stamps/background-portail.webp",
] as const;

const FALLBACK_SVG = "/swipe-stamps/background-portail.svg";

/**
 * Fond hero : `background-image` sur un div (cover).
 * D’abord SVG versionné, puis remplacement par la première photo qui charge.
 */
export function HomeHeroBackdrop() {
  const [bgUrl, setBgUrl] = useState(FALLBACK_SVG);

  useEffect(() => {
    let cancelled = false;
    let i = 0;

    function tryRaster() {
      if (cancelled || i >= RASTER.length) return;
      const path = RASTER[i]!;
      const probe = new Image();
      probe.onload = () => {
        if (!cancelled) setBgUrl(path);
      };
      probe.onerror = () => {
        i += 1;
        tryRaster();
      };
      probe.src = path;
    }

    tryRaster();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="rs-home-hero__bg"
      aria-hidden
      style={{
        backgroundImage: `url("${bgUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
