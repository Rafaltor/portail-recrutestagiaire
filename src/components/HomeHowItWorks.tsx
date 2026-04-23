type CardDef = {
  step: string;
  title: string;
  /** Sous le titre, une ligne (ex. contraintes CV). */
  subtitle?: string;
  /** Lignes sous le titre (majuscules / détails). */
  sublines?: string[];
  bullets?: string[];
  /** Dernière étape sur toute la largeur. */
  fullWidth?: boolean;
};

const shell = "mx-auto w-full max-w-[var(--rs-content-max)]";

const prisLines = [
  "Nouvelle recrue stagiaire",
  "Soirée d'inauguration du stagiaire",
  "Ton CV sur nos packaging",
  "TEE limité avec ton CV",
];

function ArrowDownBetween({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center text-[#f472b6] ${className}`.trim()}
      aria-hidden
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 5v14M8 11l4 4 4-4"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function ArrowRightBetween({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center text-[#f472b6] ${className}`.trim()}
      aria-hidden
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 12h14M13 8l4 4-4 4"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function ArrowDownToPris({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 text-[#f472b6] ${className}`.trim()}
      aria-hidden
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="opacity-95">
        <path
          d="M12 4v16M8 14l4 4 4-4"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function ParcoursCard({
  step,
  title,
  subtitle,
  sublines,
  bullets,
  fullWidth,
}: CardDef) {
  return (
    <article
      className={`min-w-0 rounded-[20px] border border-[#e8e8e4] bg-[#fafaf8] px-5 py-6 sm:px-7 ${
        fullWidth ? "w-full lg:py-8" : ""
      }`}
    >
      <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase leading-normal tracking-[0.14em] text-[#f472b6]">
        {step}
      </p>
      <h3 className="mt-2 font-[family-name:var(--font-syne)] text-[18px] font-extrabold leading-snug tracking-tight text-[#0a0a0a]">
        {title}
      </h3>
      {subtitle ? (
        <p className="mt-2 font-[family-name:var(--font-dm)] text-[13px] font-normal leading-snug text-[#555550]">
          {subtitle}
        </p>
      ) : null}
      {sublines?.length ? (
        <div className="mt-3 space-y-1.5 font-[family-name:var(--font-dm)] text-[12px] font-semibold uppercase leading-snug tracking-wide text-[#555550]">
          {sublines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      {bullets?.length ? (
        <ul className="mt-3 space-y-1 font-[family-name:var(--font-dm)] text-[14px] font-normal leading-relaxed text-[#555550]">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function BlocPris() {
  return (
    <article className="w-full rounded-[20px] bg-[#0a0a0a] px-7 py-7 text-white sm:px-8 sm:py-8">
      <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.14em] text-[#f472b6]">
        Sortie du cycle
      </p>
      <h3 className="mt-3 font-[family-name:var(--font-syne)] text-[clamp(18px,2.5vw,22px)] font-extrabold leading-snug tracking-tight text-white">
        Le meilleur CV&nbsp;:
      </h3>
      <ul className="mt-4 list-none space-y-2.5 p-0 font-[family-name:var(--font-dm)] text-[14px] font-normal leading-relaxed text-[#c8c8c4]">
        {prisLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </article>
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

export function HomeHowItWorks() {
  const row1: [CardDef, CardDef, CardDef] = [
    {
      step: "01",
      title: "Poste ton CV",
      subtitle: "(Monopage + pas de photo)",
    },
    {
      step: "02",
      title: "Vote",
      sublines: ["Ton CV est boosté", "Réduction sur le shop"],
    },
    {
      step: "03",
      title: "Classement",
      sublines: ["Observe tes stats", "Regarde les meilleurs CV"],
    },
  ];

  const row2: CardDef = {
    step: "04",
    title: "Bosse et redépose",
    fullWidth: true,
  };

  return (
    <section
      className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--gray-200)] bg-[var(--white)] px-4 py-4 sm:px-5 sm:py-6 md:py-7"
      aria-labelledby="rs-home-how-parcours"
    >
      <div className={`${shell} space-y-4 md:space-y-5`}>
        <ColumnTitle title="Ton parcours" id="rs-home-how-parcours" />

        <div className="mx-auto flex w-full max-w-[var(--rs-content-max)] flex-col gap-4 sm:gap-5">
          {/* Mobile : cartes + flèches empilées */}
          <div className="flex flex-col gap-2 lg:hidden">
            {row1.map((c, i) => (
              <div key={c.step} className="flex flex-col gap-2">
                <ParcoursCard {...c} />
                {i < row1.length - 1 ? (
                  <ArrowDownBetween className="py-0.5" />
                ) : null}
              </div>
            ))}
            <ArrowDownBetween className="py-1" />
            <ParcoursCard {...row2} />
          </div>

          {/* Desktop : 3 cartes + flèches entre elles */}
          <div className="hidden gap-2 lg:flex lg:flex-row lg:items-stretch">
            <div className="min-w-0 flex-1">
              <ParcoursCard {...row1[0]!} />
            </div>
            <ArrowRightBetween className="w-9 shrink-0 self-center px-0.5" />
            <div className="min-w-0 flex-1">
              <ParcoursCard {...row1[1]!} />
            </div>
            <ArrowRightBetween className="w-9 shrink-0 self-center px-0.5" />
            <div className="min-w-0 flex-1">
              <ParcoursCard {...row1[2]!} />
            </div>
          </div>

          <div className="hidden lg:block">
            <ParcoursCard {...row2} />
          </div>

          <div className="flex flex-col items-center gap-1 pt-1">
            <ArrowDownToPris />
            <ArrowDownBetween className="opacity-80" />
          </div>

          <BlocPris />
        </div>
      </div>

      <div className={`${shell} mt-4 md:mt-5`}>
        <a
          href="/depot"
          className="rs-btn rs-btn--primary flex w-full items-center justify-center py-4 text-center text-base font-medium no-underline hover:no-underline sm:py-5 sm:text-lg"
        >
          Poste ton CV
        </a>
      </div>
    </section>
  );
}
