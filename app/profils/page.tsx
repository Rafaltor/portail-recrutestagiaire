"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import ProfilCvThumb from "@/components/ProfilCvThumb";
import "./profils-list.css";

type Profile = {
  id: string;
  handle: string;
  job_title: string;
  city: string | null;
  tags: string[] | null;
  portfolio_url: string | null;
  cv_path: string;
  created_at: string;
  likes: number | null;
};

export default function ProfilsPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const res = await supabase
          .from("profiles")
          .select(
            "id,handle,job_title,city,tags,portfolio_url,cv_path,created_at,likes",
          )
          .eq("status", "published")
          .order("likes", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(100);
        if (res.error) throw res.error;

        const list = (res.data ?? []) as Profile[];
        if (!alive) return;
        setProfiles(list);
      } catch (e: unknown) {
        setMessage(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return profiles;
    return profiles.filter((p) => {
      const hay = [
        p.handle,
        p.job_title,
        p.city ?? "",
        ...(p.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [profiles, q]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-2">
      <header className="rs-panel overflow-hidden rounded-xl p-5 sm:p-7 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--rs-logo-blue-mid,#1b55c4)]">
              Candidats publiés
            </p>
            <h1 className="rs-profils-list__hero-title mt-1 text-2xl font-black tracking-tight sm:text-3xl">
              Profils
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--rs-logo-blue-deep,#001a57)] opacity-90">
              Parcours les CV comme sur une vitrine d’offres : deux profils par
              ligne sur ordinateur, un par ligne sur mobile. Dans chaque carte :
              aperçu du PDF et détail avec score (sur mobile, aperçu en haut).
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto lg:min-w-[300px]">
            <label className="sr-only" htmlFor="rs-profils-filter">
              Filtrer les profils
            </label>
            <input
              id="rs-profils-filter"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Métier, ville, tag…"
              className="rs-profils-list__search w-full rounded-lg px-4 py-2.5 text-sm text-[var(--rs-logo-blue-deep,#001a57)] placeholder:text-zinc-400"
            />
            <a
              href="/depot"
              className="rs-btn rs-btn--primary shrink-0 whitespace-nowrap px-5 text-center"
            >
              Déposer un CV
            </a>
          </div>
        </div>
        {message ? (
          <p className="mt-4 text-sm text-red-700">{message}</p>
        ) : null}
      </header>

      {loading ? (
        <div className="rs-panel rounded-xl p-8 text-sm text-[var(--rs-logo-blue-deep,#001a57)]">
          Chargement des profils…
        </div>
      ) : filtered.length ? (
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <article className="rs-panel rs-profils-card overflow-hidden rounded-xl">
                <div className="flex flex-col lg:min-h-[300px] lg:flex-row lg:items-stretch">
                  <div className="rs-profils-card__preview relative h-[220px] w-full shrink-0 overflow-hidden bg-[#fbfbfd] sm:h-[260px] lg:h-auto lg:min-h-[300px] lg:w-[min(44%,480px)] lg:max-w-[520px]">
                    <ProfilCvThumb profileId={p.id} />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-5 p-5 sm:p-6">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-black text-[var(--rs-logo-blue-mid,#1b55c4)]">
                            @{p.handle.replace(/^@/, "")}
                          </p>
                          <h2 className="mt-1 text-lg font-black leading-snug text-[var(--rs-logo-blue-deep,#001a57)] sm:text-xl">
                            {p.job_title}
                          </h2>
                          <p className="mt-1.5 text-sm text-zinc-600">
                            {p.city ?? "—"}
                          </p>
                        </div>
                        <div
                          className="rs-profils-score shrink-0 rounded-lg px-3 py-2 text-center"
                          title="Score net (votes de la communauté)"
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--rs-logo-blue-deep,#001a57)] opacity-90">
                            Score
                          </div>
                          <div className="text-[22px] font-black leading-none tabular-nums">
                            {p.likes ?? 0}
                          </div>
                        </div>
                      </div>

                      {p.tags?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {p.tags.slice(0, 10).map((t) => (
                            <span
                              key={t}
                              className="rs-profils-tag rounded-full border px-3 py-1 text-xs font-semibold"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-zinc-200/90 pt-4">
                      {p.portfolio_url ? (
                        <a
                          href={p.portfolio_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rs-btn rs-btn--ghost text-[13px]"
                        >
                          Portfolio
                        </a>
                      ) : null}
                      <a
                        href={`/profil/${p.id}`}
                        className="rs-btn rs-btn--primary text-[13px]"
                      >
                        Ouvrir le CV
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rs-panel rounded-xl p-8 text-sm text-[var(--rs-logo-blue-deep,#001a57)]">
          Aucun profil publié pour le moment.
        </div>
      )}
    </div>
  );
}
