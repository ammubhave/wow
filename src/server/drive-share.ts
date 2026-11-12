import {z} from "zod";

/** A Google API error body. */
const googleErrorSchema = z.object({
  error: z
    .object({
      message: z.string().optional(),
      errors: z.array(z.object({reason: z.string().optional()})).optional(),
    })
    .optional(),
});

export type FolderShareResult =
  | {ok: true}
  | {
      ok: false;
      /** Why, in plain words, with what to do about it. */
      detail: string;
      /** A file added outside WOW stops the folder being shared with anyone. */
      blocked?: boolean;
      /**
       * A file in the folder that wasn't made through WOW, which blocks sharing the whole folder
       * (WOW's Drive access only covers files it created), when Google names it.
       */
      blockingFileId?: string;
    };

async function readError(resp: Response) {
  const text = await resp.text();
  try {
    const parsed = googleErrorSchema.safeParse(JSON.parse(text));
    return {
      message: parsed.data?.error?.message ?? text,
      reason: parsed.data?.error?.errors?.[0]?.reason ?? "",
    };
  } catch {
    return {message: text, reason: ""};
  }
}

/**
 * Gives `email` edit access to the workspace's Drive folder (and so to every puzzle sheet in it).
 *
 * Google only shares with an address that has no Google account by inviting it by email, so then
 * it retries with Google's invitation email.
 */
export async function shareDriveFolder(
  accessToken: string,
  folderId: string,
  email: string
): Promise<FolderShareResult> {
  const share = (notify: boolean) =>
    fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}/permissions?${new URLSearchParams(
        {sendNotificationEmail: String(notify), supportsAllDrives: "true"}
      ).toString()}`,
      {
        method: "POST",
        headers: {Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json"},
        body: JSON.stringify({type: "user", emailAddress: email, role: "writer"}),
      }
    );
  let resp = await share(false);
  if (resp.ok) return {ok: true};
  let error = await readError(resp);
  if (resp.status === 400 && /notif|google account/i.test(error.message)) {
    resp = await share(true);
    if (resp.ok) return {ok: true};
    error = await readError(resp);
  }
  console.warn(`Couldn't share Drive folder ${folderId}: ${resp.status}: ${error.message}`);
  // e.g. "The user has not granted the app … write access to the child file <id>, which would be
  // affected by the operation on the parent."
  const blockingFileId = /child (?:file|item) ([\w-]{10,})/i.exec(error.message)?.[1];
  if (
    blockingFileId ||
    error.reason === "appNotAuthorizedToChild" ||
    error.message.includes("has not granted the app")
  ) {
    return {
      ok: false,
      blocked: true,
      blockingFileId,
      detail: blockingFileId
        ? "A file in the folder was added outside WOW, which stops WOW sharing the folder. Move that file out of the folder, then share with everyone again from Settings → Administration."
        : "A file in the folder was added outside WOW, which stops WOW sharing the folder. Move files WOW didn't create out of the folder, then share with everyone again from Settings → Administration.",
    };
  }
  return {ok: false, detail: `Google Drive refused (${resp.status}): ${error.message}`};
}

/** Said when WOW has no working Google connection to share with. */
export const DRIVE_DISCONNECTED_DETAIL =
  "WOW's connection to Google Drive has expired. Reconnect it in Settings → Administration, then share with everyone again there.";
