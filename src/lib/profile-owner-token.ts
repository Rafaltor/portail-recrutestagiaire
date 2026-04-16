import crypto from "crypto";

export function generateProfileOwnerToken() {
  return crypto.randomBytes(16).toString("hex");
}

export function sanitizeProfileOwnerToken(raw: string) {
  return raw.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
}

export function extractOwnerTokenFromCvPath(cvPath: string) {
  const cleanPath = String(cvPath || "").trim();
  if (!cleanPath) return "";
  const filename = cleanPath.split("/").pop() || "";
  const i = filename.indexOf("-");
  if (i <= 0) return "";
  const token = filename.slice(0, i);
  return sanitizeProfileOwnerToken(token);
}
