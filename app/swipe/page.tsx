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
  const animClass = kind === "approved" ? "rs-imprint--land-approved" : "rs-imprint--land-declined";
  return (
    <div className={`rs-imprint ${kindClass} ${animClass}`}>
      <span className="rs-imprint__text">{label}</span>
    </div>
  );
}

/** Back / mid stack poses (must match prior deck visuals for smooth promote). */
const STACK_DECK_BACK = "translate(-7px, 12px) rotate(-2deg) scale(0.91)";
const STACK_DECK_MID = "translate(5px, 6px) rotate(1.2deg) scale(0.955)";

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
  /** After outgoing unmounts: one frame stacked, then CSS transition to front (smooth promote). */
  const [arriveFromStack, setArriveFromStack] = useState(false);
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

  const swipePdfMode = useMemo(
    () => (desktopSwipeLayout ? "fit-cover" : "fit-width"),
    [desktopSwipeLayout],
  );

  const DECK_SIZE = 7;
  const PROFILE_FETCH_TIMEOUT_MS = 5000;
  const STAMP_DROP_DELAY_MS = 48;
  /** Durée de l’effet « coup de tampon » (ondes + écrasement) — laisse le temps de le percevoir. */
  const STAMP_IMPACT_MS = 300;
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
    setArriveFromStack(false);
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
  const showNextLoader = !!current && deck[1] == null && nextCardLoading;

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
        const padX = 12;
        const padY = 10;
        const availW = Math.max(0, r.width - padX * 2);
        const availH = Math.max(0, r.height - padY * 2);
        const vw = window.innerWidth || r.width;
        const halfScreen = Math.floor(vw * 0.5);
        const w = Math.min(availW, halfScreen);
        const nw = Math.max(340, Math.floor(w));
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
      const w = Math.max(0, availW - 6);
      const hIdeal = (w * b) / a;
      const h = Math.min(availH, hIdeal);
      const nw = Math.max(176, Math.floor(w));
      const nh = Math.max(200, Math.floor(h));
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

  function triggerStackLift() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setArriveFromStack(false);
      });
    });
  }

  function completeOutgoingCleanup() {
    setArriveFromStack(true);
    setOutgoing(null);
    setPendingTransition(null);
    setCardImprint(null);
    setStampDropping(false);
    transitionInFlightRef.current = false;
    triggerStackLift();
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
        transitionInFlightRef.current = false;
        return;
      }

      consumeTopAndRefill();
      window.setTimeout(() => {
        completeOutgoingCleanup();
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
        completeOutgoingCleanup();
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
              {([2, 1, 0] as const).map((deckIdx) => {
                const item = deck[deckIdx];
                if (!item) return null;

                const isTop = deckIdx === 0;
                const zOuter = isTop ? 20 : 5 + (2 - deckIdx) * 6;

                let transform: string;
                if (deckIdx === 2) {
                  transform = STACK_DECK_BACK;
                } else if (deckIdx === 1) {
                  transform =
                    pendingTransition && !outgoing
                      ? "translate(0px, 0px) rotate(0deg) scale(1)"
                      : STACK_DECK_MID;
                } else {
                  transform = arriveFromStack
                    ? STACK_DECK_MID
                    : `translateX(${dragX}px) rotate(${tilt}deg) scale(1)`;
                }

                const transformOrigin = deckIdx === 0 ? "center center" : "50% 100%";

                const transitionDuration = isTop
                  ? dragging
                    ? "200ms"
                    : arriveFromStack
                      ? "0ms"
                      : `${CARD_TRANSITION_MS}ms`
                  : `${CARD_TRANSITION_MS}ms`;

                const shellClass =
                  deckIdx === 2
                    ? "h-full w-full select-none overflow-hidden rounded-none border border-zinc-300/90 bg-[#fbfbf9] shadow-[0_1px_0_rgba(0,0,0,0.05),0_14px_28px_-10px_rgba(0,0,0,0.2)]"
                    : deckIdx === 1
                      ? "h-full w-full select-none overflow-hidden rounded-none border border-zinc-300/90 bg-[#fcfcfa] shadow-[0_1px_0_rgba(0,0,0,0.05),0_18px_36px_-12px_rgba(0,0,0,0.22)]"
                      : "h-full w-full select-none overflow-hidden rounded-none border border-zinc-300/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06),0_24px_52px_-14px_rgba(0,0,0,0.28)]";

                const shellFilter =
                  deckIdx === 2 ? "brightness(0.96)" : deckIdx === 1 ? "brightness(0.98)" : undefined;

                return (
                  <div
                    key={item.profile.id}
                    className="absolute inset-0"
                    style={{
                      zIndex: zOuter,
                      pointerEvents: isTop && !outgoing ? "auto" : "none",
                    }}
                  >
                    <div
                      ref={isTop ? cardDropRef : undefined}
                      onPointerDown={isTop && !outgoing ? onPointerDown : undefined}
                      onPointerMove={isTop && !outgoing ? onPointerMove : undefined}
                      onPointerUp={isTop && !outgoing ? onPointerUp : undefined}
                      onPointerCancel={isTop && !outgoing ? onPointerUp : undefined}
                      data-stamp-dropzone={isTop && !outgoing ? "1" : undefined}
                      className={shellClass}
                      style={{
                        transform,
                        transformOrigin,
                        transitionProperty: "transform",
                        transitionDuration,
                        transitionTimingFunction: "ease-out",
                        filter: shellFilter,
                        touchAction: isTop ? "none" : undefined,
                        opacity: isTop && outgoing ? 0 : 1,
                      }}
                    >
                      {isTop && overlay ? (
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

                      {isTop && cardImprint ? (
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
                          key={item.profile.id}
                          url={item.cvUrl}
                          mode={swipePdfMode}
                          immersive
                        />
                      </div>

                      {isTop ? (
                        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full border border-zinc-200/80 bg-white/92 px-2.5 py-0.5 text-[11px] font-black tracking-wide text-zinc-900 shadow-sm sm:top-2.5 sm:px-3 sm:text-xs">
                          {normHandle(item.profile.handle)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {outgoing ? (
                <div
                  className="absolute inset-0 z-[26] select-none overflow-hidden rounded-none border border-zinc-300/90 bg-[#fdfdfb] shadow-[0_1px_0_rgba(0,0,0,0.06),0_22px_48px_-14px_rgba(0,0,0,0.26)]"
                  style={{
                    transform: outgoing.slideOut
                      ? `translateX(${
                          outgoing.dir > 0
                            ? "calc(100vw + 100%)"
                            : "calc(-100vw - 100%)"
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
                      mode={swipePdfMode}
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
            </div>
          </div>
        </div>
      )}

      {!blockedByFreeLimit ? (
        <div className="fixed bottom-2 left-0 right-0 z-[9000] px-2 pb-[max(env(safe-area-inset-bottom),0px)]">
          <div className="mx-auto flex max-w-[980px] items-center justify-center gap-4 rounded-xl border border-zinc-200 bg-white/96 px-4 py-3 shadow-lg backdrop-blur-sm sm:gap-5 sm:px-5 sm:py-3.5">
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
              stampDrag.returning ? "scale(0.94)" : "scale(1.14)"
            }`,
            transformOrigin: "center center",
            transition: stampDrag.returning
              ? `transform ${STAMP_RETURN_MS}ms cubic-bezier(0.18, 0.88, 0.3, 1)`
              : "none",
            filter: stampDrag.returning
              ? "drop-shadow(0 12px 24px rgba(0,0,0,0.16))"
              : "drop-shadow(0 22px 36px rgba(0,0,0,0.32)) drop-shadow(0 4px 8px rgba(0,0,0,0.2))",
          }}
        >
          <StampVisual kind={stampDrag.kind} floating />
        </div>
      ) : null}

      {stampImpact ? (
        <div
          className={`pointer-events-none fixed z-[9650] rs-stamp-impact-wrap rs-stamp-impact-wrap--${stampImpact.kind}`}
          style={{
            left: `${stampImpact.x}px`,
            top: `${stampImpact.y}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="rs-stamp-impact-flash" aria-hidden="true" />
          <div className="rs-stamp-impact-ring rs-stamp-impact-ring--1" aria-hidden="true" />
          <div className="rs-stamp-impact-ring rs-stamp-impact-ring--2" aria-hidden="true" />
          <div className="rs-stamp-impact-ring rs-stamp-impact-ring--3" aria-hidden="true" />
          <div className="rs-stamp-impact-body">
            <div className={`rs-stamp-impact-drop rs-stamp-impact-drop--${stampImpact.kind}`}>
              <StampVisual kind={stampImpact.kind} />
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        /* Tampons (dock + drag) : forme « caoutchouc », couleurs franches */
        .rs-stamp {
          position: relative;
          width: 168px;
          height: 84px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          user-select: none;
          border-radius: 10px;
          border: 3px solid #18181b;
          background: linear-gradient(165deg, #f4f4f5 0%, #d4d4d8 42%, #a1a1aa 100%);
          box-shadow:
            inset 0 2px 0 rgba(255, 255, 255, 0.95),
            inset 0 -4px 10px rgba(0, 0, 0, 0.22),
            0 12px 28px rgba(0, 0, 0, 0.2),
            0 2px 0 rgba(255, 255, 255, 0.5);
        }
        .rs-stamp__label {
          display: inline-block;
          border-radius: 6px;
          padding: 8px 14px;
          font-size: 15px;
          font-family: "Arial Black", Impact, "Franklin Gothic Heavy", sans-serif;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          line-height: 1.05;
          border: 3px solid currentColor;
          background: rgba(255, 255, 255, 0.97);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 1),
            0 2px 0 rgba(0, 0, 0, 0.12);
        }
        .rs-stamp--approved {
          color: #065f46;
          border-color: #064e3b;
          background: linear-gradient(165deg, #ecfdf5 0%, #6ee7b7 38%, #34d399 100%);
          box-shadow:
            inset 0 2px 0 rgba(255, 255, 255, 0.85),
            inset 0 -5px 14px rgba(5, 80, 60, 0.35),
            0 0 0 1px rgba(6, 95, 70, 0.35),
            0 14px 32px rgba(6, 95, 70, 0.35);
        }
        .rs-stamp--approved .rs-stamp__label {
          transform: rotate(-11deg);
          color: #fff;
          background: linear-gradient(180deg, #059669 0%, #047857 55%, #065f46 100%);
          border-color: #064e3b;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
        }
        .rs-stamp--declined {
          color: #9f1239;
          border-color: #881337;
          background: linear-gradient(165deg, #fff1f2 0%, #fda4af 40%, #fb7185 100%);
          box-shadow:
            inset 0 2px 0 rgba(255, 255, 255, 0.9),
            inset 0 -5px 14px rgba(136, 19, 55, 0.35),
            0 0 0 1px rgba(159, 18, 57, 0.3),
            0 14px 32px rgba(159, 18, 57, 0.32);
        }
        .rs-stamp--declined .rs-stamp__label {
          transform: rotate(11deg);
          color: #fff;
          background: linear-gradient(180deg, #e11d48 0%, #be123c 50%, #9f1239 100%);
          border-color: #881337;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
        }
        .rs-stamp--floating {
          transform: scale(1.02);
          filter: saturate(1.08) contrast(1.05);
        }

        /* Empreinte sur le CV : forte lisibilité + animation d’atterrissage */
        .rs-imprint {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          padding: 10px 18px;
          pointer-events: none;
          user-select: none;
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.12),
            0 6px 20px rgba(0, 0, 0, 0.35),
            inset 0 1px 0 rgba(255, 255, 255, 0.35);
        }
        .rs-imprint__text {
          font-family: "Arial Black", Impact, "Franklin Gothic Heavy", sans-serif;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-size: 16px;
          line-height: 1;
        }
        .rs-imprint--approved {
          color: #fff;
          border: 3px solid #064e3b;
          background: linear-gradient(165deg, #10b981 0%, #059669 45%, #047857 100%);
          transform: rotate(-10deg);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
        }
        .rs-imprint--declined {
          color: #fff;
          border: 3px solid #881337;
          background: linear-gradient(165deg, #fb7185 0%, #e11d48 45%, #be123c 100%);
          transform: rotate(10deg);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
        }
        .rs-imprint--land-approved {
          animation: imprintLandApproved 0.42s cubic-bezier(0.22, 1.24, 0.32, 1) both;
        }
        .rs-imprint--land-declined {
          animation: imprintLandDeclined 0.42s cubic-bezier(0.22, 1.24, 0.32, 1) both;
        }
        @keyframes imprintLandApproved {
          0% {
            transform: rotate(-10deg) scale(2.1);
            opacity: 0;
            filter: blur(3px);
          }
          55% {
            transform: rotate(-10deg) scale(0.88);
            opacity: 1;
            filter: blur(0);
          }
          78% {
            transform: rotate(-10deg) scale(1.08);
          }
          100% {
            transform: rotate(-10deg) scale(1);
            opacity: 1;
          }
        }
        @keyframes imprintLandDeclined {
          0% {
            transform: rotate(10deg) scale(2.1);
            opacity: 0;
            filter: blur(3px);
          }
          55% {
            transform: rotate(10deg) scale(0.88);
            opacity: 1;
            filter: blur(0);
          }
          78% {
            transform: rotate(10deg) scale(1.08);
          }
          100% {
            transform: rotate(10deg) scale(1);
            opacity: 1;
          }
        }

        /* Impact au posé : flash + ondes + tampon qui « tape » */
        .rs-stamp-impact-wrap {
          position: relative;
          width: 1px;
          height: 1px;
        }
        .rs-stamp-impact-wrap--approved {
          --rs-ring: rgba(16, 185, 129, 0.75);
          --rs-ring-soft: rgba(52, 211, 153, 0.45);
          --rs-flash: rgba(167, 243, 208, 0.95);
        }
        .rs-stamp-impact-wrap--declined {
          --rs-ring: rgba(244, 63, 94, 0.78);
          --rs-ring-soft: rgba(251, 113, 133, 0.5);
          --rs-flash: rgba(254, 205, 211, 0.95);
        }
        .rs-stamp-impact-flash {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 120px;
          height: 120px;
          margin: -60px 0 0 -60px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--rs-flash) 0%, transparent 68%);
          animation: stampFlash 0.32s ease-out both;
          pointer-events: none;
        }
        .rs-stamp-impact-ring {
          position: absolute;
          left: 50%;
          top: 50%;
          border-radius: 50%;
          border: 3px solid var(--rs-ring);
          pointer-events: none;
          opacity: 0;
        }
        .rs-stamp-impact-ring--1 {
          width: 56px;
          height: 56px;
          margin: -28px 0 0 -28px;
          animation: stampRingOut 0.38s cubic-bezier(0.2, 0.9, 0.3, 1) 0.02s both;
        }
        .rs-stamp-impact-ring--2 {
          width: 56px;
          height: 56px;
          margin: -28px 0 0 -28px;
          border-color: var(--rs-ring-soft);
          animation: stampRingOut 0.45s cubic-bezier(0.15, 0.85, 0.25, 1) 0.08s both;
        }
        .rs-stamp-impact-ring--3 {
          width: 56px;
          height: 56px;
          margin: -28px 0 0 -28px;
          border-width: 2px;
          border-color: var(--rs-ring);
          animation: stampRingOut 0.52s cubic-bezier(0.12, 0.8, 0.2, 1) 0.14s both;
        }
        .rs-stamp-impact-body {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
        }
        .rs-stamp-impact-drop--approved {
          animation: stampDropThudApproved 0.34s cubic-bezier(0.2, 1.35, 0.36, 1) both;
        }
        .rs-stamp-impact-drop--declined {
          animation: stampDropThudDeclined 0.34s cubic-bezier(0.2, 1.35, 0.36, 1) both;
        }

        @keyframes stampWobble {
          0%,
          100% {
            transform: rotate(-3deg);
          }
          50% {
            transform: rotate(3deg);
          }
        }
        @keyframes stampDropThudApproved {
          0% {
            transform: translateY(-52px) scale(1.18) rotate(-5deg);
            filter: brightness(1.12);
          }
          52% {
            transform: translateY(6px) scale(0.88, 0.8) rotate(0deg);
            filter: brightness(1);
          }
          72% {
            transform: translateY(-3px) scale(1.06, 1.03);
          }
          100% {
            transform: translateY(0) scale(1, 1);
          }
        }
        @keyframes stampDropThudDeclined {
          0% {
            transform: translateY(-52px) scale(1.18) rotate(5deg);
            filter: brightness(1.12);
          }
          52% {
            transform: translateY(6px) scale(0.88, 0.8) rotate(0deg);
            filter: brightness(1);
          }
          72% {
            transform: translateY(-3px) scale(1.06, 1.03);
          }
          100% {
            transform: translateY(0) scale(1, 1);
          }
        }
        @keyframes stampFlash {
          0% {
            opacity: 0;
            transform: scale(0.35);
          }
          35% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(1.65);
          }
        }
        @keyframes stampRingOut {
          0% {
            opacity: 0.95;
            transform: scale(0.25);
          }
          100% {
            opacity: 0;
            transform: scale(4.2);
          }
        }
        @media (max-width: 380px) {
          .rs-stamp {
            width: 148px;
            height: 76px;
          }
          .rs-stamp__label {
            font-size: 13px;
            padding: 7px 11px;
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

