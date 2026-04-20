"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PortalDesktopPageHeader } from "@/components/PortalDesktopPageHeader";

const PROFILS_DESCRIPTION = (
  <>
    Parcours les CV comme sur une vitrine d’offres : deux profils par ligne sur
    grand écran, un sur très petit mobile. Infos à gauche, aperçu du PDF à
    droite dans chaque carte.
  </>
);

type ProfilsListDesktopHeaderProps = {
  className?: string;
  /** Sur `/profils` : champ filtre branché sur l’état local. */
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  /** Sur `/swipe` : même apparence, le « filtre » ouvre la liste profils. */
  filterAsProfilsLink?: boolean;
  message?: ReactNode;
  /** `id` du champ (page profils : desktop vs mobile ont des ids différents côté page). */
  filterInputId?: string;
};

/**
 * Bandeau desktop identique à la page liste `/profils` (`PortalDesktopPageHeader` + actions).
 */
export function ProfilsListDesktopHeader({
  className = "",
  filterValue = "",
  onFilterChange,
  filterAsProfilsLink = false,
  message,
  filterInputId = "rs-profils-filter-desktop",
}: ProfilsListDesktopHeaderProps) {
  const actions = filterAsProfilsLink ? (
    <>
      <span className="sr-only">Filtrer les profils</span>
      <Link
        href="/profils"
        className="rs-profils-list__search flex w-full items-center rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--rs-logo-blue-deep,#0A0A0A)] no-underline hover:opacity-90"
      >
        Ouvrir la liste des profils pour filtrer…
      </Link>
      <a
        href="/depot"
        className="rs-btn rs-btn--primary shrink-0 whitespace-nowrap px-5 text-center"
      >
        Déposer un CV
      </a>
    </>
  ) : (
    <>
      <label className="sr-only" htmlFor={filterInputId}>
        Filtrer les profils
      </label>
      <input
        id={filterInputId}
        value={filterValue}
        onChange={(e) => onFilterChange?.(e.target.value)}
        placeholder="Métier, ville…"
        className="rs-profils-list__search w-full rounded-lg px-4 py-2.5 text-sm text-[var(--rs-logo-blue-deep,#0A0A0A)] placeholder:text-[#0A0A0A]/55"
      />
      <a
        href="/depot"
        className="rs-btn rs-btn--primary shrink-0 whitespace-nowrap px-5 text-center"
      >
        Déposer un CV
      </a>
    </>
  );

  return (
    <PortalDesktopPageHeader
      className={className}
      eyebrow="Candidats publiés"
      title="Profils"
      description={PROFILS_DESCRIPTION}
      actions={actions}
      message={message}
    />
  );
}
