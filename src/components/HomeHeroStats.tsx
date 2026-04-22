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

type StatRow = {
  key: string;
  value: number | null;
  label: string;
  icon: string;
  tone: "accent" | "ink" | "muted";
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
      icon: "📄",
      tone: "accent",
    },
    {
      key: "votes",
      value: counts.votes,
      label: "Votes enregistrés",
      icon: "↑",
      tone: "ink",
    },
    ...(showRecruited
      ? [
          {
            key: "recruited",
            value: counts.recruited,
            label: "Sur le packaging",
            icon: "🎽",
            tone: "muted" as const,
          },
        ]
      : []),
  ];

  return (
    <div className="rs-home-stat-stack" aria-live="polite">
      {rows.map((it) => (
        <div key={it.key} className="rs-home-stat-card">
          <div
            className={`rs-home-stat-card__icon rs-home-stat-card__icon--${it.tone}`}
            aria-hidden
          >
            {it.icon}
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
