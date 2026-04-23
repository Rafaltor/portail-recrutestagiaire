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
    "inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#f472b6] px-5 py-2.5 text-center text-sm font-bold text-white no-underline transition-colors hover:bg-[#db2777] hover:no-underline sm:min-h-[48px] sm:px-7 sm:py-3 sm:text-base";
  const secondary =
    "inline-flex min-h-[44px] items-center justify-center rounded-full border-[1.5px] border-[#0A0A0A] bg-transparent px-5 py-2.5 text-center text-sm font-bold text-[#0A0A0A] no-underline transition-colors hover:border-[#f472b6] hover:no-underline sm:min-h-[48px] sm:px-7 sm:py-3 sm:text-base";

  return (
    <section className="rs-home-hero rs-home-hero--wide relative min-h-0 w-full overflow-hidden">
      <HomeHeroBackdrop />
      <div className="rs-home-hero__grid--front relative z-[3] flex w-full flex-col">
        {/* Bandeau blanc pleine largeur (texte + CTA) */}
        <div className="w-full border-b border-[#E8E8E8]/40 bg-transparent px-4 py-8 sm:px-8 sm:py-12 md:px-12 md:py-14 lg:px-16">
          <div className="mx-auto min-w-0 w-full max-w-[1200px]">
            <p className="font-[family-name:var(--font-syne)] text-[10px] font-bold uppercase tracking-[0.1em] text-[#f472b6] sm:text-[11px] sm:tracking-[0.14em]">
              Collectif · Paris · 2026
            </p>
            <h1 className="mt-3 max-w-full break-words font-[family-name:var(--font-syne)] text-[clamp(1.15rem,5.2vw,1.65rem)] font-extrabold leading-[1.12] tracking-tight text-[#0A0A0A] sm:mt-4 sm:text-[40px] sm:leading-[1.05] md:text-[56px] lg:text-[64px]">
              On a commencé <span className="text-[#f472b6]">stagiaires.</span>
              <br />
              Pourquoi pas vous ?
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#6B6B6B] sm:mt-5 sm:text-base md:text-lg">
              Dépose ton CV. La communauté vote.
              <br />
              Les meilleurs rejoignent le collectif.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5 sm:mt-8 sm:gap-3">
              <Link href="/depot" className={primary}>
                Poste ton CV
              </Link>
              <Link href="/profils" className={secondary}>
                Voir les profils
              </Link>
            </div>
          </div>
        </div>

        {/* Bandeau noir pleine largeur (stats en ligne) */}
        <div className="w-full bg-transparent px-4 py-6 text-white sm:px-8 sm:py-8 md:px-12 md:py-10 lg:px-16">
          <div className="mx-auto min-w-0 w-full max-w-[1200px]">
            <p className="font-[family-name:var(--font-syne)] text-[10px] font-bold uppercase tracking-[0.1em] text-white/50 sm:text-[11px] sm:tracking-[0.14em]">
              En direct
            </p>
            <div className="mt-4 flex min-w-0 flex-row flex-wrap items-end gap-6 sm:mt-5 sm:gap-12 md:gap-16 lg:gap-24">
              <div className="min-w-0 flex-1 basis-0 sm:flex-none sm:basis-auto">
                <p className="font-[family-name:var(--font-syne)] text-[clamp(2.25rem,14vw,3.25rem)] font-extrabold tabular-nums leading-none tracking-tight text-[#f472b6] sm:text-[52px] md:text-[68px] lg:text-[72px]">
                  {fmt(profiles)}
                </p>
                <p className="mt-1.5 text-xs text-white/90 sm:mt-2 sm:text-sm">CVs dans la base</p>
              </div>
              <div
                className="hidden h-[min(4.5rem,18vw)] w-px shrink-0 self-center bg-white/15 sm:block sm:h-[72px] md:h-[88px]"
                aria-hidden
              />
              <div className="min-w-0 flex-1 basis-0 sm:flex-none sm:basis-auto">
                <p className="font-[family-name:var(--font-syne)] text-[clamp(2.25rem,14vw,3.25rem)] font-extrabold tabular-nums leading-none tracking-tight text-[#f472b6] sm:text-[52px] md:text-[68px] lg:text-[72px]">
                  {fmt(votes)}
                </p>
                <p className="mt-1.5 text-xs text-white/90 sm:mt-2 sm:text-sm">Votes enregistrés</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
