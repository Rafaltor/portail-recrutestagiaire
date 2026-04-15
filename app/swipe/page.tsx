"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PdfPreview from "@/components/PdfPreview";
import { getOrCreateVisitorId } from "@/lib/visitor";

type SwipeItem = {
  profile: { id: string; handle: string };
  cvUrl: string;
};

type ApiDone = { done: true };
type ApiOk = SwipeItem;
type ApiRes = ApiDone | ApiOk;

function normHandle(h: string) {
  const s = String(h || "").trim().replace(/^@/, "");
  return s ? `@${s}` : "@—";
}

export default function SwipePage() {
  const visitorId = useMemo(() => getOrCreateVisitorId(), []);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");
  const [current, setCurrent] = useState<SwipeItem | null>(null);
  const [next, setNext] = useState<SwipeItem | null>(null);
  const [done, setDone] = useState(false);

  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState<null | { dir: 1 | -1 }>(null);
  const [fadeIn, setFadeIn] = useState(false);
  const startXRef = useRef<number | null>(null);

  async function fetchNext(): Promise<SwipeItem | null> {
    const r = await fetch(`/api/swipe/next?visitorId=${encodeURIComponent(visitorId)}`);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j?.error || "Erreur chargement");
    }
    const j = (await r.json()) as ApiRes;
    if ("done" in j) return null;
    return j;
  }

  async function prime() {
    setLoading(true);
    setMessage("");
    try {
      const first = await fetchNext();
      if (!first) {
        setDone(true);
        setCurrent(null);
        setNext(null);
        return;
      }
      setCurrent(first);
      const n = await fetchNext();
      setNext(n);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function ensurePrefetch() {
    if (next || done) return;
    try {
      const n = await fetchNext();
      setNext(n);
      if (!n) setDone(true);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  async function castVote(value: 1 | -1) {
    if (!current) return;
    setMessage("");
    const profileId = current.profile.id;

    const r = await fetch("/api/vote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId, value, visitorId }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setMessage(j?.error || "Impossible d’enregistrer le vote.");
      return;
    }

    // advance (swap content only after the card has animated out)
    if (next) {
      setCurrent(next);
      setNext(null);
      setFadeIn(true);
      void ensurePrefetch();
    } else {
      const n = await fetchNext().catch(() => null);
      if (!n) {
        setDone(true);
        setCurrent(null);
        setNext(null);
      } else {
        setCurrent(n);
        setNext(null);
        setFadeIn(true);
        void ensurePrefetch();
      }
    }

    // reset swipe state after swap
    setDragX(0);
    setDragging(false);
    setAnimating(null);
  }

  useEffect(() => {
    void prime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock page scroll on mobile to avoid accidental scrollbars while swiping.
  useEffect(() => {
    const prevOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return;
      if (e.key === "ArrowRight") void castVote(1);
      if (e.key === "ArrowLeft") void castVote(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, visitorId, next, done]);

  const threshold = 120;
  const tilt = Math.max(-12, Math.min(12, dragX / 18));
  const overlay =
    dragX > 30 ? "like" : dragX < -30 ? "nope" : null;

  function onPointerDown(e: React.PointerEvent) {
    if (!current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || startXRef.current == null) return;
    setDragX(e.clientX - startXRef.current);
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (dragX > threshold) {
      setAnimating({ dir: 1 });
      setDragX(window.innerWidth * 1.2);
      window.setTimeout(() => void castVote(1), 180);
    } else if (dragX < -threshold) {
      setAnimating({ dir: -1 });
      setDragX(-window.innerWidth * 1.2);
      window.setTimeout(() => void castVote(-1), 180);
    } else {
      setDragX(0);
    }
    startXRef.current = null;
  }

  useEffect(() => {
    if (!fadeIn) return;
    const t = window.setTimeout(() => setFadeIn(false), 220);
    return () => window.clearTimeout(t);
  }, [fadeIn]);

  return (
    <div className="relative h-[100svh] w-full overflow-hidden">
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 px-3 pt-3">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div className="pointer-events-auto rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-sm font-black text-zinc-900 backdrop-blur">
            {current ? normHandle(current.profile.handle) : "@—"}
          </div>
          {message ? (
            <div className="pointer-events-auto rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">
              {message}
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex h-full items-center justify-center px-6 text-sm text-zinc-700">
          Chargement…
        </div>
      ) : done || !current ? (
        <div className="flex h-full items-center justify-center px-6">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6">
            <div className="text-lg font-black">C’est tout pour l’instant.</div>
            <p className="mt-2 text-sm text-zinc-700">
              Tu as voté sur tous les profils disponibles.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="/profils"
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-100"
              >
                Voir les profils
              </a>
              <a
                href="/depot"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Déposer
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center px-2 pb-24 pt-14">
          <div className="w-full max-w-xl">
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="relative select-none rounded-2xl border border-zinc-200 bg-white shadow-sm"
              style={{
                transform: `translateX(${dragX}px) rotate(${tilt}deg)`,
                transitionProperty: "transform, opacity",
                transitionDuration: dragging || animating ? "180ms" : "160ms",
                transitionTimingFunction: "ease-out",
                touchAction: "none",
                opacity: fadeIn ? 0 : 1,
              }}
            >
              {overlay ? (
                <div className="pointer-events-none absolute left-3 top-3">
                  <div
                    className={`rounded-lg border px-3 py-2 text-sm font-black uppercase tracking-wider ${
                      overlay === "like"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-rose-300 bg-rose-50 text-rose-800"
                    }`}
                  >
                    {overlay === "like" ? "LIKE" : "NOPE"}
                  </div>
                </div>
              ) : null}

              <div className="p-2">
                <div className="h-[72svh] md:h-[78svh]">
                  <PdfPreview url={current.cvUrl} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !done && current ? (
        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-5">
          <div className="mx-auto flex max-w-xl items-center justify-center gap-3">
            <button
              onClick={() => void castVote(-1)}
              className="rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-black text-zinc-900 hover:bg-zinc-100"
            >
              Dislike
            </button>
            <button
              onClick={() => void castVote(1)}
              className="rounded-md bg-zinc-900 px-5 py-3 text-sm font-black text-white hover:bg-zinc-800"
            >
              Like
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

