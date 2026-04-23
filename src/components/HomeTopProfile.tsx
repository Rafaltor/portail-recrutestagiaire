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
  /** @deprecated compat — premier profil */
  profile?: ProfileItem | null;
};

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

  const list =
    data?.profiles?.length ?
      data.profiles
    : data?.profile ?
      [data.profile]
    : [];

  if (!data || list.length === 0) return null;

  return (
    <section
      className="rs-home-profiles"
      aria-labelledby="rs-home-top-profile"
    >
      <div className="rs-home-profiles__inner">
        <div className="rs-home-profiles__head">
          <div>
            <p className="rs-ds-section-label mb-2 text-center sm:text-left">
              En tête du classement
            </p>
            <h2
              id="rs-home-top-profile"
              className="rs-ds-h2 text-center sm:text-left"
            >
              Meilleurs profils
            </h2>
          </div>
          <p className="max-w-md text-sm leading-snug text-[var(--gray-600)] sm:text-right">
            La communauté vote en continu — les trois profils les plus soutenus.
          </p>
        </div>
        <div className="rs-home-profiles__grid">
          {list.map((profile) => {
            const h = profile.handle.replace(/^@/, "");
            return (
              <div key={profile.id} className="rs-home-profiles__card">
                {profile.rank_label ? (
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--gray-500)]">
                    {profile.rank_label}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-[family-name:var(--font-syne)] text-lg font-bold text-[var(--black)]">
                      @{h}
                    </p>
                    <p className="mt-1 text-sm text-[var(--gray-600)]">{profile.job_title}</p>
                    <p className="mt-2 text-sm text-[var(--black)]">
                      <span className="font-semibold text-[var(--accent)]">{profile.likes}</span>{" "}
                      <span className="text-[var(--gray-600)]">likes</span>
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <Link
                    href={`/profil/${encodeURIComponent(profile.id)}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] no-underline hover:underline"
                  >
                    Voir le profil →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
