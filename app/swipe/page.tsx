"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
type PendingTransition = {
  kind: StampKind;
  imprint: StampImprint;
};
type SwipeRelease = { x: number; tilt: number };

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

function stampLabel(kind: StampKind) {
  return kind === "approved" ? "APPROUVÉ" : "REFUSÉ";
}

function StampVisual({
  kind,
  floating = false,
  muted = false,
}: {
  kind: StampKind;
  floating?: boolean;
  muted?: boolean;
}) {
  const label = stampLabel(kind);
  const kindClass = kind === "approved" ? "rs-stamp--approved" : "rs-stamp--declined";
  return (
    <div className={`rs-stamp ${kindClass} ${floating ? "rs-stamp--floating" : ""} ${muted ? "opacity-45" : ""}`}>
      <span className="rs-stamp__label">{label}</span>
    </div>
  );
}

function StampImprintVisual({ kind }: { kind: StampKind }) {
  const label = stampLabel(kind);
  const kindClass = kind === "approved" ? "rs-imprint--approved" : "rs-imprint--declined";
  return (
    <div className={`rs-imprint ${kindClass}`}>
      <span className="rs-imprint__text">{label}</span>
    </div>
  );
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
  const [nextCardLoading, setNextCardLoading] = useState(false);
  const [nextAppearing, setNextAppearing] = useState(false);
  const [blockedByFreeLimit, setBlockedByFreeLimit] = useState(false);
  const [freeSwipesUsed, setFreeSwipesUsed] = useState(0);
  const [likesToday, setLikesToday] = useState(0);

  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  // When a swipe is committed, we keep rendering the outgoing card on top
  // while we immediately reveal the next card underneath.
  const [outgoing, setOutgoing] = useState<{
    item: SwipeItem;
    dir: 1 | -1;
    overlay: "like" | "nope";
    imprint: StampImprint | null;
    /** Pixel offset / tilt when committing a drag (avoids snap-to-center before exit). */
    exitStartX: number;
    exitStartTilt: number;
    exitDurationMs: number;
    /** After mount, set true on next frames so transform transitions from center (correct left/right slide). */
    slideOut: boolean;
  } | null>(null);
  const [stampDrag, setStampDrag] = useState<StampDragState | null>(null);
  const [stampImpact, setStampImpact] = useState<{
    kind: StampKind;
    x: number;
    y: number;
  } | null>(null);
  const [cardImprint, setCardImprint] = useState<StampImprint | null>(null);
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const [activeStampKind, setActiveStampKind] = useState<StampKind | null>(null);
  const [stampDropping, setStampDropping] = useState(false);

  const startXRef = useRef<number | null>(null);
  const cardDropRef = useRef<HTMLDivElement | null>(null);
  const stampDragRef = useRef<StampDragState | null>(null);
  const stampReturnTimerRef = useRef<number | null>(null);
  const stampImpactTimerRef = useRef<number | null>(null);
  const stampCommitTimerRef = useRef<number | null>(null);
  const imprintHoldTimerRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef(0);
  const refillInFlightRef = useRef(false);
  const transitionInFlightRef = useRef(false);
  const sheetMeasureRef = useRef<HTMLDivElement | null>(null);
  const [sheetSize, setSheetSize] = useState({ w: 320, h: 453 });

  const desktopSwipeLayout = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () =>
      typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false,
    () => false,
  );

  const DECK_SIZE = 7;
  const PROFILE_FETCH_TIMEOUT_MS = 5000;
  const STAMP_DROP_DELAY_MS = 48;
  const STAMP_IMPACT_MS = 140;
  const STAMP_IMPRINT_HOLD_MS = 280;
  const CARD_TRANSITION_MS = 240;
  /** Swipe commit: snappier exit off-screen (full viewport). */
  const SWIPE_EXIT_MS = 200;
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
    setNextCardLoading(false);
    setNextAppearing(false);
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
      const firstBatch = await fetchBatch([], 1);
      const first = firstBatch.items[0] ?? null;
      if (!first) {
        setDone(true);
        setDeck([]);
        setHasLoadedProfiles(false);
        return;
      }
      setDeck([first]);
      setDone(false);
      setHasLoadedProfiles(true);
      setLoading(false);
      void refillIfNeeded([first]);
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
    if (refillInFlightRef.current) return;
    if (done) return;
    if (nextDeck.length >= DECK_SIZE) return;
    refillInFlightRef.current = true;
    setNextCardLoading(true);
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
    } finally {
      refillInFlightRef.current = false;
      setNextCardLoading(false);
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
  const showNextLoader = !!current && !second && nextCardLoading;

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

  useLayoutEffect(() => {
    const el = sheetMeasureRef.current;
    if (!el) return undefined;
    function measure() {
      const node = sheetMeasureRef.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      const desktop =
        typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

      if (desktop) {
        const padX = 16;
        const padY = 12;
        const availW = Math.max(0, r.width - padX * 2);
        const availH = Math.max(0, r.height - padY * 2);
        const vw = window.innerWidth || r.width;
        const halfScreen = Math.floor(vw * 0.5);
        const w = Math.min(availW, halfScreen);
        const nw = Math.max(320, Math.floor(w));
        const nh = nw;
        setSheetSize((prev) => (prev.w === nw && prev.h === nh ? prev : { w: nw, h: nh }));
        return;
      }

      const padX = 0;
      const padY = 8;
      const availW = Math.max(0, r.width - padX * 2);
      const availH = Math.max(0, r.height - padY * 2);
      const a = 210;
      const b = 297;
      const w = availW;
      const hIdeal = (w * b) / a;
      const h = Math.min(availH, hIdeal);
      const nw = Math.max(200, Math.floor(w));
      const nh = Math.max(220, Math.floor(h));
      setSheetSize((prev) => (prev.w === nw && prev.h === nh ? prev : { w: nw, h: nh }));
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [desktopSwipeLayout]);

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

  function buildImprint(kind: StampKind, clientX: number, clientY: number) {
    const rect = cardDropRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const ratioX = (clientX - rect.left) / rect.width;
    const ratioY = (clientY - rect.top) / rect.height;
    const x = Math.max(8, Math.min(92, ratioX * 100));
    const y = Math.max(10, Math.min(92, ratioY * 100));
    return { kind, x, y } as StampImprint;
  }

  function consumeTopAndRefill() {
    setDeck((d) => {
      const nextDeck = d.slice(1);
      setDone(nextDeck.length === 0);
      void refillIfNeeded(nextDeck);
      return nextDeck;
    });
  }

  async function applyTransitionVote(
    kind: StampKind,
    value: 1 | -1,
    imprint: StampImprint | null,
    holdImprintMs: number,
    swipeRelease: SwipeRelease | null = null,
  ) {
    if (!current || outgoing || transitionInFlightRef.current) return;

    const resolvedImprint =
      imprint ??
      ({
        kind,
        x: kind === "approved" ? 24 : 76,
        y: 56,
      } as StampImprint);

    const swipeFast = holdImprintMs === 0 && swipeRelease !== null;

    if (swipeFast) {
      transitionInFlightRef.current = true;
      const profileId = current.profile.id;
      const item = current;

      setPendingTransition({ kind, imprint: resolvedImprint });
      setCardImprint(resolvedImprint);
      setNextAppearing(true);
      setOutgoing({
        item,
        dir: value,
        overlay: value === 1 ? "like" : "nope",
        imprint: resolvedImprint,
        exitStartX: swipeRelease.x,
        exitStartTilt: swipeRelease.tilt,
        exitDurationMs: SWIPE_EXIT_MS,
        slideOut: false,
      });
      setDragX(0);
      startXRef.current = null;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOutgoing((o) =>
            o && o.item.profile.id === profileId
              ? { ...o, slideOut: true, exitDurationMs: SWIPE_EXIT_MS }
              : o,
          );
        });
      });

      const voteOk = await sendVote(profileId, value);
      if (!voteOk) {
        setOutgoing(null);
        setPendingTransition(null);
        setCardImprint(null);
        setNextAppearing(false);
        transitionInFlightRef.current = false;
        return;
      }

      consumeTopAndRefill();
      window.setTimeout(() => {
        setOutgoing(null);
        setPendingTransition(null);
        setCardImprint(null);
        setStampDropping(false);
        setNextAppearing(false);
        transitionInFlightRef.current = false;
      }, SWIPE_EXIT_MS + 40);
      return;
    }

    transitionInFlightRef.current = true;
    const voteOk = await sendVote(current.profile.id, value);
    if (!voteOk) {
      setPendingTransition(null);
      setCardImprint(null);
      setStampDropping(false);
      transitionInFlightRef.current = false;
      return;
    }

    setPendingTransition({ kind, imprint: resolvedImprint });
    setCardImprint(resolvedImprint);
    if (holdImprintMs > 0) {
      setDragX(0);
      startXRef.current = null;
    }
    setNextAppearing(true);

    if (imprintHoldTimerRef.current) {
      window.clearTimeout(imprintHoldTimerRef.current);
      imprintHoldTimerRef.current = null;
    }

    imprintHoldTimerRef.current = window.setTimeout(() => {
      const dir: 1 | -1 = value;
      const votedProfileId = current.profile.id;
      const exitStartX = holdImprintMs > 0 ? 0 : swipeRelease?.x ?? 0;
      const exitStartTilt = holdImprintMs > 0 ? 0 : swipeRelease?.tilt ?? 0;
      setOutgoing({
        item: current,
        dir,
        overlay: value === 1 ? "like" : "nope",
        imprint: resolvedImprint,
        exitStartX,
        exitStartTilt,
        exitDurationMs: CARD_TRANSITION_MS,
        slideOut: false,
      });
      if (holdImprintMs === 0) {
        setDragX(0);
        startXRef.current = null;
      }
      consumeTopAndRefill();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOutgoing((o) =>
            o && o.item.profile.id === votedProfileId
              ? { ...o, slideOut: true, exitDurationMs: CARD_TRANSITION_MS }
              : o,
          );
        });
      });
      window.setTimeout(() => {
        setOutgoing(null);
        setPendingTransition(null);
        setCardImprint(null);
        setStampDropping(false);
        setNextAppearing(false);
        transitionInFlightRef.current = false;
      }, CARD_TRANSITION_MS + 48);
    }, holdImprintMs);
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
    if (!imprint) {
      const fallbackImprint: StampImprint = {
        kind,
        x: kind === "approved" ? 24 : 76,
        y: 56,
      };
      const vote = kind === "approved" ? 1 : -1;
      void applyTransitionVote(kind, vote, fallbackImprint, STAMP_IMPRINT_HOLD_MS);
      return;
    }
    setCardImprint(imprint);
    setStampImpact({ kind, x: clientX, y: clientY });
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(24);
    }
    suppressClickUntilRef.current = Date.now() + 350;
    stampImpactTimerRef.current = window.setTimeout(() => {
      setStampImpact(null);
    }, STAMP_IMPACT_MS);
    stampCommitTimerRef.current = window.setTimeout(() => {
      const vote = kind === "approved" ? 1 : -1;
      void applyTransitionVote(kind, vote, imprint, STAMP_IMPRINT_HOLD_MS);
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
        const fallbackImprint: StampImprint = {
          kind: cur.kind,
          x: cur.kind === "approved" ? 24 : 76,
          y: 56,
        };
        const vote = cur.kind === "approved" ? 1 : -1;
        void applyTransitionVote(cur.kind, vote, fallbackImprint, 0);
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
      const vote = kind === "approved" ? 1 : -1;
      void applyTransitionVote(kind, vote, null, STAMP_IMPRINT_HOLD_MS);
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
    const dx = dragX;
    const releaseTilt = Math.max(-12, Math.min(12, dx / 18));
    if (dx > threshold) {
      const fallbackImprint: StampImprint = { kind: "approved", x: 24, y: 56 };
      void applyTransitionVote("approved", 1, fallbackImprint, 0, { x: dx, tilt: releaseTilt });
    } else if (dx < -threshold) {
      const fallbackImprint: StampImprint = { kind: "declined", x: 76, y: 56 };
      void applyTransitionVote("declined", -1, fallbackImprint, 0, { x: dx, tilt: releaseTilt });
    } else {
      setDragX(0);
    }
    startXRef.current = null;
  }

  const swipeChromeHeight =
    "calc(100dvh - var(--rs-swipe-top-offset, 96px) - var(--rs-swipe-bottom-chrome, 128px))";

  return (
    <div
      ref={sheetMeasureRef}
      className={`rs-swipe-page-root relative flex w-full flex-col overscroll-y-contain ${
        desktopSwipeLayout ? "min-h-0 overflow-x-visible overflow-y-visible" : "overflow-hidden"
      }`}
      style={
        desktopSwipeLayout
          ? { minHeight: swipeChromeHeight }
          : { height: swipeChromeHeight }
      }
    >
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
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
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
      ) : !authReady || (loading && !current) ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
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
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
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
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
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
        <div
          className={`flex flex-col items-stretch justify-stretch px-0 pb-0 pt-0 ${
            desktopSwipeLayout ? "shrink-0 py-3" : "min-h-0 flex-1"
          }`}
        >
          <div
            dir="ltr"
            className={`flex items-center justify-center py-2 max-md:px-0 md:px-4 md:py-4 ${
              desktopSwipeLayout ? "min-h-0" : "min-h-0 flex-1"
            }`}
          >
            <div
              className="relative shrink-0"
              style={{
                width: sheetSize.w,
                height: sheetSize.h,
              }}
            >
              {showNextLoader ? (
                <div className="pointer-events-none absolute -right-1 -top-1 z-20 sm:right-0 sm:top-0">
                  <div className="h-7 w-7 rounded-full border-2 border-zinc-300 border-t-zinc-700 opacity-80 animate-spin" />
                </div>
              ) : null}
              {/* 3rd sheet (bottom of stack) */}
              {third ? (
                <div className="pointer-events-none absolute inset-0">
                  <div
                    className="h-full w-full select-none overflow-hidden rounded-none border border-zinc-300/90 bg-[#fbfbf9] shadow-[0_1px_0_rgba(0,0,0,0.05),0_14px_28px_-10px_rgba(0,0,0,0.2)]"
                    style={{
                      transform: "translate(-7px, 12px) rotate(-2deg) scale(0.91)",
                      transformOrigin: "50% 100%",
                      filter: "brightness(0.96)",
                    }}
                  >
                    <div className="h-full min-h-0 w-full overflow-hidden rounded-none">
                      <PdfPreview
                        key={third.profile.id}
                        url={third.cvUrl}
                        mode="fit-page"
                        immersive
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* 2nd sheet */}
              {second ? (
                <div className="pointer-events-none absolute inset-0">
                  <div
                    className="h-full w-full select-none overflow-hidden rounded-none border border-zinc-300/90 bg-[#fcfcfa] shadow-[0_1px_0_rgba(0,0,0,0.05),0_18px_36px_-12px_rgba(0,0,0,0.22)]"
                    style={{
                      transform:
                        pendingTransition && !outgoing
                          ? "translate(0px, 0px) rotate(0deg) scale(1)"
                          : "translate(5px, 6px) rotate(1.2deg) scale(0.955)",
                      transformOrigin: "50% 100%",
                      transitionProperty: "transform",
                      transitionDuration: `${CARD_TRANSITION_MS}ms`,
                      transitionTimingFunction: "ease-out",
                      filter: "brightness(0.98)",
                    }}
                  >
                    <div className="h-full min-h-0 w-full overflow-hidden rounded-none">
                      <PdfPreview
                        key={second.profile.id}
                        url={second.cvUrl}
                        mode="fit-page"
                        immersive
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {outgoing ? (
                <div
                  className="absolute inset-0 z-[15] select-none overflow-hidden rounded-none border border-zinc-300/90 bg-[#fdfdfb] shadow-[0_1px_0_rgba(0,0,0,0.06),0_22px_48px_-14px_rgba(0,0,0,0.26)]"
                  style={{
                    transform: outgoing.slideOut
                      ? `translateX(${
                          outgoing.dir > 0 ? "calc(50vw + 50%)" : "calc(-50vw - 50%)"
                        }) rotate(${outgoing.exitStartTilt}deg)`
                      : `translateX(${outgoing.exitStartX}px) rotate(${outgoing.exitStartTilt}deg)`,
                    transitionProperty: "transform",
                    transitionDuration: outgoing.slideOut
                      ? `${outgoing.exitDurationMs}ms`
                      : "0ms",
                    transitionTimingFunction: "ease-out",
                    pointerEvents: "none",
                  }}
                >
                  <div className="h-full min-h-0 w-full overflow-hidden rounded-none">
                    <PdfPreview
                      key={outgoing.item.profile.id}
                      url={outgoing.item.cvUrl}
                      mode="fit-page"
                      immersive
                    />
                  </div>
                  <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full border border-zinc-200/80 bg-white/92 px-2.5 py-0.5 text-[11px] font-black tracking-wide text-zinc-900 shadow-sm sm:top-2.5 sm:px-3 sm:text-xs">
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
                      <StampImprintVisual kind={outgoing.imprint.kind} />
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
                className="absolute inset-0 z-[20] select-none overflow-hidden rounded-none border border-zinc-300/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06),0_24px_52px_-14px_rgba(0,0,0,0.28)]"
                style={{
                  transform: `translateX(${dragX}px) rotate(${tilt}deg) scale(${
                    outgoing ? 1 : nextAppearing && !dragging ? 0.97 : 1
                  })`,
                  transitionProperty: "transform",
                  transitionDuration: dragging ? "200ms" : `${CARD_TRANSITION_MS}ms`,
                  transitionTimingFunction: "ease-out",
                  touchAction: "none",
                  opacity: outgoing ? 0 : 1,
                  transformOrigin: "center center",
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
                    <StampImprintVisual kind={cardImprint.kind} />
                  </div>
                ) : null}

                <div className="h-full min-h-0 w-full overflow-hidden rounded-none">
                  <PdfPreview
                    key={current.profile.id}
                    url={current.cvUrl}
                    mode="fit-page"
                    immersive
                  />
                </div>
                <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full border border-zinc-200/80 bg-white/92 px-2.5 py-0.5 text-[11px] font-black tracking-wide text-zinc-900 shadow-sm sm:top-2.5 sm:px-3 sm:text-xs">
                  {normHandle(current.profile.handle)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!blockedByFreeLimit ? (
        <div className="fixed bottom-2 left-0 right-0 z-[9000] px-2 pb-[max(env(safe-area-inset-bottom),0px)]">
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
              className={`rounded-lg border-2 border-transparent bg-transparent p-0 shadow-none transition-transform ${
                activeStampKind === "declined" ? "opacity-45" : ""
              }`}
              style={{
                touchAction: "none",
                animation: stampDrag || stampDropping ? "none" : "stampWobble 1800ms ease-in-out infinite",
              }}
            >
              <StampVisual kind="declined" muted={activeStampKind === "declined"} />
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
              className={`rounded-lg border-2 border-transparent bg-transparent p-0 shadow-none transition-transform ${
                activeStampKind === "approved" ? "opacity-45" : ""
              }`}
              style={{
                touchAction: "none",
                animation: stampDrag || stampDropping ? "none" : "stampWobble 1800ms ease-in-out infinite",
              }}
            >
              <StampVisual kind="approved" muted={activeStampKind === "approved"} />
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
          className="pointer-events-none fixed z-[9600]"
          style={{
            left: 0,
            top: 0,
            transform: `translate(${stampDrag.x}px, ${stampDrag.y}px) ${
              stampDrag.returning ? "scale(0.95)" : "scale(1.06)"
            }`,
            transformOrigin: "center center",
            transition: stampDrag.returning
              ? `transform ${STAMP_RETURN_MS}ms cubic-bezier(0.18, 0.88, 0.3, 1)`
              : "none",
            filter: stampDrag.returning
              ? "drop-shadow(0 12px 24px rgba(0,0,0,0.14))"
              : "drop-shadow(0 18px 30px rgba(0,0,0,0.24))",
          }}
        >
          <StampVisual kind={stampDrag.kind} floating />
        </div>
      ) : null}

      {stampImpact ? (
        <div
          className="pointer-events-none fixed z-[9650]"
          style={{
            left: `${stampImpact.x}px`,
            top: `${stampImpact.y}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div style={{ animation: "stampDrop 240ms cubic-bezier(0.2, 1.15, 0.35, 1)" }}>
            <StampVisual kind={stampImpact.kind} />
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
        .rs-stamp {
          position: relative;
          width: 150px;
          height: 74px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          user-select: none;
          border-radius: 999px;
          border: 2px solid #27272a;
          background: linear-gradient(180deg, #fafafa 0%, #d4d4d8 100%);
          box-shadow:
            inset 0 2px 0 rgba(255, 255, 255, 0.9),
            inset 0 -3px 6px rgba(0, 0, 0, 0.18),
            0 10px 22px rgba(0, 0, 0, 0.12);
        }
        .rs-stamp__label {
          display: inline-block;
          border: 2px solid currentColor;
          border-radius: 10px;
          padding: 6px 12px;
          font-size: 14px;
          font-family: "Arial Black", Impact, sans-serif;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          opacity: 0.98;
        }
        .rs-stamp--approved {
          color: #047857;
        }
        .rs-stamp--approved .rs-stamp__label {
          transform: rotate(-14deg);
          text-shadow: 0 0 0.4px rgba(5, 120, 90, 0.9), 0 0 2px rgba(5, 120, 90, 0.68);
        }
        .rs-stamp--declined {
          color: #be123c;
        }
        .rs-stamp--declined .rs-stamp__label {
          transform: rotate(14deg);
          text-shadow: 0 0 0.4px rgba(170, 28, 44, 0.92), 0 0 2px rgba(170, 28, 44, 0.66);
        }
        .rs-stamp--floating {
          transform: scale(1.05);
        }

        .rs-imprint {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 2px solid currentColor;
          border-radius: 8px;
          padding: 6px 14px;
          background: rgba(255, 255, 255, 0.25);
          opacity: 0.85;
          pointer-events: none;
          user-select: none;
        }
        .rs-imprint__text {
          font-family: "Arial Black", Impact, sans-serif;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-size: 15px;
          line-height: 1;
        }
        .rs-imprint--approved {
          color: #047857;
          background: rgba(6, 120, 86, 0.16);
          transform: rotate(-12deg);
          text-shadow: 0 0 0.4px rgba(5, 120, 90, 0.9), 0 0 2px rgba(5, 120, 90, 0.62);
        }
        .rs-imprint--declined {
          color: #be123c;
          background: rgba(170, 28, 44, 0.16);
          transform: rotate(12deg);
          text-shadow: 0 0 0.4px rgba(170, 28, 44, 0.9), 0 0 2px rgba(170, 28, 44, 0.62);
        }

        @keyframes stampWobble {
          0%,
          100% {
            transform: rotate(-2.5deg);
          }
          50% {
            transform: rotate(2.5deg);
          }
        }
        @keyframes stampDrop {
          0% {
            transform: translateY(-44px) scale(1.04);
          }
          55% {
            transform: translateY(0px) scale(1.0, 0.92);
          }
          100% {
            transform: translateY(0px) scale(1, 1);
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

