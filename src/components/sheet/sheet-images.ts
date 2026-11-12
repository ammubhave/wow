import {
  type IImageIoService,
  type IImageIoServiceParam,
  ImageSourceType,
  ImageUploadStatusType,
} from "@univerjs/presets";

// Same limits as the server (see puzzle-files.ts): the formats people paste, up to 5 MB.
const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function dataUrl(file: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error(ImageUploadStatusType.ERROR_IMAGE))
    );
    reader.addEventListener("error", () => reject(new Error(ImageUploadStatusType.ERROR_IMAGE)));
    reader.readAsDataURL(file);
  });
}

/** Univer's image service keeps a count of uploads in progress (internal). */
type WithWaitCount = {_decreaseWaiting?: () => void};

/**
 * Makes a sheet's image service upload images (pasted, or from the Insert image menu) to the
 * puzzle's files (R2, like the whiteboard's), so the sheet keeps only their URL. Univer's own
 * service puts each image into the sheet as a data URL, so every edit, snapshot and newcomer would
 * carry every image's bytes. (Univer's drawing add-on registers its service directly, so it's
 * patched in place rather than overridden.)
 *
 * Files are named by the SHA-256 of their bytes (the server checks), so pasting the same image
 * twice uploads it once.
 */
export function uploadImagesToPuzzleFiles(service: IImageIoService, puzzleId: string) {
  service.saveImage = async (file: File): Promise<IImageIoServiceParam> => {
    try {
      if (!IMAGE_TYPES.has(file.type)) throw new Error(ImageUploadStatusType.ERROR_IMAGE_TYPE);
      if (file.size > MAX_IMAGE_BYTES) throw new Error(ImageUploadStatusType.ERROR_EXCEED_SIZE);
      const bytes = await file.arrayBuffer();
      const id = await sha256Hex(bytes);
      const url = `/api/sheet/${puzzleId}/files/${id}`;
      const response = await fetch(url, {
        method: "PUT",
        headers: {"Content-Type": file.type},
        body: bytes,
      });
      if (!response.ok) throw new Error(ImageUploadStatusType.ERROR_IMAGE);
      // Shown from memory right away; teammates load it from the URL.
      const preview = await dataUrl(file);
      const image = new Image();
      image.src = preview;
      service.addImageSourceCache(url, ImageSourceType.URL, image);
      return {
        imageId: id.slice(0, 16),
        imageSourceType: ImageSourceType.URL,
        source: url,
        base64Cache: preview,
        status: ImageUploadStatusType.SUCCUSS,
      };
    } finally {
      // oxlint-disable-next-line no-underscore-dangle, typescript/no-unsafe-type-assertion -- Univer's own bookkeeping (pinned version).
      (service as unknown as WithWaitCount)._decreaseWaiting?.();
    }
  };
}
