"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ProfilsListDesktopHeader } from "@/components/ProfilsListDesktopHeader";
import "./profils-list.css";

type Profile = {
  id: string;
  handle: string;
  job_title: string;
  city: string | null;
  portfolio_url: string | null;
  cv_path: string;
  created_at: string;
  likes: number | null;
};

async function openCvPdf(profileId: string) {
  const r = await fetch(
    `/api/cv/${encodeURIComponent(profileId)}?intent=preview`,
    { method: "GET" },
  );
  if (!r.ok) return;
  const j = (await r.json().catch(() => ({}))) as { url?: string };
  if (j.url) window.open(j.url, "_blank", "noopener,noreferrer");
}

const searchInputClass =
  "w-full rounded-xl border-[1.5px] border-[#E8E8E8] bg-white px-4 py-2.5 text-sm text-[#0A0A0A] outline-none transition-colors placeholder:text-[#6B6B6B]/70 focus:border-[#f472b6]";

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
            "id,handle,job_title,city,portfolio_url,cv_path,created_at,likes",
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

  const ranked = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const la = Number(a.likes ?? 0);
      const lb = Number(b.likes ?? 0);
      if (lb !== la) return lb - la;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filtered]);

  const rankById = useMemo(() => {
    const m = new Map<string, number>();
    ranked.forEach((p, i) => m.set(p.id, i + 1));
    return m;
  }, [ranked]);

  const onOpenCv = useCallback((e: MouseEvent<HTMLButtonElement>, id: string) => {
    e.preventDefault();
    void openCvPdf(id);
  }, []);

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6 overflow-x-hidden pb-2">
      <ProfilsListDesktopHeader
        filterValue={q}
        onFilterChange={setQ}
        filterInputId="rs-profils-filter-desktop"
        message={
          message ? <p className="text-sm text-red-700">{message}</p> : null
        }
      />

      <div className="space-y-4 rounded-xl border border-[#E8E8E8] bg-white p-4 sm:p-6 lg:hidden">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B]">
            Candidats publiés
          </p>
          <h1 className="mt-1 max-w-full break-words text-xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-2xl">
            Profils
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#6B6B6B]">
            Les meilleurs profils de ta région.
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
            className={searchInputClass}
          />
          <a
            href="/depot"
            className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#f472b6] px-6 py-3 text-center text-sm font-bold text-white no-underline transition-colors hover:bg-[#db2777]"
          >
            Déposer un CV
          </a>
        </div>
        {message ? (
          <p className="text-sm text-red-700">{message}</p>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-xl border border-[#E8E8E8] bg-white p-8 text-sm text-[#6B6B6B]">
          Chargement des profils…
        </div>
      ) : ranked.length ? (
        <ul className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          {ranked.map((p) => {
            const handle = p.handle.replace(/^@/, "");
            const rank = rankById.get(p.id) ?? 0;
            return (
              <li key={p.id} className="min-w-0">
                <article className="relative flex min-h-[140px] overflow-hidden rounded-xl border border-[#E8E8E8] bg-white p-5 pr-7 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-[15px] font-bold text-[#0A0A0A]">
                      @{handle}
                    </p>
                    <span className="mt-2 inline-flex max-w-full rounded-full bg-[#F5F5F5] px-2.5 py-1 text-xs font-medium text-[#0A0A0A]">
                      {p.job_title}
                    </span>
                    <p className="mt-2 text-[13px] text-[#6B6B6B]">{p.city ?? "—"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <p className="text-sm font-bold text-[#f472b6]">
                        Rang #{rank}
                      </p>
                      {p.portfolio_url ? (
                        <a
                          href={p.portfolio_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-[#f472b6] underline-offset-2 hover:underline"
                        >
                          Portfolio
                        </a>
                      ) : null}
                    </div>
                    <div className="my-3 h-px w-full bg-[#E8E8E8]" />
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={(e) => onOpenCv(e, p.id)}
                        className="inline-flex min-h-[40px] items-center justify-center rounded-full border-[1.5px] border-[#0A0A0A] bg-transparent px-5 py-2 text-sm font-bold text-[#0A0A0A] transition-colors hover:border-[#f472b6]"
                      >
                        Voir le CV
                      </button>
                      <Link
                        href="/swipe"
                        className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-[#f472b6] px-5 py-2 text-sm font-bold text-white no-underline transition-colors hover:bg-[#db2777]"
                      >
                        Voter ♥
                      </Link>
                    </div>
                  </div>
                  <div
                    className="pointer-events-none absolute right-0 top-0 h-full w-2 rounded-r-xl bg-[#f472b6]"
                    aria-hidden
                  />
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-[#E8E8E8] bg-white p-8 text-sm text-[#6B6B6B]">
          Aucun profil publié pour le moment.
        </div>
      )}
    </div>
  );
}
