type UnknownRecord = Record<string, unknown>;

export type AffindaParsedPreview = {
  name: string;
  email: string;
  jobTitle: string;
  skills: string[];
  city: string;
  hasPhoto: boolean;
};

type AffindaParseResult = {
  preview: AffindaParsedPreview;
};

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function firstString(values: unknown): string {
  if (typeof values === "string") return values.trim();
  if (!Array.isArray(values)) return "";
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readAffindaBaseUrl() {
  return (
    process.env.AFFINDA_API_BASE_URL?.trim() ||
    process.env.AFFINDA_BASE_URL?.trim() ||
    "https://api.affinda.com"
  ).replace(/\/+$/, "");
}

function readAffindaApiKey() {
  return process.env.AFFINDA_API_KEY?.trim() || "";
}

export function isAffindaConfigured() {
  return !!readAffindaApiKey();
}

function normalizeSkills(rawSkills: unknown): string[] {
  if (!Array.isArray(rawSkills)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of rawSkills) {
    const fromString = typeof value === "string" ? value.trim() : "";
    const fromObject =
      !fromString && asRecord(value) && typeof asRecord(value)?.name === "string"
        ? String(asRecord(value)?.name || "").trim()
        : "";
    const skill = (fromString || fromObject).slice(0, 80);
    if (!skill) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
    if (out.length >= 12) break;
  }
  return out;
}

type JobTitleCategory = {
  title: string;
  keywords: string[];
};

const JOB_TITLE_CATEGORIES: JobTitleCategory[] = [
  {
    title: "Directeur artistique / Graphiste",
    keywords: [
      "illustrator",
      "photoshop",
      "indesign",
      "figma",
      "sketch",
      "xd",
      "canva",
      "typographie",
      "mise en page",
      "identite visuelle",
    ],
  },
  {
    title: "Styliste / Créateur mode",
    keywords: [
      "couture",
      "patronage",
      "textile",
      "tricot",
      "broderie",
      "modelisme",
      "stylisme",
      "collection",
      "croquis mode",
      "draping",
    ],
  },
  {
    title: "Photographe / Vidéaste",
    keywords: [
      "photographie",
      "lightroom",
      "capture one",
      "studio",
      "shooting",
      "premiere pro",
      "after effects",
      "montage",
      "motion design",
      "davinci",
    ],
  },
  {
    title: "Chargé de communication / Marketing",
    keywords: [
      "community management",
      "reseaux sociaux",
      "instagram",
      "tiktok",
      "copywriting",
      "redaction",
      "brand",
      "marketing",
      "influence",
      "presse",
    ],
  },
  {
    title: "Chef de projet / Producteur",
    keywords: [
      "production",
      "logistique",
      "evenementiel",
      "coordination",
      "planning",
      "chef de projet",
      "organisation",
    ],
  },
  {
    title: "Acheteur / Retail manager",
    keywords: [
      "vente",
      "retail",
      "merchandising",
      "buying",
      "achat",
      "showroom",
    ],
  },
  {
    title: "Architecte / Scénographe",
    keywords: [
      "architecture",
      "architecture interieure",
      "scenographie",
      "espace",
      "volume",
      "autocad",
      "rhino",
      "sketchup",
    ],
  },
  {
    title: "Artisan / Créateur",
    keywords: [
      "bijouterie",
      "joaillerie",
      "maroquinerie",
      "cuir",
      "ceramique",
      "serigraphie",
      "impression",
      "fabrication",
    ],
  },
  {
    title: "Illustrateur / Artiste",
    keywords: [
      "illustration",
      "peinture",
      "dessin",
      "sculpture",
      "art",
      "galerie",
      "concept art",
      "storyboard",
    ],
  },
  {
    title: "Musicien / Producteur musical",
    keywords: [
      "musique",
      "son",
      "audio",
      "production musicale",
      "dj",
      "beatmaking",
      "ableton",
      "pro tools",
    ],
  },
  {
    title: "Ingénieur / Développeur",
    keywords: [
      "ingenieur",
      "engineering",
      "developpement",
      "code",
      "programmation",
      "python",
      "javascript",
      "typescript",
      "react",
      "node",
      "sql",
      "data",
      "algorithme",
      "mecanique",
      "electronique",
      "systemes",
      "reseau",
      "cybersecurite",
    ],
  },
];

function normalizeSearchText(input: string): string {
  const compact = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return compact ? ` ${compact} ` : "";
}

function collectJobTitleSignals(data: UnknownRecord): string[] {
  const out: string[] = [];
  const pushString = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    out.push(trimmed);
  };

  pushString(data.profession);
  pushString(data.headline);
  pushString(data.jobTitle);
  pushString(data.title);
  pushString(data.summary);
  pushString(data.objective);

  const workExperience = Array.isArray(data.workExperience)
    ? data.workExperience
    : [];
  for (const entry of workExperience) {
    const job = asRecord(entry);
    if (!job) continue;
    pushString(job.jobTitle);
    pushString(job.position);
    pushString(job.organization);
    const occupation = asRecord(job.occupation);
    if (occupation) {
      pushString(occupation.jobTitle);
      pushString(occupation.jobTitleNormalized);
    }
  }

  const skillValues = Array.isArray(data.skill)
    ? data.skill
    : Array.isArray(data.skills)
      ? data.skills
      : [];
  for (const skill of skillValues) {
    if (typeof skill === "string") {
      pushString(skill);
      continue;
    }
    const skillObj = asRecord(skill);
    if (!skillObj) continue;
    pushString(skillObj.name);
    pushString(skillObj.type);
  }

  return out;
}

