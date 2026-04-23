"use client";

import { useEffect, useRef, useState } from "react";

type CvThumbnailProps = { cvUrl: string };

export function CvThumbnail({ cvUrl }: CvThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function render() {
      try {
        const previewRes = await fetch(
          `${cvUrl}${cvUrl.includes("?") ? "&" : "?"}intent=preview`,
        );
        if (!previewRes.ok) throw new Error("preview_failed");
        const previewJson = (await previewRes.json()) as { url?: string };
        const pdfSrc = previewJson?.url;
        if (!pdfSrc) throw new Error("no_url");

        const pdfjsLib = await import("pdfjs-dist");
        const v = (pdfjsLib as { version?: string }).version ?? "5.6.205";
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${v}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument(pdfSrc).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.17 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no_ctx");
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        setLoaded(true);
      } catch {
        setError(true);
      }
    }
    void render();
  }, [cvUrl]);

  if (error) {
    return (
      <div className="flex h-[113px] w-[80px] items-center justify-center rounded bg-[#F0F0F0] text-2xl">
        📄
      </div>
    );
  }
  return (
    <div className="relative h-[113px] w-[80px] flex-shrink-0 overflow-hidden rounded border border-[#F0F0F0]">
      {!loaded ? (
        <div className="absolute inset-0 animate-pulse bg-[#F0F0F0]" />
      ) : null}
      <canvas ref={canvasRef} className="h-full w-full object-cover" />
    </div>
  );
}
