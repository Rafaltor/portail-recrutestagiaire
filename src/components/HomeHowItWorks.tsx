import Link from "next/link";

type CardDef = {
  step: string;
  title: string;
  subtitle?: string;
  sublines?: string[];
  bullets?: string[];
  body?: string;
};

const shell = "mx-auto w-full max-w-[var(--rs-content-max)]";

const prisLines = [
  "Nouvelle recrue stagiaire",
  "Soirée d'inauguration du stagiaire",
  "Ton CV sur nos packagings",
  "T-shirt limité à ton effigie",
];

const cardClass =
  "flex h-full min-h-0 flex-col rounded-xl border border-[#E8E8E8] bg-white p-4 sm:p-5";

function ParcoursCard({
  step,
  title,
  subtitle,
  sublines,
  bullets,
  body,
}: CardDef) {
  return (
    <article className={`${cardClass} min-w-0 w-full`}>
      <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase leading-normal tracking-[0.1em] text-[#f472b6]">
        {step}
      </p>
      <h3 className="mt-2 font-[family-name:var(--font-syne)] text-[18px] font-extrabold leading-snug tracking-tight text-[#0A0A0A]">
        {title}
      </h3>
      {subtitle ? (
        <p className="mt-2 font-[family-name:var(--font-dm)] text-[14px] font-normal leading-snug text-[#6B6B6B]">
          {subtitle}
        </p>
      ) : null}
      {sublines?.length ? (
        <div className="mt-2 space-y-1 font-[family-name:var(--font-dm)] text-[14px] font-normal leading-snug text-[#6B6B6B]">
          {sublines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      {body ? (
        <p className="mt-2 font-[family-name:var(--font-dm)] text-[14px] font-normal leading-snug text-[#6B6B6B]">
          {body}
        </p>
      ) : null}
      {bullets?.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 font-[family-name:var(--font-dm)] text-[14px] font-normal leading-relaxed text-[#6B6B6B]">
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
    <article className="flex w-full flex-col gap-5 rounded-xl bg-[#0A0A0A] px-6 py-7 text-white sm:gap-6 sm:px-8 sm:py-8">
      <div className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0 pr-2">
          <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.14em] text-[#f472b6]">
            Sortie du cycle
          </p>
          <h3 className="mt-3 font-[family-name:var(--font-syne)] text-[clamp(18px,2.5vw,22px)] font-extrabold leading-snug tracking-tight text-white">
            Le meilleur CV
          </h3>
        </div>
        <Link
          href="/depot"
          className="rs-on-pink inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full bg-[#f472b6] px-5 py-2.5 text-center text-xs font-bold text-white no-underline transition-colors hover:bg-[#db2777] sm:min-h-[48px] sm:px-7 sm:py-3 sm:text-sm"
        >
          Déposer mon CV →
        </Link>
      </div>
      <div className="-mx-1 flex min-w-0 flex-col gap-2 px-1 pb-0.5 font-[family-name:var(--font-dm)] text-[11px] font-normal leading-snug text-[#E8E8E8] sm:flex-row sm:flex-nowrap sm:items-center sm:gap-x-3 sm:overflow-x-auto sm:text-[13px] md:gap-x-4 md:text-[15px]">
        {prisLines.map((line) => (
          <span
            key={line}
            className="flex w-full items-center gap-1.5 sm:inline-flex sm:w-auto sm:shrink-0 sm:whitespace-nowrap"
          >
            <span className="shrink-0 text-[#f472b6]" aria-hidden>
              ✦
            </span>
            {line}
          </span>
        ))}
      </div>
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
        className={`rs-ds-h2 max-w-full break-words text-left ${hasKicker ? "mt-3" : ""}`}
      >
        {title}
      </h2>
    </div>
  );
}

function Chevron() {
  return (
    <span
      className="hidden shrink-0 select-none items-center justify-center self-center px-1 font-[family-name:var(--font-syne)] text-2xl font-bold leading-none text-[#f472b6] lg:flex"
      aria-hidden
    >
      ›
    </span>
  );
}

export function HomeHowItWorks() {
  const steps: CardDef[] = [
    {
      step: "01",
      title: "Poste ton CV",
      sublines: ["Monopage", "Pas de photo"],
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
    {
      step: "04",
      title: "Bosse et redépose",
      subtitle: "Améliore ton CV",
    },
  ];

  return (
    <section
      className="overflow-hidden rounded-xl border border-[#E8E8E8] bg-white px-4 py-6 sm:px-6 sm:py-8"
      aria-labelledby="rs-home-how-parcours"
    >
      <div className={`${shell} space-y-6`}>
        <ColumnTitle title="Ton parcours" id="rs-home-how-parcours" />

        <div className="mx-auto w-full max-w-[var(--rs-content-max)]">
          {/* Mobile / tablette : 2 colonnes */}
          <div className="grid grid-cols-2 items-stretch gap-4 lg:hidden">
            {steps.map((c) => (
              <ParcoursCard key={c.step} {...c} />
            ))}
          </div>

          {/* Desktop : 1 ligne + chevrons */}
          <div className="hidden items-stretch gap-2 lg:flex">
            <div className="flex min-h-0 min-w-0 flex-1">
              <ParcoursCard {...steps[0]!} />
            </div>
            <Chevron />
            <div className="flex min-h-0 min-w-0 flex-1">
              <ParcoursCard {...steps[1]!} />
            </div>
            <Chevron />
            <div className="flex min-h-0 min-w-0 flex-1">
              <ParcoursCard {...steps[2]!} />
            </div>
            <Chevron />
            <div className="flex min-h-0 min-w-0 flex-1">
              <ParcoursCard {...steps[3]!} />
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-1 pt-2">
            <span className="text-xl font-bold text-[#f472b6] lg:hidden" aria-hidden>
              ↓
            </span>
            <span className="hidden text-2xl font-bold text-[#f472b6] lg:inline" aria-hidden>
              ↓
            </span>
          </div>

          <BlocPris />
        </div>
      </div>
    </section>
  );
}
