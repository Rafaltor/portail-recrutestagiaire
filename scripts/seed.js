#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const TOTAL_TARGET = 20;
const DEFAULT_PREFIX = "seed_fake_ig_";

const FIRST_NAMES = [
  "Camille",
  "Lucas",
  "Léa",
  "Nathan",
  "Chloé",
  "Hugo",
  "Manon",
  "Théo",
  "Sarah",
  "Antoine",
  "Julie",
  "Maxime",
  "Émilie",
  "Thomas",
  "Clara",
  "Paul",
  "Inès",
  "Romain",
  "Zoé",
  "Alexandre",
];

const LAST_NAMES = [
  "Bernard",
  "Petit",
  "Robert",
  "Richard",
  "Durand",
  "Leroy",
  "Moreau",
  "Simon",
  "Laurent",
  "Lefebvre",
  "Michel",
  "Garcia",
  "David",
  "Bertrand",
  "Roux",
  "Vincent",
  "Fournier",
  "Girard",
  "Bonnet",
  "Dupont",
];

const SCHOOLS = [
  "Université Paris-Saclay — Licence Informatique",
  "École 42 — Piscine & cursus",
  "IUT de Villeurbanne — BUT GEA",
  "Sciences Po Lyon — Master Marketing",
  "INSA Lyon — Cycle ingénieur",
  "Université Lille — MIASHS",
  "BTS SIO — Lycée polyvalent",
  "ENSAE Paris — Data Science",
];

const COMPANIES = [
  "TechFlow SAS",
  "Agence Pixel Nord",
  "RetailOne",
  "BioStart Lab",
  "Mobility Co",
  "FinanceHub",
  "GreenEnergy SA",
  "MediaWave",
];

const SKILLS_POOLS = [
  "JavaScript, TypeScript, React, Node.js, Git, Figma",
  "Python, Pandas, SQL, Power BI, Excel avancé",
  "HTML/CSS, WordPress, SEO, réseaux sociaux, Canva",
  "Java, Spring Boot, PostgreSQL, Docker, CI/CD",
  "Illustrator, Photoshop, identité visuelle, print",
  "Salesforce, prospection B2B, CRM, négociation",
  "Excel, contrôle de gestion, reporting, SAP débutant",
  "Kotlin, Android, Firebase, tests unitaires",
];

function readEnv(name) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : "";
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    dryRun: args.has("--dry-run"),
    refreshCvs: args.has("--refresh-cvs"),
  };
}

function makeToken() {
  return crypto.randomBytes(16).toString("hex");
}

function makeHandle(index) {
  return `${DEFAULT_PREFIX}${String(index).padStart(2, "0")}`;
}

function wrapLine(text, maxLen) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxLen) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w.length > maxLen ? w.slice(0, maxLen) : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function wrapParagraph(text, maxLen) {
  const parts = String(text).split(/\n/);
  const out = [];
  for (const p of parts) {
    for (const line of wrapLine(p, maxLen)) out.push(line);
  }
  return out;
}

