"use client";

import PdfPreview from "@/components/PdfPreview";

export const SWIPE_APPROVE_ANIM_MS = 350;

type PdfMode = "cover-height" | "fit-width" | "fit-page" | "fit-cover";

/**
 * 3D flip around vertical axis + exit right; glow near 90° (CSS keyframes).
 */
export function SwipeExitFlipApprove({ url, pdfMode }: { url: string; pdfMode: PdfMode }) {
  return (
    <div className="rs-swipe-flip-stage absolute inset-0 overflow-hidden rounded-none bg-[#0a0a0a]">
      <div className="rs-swipe-flip-inner h-full w-full will-change-transform">
        <PdfPreview url={url} mode={pdfMode} immersive />
      </div>
    </div>
  );
}
