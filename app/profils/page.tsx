"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getOrCreateVisitorId } from "@/lib/visitor";

type Profile = {
  id: string;
  handle: string;
  job_title: string;
  city: string | null;
  tags: string[] | null;
  portfolio_url: string | null;
  cv_path: string;
  created_at: string;
};

type VoteRow = {
  profile_id: string;
  value: number;
};

export default function ProfilsPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<Record<string, 1 | -1 | 0>>({});
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
            "id,handle,job_title,city,tags,portfolio_url,cv_path,created_at",
          )
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(100);
        if (res.error) throw res.error;

        const list = (res.data ?? []) as Profile[];
        if (!alive) return;
        setProfiles(list);

        // scores + mes votes (pour permettre de changer)
        if (list.length) {
          const ids = list.map((p) => p.id);
          const visitorId = getOrCreateVisitorId();
          const vr = await supabase
            .from("votes")
            .select("profile_id,value")
            .in("profile_id", ids);
          if (vr.error) throw vr.error;

          const map: Record<string, number> = {};
          const mine: Record<string, 1 | -1 | 0> = {};
          ((vr.data ?? []) as VoteRow[]).forEach((r) => {
            map[r.profile_id] = (map[r.profile_id] ?? 0) + (r.value ?? 0);
          });
          const my = await supabase
            .from("votes")
            .select("profile_id,value")
            .in("profile_id", ids)
            .eq("visitor_id", visitorId);
          if (my.error) throw my.error;
          ((my.data ?? []) as VoteRow[]).forEach((r) => {
            mine[r.profile_id] = (r.value === -1 ? -1 : 1) as 1 | -1;
          });
          if (!alive) return;
          setVotes(map);
          setMyVotes(mine);
        } else {
          setVotes({});
          setMyVotes({});
        }
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

  async function vote(profileId: string, value: 1 | -1) {
    setMessage("");
    const visitorId = getOrCreateVisitorId();
    const prev = myVotes[profileId] ?? 0;
    if (prev === value) return;
    const r = await fetch("/api/vote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId, value, visitorId }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setMessage(j?.error || "Impossible d’enregistrer le vote.");
      return;
    }
    const j = (await r.json()) as { ok: boolean; prev: number; value: 1 | -1 };
    setMyVotes((m) => ({ ...m, [profileId]: value }));
    setVotes((v) => ({
      ...v,
      [profileId]: (v[profileId] ?? 0) + ((j.value ?? value) - (j.prev ?? prev)),
    }));
  }

  return (
    <div className="grid gap-6">
      <div className="rs-panel rounded-lg p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight">Profils</h1>
            <p className="mt-1 text-sm text-zinc-700">
              Classement communautaire (MVP). Pas de photo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrer… (métier, ville, tag)"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm md:w-80"
            />
            <a href="/depot" className="rs-btn rs-btn--primary whitespace-nowrap">
              Déposer
            </a>
          </div>
        </div>
        {message ? (
          <p className="mt-3 text-sm text-red-700">{message}</p>
        ) : null}
      </div>

      {loading ? (
        <div className="rs-panel rounded-lg p-6 text-sm text-zinc-700">
          Chargement…
        </div>
      ) : filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((p) => (
            <article
              key={p.id}
              className="rs-panel rounded-lg p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-zinc-900">
                    @{p.handle.replace(/^@/, "")}
                  </div>
                  <div className="mt-1 text-lg font-black leading-snug">
                    {p.job_title}
                  </div>
                  <div className="mt-1 text-sm text-zinc-700">
                    {p.city ? p.city : "—"}
                  </div>
                </div>
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                    score
                  </div>
                  <div className="text-xl font-black">
                    {votes[p.id] ?? 0}
                  </div>
                </div>
              </div>

              {p.tags?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.tags.slice(0, 8).map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {p.portfolio_url ? (
                  <a
                    href={p.portfolio_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rs-btn rs-btn--ghost"
                  >
                    Portfolio
                  </a>
                ) : null}

                <a
                  href={`/profil/${p.id}`}
                  className="rs-btn rs-btn--ghost"
                >
                  Voir le CV
                </a>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => vote(p.id, 1)}
                    className={`rs-btn ${
                      (myVotes[p.id] ?? 0) === 1 ? "rs-btn--primary" : "rs-btn--ghost"
                    }`}
                  >
                    Like
                  </button>
                  <button
                    onClick={() => vote(p.id, -1)}
                    className={`rs-btn ${
                      (myVotes[p.id] ?? 0) === -1 ? "rs-btn--danger" : "rs-btn--ghost"
                    }`}
                  >
                    Dislike
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rs-panel rounded-lg p-6 text-sm text-zinc-700">
          Aucun profil publié pour le moment.
        </div>
      )}
    </div>
  );
}

