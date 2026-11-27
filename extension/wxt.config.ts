import {readFileSync} from "node:fs";
import {resolve} from "node:path";

import tailwindcss from "@tailwindcss/vite";
import {defineConfig} from "wxt";

import {EXTENSION_ID} from "../src/lib/extension";

/**
 * The WOW Chrome extension (WXT + React). It shares the website's code (`@/` is ../src): the
 * oRPC client, the puzzle panel, chat, voice and presence, signed in with an OAuth access token
 * (src/lib/extension.ts) instead of the session cookie.
 *
 * `pnpm ext:dev` builds against a local WOW (WOW_ORIGIN, default http://localhost:3140) and opens
 * Chrome with it; `pnpm ext:build` / `pnpm ext:zip` build for https://www.wafflehaus.io.
 */
const originFor = (mode: string) =>
  process.env.WOW_ORIGIN ??
  (mode === "development" ? "http://localhost:3140" : "https://www.wafflehaus.io");

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  // `@/` is the website's src, as in its own code. WXT always points `@` at this folder after
  // reading `alias`, so it's changed once the config is resolved (Vite and the tsconfig both).
  hooks: {
    "config:resolved": wxt => {
      wxt.config.alias["@"] = resolve(import.meta.dirname, "../src");
    },
  },
  // The public half of the key in key.pem (not committed): it fixes the extension's ID, which
  // its OAuth redirect URI and the server's trusted origins name.
  manifest: ({mode}) => ({
    name: "WOW for puzzle hunts",
    version: "0.1.0",
    description:
      "Your WOW puzzle beside the hunt's own page: status, answers, chat, calls and who's there.",
    key: readFileSync(resolve(import.meta.dirname, ".pubkey"), "utf8").trim(),
    permissions: [
      "identity",
      "storage",
      "contextMenus",
      "activeTab",
      "declarativeNetRequestWithHostAccess",
      // Desktop notifications when someone @mentions you, and an alarm that keeps them coming.
      "notifications",
      "alarms",
    ],
    // WebSocket traffic keeps the service worker (and the mentions socket) alive from Chrome 116.
    minimum_chrome_version: "116",
    host_permissions: [`${originFor(mode)}/*`],
    // The sidebar, and the icon on its collapsed tab, are shown in hunts' pages.
    web_accessible_resources: [
      {resources: ["sidebar.html", "icon/32.png"], matches: ["<all_urls>"]},
    ],
    action: {default_title: "WOW"},
    // WOW's site tells the extension about this browser's push notifications (src/lib/extension.ts).
    externally_connectable: {matches: [`${originFor(mode)}/*`]},
  }),
  vite: ({mode}) => ({
    plugins: [tailwindcss(), authClientForExtension(), noDocs()],
    define: {
      "import.meta.env.WOW_ORIGIN": JSON.stringify(originFor(mode)),
      "import.meta.env.EXTENSION_ID": JSON.stringify(EXTENSION_ID),
    },
  }),
});

/**
 * The website's better-auth client reads the session cookie. In the extension, whoever is signed
 * in is the extension's OAuth user, so shared components that ask `authClient.useSession()` get
 * extension/lib/auth-client.ts instead, however they import it.
 */
function authClientForExtension() {
  const website = resolve(import.meta.dirname, "../src/lib/auth-client.ts");
  const extension = resolve(import.meta.dirname, "lib/auth-client.ts");
  return {
    name: "wow:extension-auth-client",
    enforce: "pre" as const,
    async resolveId(
      this: {
        resolve: (id: string, importer?: string, options?: object) => Promise<{id: string} | null>;
      },
      source: string,
      importer: string | undefined
    ) {
      if (!source.includes("auth-client") || importer === extension) return null;
      const resolved = await this.resolve(source, importer, {skipSelf: true});
      return resolved?.id.split("?")[0] === website ? extension : null;
    },
  };
}

/**
 * The docs' pages (MDX) come along with the skeletons module the workspace code shows while
 * loading, but the extension never shows docs: they're left out rather than compiled.
 */
function noDocs() {
  return {
    name: "wow:extension-no-docs",
    enforce: "pre" as const,
    load(id: string) {
      if (id.endsWith(".mdx?raw")) return "export default '';";
      if (id.endsWith(".mdx")) return "export default function Doc() { return null; }";
      return null;
    },
  };
}
