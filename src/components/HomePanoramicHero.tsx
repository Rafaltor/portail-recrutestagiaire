"use client";

import Image from "next/image";
import { HomeImmersiveNav } from "@/components/HomeImmersiveNav";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";

const PANORAMA_SRC = "/room%202.jpg";
const PANORAMA_MIN_WIDTH_RATIO = 1.35;
const MOBILE_MQ = "(max-width: 767.98px)";

type PanoramaMetrics = {
  renderedWidth: number;
  maxOffset: number;
};

function subscribeMobileMq(onStoreChange: () => void) {
  const mq = window.matchMedia(MOBILE_MQ);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getMobileMqSnapshot() {
  return window.matchMedia(MOBILE_MQ).matches;
}

function getMobileMqServerSnapshot() {
  return false;
}

function useIsMobilePanorama() {
  return useSyncExternalStore(
    subscribeMobileMq,
    getMobileMqSnapshot,
    getMobileMqServerSnapshot,
  );
}

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
  const isMobile = useIsMobilePanorama();
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
  const [ready, setReady] = useState(false);

  const clampOffset = useCallback(
    (value: number, max: number) => Math.min(Math.max(value, 0), max),
    [],
  );

  const recalcMetrics = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;

    if (!isMobile) {
      const containerW = el.clientWidth;
      setMetrics({ renderedWidth: containerW, maxOffset: 0 });
      setOffsetX(0);
      if (layerRef.current) {
        layerRef.current.style.width = "100%";
      }
      return;
    }

    const { w, h } = naturalSizeRef.current;
    const next = measurePanorama(el.clientWidth, el.clientHeight, w, h);
    setMetrics(next);
    setOffsetX((prev) => clampOffset(prev, next.maxOffset));
    if (layerRef.current) {
      layerRef.current.style.width = `${next.renderedWidth}px`;
    }
  }, [clampOffset, isMobile]);

  useLayoutEffect(() => {
    recalcMetrics();
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recalcMetrics());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recalcMetrics]);

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
      if (!isMobile) return;
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
    [clampOffset, isMobile, metrics.maxOffset, stopInertia],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isMobile || e.button !== 0) return;
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
    if (!isMobile) return;
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
    if (!isMobile) return;
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    drag.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    startInertia(drag.velocity);
  };

  const layerTransform = isMobile ? `translate3d(${-offsetX}px, 0, 0)` : "none";

  return (
    <section
      className={`rs-home-panorama${isMobile ? " rs-home-panorama--draggable" : " rs-home-panorama--static"}`}
      aria-label="Fond atelier"
    >
      <div
        ref={viewportRef}
        className="rs-home-panorama__viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div
          ref={layerRef}
          className={`rs-home-panorama__layer${ready ? " is-ready" : ""}`}
          style={{
            transform: layerTransform,
            width: isMobile && metrics.renderedWidth
              ? `${metrics.renderedWidth}px`
              : undefined,
          }}
        >
          <Image
            src={PANORAMA_SRC}
            alt=""
            fill
            priority
            draggable={false}
            sizes={isMobile ? "200vw" : "100vw"}
            className={`rs-home-panorama__image object-cover ${isMobile ? "object-left" : "object-center"}`}
            onLoad={(e) => onImageReady(e.currentTarget)}
          />
          <HomeImmersiveNav />
        </div>
      </div>
    </section>
  );
}
