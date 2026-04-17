"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import PdfPreview from "@/components/PdfPreview";

type AdminProfile = {
  id: string;
  handle: string;
  job_title: string;
  city: string | null;
  portfolio_url: string | null;
  cv_path: string;
  created_at: string;
  status: string;
  rejection_reason?: string | null;
  cv_preview_url: string;
  job_category: string;
};

export default function AdminPage() {
  const [authReady, setAuthReady] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AdminProfile[]>([]);
  const [message, setMessage] = useState<string>("");
  const [rejectionById, setRejectionById] = useState<Record<string, string>>({});

  const authHeader = useMemo(() => {
    if (!accessToken) return "";
    return `Bearer ${accessToken}`;
  }, [accessToken]);

  useEffect(() => {
    let alive = true;
    async function boot() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!alive) return;
      setAccessToken(session?.access_token || "");
      if (!session?.access_token) {
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!alive) return;
      const role = String(userData.user?.app_metadata?.role || "").toLowerCase();
      const rolesRaw = userData.user?.app_metadata?.roles;
      const roles = Array.isArray(rolesRaw)
        ? rolesRaw.map((x) => String(x || "").toLowerCase())
        : [];
      setIsAdmin(role === "admin" || roles.includes("admin"));
      setAuthReady(true);
    }
    void boot();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setAccessToken(next?.access_token || "");
      if (!next?.access_token) {
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const role = String(userData.user?.app_metadata?.role || "").toLowerCase();
      const rolesRaw = userData.user?.app_metadata?.roles;
      const roles = Array.isArray(rolesRaw)
        ? rolesRaw.map((x) => String(x || "").toLowerCase())
        : [];
      setIsAdmin(role === "admin" || roles.includes("admin"));
      setAuthReady(true);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const load = useCallback(async () => {
    if (!authHeader) {
      setMessage("Connexion requise.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/profiles?status=pending", {
        headers: { authorization: authHeader },
      });
      if (r.status === 401) {
        setMessage("Connexion requise.");
        setItems([]);
        return;
      }
      if (r.status === 403) {
        setMessage("Accès admin requis.");
        setItems([]);
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "Erreur chargement");
      }
      const j = (await r.json()) as { items: AdminProfile[] };
      setItems(j.items ?? []);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  async function setStatus(id: string, status: "published" | "rejected") {
    setMessage("");
    const rejectionReason = String(rejectionById[id] || "").trim();
    const r = await fetch("/api/admin/profiles", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      body: JSON.stringify({ id, status, rejectionReason }),
    });
    if (r.status === 401) {
      setMessage("Connexion requise.");
      return;
    }
    if (r.status === 403) {
      setMessage("Accès admin requis.");
      return;
    }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      if (j?.error === "rejection_reason_required") {
        setMessage("Motif de refus requis.");
      } else {
        setMessage(j?.error || "Erreur update");
      }
      return;
    }
    setItems((xs) => xs.filter((x) => x.id !== id));
  }

  useEffect(() => {
    if (!authReady || !isAdmin || !authHeader) return;
    void load();
  }, [authReady, isAdmin, authHeader, load]);

  if (!authReady) {
    return (
      <div className="grid gap-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
          Chargement…
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="grid gap-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="text-xl font-black tracking-tight">Admin — Modération</h1>
          <p className="mt-2 text-sm text-zinc-700">Connexion requise.</p>
          <a
            href="/connexion"
            className="mt-4 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-100"
          >
            Se connecter
          </a>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="grid gap-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="text-xl font-black tracking-tight">Admin — Modération</h1>
          <p className="mt-2 text-sm text-red-700">Accès réservé aux admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-black tracking-tight">Admin — Modération</h1>
        <p className="mt-1 text-sm text-zinc-700">
          Validation des CVs en attente avec aperçu inline.
        </p>
        <button
          onClick={() => void load()}
          className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Recharger les profils en attente
        </button>
        {message ? <p className="mt-3 text-sm text-red-700">{message}</p> : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        {loading ? (
          <p className="text-sm text-zinc-700">Chargement…</p>
        ) : items.length ? (
          <div className="grid gap-4">
            {items.map((p) => (
              <article
                key={p.id}
                className="rounded-lg border border-zinc-200 bg-white p-5"
              >
                <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 lg:h-[420px]">
                    {p.cv_preview_url ? (
                      <PdfPreview url={p.cv_preview_url} mode="fit-width" />
                    ) : (
                      <div className="px-3 py-3 text-sm text-zinc-700">
                        Aperçu PDF indisponible.
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-black text-zinc-900">
                      @{String(p.handle || "").replace(/^@/, "")}
                    </div>
                    <div className="mt-1 text-lg font-black leading-snug">
                      {p.job_title}
                    </div>
                    <div className="mt-2 text-sm text-zinc-700">
                      Déposé le{" "}
                      {new Date(p.created_at).toLocaleString("fr-FR")}
                    </div>
                    <div className="mt-1 text-sm text-zinc-700">
                      Catégorie métier:{" "}
                      <span className="font-semibold">{p.job_category}</span>
                    </div>
                    <div className="mt-1 text-sm text-zinc-700">
                      Ville: {p.city ? p.city : "—"}
                    </div>
                    {p.portfolio_url ? (
                      <a
                        href={p.portfolio_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-100"
                      >
                        Portfolio
                      </a>
                    ) : null}

                    <label className="mt-4 grid gap-1">
                      <span className="text-sm font-semibold">Motif de refus</span>
                      <textarea
                        value={rejectionById[p.id] ?? ""}
                        onChange={(e) =>
                          setRejectionById((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        placeholder="Ex: PDF illisible, contenu non conforme..."
                        className="min-h-20 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </label>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={() => void setStatus(p.id, "published")}
                        className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                      >
                        Approuver
                      </button>
                      <button
                        onClick={() => void setStatus(p.id, "rejected")}
                        className="rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-600"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-700">
            Aucun profil en attente.
          </p>
        )}
      </div>
    </div>
  );
}

