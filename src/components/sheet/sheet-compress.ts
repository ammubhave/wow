/**
 * Gzip for the big things a sheet sends and stores (snapshots, large pastes), as base64 text so it
 * fits the room's JSON messages. Puzzle data (repeated JSON keys, styles) compresses 5-10x.
 */

/** Edits smaller than this go as plain JSON (not worth the work). */
export const PACK_OVER_CHARS = 64 * 1024;

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream
) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  // In slices: String.fromCharCode takes a limited number of arguments.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function gzipText(text: string) {
  return toBase64(await pipe(new TextEncoder().encode(text), new CompressionStream("gzip")));
}

export async function gunzipText(packed: string) {
  return new TextDecoder().decode(await pipe(fromBase64(packed), new DecompressionStream("gzip")));
}
