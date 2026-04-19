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
  portfolio_url: string | null;
  cv_path: string;
  created_at: string;
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
            "id,handle,job_title,city,portfolio_url,cv_path,created_at",
          )
          .eq("status", "published")
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
      const hay = [p.handle, p.job_title, p.city ?? ""]
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
              ligne sur ordinateur, un sur mobile. Dans chaque carte : infos à
              gauche, aperçu du PDF à droite (sur petit écran : infos puis CV).
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
              placeholder="Métier, ville…"
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
        <ul className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
          {filtered.map((p) => (
            <li key={p.id} className="flex min-h-0 h-full">
              <article className="rs-panel rs-profils-card flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl md:min-h-[300px] md:flex-row md:items-stretch">
                <div className="flex min-w-0 flex-shrink-0 flex-col justify-between gap-4 border-b border-[var(--rs-panel-border,#c5d5e4)] p-5 sm:p-6 md:w-[min(46%,280px)] md:max-w-[50%] md:border-b-0">
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

                <div className="rs-profils-card__preview rs-profils-card__preview--beside relative flex min-h-[280px] flex-1 flex-col overflow-hidden bg-[#fbfbfd] md:min-h-0">
                  <ProfilCvThumb profileId={p.id} />
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
