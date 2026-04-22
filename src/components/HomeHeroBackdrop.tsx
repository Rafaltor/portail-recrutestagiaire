"use client";

import { useEffect, useState } from "react";

/** Photos optionnelles dans public/swipe-stamps/ — testées sans afficher d’URL cassée. */
const RASTER = [
  "/swipe-stamps/background-portail.png",
  "/swipe-stamps/background-portail.jpg",
  "/swipe-stamps/background-portail.jpeg",
  "/swipe-stamps/background-portail.webp",
] as const;

const FALLBACK_SVG = "/swipe-stamps/background-portail.svg";

/**
 * Fond hero : affiche d’abord le SVG versionné, puis remplace par une photo si elle charge.
 */
export function HomeHeroBackdrop() {
  const [src, setSrc] = useState(FALLBACK_SVG);

  useEffect(() => {
    let cancelled = false;
    let i = 0;

    function tryRaster() {
      if (cancelled || i >= RASTER.length) return;
      const path = RASTER[i]!;
      const probe = new Image();
      probe.onload = () => {
        if (!cancelled) setSrc(path);
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
    <div className="rs-home-hero__bg" aria-hidden>
      <img
        key={src}
        className="rs-home-hero__bg-img"
        src={src}
        alt=""
        width={1920}
        height={1080}
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}
