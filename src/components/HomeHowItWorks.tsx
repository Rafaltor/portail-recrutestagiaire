type CardDef = {
  step: string;
  title: string;
  bullets?: string[];
};

const shell = "mx-auto w-full max-w-[var(--rs-content-max)]";

const prisBullets = [
  "vernissage",
  "guest list bons votants",
  "CV sur le packaging",
];

function ParcoursCard({
  step,
  title,
  bullets,
}: {
  step: string;
  title: string;
  bullets?: string[];
}) {
  return (
    <article className="min-w-0 rounded-[20px] border border-[#e8e8e4] bg-[#fafaf8] px-5 py-6 sm:px-7">
      <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase leading-normal tracking-[0.14em] text-[#f472b6]">
        {step}
      </p>
      <h3 className="mt-2 font-[family-name:var(--font-syne)] text-[18px] font-extrabold leading-snug tracking-tight text-[#0a0a0a]">
        {title}
      </h3>
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
    <article className="w-full rounded-[20px] bg-[#0a0a0a] px-7 py-6 text-white">
      <p className="font-[family-name:var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.14em] text-[#f472b6]">
        Sortie du cycle
      </p>
      <h3 className="mt-2 font-[family-name:var(--font-syne)] text-[18px] font-extrabold leading-snug tracking-tight text-white">
        T&apos;as été pris
      </h3>
      <ul className="mt-3 list-none space-y-1 p-0 font-[family-name:var(--font-dm)] text-[14px] font-normal leading-relaxed text-[#999990]">
        {prisBullets.map((b) => (
          <li key={b}>· {b}</li>
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
  const parcoursCards: [CardDef, CardDef, CardDef, CardDef] = [
    { step: "01", title: "Poste ton CV" },
    {
      step: "02",
      title: "Vote",
      bullets: ["ton CV est boosté", "−10% sur le shop"],
    },
    { step: "04", title: "Bosse et redépose" },
    { step: "03", title: "Classement" },
  ];

  const ordered: CardDef[] = [
    parcoursCards[0]!,
    parcoursCards[1]!,
    parcoursCards[3]!,
    parcoursCards[2]!,
  ];

  return (
    <section
      className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--gray-200)] bg-[var(--white)] px-4 py-4 sm:px-5 sm:py-6 md:py-7"
      aria-labelledby="rs-home-how-parcours"
    >
      <div className={`${shell} space-y-4 md:space-y-5`}>
        <ColumnTitle title="Ton parcours" id="rs-home-how-parcours" />

        <div className="mx-auto flex w-full max-w-[var(--rs-content-max)] flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {ordered.map((c) => (
              <ParcoursCard key={c.step} {...c} />
            ))}
          </div>
          <BlocPris />
        </div>
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
