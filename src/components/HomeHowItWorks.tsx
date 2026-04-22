import type { ReactNode } from "react";

type CardDef = {
  step: string;
  title: string;
  bullets?: string[];
  highlight?: boolean;
};

const shell = "mx-auto w-full max-w-[var(--rs-content-max)]";

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
      className={`flex min-h-0 min-w-0 flex-col rounded-[var(--radius)] border border-[var(--gray-200)] bg-[var(--white)] px-3 py-3 transition-colors duration-200 hover:bg-[var(--gray-100)] md:min-h-0 md:px-3.5 md:py-3.5 lg:px-4 lg:py-4 ${
        highlight ? "ring-1 ring-[var(--accent)]" : ""
      }`}
    >
      <p className="font-[family-name:var(--font-syne)] text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--gray-400)] md:text-[12px]">
        {step}
      </p>
      <h3 className="mt-1.5 font-[family-name:var(--font-syne)] text-base font-bold leading-snug tracking-tight text-[var(--black)] lg:text-lg">
        {title}
      </h3>
      {bullets?.length ? (
        <ul className="mt-2.5 flex-1 space-y-1 text-sm font-normal leading-snug text-[var(--gray-600)]">
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
      className={`flex select-none items-center justify-center text-base font-bold leading-none text-[var(--accent)] md:text-lg lg:text-xl ${className}`.trim()}
      aria-hidden
    >
      {children}
    </span>
  );
}

function FlowCycleGrid({
  cards,
  mobileOrder,
}: {
  cards: [CardDef, CardDef, CardDef, CardDef];
  mobileOrder: [number, number, number, number];
}) {
  const [tl, tr, bl, br] = cards;
  const list = mobileOrder.map((i) => cards[i]!);

  return (
    <>
      <div className="space-y-1 md:hidden">
        {list.map((c, idx) => (
          <div key={`${c.step}-${c.title}-${idx}`}>
            <CycleCard {...c} />
            {idx < list.length - 1 ? (
              <div className="flex justify-center py-0.5">
                <Arrow>↓</Arrow>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mx-auto hidden w-full max-w-md md:grid md:grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)] md:grid-rows-3 md:gap-x-0 md:gap-y-0.5 lg:max-w-none">
        <CycleCard {...tl} />
        <Arrow className="self-center justify-center">→</Arrow>
        <CycleCard {...tr} />
        <div className="flex min-h-0 items-center justify-center py-0">
          <Arrow>↑</Arrow>
        </div>
        <div className="min-h-0" aria-hidden />
        <div className="flex min-h-0 items-center justify-center py-0">
          <Arrow>↓</Arrow>
        </div>
        <CycleCard {...bl} />
        <Arrow className="self-center justify-center">←</Arrow>
        <CycleCard {...br} />
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
        <p className="rs-ds-section-label mb-0 text-left">{kicker}</p>
      ) : null}
      <h2
        id={id}
        className={`rs-ds-h2 text-left ${hasKicker ? "mt-3" : ""}`}
      >
        {title}
      </h2>
    </div>
  );
}

function DividerLabel({ children }: { children: ReactNode }) {
  return (
    <div className={`relative ${shell} py-1`}>
      <div
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--gray-200)]"
        aria-hidden
      />
      <p className="relative mx-auto w-max bg-[var(--white)] px-3 text-center text-[12px] font-medium uppercase tracking-[2px] text-[var(--gray-600)]">
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
      className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--gray-200)] bg-[var(--white)] px-4 py-5 sm:px-8 sm:py-8 md:py-10"
      aria-labelledby="rs-home-how-parcours rs-home-how-cycle"
    >
      <p className="rs-ds-section-label mb-4 text-center md:hidden">
        Comment ça marche
      </p>

      <div className={`${shell} flex flex-col gap-5 md:hidden`}>
        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--black)]">Ton parcours</p>
          <FlowCycleGrid cards={parcoursCards} mobileOrder={[0, 1, 3, 2]} />
        </div>
        <div className="border-t border-[var(--gray-200)] pt-5">
          <p className="mb-2 text-sm font-semibold text-[var(--black)]">Le cycle RS</p>
          <FlowCycleGrid cards={cycleCards} mobileOrder={[0, 1, 2, 3]} />
        </div>
      </div>

      <div className={`${shell} mt-0 hidden md:flex md:flex-col md:gap-5 lg:mt-0 lg:flex-row lg:items-stretch lg:gap-8`}>
          <div className="min-w-0 flex-1 space-y-4 lg:space-y-5">
            <ColumnTitle
              kicker="Comment ça marche"
              title="Ton parcours"
              id="rs-home-how-parcours"
            />
            <FlowCycleGrid cards={parcoursCards} mobileOrder={[0, 1, 3, 2]} />

            <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--gray-200)] bg-[var(--gray-100)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-5 lg:px-6">
              <div className="min-w-0">
                <p className="text-[12px] font-medium uppercase tracking-[2px] text-[var(--gray-600)]">
                  Sortie du cycle
                </p>
                <p className="mt-0.5 font-[family-name:var(--font-syne)] text-xl font-bold tracking-tight text-[var(--black)] sm:text-2xl">
                  T&apos;as été pris →
                </p>
              </div>
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-full border border-[var(--gray-200)] bg-[var(--white)] text-lg text-[var(--accent)] sm:self-center sm:h-12 sm:w-12"
                aria-hidden
              >
                ↓
              </div>
            </div>
          </div>

          <div
            className="hidden shrink-0 self-stretch lg:block lg:w-px lg:bg-[var(--gray-200)]"
            aria-hidden
          />

          <div className="min-w-0 flex-1 space-y-3 lg:space-y-4">
            <div className="lg:hidden">
              <DividerLabel>Le recrutement</DividerLabel>
            </div>

            <ColumnTitle title="Le cycle RS" id="rs-home-how-cycle" />
            <FlowCycleGrid cards={cycleCards} mobileOrder={[0, 1, 2, 3]} />
          </div>
        </div>

      <div className={`${shell} mt-3 hidden lg:block`}>
        <DividerLabel>Le recrutement</DividerLabel>
      </div>

      <div className={`${shell} mt-4 md:mt-5 lg:mt-5`}>
        <a
          href="/depot"
          className="rs-btn rs-btn--primary flex w-full flex-col items-center gap-0.5 py-4 text-center no-underline hover:no-underline sm:py-5"
        >
          <span className="text-base font-medium sm:text-lg">Poste ton CV</span>
          <span className="text-xs font-normal normal-case text-white/90">
            gratuit · sans compte obligatoire
          </span>
        </a>
      </div>
    </section>
  );
}
