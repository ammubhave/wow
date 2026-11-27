import {env, WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep} from "cloudflare:workers";
import {eq, sql} from "drizzle-orm";
import PostalMime from "postal-mime";
import {v7 as uuidv7} from "uuid";
import {z} from "zod";

import {htmlToText, previewOf, slugOfAddress} from "@/lib/contact-email";
import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {fetchDiscord} from "@/server/do/discord-client";
import {NotificationService} from "@/server/router/services/notification";

/**
 * Emails to a workspace's contact address, `<slug>@wafflehaus.io` (Cloudflare Email Routing sends
 * them to the Worker's `email` handler). The handler only checks the address and keeps the message
 * as received; InboundEmailWorkflow then saves it to the workspace's Inbox, notifies the team
 * (like an announcement) and posts it to the team's Discord #email-updates channel, if there is
 * one, retrying each step that fails.
 */
export type InboundEmailParams = {
  /** The email's id, and its workflow instance's. */
  emailId: string;
  workspaceId: string;
  /** The message as received, in R2. */
  rawKey: string;
  receivedAt: number;
};

/** Bigger than any announcement needs to be; hunt emails are text. */
const MAX_RAW_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 100_000;
const MAX_HTML = 500_000;
/** Discord's limit on a message's length. */
const DISCORD_MAX = 2000;
const DISCORD_CHANNEL = "email-updates";

/**
 * Takes in an email: refuses one for no workspace (the sender gets it back), keeps it, and starts
 * the workflow. Anything failing here throws, so the sending server tries again later.
 */
export async function receiveEmail(message: ForwardableEmailMessage) {
  const slug = slugOfAddress(message.to);
  const workspace = await db
    .select({id: schema.organization.id, archivedAt: schema.organization.archivedAt})
    .from(schema.organization)
    .where(sql`lower(${schema.organization.slug}) = ${slug}`)
    .get();
  if (!workspace) {
    message.setReject("There's no WOW workspace with this address.");
    return;
  }
  if (workspace.archivedAt) {
    message.setReject("This WOW workspace is archived and no longer takes email.");
    return;
  }
  if (message.rawSize > MAX_RAW_BYTES) {
    message.setReject("This email is too big. Keep it under 10 MB.");
    return;
  }
  const emailId = uuidv7();
  const rawKey = `emails/${workspace.id}/${emailId}.eml`;
  // R2 needs the length up front, which a stream doesn't give.
  await env.R2.put(rawKey, await new Response(message.raw).arrayBuffer(), {
    httpMetadata: {contentType: "message/rfc822"},
  });
  await env.INBOUND_EMAIL_WORKFLOW.create({
    id: emailId,
    params: {emailId, workspaceId: workspace.id, rawKey, receivedAt: Date.now()},
  });
}

const RETRIES = {
  retries: {limit: 6, delay: "10 seconds", backoff: "exponential"},
  timeout: "1 minute",
} as const;

export class InboundEmailWorkflow extends WorkflowEntrypoint<Env, InboundEmailParams> {
  async run(event: WorkflowEvent<InboundEmailParams>, step: WorkflowStep) {
    const email = await step.do("save to the inbox", RETRIES, () => save(event.payload));
    await step.do("notify the team", RETRIES, () =>
      new NotificationService().broadcast(event.payload.workspaceId, {
        type: "email",
        emailId: event.payload.emailId,
        from: email.from,
        subject: email.subject,
        preview: email.preview,
      })
    );
    await step.do("post to Discord", RETRIES, () =>
      postToDiscord(event.payload.workspaceId, email)
    );
  }
}

type Saved = {from: string; subject: string | null; preview: string; text: string};

/** Parses the email and adds it to the inbox (once: a retry finds it there). */
async function save({
  emailId,
  workspaceId,
  rawKey,
  receivedAt,
}: InboundEmailParams): Promise<Saved> {
  const object = await env.R2.get(rawKey);
  if (!object) throw new Error(`The email ${emailId} isn't in R2 (${rawKey})`);
  const parsed = await PostalMime.parse(await object.arrayBuffer());
  const html = parsed.html?.slice(0, MAX_HTML) || null;
  const text = (parsed.text?.trim() || (html ? htmlToText(html) : "")).slice(0, MAX_TEXT);
  const fromAddress = parsed.from?.address || parsed.sender?.address || "unknown";
  const fromName = parsed.from?.name || null;
  await db
    .insert(schema.workspaceEmail)
    .values({
      id: emailId,
      workspaceId,
      receivedAt: new Date(receivedAt),
      fromAddress,
      fromName,
      subject: parsed.subject?.trim() || null,
      text: text || null,
      html,
      attachments: parsed.attachments.map(attachment => ({
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size:
          typeof attachment.content === "string"
            ? attachment.content.length
            : attachment.content.byteLength,
      })),
      rawKey,
    })
    .onConflictDoNothing();
  return {
    from: fromName ?? fromAddress,
    subject: parsed.subject?.trim() || null,
    preview: previewOf(text),
    text,
  };
}

const channelsSchema = z.array(z.object({id: z.string(), type: z.number(), name: z.string()}));

/**
 * Posts the email to the team's #email-updates Discord channel, as WOW always has. Teams without
 * Discord, or without that channel, just have it in WOW.
 */
async function postToDiscord(workspaceId: string, email: Saved) {
  if (!env.DISCORD_BOT_TOKEN) return;
  const workspace = await db
    .select({guildId: schema.organization.discordGuildId})
    .from(schema.organization)
    .where(eq(schema.organization.id, workspaceId))
    .get();
  if (!workspace?.guildId) return;
  const channels = await fetchDiscord(`/guilds/${workspace.guildId}/channels`);
  // The bot was removed from the server, say: nothing to post to.
  if (channels.status === 403 || channels.status === 404) return;
  if (!channels.ok) throw new Error(`Discord didn't list the channels (${channels.status})`);
  const channel = channelsSchema
    .parse(await channels.json())
    .find(c => c.type === 0 && c.name === DISCORD_CHANNEL);
  if (!channel) return;
  const heading = `**${email.subject ?? "(no subject)"}**\nFrom ${email.from}\n\n`;
  const body = email.text.slice(0, DISCORD_MAX - heading.length);
  const form = new FormData();
  form.append("content", heading + body);
  const posted = await fetchDiscord(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: form,
  });
  if (posted.status === 403 || posted.status === 404) return;
  if (!posted.ok) throw new Error(`Discord didn't take the message (${posted.status})`);
}
