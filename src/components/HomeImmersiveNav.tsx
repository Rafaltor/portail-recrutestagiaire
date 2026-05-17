"use client";

import Link from "next/link";
import { PortalAuthLink } from "@/components/PortalAuthLink";
import type { PointerEvent as ReactPointerEvent } from "react";

const btnClass =
  "rs-home-immersive-nav__btn inline-flex min-h-[48px] w-full max-w-[min(320px,88vw)] items-center justify-center rounded-full border border-white/35 bg-black/35 px-6 py-3 text-center font-[family-name:var(--font-syne)] text-[13px] font-bold uppercase tracking-[0.08em] text-white no-underline backdrop-blur-md transition-colors hover:border-white/60 hover:bg-black/50 hover:no-underline sm:text-sm";

function stopPan(e: ReactPointerEvent) {
  e.stopPropagation();
}

export function HomeImmersiveNav() {
  return (
    <nav
      className="rs-home-immersive-nav"
      aria-label="Navigation principale"
      onPointerDown={stopPan}
    >
      <PortalAuthLink href="/swipe" className={btnClass}>
        Voter
      </PortalAuthLink>
      <PortalAuthLink href="/depot" mode="signup" className={btnClass}>
        Déposer son CV
      </PortalAuthLink>
      <Link href="/profils" className={btnClass}>
        Classement
      </Link>
      <PortalAuthLink href="/mon-espace" className={btnClass}>
        Mon espace
      </PortalAuthLink>
    </nav>
  );
}
