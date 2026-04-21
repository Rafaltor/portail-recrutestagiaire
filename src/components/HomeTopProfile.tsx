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
    <section className="mt-12 border-t border-[#F0F0F0] pt-12" aria-labelledby="rs-home-top-profile">
      <p className="text-center text-[12px] font-medium uppercase tracking-[2px] text-[#6B6B6B]">
        En tête du classement
      </p>
      <h2
        id="rs-home-top-profile"
        className="mt-2 text-center text-xl font-bold tracking-tight text-[#0A0A0A] sm:text-2xl"
      >
        Meilleur profil
      </h2>
      <div className="mx-auto mt-6 max-w-md rounded-[8px] border border-[#F0F0F0] bg-[#FAFAFA] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-[#0A0A0A]">@{h}</p>
            <p className="mt-1 text-sm text-[#6B6B6B]">{data.profile.job_title}</p>
            <p className="mt-2 text-sm text-[#0A0A0A]">
              <span className="font-semibold text-[#F472B6]">{data.profile.likes}</span>{" "}
              <span className="text-[#6B6B6B]">likes (fenêtre en cours)</span>
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Link
            href={`/profil/${encodeURIComponent(data.profile.id)}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-[#F472B6] no-underline hover:underline"
          >
            Voir son profil →
          </Link>
        </div>
      </div>
    </section>
  );
}
