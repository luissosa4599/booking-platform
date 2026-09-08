/**
 * Direct PUT of an image to a GCS V4 signed URL — deliberately bypasses
 * `apiFetch`: no `Authorization` header (it would break the signature), the
 * exact `Content-Type` the URL was signed for, no JSON wrapping.
 */
export async function uploadToSignedUrl(
  uploadUrl: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }
}

/** Fetches a local (file:// or blob:) URI into a Blob for upload. */
export async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return res.blob();
}
