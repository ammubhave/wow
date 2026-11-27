import {createPublicKey, verify} from "node:crypto";

import {describe, expect, it} from "vite-plus/test";

import {encryptPayload, fromBase64Url, retryAfterSeconds, toBase64Url, vapidJwt} from "./web-push";

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
