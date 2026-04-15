"use client";

import { useEffect, useMemo, useState } from "react";

type AdminProfile = {
  id: string;
  handle: string;
  job_title: string;
  city: string | null;
  portfolio_url: string | null;
  cv_path: string;
  created_at: string;
};

export default function AdminPage() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AdminProfile[]>([]);
  const [message, setMessage] = useState<string>("");

  const authHeader = useMemo(() => {
    if (!pw) return "";
    return `Basic ${btoa(`admin:${pw}`)}`;
  }, [pw]);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/profiles?status=pending", {
        headers: authHeader ? { authorization: authHeader } : {},
      });
      if (r.status === 401) {
        setAuthed(false);
        setMessage("Mot de passe admin requis.");
        setItems([]);
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "Erreur chargement");
      }
      const j = (await r.json()) as { items: AdminProfile[] };
      setAuthed(true);
      setItems(j.items ?? []);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(id: string, status: "published" | "rejected") {
    setMessage("");
    const r = await fetch("/api/admin/profiles", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      body: JSON.stringify({ id, status }),
    });
    if (r.status === 401) {
      setAuthed(false);
      setMessage("Mot de passe admin requis.");
      return;
    }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setMessage(j?.error || "Erreur update");
      return;
    }
    setItems((xs) => xs.filter((x) => x.id !== id));
  }

  useEffect(() => {
    // keep empty
  }, []);

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-black tracking-tight">Admin — Modération</h1>
        <p className="mt-1 text-sm text-zinc-700">
          Publier / refuser les profils en attente.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Mot de passe admin"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm md:w-80"
          />
          <button
            onClick={load}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Charger les profils en attente
          </button>
          {authed ? (
            <span className="text-sm font-semibold text-emerald-700">
              Auth OK
            </span>
          ) : null}
        </div>

        {message ? (
          <p className="mt-3 text-sm text-red-700">{message}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        {loading ? (
          <p className="text-sm text-zinc-700">Chargement…</p>
        ) : items.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((p) => (
              <article
                key={p.id}
                className="rounded-lg border border-zinc-200 bg-white p-5"
              >
                <div className="text-sm font-black text-zinc-900">
                  @{String(p.handle || "").replace(/^@/, "")}
                </div>
                <div className="mt-1 text-lg font-black leading-snug">
                  {p.job_title}
                </div>
                <div className="mt-1 text-sm text-zinc-700">
                  {p.city ? p.city : "—"}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`/profil/${p.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-100"
                  >
                    Voir (publique si publié)
                  </a>
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
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => setStatus(p.id, "published")}
                    className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                  >
                    Publier
                  </button>
                  <button
                    onClick={() => setStatus(p.id, "rejected")}
                    className="rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-600"
                  >
                    Refuser
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-700">
            Aucun profil en attente (ou pas chargé).
          </p>
        )}
      </div>
    </div>
  );
}

