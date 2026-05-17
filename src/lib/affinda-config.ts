/** Base API Affinda (EU par défaut — surcharge via AFFINDA_API_BASE ou AFFINDA_API_BASE_URL). */
export function getAffindaApiBase(): string {
  const fromEnv =
    process.env.AFFINDA_API_BASE?.trim() ||
    process.env.AFFINDA_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "https://api.eu1.affinda.com";
}

export function getAffindaApiKey(): string {
  return (process.env.AFFINDA_API_KEY ?? "").trim();
}

export function isAffindaConfigured(): boolean {
  return getAffindaApiKey().length > 0;
}
