"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { HomeHeroBackdrop } from "@/components/HomeHeroBackdrop";

function fmt(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return String(n);
}

export function HomeHeroSplit() {
  const [profiles, setProfiles] = useState<number | null>(null);
  const [votes, setVotes] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const [profRes, voteRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "published"),
        supabase.from("votes").select("profile_id", { count: "exact", head: true }),
      ]);
      if (!alive) return;
      setProfiles(profRes.error ? null : profRes.count ?? 0);
      setVotes(voteRes.error ? null : voteRes.count ?? 0);
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const primary =
    "inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#f472b6] px-7 py-3 text-center font-bold text-white no-underline transition-colors hover:bg-[#db2777] hover:no-underline";
  const secondary =
    "inline-flex min-h-[48px] items-center justify-center rounded-full border-[1.5px] border-[#0A0A0A] bg-transparent px-7 py-3 text-center font-bold text-[#0A0A0A] no-underline transition-colors hover:border-[#f472b6] hover:no-underline";

  return (
    <section className="rs-home-hero rs-home-hero--wide relative min-h-[min(100vh,720px)] w-full overflow-hidden md:min-h-[560px]">
      <HomeHeroBackdrop />
      <div className="rs-home-hero__grid--front rs-home-hero__grid relative z-[3] mx-auto grid max-w-[1200px] grid-cols-1 md:grid-cols-[1fr_420px]">
        {/* Colonne gauche */}
        <div className="flex flex-col justify-center bg-white/90 px-6 py-10 backdrop-blur-[6px] md:px-16 md:py-20 md:bg-white/85 lg:pl-16 lg:pr-12">
          <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.14em] text-[#f472b6]">
            Collectif · Paris · 2026
          </p>
          <h1 className="mt-4 max-w-full break-words font-[family-name:var(--font-syne)] text-[44px] font-extrabold leading-[1.05] tracking-tight text-[#0A0A0A] md:text-[64px]">
            On a commencé <span className="text-[#f472b6]">stagiaires.</span>
            <br />
            Pourquoi pas vous ?
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[#6B6B6B]">
            Dépose ton CV. La communauté vote.
            <br />
            Les meilleurs rejoignent le collectif.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/depot" className={primary}>
              Poste ton CV
            </Link>
            <Link href="/profils" className={secondary}>
              Voir les profils
            </Link>
          </div>
        </div>

        {/* Colonne droite */}
        <div className="flex flex-col justify-between bg-[#0A0A0A] px-6 py-8 text-white md:px-10 md:py-12">
          <div>
            <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
              En direct
            </p>
            {/* Mobile : stats en ligne */}
            <div className="mt-4 flex flex-row items-stretch md:mt-6 md:flex-col">
              <div className="min-w-0 flex-1 md:flex-none">
                <p className="font-[family-name:var(--font-syne)] text-[56px] font-extrabold leading-none text-[#f472b6] md:text-[72px]">
                  {fmt(profiles)}
                </p>
                <p className="mt-2 text-sm text-white/90">CVs dans la base</p>
              </div>
              <div
                className="mx-4 w-px shrink-0 self-stretch bg-white/10 md:hidden"
                aria-hidden
              />
              <div
                className="my-6 hidden h-px w-full bg-white/10 md:block"
                aria-hidden
              />
              <div className="min-w-0 flex-1 md:flex-none">
                <p className="font-[family-name:var(--font-syne)] text-[56px] font-extrabold leading-none text-[#f472b6] md:text-[72px]">
                  {fmt(votes)}
                </p>
                <p className="mt-2 text-sm text-white/90">Votes enregistrés</p>
              </div>
            </div>
          </div>
          <div className="mt-10 flex justify-center pt-6 md:mt-auto md:justify-start md:pt-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#22C55E] animate-pulse"
                aria-hidden
              />
              Candidatures ouvertes
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
