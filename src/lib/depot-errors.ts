/** Limite corps requête Vercel (~4,5 Mo) — marge pour le multipart. */
export const DEPOT_MAX_BYTES = 4 * 1024 * 1024;

export function formatDepotError(code: string, retryAfterSec?: number): string {
  if (code === "rate_limited" || code === "rate_limited_handle") {
    return `Trop de dépôts d’un coup. Réessaie dans ~${retryAfterSec ?? 60}s.`;
  }
  if (code === "already_pending") {
    return "Un profil avec ce pseudo est déjà en attente de modération.";
  }
  if (code === "handle_taken") {
    return "Ce pseudo Instagram est déjà utilisé sur le portail.";
  }
  if (code === "file_too_large" || code === "payload_too_large") {
    return "PDF trop lourd (max 4 Mo). Compresse ton fichier ou envoie une version plus légère.";
  }
  if (code === "pdf_only") {
    return "Le CV doit être un fichier PDF (extension .pdf).";
  }
  if (code === "charte_required") return "Tu dois accepter la charte.";
  if (code === "handle_required") return "Pseudo Instagram obligatoire.";
  if (code === "handle_invalid") {
    return "Pseudo invalide : utilise des lettres, chiffres, points ou tirets.";
  }
  if (code === "file_required") return "Ajoute ton CV en PDF.";
  if (code === "bad_formdata") {
    return "Envoi invalide. Recharge la page et réessaie.";
  }
  if (code === "server_misconfigured" || code === "internal_error") {
    return "Service temporairement indisponible. Réessaie dans quelques minutes.";
  }
  if (code.startsWith("upload_failed:")) {
    return "Impossible d’enregistrer le PDF. Réessaie dans quelques minutes.";
  }
  if (code.startsWith("insert_failed:")) {
    const detail = code.slice("insert_failed:".length);
    if (/duplicate|unique|already exists/i.test(detail)) {
      return "Ce pseudo Instagram est déjà utilisé sur le portail.";
    }
    return "Impossible d’enregistrer la candidature. Vérifie le pseudo et réessaie.";
  }
  if (code.startsWith("check_failed:")) {
    return "Impossible de vérifier le pseudo. Réessaie dans quelques instants.";
  }
  if (code === "http_413") {
    return "PDF trop lourd (max 4 Mo). Compresse ton fichier ou envoie une version plus légère.";
  }
  if (code === "http_502" || code === "http_503" || code === "http_504") {
    return "Le serveur met trop de temps à répondre. Réessaie dans un instant.";
  }
  if (code.startsWith("http_5")) {
    return "Service temporairement indisponible. Réessaie dans quelques minutes.";
  }
  if (!code.trim()) {
    return "Impossible d’enregistrer le dépôt. Réessaie ou contacte l’équipe si le problème continue.";
  }
  return code;
}

export async function readDepotApiError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  let payload: { error?: string; message?: string; retryAfterSec?: number } = {};
  if (text) {
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      /* corps HTML / texte brut (souvent 413 ou 502 Vercel) */
    }
  }

  const code =
    payload.error ||
    payload.message ||
    (res.status === 413 ? "payload_too_large" : "") ||
    (res.status >= 500 ? `http_${res.status}` : "") ||
    "";

  return formatDepotError(code, payload.retryAfterSec);
}
