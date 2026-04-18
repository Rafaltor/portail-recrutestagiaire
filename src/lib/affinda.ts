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
  const profession = String(data.profession || "").trim();
  if (profession) return profession.slice(0, 120);

  const workExperience = Array.isArray(data.workExperience)
    ? data.workExperience
    : [];
  const firstWork = asRecord(workExperience[0]);
  if (firstWork) {
    const jobTitle = String(firstWork.jobTitle || "").trim();
    if (jobTitle) return jobTitle.slice(0, 120);
    const occupation = asRecord(firstWork.occupation);
    if (occupation) {
      const normalized = String(occupation.jobTitleNormalized || "").trim();
      if (normalized) return normalized.slice(0, 120);
    }
  }

  return "";
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
