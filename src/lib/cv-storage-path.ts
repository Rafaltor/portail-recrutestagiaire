/**
 * Clé d’objet dans le bucket Supabase `cvs` (chemin relatif au bucket, sans slash initial).
 * Enlève un préfixe `cvs/` si présent : avec `.from("cvs")`, sinon la clé devient `cvs/...` → objet introuvable.
 */
export function normalizeCvObjectKey(raw: unknown): string {
  let p = String(raw ?? "").trim();
  p = p.replace(/^\/+/, "");
  const lower = p.toLowerCase();
  if (lower.startsWith("cvs/")) {
    p = p.slice(4);
  }
  return p.replace(/^\/+/, "");
}
