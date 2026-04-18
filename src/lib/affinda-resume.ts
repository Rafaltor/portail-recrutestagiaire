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
  return b && b.length > 0 ? b.replace(/\/+$/, "") : "https://api.eu1.affinda.com";
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
  if (!res.ok) throw new Error(`affinda_get_${res.status}`);
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
  const apiKey = process.env.AFFINDA_API_KEY?.trim();
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
    const msg =
      asRecord(j)?.error && asRecord(asRecord(j)?.error)?.message
        ? String(asRecord(asRecord(j)?.error)?.message)
        : `affinda_http_${postRes.status}`;
    throw new Error(msg);
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
