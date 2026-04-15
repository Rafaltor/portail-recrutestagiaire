"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type FormState = {
  handle: string;
  jobTitle: string;
  city: string;
  tags: string;
  portfolioUrl: string;
  accepted: boolean;
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
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string>("");

  const canSubmit = useMemo(() => {
    return (
      form.accepted &&
      form.handle.trim().length > 1 &&
      form.jobTitle.trim().length > 1 &&
      !!file
    );
  }, [form.accepted, form.handle, form.jobTitle, file]);

  async function onSubmit() {
    setStatus("loading");
    setMessage("");

    try {
      if (!file) throw new Error("Ajoute un PDF.");
      if (file.type !== "application/pdf") {
        throw new Error("Le CV doit être au format PDF.");
      }
      if (!form.accepted) throw new Error("Tu dois accepter la charte.");

      const now = new Date();
      const safeHandle = form.handle
        .trim()
        .replace(/^@/, "")
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .slice(0, 60);
      const path = `pending/${safeHandle}/${now.getTime()}-${file.name
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")}`;

      const upload = await supabase.storage.from("cvs").upload(path, file, {
        upsert: false,
        contentType: "application/pdf",
      });
      if (upload.error) throw upload.error;

      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12);

      const insert = await supabase.from("profiles").insert({
        handle: form.handle.trim(),
        job_title: form.jobTitle.trim(),
        city: form.city.trim() || null,
        tags,
        portfolio_url: form.portfolioUrl.trim() || null,
        cv_path: path,
        status: "pending",
      });
      if (insert.error) throw insert.error;

      setStatus("done");
      setMessage(
        "Candidature envoyée. Elle sera visible après modération (pas de photo de profil).",
      );
      setFile(null);
      setForm((f) => ({ ...f, accepted: false }));
    } catch (e: unknown) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-black tracking-tight">
          Déposer un profil (PDF)
        </h1>
        <p className="mt-2 text-sm text-zinc-700">
          Le profil public affiche le pseudo (ex: Instagram) et le CV PDF. Pas de
          photo de profil.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
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
            <span className="text-sm font-semibold">CV (PDF)</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>

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
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading" ? "Envoi..." : "Envoyer"}
          </button>
          <a
            href="/profils"
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
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
      </div>
    </div>
  );
}

