/**
 * Uploading images that are stored by the SHA-256 of their bytes (chat images, team emoji): big
 * ones are shrunk first, the id is computed here, and the server checks it matches.
 */

/** Shrinks an image to fit `maxBytes` (and `maxSide` pixels), keeping it legible. */
async function fitImage(file: File, maxBytes: number, maxSide: number): Promise<Blob> {
  if (file.size <= maxBytes) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale)
  );
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await canvas.convertToBlob({type: "image/webp", quality: 0.85});
  if (blob.size > maxBytes) throw new Error("That image is too large.");
  return blob;
}

/** Uploads `file` to `urlFor(id)` (PUT) and returns its id. */
export async function uploadImage(
  file: File,
  urlFor: (id: string) => string,
  {maxBytes, maxSide}: {maxBytes: number; maxSide: number}
) {
  const blob = await fitImage(file, maxBytes, maxSide);
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const id = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  const response = await fetch(urlFor(id), {
    method: "PUT",
    headers: {"Content-Type": blob.type},
    body: blob,
  });
  if (!response.ok) throw new Error("Couldn't upload the image.");
  return id;
}
