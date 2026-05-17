"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function RouteHtmlDataset() {
  const pathname = usePathname();

  useEffect(() => {
    const route = pathname === "/" ? "home" : "inner";
    document.documentElement.setAttribute("data-rs-route", route);

    let tab: "offres" | "cand" | "coll" = "offres";
    if (
      pathname.startsWith("/profils") ||
      pathname.startsWith("/depot") ||
      pathname.startsWith("/swipe") ||
      pathname.startsWith("/mon-espace") ||
      pathname.startsWith("/connexion")
    ) {
      tab = "cand";
    }
    document.documentElement.setAttribute("data-rs-header-tab", tab);

    if (pathname.startsWith("/swipe")) {
      document.documentElement.setAttribute("data-rs-swipe", "1");
    } else {
      document.documentElement.removeAttribute("data-rs-swipe");
    }

    if (pathname === "/") {
      document.documentElement.setAttribute("data-rs-home-immersive", "1");
    } else {
      document.documentElement.removeAttribute("data-rs-home-immersive");
    }
  }, [pathname]);

  return null;
}

