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

type ParsedPreview = {
  name: string;
  email: string;
  jobTitle: string;
  skills: string[];
  hasPhoto: boolean;
};

export default function DepotPage() {
  const [form, setForm] = useState<FormState>({
    handle: "",
    accepted: false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedPreview | null>(null);
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

  const canSubmit = useMemo(() => {
    return (
      form.accepted &&
      form.handle.trim().length > 1 &&
      !!file &&
      !!parsed &&
      !parsed.hasPhoto
    );
  }, [form.accepted, form.handle, file, parsed]);

  async function onFileChange(nextFile: File | null) {
    setFile(nextFile);
    setParsed(null);
    if (!nextFile) return;
    setParsing(true);
    setMessage("");
    try {
      if (nextFile.type !== "application/pdf") {
        throw new Error("Le CV doit être au format PDF.");
      }
      const fd = new FormData();
      fd.set("cv", nextFile);
      const r = await fetch("/api/depot", {
        method: "PUT",
        body: fd,
      });
      if (!r.ok) {
        const j: { error?: string } = await r.json().catch(() => ({}));
        throw new Error(j.error || "affinda_failed");
      }
      const j: { ok: boolean; parsed?: ParsedPreview } = await r.json();
      if (!j.ok || !j.parsed) throw new Error("affinda_invalid_payload");
      setParsed(j.parsed);
      if (j.parsed.hasPhoto) {
        setMessage(
          "Photo détectée dans le CV. Dépôt bloqué. Merci d’envoyer un PDF sans photo.",
        );
      }
    } catch (e: unknown) {
      setParsed(null);
      const raw = e instanceof Error ? e.message : "Erreur inconnue";
      if (raw === "affinda_not_configured") {
        setMessage("Parsing temporairement indisponible. Réessaie plus tard.");
      } else if (raw.startsWith("affinda_failed_")) {
        setMessage("Impossible d’analyser ce CV pour le moment. Réessaie.");
      } else {
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
      if (!parsed) throw new Error("Analyse du CV requise avant validation.");
      if (parsed.hasPhoto) {
        throw new Error("Photo détectée. Dépôt refusé (charte).");
      }
      if (!form.accepted) throw new Error("Tu dois accepter la charte.");

      const fd = new FormData();
      fd.set("handle", form.handle.trim());
      fd.set("candidateName", parsed.name || "");
      fd.set("parsedEmail", parsed.email || "");
      fd.set("parsedJobTitle", parsed.jobTitle || "");
      fd.set("parsedSkills", parsed.skills.join(","));
      fd.set("photoDetected", String(parsed.hasPhoto));
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
        if (code === "affinda_preview_required") {
          throw new Error("Analyse CV incomplète. Réessaie l’upload du PDF.");
        }
        if (code === "photo_forbidden") {
          throw new Error("Photo détectée. Dépôt bloqué (charte).");
        }

        throw new Error(code);
      }

      const data = (await r.json()) as DepotSuccess;
      setStatus("done");
      setMessage(
        "Ta candidature est en cours d’examen. Dans la limite des postes disponibles.",
      );
      if (data.profileUrl) {
        setOwnerProfileUrl(data.profileUrl);
      }
      if (data.absoluteProfileUrl) {
        setOwnerProfileAbsoluteUrl(data.absoluteProfileUrl);
      }
      setFile(null);
      setParsed(null);
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
        <p className="mt-2 text-sm text-zinc-700">
          Un seul fichier suffit. La communauté fait le reste.
        </p>
      </div>

      <div className="rs-panel rounded-lg p-6">
        <div className="grid gap-4">
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
            <span className="text-sm font-semibold">CV (PDF)</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                void onFileChange(e.target.files?.[0] ?? null);
              }}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>

        {parsing ? (
          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            Analyse du CV en cours…
          </div>
        ) : null}

        {parsed ? (
          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            <p className="text-sm font-black text-zinc-900">
              Aperçu des infos extraites (Affinda)
            </p>
            <div className="mt-2 grid gap-1">
              <p>
                <span className="font-semibold">Nom:</span>{" "}
                {parsed.name || "Non détecté"}
              </p>
              <p>
                <span className="font-semibold">Email:</span>{" "}
                {parsed.email || "Non détecté"}
              </p>
              <p>
                <span className="font-semibold">Métier:</span>{" "}
                {parsed.jobTitle || "Non détecté"}
              </p>
              <p>
                <span className="font-semibold">Compétences:</span>{" "}
                {parsed.skills.length ? parsed.skills.join(", ") : "Non détectées"}
              </p>
            </div>
            {parsed.hasPhoto ? (
              <p className="mt-2 font-semibold text-rose-700">
                Photo détectée: dépôt bloqué.
              </p>
            ) : null}
          </div>
        ) : null}

        <label className="mt-4 flex items-start gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={form.accepted}
            onChange={(e) => setForm({ ...form, accepted: e.target.checked })}
            className="mt-1"
          />
          <span>
            Pas de photo. Un seul PDF. Offre non négociable.
          </span>
        </label>

        <div className="mt-5 flex items-center gap-2">
          <button
            disabled={!canSubmit || status === "loading" || parsing}
            onClick={onSubmit}
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
              Ouvrir mon lien /mon-profil
            </a>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
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

