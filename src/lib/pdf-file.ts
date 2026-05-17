/** Accepte les PDF même si le navigateur envoie un MIME vide ou application/octet-stream. */
export function isPdfUpload(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return true;
  const type = (file.type || "").toLowerCase();
  if (type === "application/pdf") return true;
  if (type === "application/octet-stream" && name.endsWith(".pdf")) return true;
  return false;
}
