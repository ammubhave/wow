import {z} from "zod";

/** What a page's content script answers to `{type: "pageInfo"}` (see lib/messages.ts). */
export const pageInfoSchema = z.object({title: z.string().optional(), url: z.string().optional()});
