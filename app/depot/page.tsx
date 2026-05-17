"use client";

import { useMemo, useState } from "react";
import { PortalDesktopPageHeader } from "@/components/PortalDesktopPageHeader";
import { RequireAuthGate } from "@/components/RequireAuthGate";
import { isPdfUpload } from "@/lib/pdf-file";

function formatDepotError(code: string, retryAfterSec?: number): string {
  if (code === "rate_limited" || code === "rate_limited_handle") {
    return `Trop de dépôts d’un coup. Réessaie dans ~${retryAfterSec ?? 60}s.`;
  }
  if (code === "already_pending") {
    return "Un profil avec ce pseudo est déjà en attente de modération.";
  }
  if (code === "handle_taken") {
    return "Ce pseudo Instagram est déjà utilisé sur le portail.";
  }
  if (code === "file_too_large") return "PDF trop lourd (max ~12 Mo).";
  if (code === "pdf_only") {
    return "Le CV doit être un fichier PDF (extension .pdf).";
  }
  if (code === "charte_required") return "Tu dois accepter la charte.";
  if (code === "handle_required") return "Pseudo Instagram obligatoire.";
  if (code === "handle_invalid") {
    return "Pseudo invalide : utilise des lettres, chiffres, points ou tirets.";
  }
  if (code === "file_required") return "Ajoute ton CV en PDF.";
  if (code === "bad_formdata") return "Envoi invalide. Recharge la page et réessaie.";
  if (code === "server_misconfigured") {
    return "Service temporairement indisponible. Réessaie plus tard.";
  }
  if (code.startsWith("upload_failed:")) {
    return "Impossible d’enregistrer le PDF. Réessaie dans quelques minutes.";
  }
  if (code.startsWith("insert_failed:")) {
    const detail = code.slice("insert_failed:".length);
    if (/duplicate|unique|already exists/i.test(detail)) {
      return "Ce pseudo Instagram est déjà utilisé sur le portail.";
    }
    return "Impossible d’enregistrer la candidature. Vérifie le pseudo et réessaie.";
  }
  if (code.startsWith("check_failed:")) {
    return "Impossible de vérifier le pseudo. Réessaie dans quelques instants.";
  }
  if (code === "Erreur dépôt" || !code.trim()) {
    return "Erreur lors du dépôt. Vérifie ta connexion et réessaie.";
  }
  return code;
}

type FormState = {
  handle: string;
  accepted: boolean;
};

type DepotSuccess = {
  ok: true;
  ownerToken?: string;
  profileUrl?: string;
  absoluteProfileUrl?: string;
};

type StepTwoState = {
  name: string;
  email: string;
  jobTitle: string;
  skills: string;
  city: string;
  manualFallback: boolean;
};

