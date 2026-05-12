"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ConnexionPanel } from "@/components/ConnexionPanel";
import type { ConnexionMode } from "@/lib/connexion-url";

type ConnexionOverlayProps = {
  initialMode?: ConnexionMode;
  nextPath?: string;
  linkToken?: string;
  profileUrlParam?: string;
  onClose?: () => void;
  onAuthenticated?: () => void;
};

export function ConnexionOverlay({
  initialMode = "login",
  nextPath = "",
  linkToken = "",
  profileUrlParam = "",
  onClose,
  onAuthenticated,
}: ConnexionOverlayProps) {
  const router = useRouter();

  const close = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    router.back();
  }, [onClose, router]);

  return (
    <div
      className="fixed inset-0 z-[30000] flex items-center justify-center px-4 py-6"
      style={{ background: "rgba(10, 10, 10, 0.7)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="connexion-overlay-title"
      onClick={close}
    >
      <div
        className="relative w-full max-w-[400px] rounded-[12px] bg-white p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#0a0a0a] transition-colors hover:bg-[#f5f5f5]"
          aria-label="Fermer"
        >
          <span aria-hidden className="text-xl leading-none">
            ×
          </span>
        </button>

        <h2
          id="connexion-overlay-title"
          className="pr-8 text-center font-[family-name:var(--font-syne)] text-[18px] font-extrabold tracking-tight text-[#0a0a0a]"
        >
          Connexion
        </h2>
        <p className="mt-2 text-center font-[family-name:var(--font-dm)] text-[14px] text-[#555550]">
          Google ou email et mot de passe.
        </p>

        <div className="mt-6">
          <ConnexionPanel
            variant="modal"
            initialMode={initialMode}
            nextPath={nextPath}
            linkToken={linkToken}
            profileUrlParam={profileUrlParam}
            onAuthenticated={onAuthenticated}
          />
        </div>
      </div>
    </div>
  );
}
