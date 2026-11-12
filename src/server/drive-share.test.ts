import {afterEach, describe, expect, it, vi} from "vite-plus/test";

import {shareDriveFolder} from "./drive-share";

const googleError = (status: number, message: string, reason = "") =>
  new Response(JSON.stringify({error: {message, errors: [{reason}]}}), {status});

function mockFetch(...responses: Response[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const response of responses) fetch.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("shareDriveFolder", () => {
  afterEach(() => vi.unstubAllGlobals());
  vi.spyOn(console, "warn").mockImplementation(() => {});

  it("shares without an email", async () => {
    const fetch = mockFetch(new Response("{}"));
    expect(await shareDriveFolder("token", "folder", "a@example.com")).toEqual({ok: true});
    expect(fetch.mock.calls[0]).toEqual([
      expect.stringContaining("sendNotificationEmail=false"),
      expect.anything(),
    ]);
  });

  it("invites by email an address with no Google account", async () => {
    const fetch = mockFetch(
      googleError(
        400,
        'Bad Request. User message: "You are trying to invite a@example.com. Since there is no Google account associated with this email address, you must check the "Notify people" box to invite this recipient."',
        "invalidSharingRequest"
      ),
      new Response("{}")
    );
    expect(await shareDriveFolder("token", "folder", "a@example.com")).toEqual({ok: true});
    expect(fetch.mock.calls[1]).toEqual([
      expect.stringContaining("sendNotificationEmail=true"),
      expect.anything(),
    ]);
  });

  it("names the file added outside WOW that blocks the folder", async () => {
    mockFetch(
      googleError(
        403,
        "The user has not granted the app 933519172272 write access to the child file 1AbCdEfGhIjKlMnOpQrStUv, which would be affected by the operation on the parent.",
        "appNotAuthorizedToChild"
      )
    );
    const result = await shareDriveFolder("token", "folder", "a@example.com");
    expect(result).toMatchObject({
      ok: false,
      blocked: true,
      blockingFileId: "1AbCdEfGhIjKlMnOpQrStUv",
    });
  });

  it("explains a blocked folder even when Google doesn't name the file", async () => {
    mockFetch(googleError(403, "Insufficient permissions", "appNotAuthorizedToChild"));
    const result = await shareDriveFolder("token", "folder", "a@example.com");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.detail).toContain("added outside WOW");
  });

  it("passes on other errors", async () => {
    mockFetch(googleError(500, "Backend Error"));
    const result = await shareDriveFolder("token", "folder", "a@example.com");
    expect(!result.ok && result.detail).toBe("Google Drive refused (500): Backend Error");
  });
});
