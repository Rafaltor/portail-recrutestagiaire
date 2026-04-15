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

    // advance
    setDragX(0);
    setDragging(false);
    if (next) {
      setCurrent(next);
      setNext(null);
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
        void ensurePrefetch();
      }
    }
  }

  useEffect(() => {
    void prime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (dragX > threshold) void castVote(1);
    else if (dragX < -threshold) void castVote(-1);
    else setDragX(0);
    startXRef.current = null;
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-black tracking-tight">Vote (Swipe)</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Swipe droite = like. Swipe gauche = dislike. (Flèches ←/→ aussi.)
        </p>
        {message ? <p className="mt-3 text-sm text-red-700">{message}</p> : null}
      </div>

      {loading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
          Chargement…
        </div>
      ) : done || !current ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
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
      ) : (
        <div className="grid gap-4">
          <div className="mx-auto w-full max-w-xl">
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="relative select-none rounded-2xl border border-zinc-200 bg-white shadow-sm"
              style={{
                transform: `translateX(${dragX}px) rotate(${tilt}deg)`,
                transition: dragging ? "none" : "transform 160ms ease-out",
                touchAction: "pan-y",
              }}
            >
              <div className="flex items-center justify-center border-b border-zinc-200 px-5 py-4">
                <div className="text-sm font-black text-zinc-900">
                  {normHandle(current.profile.handle)}
                </div>
              </div>

              {overlay ? (
                <div className="pointer-events-none absolute left-4 top-16">
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

              <div className="p-5">
                <PdfPreview url={current.cvUrl} />
              </div>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-xl items-center justify-center gap-3">
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
      )}
    </div>
  );
}

