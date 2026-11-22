/**
 * How the server's refusal of a change to an archived (read-only) workspace begins, so the app can
 * recognise it (see router.tsx). Shared with the server, which builds its message from it.
 */
export const ARCHIVED_MESSAGE_START = "This workspace is archived";
