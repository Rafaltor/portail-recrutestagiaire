/**
 * Mappe la réponse Affinda (resume JSON) vers des champs de formulaire.
 * Aligné sur la logique du proxy PHP (rs_map_affinda_to_form).
 */

export type ParsedCvForm = {
  name: string;
  email: string;
  role: string;
  portfolio: string;
  note: string;
  source: "affinda";
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

/** Retire espaces / guillemets souvent collés par copier-coller depuis le dashboard. */
export function normalizeAffindaApiKey(raw: string): string {
  let k = raw.trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  return k;
}

function extractAffindaErrorDetail(body: unknown): string {
  const r = asRecord(body);
  if (!r) return "";
  const err = asRecord(r.error);
  if (err && typeof err.message === "string" && err.message.trim() !== "") {
    return err.message.trim();
  }
  if (typeof r.message === "string" && r.message.trim() !== "") {
    return r.message.trim();
  }
  if (typeof r.detail === "string" && r.detail.trim() !== "") {
    return r.detail.trim();
  }
  return "";
}

function affindaAuthHint(): string {
  return (
    "Vérifie AFFINDA_API_KEY (Settings du compte Affinda) et AFFINDA_API_BASE selon l’URL où tu te connectes : " +
    "EU → https://api.eu1.affinda.com | US → https://api.us1.affinda.com | global/AUS → https://api.affinda.com"
  );
}

export function mapAffindaResumeToForm(resume: unknown): ParsedCvForm {
  const root = asRecord(resume) ?? {};
  const d = asRecord(root.data) ?? root;

  let name = "";
  const nameObj = asRecord(d.name);
  if (nameObj) {
    const raw = nameObj.raw;
    if (typeof raw === "string" && raw.trim() !== "") {
      name = raw.trim();
    } else {
      const parts = [
        String(nameObj.title ?? "").trim(),
        String(nameObj.first ?? "").trim(),
        String(nameObj.last ?? "").trim(),
      ].filter(Boolean);
      name = parts.length ? parts.join(" ") : "";
    }
  }

  let email = "";
  const emails = d.emails;
  if (Array.isArray(emails) && emails.length > 0) {
    const fr = emails[0];
    if (typeof fr === "string" && fr !== "") {
      email = fr;
    } else if (Array.isArray(fr) && typeof fr[0] === "string") {
      email = fr[0];
    } else {
      const frObj = asRecord(fr);
      if (frObj && typeof frObj.address === "string") {
        email = frObj.address;
      }
    }
  }

  let role = "";
  if (typeof d.profession === "string" && d.profession.trim() !== "") {
    role = d.profession.trim();
  } else if (typeof d.headline === "string") {
    role = d.headline.trim();
  }
  if (!role) {
    const wx = d.workExperience;
    if (Array.isArray(wx) && wx.length > 0) {
      const wx0 = asRecord(wx[0]);
      if (wx0) {
        if (typeof wx0.jobTitle === "string" && wx0.jobTitle.trim() !== "") {
          role = wx0.jobTitle.trim();
        } else {
          const occ = asRecord(wx0.occupation);
          if (occ && typeof occ.jobTitle === "string") {
            role = occ.jobTitle.trim();
          }
        }
      }
    }
  }

  let portfolio = "";
  if (typeof d.linkedin === "string" && d.linkedin.trim() !== "") {
    portfolio = d.linkedin.trim();
  } else if (Array.isArray(d.websites) && d.websites.length > 0) {
    const w0 = String(d.websites[0] ?? "").trim();
    if (w0) {
      portfolio = /^https?:\/\//i.test(w0) ? w0 : `https://${w0.replace(/^\//, "")}`;
    }
  }

  return {
    name,
    email,
    role,
    portfolio,
    source: "affinda",
    note: "Vérifiez et complétez les champs. Les textes proviennent d’une analyse automatique du document.",
  };
}

export function getAffindaApiBase(): string {
  const b = process.env.AFFINDA_API_BASE?.trim();
  if (b && b.length > 0) {
    return b.replace(/\/+$/, "");
  }
  /* Défaut EU ; si ton compte est app.affinda.com ou app.us1.affinda.com, surcharge AFFINDA_API_BASE */
  return "https://api.eu1.affinda.com";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function affindaGetResume(
  base: string,
  apiKey: string,
  identifier: string,
): Promise<unknown> {
  const res = await fetch(`${base}/v2/resumes/${encodeURIComponent(identifier)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let j: unknown = null;
    try {
      j = text ? JSON.parse(text) : null;
    } catch {
      j = null;
    }
    const detail = extractAffindaErrorDetail(j);
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Affinda a refusé la clé (${res.status}). ${affindaAuthHint()}${detail ? ` — ${detail}` : ""}`,
      );
    }
    throw new Error(detail || `affinda_get_${res.status}`);
  }
  return text ? JSON.parse(text) : null;
}

/**
 * Envoie le fichier à Affinda (wait=true) et retourne les champs mappés.
 */
export async function parseCvWithAffinda(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<ParsedCvForm> {
  const apiKey = normalizeAffindaApiKey(process.env.AFFINDA_API_KEY ?? "");
  if (!apiKey) {
    throw new Error("affinda_not_configured");
  }
  const base = getAffindaApiBase();

  const bodyBuf = Buffer.from(bytes);
  const postForm = new FormData();
  postForm.set(
    "file",
    new Blob([bodyBuf], { type: mimeType || "application/octet-stream" }),
    fileName,
  );
  postForm.set("wait", "true");

  const postRes = await fetch(`${base}/v2/resumes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: postForm,
    cache: "no-store",
  });
  const rawBody = await postRes.text();
  let j: unknown = null;
  try {
    j = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    j = null;
  }
  if (!postRes.ok) {
    const detail = extractAffindaErrorDetail(j);
    if (postRes.status === 401 || postRes.status === 403) {
      throw new Error(
        `Affinda a refusé la clé (${postRes.status}). ${affindaAuthHint()}${detail ? ` — ${detail}` : ""}`,
      );
    }
    throw new Error(detail || `affinda_http_${postRes.status}`);
  }

  const jr = asRecord(j);
  const data = jr ? asRecord(jr.data) : null;
  const hasUsefulData = (() => {
    if (!data) return false;
    if (Array.isArray(data.emails) && data.emails.length > 0) return true;
    if (data.name !== undefined) return true;
    return false;
  })();

  if (hasUsefulData || (data && Object.keys(data).length > 0)) {
    return mapAffindaResumeToForm(j);
  }

  const meta = jr ? asRecord(jr.meta) : null;
  const id =
    (meta?.identifier as string | undefined) ||
    (jr?.identifier as string | undefined) ||
    "";

  if (id) {
    for (let k = 0; k < 25; k++) {
      await sleep(500);
      const polled = await affindaGetResume(base, apiKey, id);
      const pr = asRecord(polled);
      if (!pr) continue;
      const pdata = asRecord(pr.data);
      if (pdata) {
        const prMeta = asRecord(pr.meta);
        const ok =
          (Array.isArray(pdata.emails) && pdata.emails.length > 0) ||
          pdata.name !== undefined ||
          prMeta?.ready === true;
        if (ok || prMeta?.ready === true) {
          return mapAffindaResumeToForm(polled);
        }
      }
    }
  }

  if (jr && jr.data !== undefined) {
    return mapAffindaResumeToForm(j);
  }

  throw new Error("affinda_empty");
}
