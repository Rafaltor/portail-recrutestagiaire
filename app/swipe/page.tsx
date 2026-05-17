"use client";

import {
  useCallback,
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
  LIKES_QUOTA_EXHAUSTED_MESSAGE,
  dayKeyUTC,
  getLikesDayKey,
  getSwipeCountKey,
  readLocalInt,
  writeLocalInt,
} from "@/lib/swipe-gating";
import "./swipe-stamps.css";
import { SwipeWelcomeModal } from "@/components/SwipeWelcomeModal";
import { RequireAuthGate } from "@/components/RequireAuthGate";

/** Sortie carte vers le côté — durée et easing « lisibles » (pas trop rapide). */
const FALL_EXIT_MS = 780;

function formatSwipeError(e: unknown): string {
  if (e instanceof Error && e.message.trim()) return e.message;
  if (typeof e === "string" && e.trim()) return e;
  return "Impossible de charger. Vérifie ta connexion.";
}

type SwipeItem = {
  profile: {
    id: string;
    handle: string;
    job_title: string;
    city: string | null;
    portfolio_url: string | null;
  };
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

/** Fichiers attendus : `public/swipe-stamps/approved.png` et `declined.png` */
const STAMP_IMAGE: Record<StampKind, { src: string; alt: string }> = {
  approved: { src: "/swipe-stamps/approved.png", alt: "Tampon approuvé" },
  declined: { src: "/swipe-stamps/declined.png", alt: "Tampon refusé" },
};

function StampVisual({
  kind,
  floating = false,
  muted = false,
  tint = true,
}: {
  kind: StampKind;
  floating?: boolean;
  muted?: boolean;
  /** Teinte charte (#F472B6 / #0A0A0A) sur le PNG */
  tint?: boolean;
}) {
  const { src, alt } = STAMP_IMAGE[kind];
  const tintClass =
    !tint ? "" : kind === "approved" ? "rs-stamp-art--tint-approved" : "rs-stamp-art--tint-declined";
  return (
    <span
      className={`rs-stamp-art inline-flex items-center justify-center ${tintClass} ${floating ? "rs-stamp-art--floating" : ""} ${muted ? "opacity-45" : ""}`}
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
  const toneClass =
    kind === "approved" ? "rs-imprint-art--tone-approved" : "rs-imprint-art--tone-declined";
  return (
    <div className={`rs-imprint-art ${animClass} ${toneClass}`}>
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
  return (
    <RequireAuthGate nextPath="/swipe">
      <SwipePageInner />
    </RequireAuthGate>
  );
}

function SwipePageInner() {
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

  /** Message RH (API /vote) — panneau haut droite, fondu puis disparition auto. */
  const [rhInsight, setRhInsight] = useState<string | null>(null);
  const [rhInsightFadedIn, setRhInsightFadedIn] = useState(false);

  const [showOnboarding, setShowOnboarding] = useState(false);

  /** Entrée du CV suivant depuis la droite après la sortie animée. */
  type CardEnterPhase = "idle" | "from" | "to";
  const [cardEnter, setCardEnter] = useState<CardEnterPhase>("idle");

  /** Carte en cours de sortie : même visuel PDF, animée vers le bas (phase enter → fall). */
  const [flyoff, setFlyoff] = useState<{
    item: SwipeItem;
    voteValue: 1 | -1;
    fromX: number;
    fromY: number;
    phase: "enter" | "fall";
  } | null>(null);

  /** Glisser la carte horizontalement (like / dislike). */
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const [cardPanning, setCardPanning] = useState(false);
  const cardPanPointerRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    pan0x: number;
    pan0y: number;
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

  const cardDropRef = useRef<HTMLDivElement | null>(null);
  const flyoffCardRectRef = useRef<DOMRect | null>(null);
  const stampDragRef = useRef<StampDragState | null>(null);
  const stampReturnTimerRef = useRef<number | null>(null);
  const stampImpactTimerRef = useRef<number | null>(null);
  const stampCommitTimerRef = useRef<number | null>(null);
  const imprintHoldTimerRef = useRef<number | null>(null);
  const exitAnimTimerRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef(0);
  const refillInFlightRef = useRef(false);
  const transitionInFlightRef = useRef(false);
  /** Profils déjà swipés cette session (avant persistance API / refill). */
  const votedProfileIdsRef = useRef<Set<string>>(new Set());
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
  const CARD_TRANSITION_MS = 300;
  const STAMP_RETURN_MS = 180;
  const RH_INSIGHT_DISPLAY_MS = 4000;
  const RH_INSIGHT_FADE_MS = 280;
  const swipeCountKey = useMemo(() => getSwipeCountKey(visitorId), [visitorId]);
  const likesDayKey = useMemo(
    () => getLikesDayKey(visitorId, dayKeyUTC()),
    [visitorId],
  );

  function batchExcludeIds(deckItems: SwipeItem[]): string[] {
    const ids = new Set<string>(votedProfileIdsRef.current);
    for (const item of deckItems) {
      ids.add(item.profile.id);
    }
    return [...ids];
  }

  function markProfileVoted(profileId: string) {
    votedProfileIdsRef.current.add(profileId);
  }

  function unmarkProfileVoted(profileId: string) {
    votedProfileIdsRef.current.delete(profileId);
  }

  async function fetchBatch(deckItems: SwipeItem[], n = DECK_SIZE): Promise<ApiBatch> {
    const excludeIds = batchExcludeIds(deckItems);
    const qp = new URLSearchParams();
    qp.set("visitorId", visitorId);
    qp.set("n", String(n));
    if (excludeIds.length) qp.set("excludeIds", excludeIds.join(","));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort("profile_fetch_timeout");
    }, PROFILE_FETCH_TIMEOUT_MS);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const r = await fetch(`/api/swipe/batch?${qp.toString()}`, {
        signal: controller.signal,
        headers: session?.access_token
          ? { authorization: `Bearer ${session.access_token}` }
          : undefined,
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
    setRhInsight(null);
    setLoadError("");
    setNextCardLoading(false);
    /* Invité : limite locale. Compte connecté : pas cette limite — toujours réinitialiser
       au cas où on passait invité (bloqué) → connecté sans recharger la page. */
    if (isConnected) {
      setBlockedByFreeLimit(false);
    } else {
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
      votedProfileIdsRef.current.clear();
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
      const errMsg = formatSwipeError(e);
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
      const res = await fetchBatch(nextDeck, DECK_SIZE - nextDeck.length);
      if (!res.items.length) {
        /* Vide ≠ « plus rien à swiper » : le deck peut encore contenir des cartes. */
        setDone(nextDeck.length === 0 && (res.done !== false));
        return;
      }
      setDone(false);
      setDeck((d) => {
        // d might have changed; merge carefully
        const curIds = new Set(d.map((i) => i.profile.id));
        const add = res.items.filter((i) => !curIds.has(i.profile.id));
        return [...d, ...add].slice(0, DECK_SIZE);
      });
    } catch (e: unknown) {
      setMessage(formatSwipeError(e));
      if (nextDeck.length === 0) {
        setDone(true);
      }
    } finally {
      refillInFlightRef.current = false;
      setNextCardLoading(false);
    }
  }

  async function sendVote(
    profileId: string,
    value: 1 | -1,
  ): Promise<{ ok: boolean; rhMessage?: string }> {
    if (isConnected && value === 1) {
      const currentLikes = readLocalInt(likesDayKey);
      setLikesToday(currentLikes);
      if (currentLikes >= AUTH_LIKES_PER_DAY) {
        setMessage(LIKES_QUOTA_EXHAUSTED_MESSAGE);
        return { ok: false };
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
    const j = (await r.json().catch(() => ({}))) as {
      error?: string;
      rh?: { message?: string };
    };
    if (!r.ok) {
      if (j?.error === "likes_limit_reached") {
        setMessage(LIKES_QUOTA_EXHAUSTED_MESSAGE);
      } else {
        setMessage(j?.error || "Impossible d’enregistrer le vote.");
      }
      return { ok: false };
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
    return { ok: true, rhMessage: j.rh?.message };
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

  useEffect(() => {
    if (!authReady || !isConnected) return;
    setLikesToday(readLocalInt(likesDayKey));
  }, [authReady, isConnected, likesDayKey]);

  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        localStorage.getItem("rs_swipe_onboarding_seen") !== "1"
      ) {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
    } catch {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    if (!rhInsight) {
      setRhInsightFadedIn(false);
      return;
    }
    setRhInsightFadedIn(false);
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => setRhInsightFadedIn(true));
    });
    const hideTimer = window.setTimeout(() => {
      setRhInsightFadedIn(false);
    }, RH_INSIGHT_DISPLAY_MS);
    const clearTimer = window.setTimeout(() => {
      setRhInsight(null);
    }, RH_INSIGHT_DISPLAY_MS + RH_INSIGHT_FADE_MS);
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
    };
  }, [rhInsight]);

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
        const padX = 10;
        const padY = 4;
        const availW = Math.max(0, r.width - padX * 2);
        const availH = Math.max(0, r.height - padY * 2);
        const vw = window.innerWidth || r.width;
        const halfScreen = Math.floor(vw * 0.5);
        const ratio = 297 / 210;
        let nw = Math.min(availW, halfScreen);
        nw = Math.max(280, Math.floor(nw));
        let nh = Math.floor(nw * ratio);
        /* Garder le ratio A4 : si la hauteur dispo est trop basse, réduire la largeur (évite CV « écrasé »). */
        if (availH > 0 && nh > availH) {
          nh = Math.floor(availH);
          nw = Math.max(280, Math.floor(nh / ratio));
        }
        setSheetSize((prev) => (prev.w === nw && prev.h === nh ? prev : { w: nw, h: nh }));
        return;
      }

      const padX = 0;
      const padY = 4;
      const availW = Math.max(0, r.width - padX * 2);
      const availH = Math.max(0, r.height - padY * 2);
      const a = 210;
      const b = 297;
      const w = Math.max(0, availW - 6);
      const hIdeal = (w * b) / a;
      const h = Math.min(availH, hIdeal);
      const nw = Math.max(176, Math.floor(w));
      const nh = Math.max(220, Math.floor(h));
      setSheetSize((prev) => (prev.w === nw && prev.h === nh ? prev : { w: nw, h: nh }));
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [desktopSwipeLayout]);

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
    if (imprintHoldTimerRef.current) {
      window.clearTimeout(imprintHoldTimerRef.current);
      imprintHoldTimerRef.current = null;
    }
    if (exitAnimTimerRef.current) {
      window.clearTimeout(exitAnimTimerRef.current);
      exitAnimTimerRef.current = null;
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
      /* Ne pas setDone ici : le deck peut être vide le temps que refill recharge. */
      void refillIfNeeded(nextDeck);
      return nextDeck;
    });
  }

  const completeFlyoffCleanup = useCallback(() => {
    setFlyoff(null);
    setCardImprint(null);
    setStampDropping(false);
    transitionInFlightRef.current = false;
  }, []);

  type ApplyVoteArgs = {
    value: 1 | -1;
    kind: StampKind;
    imprint: StampImprint | null;
    holdMs: number;
    /** Si défini : vote déclenché par glisser la carte (pas de tampon centré). */
    fromPan?: { x: number; y: number } | null;
  };

  function applyTransitionVote(args: ApplyVoteArgs) {
    const { value, kind, imprint, holdMs: holdImprintMs, fromPan } = args;
    if (!current || flyoff || transitionInFlightRef.current) return;

    setRhInsight(null);

    const centerImprint: StampImprint = { kind, x: 50, y: 52 };
    const resolvedImprint = imprint ?? (fromPan != null ? null : centerImprint);

    const holdMs = Math.max(0, holdImprintMs);
    transitionInFlightRef.current = true;
    const profileId = current.profile.id;
    markProfileVoted(profileId);
    const item = current;
    const fp = fromPan ?? { x: 0, y: 0 };

    if (resolvedImprint) {
      setCardImprint(resolvedImprint);
    } else {
      setCardImprint(null);
    }

    setPan({ x: 0, y: 0 });
    panRef.current = { x: 0, y: 0 };

    if (imprintHoldTimerRef.current) {
      window.clearTimeout(imprintHoldTimerRef.current);
      imprintHoldTimerRef.current = null;
    }
    if (exitAnimTimerRef.current) {
      window.clearTimeout(exitAnimTimerRef.current);
      exitAnimTimerRef.current = null;
    }

    imprintHoldTimerRef.current = window.setTimeout(() => {
      imprintHoldTimerRef.current = null;
      flyoffCardRectRef.current = cardDropRef.current?.getBoundingClientRect() ?? null;
      setFlyoff({
        item,
        voteValue: value,
        fromX: fp.x,
        fromY: fp.y,
        phase: "enter",
      });
      consumeTopAndRefill();

      void sendVote(profileId, value).then((vr) => {
        if (!vr.ok) {
          unmarkProfileVoted(profileId);
          if (exitAnimTimerRef.current != null) {
            window.clearTimeout(exitAnimTimerRef.current);
            exitAnimTimerRef.current = null;
          }
          setDeck((prev) => {
            if (prev[0]?.profile.id === item.profile.id) return prev;
            return [item, ...prev];
          });
          setFlyoff(null);
          setCardImprint(null);
          transitionInFlightRef.current = false;
          setCardEnter("idle");
          return;
        }
        setRhInsight(vr.rhMessage ?? null);
      });
    }, holdMs);
  }

  useLayoutEffect(() => {
    if (!flyoff || flyoff.phase !== "enter") return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setFlyoff((f) => (f && f.phase === "enter" ? { ...f, phase: "fall" } : f));
        /* Tampon : ne pas laisser l’empreinte visible une fois la carte en mouvement. */
        setCardImprint(null);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [flyoff]);

  useEffect(() => {
    if (!flyoff || flyoff.phase !== "fall") return;
    if (exitAnimTimerRef.current) {
      window.clearTimeout(exitAnimTimerRef.current);
      exitAnimTimerRef.current = null;
    }
    exitAnimTimerRef.current = window.setTimeout(() => {
      exitAnimTimerRef.current = null;
      completeFlyoffCleanup();
      setCardEnter("from");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setCardEnter("to");
        });
      });
    }, FALL_EXIT_MS + 30);
    return () => {
      if (exitAnimTimerRef.current) {
        window.clearTimeout(exitAnimTimerRef.current);
        exitAnimTimerRef.current = null;
      }
    };
  }, [flyoff?.item.profile.id, flyoff?.phase, completeFlyoffCleanup]);

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
    if (!current || flyoff || stampDropping) {
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
      void applyTransitionVote({
        value: vote,
        kind,
        imprint: fallbackImprint,
        holdMs: STAMP_IMPRINT_HOLD_MS,
      });
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
      void applyTransitionVote({
        value: vote,
        kind,
        imprint,
        holdMs: STAMP_IMPRINT_HOLD_MS,
      });
    }, STAMP_DROP_DELAY_MS);
  }

  function startStampDrag(
    kind: StampKind,
    pointerType: "mouse" | "touch",
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ) {
    if (!current || flyoff || stampDropping) return;
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
    returnStampClone();
  }

  function handleStampMouseDown(
    e: React.MouseEvent<HTMLButtonElement>,
    kind: StampKind,
  ) {
    if (!current || flyoff || stampDropping) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    startStampDrag(kind, "mouse", e.clientX, e.clientY, rect);
  }

  function handleStampTouchStart(
    e: React.TouchEvent<HTMLButtonElement>,
    kind: StampKind,
  ) {
    if (!current || flyoff || stampDropping) return;
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
    if (stampDragRef.current || stampDropping || !current || flyoff) return;
    const rect = cardDropRef.current?.getBoundingClientRect();
    if (!rect) {
      const vote = kind === "approved" ? 1 : -1;
      void applyTransitionVote({
        value: vote,
        kind,
        imprint: null,
        holdMs: STAMP_IMPRINT_HOLD_MS,
      });
      return;
    }
    beginStampDrop(
      kind,
      rect.left + rect.width / 2,
      rect.top + rect.height * 0.56,
    );
  }

  function onTopCardPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (flyoff || transitionInFlightRef.current) return;
    if (stampDragRef.current || stampDropping) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    cardPanPointerRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      pan0x: panRef.current.x,
      pan0y: panRef.current.y,
    };
    setCardPanning(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onTopCardPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const c = cardPanPointerRef.current;
    if (!c || c.id !== e.pointerId) return;
    const dx = e.clientX - c.startX + c.pan0x;
    const dy = e.clientY - c.startY + c.pan0y;
    const next = { x: dx, y: dy };
    panRef.current = next;
    setPan(next);
  }

  function onTopCardPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const c = cardPanPointerRef.current;
    if (!c || c.id !== e.pointerId) return;
    cardPanPointerRef.current = null;
    setCardPanning(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const thr = Math.max(56, Math.floor(sheetSize.w * 0.22));
    const px = panRef.current.x;
    let vote: 1 | -1 | null = null;
    let sk: StampKind | null = null;
    if (px > thr) {
      vote = 1;
      sk = "approved";
    } else if (px < -thr) {
      vote = -1;
      sk = "declined";
    }
    if (vote !== null && sk !== null && current) {
      void applyTransitionVote({
        value: vote,
        kind: sk,
        imprint: null,
        holdMs: 0,
        fromPan: { x: panRef.current.x, y: panRef.current.y },
      });
    } else {
      const reset = { x: 0, y: 0 };
      panRef.current = reset;
      setPan(reset);
    }
  }

  function onTopCardPointerLostCapture(e: React.PointerEvent<HTMLDivElement>) {
    if (cardPanPointerRef.current?.id !== e.pointerId) return;
    cardPanPointerRef.current = null;
    setCardPanning(false);
    const reset = { x: 0, y: 0 };
    panRef.current = reset;
    setPan(reset);
  }

  const freeLeft = Math.max(0, FREE_SWIPE_LIMIT - freeSwipesUsed);
  const likesLeft = Math.max(0, AUTH_LIKES_PER_DAY - likesToday);

  useEffect(() => {
    setCardEnter("idle");
    const z = { x: 0, y: 0 };
    panRef.current = z;
    setPan(z);
  }, [current?.profile.id]);

  useEffect(() => {
    const url = deck[1]?.cvUrl;
    if (!url || typeof document === "undefined") return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url;
    document.head.appendChild(link);
    return () => {
      try {
        document.head.removeChild(link);
      } catch {
        /* ignore */
      }
    };
  }, [deck[1]?.cvUrl]);

  function onTopCardEnterTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "transform") return;
    if (cardEnter === "to") setCardEnter("idle");
  }

  function dismissOnboarding() {
    try {
      localStorage.setItem("rs_swipe_onboarding_seen", "1");
    } catch {
      /* ignore */
    }
    setShowOnboarding(false);
  }

  return (
    <div
      id="rs-swipe-page"
      ref={sheetMeasureRef}
      className="rs-swipe-page-root relative flex h-[calc(100dvh-var(--rs-swipe-top-offset,56px))] max-h-[calc(100dvh-var(--rs-swipe-top-offset,56px))] w-full min-w-0 max-w-full flex-col overflow-hidden overscroll-y-contain"
    >
      <SwipeWelcomeModal open={showOnboarding} onDismiss={dismissOnboarding} />
      {message.trim() ? (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 px-3 pt-1">
          <div className="mx-auto flex max-w-xl justify-end">
            <div className="pointer-events-auto rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">
              {message}
            </div>
          </div>
        </div>
      ) : null}

      {rhInsight ? (
        <div
          className={`pointer-events-none fixed right-3 z-[10260] max-w-[min(320px,52vw)] transition-opacity ease-out sm:right-4 ${
            rhInsightFadedIn ? "opacity-100" : "opacity-0"
          }`}
          style={{
            top: "calc(var(--rs-swipe-top-offset, 56px) + 8px)",
            transitionDuration: `${RH_INSIGHT_FADE_MS}ms`,
          }}
          role="status"
          aria-live="polite"
        >
          <p className="rounded-lg border border-[#ddd] bg-white/85 px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug text-[#0A0A0A] shadow-md backdrop-blur-sm sm:text-xs">
            {rhInsight}
          </p>
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
              <a href="/depot" className="rs-btn rs-btn--primary text-sm font-semibold">
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
      ) : !current && nextCardLoading && hasLoadedProfiles ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <div className="rs-swipe-loader-panel w-full max-w-md">
            <div className="rs-swipe-loader-title">Chargement du prochain CV…</div>
            <p className="rs-swipe-loader-sub">Patiente quelques secondes.</p>
            <div className="rs-swipe-loader-track">
              <div className="rs-swipe-loader-bar" />
            </div>
          </div>
        </div>
      ) : blockedByFreeLimit ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <div className="w-full max-w-md rounded-lg border border-[#ddd] bg-white p-6">
            <div className="text-lg font-black">
              Connecte-toi pour continuer à voter.
            </div>
            <p className="mt-2 text-sm text-[#0A0A0A]/85">
              Tu as utilisé {freeSwipesUsed} swipes gratuits sur {FREE_SWIPE_LIMIT}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/connexion" className="rs-btn rs-btn--ghost text-sm font-semibold">
                Se connecter / créer un compte
              </a>
              <a href="/mon-espace" className="rs-btn rs-btn--primary text-sm font-semibold">
                Ouvrir mon espace
              </a>
            </div>
          </div>
        </div>
      ) : done || !current ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          {!hasLoadedProfiles ? (
            <div
              className="w-full max-w-md rounded-[8px] border border-[#F0F0F0] bg-[#FAFAFA] p-6 text-center"
              style={{
                fontFamily: "var(--font-body), ui-sans-serif, system-ui, sans-serif",
              }}
            >
              <p className="text-base font-semibold text-[#0A0A0A]">
                Pas de profil à voter pour l&apos;instant.
              </p>
              <p className="mt-2 text-sm font-normal text-[#6B6B6B]">
                Reviens demain ou dépose ton CV
              </p>
              <a
                href="/depot"
                className="rs-on-pink mt-5 inline-flex w-full items-center justify-center rounded-[6px] bg-[#F472B6] px-4 py-2.5 text-sm font-medium text-white no-underline hover:bg-[#ec4899] hover:text-white hover:no-underline"
              >
                Déposer mon CV
              </a>
            </div>
          ) : (
            <div
              className="w-full max-w-md rounded-[8px] border border-[#F0F0F0] bg-[#FAFAFA] p-6 text-center"
              style={{
                fontFamily: "var(--font-body), ui-sans-serif, system-ui, sans-serif",
              }}
            >
              <p className="text-base font-semibold text-[#0A0A0A]">
                C&apos;est tout pour l&apos;instant.
              </p>
              <p className="mt-2 text-sm font-normal text-[#6B6B6B]">
                Tu as voté sur tous les profils disponibles.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <a
                  href="/profils"
                  className="inline-flex w-full min-w-[140px] flex-1 items-center justify-center rounded-[6px] border border-[#F0F0F0] bg-white px-4 py-2.5 text-sm font-medium text-[#0A0A0A] no-underline sm:w-auto sm:flex-none"
                >
                  Voir les profils
                </a>
                <a
                  href="/depot"
                  className="rs-on-pink inline-flex w-full min-w-[140px] flex-1 items-center justify-center rounded-[6px] bg-[#F472B6] px-4 py-2.5 text-sm font-medium text-white no-underline hover:bg-[#ec4899] hover:text-white hover:no-underline sm:w-auto sm:flex-none"
                >
                  Déposer mon CV
                </a>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`flex min-w-0 max-w-full flex-col items-stretch justify-stretch overflow-hidden px-0 pb-0 pt-0 ${
            desktopSwipeLayout ? "min-h-0 flex-1 py-1 md:py-2" : "min-h-0 flex-1"
          }`}
        >
          <div
            dir="ltr"
            className={`rs-swipe-deck-scroll flex min-w-0 max-w-full items-start justify-center overflow-y-auto overflow-x-hidden pt-0 pb-2 max-md:px-0 md:px-4 md:pb-3 ${
              desktopSwipeLayout ? "min-h-0 flex-1" : "min-h-0 flex-1"
            }`}
          >
            <div
              className="relative mx-auto max-h-[calc(100dvh-var(--rs-swipe-top-offset,56px)-112px)] max-w-full shrink-0 overflow-visible rounded-xl bg-white shadow-sm md:max-h-[calc(100vh-var(--rs-swipe-top-offset,56px)-96px)] md:max-w-[680px]"
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
                if (isTop) {
                  const panRot = pan.x * 0.035;
                  transform = `translate3d(${pan.x}px,${pan.y}px,0) rotate(${panRot}deg)`;
                } else if (deckIdx === 2) {
                  transform = STACK_DECK_BACK;
                } else if (deckIdx === 1) {
                  transform = STACK_DECK_MID;
                } else {
                  transform = "translate(0px, 0px) scale(1)";
                }

                const transformOrigin = "center center";
                const transitionDuration =
                  isTop && cardPanning ? "0ms" : `${CARD_TRANSITION_MS}ms`;
                const transitionEasing = "ease-out";

                const shellClass =
                  deckIdx === 2
                    ? "h-full w-full select-none overflow-hidden rounded-none border border-zinc-300/90 bg-[#fbfbf9] shadow-[0_1px_0_rgba(0,0,0,0.05),0_14px_28px_-10px_rgba(0,0,0,0.2)]"
                    : deckIdx === 1
                      ? "h-full w-full select-none overflow-hidden rounded-none border border-zinc-300/90 bg-[#fcfcfa] shadow-[0_1px_0_rgba(0,0,0,0.05),0_18px_36px_-12px_rgba(0,0,0,0.22)]"
                      : "h-full w-full select-none overflow-hidden rounded-none border border-zinc-300/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06),0_24px_52px_-14px_rgba(0,0,0,0.28)]";

                const shellFilter =
                  deckIdx === 2 ? "brightness(0.96)" : deckIdx === 1 ? "brightness(0.98)" : undefined;

                const shell = (
                  <div
                    ref={isTop ? cardDropRef : undefined}
                    data-stamp-dropzone={isTop && !flyoff ? "1" : undefined}
                    className={shellClass}
                    style={{
                      transform,
                      transformOrigin,
                      transitionProperty: "transform",
                      transitionDuration,
                      transitionTimingFunction: transitionEasing,
                      filter: shellFilter,
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

                    {isTop && Math.abs(pan.x) > 18 ? (
                      <div
                        className="pointer-events-none absolute inset-0 z-[25]"
                        style={{ opacity: Math.min(1, (Math.abs(pan.x) - 18) / 60) }}
                      >
                        <div
                          className={`absolute top-5 scale-[0.78] sm:top-6 sm:scale-[0.85] ${pan.x > 0 ? "left-2 -rotate-12 sm:left-4" : "right-2 rotate-12 sm:right-4"}`}
                        >
                          <StampVisual
                            kind={pan.x > 0 ? "approved" : "declined"}
                            floating
                            tint
                          />
                        </div>
                      </div>
                    ) : null}

                    {isTop && cardImprint && !flyoff ? (
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
                      <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full border border-zinc-200/80 bg-white/92 px-2.5 py-0.5 text-[11px] font-black tracking-wide text-zinc-900 shadow-sm sm:top-2.5 sm:px-3 sm:text-xs">
                        {normHandle(item.profile.handle)}
                      </div>
                    ) : null}
                  </div>
                );

                return (
                  <div
                    key={item.profile.id}
                    className="absolute inset-0"
                    style={{
                      zIndex: zOuter,
                      pointerEvents: isTop && !flyoff ? "auto" : "none",
                    }}
                  >
                    {isTop ? (
                      <div
                        className={`absolute inset-0 ${
                          cardEnter === "from"
                            ? "rs-swipe-top-enter rs-swipe-top-enter--from"
                            : cardEnter === "to"
                              ? "rs-swipe-top-enter rs-swipe-top-enter--to"
                              : ""
                        }`}
                        onTransitionEnd={onTopCardEnterTransitionEnd}
                      >
                        <div
                          className="absolute inset-0 touch-pan-y"
                          style={{ touchAction: "pan-y" }}
                          onPointerDown={onTopCardPointerDown}
                          onPointerMove={onTopCardPointerMove}
                          onPointerUp={onTopCardPointerUp}
                          onPointerCancel={onTopCardPointerUp}
                          onLostPointerCapture={onTopCardPointerLostCapture}
                        >
                          {shell}
                        </div>
                      </div>
                    ) : (
                      shell
                    )}
                  </div>
                );
              })}

              {flyoff && flyoffCardRectRef.current ? (
                (() => {
                  const rect = flyoffCardRectRef.current!;
                  const vdir = flyoff.voteValue === 1 ? 1 : -1;
                  const vw = typeof window !== "undefined" ? window.innerWidth : 420;
                  const panX = flyoff.fromX;
                  const panY = flyoff.fromY;
                  const enterT = `translate3d(${panX}px,${panY}px,0) rotate(${panX * 0.04}deg) scale(1)`;
                  const fallX = vdir * Math.max(vw * 0.92, 320) + panX * 0.22;
                  const fallY = Math.max(0, panY * 0.2) + 28;
                  const fallR = panX * 0.02 + vdir * 18;
                  const fallT = `translate3d(${fallX}px,${fallY}px,0) rotate(${fallR}deg) scale(0.94)`;
                  const tfm = flyoff.phase === "enter" ? enterT : fallT;
                  const tdur = flyoff.phase === "enter" ? "0ms" : `${FALL_EXIT_MS}ms`;
                  const tease =
                    flyoff.phase === "enter" ? "linear" : "cubic-bezier(0.22, 1, 0.36, 1)";
                  return (
                    <div
                      className="pointer-events-none fixed z-[9500]"
                      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
                    >
                      <div
                        className="h-full w-full overflow-hidden rounded-none border border-zinc-300/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06),0_24px_52px_-14px_rgba(0,0,0,0.28)]"
                        style={{
                          transform: tfm,
                          transformOrigin: "center center",
                          transitionProperty: "transform",
                          transitionDuration: tdur,
                          transitionTimingFunction: tease,
                          opacity: 1,
                        }}
                      >
                        <div className="h-full min-h-0 w-full overflow-hidden rounded-none">
                          <PdfPreview
                            key={`flyoff-${flyoff.item.profile.id}`}
                            url={flyoff.item.cvUrl}
                            mode={swipePdfMode}
                            immersive
                          />
                        </div>
                        <div className="pointer-events-none absolute left-1/2 top-2 z-[48] -translate-x-1/2 rounded-full border border-zinc-200/80 bg-white/92 px-2.5 py-0.5 text-[11px] font-black tracking-wide text-zinc-900 shadow-sm sm:top-2.5 sm:px-3 sm:text-xs">
                          {normHandle(flyoff.item.profile.handle)}
                        </div>
                        {cardImprint ? (
                          <div
                            className="pointer-events-none absolute z-[50]"
                            style={{
                              left: `${cardImprint.x}%`,
                              top: `${cardImprint.y}%`,
                              transform: "translate(-50%, -50%)",
                            }}
                          >
                            <StampImprintVisual kind={cardImprint.kind} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })()
              ) : null}
            </div>
          </div>
          {!blockedByFreeLimit ? (
            <div
              className={`pointer-events-none fixed bottom-2 left-0 right-0 z-[9000] px-2 pb-[max(env(safe-area-inset-bottom),0px)] transition-opacity duration-200 ${
                flyoff ? "opacity-0" : "opacity-100"
              }`}
            >
              <div className="mx-auto flex max-w-[980px] flex-col items-center gap-2 px-2 py-0 sm:px-3">
                <div className="pointer-events-auto flex w-full max-w-xs flex-col items-center gap-1.5">
                  <div className="h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-[#E8E8E8]">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${Math.max(
                          0,
                          ((isConnected ? likesLeft : freeLeft) /
                            (isConnected ? AUTH_LIKES_PER_DAY : FREE_SWIPE_LIMIT)) *
                            100,
                        )}%`,
                        backgroundColor:
                          (isConnected ? likesLeft : freeLeft) <= 2 ? "#F59E0B" : "#f472b6",
                      }}
                    />
                  </div>
                  <span className="max-w-xs px-2 text-center text-[11px] font-medium text-[#6B6B6B]">
                    {isConnected
                      ? likesLeft === 0
                        ? "Reviens demain pour continuer à liker ✦"
                        : likesLeft <= 2
                          ? `Plus que ${likesLeft} like${likesLeft > 1 ? "s" : ""} aujourd'hui !`
                          : `${likesLeft} likes restants aujourd'hui`
                      : freeLeft === 0
                        ? "Reviens demain pour continuer à voter ✦"
                        : freeLeft <= 2
                          ? `Plus que ${freeLeft} vote${freeLeft > 1 ? "s" : ""} aujourd'hui !`
                          : `${freeLeft} votes restants aujourd'hui`}
                  </span>
                </div>
                <div className="pointer-events-auto flex items-end justify-center gap-4 sm:gap-6">
                  <button
                    data-stamp-source="declined"
                    type="button"
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
                      animation:
                        stampDrag || stampDropping
                          ? "none"
                          : "stampWobble 1800ms ease-in-out infinite",
                    }}
                  >
                    <StampVisual kind="declined" muted={activeStampKind === "declined"} />
                  </button>
                  <button
                    data-stamp-source="approved"
                    type="button"
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
                      animation:
                        stampDrag || stampDropping
                          ? "none"
                          : "stampWobble 1800ms ease-in-out infinite",
                    }}
                  >
                    <StampVisual kind="approved" muted={activeStampKind === "approved"} />
                  </button>
                </div>
                <p className="pointer-events-auto max-w-md text-center text-[11px] font-semibold text-[#6B6B6B]">
                  Glisse le tampon sur le CV, ou fais glisser la carte vers la droite (like) ou la
                  gauche (passer).
                </p>
                {isConnected ? (
                  <p className="pointer-events-auto text-center text-xs text-[#0A0A0A]/80">
                    Likes aujourd&apos;hui: {likesToday}/{AUTH_LIKES_PER_DAY}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}

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

