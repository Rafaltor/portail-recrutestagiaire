import { readDepotApiError, formatDepotError } from "@/lib/depot-errors";

export type DepotUploadTarget = {
  path: string;
  ownerToken: string;
};

export async function uploadDepotCv(
  file: File,
  handle: string,
): Promise<DepotUploadTarget> {
  const prep = await fetch("/api/depot/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      handle: handle.trim(),
      fileName: file.name,
      fileSize: file.size,
    }),
  });
  if (!prep.ok) {
    throw new Error(await readDepotApiError(prep));
  }

  const j: {
    ok?: boolean;
    signedUrl?: string;
    path?: string;
    ownerToken?: string;
  } = await prep.json();
  if (!j.ok || !j.signedUrl || !j.path || !j.ownerToken) {
    throw new Error(formatDepotError("internal_error"));
  }

  const put = await fetch(j.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/pdf",
    },
    body: file,
  });
  if (!put.ok) {
    throw new Error(formatDepotError("upload_failed:direct"));
  }

  return { path: j.path, ownerToken: j.ownerToken };
}
