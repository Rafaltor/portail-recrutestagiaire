"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConnexionOverlay } from "@/components/ConnexionOverlay";
import type { ConnexionMode } from "@/lib/connexion-url";

function ConnexionModalInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = String(searchParams.get("next") || "").trim();
  const modeParam = String(searchParams.get("mode") || "").trim();
  const initialMode: ConnexionMode = modeParam === "signup" ? "signup" : "login";
  const linkToken = String(searchParams.get("token") || "").trim();
  const profileUrlParam = String(searchParams.get("profileUrl") || "").trim();

  return (
    <ConnexionOverlay
      initialMode={initialMode}
      nextPath={nextPath}
      linkToken={linkToken}
      profileUrlParam={profileUrlParam}
      onAuthenticated={() => {
        if (!nextPath) {
          router.back();
        }
      }}
    />
  );
}

export default function ConnexionModalPage() {
  return (
    <Suspense fallback={null}>
      <ConnexionModalInner />
    </Suspense>
  );
}
