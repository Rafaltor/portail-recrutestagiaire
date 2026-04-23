import type { ReactNode } from "react";

export type PortalDesktopPageHeaderProps = {
  eyebrow: string;
  title: string;
  /** Absent = pas de zone texte sous le titre (ex. accueil). */
  description?: ReactNode;
  /** Zone droite (recherche, boutons, etc.) — visible ≥ lg uniquement avec ce bloc. */
  actions?: ReactNode;
  message?: ReactNode;
  className?: string;
};

/**
 * Même bandeau que l’ancien `<header>` de `/profils` (classes alignées).
 * `hidden lg:block` : visible à partir du breakpoint « ordi » du portail (lg).
 */
export function PortalDesktopPageHeader({
  eyebrow,
  title,
  description,
  actions,
  message,
  className = "",
}: PortalDesktopPageHeaderProps) {
  return (
    <header
      className={`rs-panel hidden overflow-hidden rounded-xl p-4 sm:p-6 md:p-8 lg:block ${className}`.trim()}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#E11D48]">
            {eyebrow}
          </p>
          <h1 className="rs-portal-page-hero__title mt-1 max-w-full break-words text-2xl font-black tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description != null && description !== "" ? (
            <div className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--rs-logo-blue-deep,#0A0A0A)] opacity-90">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto lg:min-w-[300px]">
            {actions}
          </div>
        ) : null}
      </div>
      {message ? <div className="mt-4">{message}</div> : null}
    </header>
  );
}
