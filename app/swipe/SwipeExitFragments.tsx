"use client";

import { useEffect, useRef } from "react";

const DURATION_MS = 400;

type Piece = {
  cx: number;
  cy: number;
  verts: { x: number; y: number }[];
  vx: number;
  vy: number;
  vrot: number;
  delay: number;
};

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function jitter(n: number, amt: number) {
  return n + (Math.random() * 2 - 1) * amt;
}

/** Voronoi-like mix: grid cells, some split into two triangles. */
function buildPieces(w: number, h: number): Piece[] {
  const cols = 7;
  const rows = 6;
  const pieces: Piece[] = [];
  const cw = w / cols;
  const ch = h / rows;

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const ox = i * cw + (Math.random() - 0.5) * (cw * 0.08);
      const oy = j * ch + (Math.random() - 0.5) * (ch * 0.08);
      const rw = Math.min(w - ox, jitter(cw, cw * 0.12));
      const rh = Math.min(h - oy, jitter(ch, ch * 0.12));
      const cx = ox + rw / 2;
      const cy = oy + rh / 2;
      const split = Math.random() < 0.42;

      const vx = jitter(-220 - Math.random() * 420, 80);
      const vy = jitter(-40 + Math.random() * 140, 50);
      const vrot = jitter((Math.random() > 0.5 ? 1 : -1) * (1.8 + Math.random() * 3.2), 0.6);
      const delay = Math.random() * 55;

      if (!split) {
        pieces.push({
          cx,
          cy,
          verts: [
            { x: -rw / 2, y: -rh / 2 },
            { x: rw / 2, y: -rh / 2 },
            { x: rw / 2, y: rh / 2 },
            { x: -rw / 2, y: rh / 2 },
          ],
          vx,
          vy,
          vrot,
          delay,
        });
      } else {
        const d = Math.random() < 0.5;
        if (d) {
          pieces.push({
            cx,
            cy,
            verts: [
              { x: -rw / 2, y: -rh / 2 },
              { x: rw / 2, y: -rh / 2 },
              { x: rw / 2, y: rh / 2 },
            ],
            vx: vx * 0.92,
            vy: vy * 0.88,
            vrot: vrot * 1.1,
            delay,
          });
          pieces.push({
            cx,
            cy,
            verts: [
              { x: -rw / 2, y: -rh / 2 },
              { x: rw / 2, y: rh / 2 },
              { x: -rw / 2, y: rh / 2 },
            ],
            vx: vx * 1.05,
            vy: vy * 1.12,
            vrot: -vrot * 0.95,
            delay: delay + 12,
          });
        } else {
          pieces.push({
            cx,
            cy,
            verts: [
              { x: -rw / 2, y: -rh / 2 },
              { x: rw / 2, y: -rh / 2 },
              { x: -rw / 2, y: rh / 2 },
            ],
            vx: vx * 1.02,
            vy,
            vrot: vrot * 0.9,
            delay,
          });
          pieces.push({
            cx,
            cy,
            verts: [
              { x: rw / 2, y: -rh / 2 },
              { x: rw / 2, y: rh / 2 },
              { x: -rw / 2, y: rh / 2 },
            ],
            vx: vx * 0.88,
            vy: vy * 1.05,
            vrot: -vrot,
            delay: delay + 10,
          });
        }
      }
    }
  }
  return pieces;
}

type Props = {
  width: number;
  height: number;
};

/**
 * White geometric fragments with #0A0A0A stroke, explosion left, 400ms (parent-driven timing).
 */
export function SwipeExitFragments({ width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const piecesRef = useRef<Piece[]>([]);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const w = Math.max(32, Math.floor(width));
    const h = Math.max(32, Math.floor(height));
    piecesRef.current = buildPieces(w, h);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    startRef.current = performance.now();

    function frame(now: number) {
      const c = canvasRef.current;
      if (!c) return;
      const ctx2 = c.getContext("2d");
      if (!ctx2) return;
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = Math.min(1, (now - startRef.current) / DURATION_MS);
      ctx2.clearRect(0, 0, w, h);
      ctx2.fillStyle = "#0a0a0a";
      ctx2.fillRect(0, 0, w, h);

      const pieces = piecesRef.current;
      for (const p of pieces) {
        const span = DURATION_MS - p.delay;
        const u = span <= 4 ? t : Math.max(0, Math.min(1, (t * DURATION_MS - p.delay) / span));
        const e = easeOutCubic(u);
        const dx = p.vx * e;
        const dy = p.vy * e + 520 * e * e;
        const rot = p.vrot * e * 6.5;
        ctx2.save();
        ctx2.translate(p.cx + dx, p.cy + dy);
        ctx2.rotate(rot);
        ctx2.beginPath();
        const v = p.verts;
        ctx2.moveTo(v[0].x, v[0].y);
        for (let k = 1; k < v.length; k++) ctx2.lineTo(v[k].x, v[k].y);
        ctx2.closePath();
        ctx2.fillStyle = "#ffffff";
        ctx2.fill();
        ctx2.strokeStyle = "#0A0A0A";
        ctx2.lineWidth = 1.25;
        ctx2.stroke();
        ctx2.restore();
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      }
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 block h-full w-full touch-none"
      aria-hidden
    />
  );
}

export const SWIPE_DECLINE_ANIM_MS = DURATION_MS;
