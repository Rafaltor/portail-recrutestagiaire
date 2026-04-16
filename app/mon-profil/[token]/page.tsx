"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ApiPayload = {
  profile: {
    id: string;
    handle: string;
    jobTitle: string;
    city: string | null;
    status: string;
    createdAt: string;
  };
  stats: {
    cvViews: number;
    likes: number;
    dislikes: number;
    score: number;
    likesRatio: number | null;
    hasVotes: boolean;
    rank: number | null;
    totalRanked: number;
  };
};

type HistoryPayload = {
  items: Array<{
    id: string;
    versionIndex: number;
    createdAt: string;
    handle: string;
    jobTitle: string;
    city: string | null;
    status: string;
    cvPath: string;
    likes: number;
    dislikes: number;
    score: number;
  }>;
  evolution: Array<{
    id: string;
    deltaLikes: number | null;
    deltaDislikes: number | null;
    deltaScore: number | null;
  }>;
};

const ratioLabel = (value: number | null) => {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
};

export default function MonProfilTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<ApiPayload | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(`/api/mon-profil/${encodeURIComponent(token)}`, {
          method: "GET",
        });
        if (r.status === 404) {
          throw new Error("Token invalide ou profil introuvable.");
        }
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || "Erreur serveur");
        }
        const j = (await r.json()) as ApiPayload;
        if (!alive) return;
        setData(j);
      } catch (e: unknown) {
        if (!alive) return;
        setData(null);
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void run();
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    let alive = true;
    async function loadHistoryIfAuthenticated() {
      setHistory(null);
      setHistoryError("");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!alive) return;
      if (!session?.access_token) {
        setUserEmail("");
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!alive) return;
      setUserEmail(userData.user?.email ?? "");
      setHistoryLoading(true);
      const r = await fetch(`/api/mon-profil/${encodeURIComponent(token)}/history`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!alive) return;
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setHistoryError(j?.error || "Impossible de charger l'historique.");
        setHistoryLoading(false);
        return;
      }
      const j = (await r.json()) as HistoryPayload;
      if (!alive) return;
      setHistory(j);
      setHistoryLoading(false);
    }
    void loadHistoryIfAuthenticated();
    return () => {
      alive = false;
    };
  }, [token]);

  const voteSummary = useMemo(() => {
    if (!data?.stats.hasVotes) return "Aucun vote pour le moment.";
    return `${data.stats.likes} likes / ${data.stats.dislikes} dislikes`;
  }, [data]);

  return (
    <div className="grid gap-4 md:gap-6">
      <section className="rs-panel rounded-lg p-4 md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-black tracking-tight md:text-2xl">
              Mon profil (privé)
            </h1>
            <p className="mt-1 text-xs text-zinc-700 md:text-sm">
              Lien personnel: statistiques en temps réel.
            </p>
          </div>
          <Link
            href="/profils"
            className="inline-flex w-fit rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-zinc-100 md:text-sm"
          >
            Voir le classement public
          </Link>
        </div>
      </section>

      {loading ? (
        <section className="rs-panel rounded-lg p-4 text-sm text-zinc-700 md:p-6">
          Chargement des stats…
        </section>
      ) : error ? (
        <section className="rs-panel rounded-lg border border-red-200 p-4 text-sm text-red-700 md:p-6">
          {error}
        </section>
      ) : data ? (
        <>
          <section className="rs-panel rounded-lg p-4 md:p-6">
            <p className="text-xs font-black uppercase tracking-wider text-zinc-600">
              Profil
            </p>
            <h2 className="mt-2 text-lg font-black md:text-xl">
              @{data.profile.handle.replace(/^@/, "")}
            </h2>
            <p className="mt-1 text-sm text-zinc-700">{data.profile.jobTitle}</p>
            <p className="mt-1 text-sm text-zinc-700">
              {data.profile.city ? data.profile.city : "Ville non renseignée"}
            </p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rs-panel rounded-lg p-4 md:p-5">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-600">
                Vues CV
              </p>
              <p className="mt-2 text-2xl font-black">{data.stats.cvViews}</p>
            </article>
            <article className="rs-panel rounded-lg p-4 md:p-5">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-600">
                Ratio likes
              </p>
              <p className="mt-2 text-2xl font-black">
                {ratioLabel(data.stats.likesRatio)}
              </p>
              <p className="mt-1 text-xs text-zinc-700">{voteSummary}</p>
            </article>
            <article className="rs-panel rounded-lg p-4 md:p-5 sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-600">
                Classement
              </p>
              <p className="mt-2 text-2xl font-black">
                {data.stats.rank ? `#${data.stats.rank}` : "Non classé"}
              </p>
              <p className="mt-1 text-xs text-zinc-700">
                sur {data.stats.totalRanked} profils publiés
              </p>
            </article>
          </section>

          {!data.stats.hasVotes ? (
            <section className="rs-panel rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 md:p-6">
              Aucun vote encore. Partage ton profil pour lancer les votes.
            </section>
          ) : null}

          <section className="rs-panel rounded-lg p-4 md:p-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-700">
              Historique & évolutions (compte requis)
            </h3>
            {!userEmail ? (
              <div className="mt-3 text-sm text-zinc-700">
                <p>Connecte-toi pour voir l'historique complet de tes versions de CV.</p>
                <a
                  href={`/connexion?token=${encodeURIComponent(token)}&profileUrl=${encodeURIComponent(
                    typeof window !== "undefined"
                      ? `${window.location.origin}/mon-profil/${token}`
                      : `/mon-profil/${token}`,
                  )}`}
                  className="mt-2 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-100"
                >
                  Se connecter / créer un compte
                </a>
              </div>
            ) : historyLoading ? (
              <p className="mt-3 text-sm text-zinc-700">Chargement de l'historique…</p>
            ) : historyError ? (
              <p className="mt-3 text-sm text-red-700">{historyError}</p>
            ) : history?.items?.length ? (
              <div className="mt-3 grid gap-3">
                {history.items.map((item) => {
                  const evo = history.evolution.find((e) => e.id === item.id) ?? null;
                  return (
                    <article
                      key={item.id}
                      className="rounded-md border border-zinc-200 bg-white p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold">
                          Version {item.versionIndex} —{" "}
                          {new Date(item.createdAt).toLocaleDateString("fr-FR")}
                        </div>
                        <div className="text-xs text-zinc-600">score {item.score}</div>
                      </div>
                      <div className="mt-1 text-xs text-zinc-700">
                        {item.likes} likes / {item.dislikes} dislikes
                        {evo
                          ? ` · Δ likes ${evo.deltaLikes ?? "—"} · Δ dislikes ${evo.deltaDislikes ?? "—"} · Δ score ${evo.deltaScore ?? "—"}`
                          : ""}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-700">
                Aucune version historique disponible.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
