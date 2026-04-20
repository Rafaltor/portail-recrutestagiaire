import Link from "next/link";
import type { ReactNode } from "react";
import { PortalDesktopPageHeader } from "@/components/PortalDesktopPageHeader";

export type ProfilStylePortalProfile = {
  id: string;
  handle: string;
  job_title: string;
  city: string | null;
  portfolio_url: string | null;
};

type ProfilStylePortalHeaderProps = {
  profile: ProfilStylePortalProfile | null;
  cvUrl: string;
  loading: boolean;
  /** Erreur API / blocage : texte en rouge sous le titre (pas de `profile`). */
  errorMessage?: string;
  /** Titre quand pas de profil, pas en chargement, pas d’erreur (ex. fin de pile swipe). */
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  mobileDetailPanel?: boolean;
  desktopClassName?: string;
};

/**
 * Même en-tête de page que `/profil/[id]` : `PortalDesktopPageHeader` + panneau mobile optionnel.
 */
export function ProfilStylePortalHeader({
  profile,
  cvUrl,
  loading,
  errorMessage = "",
  emptyTitle,
  emptyDescription,
  mobileDetailPanel = true,
  desktopClassName = "",
}: ProfilStylePortalHeaderProps) {
  const err = errorMessage.trim();
  const hasEmpty = Boolean(emptyTitle) || emptyDescription != null;

  const title = profile
    ? profile.job_title
    : loading
      ? "Chargement…"
      : err
        ? "Profil indisponible"
        : emptyTitle || "Profil";

  const description: ReactNode = profile ? (
    <>{profile.city ?? "Ville non renseignée"}</>
  ) : loading ? (
    <>Récupération des informations du candidat…</>
  ) : err ? (
    <span className="text-red-700">{err}</span>
  ) : hasEmpty ? (
    (emptyDescription ?? "—") as ReactNode
  ) : (
    "—"
  );

  return (
    <>
      <PortalDesktopPageHeader
        className={desktopClassName}
        eyebrow={
          profile ? `@${profile.handle.replace(/^@/, "")}` : "Profil public"
        }
        title={title}
        description={description}
        actions={
          profile ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/profils"
                className="text-sm font-semibold text-[var(--rs-brand-pink,#f472b6)] underline-offset-2 hover:underline"
              >
                ← Profils
              </Link>
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
          ) : null
        }
      />

      {mobileDetailPanel ? (
        <div className="rs-panel rounded-lg p-6 lg:hidden">
          <Link href="/profils" className="text-sm font-semibold">
            ← Retour aux profils
          </Link>
          {loading ? (
            <p className="mt-3 text-sm text-[#0A0A0A]/85">Chargement…</p>
          ) : err ? (
            <p className="mt-3 text-sm text-red-700">{err}</p>
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
          ) : hasEmpty ? (
            <div className="mt-3 text-sm text-[#0A0A0A]/85">
              {emptyDescription ?? null}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
