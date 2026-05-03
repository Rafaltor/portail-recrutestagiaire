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
  "text-sm font-semibold text-[#f472b6] underline-offset-2 hover:underline";

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

  if (!data) return null;

  const slots: (ProfileItem | null)[] = [0, 1, 2].map((i) => list[i] ?? null);

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
              className="mt-2 max-w-full break-words font-[family-name:var(--font-syne)] text-lg font-extrabold tracking-tight text-[#0A0A0A] sm:text-3xl"
            >
              Meilleurs profils
            </h2>
          </div>
          <p className="max-w-md text-sm leading-snug text-[#6B6B6B]">
            La communauté vote en continu — les trois profils les plus soutenus.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((profile, idx) => {
            const rankLabel =
              profile?.rank_label || `N°${idx + 1} cette semaine`;
            const badgeTone =
              idx === 0
                ? { bg: "bg-[#f472b6]", text: "text-white" }
                : idx === 1
                  ? { bg: "bg-[#e8e8e8]", text: "text-[#0a0a0a]" }
                  : { bg: "bg-[#f5f5f5]", text: "text-[#6b6b6b]" };

            if (!profile) {
              return (
                <article
                  key={`placeholder-${idx}`}
                  className="flex min-h-[220px] flex-col justify-between rounded-xl border border-dashed border-[#E0E0E0] bg-white/60 p-5"
                >
                  <div>
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${badgeTone.bg} ${badgeTone.text}`}
                    >
                      {rankLabel}
                    </span>
                    <p className="mt-3 text-[15px] font-bold text-[#9A9A9A]">
                      Place à prendre
                    </p>
                    <p className="mt-1 text-xs text-[#9A9A9A]">
                      Dépose ton CV pour entrer dans le classement
                    </p>
                  </div>
                  <div className="mt-4 border-t border-dashed border-[#E0E0E0] pt-4">
                    <Link
                      href="/depot"
                      className={`${ghost} inline-flex items-center gap-1 no-underline`}
                    >
                      Déposer mon CV →
                    </Link>
                  </div>
                </article>
              );
            }

            const h = profile.handle.replace(/^@/, "");
            return (
              <article
                key={profile.id}
                className="flex min-h-[220px] flex-col justify-between rounded-xl border border-[#E8E8E8] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <span
                    className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${badgeTone.bg} ${badgeTone.text}`}
                  >
                    {rankLabel}
                  </span>
                  <p className="mt-3 truncate text-[15px] font-bold text-[#0A0A0A]">
                    @{h}
                  </p>
                  <p className="mt-1 text-xs text-[#6B6B6B]">{profile.job_title}</p>
                  <p className="mt-3 text-sm font-bold text-[#f472b6]">
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
