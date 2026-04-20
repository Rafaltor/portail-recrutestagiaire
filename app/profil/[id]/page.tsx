"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import PdfPreview from "@/components/PdfPreview";

type Profile = {
  id: string;
  handle: string;
  job_title: string;
  city: string | null;
  portfolio_url: string | null;
  cv_path: string;
};

type ProfileRow = Profile & { status: string };

export default function ProfilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cvUrl, setCvUrl] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      setMessage("");
      try {
        const profileRes = await fetch(`/api/profile/${id}`, {
          method: "GET",
        });

        if (profileRes.status === 404) {
          setMessage("Profil introuvable ou non publié.");
          setProfile(null);
          return;
        }
        if (!profileRes.ok) {
          const j = await profileRes.json().catch(() => ({}));
          throw new Error(j?.error || "Erreur API profil");
        }

        const data = (await profileRes.json()) as ProfileRow;
        if (!alive) return;
        setProfile(data);

        const cvRes = await fetch(`/api/cv/${id}`, { method: "GET" });
        if (!cvRes.ok) {
          const j = await cvRes.json().catch(() => ({}));
          throw new Error(j?.error || "Erreur API CV");
        }
        const cv = (await cvRes.json()) as { url: string };
        if (!alive) return;
        setCvUrl(cv.url);
      } catch (e: unknown) {
        setMessage(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className="grid gap-6">
      <div className="rs-panel rounded-lg p-6">
        <Link href="/profils" className="text-sm font-semibold">
          ← Retour aux profils
        </Link>
        {loading ? (
          <p className="mt-3 text-sm text-[#0A0A0A]/85">Chargement…</p>
        ) : message ? (
          <p className="mt-3 text-sm text-red-700">{message}</p>
        ) : profile ? (
          <div className="mt-3">
            <div className="text-sm font-black text-[#0A0A0A]">
              @{profile.handle.replace(/^@/, "")}
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight">
              {profile.job_title}
            </h1>
            <p className="mt-1 text-sm text-[#0A0A0A]/85">
              {profile.city ? profile.city : "—"}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {profile.portfolio_url ? (
                <a
                  href={profile.portfolio_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border-2 border-[#F472B6] bg-white px-4 py-2 text-sm font-semibold text-[#F472B6] hover:bg-[#fff5fa]"
                >
                  Portfolio
                </a>
              ) : null}
              {cvUrl ? (
                <a
                  href={cvUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-[#F472B6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ec4899]"
                >
                  Ouvrir le PDF
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {profile && cvUrl ? (
        <PdfPreview url={cvUrl} />
      ) : null}
    </div>
  );
}

