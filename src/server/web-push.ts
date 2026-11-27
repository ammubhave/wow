/**
 * Web Push, by hand on WebCrypto (Workers have no Node `crypto` web-push library): the message is
 * encrypted for the browser that subscribed (RFC 8291, "aes128gcm" content encoding from RFC 8188),
 * and the request is signed with WOW's VAPID key (RFC 8292) so push services know it's from us.
 */

/** A browser's push subscription, as `PushSubscription.toJSON()` gives it. */
export type PushTarget = {endpoint: string; p256dh: string; auth: string};

/** WOW's VAPID key pair: the public key (uncompressed point) and private scalar, base64url. */
export type VapidKeys = {publicKey: string; privateKey: string};

export type PushOptions = {
  /** How long the push service keeps it for a device that's offline (seconds). */
  ttl: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  /** Who to contact about our pushes (a mailto: or https: URL). */
  subject: string;
};

export type PushResult = "sent" | "gone" | "failed";

/** Tries per push when the push service is busy or down (429, 5xx) or unreachable. */
const ATTEMPTS = 3;
/** The longest we'll wait between tries (a push is sent while its notification is fresh). */
const MAX_WAIT_SECONDS = 10;

/**
 * Sends `payload` (at most about 3,900 bytes) to one browser. A push service that's busy or down
 * is tried again shortly, waiting as long as it asks (Retry-After) up to MAX_WAIT_SECONDS.
 */
export async function sendWebPush(
  target: PushTarget,
  payload: string,
  vapid: VapidKeys,
  options: PushOptions
): Promise<PushResult> {
  const body = await encryptPayload(target, new TextEncoder().encode(payload));
  const audience = new URL(target.endpoint).origin;
  const jwt = await vapidJwt(audience, vapid, options.subject);
  for (let attempt = 1; ; attempt++) {
    let response: Response | undefined;
    try {
      // Retries are sequential by nature.
      // oxlint-disable-next-line no-await-in-loop
      response = await fetch(target.endpoint, {
        method: "POST",
        headers: {
          Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
          "Content-Encoding": "aes128gcm",
          "Content-Type": "application/octet-stream",
          TTL: String(options.ttl),
          Urgency: options.urgency ?? "normal",
        },
        body,
      });
    } catch (error) {
      if (attempt >= ATTEMPTS) throw error;
    }
    if (response) {
      // 404 and 410: the subscription has expired or been withdrawn, so stop sending to it.
      if (response.status === 404 || response.status === 410) return "gone";
      if (response.ok) return "sent";
      const busy = response.status === 429 || response.status >= 500;
      if (!busy || attempt >= ATTEMPTS) return "failed";
    }
    const wait =
      retryAfterSeconds(response?.headers.get("retry-after") ?? null) ?? 2 ** (attempt - 1);
    if (wait > MAX_WAIT_SECONDS) return "failed";
    // oxlint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, wait * 1000));
  }
}

/** A Retry-After header in seconds (it may be seconds or an HTTP date), or null if it has none. */
export function retryAfterSeconds(header: string | null) {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, (date - Date.now()) / 1000);
}

// --- Encryption (RFC 8291) ------------------------------------------------------------------

const RECORD_SIZE = 4096;

/**
 * The encrypted body: a header (salt, record size, our one-off public key) then the payload,
 * encrypted with a key only the subscribing browser can work out. `testing` fixes the salt and our
 * key pair, which are otherwise new each time (for the RFC's worked example).
 */
export async function encryptPayload(
  target: PushTarget,
  plaintext: Uint8Array,
  testing?: {salt: Uint8Array; publicKey: Uint8Array; privateKey: Uint8Array}
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = fromBase64Url(target.p256dh);
  const authSecret = fromBase64Url(target.auth);
  const salt = testing?.salt ?? crypto.getRandomValues(new Uint8Array(16));

  const ecdh = {name: "ECDH", namedCurve: "P-256"};
  let asPrivate: CryptoKey;
  let asPublic: Uint8Array;
  if (testing) {
    asPublic = testing.publicKey;
    asPrivate = await crypto.subtle.importKey(
      "jwk",
      privateJwk(testing.publicKey, testing.privateKey),
      ecdh,
      false,
      ["deriveBits"]
    );
  } else {
    const pair = await crypto.subtle.generateKey(ecdh, true, ["deriveBits"]);
    asPrivate = pair.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  }
  const uaKey = await crypto.subtle.importKey("raw", copy(uaPublic), ecdh, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({name: "ECDH", public: uaKey}, asPrivate, 256)
  );

  // HKDF, step by step as the RFC writes it.
  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(text("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hmac(prkKey, concat(keyInfo, [1]));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(text("Content-Encoding: aes128gcm\0"), [1]))).slice(0, 16);
  const nonce = (await hmac(prk, concat(text("Content-Encoding: nonce\0"), [1]))).slice(0, 12);

  // One record: the payload, then the delimiter that marks the last record (no padding).
  const record = concat(plaintext, [2]);
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({name: "AES-GCM", iv: nonce}, aesKey, record)
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, RECORD_SIZE);
  return concat(salt, recordSize, [asPublic.length], asPublic, ciphertext);
}

// --- VAPID (RFC 8292) -------------------------------------------------------------------------

/** A JWT for the push service at `audience`, signed with our VAPID private key, good for 12 hours. */
export async function vapidJwt(audience: string, vapid: VapidKeys, subject: string) {
  const header = toBase64Url(text(JSON.stringify({typ: "JWT", alg: "ES256"})));
  const claims = toBase64Url(
    text(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject,
      })
    )
  );
  const key = await crypto.subtle.importKey(
    "jwk",
    privateJwk(fromBase64Url(vapid.publicKey), fromBase64Url(vapid.privateKey)),
    {name: "ECDSA", namedCurve: "P-256"},
    false,
    ["sign"]
  );
  // WebCrypto's ECDSA signature is r and s side by side, as JWS wants.
  const signature = await crypto.subtle.sign(
    {name: "ECDSA", hash: "SHA-256"},
    key,
    text(`${header}.${claims}`)
  );
  return `${header}.${claims}.${toBase64Url(new Uint8Array(signature))}`;
}

// --- Bytes ------------------------------------------------------------------------------------

/** A P-256 private key as a JWK, from its uncompressed public point (0x04, x, y) and scalar. */
function privateJwk(publicKey: Uint8Array, privateKey: Uint8Array): JsonWebKey {
  return {
    kty: "EC",
    crv: "P-256",
    x: toBase64Url(publicKey.slice(1, 33)),
    y: toBase64Url(publicKey.slice(33, 65)),
    d: toBase64Url(privateKey),
    ext: true,
  };
}

async function hmac(key: Uint8Array, data: Uint8Array) {
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    copy(key),
    {name: "HMAC", hash: "SHA-256"},
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, copy(data)));
}

const text = (value: string) => new TextEncoder().encode(value);

/** A copy on a plain ArrayBuffer (what WebCrypto's types ask for). */
const copy = (bytes: Uint8Array) => new Uint8Array(bytes);

function concat(...parts: (Uint8Array | number[])[]) {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
