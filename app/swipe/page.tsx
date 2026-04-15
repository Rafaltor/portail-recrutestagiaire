"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PdfPreview from "@/components/PdfPreview";
import { getOrCreateVisitorId } from "@/lib/visitor";

type SwipeItem = {
  profile: { id: string; handle: string };
  cvUrl: string;
};

type ApiBatch = { done: boolean; items: SwipeItem[] };

function normHandle(h: string) {
  const s = String(h || "").trim().replace(/^@/, "");
  return s ? `@${s}` : "@—";
}

export default function SwipePage() {
  const visitorId = useMemo(() => getOrCreateVisitorId(), []);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");
  const [deck, setDeck] = useState<SwipeItem[]>([]);
  const [done, setDone] = useState(false);

  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  // When a swipe is committed, we keep rendering the outgoing card on top
  // while we immediately reveal the next card underneath.
  const [outgoing, setOutgoing] = useState<{
    item: SwipeItem;
    x: number;
    tilt: number;
    overlay: "like" | "nope";
  } | null>(null);

  const startXRef = useRef<number | null>(null);

  const DECK_SIZE = 7;

  async function fetchBatch(excludeIds: string[], n = DECK_SIZE): Promise<ApiBatch> {
    const qp = new URLSearchParams();
    qp.set("visitorId", visitorId);
    qp.set("n", String(n));
    if (excludeIds.length) qp.set("excludeIds", excludeIds.join(","));
    const r = await fetch(`/api/swipe/batch?${qp.toString()}`);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j?.error || "Erreur chargement");
    }
    return (await r.json()) as ApiBatch;
  }

  async function prime() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetchBatch([], DECK_SIZE);
      if (!res.items.length) {
        setDone(true);
        setDeck([]);
        return;
      }
      setDeck(res.items);
      setDone(res.done);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function refillIfNeeded(nextDeck: SwipeItem[]) {
    if (done) return;
    if (nextDeck.length >= DECK_SIZE) return;
    try {
      const excludeIds = nextDeck.map((i) => i.profile.id);
      const res = await fetchBatch(excludeIds, DECK_SIZE - nextDeck.length);
      if (!res.items.length) {
        setDone(true);
        return;
      }
      setDeck((d) => {
        // d might have changed; merge carefully
        const curIds = new Set(d.map((i) => i.profile.id));
        const add = res.items.filter((i) => !curIds.has(i.profile.id));
        return [...d, ...add].slice(0, DECK_SIZE);
      });
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  async function sendVote(profileId: string, value: 1 | -1) {
    const r = await fetch("/api/vote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId, value, visitorId }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setMessage(j?.error || "Impossible d’enregistrer le vote.");
    }
  }

  const current = deck[0] ?? null;
  const second = deck[1] ?? null;
  const third = deck[2] ?? null;

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
      if (e.key === "ArrowRight") {
        commitSwipe(1, 1);
      }
      if (e.key === "ArrowLeft") {
        commitSwipe(-1, -1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, visitorId, deck, done]);

  const threshold = 120;
  const tilt = Math.max(-12, Math.min(12, dragX / 18));
  const overlay =
    dragX > 30 ? "like" : dragX < -30 ? "nope" : null;

  function commitSwipe(dir: 1 | -1, value: 1 | -1) {
    if (!current || outgoing) return;
    const x = window.innerWidth * 1.2 * dir;
    setOutgoing({
      item: current,
      x,
      tilt: dir === 1 ? Math.max(2, tilt) : Math.min(-2, tilt),
      overlay: dir === 1 ? "like" : "nope",
    });
    // Reset the interactive card so the next card doesn't inherit off-screen translateX.
    setDragX(0);
    startXRef.current = null;
    setDeck((d) => {
      const nextDeck = d.slice(1);
      void refillIfNeeded(nextDeck);
      if (nextDeck.length === 0) setDone(true);
      return nextDeck;
    });
    void sendVote(current.profile.id, value);
    window.setTimeout(() => setOutgoing(null), 220);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!current || outgoing) return;
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
      commitSwipe(1, 1);
    } else if (dragX < -threshold) {
      commitSwipe(-1, -1);
    } else {
      setDragX(0);
    }
    startXRef.current = null;
  }

  return (
    <div className="relative h-[100svh] w-full overflow-hidden">
      {message ? (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 px-3 pt-3">
          <div className="mx-auto flex max-w-xl justify-end">
            <div className="pointer-events-auto rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">
              {message}
            </div>
          </div>
        </div>
      ) : null}

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
        <div className="flex h-full items-center justify-center px-2 pb-24 pt-3">
          <div className="w-full max-w-xl">
            <div className="relative h-[72svh] md:h-[78svh]">
              {/* 3rd card (deepest) */}
              {third ? (
                <div className="absolute inset-0">
                  <div
                    className="h-full select-none rounded-2xl border border-zinc-200 bg-white shadow-sm"
                    style={{
                      transform: "scale(0.965) translateY(14px)",
                      filter: "brightness(0.99)",
                    }}
                  >
                    <div className="flex h-full flex-col overflow-hidden">
                      <div className="flex items-center justify-center border-b border-zinc-200 px-4 py-3">
                        <div className="text-sm font-black text-zinc-900 opacity-0">
                          @placeholder
                        </div>
                      </div>
                      <div className="min-h-0 flex-1 p-2">
                        <PdfPreview url={third.cvUrl} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* 2nd card */}
              {second ? (
                <div className="absolute inset-0">
                  <div
                    className="h-full select-none rounded-2xl border border-zinc-200 bg-white shadow-sm"
                    style={{
                      transform: "scale(0.985) translateY(6px)",
                      filter: "brightness(0.995)",
                    }}
                  >
                    <div className="flex h-full flex-col overflow-hidden">
                      <div className="flex items-center justify-center border-b border-zinc-200 px-4 py-3">
                        <div className="text-sm font-black text-zinc-900 opacity-0">
                          @placeholder
                        </div>
                      </div>
                      <div className="min-h-0 flex-1 p-2">
                        <PdfPreview url={second.cvUrl} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {outgoing ? (
                <div
                  className="absolute inset-0 select-none rounded-2xl border border-zinc-200 bg-white shadow-sm"
                  style={{
                    transform: `translateX(${outgoing.x}px) rotate(${outgoing.tilt}deg)`,
                    transitionProperty: "transform",
                    transitionDuration: "220ms",
                    transitionTimingFunction: "ease-out",
                    pointerEvents: "none",
                  }}
                >
                  <div className="flex h-full flex-col overflow-hidden">
                    <div className="flex items-center justify-center border-b border-zinc-200 px-4 py-3">
                      <div className="text-sm font-black text-zinc-900">
                        {normHandle(outgoing.item.profile.handle)}
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 p-2">
                      <PdfPreview url={outgoing.item.cvUrl} />
                    </div>
                  </div>
                  <div className="pointer-events-none absolute left-3 top-3">
                    <div
                      className={`rounded-lg border px-3 py-2 text-sm font-black uppercase tracking-wider ${
                        outgoing.overlay === "like"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-rose-300 bg-rose-50 text-rose-800"
                      }`}
                    >
                      {outgoing.overlay === "like" ? "LIKE" : "NOPE"}
                    </div>
                  </div>
                </div>
              ) : null}

              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="absolute inset-0 select-none rounded-2xl border border-zinc-200 bg-white shadow-sm"
                style={{
                  transform: `translateX(${dragX}px) rotate(${tilt}deg)`,
                  transitionProperty: "transform",
                  transitionDuration: dragging ? "200ms" : "160ms",
                  transitionTimingFunction: "ease-out",
                  touchAction: "none",
                  opacity: outgoing ? 0 : 1,
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

                <div className="flex h-full flex-col overflow-hidden">
                  <div className="flex items-center justify-center border-b border-zinc-200 px-4 py-3">
                    <div className="text-sm font-black text-zinc-900">
                      {normHandle(current.profile.handle)}
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 p-2">
                    <PdfPreview url={current.cvUrl} />
                  </div>
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
              onClick={() => {
                commitSwipe(-1, -1);
              }}
              className="rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-black text-zinc-900 hover:bg-zinc-100"
            >
              Dislike
            </button>
            <button
              onClick={() => {
                commitSwipe(1, 1);
              }}
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

