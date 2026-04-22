import type { ReactNode } from "react";

type CardDef = {
  step: string;
  title: string;
  bullets?: string[];
  highlight?: boolean;
};

const shell = "mx-auto w-full max-w-[var(--rs-content-max)]";

const prisBullets = [
  "• vernissage",
  "• guest list bons votants",
  "• CV sur le packaging",
];

/** Flèches de schéma en SVG (pas de glyphes ASCII). */
function FlowArrow({
  dir,
  className = "",
}: {
  dir: "right" | "down" | "up" | "left";
  className?: string;
}) {
  const base = "block shrink-0 text-[var(--accent)]";
  const paths: Record<typeof dir, ReactNode> = {
    right: <path d="M4 12h16M12 6l6 6-6 6" />,
    left: <path d="M20 12H4M12 6l-6 6 6 6" />,
    down: <path d="M12 4v16M8 10l4 4 4-4" />,
    up: <path d="M12 20V4M8 14l4-4 4 4" />,
  };
  return (
    <svg
      className={`${base} ${className}`.trim()}
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[dir]}
    </svg>
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
      className={`flex min-h-0 min-w-0 flex-col rounded-[var(--radius)] border border-[var(--gray-200)] bg-white px-3 py-3 transition-colors duration-200 hover:bg-[var(--gray-100)] md:min-h-0 md:px-3.5 md:py-3.5 lg:px-4 lg:py-4 ${
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
                <FlowArrow dir="down" />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mx-auto hidden w-full max-w-2xl md:grid md:grid-cols-[minmax(0,1fr)_1.75rem_minmax(0,1fr)] md:grid-rows-3 md:gap-x-0 md:gap-y-0 md:items-start md:[grid-template-rows:auto_max-content_auto]">
        <CycleCard {...tl} />
        <div className="flex items-center justify-center self-center">
          <FlowArrow dir="right" />
        </div>
        <CycleCard {...tr} />
        <div className="flex justify-center place-self-center leading-none">
          <FlowArrow dir="up" className="!h-auto !min-h-0" />
        </div>
        <div className="h-0 min-h-0 w-full place-self-center overflow-visible" aria-hidden />
        <div className="flex justify-center place-self-center leading-none">
          <FlowArrow dir="down" className="!h-auto !min-h-0" />
        </div>
        <CycleCard {...bl} />
        <div className="flex items-center justify-center self-center">
          <FlowArrow dir="left" />
        </div>
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

function PrisBlock() {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--gray-200)] bg-[var(--gray-100)] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-5 lg:px-6">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium uppercase tracking-[2px] text-[var(--gray-600)]">
          Sortie du cycle
        </p>
        <p className="mt-0.5 inline-flex flex-wrap items-center gap-2 font-[family-name:var(--font-syne)] text-xl font-bold tracking-tight text-[var(--black)] sm:text-2xl">
          <span>T&apos;as été pris</span>
          <FlowArrow dir="right" className="translate-y-px" />
        </p>
        <ul className="mt-3 space-y-1 text-sm font-normal leading-snug text-[var(--gray-600)]">
          {prisBullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-full border border-[var(--gray-200)] bg-[var(--white)] sm:self-start sm:h-12 sm:w-12"
        aria-hidden
      >
        <FlowArrow dir="down" className="text-[var(--accent)]" />
      </div>
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
    { step: "03", title: "Classement" },
  ];

  return (
    <section
      className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--gray-200)] bg-[var(--white)] px-4 py-4 sm:px-5 sm:py-6 md:py-7"
      aria-labelledby="rs-home-how-parcours"
    >
      <div className={`${shell} space-y-4 md:space-y-5`}>
        <ColumnTitle title="Ton parcours" id="rs-home-how-parcours" />
        <FlowCycleGrid cards={parcoursCards} mobileOrder={[0, 1, 3, 2]} />
        <PrisBlock />
      </div>

      <div className={`${shell} mt-4 md:mt-5`}>
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
