"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Counts = {
  profiles: number | null;
  votes: number | null;
  recruited: number | null;
};

function fmt(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return String(n);
}

/** Icône document — trait 1.75px, même style que les autres. */
function IconCv() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Icône votes (cœur) — même poids de trait que le CV. */
function IconVotes() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPackaging() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type StatRow = {
  key: string;
  value: number | null;
  label: string;
  icon: "cv" | "votes" | "packaging";
};

export function HomeHeroStats() {
  const [counts, setCounts] = useState<Counts>({
    profiles: null,
    votes: null,
    recruited: null,
  });

  useEffect(() => {
    let alive = true;
    async function load() {
      const [profRes, voteRes, recRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "published"),
        supabase
          .from("votes")
          .select("profile_id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .in("status", ["recrute", "recruited", "recruté"]),
      ]);
      if (!alive) return;
      setCounts({
        profiles: profRes.error ? null : profRes.count ?? 0,
        votes: voteRes.error ? null : voteRes.count ?? 0,
        recruited: recRes.error ? null : recRes.count ?? 0,
      });
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const showRecruited =
    counts.recruited !== null &&
    counts.recruited !== undefined &&
    counts.recruited > 0;

  const rows: StatRow[] = [
    {
      key: "profiles",
      value: counts.profiles,
      label: "CV dans la base",
      icon: "cv",
    },
    {
      key: "votes",
      value: counts.votes,
      label: "Votes enregistrés",
      icon: "votes",
    },
    ...(showRecruited
      ? [
          {
            key: "recruited",
            value: counts.recruited,
            label: "Sur le packaging",
            icon: "packaging" as const,
          },
        ]
      : []),
  ];

  const iconEl = (k: StatRow["icon"]) => {
    if (k === "cv") return <IconCv />;
    if (k === "votes") return <IconVotes />;
    return <IconPackaging />;
  };

  return (
    <div className="rs-home-stat-stack" aria-live="polite">
      {rows.map((it) => (
        <div key={it.key} className="rs-home-stat-card">
          <div className="rs-home-stat-card__icon" aria-hidden>
            {iconEl(it.icon)}
          </div>
          <div className="min-w-0">
            <div className="rs-home-stat-card__num">{fmt(it.value)}</div>
            <div className="rs-home-stat-card__label">{it.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
