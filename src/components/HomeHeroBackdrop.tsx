"use client";

import { useCallback, useState } from "react";

const CANDIDATES = [
  "/swipe-stamps/background-portail.png",
  "/swipe-stamps/background-portail.jpg",
  "/swipe-stamps/background-portail.jpeg",
  "/swipe-stamps/background-portail.webp",
  "/swipe-stamps/background-portail.svg",
] as const;

/**
 * Fond hero : essaie raster puis retombe sur le SVG versionné si absent.
 */
export function HomeHeroBackdrop() {
  const [i, setI] = useState(0);
  const src = CANDIDATES[i] ?? CANDIDATES[CANDIDATES.length - 1];

  const onError = useCallback(() => {
    setI((prev) => Math.min(prev + 1, CANDIDATES.length - 1));
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
        onError={onError}
      />
    </div>
  );
}
