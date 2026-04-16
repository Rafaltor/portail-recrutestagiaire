import { sanitizeProfileOwnerToken } from "@/lib/profile-owner-token";

export function readLinkedProfileTokens(raw: unknown) {
  if (!Array.isArray(raw)) return [] as string[];
  const out: string[] = [];
  for (const item of raw) {
    const clean = sanitizeProfileOwnerToken(String(item || ""));
    if (!clean) continue;
    if (!out.includes(clean)) out.push(clean);
  }
  return out;
}

