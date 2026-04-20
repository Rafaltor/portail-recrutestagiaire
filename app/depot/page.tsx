"use client";

import { useMemo, useState } from "react";

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

export default function DepotPage() {
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
    if (file.type !== "application/pdf") {
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
      if (raw === "affinda_not_configured") {
        setStatus("idle");
        setMessage(
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
      } else if (raw.startsWith("affinda_failed_")) {
        setStatus("idle");
        setMessage(
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
      } else if (raw === "affinda_invalid_payload") {
        setStatus("idle");
        setMessage(
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
      } else {
        setStatus("error");
        setMessage(raw);
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
      if (file.type !== "application/pdf") {
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
        if (code === "handle_required") {
          throw new Error("Pseudo Instagram obligatoire.");
        }

        throw new Error(code);
      }

      const data = (await r.json()) as DepotSuccess;
      setStatus("done");
      setMessage(
        "Ta candidature est en cours d'examen. Dans la limite des postes disponibles.",
      );
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
    <div className="grid gap-6">
      <div className="rs-panel rounded-lg p-6">
        <h1 className="text-xl font-black tracking-tight">
          Dépose ta candidature
        </h1>
        <p className="mt-2 text-sm text-[#0A0A0A]/85">
          Un seul fichier suffit.
          <br />
          La communauté fait le reste.
        </p>
      </div>

      <div className="rs-panel rounded-lg p-6">
        <p className="text-sm font-bold text-[#0A0A0A]">Étape 1 — Upload</p>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Pseudo Instagram (obligatoire)</span>
            <input
              value={form.handle}
              onChange={(e) => {
                setForm({ ...form, handle: e.target.value });
                resetStatusForInput();
              }}
              className="rounded-md border border-[#ddd] px-3 py-2 text-sm"
              placeholder="@pseudo"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold">CV en PDF (obligatoire)</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setStepTwo(null);
                resetStatusForInput();
              }}
              className="rounded-md border border-[#ddd] bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>

        <button
          disabled={!canAnalyze || parsing}
          onClick={onAnalyzeCv}
          className="rs-btn rs-btn--primary mt-5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Analyser mon CV
        </button>

        {parsing ? (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-[#ddd] bg-[#fafafa] p-3 text-sm text-[#0A0A0A]/85">
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#ddd] border-t-[#F472B6]"
              aria-hidden
            />
            Analyse de votre CV...
          </div>
        ) : null}

        {stepTwo ? (
          <div className="mt-8 border-t border-[#ddd] pt-6">
            <p className="text-sm font-bold text-[#0A0A0A]">
              Étape 2 — Vérifier et compléter
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-sm font-semibold">Nom complet</span>
                <input
                  value={stepTwo.name}
                  onChange={(e) =>
                    setStepTwo((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev,
                    )
                  }
                  placeholder="Non détecté — à compléter"
                  className="rounded-md border border-[#ddd] px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold">Métier / spécialité</span>
                <input
                  value={stepTwo.jobTitle}
                  onChange={(e) =>
                    setStepTwo((prev) =>
                      prev ? { ...prev, jobTitle: e.target.value } : prev,
                    )
                  }
                  placeholder="Non détecté — à compléter"
                  className="rounded-md border border-[#ddd] px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold">
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
                  className="rounded-md border border-[#ddd] px-3 py-2 text-sm"
                  inputMode="email"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold">
                  Compétences principales (max 5)
                </span>
                <input
                  value={stepTwo.skills}
                  onChange={(e) => onSkillsChange(e.target.value)}
                  placeholder="Non détecté — à compléter"
                  className="rounded-md border border-[#ddd] px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold">Ville</span>
                <input
                  value={stepTwo.city}
                  onChange={(e) =>
                    setStepTwo((prev) =>
                      prev ? { ...prev, city: e.target.value } : prev,
                    )
                  }
                  placeholder="Détectée ou préfecture si code postal trouvé"
                  className="rounded-md border border-[#ddd] px-3 py-2 text-sm"
                />
              </label>
            </div>

            {stepTwo.manualFallback ? (
              <p className="mt-3 text-sm text-[#0A0A0A]/70">
                Analyse indisponible : renseigne les champs manuellement.
              </p>
            ) : null}

            <label className="mt-4 flex items-start gap-2 text-sm text-[#0A0A0A]">
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

            <div className="mt-5 flex items-center gap-2">
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

        {status === "done" && ownerProfileUrl ? (
          <div className="mt-3 grid gap-3">
            <a
              href={ownerProfileUrl}
              className="inline-flex w-fit rounded-md border-2 border-[#F472B6] bg-white px-3 py-2 text-sm font-semibold text-[#F472B6] hover:bg-[#fff5fa]"
            >
              {`/mon-profil/${ownerToken || "[token]"}`}
            </a>
            <div className="rounded-md border border-[#ddd] bg-[#fafafa] p-3 text-sm text-[#0A0A0A]/85">
              <p>
                Optionnel : crée un compte pour suivre tes stats plus facilement.
              </p>
              {ownerToken ? (
                <a
                  href={`/connexion?token=${encodeURIComponent(
                    ownerToken,
                  )}&profileUrl=${encodeURIComponent(
                    ownerProfileAbsoluteUrl || ownerProfileUrl,
                  )}`}
                  className="mt-2 inline-flex rounded-md border-2 border-[#F472B6] bg-white px-3 py-2 text-sm font-semibold text-[#F472B6] hover:bg-[#fff5fa]"
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

