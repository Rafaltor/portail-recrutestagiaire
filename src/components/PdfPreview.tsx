"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  url: string;
};

export default function PdfPreview({ url }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");
      try {
        const pdfjs = await import("pdfjs-dist");
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
          getDocument: (arg: { url: string }) => { promise: Promise<PdfDoc> };
        };
        const { GlobalWorkerOptions, getDocument } = pdfjsAny;

        if (!GlobalWorkerOptions.workerSrc) {
          GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url,
          ).toString();
        }

        const loadingTask = getDocument({ url });
        const pdf = await loadingTask.promise;
        const page = (await pdf.getPage(1)) as PdfPage;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Fit width to container (max ~980px)
        const containerWidth =
          canvas.parentElement?.getBoundingClientRect().width ?? 900;

        const vp1 = page.getViewport({ scale: 1 });
        const scale = Math.max(0.5, Math.min(2.2, containerWidth / vp1.width));
        const viewport = page.getViewport({ scale });

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });
        await renderTask.promise;

        if (cancelled) return;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur PDF");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2">
      <div className="flex items-center justify-between gap-3 px-2 py-2">
        <div className="text-xs font-black uppercase tracking-wider text-zinc-700">
          Aperçu (page 1)
        </div>
        {loading ? (
          <div className="text-xs font-semibold text-zinc-500">Chargement…</div>
        ) : null}
      </div>

      {error ? (
        <div className="px-2 pb-3 text-sm text-red-700">{error}</div>
      ) : (
        <div className="overflow-auto rounded-md bg-zinc-50 p-2">
          <canvas ref={canvasRef} className="mx-auto block max-w-full" />
        </div>
      )}
    </div>
  );
}

