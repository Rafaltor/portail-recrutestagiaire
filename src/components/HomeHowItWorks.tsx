import type { ReactNode } from "react";

const innerMax = "mx-auto w-full max-w-2xl";

/**
 * Bloc accueil « Comment ça marche » — même grille 2×2 pour parcours et cycle RS.
 */
function DarkCard({
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
      className={`flex min-h-0 min-w-0 flex-col rounded-2xl bg-[#1a1a1a] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:min-h-[140px] sm:px-5 sm:py-5 ${
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
        <ul className="mt-2.5 flex-1 space-y-1 text-sm leading-snug text-white/80">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SectionTitle({
  kicker,
  title,
  id,
}: {
  /** Absent ou vide = pas de ligne au-dessus du titre. */
  kicker?: string | null;
  title: string;
  id?: string;
}) {
  const hasKicker = Boolean(kicker?.trim());
  return (
    <div className={`${innerMax} text-center`}>
      {hasKicker ? (
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
          {kicker}
        </p>
      ) : null}
      <h2
        id={id}
        className={`text-2xl font-black tracking-tight text-white sm:text-3xl ${hasKicker ? "mt-2" : ""}`}
      >
        {title}
      </h2>
    </div>
  );
}

function DividerLabel({ children }: { children: ReactNode }) {
  return (
    <div className={`relative ${innerMax} py-2`}>
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/15" aria-hidden />
      <p className="relative mx-auto w-max bg-[#0a0a0a] px-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-white/40">
        {children}
      </p>
    </div>
  );
}

export function HomeHowItWorks() {
  return (
    <section
      className="overflow-hidden rounded-2xl bg-[#0a0a0a] px-4 py-10 text-white sm:px-8 sm:py-12"
      aria-labelledby="rs-home-how-parcours rs-home-how-cycle"
    >
      <SectionTitle
        kicker="Comment ça marche"
        title="Ton parcours"
        id="rs-home-how-parcours"
      />

      {/* Même logique que « Le cycle RS » : grille 2 cols, ligne 1 = 01 | 02, ligne 2 = 04 | 03 */}
      <div
        className={`${innerMax} mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4`}
      >
        <DarkCard step="01" title="Poste ton CV" />
        <DarkCard
          step="02"
          title="Vote"
          bullets={["• ton CV est boosté", "• -10% sur le shop"]}
        />
        <DarkCard step="04" title="Bosse et redépose" />
        <DarkCard step="03" title="Les non-stagiaires t'approuvent" />
      </div>

      <div
        className={`${innerMax} mt-6 flex flex-col gap-3 rounded-xl bg-[var(--rs-brand-pink,#F472B6)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5`}
      >
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

      <div className="mt-10">
        <DividerLabel>Le recrutement</DividerLabel>
      </div>

      <div className="mt-10">
        <SectionTitle title="Le cycle RS" id="rs-home-how-cycle" />
      </div>

      <div
        className={`${innerMax} mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4`}
      >
        <DarkCard step="01" title="Vote" />
        <DarkCard step="02" title="Classement" />
        <DarkCard
          step="03"
          title="Nouvelle recrue"
          bullets={[
            "• vernissage",
            "• guest list bons votants",
            "• CV sur le packaging",
          ]}
          highlight
        />
        <DarkCard step="04" title="Nouvelle session" />
      </div>

      <div className={`${innerMax} mt-8`}>
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
