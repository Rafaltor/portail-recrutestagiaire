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
type StampKind = "approved" | "declined";
type StampImprint = { kind: StampKind; x: number; y: number };
type StampDragState = {
  kind: StampKind;
  pointerType: "mouse" | "touch";
  x: number;
  y: number;
  originX: number;
  originY: number;
  startPointerX: number;
  startPointerY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
  returning: boolean;
};

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
  const [loadError, setLoadError] = useState<string>("");
  const [deck, setDeck] = useState<SwipeItem[]>([]);
  const [done, setDone] = useState(false);
  const [hasLoadedProfiles, setHasLoadedProfiles] = useState(false);
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
    imprint: StampImprint | null;
  } | null>(null);
  const [stampDrag, setStampDrag] = useState<StampDragState | null>(null);
  const [stampImpact, setStampImpact] = useState<{
    kind: StampKind;
    x: number;
    y: number;
  } | null>(null);
  const [cardImprint, setCardImprint] = useState<StampImprint | null>(null);
  const [activeStampKind, setActiveStampKind] = useState<StampKind | null>(null);
  const [stampDropping, setStampDropping] = useState(false);

  const startXRef = useRef<number | null>(null);
  const cardDropRef = useRef<HTMLDivElement | null>(null);
  const stampDragRef = useRef<StampDragState | null>(null);
  const stampReturnTimerRef = useRef<number | null>(null);
  const stampImpactTimerRef = useRef<number | null>(null);
  const stampCommitTimerRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef(0);

  const DECK_SIZE = 7;
  const CONTROL_BAR_HEIGHT = 92;
  const PROFILE_FETCH_TIMEOUT_MS = 5000;
  const STAMP_DROP_DELAY_MS = 170;
  const STAMP_IMPACT_MS = 280;
  const STAMP_RETURN_MS = 180;
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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort("profile_fetch_timeout");
    }, PROFILE_FETCH_TIMEOUT_MS);
    try {
      const r = await fetch(`/api/swipe/batch?${qp.toString()}`, {
        signal: controller.signal,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "Erreur chargement");
      }
      return (await r.json()) as ApiBatch;
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error(
          "Chargement trop long (plus de 5 secondes). Vérifie ta connexion et réessaie.",
        );
      }
      throw e;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function prime() {
    setLoading(true);
    setMessage("");
    setLoadError("");
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
        setHasLoadedProfiles(false);
        return;
      }
      setDeck(res.items);
      setDone(res.done);
      setHasLoadedProfiles(true);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "Erreur inconnue";
      setLoadError(errMsg);
      setMessage(errMsg);
      setDeck([]);
      setDone(false);
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
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!alive || settled) return;
      settled = true;
      setSession(null);
      setIsConnected(false);
      setAuthReady(true);
    }, PROFILE_FETCH_TIMEOUT_MS);
    async function bootstrapAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive || settled) return;
        settled = true;
        window.clearTimeout(timeout);
        setSession(data.session ?? null);
        setIsConnected(!!data.session?.access_token);
        setAuthReady(true);
      } catch {
        if (!alive || settled) return;
        settled = true;
        window.clearTimeout(timeout);
        setSession(null);
        setIsConnected(false);
        setAuthReady(true);
      }
    }
    void bootstrapAuth();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      settled = true;
      window.clearTimeout(timeout);
      setSession(session);
      setIsConnected(!!session?.access_token);
      setAuthReady(true);
    });
    return () => {
      alive = false;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    setDone(false);
    setLoadError("");
    void prime();
    // prime intentionally depends on auth/session-derived state and reads live refs.
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

  // Route-scoped header/layout overrides for swipe only.
  useEffect(() => {
    document.documentElement.setAttribute("data-rs-swipe", "1");
    return () => {
      document.documentElement.removeAttribute("data-rs-swipe");
    };
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

  const threshold = 120;
  const tilt = Math.max(-12, Math.min(12, dragX / 18));
  const overlay =
    dragX > 30 ? "like" : dragX < -30 ? "nope" : null;

  function clearStampTimers() {
    if (stampReturnTimerRef.current) {
      window.clearTimeout(stampReturnTimerRef.current);
      stampReturnTimerRef.current = null;
    }
    if (stampImpactTimerRef.current) {
      window.clearTimeout(stampImpactTimerRef.current);
      stampImpactTimerRef.current = null;
    }
    if (stampCommitTimerRef.current) {
      window.clearTimeout(stampCommitTimerRef.current);
      stampCommitTimerRef.current = null;
    }
  }

  function resetStampDragState() {
    stampDragRef.current = null;
    setStampDrag(null);
    setActiveStampKind(null);
  }

  useEffect(() => {
    return () => {
      clearStampTimers();
    };
  }, []);

  function kindToVote(kind: StampKind) {
    return kind === "approved"
      ? ({ dir: 1 as const, value: 1 as const })
      : ({ dir: -1 as const, value: -1 as const });
  }

  function buildImprint(kind: StampKind, clientX: number, clientY: number) {
    const rect = cardDropRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const ratioX = (clientX - rect.left) / rect.width;
    const ratioY = (clientY - rect.top) / rect.height;
    const x = Math.max(8, Math.min(92, ratioX * 100));
    const y = Math.max(10, Math.min(92, ratioY * 100));
    return { kind, x, y } as StampImprint;
  }

  async function commitSwipe(
    dir: 1 | -1,
    value: 1 | -1,
    imprint: StampImprint | null = null,
  ) {
    if (!current || outgoing) return false;
    const voteOk = await sendVote(current.profile.id, value);
    if (!voteOk) return false;
    const x = window.innerWidth * 1.2 * dir;
    setOutgoing({
      item: current,
      x,
      tilt: dir === 1 ? Math.max(2, tilt) : Math.min(-2, tilt),
      overlay: dir === 1 ? "like" : "nope",
      imprint,
    });
    if (imprint) {
      setCardImprint(imprint);
    } else {
      setCardImprint(null);
    }
    // Reset the interactive card so the next card doesn't inherit off-screen translateX.
    setDragX(0);
    startXRef.current = null;
    setDeck((d) => {
      const nextDeck = d.slice(1);
      void refillIfNeeded(nextDeck);
      if (nextDeck.length === 0) setDone(true);
      return nextDeck;
    });
    window.setTimeout(() => {
      setOutgoing(null);
      setCardImprint(null);
      setStampDropping(false);
    }, 220);
    return true;
  }

  function returnStampClone() {
    const cur = stampDragRef.current;
    if (!cur) return;
    clearStampTimers();
    const next = {
      ...cur,
      x: cur.originX,
      y: cur.originY,
      returning: true,
    };
    stampDragRef.current = next;
    setStampDrag(next);
    stampReturnTimerRef.current = window.setTimeout(() => {
      resetStampDragState();
    }, STAMP_RETURN_MS);
  }

  function beginStampDrop(kind: StampKind, clientX: number, clientY: number) {
    if (!current || outgoing || stampDropping) {
      resetStampDragState();
      return;
    }
    clearStampTimers();
    resetStampDragState();
    setStampDropping(true);
    const imprint = buildImprint(kind, clientX, clientY);
    if (imprint) setCardImprint(imprint);
    setStampImpact({ kind, x: clientX, y: clientY });
    suppressClickUntilRef.current = Date.now() + 350;
    stampImpactTimerRef.current = window.setTimeout(() => {
      setStampImpact(null);
    }, STAMP_IMPACT_MS);
    stampCommitTimerRef.current = window.setTimeout(() => {
      const vote = kindToVote(kind);
      void commitSwipe(vote.dir, vote.value, imprint);
    }, STAMP_DROP_DELAY_MS);
  }

  function startStampDrag(
    kind: StampKind,
    pointerType: "mouse" | "touch",
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ) {
    if (!current || outgoing || stampDropping) return;
    clearStampTimers();
    const next: StampDragState = {
      kind,
      pointerType,
      x: rect.left,
      y: rect.top,
      originX: rect.left,
      originY: rect.top,
      startPointerX: clientX,
      startPointerY: clientY,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
      moved: false,
      returning: false,
    };
    stampDragRef.current = next;
    setStampDrag(next);
    setActiveStampKind(kind);
  }

  function updateDragPoint(clientX: number, clientY: number) {
    const cur = stampDragRef.current;
    if (!cur || cur.returning) return;
    const moved =
      cur.moved ||
      Math.abs(clientX - cur.startPointerX) > 5 ||
      Math.abs(clientY - cur.startPointerY) > 5;
    const next = {
      ...cur,
      x: clientX - cur.offsetX,
      y: clientY - cur.offsetY,
      moved,
    };
    stampDragRef.current = next;
    setStampDrag(next);
  }

  function endDragAt(clientX: number, clientY: number, source: "mouse" | "touch") {
    const cur = stampDragRef.current;
    if (!cur || cur.returning) return;
    if (cur.moved) {
      suppressClickUntilRef.current = Date.now() + 300;
    }
    const hit = document.elementFromPoint(clientX, clientY);
    const onCard = !!hit?.closest('[data-stamp-dropzone="1"]');
    if (onCard) {
      beginStampDrop(cur.kind, clientX, clientY);
      return;
    }
    // On touch, a quick tap acts as an alternative to drag.
    if (source === "touch" && !cur.moved) {
      const rect = cardDropRef.current?.getBoundingClientRect();
      if (!rect) {
        const vote = kindToVote(cur.kind);
        void commitSwipe(vote.dir, vote.value);
        resetStampDragState();
        return;
      }
      beginStampDrop(
        cur.kind,
        rect.left + rect.width / 2,
        rect.top + rect.height * 0.56,
      );
      return;
    }
    returnStampClone();
  }

  function handleStampMouseDown(
    e: React.MouseEvent<HTMLButtonElement>,
    kind: StampKind,
  ) {
    if (!current || outgoing || stampDropping) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    startStampDrag(kind, "mouse", e.clientX, e.clientY, rect);
  }

  function handleStampTouchStart(
    e: React.TouchEvent<HTMLButtonElement>,
    kind: StampKind,
  ) {
    if (!current || outgoing || stampDropping) return;
    const t = e.touches[0];
    if (!t) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    startStampDrag(kind, "touch", t.clientX, t.clientY, rect);
  }

  function handleStampClick(
    e: React.MouseEvent<HTMLButtonElement>,
    kind: StampKind,
  ) {
    e.preventDefault();
    clickStamp(kind);
  }

  useEffect(() => {
    if (!stampDrag || stampDrag.returning) return;
    function onMouseMove(e: MouseEvent) {
      const cur = stampDragRef.current;
      if (!cur || cur.pointerType !== "mouse") return;
      e.preventDefault();
      updateDragPoint(e.clientX, e.clientY);
    }
    function onMouseUp(e: MouseEvent) {
      const cur = stampDragRef.current;
      if (!cur || cur.pointerType !== "mouse") return;
      endDragAt(e.clientX, e.clientY, "mouse");
    }
    function onTouchMove(e: TouchEvent) {
      const cur = stampDragRef.current;
      if (!cur || cur.pointerType !== "touch") return;
      const t = e.touches[0];
      if (!t) return;
      e.preventDefault();
      updateDragPoint(t.clientX, t.clientY);
    }
    function onTouchEnd(e: TouchEvent) {
      const cur = stampDragRef.current;
      if (!cur || cur.pointerType !== "touch") return;
      const t = e.changedTouches[0];
      if (!t) return;
      endDragAt(t.clientX, t.clientY, "touch");
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
    // endDragAt/updateDragPoint rely on mutable refs; re-register only on stampDrag state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stampDrag]);

  function clickStamp(kind: StampKind) {
    if (Date.now() < suppressClickUntilRef.current) return;
    if (stampDragRef.current || stampDropping || !current || outgoing) return;
    const rect = cardDropRef.current?.getBoundingClientRect();
    if (!rect) {
      const vote = kindToVote(kind);
      void commitSwipe(vote.dir, vote.value);
      return;
    }
    beginStampDrop(
      kind,
      rect.left + rect.width / 2,
      rect.top + rect.height * 0.56,
    );
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!current || outgoing) return;
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

  return (
    <div className="relative h-[calc(100dvh-var(--rs-swipe-top-offset,72px))] w-full overflow-hidden">
      {message ? (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 px-3 pt-1">
          <div className="mx-auto flex max-w-xl justify-end">
            <div className="pointer-events-auto rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">
              {message}
            </div>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="flex h-full items-center justify-center px-6">
          <div className="w-full max-w-md rounded-lg border border-rose-200 bg-rose-50 p-6">
            <div className="text-lg font-black text-rose-900">Impossible de charger les profils</div>
            <p className="mt-2 text-sm text-rose-800">
              {loadError}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  void prime();
                }}
                className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100"
              >
                Réessayer
              </button>
              <a
                href="/depot"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Déposer un CV
              </a>
            </div>
          </div>
        </div>
      ) : !authReady || loading ? (
        <div className="flex h-full items-center justify-center px-6">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold text-zinc-800">
              {!authReady ? "Connexion à Supabase…" : "Chargement des profils…"}
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full w-1/3 animate-[swipeLoading_1.15s_ease-in-out_infinite] rounded-full bg-zinc-900" />
            </div>
          </div>
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
            <div className="text-lg font-black">
              {hasLoadedProfiles ? "C’est tout pour l’instant." : "Aucun profil pour l’instant, revenez bientôt."}
            </div>
            <p className="mt-2 text-sm text-zinc-700">
              {hasLoadedProfiles
                ? "Tu as voté sur tous les profils disponibles."
                : "Aucun CV publié n’est disponible pour le swipe actuellement."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {hasLoadedProfiles ? (
                <a
                  href="/profils"
                  className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-100"
                >
                  Voir les profils
                </a>
              ) : null}
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
        <div className="flex h-full items-start justify-center px-0 pb-0 pt-0">
          <div className="w-full">
            <div
              className="relative min-h-[360px] sm:min-h-[480px]"
              style={{ height: `calc(100% - ${CONTROL_BAR_HEIGHT}px)` }}
            >
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
                    <div className="h-full overflow-y-auto rounded-2xl p-0" data-cv-scroll>
                      <PdfPreview url={third.cvUrl} mode="fit-width" immersive />
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
                    <div className="h-full overflow-y-auto rounded-2xl p-0" data-cv-scroll>
                      <PdfPreview url={second.cvUrl} mode="fit-width" immersive />
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
                  <div className="h-full overflow-y-auto rounded-2xl p-0" data-cv-scroll>
                    <PdfPreview
                      url={outgoing.item.cvUrl}
                      mode="fit-width"
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
                  {outgoing.imprint ? (
                    <div
                      className="pointer-events-none absolute z-30"
                      style={{
                        left: `${outgoing.imprint.x * 100}%`,
                        top: `${outgoing.imprint.y * 100}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <div
                        className={`rounded-lg border-2 px-3 py-2 text-xs font-black uppercase tracking-wider opacity-95 ${
                          outgoing.imprint.kind === "approved"
                            ? "border-emerald-500 bg-emerald-100/85 text-emerald-800"
                            : "border-rose-500 bg-rose-100/85 text-rose-800"
                        }`}
                      >
                        {outgoing.imprint.kind === "approved" ? "APPROUVÉ" : "REFUSÉ"}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div
                ref={cardDropRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                data-stamp-dropzone="1"
                className="absolute inset-0 select-none rounded-2xl border border-zinc-200 bg-white shadow-sm"
                style={{
                  transform: `translateX(${dragX}px) rotate(${tilt}deg)`,
                  transitionProperty: "transform",
                  transitionDuration: dragging ? "200ms" : "160ms",
                  transitionTimingFunction: "ease-out",
                  touchAction: "pan-y",
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

                {cardImprint ? (
                  <div
                    className="pointer-events-none absolute z-30"
                    style={{
                      left: `${cardImprint.x * 100}%`,
                      top: `${cardImprint.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div
                      className={`rounded-lg border-2 px-3 py-2 text-xs font-black uppercase tracking-wider opacity-95 ${
                        cardImprint.kind === "approved"
                          ? "border-emerald-500 bg-emerald-100/85 text-emerald-800"
                          : "border-rose-500 bg-rose-100/85 text-rose-800"
                      }`}
                    >
                      {cardImprint.kind === "approved" ? "APPROUVÉ" : "REFUSÉ"}
                    </div>
                  </div>
                ) : null}

                <div className="h-full overflow-y-auto rounded-2xl p-0" data-cv-scroll>
                  <PdfPreview url={current.cvUrl} mode="fit-width" immersive />
                </div>
                <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-zinc-200/80 bg-white/92 px-3 py-1 text-xs font-black tracking-wide text-zinc-900 shadow-sm">
                  {normHandle(current.profile.handle)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!blockedByFreeLimit ? (
        <div className="fixed bottom-2 left-0 right-0 z-[10020] px-2 pb-[max(env(safe-area-inset-bottom),0px)]">
          <div className="mx-auto flex max-w-[980px] items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white/96 px-3 py-2 shadow-lg backdrop-blur-sm">
            <button
              data-stamp-source="declined"
              onMouseDown={(e) => {
                void handleStampMouseDown(e, "declined");
              }}
              onTouchStart={(e) => {
                void handleStampTouchStart(e, "declined");
              }}
              onClick={(e) => {
                void handleStampClick(e, "declined");
              }}
              className={`rounded-lg border-2 border-rose-300 bg-rose-50 px-4 py-2 text-[12px] font-black uppercase tracking-wider text-rose-800 shadow-sm transition-transform hover:bg-rose-100 ${
                activeStampKind === "declined" ? "opacity-45" : ""
              }`}
              style={{
                touchAction: "none",
                animation: stampDrag || stampDropping ? "none" : "stampWobble 1800ms ease-in-out infinite",
              }}
            >
              Refusé
            </button>
            <button
              data-stamp-source="approved"
              onMouseDown={(e) => {
                void handleStampMouseDown(e, "approved");
              }}
              onTouchStart={(e) => {
                void handleStampTouchStart(e, "approved");
              }}
              onClick={(e) => {
                void handleStampClick(e, "approved");
              }}
              className={`rounded-lg border-2 border-emerald-300 bg-emerald-50 px-4 py-2 text-[12px] font-black uppercase tracking-wider text-emerald-800 shadow-sm transition-transform hover:bg-emerald-100 ${
                activeStampKind === "approved" ? "opacity-45" : ""
              }`}
              style={{
                touchAction: "none",
                animation: stampDrag || stampDropping ? "none" : "stampWobble 1800ms ease-in-out infinite",
              }}
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
          className={`pointer-events-none fixed z-[10030] rounded-lg border px-3 py-2 text-sm font-black uppercase tracking-wider shadow-lg ${
            stampDrag.kind === "approved"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-rose-300 bg-rose-50 text-rose-800"
          }`}
          style={{
            left: 0,
            top: 0,
            transform: `translate(${stampDrag.x}px, ${stampDrag.y}px) ${
              stampDrag.returning ? "scale(0.96)" : "scale(1.02)"
            }`,
            transformOrigin: "center center",
            transition: stampDrag.returning
              ? `transform ${STAMP_RETURN_MS}ms cubic-bezier(0.18, 0.88, 0.3, 1)`
              : "none",
            boxShadow: stampDrag.returning
              ? "0 12px 24px rgba(0,0,0,0.14)"
              : "0 18px 30px rgba(0,0,0,0.24)",
          }}
        >
          {stampDrag.kind === "approved" ? "APPROUVÉ" : "REFUSÉ"}
        </div>
      ) : null}

      {stampImpact ? (
        <div
          className="pointer-events-none fixed z-[10035]"
          style={{
            left: `${stampImpact.x * 100}%`,
            top: `${stampImpact.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className={`rounded-lg border-2 px-3 py-2 text-sm font-black uppercase tracking-wider ${
              stampImpact.kind === "approved"
                ? "border-emerald-500 bg-emerald-100/90 text-emerald-800"
                : "border-rose-500 bg-rose-100/90 text-rose-800"
            }`}
            style={{
              animation: "stampImpact 280ms cubic-bezier(0.2, 1.15, 0.35, 1)",
            }}
          >
            {stampImpact.kind === "approved" ? "APPROUVÉ" : "REFUSÉ"}
          </div>
          <div
            className={`pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full ${
              stampImpact.kind === "approved"
                ? "bg-emerald-400/25"
                : "bg-rose-400/25"
            }`}
            style={{ animation: "stampInk 260ms ease-out" }}
          />
        </div>
      ) : null}

      <style jsx>{`
        @keyframes stampWobble {
          0%,
          100% {
            transform: rotate(-2.5deg);
          }
          50% {
            transform: rotate(2.5deg);
          }
        }
        @keyframes stampImpact {
          0% {
            transform: scale(1.06, 0.94);
          }
          45% {
            transform: scale(0.86, 1.18);
          }
          100% {
            transform: scale(1, 1);
          }
        }
        @keyframes stampInk {
          0% {
            opacity: 0.45;
            transform: translate(-50%, -50%) scale(0.2);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.35);
          }
        }
        @keyframes swipeLoading {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(320%);
          }
        }
      `}</style>
    </div>
  );
}