function DepotPageInner() {
  const [form, setForm] = useState<FormState>({
    handle: "",
    accepted: false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [stepTwo, setStepTwo] = useState<StepTwoState | null>(null);
  const [parsing, setParsing] = useState(false);
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

  const canAnalyze = useMemo(() => {
    return form.handle.trim().length > 1 && !!file;
  }, [form.handle, file]);

  const canContinueWithoutAnalysis = canAnalyze;

  const canSubmit = useMemo(() => {
    return (
      form.accepted &&
      form.handle.trim().length > 1 &&
      !!file &&
      !!stepTwo
    );
  }, [form.accepted, form.handle, file, stepTwo]);

  function resetStatusForInput() {
    if (status !== "idle") {
      setStatus("idle");
    }
    setMessage("");
  }

  function enableManualStepTwo(infoMessage?: string) {
    setStatus("idle");
    setMessage(
      infoMessage ||
        "Analyse indisponible pour le moment. Complète les champs manuellement.",
    );
    setStepTwo({
      name: "",
      email: "",
      jobTitle: "",
      skills: "",
      city: "",
      manualFallback: true,
    });
  }

  function onSkillsChange(nextValue: string) {
    const normalized = nextValue
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 5)
      .join(", ");
    setStepTwo((prev) => (prev ? { ...prev, skills: normalized } : prev));
  }

  async function onAnalyzeCv() {
    resetStatusForInput();
    if (!file) {
      setStatus("error");
      setMessage("Ajoute un CV PDF pour continuer.");
      return;
    }
    if (!isPdfUpload(file)) {
      setStatus("error");
      setMessage("Le CV doit être au format PDF.");
      return;
    }

    setParsing(true);
    try {
      const fd = new FormData();
      fd.set("cv", file);
      const r = await fetch("/api/depot", {
        method: "PUT",
        body: fd,
      });
      if (!r.ok) {
        const j: { error?: string } = await r.json().catch(() => ({}));
        throw new Error(j.error || "affinda_failed");
      }
      const j: {
        ok: boolean;
        parsed?: {
          name: string;
          email: string;
          jobTitle: string;
          skills: string[];
          city: string;
        };
      } = await r.json();
      if (!j.ok || !j.parsed) throw new Error("affinda_invalid_payload");
      setStepTwo({
        name: j.parsed.name || "",
        email: j.parsed.email || "",
        jobTitle: j.parsed.jobTitle || "",
        skills: (j.parsed.skills || []).slice(0, 5).join(", "),
        city: j.parsed.city || "",
        manualFallback: false,
      });
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : "Erreur inconnue";
      const affindaLike =
        raw === "affinda_not_configured" ||
        raw === "affinda_invalid_payload" ||
        raw === "affinda_failed" ||
        raw.startsWith("affinda_failed_");
      if (affindaLike) {
        enableManualStepTwo();
      } else {
        enableManualStepTwo(
          "Analyse impossible. Tu peux compléter les champs manuellement.",
        );
      }
    } finally {
      setParsing(false);
    }
  }

  async function onSubmit() {
    setStatus("loading");
    setMessage("");
    setOwnerProfileUrl("");
    setOwnerProfileAbsoluteUrl("");

    try {
      if (!file) throw new Error("Ajoute un PDF.");
      if (!isPdfUpload(file)) {
        throw new Error("Le CV doit être au format PDF.");
      }
      if (!stepTwo) throw new Error("Analyse ou saisie manuelle requise avant validation.");
      if (!form.accepted) throw new Error("Tu dois accepter la charte.");

      const fd = new FormData();
      fd.set("handle", form.handle.trim());
      fd.set("candidateName", stepTwo.name || "");
      fd.set("parsedEmail", stepTwo.email || "");
      fd.set("parsedJobTitle", stepTwo.jobTitle || "");
      fd.set("parsedSkills", stepTwo.skills || "");
      fd.set("parsedCity", stepTwo.city || "");
      fd.set("accepted", String(!!form.accepted));
      fd.set("cv", file);

      const r = await fetch("/api/depot", { method: "POST", body: fd });
      if (!r.ok) {
        const j: { error?: string; retryAfterSec?: number } = await r
          .json()
          .catch(() => ({}));

        const code = j?.error || "Erreur dépôt";
        throw new Error(formatDepotError(code, j?.retryAfterSec));
      }

      const data = (await r.json()) as DepotSuccess;
      setStatus("done");
      setMessage("");
      if (data.profileUrl) {
        setOwnerProfileUrl(data.profileUrl);
      }
      if (data.absoluteProfileUrl) {
        setOwnerProfileAbsoluteUrl(data.absoluteProfileUrl);
      }
      setFile(null);
      setStepTwo(null);
      setForm((f) => ({ ...f, accepted: false }));
    } catch (e: unknown) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  return (
    <div
      className="rs-depot-page mx-auto box-border grid w-full min-w-0 max-w-full gap-3 overflow-x-hidden bg-white pb-4 pt-1 sm:gap-6 sm:pb-8 sm:pt-0"
      style={{ fontFamily: "var(--font-body), ui-sans-serif, system-ui, sans-serif" }}
    >
      <PortalDesktopPageHeader
        eyebrow="Candidature"
        title="Dépose ta candidature"
        description={
          <>
            Un seul fichier suffit.
            <br />
            La communauté fait le reste.
          </>
        }
      />

      <div className="min-w-0 max-w-full rounded-[8px] border border-[#F0F0F0] bg-[#FAFAFA] p-3 sm:p-6 lg:hidden">
        <h1 className="text-lg font-bold leading-tight tracking-tight text-[#0A0A0A]">
          Dépose ta candidature
        </h1>
        <p className="mt-1.5 text-xs font-normal leading-snug text-[#6B6B6B]">
          Un seul fichier suffit. La communauté fait le reste.
        </p>
      </div>

      {status === "done" ? (
        <div className="min-w-0 max-w-full rounded-xl border border-[#E8E8E8] bg-white p-4 sm:p-8">
          <span className="rs-pill inline-flex rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wide">
            EN ATTENTE
          </span>
          <p className="mt-4 text-base font-medium leading-relaxed text-[#0A0A0A]">
            Ton CV est en cours de validation. On revient vers toi.
          </p>
          {ownerProfileUrl ? (
            <div className="mt-6 grid gap-3">
              <a
                href={ownerProfileUrl}
                className="inline-flex w-full min-w-0 max-w-full items-center justify-center break-all rounded-[6px] border border-[#F0F0F0] bg-white px-3 py-2.5 text-center text-xs font-medium text-[#0A0A0A] no-underline hover:bg-[#FAFAFA] sm:max-w-md sm:px-4 sm:text-sm"
              >
                {`/mon-profil/${ownerToken || "[token]"}`}
              </a>
              {ownerToken ? (
                <a
                  href={`/connexion?token=${encodeURIComponent(
                    ownerToken,
                  )}&profileUrl=${encodeURIComponent(
                    ownerProfileAbsoluteUrl || ownerProfileUrl,
                  )}`}
                  className="inline-flex w-full min-w-0 max-w-full items-center justify-center rounded-[6px] bg-[#F472B6] px-3 py-2.5 text-center text-xs font-medium text-white no-underline hover:opacity-95 sm:max-w-md sm:px-4 sm:text-sm"
                >
                  Créer un compte / se connecter
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
      <div className="min-w-0 max-w-full rounded-xl border border-[#E8E8E8] bg-white p-4 sm:p-8">
        <div className="rs-depot-stepper min-w-0 text-[12px] sm:text-base" aria-label="Progression">
          <div
            className={`rs-depot-step ${!stepTwo ? "rs-depot-step--active" : ""}`}
          >
            <span className="rs-depot-step__num">1</span>
            <span>Upload &amp; analyse</span>
          </div>
          <div className={`rs-depot-step ${stepTwo ? "rs-depot-step--active" : ""}`}>
            <span className="rs-depot-step__num">2</span>
            <span>Vérifier &amp; envoyer</span>
          </div>
        </div>

        <p className="text-xs font-bold text-[#0A0A0A] sm:text-sm">Étape 1 — Upload</p>
        <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-[#0A0A0A] sm:text-sm">
              Pseudo Instagram (obligatoire)
            </span>
            <input
              value={form.handle}
              onChange={(e) => {
                setForm({ ...form, handle: e.target.value });
                resetStatusForInput();
              }}
              className="rounded-[6px] border border-[#F0F0F0] bg-white px-3 py-2 text-sm"
              placeholder="@pseudo"
            />
          </label>

          <div className="grid gap-1">
            <span className="text-xs font-medium text-[#0A0A0A] sm:text-sm">
              CV en PDF (obligatoire)
            </span>
            <label className="block w-full min-w-0 max-w-full cursor-pointer rounded-xl border-2 border-dashed border-[#E8E8E8] bg-white p-4 text-center transition-colors hover:border-[#f472b6] hover:bg-[#FFF5F7] sm:p-8">
              <svg
                className="mx-auto mb-2 h-6 w-6 text-[#6B6B6B] sm:mb-3 sm:h-8 sm:w-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
              <span className="block text-xs font-medium text-[#6B6B6B] sm:text-sm">
                Glisse-dépose ton PDF ou clique pour choisir un fichier
              </span>
              <span className="mt-0.5 block text-[11px] font-normal text-[#6B6B6B]/90 sm:mt-1 sm:text-xs">
                Un seul fichier · PDF uniquement
              </span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setStepTwo(null);
                  resetStatusForInput();
                }}
                className="sr-only"
              />
              {file ? (
                <span className="mt-3 block text-sm font-semibold text-[#f472b6]">
                  ✓ {file.name}
                </span>
              ) : null}
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:mt-5">
          <button
            type="button"
            disabled={!canAnalyze || parsing}
            onClick={onAnalyzeCv}
            className={`w-full rounded-full border-0 px-4 py-3 text-xs font-bold transition-colors duration-150 sm:py-[14px] sm:text-sm ${
              canAnalyze
                ? "cursor-pointer bg-[#f472b6] text-white hover:bg-[#db2777]"
                : "cursor-not-allowed bg-[#f4f4f2] text-[#999990]"
            }`}
          >
            Analyser mon CV
          </button>
          <button
            type="button"
            disabled={!canContinueWithoutAnalysis || parsing || !!stepTwo}
            onClick={() => enableManualStepTwo()}
            className={`w-full rounded-full border px-4 py-3 text-xs font-bold transition-colors duration-150 sm:py-[14px] sm:text-sm ${
              canContinueWithoutAnalysis && !stepTwo
                ? "cursor-pointer border-[#E8E8E8] bg-white text-[#0A0A0A] hover:border-[#f472b6]"
                : "cursor-not-allowed border-[#F0F0F0] bg-[#FAFAFA] text-[#999990]"
            }`}
          >
            Continuer sans analyse
          </button>
        </div>

        {parsing ? (
          <div className="mt-3 flex items-center gap-2 rounded-[8px] border border-[#F0F0F0] bg-[#FAFAFA] p-2.5 text-xs text-[#6B6B6B] sm:mt-4 sm:p-3 sm:text-sm">
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#F0F0F0] border-t-[#F472B6]"
              aria-hidden
            />
            Analyse de votre CV...
          </div>
        ) : null}

        {stepTwo ? (
          <div className="mt-5 border-t border-[#F0F0F0] pt-4 sm:mt-8 sm:pt-6">
            <p className="text-xs font-bold text-[#0A0A0A] sm:text-sm">
              Étape 2 — Vérifier et compléter
            </p>
            <div className="mt-3 grid min-w-0 gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-4">
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-medium text-[#0A0A0A] sm:text-sm">Nom complet</span>
                <input
                  value={stepTwo.name}
                  onChange={(e) =>
                    setStepTwo((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev,
                    )
                  }
                  placeholder="Non détecté — à compléter"
                  className="rounded-[6px] border border-[#F0F0F0] bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[#0A0A0A] sm:text-sm">
                  Métier / spécialité
                </span>
                <input
                  value={stepTwo.jobTitle}
                  onChange={(e) =>
                    setStepTwo((prev) =>
                      prev ? { ...prev, jobTitle: e.target.value } : prev,
                    )
                  }
                  placeholder="Non détecté — à compléter"
                  className="rounded-[6px] border border-[#F0F0F0] bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[#0A0A0A] sm:text-sm">
                  Email (non affiché publiquement)
                </span>
                <input
                  value={stepTwo.email}
                  onChange={(e) =>
                    setStepTwo((prev) =>
                      prev ? { ...prev, email: e.target.value } : prev,
                    )
                  }
                  placeholder="Non détecté — à compléter"
                  className="rounded-[6px] border border-[#F0F0F0] bg-white px-3 py-2 text-sm"
                  inputMode="email"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[#0A0A0A] sm:text-sm">
                  Compétences principales (max 5)
                </span>
                <input
                  value={stepTwo.skills}
                  onChange={(e) => onSkillsChange(e.target.value)}
                  placeholder="Non détecté — à compléter"
                  className="rounded-[6px] border border-[#F0F0F0] bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[#0A0A0A] sm:text-sm">Ville</span>
                <input
                  value={stepTwo.city}
                  onChange={(e) =>
                    setStepTwo((prev) =>
                      prev ? { ...prev, city: e.target.value } : prev,
                    )
                  }
                  placeholder="Détectée ou préfecture si code postal trouvé"
                  className="rounded-[6px] border border-[#F0F0F0] bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>

            {stepTwo.manualFallback ? (
              <p className="mt-2 text-xs text-[#0A0A0A]/70 sm:mt-3 sm:text-sm">
                Analyse indisponible : renseigne les champs manuellement.
              </p>
            ) : null}

            <label className="mt-3 flex items-start gap-2 text-xs text-[#0A0A0A] sm:mt-4 sm:text-sm">
              <input
                type="checkbox"
                checked={form.accepted}
                onChange={(e) => setForm({ ...form, accepted: e.target.checked })}
                className="mt-1"
              />
              <span>
                Pas de photo. Un seul PDF.
                <br />
                Offre non négociable.
              </span>
            </label>

            <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:flex-row sm:items-center">
              <button
                disabled={!canSubmit || status === "loading" || parsing}
                onClick={onSubmit}
                className="rs-btn rs-btn--primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "loading" ? "Envoi..." : "Déposer ma candidature"}
              </button>
              <a
                href="/profils"
                className="rs-btn rs-btn--ghost"
              >
                Voir les profils
              </a>
            </div>
          </div>
        ) : null}

        {message ? (
          <p
            className={`mt-4 text-sm ${
              status === "error" ? "text-red-700" : "text-[#0A0A0A]/85"
            }`}
          >
            {message}
          </p>
        ) : null}

      </div>
      )}
    </div>
  );
}

export default function DepotPage() {
  return (
    <RequireAuthGate nextPath="/depot" initialMode="signup">
      <DepotPageInner />
    </RequireAuthGate>
  );
}

