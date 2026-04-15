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

        // scores
        if (list.length) {
          const ids = list.map((p) => p.id);
          const vr = await supabase
            .from("votes")
            .select("profile_id,value")
            .in("profile_id", ids);
          if (vr.error) throw vr.error;

          const map: Record<string, number> = {};
          ((vr.data ?? []) as VoteRow[]).forEach((r) => {
            map[r.profile_id] = (map[r.profile_id] ?? 0) + (r.value ?? 0);
          });
          if (!alive) return;
          setVotes(map);
        } else {
          setVotes({});
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
    const res = await supabase.from("votes").insert({
      profile_id: profileId,
      visitor_id: visitorId,
      value,
    });
    if (res.error) {
      // double vote => constraint unique
      setMessage(
        "Vote déjà enregistré pour ce profil (sur ce navigateur).",
      );
      return;
    }
    setVotes((v) => ({ ...v, [profileId]: (v[profileId] ?? 0) + value }));
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
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
            <a
              href="/depot"
              className="whitespace-nowrap rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Déposer
            </a>
          </div>
        </div>
        {message ? (
          <p className="mt-3 text-sm text-red-700">{message}</p>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
          Chargement…
        </div>
      ) : filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((p) => (
            <article
              key={p.id}
              className="rounded-lg border border-zinc-200 bg-white p-5"
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
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-100"
                  >
                    Portfolio
                  </a>
                ) : null}

                <a
                  href={`/profil/${p.id}`}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-100"
                >
                  Voir le CV
                </a>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => vote(p.id, 1)}
                    className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    Like
                  </button>
                  <button
                    onClick={() => vote(p.id, -1)}
                    className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500"
                  >
                    Dislike
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
          Aucun profil publié pour le moment.
        </div>
      )}
    </div>
  );
}

