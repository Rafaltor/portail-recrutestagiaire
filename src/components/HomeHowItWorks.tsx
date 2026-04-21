import type { ReactNode } from "react";

type CardDef = {
  step: string;
  title: string;
  bullets?: string[];
  highlight?: boolean;
};

const shell = "mx-auto w-full max-w-6xl";

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
      className={`flex min-h-0 min-w-0 flex-col rounded-[8px] border border-[#F0F0F0] bg-[#FAFAFA] px-4 py-4 md:min-h-[132px] md:px-4 md:py-4 lg:min-h-[140px] lg:px-5 lg:py-5 ${
        highlight ? "ring-1 ring-[#F472B6]" : ""
      }`}
    >
      <p className="text-[12px] font-medium uppercase tracking-[2px] text-[#6B6B6B] md:text-[12px]">
        {step}
      </p>
      <h3 className="mt-1.5 text-base font-bold leading-snug text-[#0A0A0A] lg:text-lg">
        {title}
      </h3>
      {bullets?.length ? (
        <ul className="mt-2.5 flex-1 space-y-1 text-sm font-normal leading-snug text-[#6B6B6B]">
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
      className={`flex select-none items-center justify-center text-base font-bold leading-none text-[#F472B6] md:text-lg lg:text-xl ${className}`.trim()}
      aria-hidden
    >
      {children}
    </span>
  );
}

/** Grille 2×2 compacte (mobile, cycles côte à côte). */
function MiniCycleGrid({
  cards,
  order,
}: {
  cards: [CardDef, CardDef, CardDef, CardDef];
  order: [number, number, number, number];
}) {
  const ordered = order.map((i) => cards[i]!);
  return (
    <div className="mt-1 grid grid-cols-2 gap-1">
      {ordered.map((c) => (
        <div
          key={`${c.step}-${c.title}`}
          className={`rounded-[6px] border border-[#F0F0F0] bg-[#FAFAFA] p-1.5 ${
            c.highlight ? "ring-1 ring-[#F472B6]" : ""
          }`}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#6B6B6B]">
            {c.step}
          </p>
          <p className="mt-0.5 line-clamp-3 text-[11px] font-semibold leading-tight text-[#0A0A0A]">
            {c.title}
          </p>
        </div>
      ))}
    </div>
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
              <div className="flex justify-center py-1">
                <Arrow>↓</Arrow>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mx-auto hidden w-full max-w-md md:grid md:grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] md:grid-rows-3 md:gap-x-0 md:gap-y-2 lg:max-w-none">
        <CycleCard {...tl} />
        <Arrow className="self-center justify-center">→</Arrow>
        <CycleCard {...tr} />
        <div className="flex items-start justify-center pt-1">
          <Arrow>↑</Arrow>
        </div>
        <div className="min-h-[0.5rem]" aria-hidden />
        <div className="flex items-start justify-center pt-1">
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
        <p className="text-[12px] font-medium uppercase tracking-[2px] text-[#6B6B6B] md:text-[12px]">
          {kicker}
        </p>
      ) : null}
      <h2
        id={id}
        className={`text-2xl font-bold tracking-tight text-[#0A0A0A] lg:text-3xl ${hasKicker ? "mt-2" : ""}`}
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
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#F0F0F0]"
        aria-hidden
      />
      <p className="relative mx-auto w-max bg-white px-3 text-center text-[12px] font-medium uppercase tracking-[2px] text-[#6B6B6B]">
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
      className="overflow-hidden rounded-[8px] border border-[#F0F0F0] bg-white px-4 py-6 sm:px-8 sm:py-12"
      aria-labelledby="rs-home-how-parcours rs-home-how-cycle"
    >
      <p className="mb-2 text-center text-[13px] font-medium uppercase tracking-[0.12em] text-[#6B6B6B] md:hidden">
        Comment ça marche
      </p>

      <div className="mx-auto max-h-[340px] min-h-0 overflow-y-auto md:max-h-none md:overflow-visible">
        <div className={`${shell} grid grid-cols-2 gap-2 md:hidden`}>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#0A0A0A]">Ton parcours</p>
            <MiniCycleGrid cards={parcoursCards} order={[0, 1, 3, 2]} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#0A0A0A]">Le cycle RS</p>
            <MiniCycleGrid cards={cycleCards} order={[0, 1, 2, 3]} />
          </div>
        </div>

        <div className={`${shell} hidden md:flex md:flex-col md:gap-10 lg:flex-row lg:items-start`}>
          <div className="min-w-0 flex-1 space-y-6 lg:space-y-8">
            <ColumnTitle
              kicker="Comment ça marche"
              title="Ton parcours"
              id="rs-home-how-parcours"
            />
            <FlowCycleGrid cards={parcoursCards} mobileOrder={[0, 1, 3, 2]} />

            <div className="flex flex-col gap-3 rounded-[8px] border border-[#F0F0F0] bg-[#FAFAFA] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-5 lg:px-6">
              <div className="min-w-0">
                <p className="text-[12px] font-medium uppercase tracking-[2px] text-[#6B6B6B]">
                  Sortie du cycle
                </p>
                <p className="mt-0.5 text-xl font-bold tracking-tight text-[#0A0A0A] sm:text-2xl">
                  T&apos;as été pris →
                </p>
              </div>
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-full border border-[#F0F0F0] bg-white text-lg text-[#F472B6] sm:self-center sm:h-12 sm:w-12"
                aria-hidden
              >
                ↓
              </div>
            </div>
          </div>

          <div
            className="hidden shrink-0 self-stretch lg:block lg:w-px lg:bg-[#F0F0F0]"
            aria-hidden
          />

          <div className="min-w-0 flex-1 space-y-6 lg:space-y-8">
            <div className="lg:hidden">
              <DividerLabel>Le recrutement</DividerLabel>
            </div>

            <ColumnTitle title="Le cycle RS" id="rs-home-how-cycle" />
            <FlowCycleGrid cards={cycleCards} mobileOrder={[0, 1, 2, 3]} />
          </div>
        </div>
      </div>

      <div className={`${shell} mt-6 hidden lg:block`}>
        <DividerLabel>Le recrutement</DividerLabel>
      </div>

      <div className={`${shell} mt-6 md:mt-8 lg:mt-10`}>
        <a
          href="/depot"
          className="rs-btn rs-btn--primary flex w-full flex-col items-center gap-0.5 rounded-[6px] py-4 text-center no-underline hover:no-underline sm:py-5"
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
