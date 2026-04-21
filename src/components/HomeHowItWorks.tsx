import type { ReactNode } from "react";

type CardDef = {
  step: string;
  title: string;
  bullets?: string[];
  highlight?: boolean;
};

const shell = "mx-auto w-full max-w-6xl";

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
      className={`flex min-h-0 min-w-0 flex-col rounded-2xl bg-[#1a1a1a] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] md:min-h-[132px] md:px-4 md:py-4 lg:min-h-[140px] lg:px-5 lg:py-5 ${
        highlight
          ? "ring-2 ring-[var(--rs-brand-pink,#F472B6)] ring-offset-2 ring-offset-[#0a0a0a]"
          : "ring-1 ring-white/10"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
        {step}
      </p>
      <h3 className="mt-1.5 text-base font-black leading-snug text-white lg:text-lg">
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

function Arrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`flex select-none items-center justify-center text-base font-black leading-none text-[var(--rs-brand-pink,#F472B6)] md:text-lg lg:text-xl ${className}`.trim()}
      aria-hidden
    >
      {children}
    </span>
  );
}

/**
 * Cycle 2×2 : positions TL, TR, BL, BR avec flèches → ↓ ← ↑ (desktop).
 * Mobile : ordre `mobileOrder` avec flèches ↓ entre chaque carte.
 */
function FlowCycleGrid({
  cards,
  mobileOrder,
}: {
  /** [coin haut-gauche, haut-droit, bas-gauche, bas-droit] */
  cards: [CardDef, CardDef, CardDef, CardDef];
  /** Indices 0–3 dans l’ordre vertical mobile (ex. parcours : 0,1,3,2 pour 01→02→03→04). */
  mobileOrder: [number, number, number, number];
}) {
  const [tl, tr, bl, br] = cards;
  const list = mobileOrder.map((i) => cards[i]!);

  return (
    <>
      {/* Mobile : colonne + ↓ */}
      <div className="space-y-1 md:hidden">
        {list.map((c, idx) => (
          <div key={`${c.step}-${c.title}-${idx}`}>
            <DarkCard {...c} />
            {idx < list.length - 1 ? (
              <div className="flex justify-center py-1">
                <Arrow>↓</Arrow>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Desktop : grille 3×3 avec flèches */}
      <div className="mx-auto hidden w-full max-w-md md:grid md:grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] md:grid-rows-3 md:gap-x-0 md:gap-y-2 lg:max-w-none">
        <DarkCard {...tl} />
        <Arrow className="self-center justify-center">→</Arrow>
        <DarkCard {...tr} />
        <div className="flex items-start justify-center pt-1">
          <Arrow>↑</Arrow>
        </div>
        <div className="min-h-[0.5rem]" aria-hidden />
        <div className="flex items-start justify-center pt-1">
          <Arrow>↓</Arrow>
        </div>
        <DarkCard {...bl} />
        <Arrow className="self-center justify-center">←</Arrow>
        <DarkCard {...br} />
      </div>
    </>
  );
}

function ColumnTitle({
  kicker,
  title,
  id,
}: {
  kicker?: string | null;
  title: string;
  id?: string;
}) {
  const hasKicker = Boolean(kicker?.trim());
  return (
    <div className="w-full text-center lg:text-left">
      {hasKicker ? (
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
          {kicker}
        </p>
      ) : null}
      <h2
        id={id}
        className={`text-2xl font-black tracking-tight text-white lg:text-3xl ${hasKicker ? "mt-2" : ""}`}
      >
        {title}
      </h2>
    </div>
  );
}

function DividerLabel({ children }: { children: ReactNode }) {
  return (
    <div className={`relative ${shell} py-2`}>
      <div
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/15"
        aria-hidden
      />
      <p className="relative mx-auto w-max bg-[#0a0a0a] px-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-white/40">
        {children}
      </p>
    </div>
  );
}

export function HomeHowItWorks() {
  const parcoursCards: [CardDef, CardDef, CardDef, CardDef] = [
    { step: "01", title: "Poste ton CV" },
    {
      step: "02",
      title: "Vote",
      bullets: ["• ton CV est boosté", "• -10% sur le shop"],
    },
    { step: "04", title: "Bosse et redépose" },
    { step: "03", title: "Les non-stagiaires t'approuvent" },
  ];

  const cycleCards: [CardDef, CardDef, CardDef, CardDef] = [
    { step: "01", title: "Vote" },
    { step: "02", title: "Classement" },
    {
      step: "03",
      title: "Nouvelle recrue",
      bullets: [
        "• vernissage",
        "• guest list bons votants",
        "• CV sur le packaging",
      ],
      highlight: true,
    },
    { step: "04", title: "Nouvelle session" },
  ];

  return (
    <section
      className="overflow-hidden rounded-2xl bg-[#0a0a0a] px-4 py-10 text-white sm:px-8 sm:py-12"
      aria-labelledby="rs-home-how-parcours rs-home-how-cycle"
    >
      <div className={`${shell} flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-10`}>
        {/* —— Ton parcours (gauche desktop) —— */}
        <div className="min-w-0 flex-1 space-y-6 lg:space-y-8">
          <ColumnTitle
            kicker="Comment ça marche"
            title="Ton parcours"
            id="rs-home-how-parcours"
          />
          <FlowCycleGrid cards={parcoursCards} mobileOrder={[0, 1, 3, 2]} />

          <div className="flex flex-col gap-3 rounded-xl bg-[var(--rs-brand-pink,#F472B6)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-5 lg:px-6">
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
        </div>

        <div
          className="hidden shrink-0 self-stretch lg:block lg:w-px lg:bg-white/15"
          aria-hidden
        />

        {/* —— Le cycle RS (droite desktop) —— */}
        <div className="min-w-0 flex-1 space-y-6 lg:space-y-8">
          <div className="lg:hidden">
            <DividerLabel>Le recrutement</DividerLabel>
          </div>

          <ColumnTitle title="Le cycle RS" id="rs-home-how-cycle" />
          <FlowCycleGrid cards={cycleCards} mobileOrder={[0, 1, 2, 3]} />
        </div>
      </div>

      <div className={`${shell} mt-10 hidden lg:block`}>
        <DividerLabel>Le recrutement</DividerLabel>
      </div>

      <div className={`${shell} mt-8 lg:mt-10`}>
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