function cvLinesForIndex(index) {
  const i = index - 1;
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const last = LAST_NAMES[(i + 3) % LAST_NAMES.length];
  const fullName = `${first} ${last}`;
  const handle = makeHandle(index);
  const email = `${handle}@demo-cv.recrute-stagiaire.invalid`;
  const phone = `06 ${String(12 + (i % 80)).padStart(2, "0")} ${String(34 + i).padStart(2, "0")} ${String(56 + (i % 9)).padStart(2, "0")} ${String(78 + (i % 11)).padStart(2, "0")}`;
  const city = index % 3 === 0 ? "Paris" : index % 3 === 1 ? "Lyon" : "Bordeaux";
  const jobTitle =
    index % 5 === 0
      ? "Développeur web full-stack (alternance)"
      : index % 5 === 1
        ? "Chargé(e) de communication digitale"
        : index % 5 === 2
          ? "Assistant(e) gestion & pilotage"
          : index % 5 === 3
            ? "Data analyst junior"
            : "Graphiste / motion design";

  const school = SCHOOLS[i % SCHOOLS.length];
  const companyA = COMPANIES[i % COMPANIES.length];
  const companyB = COMPANIES[(i + 2) % COMPANIES.length];
  const skills = SKILLS_POOLS[i % SKILLS_POOLS.length];

  const summary = `Étudiant(e) motivé(e), ${first} recherche une alternance de 12 à 24 mois à partir de septembre. Autonome, curieux(se) et à l'aise en travail d'équipe, avec une première expérience en milieu associatif et des projets personnels concrets (portfolio en ligne).`;

  const lines = [
    "CURRICULUM VITAE",
    "",
    fullName.toUpperCase(),
    `${jobTitle}`,
    `${city} · ${email} · ${phone}`,
    "",
    "- PROFIL -",
    ...wrapParagraph(summary, 82),
    "",
    "- EXPÉRIENCE -",
    `Stage — ${companyA} (${3 + (i % 4)} mois)`,
    "Participation aux revues hebdo, préparation de tableaux de suivi, veille concurrentielle.",
    "",
    `Job étudiant — ${companyB}`,
    "Accueil client, gestion des stocks, encaissement, tenue d'une base simple sur tableur.",
    "",
    "- FORMATION -",
    school,
    `Projets : site vitrine responsive, maquette Figma, présentation orale (note ${14 + (i % 4)}/20).`,
    "",
    "- COMPÉTENCES -",
    skills,
    "",
    "- LANGUES -",
    "Français : langue maternelle · Anglais : B2 (écrit/oral) · Espagnol : A2",
    "",
    "- CENTRES D'INTÉRÊT -",
    "Bénévolat associatif, veille tech, cinéma indépendant, course à pied.",
    "",
    `Réf. profil démo : @${handle} (données fictives générées pour tests UI).`,
  ];
  return { lines, fullName, jobTitle, city, handle };
}

