"use client";

import { useEffect, useState } from "react";
import PdfPreview from "@/components/PdfPreview";

type Props = { profileId: string };

/**
 * Aperçu 1re page du CV (liste profils) — `intent=preview` : ne compte pas une vue complète.
 */
export default function ProfilCvThumb({ profileId }: Props) {
  const [url, setUrl] = useState<string>("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch(
          `/api/cv/${encodeURIComponent(profileId)}?intent=preview`,
        );
        if (!r.ok) throw new Error("cv");
        const j = (await r.json()) as { url?: string };
        if (!alive || !j.url) throw new Error("cv");
        setUrl(j.url);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [profileId]);

  if (failed) {
    return (
      <div className="flex h-full min-h-[200px] w-full items-center justify-center bg-[var(--rs-logo-blue-pale,#e8eeff)] px-4 text-center">
        <p className="text-xs font-semibold leading-snug text-[var(--rs-logo-blue-mid,#1b55c4)]">
          Aperçu PDF indisponible
        </p>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-full min-h-[200px] w-full items-center justify-center bg-gradient-to-b from-[#e8eeff] to-[#f4f6fc]">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--rs-logo-blue-mid,#1b55c4)]">
          Chargement du CV…
        </span>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[200px] w-full min-w-0 overflow-hidden bg-white">
      <PdfPreview
        url={url}
        mode="cover-height"
        immersive
        pixelRatioMin={1.5}
      />
    </div>
  );
}
