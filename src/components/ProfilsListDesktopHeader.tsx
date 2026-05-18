"use client";

import type { ReactNode } from "react";
import { PortalDesktopPageHeader } from "@/components/PortalDesktopPageHeader";

const PROFILS_DESCRIPTION = (
  <>Les profils les plus likés par la communauté.</>
);

type ProfilsListDesktopHeaderProps = {
  className?: string;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  message?: ReactNode;
  filterInputId?: string;
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
}: ProfilsListDesktopHeaderProps) {
  const actions = (
    <>
      <label className="sr-only" htmlFor={filterInputId}>
        Filtrer les profils
      </label>
      <input
        id={filterInputId}
        value={filterValue}
        onChange={(e) => onFilterChange?.(e.target.value)}
        placeholder="Métier, ville…"
        className="rs-profils-list__search w-full max-w-md rounded-xl border-[1.5px] border-[#E8E8E8] bg-white px-4 py-2.5 text-sm text-[#0A0A0A] outline-none transition-colors placeholder:text-[#6B6B6B]/70 focus:border-[#f472b6]"
      />
      <a
        href="/depot"
        className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#f472b6] px-7 py-3 text-center text-sm font-bold text-white no-underline transition-colors hover:bg-[#db2777]"
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
