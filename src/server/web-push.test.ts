import {createPublicKey, verify} from "node:crypto";

import {afterEach, describe, expect, it, vi} from "vite-plus/test";

import {
  encryptPayload,
  fromBase64Url,
  retryAfterSeconds,
  sendWebPush,
  toBase64Url,
  vapidJwt,
} from "./web-push";

describe("encryptPayload", () => {
  // RFC 8291, Appendix A: the worked example, byte for byte.
  it("matches the RFC's example", async () => {
    const body = await encryptPayload(
      {
        endpoint: "https://push.example.net/push/JzLQ3raZJfFBR0aqvOMsLrt54w4rJUsV",
        p256dh:
          "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
        auth: "BTBZMqHH6r4Tts7J_aSIgg",
      },
      new TextEncoder().encode("When I grow up, I want to be a watermelon"),
      {
        salt: fromBase64Url("DGv6ra1nlYgDCS1FRnbzlw"),
        publicKey: fromBase64Url(
          "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"
        ),
        privateKey: fromBase64Url("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"),
      }
    );
    expect(toBase64Url(body)).toBe(
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
    );
  });
});

const decode = (part: string | undefined): unknown =>
  JSON.parse(new TextDecoder().decode(fromBase64Url(part ?? "")));

describe("vapidJwt", () => {
  it("is signed with the VAPID key, for the push service", async () => {
    // A throwaway key pair, for this test only.
    const vapid = {
      publicKey:
        "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
      privateKey: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
    };
    const jwt = await vapidJwt("https://fcm.googleapis.com", vapid, "https://www.wafflehaus.io");
    const [header, claims, signature] = jwt.split(".");
    expect(decode(header)).toEqual({typ: "JWT", alg: "ES256"});
    expect(decode(claims)).toMatchObject({
      aud: "https://fcm.googleapis.com",
      sub: "https://www.wafflehaus.io",
    });
    const point = fromBase64Url(vapid.publicKey);
    const publicKey = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: toBase64Url(point.slice(1, 33)),
        y: toBase64Url(point.slice(33)),
      },
      format: "jwk",
    });
    const valid = verify(
      "sha256",
      new TextEncoder().encode(`${header}.${claims}`),
      {key: publicKey, dsaEncoding: "ieee-p1363"},
      fromBase64Url(signature ?? "")
    );
    expect(valid).toBe(true);
  });
});

describe("retryAfterSeconds", () => {
  it("reads seconds, or an HTTP date", () => {
    expect(retryAfterSeconds("7")).toBe(7);
    expect(retryAfterSeconds(null)).toBeNull();
    expect(retryAfterSeconds("soon")).toBeNull();
    const inFive = new Date(Date.now() + 5000).toUTCString();
    expect(retryAfterSeconds(inFive)).toBeGreaterThan(3);
    expect(retryAfterSeconds(inFive)).toBeLessThanOrEqual(5);
  });
});

/** The push service answers with these, in turn (a number: that status, no wait asked). */
function answers(...replies: (number | Response | Error)[]) {
  const fetch = vi.fn(() => {
    const reply = replies.shift();
    if (reply instanceof Error) return Promise.reject(reply);
    if (reply instanceof Response) return Promise.resolve(reply);
    return Promise.resolve(
      new Response(null, {status: reply ?? 500, headers: {"retry-after": "0"}})
    );
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("sendWebPush", () => {
  // The RFC's browser, and a throwaway VAPID key pair.
  const target = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    p256dh:
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
    auth: "BTBZMqHH6r4Tts7J_aSIgg",
  };
  const vapid = {
    publicKey:
      "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
    privateKey: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  };
  const options = {ttl: 60, subject: "https://example.com"};

  afterEach(() => void vi.unstubAllGlobals());

  it("sends once when it goes through", async () => {
    const fetch = answers(201);
    expect(await sendWebPush(target, "{}", vapid, options)).toBe("sent");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("tries again while the push service is busy or down", async () => {
    const fetch = answers(new Error("network"), 429, 201);
    expect(await sendWebPush(target, "{}", vapid, options)).toBe("sent");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("gives up after three tries", async () => {
    const fetch = answers(503, 503, 503, 201);
    expect(await sendWebPush(target, "{}", vapid, options)).toBe("failed");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("doesn't wait longer than it's worth", async () => {
    const fetch = answers(new Response(null, {status: 429, headers: {"retry-after": "120"}}), 201);
    expect(await sendWebPush(target, "{}", vapid, options)).toBe("failed");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("doesn't retry what won't change", async () => {
    let fetch = answers(410);
    expect(await sendWebPush(target, "{}", vapid, options)).toBe("gone");
    expect(fetch).toHaveBeenCalledTimes(1);
    fetch = answers(400, 201);
    expect(await sendWebPush(target, "{}", vapid, options)).toBe("failed");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
