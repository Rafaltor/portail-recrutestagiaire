"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { PortalAuthLink } from "@/components/PortalAuthLink";
import { supabase } from "@/lib/supabase";

const PANORAMA_SRC = "/room%202.jpg";
const PANORAMA_MIN_WIDTH_RATIO = 1.35;

function fmt(n: number) {
  return String(n);
}

type PanoramaMetrics = {
  renderedWidth: number;
  maxOffset: number;
};

function measurePanorama(
  containerW: number,
  containerH: number,
  naturalW: number,
  naturalH: number,
): PanoramaMetrics {
  const aspect = naturalW / naturalH;
  const heightFitWidth = containerH * aspect;
  const minWidth = containerW * PANORAMA_MIN_WIDTH_RATIO;
  const renderedWidth = Math.max(heightFitWidth, minWidth, containerW);
  const maxOffset = Math.max(0, renderedWidth - containerW);
  return { renderedWidth, maxOffset };
}

export function HomePanoramicHero() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const naturalSizeRef = useRef({ w: 1536, h: 1024 });
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startOffset: 0,
    velocity: 0,
    lastX: 0,
    lastT: 0,
  });
  const rafRef = useRef<number | null>(null);

  const [metrics, setMetrics] = useState<PanoramaMetrics>({
    renderedWidth: 0,
    maxOffset: 0,
  });
  const [offsetX, setOffsetX] = useState(0);
  const [profiles, setProfiles] = useState(0);
  const [votes, setVotes] = useState(0);
  const [ready, setReady] = useState(false);

  const clampOffset = useCallback(
    (value: number, max: number) => Math.min(Math.max(value, 0), max),
    [],
  );

  const recalcMetrics = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { w, h } = naturalSizeRef.current;
    const next = measurePanorama(el.clientWidth, el.clientHeight, w, h);
    setMetrics(next);
    setOffsetX((prev) => clampOffset(prev, next.maxOffset));
    if (layerRef.current) {
      layerRef.current.style.width = `${next.renderedWidth}px`;
    }
  }, [clampOffset]);

  useLayoutEffect(() => {
    recalcMetrics();
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recalcMetrics());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recalcMetrics]);

  useEffect(() => {
    let alive = true;
    async function loadStats() {
      const [profRes, voteRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "published"),
        supabase.from("votes").select("profile_id", { count: "exact", head: true }),
      ]);
      if (!alive) return;
      setProfiles(profRes.error ? 0 : profRes.count ?? 0);
      setVotes(voteRes.error ? 0 : voteRes.count ?? 0);
    }
    void loadStats();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onImageReady = useCallback(
    (img: HTMLImageElement) => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        naturalSizeRef.current = {
          w: img.naturalWidth,
          h: img.naturalHeight,
        };
      }
      setReady(true);
      recalcMetrics();
    },
    [recalcMetrics],
  );

  const stopInertia = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startInertia = useCallback(
    (velocityPxPerMs: number) => {
      stopInertia();
      if (Math.abs(velocityPxPerMs) < 0.08) return;

      let velocity = velocityPxPerMs * 16;
      const step = () => {
        setOffsetX((prev) => {
          const next = clampOffset(prev - velocity, metrics.maxOffset);
          if (next === 0 || next === metrics.maxOffset) velocity = 0;
          return next;
        });
        velocity *= 0.92;
        if (Math.abs(velocity) < 0.35) {
          rafRef.current = null;
          return;
        }
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [clampOffset, metrics.maxOffset, stopInertia],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    stopInertia();
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startOffset: offsetX,
      velocity: 0,
      lastX: e.clientX,
      lastT: performance.now(),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;

    const now = performance.now();
    const dt = Math.max(now - drag.lastT, 1);
    const delta = e.clientX - drag.startX;
    drag.velocity = (e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX;
    drag.lastT = now;

    setOffsetX(clampOffset(drag.startOffset - delta, metrics.maxOffset));
  };

  const finishDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    drag.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    startInertia(drag.velocity);
  };

  const primary =
    "inline-flex min-h-[40px] items-center justify-center rounded-full bg-[#f472b6] px-4 py-2 text-center text-[13px] font-bold leading-tight text-white no-underline shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-colors hover:bg-[#db2777] hover:no-underline sm:min-h-[48px] sm:px-7 sm:py-3 sm:text-base";
  const secondary =
    "inline-flex min-h-[40px] items-center justify-center rounded-full border-[1.5px] border-white/90 bg-white/10 px-4 py-2 text-center text-[13px] font-bold leading-tight text-white backdrop-blur-sm no-underline transition-colors hover:border-white hover:bg-white/20 hover:no-underline sm:min-h-[48px] sm:px-7 sm:py-3 sm:text-base";

  const progress =
    metrics.maxOffset > 0 ? offsetX / metrics.maxOffset : 0;

  const progressStyle = {
    "--rs-panorama-progress": progress,
  } as CSSProperties;

  return (
    <section className="rs-home-panorama" aria-label="Espace atelier panoramique">
      <div
        ref={viewportRef}
        className="rs-home-panorama__viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        role="application"
        aria-roledescription="défilement panoramique"
        aria-label="Fond atelier — glissez horizontalement pour explorer"
      >
        <div
          ref={layerRef}
          className={`rs-home-panorama__layer${ready ? " is-ready" : ""}`}
          style={{
            transform: `translate3d(${-offsetX}px, 0, 0)`,
            width: metrics.renderedWidth ? `${metrics.renderedWidth}px` : undefined,
          }}
        >
          <Image
            src={PANORAMA_SRC}
            alt=""
            fill
            priority
            draggable={false}
            sizes="200vw"
            className="rs-home-panorama__image object-cover object-left"
            onLoad={(e) => onImageReady(e.currentTarget)}
          />
        </div>

        <div className="rs-home-panorama__vignette" aria-hidden />
        <div className="rs-home-panorama__edge rs-home-panorama__edge--left" aria-hidden />
        <div className="rs-home-panorama__edge rs-home-panorama__edge--right" aria-hidden />

        <p className="rs-home-panorama__hint" aria-hidden={metrics.maxOffset <= 0}>
          <span>Glisse pour explorer l&apos;atelier</span>
          <span className="rs-home-panorama__hint-arrows">← →</span>
        </p>

        <div className="rs-home-panorama__progress" aria-hidden style={progressStyle}>
          <span className="rs-home-panorama__progress-fill" />
        </div>

        <div className="rs-home-panorama__overlay">
          <p className="font-[family-name:var(--font-syne)] text-[9px] font-bold uppercase tracking-[0.12em] text-[#f9a8d4] sm:text-[11px] sm:tracking-[0.14em]">
            Collectif · Paris · 2026
          </p>
          <h1
            className="rs-home-panorama__title mt-2 font-[family-name:var(--font-syne)] font-extrabold leading-[1.1] tracking-tight text-white sm:mt-3 sm:leading-[1.05]"
            style={{ fontSize: "clamp(22px, 5.5vw, 56px)" }}
          >
            On a commencé <span className="text-[#f472b6]">stagiaires.</span>
            <br />
            Pourquoi pas vous ?
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85 sm:text-base">
            Dépose ton CV créatif dans le collectif mode & textile parisien.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 sm:mt-7 sm:gap-3">
            <PortalAuthLink href="/depot" mode="signup" className={primary}>
              Poste ton CV
            </PortalAuthLink>
            <Link href="/profils" className={secondary}>
              Voir les profils
            </Link>
          </div>
          <div className="rs-home-panorama__stats" aria-live="polite">
            <div>
              <p className="rs-home-panorama__stat-num">{fmt(profiles)}</p>
              <p className="rs-home-panorama__stat-label">CVs dans la base</p>
            </div>
            <div>
              <p className="rs-home-panorama__stat-num">{fmt(votes)}</p>
              <p className="rs-home-panorama__stat-label">Votes enregistrés</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
