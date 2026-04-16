"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  url: string;
  mode?: "cover-height" | "fit-width";
};

export default function PdfPreview({ url, mode = "cover-height" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");
      try {
        // Use legacy build for better mobile/Safari compatibility.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        type PdfDoc = {
          getPage: (n: number) => Promise<PdfPage>;
        };
        type PdfPage = {
          getViewport: (arg: { scale: number }) => { width: number; height: number };
          render: (arg: {
            canvasContext: CanvasRenderingContext2D;
            viewport: { width: number; height: number };
          }) => { promise: Promise<void> };
        };

        const pdfjsAny = pdfjs as unknown as {
          GlobalWorkerOptions: { workerSrc?: string };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          getDocument: (arg: any) => { promise: Promise<PdfDoc> };
        };
        const { GlobalWorkerOptions, getDocument } = pdfjsAny;

        // PDF.js workers can be problematic on iOS/Safari (module workers, CSP, etc.).
        // For MVP, disable worker on iOS to avoid runtime crashes.
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const isIOS = /iPad|iPhone|iPod/.test(ua);
        const disableWorker = isIOS;

        // Always set workerSrc when missing. Even with disableWorker,
        // some environments still require a defined workerSrc.
        if (!GlobalWorkerOptions.workerSrc) {
          GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
            import.meta.url,
          ).toString();
        }

        const loadingTask = getDocument({ url, disableWorker });
        const pdf = await loadingTask.promise;
        const page = (await pdf.getPage(1)) as PdfPage;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const parent = canvas.parentElement;
        const rect = parent?.getBoundingClientRect();
        const containerWidth = rect?.width ?? 900;
        // Aim to use the available height (avoid cropping on desktop).
        const containerHeight = rect?.height ?? 900;

        const vp1 = page.getViewport({ scale: 1 });
        const byWidth = containerWidth / vp1.width;
        const byHeight = containerHeight / vp1.height;
        const raw =
          mode === "fit-width" ? byWidth : Math.min(byWidth, byHeight);
        const scale = Math.max(0.5, Math.min(3.2, raw));
        const viewport = page.getViewport({ scale });

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Render in HiDPI to avoid blurry canvas on mobile.
        const dpr =
          typeof window !== "undefined" ? Math.min(3, window.devicePixelRatio || 1) : 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });
        await renderTask.promise;

        if (cancelled) return;
      } catch (e: unknown) {
        setError(
          e instanceof Error
            ? e.message
            : "Impossible d’afficher l’aperçu du PDF sur cet appareil.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [url, mode]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      {error ? (
        <div className="px-3 py-3 text-sm text-red-700">{error}</div>
      ) : (
        <div className="relative overflow-hidden bg-zinc-50 p-2">
          {loading ? (
            <div className="absolute inset-x-0 top-2 text-center text-xs font-semibold text-zinc-500">
              Chargement…
            </div>
          ) : null}
          <canvas ref={canvasRef} className="mx-auto block max-w-full" />
        </div>
      )}
    </div>
  );
}

