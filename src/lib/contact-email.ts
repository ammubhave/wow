/** Where workspace contact emails go: `<slug>@wafflehaus.io` (see src/server/inbound-email.ts). */
export const CONTACT_EMAIL_DOMAIN = "wafflehaus.io";

/** A workspace's contact email. Addresses ignore case, so it's shown in lower case. */
export const contactEmail = (workspaceSlug: string) =>
  `${workspaceSlug.toLowerCase()}@${CONTACT_EMAIL_DOMAIN}`;

/** The workspace slug an address is for (lower case), ignoring "+tags": "team+hunt@…" → "team". */
export const slugOfAddress = (address: string) =>
  (address.split("@")[0] ?? "").split("+")[0]!.trim().toLowerCase();

/**
 * An HTML email body as plain text, for emails with no text part (and for previews): block ends
 * become line breaks, tags go, and the common entities are decoded.
 */
export function htmlToText(html: string) {
  return (
    html
      .replace(/<(style|script|head)\b[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr|table|blockquote|pre)\s*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
      .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
        String.fromCodePoint(Number.parseInt(code, 16))
      )
      // Last, so "&amp;lt;" becomes "&lt;", not "<".
      .replace(/&amp;/gi, "&")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** The start of a body on one line, for a notification. */
export const previewOf = (text: string, length = 200) => {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > length ? `${line.slice(0, length - 1)}…` : line;
};
