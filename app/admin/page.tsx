"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  cv_original_url: string;
  job_category: string;
};

type RedactionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function RedactionEditorModal({
  open,
  profile,
  authHeader,
  onClose,
  onApplied,
}: {
  open: boolean;
  profile: AdminProfile | null;
  authHeader: string;
  onClose: () => void;
  onApplied: (nextItem: { id: string; cv_preview_url: string; cv_original_url: string }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [renderError, setRenderError] = useState("");
  const [rendering, setRendering] = useState(false);
  const [rects, setRects] = useState<RedactionRect[]>([]);
  const [draftRect, setDraftRect] = useState<RedactionRect | null>(null);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyError, setApplyError] = useState("");

  const renderPdf = useCallback(async () => {
    if (!open || !profile?.cv_preview_url) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    setRendering(true);
    setRenderError("");
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const pdfjsAny = pdfjs as unknown as {
        GlobalWorkerOptions: { workerSrc?: string };
        getDocument: (arg: unknown) => {
          promise: Promise<{ getPage: (n: number) => Promise<unknown> }>;
        };
      };
      if (!pdfjsAny.GlobalWorkerOptions.workerSrc) {
        pdfjsAny.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
      }
      const doc = await pdfjsAny.getDocument({ url: profile.cv_preview_url }).promise;
      const page = (await doc.getPage(1)) as {
        getViewport: (arg: { scale: number }) => { width: number; height: number };
        render: (arg: {
          canvasContext: CanvasRenderingContext2D;
          viewport: { width: number; height: number };
        }) => { promise: Promise<void> };
      };
      const viewportBase = page.getViewport({ scale: 1 });
      const area = wrap.getBoundingClientRect();
      const scale = Math.max(
        0.2,
        Math.min(area.width / viewportBase.width, area.height / viewportBase.height),
      );
      const viewport = page.getViewport({ scale });
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas_context_missing");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (e: unknown) {
      setRenderError(
        e instanceof Error ? e.message : "Impossible de charger le PDF pour l'édition.",
      );
    } finally {
      setRendering(false);
    }
  }, [open, profile?.cv_preview_url]);

  useEffect(() => {
    if (!open) return;
    void renderPdf();
    const onResize = () => {
      void renderPdf();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [open, renderPdf]);

  useEffect(() => {
    if (!open || !profile) return;
    setRects([]);
    setDraftRect(null);
    setDrawStart(null);
    setApplyError("");
  }, [open, profile]);

  const getNormPoint = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const overlay = event.currentTarget.getBoundingClientRect();
    const x = clamp01((event.clientX - overlay.left) / Math.max(1, overlay.width));
    const y = clamp01((event.clientY - overlay.top) / Math.max(1, overlay.height));
    return { x, y };
  }, []);

  async function applyMasking() {
    if (!profile) return;
    if (!rects.length) {
      setApplyError("Ajoute au moins un rectangle noir avant d'appliquer.");
      return;
    }
    setApplyError("");
    setApplyBusy(true);
    try {
      const r = await fetch("/api/admin/profiles/redact", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(authHeader ? { authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          profileId: profile.id,
          page: 1,
          rectangles: rects,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        item?: { id: string; cv_preview_url: string; cv_original_url: string };
      };
      if (!r.ok || !j.item) {
        throw new Error(j.error || "Échec du masquage");
      }
      onApplied(j.item);
      onClose();
    } catch (e: unknown) {
      setApplyError(e instanceof Error ? e.message : "Échec du masquage");
    } finally {
      setApplyBusy(false);
    }
  }

  if (!open || !profile) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 p-3 sm:p-6">
      <div className="flex h-full flex-col rounded-lg border border-[#ddd] bg-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ddd] px-4 py-3 text-[#0A0A0A]">
          <div>
            <p className="text-sm font-semibold">Mode édition — @{profile.handle.replace(/^@/, "")}</p>
            <p className="text-xs text-[#0A0A0A]/60">
              Dessine des zones noires (téléphone, email, adresse), puis applique.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRects((prev) => prev.slice(0, -1))}
              className="rounded-md border-2 border-[#F472B6] bg-white px-3 py-2 text-xs font-semibold text-[#F472B6] hover:bg-[#fff5fa]"
            >
              Annuler le dernier
            </button>
            <button
              onClick={() => setRects([])}
              className="rounded-md border-2 border-[#F472B6] bg-white px-3 py-2 text-xs font-semibold text-[#F472B6] hover:bg-[#fff5fa]"
            >
              Tout effacer
            </button>
            <button
              onClick={onClose}
              className="rounded-md border-2 border-[#F472B6] bg-white px-3 py-2 text-xs font-semibold text-[#F472B6] hover:bg-[#fff5fa]"
            >
              Fermer
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 p-2 sm:p-4">
          <div ref={wrapRef} className="relative flex h-full w-full items-center justify-center overflow-auto">
            <div className="relative">
              <canvas ref={canvasRef} className="block max-h-[80vh] max-w-full bg-white shadow-xl" />
              <div
                className="absolute inset-0 cursor-crosshair"
                onPointerDown={(event) => {
                  const point = getNormPoint(event);
                  setDrawStart(point);
                  setDraftRect({
                    x: point.x,
                    y: point.y,
                    width: 0,
                    height: 0,
                  });
                }}
                onPointerMove={(event) => {
                  if (!drawStart) return;
                  const point = getNormPoint(event);
                  const x = Math.min(drawStart.x, point.x);
                  const y = Math.min(drawStart.y, point.y);
                  const width = Math.abs(point.x - drawStart.x);
                  const height = Math.abs(point.y - drawStart.y);
                  setDraftRect({ x, y, width, height });
                }}
                onPointerUp={() => {
                  if (draftRect && draftRect.width > 0.005 && draftRect.height > 0.005) {
                    setRects((prev) => [...prev, draftRect]);
                  }
                  setDraftRect(null);
                  setDrawStart(null);
                }}
                onPointerLeave={() => {
                  if (drawStart && draftRect && draftRect.width > 0.005 && draftRect.height > 0.005) {
                    setRects((prev) => [...prev, draftRect]);
                  }
                  setDraftRect(null);
                  setDrawStart(null);
                }}
              >
                {rects.map((rect, index) => (
                  <div
                    key={`${rect.x}-${rect.y}-${rect.width}-${rect.height}-${index}`}
                    className="absolute border border-red-300 bg-black/85"
                    style={{
                      left: `${rect.x * 100}%`,
                      top: `${rect.y * 100}%`,
                      width: `${rect.width * 100}%`,
                      height: `${rect.height * 100}%`,
                    }}
                  />
                ))}
                {draftRect ? (
                  <div
                    className="absolute border border-amber-300 bg-black/70"
                    style={{
                      left: `${draftRect.x * 100}%`,
                      top: `${draftRect.y * 100}%`,
                      width: `${draftRect.width * 100}%`,
                      height: `${draftRect.height * 100}%`,
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#ddd] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void applyMasking()}
              disabled={!rects.length || applyBusy}
              className="rounded-md bg-[#F472B6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ec4899] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applyBusy ? "Masquage..." : "Appliquer le masquage"}
            </button>
            {profile.cv_original_url ? (
              <a
                href={profile.cv_original_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border-2 border-[#F472B6] bg-white px-3 py-2 text-xs font-semibold text-[#F472B6] hover:bg-[#fff5fa]"
              >
                Voir l&apos;original (admin)
              </a>
            ) : null}
            <span className="text-xs text-[#0A0A0A]/60">{rects.length} zone(s) à masquer</span>
          </div>
          {rendering ? <p className="mt-2 text-xs text-[#0A0A0A]/60">Chargement du PDF...</p> : null}
          {renderError ? <p className="mt-2 text-xs text-red-400">{renderError}</p> : null}
          {applyError ? <p className="mt-2 text-xs text-red-400">{applyError}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authReady, setAuthReady] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AdminProfile[]>([]);
  const [message, setMessage] = useState<string>("");
  const [rejectionById, setRejectionById] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string>("");

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

  function onMaskApplied(nextItem: { id: string; cv_preview_url: string; cv_original_url: string }) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === nextItem.id
          ? {
              ...item,
              cv_preview_url: nextItem.cv_preview_url || item.cv_preview_url,
              cv_original_url: nextItem.cv_original_url || item.cv_original_url,
            }
          : item,
      ),
    );
    setMessage("Masquage appliqué avec succès.");
  }

  useEffect(() => {
    if (!authReady || !isAdmin || !authHeader) return;
    void load();
  }, [authReady, isAdmin, authHeader, load]);

  if (!authReady) {
    return (
      <div className="grid gap-6">
        <div className="rs-panel rounded-lg p-6 text-sm text-[#0A0A0A]/85">
          Chargement…
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="grid gap-6">
        <div className="rs-panel rounded-lg p-6">
          <h1 className="text-xl font-black tracking-tight">Admin — Modération</h1>
          <p className="mt-2 text-sm text-[#0A0A0A]/85">Connexion requise.</p>
          <a
            href="/connexion"
            className="mt-4 inline-flex rounded-md border-2 border-[#F472B6] bg-white px-3 py-2 text-sm font-semibold text-[#F472B6] hover:bg-[#fff5fa]"
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
        <div className="rs-panel rounded-lg p-6">
          <h1 className="text-xl font-black tracking-tight">Admin — Modération</h1>
          <p className="mt-2 text-sm text-red-700">Accès réservé aux admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="rs-panel rounded-lg p-6">
        <h1 className="text-xl font-black tracking-tight">Admin — Modération</h1>
        <p className="mt-1 text-sm text-[#0A0A0A]/85">
          Validation des CVs en attente avec aperçu inline.
        </p>
        <button
          onClick={() => void load()}
          className="mt-4 rounded-md bg-[#F472B6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ec4899]"
        >
          Recharger les profils en attente
        </button>
        {message ? <p className="mt-3 text-sm text-red-700">{message}</p> : null}
      </div>

      <div className="rs-panel rounded-lg p-6">
        {loading ? (
          <p className="text-sm text-[#0A0A0A]/85">Chargement…</p>
        ) : items.length ? (
          <div className="grid gap-4">
            {items.map((p) => (
              <article
                key={p.id}
                className="rs-panel rounded-lg p-5"
              >
                <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                  <div className="rounded-lg border border-[#ddd] bg-[#fafafa] p-2 lg:h-[420px]">
                    {p.cv_preview_url ? (
                      <PdfPreview url={p.cv_preview_url} mode="fit-width" />
                    ) : (
                      <div className="px-3 py-3 text-sm text-[#0A0A0A]/85">
                        Aperçu PDF indisponible.
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-black text-[#0A0A0A]">
                      @{String(p.handle || "").replace(/^@/, "")}
                    </div>
                    <div className="mt-1 text-lg font-black leading-snug">
                      {p.job_title}
                    </div>
                    <div className="mt-2 text-sm text-[#0A0A0A]/85">
                      Déposé le{" "}
                      {new Date(p.created_at).toLocaleString("fr-FR")}
                    </div>
                    <div className="mt-1 text-sm text-[#0A0A0A]/85">
                      Catégorie métier:{" "}
                      <span className="font-semibold">{p.job_category}</span>
                    </div>
                    <div className="mt-1 text-sm text-[#0A0A0A]/85">
                      Ville: {p.city ? p.city : "—"}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setEditingId(p.id)}
                        className="rounded-md border-2 border-[#F472B6] bg-white px-3 py-2 text-sm font-semibold text-[#F472B6] hover:bg-[#fff5fa]"
                      >
                        Mode édition
                      </button>
                      {p.cv_original_url ? (
                        <a
                          href={p.cv_original_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border-2 border-[#F472B6] bg-white px-3 py-2 text-sm font-semibold text-[#F472B6] hover:bg-[#fff5fa]"
                        >
                          Voir l&apos;original (admin)
                        </a>
                      ) : null}
                    </div>
                    {p.portfolio_url ? (
                      <a
                        href={p.portfolio_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex rounded-md border-2 border-[#F472B6] bg-white px-3 py-2 text-sm font-semibold text-[#F472B6] hover:bg-[#fff5fa]"
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
                        className="min-h-20 rounded-md border border-[#ddd] px-3 py-2 text-sm"
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
          <p className="text-sm text-[#0A0A0A]/85">
            Aucun profil en attente.
          </p>
        )}
      </div>
      <RedactionEditorModal
        open={!!editingId}
        profile={items.find((item) => item.id === editingId) ?? null}
        authHeader={authHeader}
        onClose={() => setEditingId("")}
        onApplied={onMaskApplied}
      />
    </div>
  );
}

