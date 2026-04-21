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
import "./swipe-stamps.css";
import { SwipeWelcomeModal } from "@/components/SwipeWelcomeModal";

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
type SwipeRelease = { x: number; tilt: number };

function normHandle(h: string) {
  const s = String(h || "").trim().replace(/^@/, "");
  return s ? `@${s}` : "@—";
}

/** Tampon texte overlay (charte swipe moderne). */
function SwipeStampOverlay({ kind }: { kind: StampKind }) {
  const approved = kind === "approved";
  return (
    <div
      className={`rs-swipe-stamp-overlay pointer-events-none select-none whitespace-nowrap rounded-[8px] px-5 py-2 text-[22px] font-extrabold uppercase leading-none text-white opacity-90 sm:text-[28px] sm:px-5 sm:py-2 ${
        approved
          ? "bg-[#F472B6] -rotate-[15deg] shadow-none"
          : "rotate-[15deg] bg-[#0A0A0A] shadow-none"
      }`}
      style={{ fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif", fontWeight: 800 }}
    >
      {approved ? "APPROUVÉ" : "REFUSÉ"}
    </div>
  );
}

/** Pile : même orientation, léger décalage bas-droite par couche (effet « une liasse »). */
const STACK_DECK_BACK = "translate(10px, 12px) scale(0.94)";
const STACK_DECK_MID = "translate(5px, 6px) scale(0.97)";

/** Message RH : durée d’affichage puis fondu de sortie (ms). */
const RH_INSIGHT_DISPLAY_MS = 3000;
const RH_INSIGHT_FADE_MS = 280;

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
  /** Message RH (API /vote) — panneau haut droite, fondu puis disparition auto. */
  const [rhInsight, setRhInsight] = useState<string | null>(null);
  const [rhInsightFadedIn, setRhInsightFadedIn] = useState(false);

  const [outgoing, setOutgoing] = useState<{
    item: SwipeItem;
    dir: 1 | -1;
    imprint: StampImprint;
    /** Tampon = chute verticale ; swipe doigt = même chute + trajectoire latérale (swipe-fall). */
    exitAxis: "down" | "swipe-fall";
    /** Pixel offset / tilt when committing a drag (avoids snap-to-center before exit). */
    exitStartX: number;
    exitStartTilt: number;
    exitDurationMs: number;
    /** After mount, set true on next frames so transform transitions from center (correct left/right slide). */
    slideOut: boolean;
  } | null>(null);
  const startXRef = useRef<number | null>(null);
  const cardDropRef = useRef<HTMLDivElement | null>(null);
  const refillInFlightRef = useRef(false);
  const transitionInFlightRef = useRef(false);
  const DECK_SIZE = 7;
  const PROFILE_FETCH_TIMEOUT_MS = 5000;
  /** Durée d’animation de sortie de carte (swipe / boutons). */
  const SWIPE_CARD_EXIT_MS = 300;
  const CARD_TRANSITION_MS = 300;
  /** Retour au centre si swipe insuffisant (ressort). */
  const SWIPE_SPRING_MS = 280;
  /**
   * Chute verticale : proche d’une chute libre (y ∝ t²) — démarrage lent, accélération croissante.
   * easeInQuad, voisin de la courbe position avec accélération g constante.
   */
  const STAMP_FALL_Y_EASE = "cubic-bezier(0.55, 0.085, 0.68, 0.53)";
  /** Dérive latérale pendant la chute : vitesse horizontale ~uniforme (pas d’accélération latérale). */
  const STAMP_FALL_X_EASE = "linear";
  const SWIPE_SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
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
      const excludeIds = nextDeck.map((i) => i.profile.id);
      const res = await fetchBatch(excludeIds, DECK_SIZE - nextDeck.length);
      if (!res.items.length) {
        /* Vide ≠ « plus rien à swiper » : le deck peut encore contenir des cartes, ou le refill peut échouer (réseau / URL signée). */
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
        setMessage("Limite atteinte: 10 likes par jour. Réessaie demain.");
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
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setMessage(j?.error || "Impossible d’enregistrer le vote.");
      return { ok: false };
    }
    const j = (await r.json().catch(() => ({}))) as {
      rh?: { message?: string };
    };
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
    if (!authReady || !isConnected) return;
    setLikesToday(readLocalInt(likesDayKey));
  }, [authReady, isConnected, likesDayKey]);

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

  const threshold = 120;
  const tilt = Math.max(-12, Math.min(12, dragX / 18));

  function consumeTopAndRefill() {
    setDeck((d) => {
      const nextDeck = d.slice(1);
      /* Ne pas setDone ici : le deck peut être vide le temps que refill recharge ; sinon done reste bloqué à true. */
      void refillIfNeeded(nextDeck);
      return nextDeck;
    });
  }

  function completeOutgoingCleanup() {
    setOutgoing(null);
    transitionInFlightRef.current = false;
  }

  async function applyTransitionVote(
    kind: StampKind,
    value: 1 | -1,
    imprint: StampImprint | null,
    _holdImprintMs: number,
    swipeRelease: SwipeRelease | null,
  ) {
    if (!current || outgoing || transitionInFlightRef.current) return;
    if (!swipeRelease) return;

    setRhInsight(null);

    const resolvedImprint =
      imprint ??
      ({
        kind,
        x: 50,
        y: 48,
      } as StampImprint);

    transitionInFlightRef.current = true;
    const profileId = current.profile.id;
    const item = current;

    setOutgoing({
      item,
      dir: value,
      imprint: resolvedImprint,
      exitAxis: "swipe-fall",
      exitStartX: swipeRelease.x,
      exitStartTilt: swipeRelease.tilt,
      exitDurationMs: SWIPE_CARD_EXIT_MS,
      slideOut: false,
    });
    setDragX(0);
    startXRef.current = null;

    requestAnimationFrame(() => {
      setOutgoing((o) =>
        o && o.item.profile.id === profileId
          ? { ...o, slideOut: true, exitDurationMs: SWIPE_CARD_EXIT_MS }
          : o,
      );
    });

    consumeTopAndRefill();

    void sendVote(profileId, value).then((vr) => {
      if (!vr.ok) {
        transitionInFlightRef.current = false;
        setDeck((prev) => {
          if (prev.some((x) => x.profile.id === profileId)) return prev;
          return [item, ...prev];
        });
        setOutgoing(null);
        return;
      }
      setRhInsight(vr.rhMessage ?? null);
    });

    window.setTimeout(() => {
      completeOutgoingCleanup();
    }, SWIPE_CARD_EXIT_MS + 50);
  }

  function clickStamp(kind: StampKind) {
    if (!current || outgoing || transitionInFlightRef.current) return;
    const vote = kind === "approved" ? 1 : -1;
    const imprint: StampImprint = { kind, x: 50, y: 48 };
    const release: SwipeRelease =
      kind === "approved" ? { x: 280, tilt: 12 } : { x: -280, tilt: -12 };
    void applyTransitionVote(kind, vote, imprint, 0, release);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(18);
    }
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
    "calc(100dvh - var(--rs-swipe-top-offset, 56px) - var(--rs-swipe-bottom-chrome, 140px))";

  const swipePdfMode = "fit-page" as const;

  const freeLeft = Math.max(0, FREE_SWIPE_LIMIT - freeSwipesUsed);
  const likesLeft = Math.max(0, AUTH_LIKES_PER_DAY - likesToday);

  return (
    <div
      id="rs-swipe-page"
      className="rs-swipe-page-root relative flex w-full min-w-0 max-w-full min-h-0 flex-1 flex-col overscroll-y-contain overflow-x-hidden overflow-y-visible bg-[#0A0A0A]"
      style={{ minHeight: swipeChromeHeight }}
    >
      <SwipeWelcomeModal />
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
            top: "calc(var(--rs-swipe-top-offset, 96px) + 8px)",
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
              Créez un compte pour continuer à voter et débloquer les récompenses.
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
                fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
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
                className="mt-5 inline-flex w-full items-center justify-center rounded-[6px] bg-[#F472B6] px-4 py-2.5 text-sm font-medium text-white no-underline hover:opacity-95"
              >
                Déposer mon CV
              </a>
            </div>
          ) : (
            <div
              className="w-full max-w-md rounded-[8px] border border-[#F0F0F0] bg-[#FAFAFA] p-6 text-center"
              style={{
                fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
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
                  className="inline-flex w-full min-w-[140px] flex-1 items-center justify-center rounded-[6px] bg-[#F472B6] px-4 py-2.5 text-sm font-medium text-white no-underline sm:w-auto sm:flex-none"
                >
                  Déposer mon CV
                </a>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col px-3 pb-0 pt-1">
          <div
            dir="ltr"
            className="relative mx-auto flex h-[85dvh] w-full max-w-full shrink-0 overflow-visible rounded-[12px] bg-white"
          >
            <div className="relative h-full w-full overflow-visible">
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
                    ? "h-full w-full select-none overflow-hidden rounded-[12px] border-0 bg-[#f5f5f5] shadow-none"
                    : deckIdx === 1
                      ? "h-full w-full select-none overflow-hidden rounded-[12px] border-0 bg-[#fafafa] shadow-none"
                      : "h-full w-full select-none overflow-hidden rounded-[12px] border-0 bg-white shadow-none";

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
                      <div className="h-full min-h-0 w-full overflow-hidden rounded-[12px]">
                        <PdfPreview
                          key={item.profile.id}
                          url={item.cvUrl}
                          mode={swipePdfMode}
                          immersive
                        />
                      </div>

                      {isTop ? (
                        <div
                          className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-[20px] bg-[#0A0A0A] px-3 py-1 text-[13px] font-medium tracking-wide text-[#F472B6]"
                          style={{
                            fontFamily:
                              "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
                            fontWeight: 500,
                          }}
                        >
                          {normHandle(item.profile.handle)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {outgoing ? (
                <div
                  className="pointer-events-none absolute inset-0 z-[26] overflow-visible"
                  style={{
                    transform:
                      outgoing.slideOut && outgoing.exitAxis === "down"
                        ? "translateY(calc(100vh + 100% + 40px))"
                        : "translateY(0px)",
                    transitionProperty: "transform",
                    transitionDuration: outgoing.slideOut
                      ? `${outgoing.exitDurationMs}ms`
                      : "0ms",
                    transitionTimingFunction: outgoing.slideOut ? STAMP_FALL_Y_EASE : "linear",
                    willChange: "transform",
                  }}
                >
                  <div
                    className="absolute inset-0 select-none overflow-visible rounded-[12px] border-0 bg-white shadow-none"
                    style={{
                      transform: (() => {
                        if (outgoing.exitAxis === "down") {
                          return outgoing.slideOut ? "rotate(2.5deg)" : "rotate(0deg)";
                        }
                        if (outgoing.exitAxis === "swipe-fall") {
                          if (!outgoing.slideOut) {
                            return `translateX(${outgoing.exitStartX}px) rotate(${outgoing.exitStartTilt}deg)`;
                          }
                          const dir = outgoing.dir;
                          const extra = Math.min(Math.abs(outgoing.exitStartX) * 0.38, 160);
                          const xFinal =
                            dir > 0
                              ? `calc(26vw + 12% + ${48 + extra}px)`
                              : `calc(-26vw - 12% - ${48 + extra}px)`;
                          const rot = 2.2 * dir + outgoing.exitStartTilt * 0.35;
                          return `translateX(${xFinal}) rotate(${rot}deg)`;
                        }
                        return "none";
                      })(),
                      transitionProperty: "transform",
                      transitionDuration: outgoing.slideOut
                        ? `${outgoing.exitDurationMs}ms`
                        : "0ms",
                      transitionTimingFunction: outgoing.slideOut ? STAMP_FALL_X_EASE : "linear",
                      willChange: "transform",
                    }}
                  >
                    <div className="h-full min-h-0 w-full overflow-hidden rounded-[12px]">
                      <PdfPreview
                        key={outgoing.item.profile.id}
                        url={outgoing.item.cvUrl}
                        mode={swipePdfMode}
                        immersive
                      />
                    </div>
                    <div
                      className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-[20px] bg-[#0A0A0A] px-3 py-1 text-[13px] font-medium tracking-wide text-[#F472B6]"
                      style={{
                        fontFamily:
                          "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
                        fontWeight: 500,
                      }}
                    >
                      {normHandle(outgoing.item.profile.handle)}
                    </div>
                    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                      <SwipeStampOverlay kind={outgoing.imprint.kind} />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {!blockedByFreeLimit ? (
        <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-[9000] flex flex-col items-center gap-3 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
          <p
            className="text-center text-[12px] font-medium text-[#F472B6]"
            style={{
              fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
            }}
          >
            {isConnected ? (
              <>{likesLeft} likes restants aujourd&apos;hui</>
            ) : (
              <>{freeLeft} swipes gratuits restants</>
            )}
          </p>
          <div className="flex items-center justify-center gap-10 pointer-events-auto">
            <button
              type="button"
              aria-label="Passer"
              disabled={!current || !!outgoing}
              onClick={() => clickStamp("declined")}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#333333] bg-[#1a1a1a] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  d="M6 6l12 12M18 6L6 18"
                />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Approuver"
              disabled={!current || !!outgoing}
              onClick={() => clickStamp("approved")}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F472B6] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 21s-6.716-4.548-9.6-8.4C.452 9.116 2.04 5.5 6 5.5c2.4 0 3.6 1.5 4.8 3 1.2-1.5 2.4-3 4.8-3 3.96 0 5.548 3.616 3.6 7.1C18.716 16.452 12 21 12 21Z"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

