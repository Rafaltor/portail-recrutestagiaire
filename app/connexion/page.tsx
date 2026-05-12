"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ConnexionPanel } from "@/components/ConnexionPanel";
import type { ConnexionMode } from "@/lib/connexion-url";

function ConnexionPageInner() {
  const searchParams = useSearchParams();
  const linkToken = String(searchParams.get("token") || "").trim();
  const profileUrlParam = String(searchParams.get("profileUrl") || "").trim();
  const nextPath = String(searchParams.get("next") || "").trim();
  const modeParam = String(searchParams.get("mode") || "").trim();
  const initialMode: ConnexionMode = modeParam === "signup" ? "signup" : "login";

  return (
    <div className="mx-auto grid w-full max-w-[var(--rs-content-max,1200px)] gap-8 pb-10">
      <div className="hidden lg:block">
        <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.14em] text-[#f472b6]">
          Compte
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-syne)] text-[clamp(32px,4vw,48px)] font-extrabold leading-[1.1] tracking-tight text-[#0a0a0a]">
          Connexion
        </h1>
      </div>

      <div className="lg:hidden">
        <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.14em] text-[#f472b6]">
          Compte
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-syne)] text-[clamp(32px,4vw,48px)] font-extrabold leading-[1.1] tracking-tight text-[#0a0a0a]">
          Connexion
        </h1>
      </div>

      <ConnexionPanel
        variant="page"
        initialMode={initialMode}
        nextPath={nextPath}
        linkToken={linkToken}
        profileUrlParam={profileUrlParam}
      />
    </div>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto grid w-full max-w-[var(--rs-content-max,1200px)] gap-6 pb-10">
          <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.14em] text-[#f472b6]">
            Compte
          </p>
          <h1 className="font-[family-name:var(--font-syne)] text-[clamp(32px,4vw,48px)] font-extrabold text-[#0a0a0a]">
            Connexion
          </h1>
          <p className="font-[family-name:var(--font-dm)] text-sm text-[#555550]">Chargement…</p>
        </div>
      }
    >
      <ConnexionPageInner />
    </Suspense>
  );
}
