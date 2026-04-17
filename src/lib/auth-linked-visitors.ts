export function readLinkedVisitorIds(raw: unknown) {
  if (!Array.isArray(raw)) return [] as string[];
  const out: string[] = [];
  for (const item of raw) {
    const clean = String(item || "").trim().slice(0, 200);
    if (!clean) continue;
    if (!out.includes(clean)) out.push(clean);
  }
  return out;
}

