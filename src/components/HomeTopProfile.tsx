"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ProfileItem = {
  id: string;
  handle: string;
  job_title: string;
  likes: number;
  rank_label?: string;
};

type TopPayload = {
  ok: boolean;
  profiles?: ProfileItem[];
  profile?: ProfileItem | null;
};

const ghost =
  "text-sm font-semibold text-[#E11D48] underline-offset-2 hover:underline";

export function HomeTopProfile() {
  const [data, setData] = useState<TopPayload | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const r = await fetch("/api/profils/top");
      const j = (await r.json().catch(() => ({}))) as TopPayload;
      if (!alive) return;
      setData(j.ok ? j : { ok: true, profiles: [] });
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const list = data?.profiles?.length
    ? data.profiles
    : data?.profile
      ? [data.profile]
      : [];

  if (!data || list.length === 0) return null;

  return (
    <section
      className="border-t border-[#E8E8E8] bg-[#F5F5F5] px-4 py-10 sm:px-6 sm:py-12"
      aria-labelledby="rs-home-top-profile"
    >
      <div className="mx-auto max-w-[var(--rs-content-max)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B]">
              En tête du classement
            </p>
            <h2
              id="rs-home-top-profile"
              className="mt-2 max-w-full break-words font-[family-name:var(--font-syne)] text-2xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-3xl"
            >
              Meilleurs profils
            </h2>
          </div>
          <p className="max-w-md text-sm leading-snug text-[#6B6B6B]">
            La communauté vote en continu — les trois profils les plus soutenus.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((profile, idx) => {
            const h = profile.handle.replace(/^@/, "");
            const rankLabel = profile.rank_label || `N°${idx + 1} cette semaine`;
            const badgeIsPink = idx === 0;
            return (
              <article
                key={profile.id}
                className="flex min-h-[220px] flex-col justify-between rounded-xl border border-[#E8E8E8] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <span
                    className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold text-white ${
                      badgeIsPink ? "bg-[#E11D48]" : "bg-[#0A0A0A]"
                    }`}
                  >
                    {rankLabel}
                  </span>
                  <p className="mt-3 truncate text-[15px] font-bold text-[#0A0A0A]">
                    @{h}
                  </p>
                  <p className="mt-1 text-xs text-[#6B6B6B]">{profile.job_title}</p>
                  <p className="mt-3 text-sm font-bold text-[#E11D48]">
                    ♥ {profile.likes} votes
                  </p>
                </div>
                <div className="mt-4 border-t border-[#E8E8E8] pt-4">
                  <Link
                    href={`/profil/${encodeURIComponent(profile.id)}`}
                    className={`${ghost} inline-flex items-center gap-1 no-underline`}
                  >
                    Voir le profil →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
