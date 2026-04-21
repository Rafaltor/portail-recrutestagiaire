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
    counts.recruited !== null && counts.recruited !== undefined && counts.recruited > 0;

  const items = [
    { value: counts.profiles, label: "profils" },
    { value: counts.votes, label: "votes" },
    ...(showRecruited ? [{ value: counts.recruited, label: "recrutés" as const }] : []),
  ];

  return (
    <div
      className="mt-10 flex flex-wrap items-center justify-center gap-x-0 gap-y-2 text-sm sm:flex-nowrap"
      aria-live="polite"
    >
      {items.map((it, i) => (
        <span key={it.label} className="inline-flex items-center">
          {i > 0 ? (
            <span
              className="mx-3 inline-block h-4 w-px shrink-0 bg-[#F0F0F0] sm:mx-5"
              aria-hidden
            />
          ) : null}
          <span className="inline-flex flex-wrap items-baseline gap-1.5">
            <span className="text-lg font-bold text-[#F472B6] sm:text-xl">
              {fmt(it.value)}
            </span>
            <span className="font-normal text-[#6B6B6B]">{it.label}</span>
          </span>
        </span>
      ))}
    </div>
  );
}
