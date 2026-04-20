"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
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
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  message?: ReactNode;
  filterInputId?: string;
  /**
   * Sur `/swipe` : même champ que sur `/profils` (placeholder, classes), en lecture seule ;
   * clic / focus → liste profils pour filtrer vraiment.
   */
  navigateToProfilsOnFilterFocus?: boolean;
};

/**
 * Bandeau desktop identique à la page liste `/profils` (`PortalDesktopPageHeader` + actions).
 */
export function ProfilsListDesktopHeader({
  className = "",
  filterValue = "",
  onFilterChange,
  message,
  filterInputId = "rs-profils-filter-desktop",
  navigateToProfilsOnFilterFocus = false,
}: ProfilsListDesktopHeaderProps) {
  const router = useRouter();

  const actions = (
    <>
      <label className="sr-only" htmlFor={filterInputId}>
        Filtrer les profils
      </label>
      <input
        id={filterInputId}
        readOnly={navigateToProfilsOnFilterFocus}
        value={navigateToProfilsOnFilterFocus ? "" : filterValue}
        onChange={
          navigateToProfilsOnFilterFocus
            ? undefined
            : (e) => onFilterChange?.(e.target.value)
        }
        onFocus={
          navigateToProfilsOnFilterFocus
            ? () => {
                router.push("/profils");
              }
            : undefined
        }
        onClick={
          navigateToProfilsOnFilterFocus
            ? () => {
                router.push("/profils");
              }
            : undefined
        }
        placeholder="Métier, ville…"
        className={
          "rs-profils-list__search w-full rounded-lg px-4 py-2.5 text-sm text-[var(--rs-logo-blue-deep,#0A0A0A)] placeholder:text-[#0A0A0A]/55" +
          (navigateToProfilsOnFilterFocus ? " cursor-pointer" : "")
        }
        aria-label={
          navigateToProfilsOnFilterFocus
            ? "Ouvrir la page Profils pour filtrer"
            : undefined
        }
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
