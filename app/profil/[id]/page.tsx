"use client";

import { use, useEffect, useState } from "react";
import PdfPreview from "@/components/PdfPreview";
import { ProfilStylePortalHeader } from "@/components/ProfilStylePortalHeader";

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
      <ProfilStylePortalHeader
        profile={profile}
        cvUrl={cvUrl}
        loading={loading}
        errorMessage={message}
      />

      {profile && cvUrl ? (
        <PdfPreview url={cvUrl} />
      ) : null}
    </div>
  );
}

