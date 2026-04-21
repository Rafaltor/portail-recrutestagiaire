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

      <div className="rs-panel space-y-4 rounded-[8px] p-4 sm:p-5 lg:hidden">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[2px] text-[#6B6B6B]">
            Candidats publiés
          </p>
          <h1 className="rs-portal-page-hero__title mt-1 text-xl font-bold tracking-tight sm:text-2xl">
            Profils
          </h1>
          <p className="mt-2 max-w-xl text-sm font-normal leading-relaxed text-[#6B6B6B]">
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
            className="rs-profils-list__search w-full rounded-[6px] border border-[#F0F0F0] bg-white px-4 py-2.5 text-sm text-[#0A0A0A] placeholder:text-[#6B6B6B]/70"
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
        <div className="rounded-[8px] border border-[#F0F0F0] bg-[#FAFAFA] p-8 text-sm text-[#6B6B6B]">
          Chargement des profils…
        </div>
      ) : ranked.length ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          {ranked.map((p) => {
            const handle = p.handle.replace(/^@/, "");
            const rank = rankById.get(p.id) ?? 0;
            const likes = Number(p.likes ?? 0);
            return (
              <li key={p.id} className="min-w-0">
                <article className="flex h-full min-w-0 flex-col rounded-[8px] border border-[#F0F0F0] bg-[#FAFAFA] p-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="truncate text-base font-bold text-[#0A0A0A]">
                      @{handle}
                    </p>
                    <span className="rs-pill max-w-[min(100%,220px)] truncate">
                      {p.job_title}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] font-normal text-[#6B6B6B]">
                    {p.city ?? "—"}
                  </p>
                  <p className="mt-2 text-sm font-medium text-[#0A0A0A]">
                    <span className="font-bold text-[#F472B6]">{likes}</span>{" "}
                    likes · rang{" "}
                    <span className="font-bold text-[#F472B6]">#{rank}</span>
                  </p>
                  {p.portfolio_url ? (
                    <a
                      href={p.portfolio_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex w-fit text-xs font-medium text-[#F472B6] no-underline hover:underline"
                    >
                      Portfolio
                    </a>
                  ) : null}
                  <div className="mt-4 flex flex-col items-stretch gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => onOpenCv(e, p.id)}
                      className="w-full rounded-[6px] border border-[#F0F0F0] bg-white px-4 py-2.5 text-center text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-[#FAFAFA]"
                    >
                      Voir le CV
                    </button>
                    <Link
                      href="/swipe"
                      className="text-center text-[12px] font-normal text-[#F472B6] no-underline hover:underline"
                    >
                      Voter
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-[8px] border border-[#F0F0F0] bg-[#FAFAFA] p-8 text-sm text-[#6B6B6B]">
          Aucun profil publié pour le moment.
        </div>
      )}
    </div>
  );
}
