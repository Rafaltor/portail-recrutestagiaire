import type { ReactNode } from "react";

/**
 * Bloc accueil « Comment ça marche » — parcours candidat + cycle RS (charte sombre / rose portail).
 */
function JourneyCard({
  step,
  title,
  bullets,
}: {
  step: string;
  title: string;
  bullets?: string[];
}) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl bg-[#1a1a1a] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/10 sm:px-5 sm:py-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
        {step}
      </p>
      <h3 className="mt-1.5 text-base font-black leading-snug text-white sm:text-lg">
        {title}
      </h3>
      {bullets?.length ? (
        <ul className="mt-2.5 space-y-1 text-sm leading-snug text-white/80">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CycleCard({
  step,
  title,
  bullets,
  highlight,
}: {
  step: string;
  title: string;
  bullets?: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl bg-[#1a1a1a] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-5 sm:py-5 ${
        highlight
          ? "ring-2 ring-[var(--rs-brand-pink,#F472B6)] ring-offset-2 ring-offset-[#0a0a0a]"
          : "ring-1 ring-white/10"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
        {step}
      </p>
      <h3 className="mt-1.5 text-base font-black leading-snug text-white sm:text-lg">
        {title}
      </h3>
      {bullets?.length ? (
        <ul className="mt-2.5 space-y-1 text-sm leading-snug text-white/80">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Arrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`flex shrink-0 select-none items-center justify-center text-lg font-black text-[var(--rs-brand-pink,#F472B6)] sm:text-xl ${className}`.trim()}
      aria-hidden
    >
      {children}
    </span>
  );
}

export function HomeHowItWorks() {
  return (
    <section
      className="overflow-hidden rounded-2xl bg-[#0a0a0a] px-4 py-9 text-white sm:px-7 sm:py-11"
      aria-labelledby="rs-home-how-title"
    >
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
        Comment ça marche
      </p>
      <h2
        id="rs-home-how-title"
        className="mt-2 text-center text-2xl font-black tracking-tight text-white sm:text-3xl"
      >
        Ton parcours
      </h2>

      {/* Desktop : [01]→[02] / ↑ · ↓ / [04]←[03]. Mobile : colonne 01→02→03→04 */}
      <div className="mx-auto mt-8 hidden sm:block sm:max-w-2xl">
        <div className="grid grid-cols-[minmax(0,1fr)_2.25rem_minmax(0,1fr)] grid-rows-3 items-stretch gap-x-2 gap-y-2">
          <JourneyCard step="01" title="Poste ton CV" />
          <Arrow className="self-center justify-center">→</Arrow>
          <JourneyCard
            step="02"
            title="Vote"
            bullets={["• ton CV est boosté", "• -10% sur le shop"]}
          />
          <div className="flex items-start justify-center pt-1">
            <Arrow>↑</Arrow>
          </div>
          <div aria-hidden className="min-h-[1rem]" />
          <div className="flex items-start justify-center pt-1">
            <Arrow>↓</Arrow>
          </div>
          <JourneyCard step="04" title="Bosse et redépose" />
          <Arrow className="self-center justify-center">←</Arrow>
          <JourneyCard step="03" title="Les non-stagiaires t'approuvent" />
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-xl space-y-2 sm:hidden">
        <JourneyCard step="01" title="Poste ton CV" />
        <Arrow className="py-0.5">↓</Arrow>
        <JourneyCard
          step="02"
          title="Vote"
          bullets={["• ton CV est boosté", "• -10% sur le shop"]}
        />
        <Arrow className="py-0.5">↓</Arrow>
        <JourneyCard step="03" title="Les non-stagiaires t'approuvent" />
        <Arrow className="py-0.5">↓</Arrow>
        <JourneyCard step="04" title="Bosse et redépose" />
      </div>

      <div className="mx-auto mt-6 flex max-w-xl flex-col gap-3 rounded-xl bg-[var(--rs-brand-pink,#F472B6)] px-4 py-4 sm:max-w-2xl sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/90">
            Sortie du cycle
          </p>
          <p className="mt-0.5 text-xl font-black tracking-tight text-white sm:text-2xl">
            T&apos;as été pris →
          </p>
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-full border-2 border-white/50 bg-white/15 text-xl text-white sm:self-center sm:h-12 sm:w-12"
          aria-hidden
        >
          ↓
        </div>
      </div>

      <div className="relative mx-auto mt-10 max-w-xl md:max-w-2xl">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/15" aria-hidden />
        <p className="relative mx-auto w-max bg-[#0a0a0a] px-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-white/40">
          Le recrutement
        </p>
      </div>

      <h2 className="mt-8 text-center text-2xl font-black tracking-tight text-white sm:text-3xl">
        Le cycle RS
      </h2>

      <div className="mx-auto mt-6 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:max-w-2xl">
        <CycleCard step="01" title="Vote" />
        <CycleCard step="02" title="Classement" />
        <CycleCard
          step="03"
          title="Nouvelle recrue"
          bullets={[
            "• vernissage",
            "• guest list bons votants",
            "• CV sur le packaging",
          ]}
          highlight
        />
        <CycleCard step="04" title="Nouvelle session" />
      </div>

      <div className="mx-auto mt-8 max-w-xl md:max-w-2xl">
        <a
          href="/depot"
          className="rs-btn rs-btn--primary flex w-full flex-col items-center gap-0.5 rounded-xl py-4 text-center no-underline hover:no-underline sm:py-5"
        >
          <span className="text-base font-black sm:text-lg">Poste ton CV</span>
          <span className="text-xs font-semibold normal-case opacity-95">
            gratuit · sans compte obligatoire
          </span>
        </a>
      </div>
    </section>
  );
}
