import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vite-plus/test";

import {DOC_PAGES} from "./registry";

const CONTENT = join(import.meta.dirname, "content");
const fileFor = (slug: string) => join(CONTENT, `${slug || "index"}.mdx`);

/** Every .mdx under content/, as slugs. */
function contentSlugs(dir = CONTENT, prefix = ""): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return contentSlugs(path, `${prefix}${name}/`);
    if (!name.endsWith(".mdx")) return [];
    const slug = `${prefix}${name.slice(0, -4)}`;
    return [slug === "index" ? "" : slug];
  });
}

describe("docs registry", () => {
  const slugs = new Set(DOC_PAGES.map(page => page.slug));

  it("has each page once, with content", () => {
    expect(slugs.size).toBe(DOC_PAGES.length);
    for (const page of DOC_PAGES) expect(existsSync(fileFor(page.slug)), page.slug).toBe(true);
  });

  it("lists every content file", () => {
    for (const slug of contentSlugs()) expect(slugs.has(slug), slug).toBe(true);
  });

  it("only links to pages that exist", () => {
    for (const page of DOC_PAGES) {
      const text = readFileSync(fileFor(page.slug), "utf8");
      const targets = [
        ...text.matchAll(/\]\((\/docs[^)#\s]*)/g),
        ...text.matchAll(/to="(\/docs[^"#]*)"/g),
      ].map(match => match[1]!.replace(/^\/docs\/?/, "").replace(/\/$/, ""));
      for (const target of targets)
        expect(slugs.has(target), `${page.slug} → ${target}`).toBe(true);
    }
  });
});