async function buildRichCvPdfBuffer(index) {
  const { lines, fullName, jobTitle, city, handle } = cvLinesForIndex(index);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  const lineHeight = (size) => size * 1.25;

  function ensureSpace(needed) {
    if (y - needed < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  for (const raw of lines) {
    const isTitle = raw === "CURRICULUM VITAE";
    const isSection = raw.startsWith("- ") && raw.endsWith(" -");
    const isNameLine = raw === fullName.toUpperCase();
    const size = isTitle ? 16 : isNameLine ? 13 : isSection ? 11 : 9.5;
    const useBold = isTitle || isNameLine || isSection;
    const f = useBold ? fontBold : font;
    const color = isSection ? rgb(0.12, 0.35, 0.55) : rgb(0.15, 0.15, 0.18);

    const text = raw === "" ? " " : raw;
    const wrapped =
      text === " " ? [" "] : f.widthOfTextAtSize(text, size) <= maxWidth ? [text] : wrapLine(text, 92);

    for (const seg of wrapped) {
      const h = lineHeight(size);
      ensureSpace(h + 2);
      page.drawText(seg === " " ? "" : seg, {
        x: margin,
        y: y - h,
        size,
        font: f,
        color,
        maxWidth,
      });
      y -= h + (raw === "" ? 4 : 2);
    }
  }

  const pagesOut = doc.getPages();
  pagesOut[pagesOut.length - 1].drawText(
    `Page générée automatiquement — ${handle} — ${jobTitle} — ${city}`,
    {
      x: margin,
      y: 28,
      size: 7,
      font,
      color: rgb(0.45, 0.45, 0.48),
    },
  );

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function makeFakeProfile(index, token) {
  const { jobTitle, city, handle } = cvLinesForIndex(index);
  const safeHandle = handle;
  return {
    handle: `@${safeHandle}`,
    job_title: jobTitle,
    city,
    tags: ["demo-cv", "seed", "test-ui"],
    portfolio_url: `https://example.com/portfolio/${safeHandle}`,
    cv_path: `seed/${safeHandle}/${token}-cv-demo.pdf`,
    status: "published",
  };
}

async function main() {
  const { dryRun, refreshCvs } = parseArgs(process.argv);
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseKey = serviceRoleKey || anonKey;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "Missing env vars. Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    process.exit(1);
  }

  if (!serviceRoleKey) {
    console.warn(
      "Warning: SUPABASE_SERVICE_ROLE_KEY is missing — storage upload may fail with anon key. Prefer service role for seed.",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const prefixPattern = `@${DEFAULT_PREFIX}%`;

  if (refreshCvs) {
    const listRes = await supabase
      .from("profiles")
      .select("id,handle,cv_path")
      .ilike("handle", prefixPattern)
      .limit(200);
    if (listRes.error) {
      console.error(`refresh list failed: ${listRes.error.message}`);
      process.exit(1);
    }
    const rows = listRes.data || [];
    const sorted = rows.slice().sort((a, b) => String(a.handle).localeCompare(String(b.handle)));
    if (dryRun) {
      console.log(JSON.stringify({ mode: "refresh-cvs-dry-run", count: sorted.length }, null, 2));
      return;
    }
    let ok = 0;
    for (const row of sorted) {
      const handle = String(row.handle || "").replace(/^@/, "");
      const m = handle.match(/^seed_fake_ig_(\d+)$/);
      const idx = m ? Number(m[1]) : 1;
      const buf = await buildRichCvPdfBuffer(idx);
      const path = String(row.cv_path || "").trim().replace(/^\/+/, "");
      if (!path) {
        console.warn(`skip ${row.handle}: empty cv_path`);
        continue;
      }
      const up = await supabase.storage.from("cvs").upload(path, buf, {
        upsert: true,
        contentType: "application/pdf",
      });
      if (up.error) {
        console.error(`upload failed ${row.handle}: ${up.error.message}`);
        process.exit(1);
      }
      ok += 1;
    }
    console.log(`refresh-cvs: replaced ${ok} PDF(s) for handles matching ${prefixPattern}`);
    return;
  }

  const existingRes = await supabase
    .from("profiles")
    .select("id,handle,status")
    .ilike("handle", prefixPattern)
    .limit(200);

  if (existingRes.error) {
    console.error(`Failed to read existing seed profiles: ${existingRes.error.message}`);
    process.exit(1);
  }

  const existing = existingRes.data || [];
  const existingHandles = new Set(
    existing.map((row) => String(row.handle || "").toLowerCase()).filter(Boolean),
  );

  const toInsert = [];
  for (let i = 1; i <= TOTAL_TARGET; i += 1) {
    const fake = makeFakeProfile(i, makeToken());
    if (existingHandles.has(fake.handle.toLowerCase())) continue;
    toInsert.push(fake);
  }

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "apply",
        targetTotal: TOTAL_TARGET,
        existingSeedProfiles: existing.length,
        toInsert: toInsert.length,
      },
      null,
      2,
    ),
  );

  if (toInsert.length === 0) {
    console.log("Nothing to insert. Seed target already satisfied.");
    console.log("Tip: run `npm run seed -- --refresh-cvs` to replace PDFs with filled demo CVs.");
    return;
  }

  if (dryRun) {
    console.log("Dry run complete. No changes written.");
    return;
  }

  for (const row of toInsert) {
    const m = row.handle.replace(/^@/, "").match(new RegExp(`${DEFAULT_PREFIX}(\\d+)$`));
    const idx = m ? Number(m[1]) : 1;
    const richPdf = await buildRichCvPdfBuffer(idx);
    const uploadRes = await supabase.storage.from("cvs").upload(row.cv_path, richPdf, {
      upsert: false,
      contentType: "application/pdf",
    });
    if (uploadRes.error) {
      console.error(`Failed to upload CV PDF for ${row.handle}: ${uploadRes.error.message}`);
      process.exit(1);
    }
  }

  const insertRes = await supabase.from("profiles").insert(toInsert);
  if (insertRes.error) {
    console.error(`Failed to insert seed profiles: ${insertRes.error.message}`);
    process.exit(1);
  }

  console.log(`Inserted ${toInsert.length} fake published profiles with filled demo CVs.`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Seed failed: ${msg}`);
  process.exit(1);
});
