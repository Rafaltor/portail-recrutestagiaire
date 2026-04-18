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
import "./swipe-stamps.css";

type SwipeItem = {
  profile: { id: string; handle: string };
  cvUrl: string;
};

type ApiBatch = { done: boolean; items: SwipeItem[] };
type StampKind = "approved" | "declined";
type StampImprint = { kind: StampKind; x: number; y: number };
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

/** Fichiers attendus : `public/swipe-stamps/approved.png` et `declined.png` */
const STAMP_IMAGE: Record<StampKind, { src: string; alt: string }> = {
  approved: { src: "/swipe-stamps/approved.png", alt: "Tampon approuvé" },
  declined: { src: "/swipe-stamps/declined.png", alt: "Tampon refusé" },
};

function StampVisual({
  kind,
  floating = false,
  muted = false,
}: {
  kind: StampKind;
  floating?: boolean;
  muted?: boolean;
}) {
  const { src, alt } = STAMP_IMAGE[kind];
  return (
    <span
      className={`rs-stamp-art inline-flex items-center justify-center ${floating ? "rs-stamp-art--floating" : ""} ${muted ? "opacity-45" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- assets statiques locaux */}
      <img
        src={src}
        alt={alt}
        width={320}
        height={140}
        draggable={false}
        className="rs-stamp-art__img block h-auto max-h-[72px] w-[168px] max-w-[42vw] select-none object-contain sm:max-h-[76px] sm:w-[182px]"
      />
    </span>
  );
}

function StampImprintVisual({ kind }: { kind: StampKind }) {
  const { src } = STAMP_IMAGE[kind];
  const animClass = kind === "approved" ? "rs-imprint-art--land-approved" : "rs-imprint-art--land-declined";
  return (
    <div className={`rs-imprint-art ${animClass}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={320}
        height={140}
        draggable={false}
        className="rs-imprint-art__img block h-auto w-[min(220px,50vw)] max-w-none object-contain"
      />
    </div>
  );
}

/** Pile : même orientation, léger décalage bas-droite par couche (effet « une liasse »). */
const STACK_DECK_BACK = "translate(10px, 12px) scale(0.94)";
const STACK_DECK_MID = "translate(5px, 6px) scale(0.97)";

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
    imprint: StampImprint | null;
    /** Swipe = horizontal ; tampon = carte qui descend. */
    exitAxis: "horizontal" | "down";
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
  const STAMP_DROP_DELAY_MS = 6;
  /** Durée de l’effet « coup de tampon » (ondes + écrasement). */
  const STAMP_IMPACT_MS = 220;
  /** Court délai après le posé avant la sortie (sans attendre le réseau — le vote part en parallèle). */
  const STAMP_IMPRINT_HOLD_MS = 28;
  /** Sortie « tampon » vers le bas (tampon posé). */
  const STAMP_EXIT_MS = 1500;
  const CARD_TRANSITION_MS = 320;
  /** Swipe doigt : sortie latérale. */
  const SWIPE_EXIT_MS = 1150;
  /** Retour au centre si swipe insuffisant (ressort). */
  const SWIPE_SPRING_MS = 280;
  const SWIPE_EXIT_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  const SWIPE_SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
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

  // Active les styles `html[data-rs-swipe="1"]` (rs-shopify-header.css) : desktop = marque + actions ligne 1, onglets ligne 2 ; mobile = bandeau onglets sans fond bleu.
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

  function completeOutgoingCleanup() {
    setOutgoing(null);
    setCardImprint(null);
    setStampDropping(false);
    transitionInFlightRef.current = false;
  }

  async function applyTransitionVote(
    kind: StampKind,
    value: 1 | -1,
    imprint: StampImprint | null,
    holdImprintMs: number,
    swipeRelease: SwipeRelease | null = null,
  ) {
    if (!current || outgoing || transitionInFlightRef.current) return;

    const baseImprint =
      imprint ??
      ({
        kind,
        x: 50,
        y: 52,
      } as StampImprint);

    const swipeFast = holdImprintMs === 0 && swipeRelease !== null;

    /** Swipe doigt : tampon visuel centré sur le document. */
    const resolvedImprint = swipeFast
      ? ({ kind: baseImprint.kind, x: 50, y: 52 } as StampImprint)
      : baseImprint;

    if (swipeFast) {
      transitionInFlightRef.current = true;
      const profileId = current.profile.id;
      const item = current;

      setCardImprint(resolvedImprint);
      setOutgoing({
        item,
        dir: value,
        imprint: resolvedImprint,
        exitAxis: "horizontal",
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

      consumeTopAndRefill();

      void (async () => {
        const voteOk = await sendVote(profileId, value);
        if (!voteOk) {
          setDeck((prev) => {
            if (prev[0]?.profile.id === item.profile.id) return prev;
            return [item, ...prev];
          });
          setOutgoing(null);
          setCardImprint(null);
          transitionInFlightRef.current = false;
          return;
        }
        window.setTimeout(() => {
          completeOutgoingCleanup();
        }, SWIPE_EXIT_MS + 72);
      })();
      return;
    }

    if (holdImprintMs > 0) {
      transitionInFlightRef.current = true;
      const profileId = current.profile.id;
      const item = current;

      setCardImprint(resolvedImprint);
      setDragX(0);
      startXRef.current = null;
      if (imprintHoldTimerRef.current) {
        window.clearTimeout(imprintHoldTimerRef.current);
        imprintHoldTimerRef.current = null;
      }

      imprintHoldTimerRef.current = window.setTimeout(() => {
        setOutgoing({
          item,
          dir: value,
          imprint: resolvedImprint,
          exitAxis: "down",
          exitStartX: 0,
          exitStartTilt: 0,
          exitDurationMs: STAMP_EXIT_MS,
          slideOut: false,
        });
        consumeTopAndRefill();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setOutgoing((o) =>
              o && o.item.profile.id === profileId
                ? { ...o, slideOut: true, exitDurationMs: STAMP_EXIT_MS }
                : o,
            );
          });
        });
        void sendVote(profileId, value).then((voteOk) => {
          if (!voteOk) {
            setDeck((prev) => {
              if (prev[0]?.profile.id === item.profile.id) return prev;
              return [item, ...prev];
            });
            setOutgoing(null);
            setCardImprint(null);
            transitionInFlightRef.current = false;
          }
        });
        window.setTimeout(() => {
          completeOutgoingCleanup();
        }, STAMP_EXIT_MS + 96);
      }, holdImprintMs);
      return;
    }

    transitionInFlightRef.current = true;
    const itemAfterVote = current;
    const voteOk = await sendVote(itemAfterVote.profile.id, value);
    if (!voteOk) {
      setCardImprint(null);
      setStampDropping(false);
      transitionInFlightRef.current = false;
      return;
    }

    setCardImprint(resolvedImprint);
    setDragX(0);
    startXRef.current = null;
    if (imprintHoldTimerRef.current) {
      window.clearTimeout(imprintHoldTimerRef.current);
      imprintHoldTimerRef.current = null;
    }

    const votedProfileId = itemAfterVote.profile.id;
    imprintHoldTimerRef.current = window.setTimeout(() => {
      const exitStartX = swipeRelease?.x ?? 0;
      const exitStartTilt = swipeRelease?.tilt ?? 0;
      setOutgoing({
        item: itemAfterVote,
        dir: value,
        imprint: resolvedImprint,
        exitAxis: "horizontal",
        exitStartX,
        exitStartTilt,
        exitDurationMs: CARD_TRANSITION_MS,
        slideOut: false,
      });
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
    }, 0);
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
        x: 50,
        y: 52,
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
          x: 50,
          y: 52,
        };
        const vote = cur.kind === "approved" ? 1 : -1;
        void applyTransitionVote(cur.kind, vote, fallbackImprint, STAMP_IMPRINT_HOLD_MS);
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
      const fallbackImprint: StampImprint = { kind: "approved", x: 50, y: 52 };
      void applyTransitionVote("approved", 1, fallbackImprint, 0, { x: dx, tilt: releaseTilt });
    } else if (dx < -threshold) {
      const fallbackImprint: StampImprint = { kind: "declined", x: 50, y: 52 };
      void applyTransitionVote("declined", -1, fallbackImprint, 0, { x: dx, tilt: releaseTilt });
    } else {
      requestAnimationFrame(() => {
        setDragX(0);
      });
    }
    startXRef.current = null;
  }

  const swipeChromeHeight =
    "calc(100dvh - var(--rs-swipe-top-offset, 96px) - var(--rs-swipe-bottom-chrome, 128px))";

  return (
    <div
      id="rs-swipe-page"
      ref={sheetMeasureRef}
      className={`rs-swipe-page-root relative flex w-full flex-col overscroll-y-contain min-h-0 overflow-x-visible overflow-y-visible`}
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
          <div className="rs-swipe-loader-panel w-full max-w-md">
            <div className="rs-swipe-loader-title">
              {!authReady ? "Connexion au portail…" : "Chargement des profils"}
            </div>
            <p className="rs-swipe-loader-sub">
              {!authReady
                ? "Préparation de ta session sécurisée."
                : "Récupération des CV publiés pour le swipe."}
            </p>
            <div className="rs-swipe-loader-track">
              <div className="rs-swipe-loader-bar" />
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
              className="relative shrink-0 overflow-visible"
              style={{
                width: sheetSize.w,
                height: sheetSize.h,
              }}
            >
              {showNextLoader ? (
                <div className="pointer-events-none absolute -right-1 -top-1 z-20 sm:right-0 sm:top-0">
                  <div className="rs-swipe-next-loader" aria-hidden="true">
                    <div className="rs-swipe-next-loader__spin" />
                  </div>
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
                  transform = STACK_DECK_MID;
                } else {
                  transform = `translateX(${dragX}px) rotate(${tilt}deg) scale(1)`;
                }

                const transformOrigin = "center center";

                const transitionDuration = isTop
                  ? dragging
                    ? "0ms"
                    : `${SWIPE_SPRING_MS}ms`
                  : `${CARD_TRANSITION_MS}ms`;

                const transitionEasing = isTop
                  ? dragging
                    ? "linear"
                    : SWIPE_SPRING_EASE
                  : "ease-out";

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
                        transitionTimingFunction: transitionEasing,
                        filter: shellFilter,
                        touchAction: isTop ? "none" : undefined,
                      }}
                    >
                      <div className="h-full min-h-0 w-full overflow-hidden rounded-none">
                        <PdfPreview
                          key={item.profile.id}
                          url={item.cvUrl}
                          mode={swipePdfMode}
                          immersive
                        />
                      </div>

                      {isTop && cardImprint ? (
                        <div
                          className="pointer-events-none absolute z-30"
                          style={{
                            left: `${cardImprint.x}%`,
                            top: `${cardImprint.y}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                        >
                          <StampImprintVisual kind={cardImprint.kind} />
                        </div>
                      ) : null}

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
                  className="absolute inset-0 z-[26] select-none overflow-visible rounded-none border border-zinc-300/90 bg-[#fdfdfb] shadow-[0_1px_0_rgba(0,0,0,0.06),0_22px_48px_-14px_rgba(0,0,0,0.26)]"
                  style={{
                    transform: (() => {
                      if (outgoing.exitAxis === "down") {
                        return outgoing.slideOut
                          ? "translateY(calc(100vh + 100% + 40px)) rotate(2.5deg)"
                          : "translateY(0px) rotate(0deg)";
                      }
                      /* Sortie bien hors cadre (évite l’effet « disparition sur place » si clip ou écran étroit) */
                      const farX =
                        outgoing.dir > 0
                          ? "calc(100vw + 100% + 40vw)"
                          : "calc(-100vw - 100% - 40vw)";
                      return outgoing.slideOut
                        ? `translateX(${farX}) rotate(${outgoing.exitStartTilt}deg)`
                        : `translateX(${outgoing.exitStartX}px) rotate(${outgoing.exitStartTilt}deg)`;
                    })(),
                    transitionProperty: "transform",
                    transitionDuration: outgoing.slideOut
                      ? `${outgoing.exitDurationMs}ms`
                      : "0ms",
                    transitionTimingFunction: outgoing.slideOut ? SWIPE_EXIT_EASE : "linear",
                    willChange: "transform",
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
                  {outgoing.imprint ? (
                    <div
                      className="pointer-events-none absolute z-30"
                      style={{
                        left: `${outgoing.imprint.x}%`,
                        top: `${outgoing.imprint.y}%`,
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
        <div className="fixed bottom-2 left-0 right-0 z-[9000] px-2 pb-[max(env(safe-area-inset-bottom),0px)] pointer-events-none">
          <div className="mx-auto flex max-w-[980px] items-end justify-center gap-4 px-2 py-0 sm:gap-6 sm:px-3 pointer-events-auto">
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
              stampDrag.returning ? "scale(0.94)" : "scale(1.06)"
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
    </div>
  );
}

