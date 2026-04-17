"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  url: string;
  /** fit-width: fill width (may crop vertically). fit-page / cover-height: entire page visible (contain). */
  mode?: "cover-height" | "fit-width" | "fit-page";
  immersive?: boolean;
};

export default function PdfPreview({
  url,
  mode = "cover-height",
  immersive = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderPdf(silent: boolean) {
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
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

        const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const isIOS = /iPad|iPhone|iPod/.test(ua);
        const disableWorker = isIOS;

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
        const wrap = wrapRef.current;
        if (!canvas || !wrap) return;

        const rect = wrap.getBoundingClientRect();
        const containerWidth = Math.max(1, rect.width);
        const containerHeight = Math.max(1, rect.height);

        const vp1 = page.getViewport({ scale: 1 });
        const byWidth = containerWidth / vp1.width;
        const byHeight = containerHeight / vp1.height;
        const raw =
          mode === "fit-width" ? byWidth : Math.min(byWidth, byHeight);
        const scale = Math.max(0.45, Math.min(3.2, raw));
        const viewport = page.getViewport({ scale });

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

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

    function scheduleRender(silent: boolean) {
      if (typeof window === "undefined") return;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        void renderPdf(silent);
      });
    }

    scheduleRender(false);

    const wrap = wrapRef.current;
    if (wrap && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => scheduleRender(true));
      ro.observe(wrap);
      return () => {
        cancelled = true;
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        ro.disconnect();
      };
    }

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [url, mode]);

  return (
    <div
      className={
        immersive
          ? "flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-md bg-zinc-100"
          : "rounded-lg border border-zinc-200 bg-white"
      }
    >
      {error ? (
        <div className="px-3 py-3 text-sm text-red-700">{error}</div>
      ) : (
        <div
          ref={wrapRef}
          className={`relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-zinc-50 ${
            immersive ? "h-full p-0" : "min-h-[200px] p-2"
          }`}
        >
          {loading ? (
            <div className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs font-semibold text-zinc-500">
              Chargement…
            </div>
          ) : null}
          <canvas ref={canvasRef} className="block max-h-full max-w-full shrink-0" />
        </div>
      )}
    </div>
  );
}
