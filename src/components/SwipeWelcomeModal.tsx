"use client";

import { useEffect, useState } from "react";

const LS_KEY = "swipe_rules_seen";

const RULES = [
  "Vote pour les CVs que tu aimes",
  "10 likes par jour maximum",
  "Ton CV est boosté si tu votes",
  "-10% sur le shop si ton candidat est recruté",
  "Pas de photo · CV PDF uniquement",
];

export function SwipeWelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!window.localStorage.getItem(LS_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(LS_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[20000] flex items-center justify-center px-4 py-6"
      style={{ background: "rgba(10, 10, 10, 0.85)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="swipe-rules-title"
    >
      <div
        className="w-full max-w-[320px] rounded-[12px] bg-white p-6 shadow-none"
        style={{ fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" }}
      >
        <h2
          id="swipe-rules-title"
          className="text-center text-[18px] font-bold leading-snug text-[#0A0A0A]"
        >
          Comment ça marche
        </h2>
        <ul className="mt-4 list-none space-y-2.5 p-0 text-left text-[13px] font-normal leading-snug text-[#0A0A0A]">
          {RULES.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#F472B6]" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-[6px] border-0 bg-[#F472B6] px-4 py-2.5 text-sm font-medium text-white"
        >
          C&apos;est parti
        </button>
      </div>
    </div>
  );
}
