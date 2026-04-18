"use client";

import { useMemo, useState } from "react";

type FormState = {
  handle: string;
  jobTitle: string;
  city: string;
  tags: string;
  portfolioUrl: string;
  accepted: boolean;
};

type ParseCvResponse = {
  name?: string;
  email?: string;
  role?: string;
  portfolio?: string;
  note?: string;
  error?: string;
  details?: string;
  retryAfterSec?: number;
};

function suggestHandleFromName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const base = first
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "");
  if (base.length < 2) return "";
  return `@${base.slice(0, 40)}`;
}

type DepotSuccess = {
  ok: true;
  ownerToken?: string;
  profileUrl?: string;
  absoluteProfileUrl?: string;
};

export default function DepotPage() {
  const [form, setForm] = useState<FormState>({
    handle: "",
    jobTitle: "",
    city: "",
    tags: "",
    portfolioUrl: "",
    accepted: false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [extractStatus, setExtractStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [extractMessage, setExtractMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string>("");
  const [ownerProfileUrl, setOwnerProfileUrl] = useState<string>("");
  const [ownerProfileAbsoluteUrl, setOwnerProfileAbsoluteUrl] = useState<string>(
    "",
  );
  const ownerToken = useMemo(() => {
    return ownerProfileUrl.split("/").pop() || "";
  }, [ownerProfileUrl]);

  const canSubmit = useMemo(() => {
    const isPdf =
      !!file &&
      (file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf"));
    return (
      form.accepted &&
      form.handle.trim().length > 1 &&
      form.jobTitle.trim().length > 1 &&
      !!file &&
      isPdf
    );
  }, [form.accepted, form.handle, form.jobTitle, file]);

  async function onExtractCv() {
    setExtractMessage("");
    if (!file) {
      setExtractStatus("error");
      setExtractMessage("Choisis d’abord un fichier CV.");
      return;
    }
    setExtractStatus("loading");
    try {
      const fd = new FormData();
      fd.set("cv", file, file.name);
      const r = await fetch("/api/parse-cv", { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({}))) as ParseCvResponse;
      if (!r.ok) {
        if (j.error === "rate_limited") {
          throw new Error(
            `Trop de demandes. Réessaie dans ~${j.retryAfterSec ?? 60}s.`,
          );
        }
        if (j.error === "affinda_not_configured") {
          throw new Error(
            "Extraction indisponible : AFFINDA_API_KEY non configurée sur le serveur.",
          );
        }
        throw new Error(j.details || j.error || `Erreur ${r.status}`);
      }
      if (j.role) {
        setForm((f) => ({ ...f, jobTitle: j.role || f.jobTitle }));
      }
      if (j.portfolio) {
        setForm((f) => ({ ...f, portfolioUrl: j.portfolio || f.portfolioUrl }));
      }
      if (j.name) {
        setForm((f) => {
          if (f.handle.trim()) return f;
          const sug = suggestHandleFromName(j.name ?? "");
          return sug ? { ...f, handle: sug } : f;
        });
      }
      setExtractStatus("idle");
      const parts: string[] = [];
      if (j.note) parts.push(j.note);
      if (j.name) parts.push(`Nom détecté : ${j.name}`);
      if (j.email) {
        parts.push(
          `E-mail détecté : ${j.email} (informationnel — pas stocké sur le profil public)`,
        );
      }
      if (parts.length === 0) {
        parts.push(
          "Champs mis à jour à partir du CV. Vérifie le pseudo et envoie en PDF pour la publication.",
        );
      }
      setExtractMessage(parts.join(" "));
    } catch (e: unknown) {
      setExtractStatus("error");
      setExtractMessage(e instanceof Error ? e.message : "Erreur extraction");
    }
  }

  async function onSubmit() {
    setStatus("loading");
    setMessage("");
    setOwnerProfileUrl("");
    setOwnerProfileAbsoluteUrl("");

    try {
      if (!file) throw new Error("Ajoute un PDF.");
      if (
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
      ) {
        throw new Error(
          "Pour l’envoi final, le CV doit être un PDF (tu peux extraire les infos depuis Word avec le bouton ci-dessus, puis exporter en PDF).",
        );
      }
      if (!form.accepted) throw new Error("Tu dois accepter la charte.");

      const fd = new FormData();
      fd.set("handle", form.handle.trim());
      fd.set("jobTitle", form.jobTitle.trim());
      fd.set("city", form.city.trim());
      fd.set("tags", form.tags.trim());
      fd.set("portfolioUrl", form.portfolioUrl.trim());
      fd.set("accepted", String(!!form.accepted));
      fd.set("cv", file);

      const r = await fetch("/api/depot", { method: "POST", body: fd });
      if (!r.ok) {
        const j: { error?: string; retryAfterSec?: number } = await r
          .json()
          .catch(() => ({}));

        const code = j?.error || "Erreur dépôt";
        const retry = j?.retryAfterSec;
        if (code === "rate_limited" || code === "rate_limited_handle") {
          throw new Error(
            `Trop de dépôts d’un coup. Réessaie dans ~${retry ?? 60}s.`,
          );
        }
        if (code === "already_pending") {
          throw new Error(
            "Un profil avec ce pseudo est déjà en attente de modération.",
          );
        }
        if (code === "file_too_large") {
          throw new Error("PDF trop lourd (max ~12 Mo).");
        }
        if (code === "pdf_only") {
          throw new Error("Le CV doit être au format PDF.");
        }
        if (code === "charte_required") {
          throw new Error("Tu dois accepter la charte.");
        }
        if (code === "handle_required" || code === "job_required") {
          throw new Error("Pseudo et métier sont obligatoires.");
        }

        throw new Error(code);
      }

      const data = (await r.json()) as DepotSuccess;
      setStatus("done");
      setMessage(
        "Candidature envoyée. Elle sera visible après modération (pas de photo de profil).",
      );
      if (data.profileUrl) {
        setOwnerProfileUrl(data.profileUrl);
      }
      if (data.absoluteProfileUrl) {
        setOwnerProfileAbsoluteUrl(data.absoluteProfileUrl);
      }
      setFile(null);
      setForm((f) => ({ ...f, accepted: false }));
    } catch (e: unknown) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  return (
    <div className="grid gap-6">
      <div className="rs-panel rounded-lg p-6">
        <h1 className="text-xl font-black tracking-tight">
          Déposer un profil (PDF)
        </h1>
        <p className="mt-2 text-sm text-zinc-700">
          Dépose ton CV : tu peux lancer une <strong>extraction automatique</strong>{" "}
          (Affinda) pour préremplir métier et liens. L’envoi final reste en{" "}
          <strong>PDF</strong> pour l’affichage sur le portail. Pas de photo de
          profil.
        </p>
      </div>

      <div className="rs-panel rounded-lg p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Pseudo (@instagram)</span>
            <input
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value })}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="@pseudo"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold">Métier</span>
            <input
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Ex: Directeur artistique"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold">Ville (optionnel)</span>
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Paris"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold">
              Tags (optionnel, séparés par virgules)
            </span>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="fashion, 3D, couture, UI"
            />
          </label>

          <label className="grid gap-1 md:col-span-2">
            <span className="text-sm font-semibold">Portfolio (optionnel)</span>
            <input
              value={form.portfolioUrl}
              onChange={(e) =>
                setForm({ ...form, portfolioUrl: e.target.value })
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </label>

          <label className="grid gap-1 md:col-span-2">
            <span className="text-sm font-semibold">
              CV (PDF pour envoi — PDF / Word pour extraction)
            </span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setExtractMessage("");
              }}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
            <span className="text-xs text-zinc-500">
              Extraction : Affinda (clé serveur). Envoi : PDF uniquement dans le
              bucket Supabase.
            </span>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!file || extractStatus === "loading"}
            onClick={onExtractCv}
            className="rs-btn rs-btn--ghost disabled:cursor-not-allowed disabled:opacity-50"
          >
            {extractStatus === "loading"
              ? "Analyse du CV…"
              : "Extraire les infos du CV"}
          </button>
        </div>
        {extractMessage ? (
          <p
            className={`mt-2 text-sm ${
              extractStatus === "error" ? "text-red-700" : "text-emerald-800"
            }`}
          >
            {extractMessage}
          </p>
        ) : null}

        <label className="mt-4 flex items-start gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={form.accepted}
            onChange={(e) => setForm({ ...form, accepted: e.target.checked })}
            className="mt-1"
          />
          <span>
            J’accepte la charte : pas de photo de profil, CV en PDF, respect et
            contenu légal.
          </span>
        </label>

        <div className="mt-5 flex items-center gap-2">
          <button
            disabled={!canSubmit || status === "loading"}
            onClick={onSubmit}
            title={
              file &&
              file.type !== "application/pdf" &&
              !file.name.toLowerCase().endsWith(".pdf")
                ? "Convertis le CV en PDF pour envoyer"
                : undefined
            }
            className="rs-btn rs-btn--primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading" ? "Envoi..." : "Envoyer"}
          </button>
          <a
            href="/profils"
            className="rs-btn rs-btn--ghost"
          >
            Voir les profils
          </a>
        </div>

        {message ? (
          <p
            className={`mt-4 text-sm ${
              status === "error" ? "text-red-700" : "text-zinc-700"
            }`}
          >
            {message}
          </p>
        ) : null}

        {status === "done" && ownerProfileUrl ? (
          <div className="mt-3 grid gap-3">
            <a
              href={ownerProfileUrl}
              className="inline-flex w-fit rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-100"
            >
              Voir mon profil privé (stats)
            </a>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              <p>
                Optionnel : crée un compte pour suivre l&apos;historique et les
                évolutions de tes versions.
              </p>
              {ownerToken ? (
                <a
                  href={`/connexion?token=${encodeURIComponent(
                    ownerToken,
                  )}&profileUrl=${encodeURIComponent(
                    ownerProfileAbsoluteUrl || ownerProfileUrl,
                  )}`}
                  className="mt-2 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-100"
                >
                  Créer un compte / se connecter
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

