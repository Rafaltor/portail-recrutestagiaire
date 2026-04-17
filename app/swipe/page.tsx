"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PdfPreview from "@/components/PdfPreview";
import { getOrCreateVisitorId } from "@/lib/visitor";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  AUTH_LIKES_PER_DAY,
  FREE_SWIPE_LIMIT,
  dayKeyUTC,
  getLikesDayKey,
  getSwipeCountKey,
  readLocalInt,
  writeLocalInt,
} from "@/lib/swipe-gating";

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
  const [session, setSession] = useState<Session | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");
  const [deck, setDeck] = useState<SwipeItem[]>([]);
  const [done, setDone] = useState(false);
  const [blockedByFreeLimit, setBlockedByFreeLimit] = useState(false);
  const [freeSwipesUsed, setFreeSwipesUsed] = useState(0);
  const [likesToday, setLikesToday] = useState(0);

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
  const [stampDrag, setStampDrag] = useState<{
    kind: "approved" | "declined";
    x: number;
    y: number;
  } | null>(null);

  const startXRef = useRef<number | null>(null);
  const cardDropRef = useRef<HTMLDivElement | null>(null);

  const DECK_SIZE = 7;
  const swipeCountKey = useMemo(() => getSwipeCountKey(visitorId), [visitorId]);
  const likesDayKey = useMemo(
    () => getLikesDayKey(visitorId, dayKeyUTC()),
    [visitorId],
  );

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
    if (!isConnected) {
      const used = readLocalInt(swipeCountKey);
      setFreeSwipesUsed(used);
      if (used >= FREE_SWIPE_LIMIT) {
        setBlockedByFreeLimit(true);
        setDeck([]);
        setDone(true);
        setLoading(false);
        return;
      }
      setBlockedByFreeLimit(false);
    }
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
    if (isConnected && value === 1) {
      const currentLikes = readLocalInt(likesDayKey);
      setLikesToday(currentLikes);
      if (currentLikes >= AUTH_LIKES_PER_DAY) {
        setMessage("Limite atteinte: 10 likes par jour. Réessaie demain.");
        return false;
      }
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const r = await fetch("/api/vote", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(session?.access_token
          ? { authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      body: JSON.stringify({ profileId, value, visitorId }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setMessage(j?.error || "Impossible d’enregistrer le vote.");
      return false;
    }
    if (!isConnected) {
      const next = readLocalInt(swipeCountKey) + 1;
      writeLocalInt(swipeCountKey, next);
      setFreeSwipesUsed(next);
      if (next >= FREE_SWIPE_LIMIT) {
        setBlockedByFreeLimit(true);
      }
    } else if (value === 1) {
      const nextLikes = readLocalInt(likesDayKey) + 1;
      writeLocalInt(likesDayKey, nextLikes);
      setLikesToday(nextLikes);
    }
    return true;
  }

  const current = deck[0] ?? null;
  const second = deck[1] ?? null;
  const third = deck[2] ?? null;

  useEffect(() => {
    let alive = true;
    async function bootstrapAuth() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data.session ?? null);
      setIsConnected(!!data.session?.access_token);
      setAuthReady(true);
    }
    void bootstrapAuth();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsConnected(!!session?.access_token);
      setAuthReady(true);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    setDone(false);
    void prime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, isConnected, visitorId]);

  useEffect(() => {
    if (!session?.access_token) return;
    const bearer = session.access_token;
    let alive = true;
    async function linkVisitor() {
      await fetch("/api/account/link-visitor", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({ visitorId }),
      }).catch(() => null);
      if (!alive) return;
    }
    void linkVisitor();
    return () => {
      alive = false;
    };
  }, [session?.access_token, visitorId]);

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
        void commitSwipe(1, 1);
      }
      if (e.key === "ArrowLeft") {
        void commitSwipe(-1, -1);
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

  useEffect(() => {
    if (!stampDrag) return;
    function onMove(e: PointerEvent) {
      setStampDrag((s) => (s ? { ...s, x: e.clientX, y: e.clientY } : s));
    }
    function onUp(e: PointerEvent) {
      const dropRect = cardDropRef.current?.getBoundingClientRect();
      const insideCard = dropRect
        ? e.clientX >= dropRect.left &&
          e.clientX <= dropRect.right &&
          e.clientY >= dropRect.top &&
          e.clientY <= dropRect.bottom
        : false;
      const dragged = stampDrag;
      setStampDrag(null);
      if (!dragged) return;
      if (!insideCard) return;
      if (!current || outgoing) return;
      if (dragged.kind === "approved") {
        void commitSwipe(1, 1);
      } else {
        void commitSwipe(-1, -1);
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stampDrag, current, outgoing]);

  async function commitSwipe(dir: 1 | -1, value: 1 | -1) {
    if (!current || outgoing) return;
    const voteOk = await sendVote(current.profile.id, value);
    if (!voteOk) return;
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
      void commitSwipe(1, 1);
    } else if (dragX < -threshold) {
      void commitSwipe(-1, -1);
    } else {
      setDragX(0);
    }
    startXRef.current = null;
  }

  if (!authReady) {
    return (
      <div className="relative h-[calc(100dvh-4px)] w-full overflow-hidden">
        <div className="flex h-full items-center justify-center px-6 text-sm text-zinc-700">
          Chargement…
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-4px)] w-full overflow-hidden">
      {message ? (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 px-3 pt-1">
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
      ) : blockedByFreeLimit ? (
        <div className="flex h-full items-center justify-center px-6">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6">
            <div className="text-lg font-black">
              Créez un compte pour continuer à voter et débloquer les récompenses.
            </div>
            <p className="mt-2 text-sm text-zinc-700">
              Tu as utilisé {freeSwipesUsed} swipes gratuits sur {FREE_SWIPE_LIMIT}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="/connexion"
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-100"
              >
                Se connecter / créer un compte
              </a>
              <a
                href="/mon-espace"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Ouvrir mon espace
              </a>
            </div>
          </div>
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
        <div className="flex h-full items-start justify-center px-0 pb-24 pt-0">
          <div className="w-full">
            <div className="relative h-[calc(100dvh-10.25rem)] min-h-[420px] sm:min-h-[520px]">
              {/* 3rd card (deepest) */}
              {third ? (
                <div className="absolute inset-0">
                  <div
                    className="h-full select-none rounded-2xl border border-zinc-200 bg-white shadow-sm"
                    style={{
                      transform: "scale(0.97) translateY(12px)",
                      filter: "brightness(0.99)",
                    }}
                  >
                    <div className="h-full overflow-hidden rounded-2xl p-0">
                      <PdfPreview url={third.cvUrl} mode="cover-height" immersive />
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
                      transform: "scale(0.988) translateY(5px)",
                      filter: "brightness(0.995)",
                    }}
                  >
                    <div className="h-full overflow-hidden rounded-2xl p-0">
                      <PdfPreview url={second.cvUrl} mode="cover-height" immersive />
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
                  <div className="h-full overflow-hidden rounded-2xl p-0">
                    <PdfPreview
                      url={outgoing.item.cvUrl}
                      mode="cover-height"
                      immersive
                    />
                  </div>
                  <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-zinc-200/80 bg-white/92 px-3 py-1 text-xs font-black tracking-wide text-zinc-900 shadow-sm">
                    {normHandle(outgoing.item.profile.handle)}
                  </div>
                  <div className="pointer-events-none absolute left-3 top-3">
                    <div
                      className={`rounded-lg border px-3 py-2 text-sm font-black uppercase tracking-wider ${
                        outgoing.overlay === "like"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-rose-300 bg-rose-50 text-rose-800"
                      }`}
                    >
                      {outgoing.overlay === "like" ? "APPROUVÉ" : "REFUSÉ"}
                    </div>
                  </div>
                </div>
              ) : null}

              <div
                ref={cardDropRef}
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
                      {overlay === "like" ? "APPROUVÉ" : "REFUSÉ"}
                    </div>
                  </div>
                ) : null}

                <div className="h-full overflow-hidden rounded-2xl p-0">
                  <PdfPreview url={current.cvUrl} mode="cover-height" immersive />
                </div>
                <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-zinc-200/80 bg-white/92 px-3 py-1 text-xs font-black tracking-wide text-zinc-900 shadow-sm">
                  {normHandle(current.profile.handle)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !done && current ? (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-3">
          <div className="mx-auto flex max-w-xl items-center justify-center gap-3">
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                setStampDrag({
                  kind: "declined",
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
              onClick={() => {
                void commitSwipe(-1, -1);
              }}
              className="rounded-lg border-2 border-rose-300 bg-rose-50 px-4 py-2 text-sm font-black uppercase tracking-wider text-rose-800 shadow-sm hover:bg-rose-100"
            >
              Refusé
            </button>
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                setStampDrag({
                  kind: "approved",
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
              onClick={() => {
                void commitSwipe(1, 1);
              }}
              className="rounded-lg border-2 border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-black uppercase tracking-wider text-emerald-800 shadow-sm hover:bg-emerald-100"
            >
              Approuvé
            </button>
          </div>
          <div className="mt-1 text-center text-[11px] font-semibold text-zinc-600">
            Glisse un tampon sur la carte ou swipe gauche/droite.
          </div>
          {isConnected ? (
            <div className="mt-1 text-center text-xs text-zinc-700">
              Likes aujourd&apos;hui: {likesToday}/{AUTH_LIKES_PER_DAY}
            </div>
          ) : null}
        </div>
      ) : null}

      {stampDrag ? (
        <div
          className={`pointer-events-none absolute z-30 rounded-lg border px-3 py-2 text-sm font-black uppercase tracking-wider shadow-lg ${
            stampDrag.kind === "approved"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-rose-300 bg-rose-50 text-rose-800"
          }`}
          style={{
            transform: `translate(${stampDrag.x - 54}px, ${stampDrag.y - 22}px)`,
          }}
        >
          {stampDrag.kind === "approved" ? "APPROUVÉ" : "REFUSÉ"}
        </div>
      ) : null}
    </div>
  );
}

