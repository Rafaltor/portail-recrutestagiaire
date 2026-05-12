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
      <p className="font-[family-name:var(--font-syne)] text-[10px] font-bold uppercase leading-normal tracking-[0.1em] text-[#f472b6] sm:text-[11px]">
        {step}
      </p>
      <h3 className="mt-2 font-[family-name:var(--font-syne)] text-[13px] font-extrabold leading-snug tracking-tight text-[#0A0A0A] sm:text-[16px]">
        {title}
      </h3>
      {subtitle ? (
        <p className="mt-2 font-[family-name:var(--font-dm)] text-[12px] font-normal leading-snug text-[#6B6B6B] sm:text-[13px]">
          {subtitle}
        </p>
      ) : null}
      {sublines?.length ? (
        <div className="mt-2 space-y-1 font-[family-name:var(--font-dm)] text-[12px] font-normal leading-snug text-[#6B6B6B] sm:text-[13px]">
          {sublines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      {body ? (
        <p className="mt-2 font-[family-name:var(--font-dm)] text-[12px] font-normal leading-snug text-[#6B6B6B] sm:text-[13px]">
          {body}
        </p>
      ) : null}
      {bullets?.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 font-[family-name:var(--font-dm)] text-[12px] font-normal leading-relaxed text-[#6B6B6B] sm:text-[13px]">
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
    <article className="flex h-full min-h-0 w-full flex-col gap-4 rounded-xl bg-[#0A0A0A] px-4 py-6 text-white sm:px-5 sm:py-5">
      <h3 className="font-[family-name:var(--font-syne)] text-[13px] font-extrabold leading-snug tracking-tight text-white sm:text-[16px]">
        T&apos;as été pris
      </h3>
      <div className="flex min-w-0 flex-col gap-2 font-[family-name:var(--font-dm)] text-[11px] font-normal leading-snug text-[#E8E8E8] sm:text-[12px]">
        {prisLines.map((line) => (
          <span key={line} className="inline-flex items-start gap-1.5">
            <span className="mt-1 shrink-0 text-[#f472b6]" aria-hidden>
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
        className={`max-w-full break-words text-left font-[family-name:var(--font-syne)] text-[clamp(1.05rem,4vw,1.35rem)] font-extrabold leading-tight tracking-tight text-[#0A0A0A] sm:text-[clamp(1.35rem,2.5vw,1.85rem)] ${hasKicker ? "mt-3" : ""}`}
      >
        {title}
      </h2>
    </div>
  );
}

export function HomeHowItWorks() {
  const steps: CardDef[] = [
    {
      step: "01",
      title: "Poste ton CV",
    },
    {
      step: "02",
      title: "Vote",
    },
  ];

  return (
    <section
      className="rs-home-how overflow-hidden rounded-xl border border-[#E8E8E8] bg-white px-2 py-5 sm:px-6 sm:py-8"
      aria-labelledby="rs-home-how-parcours"
    >
      <div className={`${shell} space-y-6`}>
        <ColumnTitle title="Ton parcours" id="rs-home-how-parcours" />

        <div className="mx-auto grid w-full max-w-[var(--rs-content-max)] grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
          <ParcoursCard {...steps[0]!} />
          <ParcoursCard {...steps[1]!} />
          <BlocPris />
        </div>
      </div>
    </section>
  );
}
