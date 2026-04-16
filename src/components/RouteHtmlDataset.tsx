"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function RouteHtmlDataset() {
  const pathname = usePathname();

  useEffect(() => {
    const route = pathname === "/" ? "home" : "inner";
    document.documentElement.setAttribute("data-rs-route", route);
  }, [pathname]);

  return null;
}

