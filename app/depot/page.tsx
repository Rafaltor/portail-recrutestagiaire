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

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-[#0033cc] focus:ring-2 focus:ring-[#0033cc]/25";

function StepHeader({
  step,
  title,
  hint,
}: {
  step: number;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow-sm"
        style={{ background: "linear-gradient(145deg, #0047cc, #003399)" }}
        aria-hidden
      >
        {step}
      </span>
      <div className="min-w-0 pt-0.5">
        <h2 className="text-base font-bold tracking-tight text-zinc-900">
          {title}
        </h2>
        {hint ? (
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

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

  const isPdf = useMemo(() => {
    if (!file) return false;
    return (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    );
  }, [file]);

  const canSubmit = useMemo(() => {
    return (
      form.accepted &&
      form.handle.trim().length > 1 &&
      form.jobTitle.trim().length > 1 &&
      !!file &&
      isPdf
    );
  }, [form.accepted, form.handle, form.jobTitle, file, isPdf]);

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
      if (!isPdf) {
        throw new Error(
          "Pour l’envoi final, le CV doit être un PDF (tu peux extraire les infos depuis Word avec l’étape 1, puis exporter en PDF).",
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
    <div className="mx-auto max-w-5xl px-4 pb-14 pt-2 sm:px-6 lg:px-8">
      <header className="mb-10 border-b border-zinc-200 pb-8 text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#0033cc]">
          Candidature
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl">
          Déposer son profil
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:mx-0">
          Commence par ton <strong>CV</strong> : extraction automatique (Affinda)
          pour préremplir métier et liens. Pour publier, envoie un{" "}
          <strong>PDF</strong> — pas de photo de profil sur le portail.
        </p>
      </header>

      <div className="flex flex-col gap-10 lg:grid lg:grid-cols-12 lg:items-start lg:gap-10">
        {/* Colonne CV */}
        <aside className="lg:col-span-5">
          <StepHeader
            step={1}
            title="Importer ton CV"
            hint="PDF ou Word pour l’analyse. L’envoi final (étape 3) exige un PDF."
          />
          <div
            className={`rs-panel mt-5 rounded-xl p-5 sm:p-6 ${
              file
                ? "border border-solid border-[#c5d5e4] bg-white"
                : "border-2 border-dashed border-zinc-300 bg-zinc-50/80"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const f = e.dataTransfer.files?.[0];
              if (f) {
                setFile(f);
                setExtractMessage("");
              }
            }}
          >
            <label className="block cursor-pointer">
              <span className="text-sm font-semibold text-zinc-800">
                Fichier CV
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setExtractMessage("");
                }}
                className="mt-3 block w-full cursor-pointer text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#0033cc] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[#002699]"
              />
            </label>

            {file ? (
              <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                <span className="font-medium text-zinc-900">{file.name}</span>
                <span className="ml-2 text-zinc-500">
                  ({(file.size / 1024).toFixed(0)} Ko)
                  {!isPdf ? (
                    <span className="ml-2 font-semibold text-amber-700">
                      → convertir en PDF pour l’envoi
                    </span>
                  ) : null}
                </span>
              </div>
            ) : (
              <p className="mt-4 text-center text-xs text-zinc-500 sm:text-left">
                Glisse-dépose ou clique pour choisir un fichier.
              </p>
            )}

            <button
              type="button"
              disabled={!file || extractStatus === "loading"}
              onClick={onExtractCv}
              className="rs-btn rs-btn--ghost mt-5 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {extractStatus === "loading"
                ? "Analyse du CV…"
                : "Extraire les infos du CV"}
            </button>

            {extractMessage ? (
              <div
                className={`mt-4 rounded-lg border px-3 py-2.5 text-xs leading-relaxed sm:text-sm ${
                  extractStatus === "error"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900"
                }`}
                role="status"
              >
                {extractMessage}
              </div>
            ) : null}
          </div>
        </aside>

        {/* Colonne formulaire */}
        <div className="lg:col-span-7">
          <StepHeader
            step={2}
            title="Ton profil public"
            hint="Ce que les visiteurs verront après modération."
          />

          <div className="rs-panel mt-5 rounded-xl p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-0.5 sm:col-span-1">
                <span className="text-sm font-semibold text-zinc-800">
                  Pseudo <span className="text-red-600">*</span>
                </span>
                <span className="text-xs text-zinc-500">ex. Instagram</span>
                <input
                  value={form.handle}
                  onChange={(e) => setForm({ ...form, handle: e.target.value })}
                  className={inputClass}
                  placeholder="@pseudo"
                  autoComplete="username"
                />
              </label>

              <label className="grid gap-0.5 sm:col-span-1">
                <span className="text-sm font-semibold text-zinc-800">
                  Métier <span className="text-red-600">*</span>
                </span>
                <span className="text-xs text-zinc-500">
                  Rempli auto si tu extrais le CV
                </span>
                <input
                  value={form.jobTitle}
                  onChange={(e) =>
                    setForm({ ...form, jobTitle: e.target.value })
                  }
                  className={inputClass}
                  placeholder="Ex. Directeur artistique"
                />
              </label>
            </div>

            <div className="mt-8 border-t border-zinc-100 pt-6">
              <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                Détails optionnels
              </h3>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <label className="grid gap-0.5">
                  <span className="text-sm font-semibold text-zinc-800">
                    Ville
                  </span>
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className={inputClass}
                    placeholder="Paris"
                  />
                </label>

                <label className="grid gap-0.5">
                  <span className="text-sm font-semibold text-zinc-800">
                    Tags
                  </span>
                  <span className="text-xs text-zinc-500">
                    séparés par des virgules
                  </span>
                  <input
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    className={inputClass}
                    placeholder="fashion, 3D, couture"
                  />
                </label>

                <label className="grid gap-0.5 sm:col-span-2">
                  <span className="text-sm font-semibold text-zinc-800">
                    Portfolio ou lien
                  </span>
                  <input
                    value={form.portfolioUrl}
                    onChange={(e) =>
                      setForm({ ...form, portfolioUrl: e.target.value })
                    }
                    className={inputClass}
                    placeholder="https://…"
                    inputMode="url"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="rs-panel mt-6 rounded-xl p-5 sm:p-6">
            <StepHeader
              step={3}
              title="Envoyer la candidature"
              hint="Charte obligatoire. Le fichier doit être un PDF."
            />

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={form.accepted}
                onChange={(e) =>
                  setForm({ ...form, accepted: e.target.checked })
                }
                className="mt-0.5 size-4 shrink-0 rounded border-zinc-400 text-[#0033cc] focus:ring-[#0033cc]"
              />
              <span>
                J’accepte la charte : pas de photo de profil, CV en PDF, respect
                et contenu légal.
              </span>
            </label>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                disabled={!canSubmit || status === "loading"}
                onClick={onSubmit}
                title={
                  file && !isPdf
                    ? "Convertis le CV en PDF pour envoyer"
                    : undefined
                }
                className="rs-btn rs-btn--primary order-1 justify-center px-8 disabled:cursor-not-allowed disabled:opacity-50 sm:order-none"
              >
                {status === "loading" ? "Envoi en cours…" : "Envoyer ma candidature"}
              </button>
              <a
                href="/profils"
                className="rs-btn rs-btn--ghost order-2 justify-center sm:order-none"
              >
                Voir les profils
              </a>
            </div>

            {message ? (
              <p
                className={`mt-5 text-sm leading-relaxed ${
                  status === "error" ? "text-red-700" : "text-zinc-700"
                }`}
              >
                {message}
              </p>
            ) : null}

            {status === "done" && ownerProfileUrl ? (
              <div className="mt-6 grid gap-4 border-t border-zinc-100 pt-6">
                <a
                  href={ownerProfileUrl}
                  className="inline-flex w-full justify-center rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 sm:w-fit sm:justify-start"
                >
                  Voir mon profil privé (stats)
                </a>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                  <p>
                    Optionnel : crée un compte pour suivre l&apos;historique et
                    les évolutions de tes versions.
                  </p>
                  {ownerToken ? (
                    <a
                      href={`/connexion?token=${encodeURIComponent(
                        ownerToken,
                      )}&profileUrl=${encodeURIComponent(
                        ownerProfileAbsoluteUrl || ownerProfileUrl,
                      )}`}
                      className="mt-3 inline-flex w-full justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-zinc-100 sm:w-fit"
                    >
                      Créer un compte / se connecter
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
