import {env, waitUntil} from "cloudflare:workers";

import {captureServerException} from "./posthog";

/** The only address the EMAIL binding may send from (see wrangler.jsonc). */
const FROM = {email: "noreply@wafflehaus.io", name: "Wafflehaüs Organized Workspaces"};

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[char]!
  );

/**
 * An email with one call to action (verify, reset, …), as HTML and plain text, sent through
 * Cloudflare Email Service. Sent after the response (it never delays or fails the request);
 * failures go to error tracking.
 */
export function sendActionEmail({
  to,
  subject,
  intro,
  action,
  outro,
}: {
  to: string;
  subject: string;
  /** Paragraphs before the button. */
  intro: string[];
  action: {label: string; url: string};
  /** Paragraphs after it (e.g. "if this wasn't you…"). */
  outro?: string[];
}) {
  const paragraph = (text: string) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#27272a">${escapeHtml(text)}</p>`;
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
    <div style="max-width:480px;margin:0 auto;padding:32px;background:#ffffff;border-radius:12px">
      <h1 style="margin:0 0 20px;font-size:20px;color:#18181b">${escapeHtml(subject)}</h1>
      ${intro.map(paragraph).join("\n      ")}
      <p style="margin:24px 0">
        <a href="${escapeHtml(action.url)}" style="display:inline-block;padding:10px 18px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600">${escapeHtml(action.label)}</a>
      </p>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#71717a">Or open this link: <a href="${escapeHtml(action.url)}" style="color:#7c3aed;word-break:break-all">${escapeHtml(action.url)}</a></p>
      ${(outro ?? []).map(paragraph).join("\n      ")}
      <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa">Wafflehaüs Organized Workspaces · wafflehaus.io</p>
    </div>
  </body>
</html>`;
  const text = [...intro, `${action.label}: ${action.url}`, ...(outro ?? [])].join("\n\n");

  waitUntil(
    (async () => {
      try {
        await env.EMAIL.send({from: FROM, to, subject, html, text});
      } catch (error) {
        console.error(`Couldn't send "${subject}" email`, error);
        captureServerException(error, {properties: {emailSubject: subject}});
      }
    })()
  );
}
