"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import ProfilCvThumb from "@/components/ProfilCvThumb";
import { PortalDesktopPageHeader } from "@/components/PortalDesktopPageHeader";
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
    <div className="mx-auto min-w-0 max-w-7xl space-y-6 overflow-x-hidden pb-2">
      <PortalDesktopPageHeader
        eyebrow="Candidats publiés"
        title="Profils"
        description={
          <>
            Parcours les CV comme sur une vitrine d’offres : deux profils par
            ligne sur grand écran, un sur très petit mobile. Infos à gauche,
            aperçu du PDF à droite dans chaque carte.
          </>
        }
        actions={
          <>
            <label className="sr-only" htmlFor="rs-profils-filter-desktop">
              Filtrer les profils
            </label>
            <input
              id="rs-profils-filter-desktop"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Métier, ville…"
              className="rs-profils-list__search w-full rounded-lg px-4 py-2.5 text-sm text-[var(--rs-logo-blue-deep,#0A0A0A)] placeholder:text-[#0A0A0A]/55"
            />
            <a
              href="/depot"
              className="rs-btn rs-btn--primary shrink-0 whitespace-nowrap px-5 text-center"
            >
              Déposer un CV
            </a>
          </>
        }
        message={
          message ? <p className="text-sm text-red-700">{message}</p> : null
        }
      />

      <div className="rs-panel space-y-4 rounded-xl p-4 sm:p-5 lg:hidden">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--rs-logo-blue-mid,#F472B6)]">
            Candidats publiés
          </p>
          <h1 className="rs-portal-page-hero__title mt-1 text-xl font-black tracking-tight sm:text-2xl">
            Profils
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--rs-logo-blue-deep,#0A0A0A)] opacity-90">
            Parcours les CV comme sur une vitrine d’offres : deux profils par
            ligne sur grand écran, un sur très petit mobile.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="rs-profils-filter">
            Filtrer les profils
          </label>
          <input
            id="rs-profils-filter"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Métier, ville…"
            className="rs-profils-list__search w-full rounded-lg px-4 py-2.5 text-sm text-[var(--rs-logo-blue-deep,#0A0A0A)] placeholder:text-[#0A0A0A]/55"
          />
          <a
            href="/depot"
            className="rs-btn rs-btn--primary shrink-0 whitespace-nowrap px-5 text-center"
          >
            Déposer un CV
          </a>
        </div>
        {message ? (
          <p className="text-sm text-red-700">{message}</p>
        ) : null}
      </div>

      {loading ? (
        <div className="rs-panel rounded-xl p-8 text-sm text-[var(--rs-logo-blue-deep,#0A0A0A)]">
          Chargement des profils…
        </div>
      ) : filtered.length ? (
        <ul className="grid grid-cols-1 items-stretch gap-4 sm:gap-5 md:grid-cols-2">
          {filtered.map((p) => (
            <li key={p.id} className="flex min-h-0 h-full min-w-0">
              <article className="rs-panel rs-profils-card grid min-h-[132px] w-full min-w-0 grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch overflow-hidden rounded-xl max-h-[210px] sm:max-h-[220px]">
                <div className="flex min-h-0 min-w-0 flex-col gap-1.5 overflow-hidden border-r border-[var(--rs-panel-border,#ddd)] p-2.5 sm:gap-2 sm:p-3 md:p-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black leading-tight text-[var(--rs-logo-blue-mid,#F472B6)] sm:text-[13px]">
                      @{p.handle.replace(/^@/, "")}
                    </p>
                    <h2 className="mt-0.5 line-clamp-2 text-[14px] font-black leading-snug text-[var(--rs-logo-blue-deep,#0A0A0A)] sm:mt-1 sm:text-base md:text-lg">
                      {p.job_title}
                    </h2>
                    <p className="mt-1 text-xs text-[#0A0A0A]/70 sm:text-sm">
                      {p.city ?? "—"}
                    </p>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-dashed border-[#ddd]/90 pt-2">
                    {p.portfolio_url ? (
                      <a
                        href={p.portfolio_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rs-btn rs-btn--ghost px-2.5 py-1.5 text-[11px] sm:text-[13px]"
                      >
                        Portfolio
                      </a>
                    ) : null}
                    <a
                      href={`/profil/${p.id}`}
                      className="rs-btn rs-btn--primary px-2.5 py-1.5 text-[11px] sm:text-[13px]"
                    >
                      Ouvrir le CV
                    </a>
                  </div>
                </div>

                <div className="rs-profils-card__preview rs-profils-card__preview--beside relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
                  <ProfilCvThumb profileId={p.id} />
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rs-panel rounded-xl p-8 text-sm text-[var(--rs-logo-blue-deep,#0A0A0A)]">
          Aucun profil publié pour le moment.
        </div>
      )}
    </div>
  );
}