function inferMappedJobTitle(data: UnknownRecord): string {
  const haystack = normalizeSearchText(collectJobTitleSignals(data).join(" "));
  if (!haystack) return "";

  let bestTitle = "";
  let bestScore = 0;
  for (const category of JOB_TITLE_CATEGORIES) {
    let score = 0;
    for (const rawKeyword of category.keywords) {
      const normalizedKeyword = normalizeSearchText(rawKeyword).trim();
      if (!normalizedKeyword) continue;
      if (haystack.includes(` ${normalizedKeyword} `)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestTitle = category.title;
    }
  }

  return bestScore > 0 ? bestTitle : "";
}

function extractName(data: UnknownRecord): string {
  const candidateName = asRecord(data.candidateName);
  if (candidateName) {
    const first = String(candidateName.candidateNameFirst || "").trim();
    const middle = String(candidateName.candidateNameMiddle || "").trim();
    const family = String(candidateName.candidateNameFamily || "").trim();
    const full = [first, middle, family].filter(Boolean).join(" ").trim();
    if (full) return full.slice(0, 120);
  }

  const legacyName = asRecord(data.name);
  if (legacyName) {
    const raw = String(legacyName.raw || "").trim();
    if (raw) return raw.slice(0, 120);
    const first = String(legacyName.first || "").trim();
    const middle = String(legacyName.middle || "").trim();
    const last = String(legacyName.last || "").trim();
    const full = [first, middle, last].filter(Boolean).join(" ").trim();
    if (full) return full.slice(0, 120);
  }

  return "";
}

function extractJobTitle(data: UnknownRecord): string {
  return inferMappedJobTitle(data).slice(0, 120);
}

function extractEmail(data: UnknownRecord): string {
  const compactEmail = firstString(data.email);
  if (compactEmail) return compactEmail.slice(0, 140);
  const legacyEmail = firstString(data.emails);
  if (legacyEmail) return legacyEmail.slice(0, 140);
  return "";
}

function extractCity(data: UnknownRecord): string {
  const location = asRecord(data.location);
  const compactLocation = firstString(location?.text ?? data.location?.toString?.());
  if (compactLocation) return compactLocation.slice(0, 120);

  const rawLocation = firstString(data.locations);
  if (rawLocation) return rawLocation.slice(0, 120);

  const rawAddress = asRecord(data.address);
  const city = String(rawAddress?.city || "").trim();
  if (city) return city.slice(0, 120);

  const education = Array.isArray(data.education) ? data.education : [];
  for (const entry of education) {
    const edu = asRecord(entry);
    const cityName = String(edu?.location || "").trim();
    if (cityName) return cityName.slice(0, 120);
  }
  return "";
}

function extractHasPhoto(data: UnknownRecord): boolean {
  const compact = data.headshot;
  if (typeof compact === "string" && compact.trim()) return true;
  const legacy = data.headShot;
  if (typeof legacy === "string" && legacy.trim()) return true;
  return false;
}

function pickResumeData(payload: UnknownRecord): UnknownRecord {
  const payloadData = asRecord(payload.data);
  if (!payloadData) return payload;
  const nested = asRecord(payloadData.data);
  return nested ?? payloadData;
}

export async function parseCvWithAffinda(file: File): Promise<AffindaParseResult> {
  const apiKey = readAffindaApiKey();
  if (!apiKey) {
    throw new Error("affinda_not_configured");
  }

  const body = new FormData();
  body.set("file", file, file.name || "cv.pdf");
  body.set("wait", "true");
  body.set("compact", "true");

  const response = await fetch(`${readAffindaBaseUrl()}/v2/resumes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`affinda_failed_${response.status}`);
  }

  const payload = (await response.json().catch(() => null)) as UnknownRecord | null;
  if (!payload) {
    throw new Error("affinda_invalid_payload");
  }

  const parsed = pickResumeData(payload);
  const preview: AffindaParsedPreview = {
    name: extractName(parsed),
    email: extractEmail(parsed),
    jobTitle: extractJobTitle(parsed),
    skills: normalizeSkills(parsed.skill ?? parsed.skills),
    city: extractCity(parsed),
    hasPhoto: extractHasPhoto(parsed),
  };

  return { preview };
}
