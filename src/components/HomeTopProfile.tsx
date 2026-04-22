"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TopPayload = {
  ok: boolean;
  profile: {
    id: string;
    handle: string;
    job_title: string;
    likes: number;
  } | null;
};

export function HomeTopProfile() {
  const [data, setData] = useState<TopPayload | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const r = await fetch("/api/profils/top");
      const j = (await r.json().catch(() => ({}))) as TopPayload;
      if (!alive) return;
      setData(j.ok ? j : { ok: true, profile: null });
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  if (!data?.profile) return null;

  const h = data.profile.handle.replace(/^@/, "");

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
              Meilleur profil
            </h2>
          </div>
          <p className="max-w-md text-sm leading-snug text-[var(--gray-600)] sm:text-right">
            La communauté vote en continu — aperçu du profil le plus soutenu sur la
            fenêtre en cours.
          </p>
        </div>
        <div className="rs-home-profiles__card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-[family-name:var(--font-syne)] text-lg font-bold text-[var(--black)]">
                @{h}
              </p>
              <p className="mt-1 text-sm text-[var(--gray-600)]">
                {data.profile.job_title}
              </p>
              <p className="mt-2 text-sm text-[var(--black)]">
                <span className="font-semibold text-[var(--accent)]">
                  {data.profile.likes}
                </span>{" "}
                <span className="text-[var(--gray-600)]">likes (fenêtre en cours)</span>
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Link
              href={`/profil/${encodeURIComponent(data.profile.id)}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] no-underline hover:underline"
            >
              Voir son profil →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
