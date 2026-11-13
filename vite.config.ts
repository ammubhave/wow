import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";

import {cloudflare} from "@cloudflare/vite-plugin";
import posthogSourcemaps from "@posthog/rollup-plugin";
import tailwindcss from "@tailwindcss/vite";
import {devtools} from "@tanstack/devtools-vite";
import {tanstackStart} from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import {defineConfig} from "vite-plus";

// Production builds (Workers Builds) upload the browser bundle's source maps to PostHog, so error
// tracking shows real file names and lines, then delete them so they aren't served publicly. Needs
// POSTHOG_PERSONAL_API_KEY (error tracking: write) and POSTHOG_PROJECT_ID; skipped without them.
const posthogSourcemapsPlugin = process.env.POSTHOG_PERSONAL_API_KEY
  ? {
      ...posthogSourcemaps({
        personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
        projectId: process.env.POSTHOG_PROJECT_ID,
        host: process.env.VITE_PUBLIC_POSTHOG_HOST,
        sourcemaps: {
          enabled: true,
          releaseName: "wow",
          releaseVersion: process.env.WORKERS_CI_COMMIT_SHA,
          deleteAfterUpload: true,
        },
      }),
      // The Worker's own source maps go to Cloudflare instead (upload_source_maps).
      applyToEnvironment: (environment: {name: string}) => environment.name === "client",
    }
  : undefined;

// Univer's source map (the sheet chunk's) had outgrown Cloudflare's 25 MiB per-file asset limit,
// which breaks the build's page shell and the deploy. Drop the embedded source text of
// dependencies' files from the browser maps: stack traces still map to their files and lines,
// and our own files keep their source for code context.
const slimClientSourceMaps = {
  name: "wow:slim-client-source-maps",
  applyToEnvironment: (environment: {name: string}) => environment.name === "client",
  // Synchronous, so it finishes before the PostHog plugin's writeBundle reads the maps.
  writeBundle(options: {dir?: string}, bundle: Record<string, unknown>) {
    for (const fileName of Object.keys(bundle)) {
      if (!fileName.endsWith(".js") || !options.dir) continue;
      const path = join(options.dir, `${fileName}.map`);
      if (!existsSync(path)) continue;
      const map: {sources: string[]; sourcesContent?: (string | null)[]} = JSON.parse(
        readFileSync(path, "utf8")
      );
      if (!map.sourcesContent) continue;
      map.sourcesContent = map.sourcesContent.map((content, i) =>
        map.sources[i]?.includes("node_modules/") ? null : content
      );
      writeFileSync(path, JSON.stringify(map));
    }
  },
};

// The spreadsheet (Univer, several MB) and whiteboard (Excalidraw) editors are lazily loaded,
// browser-only chunks. The Worker never renders a page (pure SPA), but its build still bundles
// every route's imports, which pushed it past the Worker size limit. Stub them out there.
const BROWSER_ONLY_IMPORT = /(?:^|\/)(?:sheet-canvas|whiteboard-canvas)$/;
const BROWSER_ONLY_STUB = "\0browser-only-stub";
const stubBrowserOnlyInWorker = {
  name: "wow:stub-browser-only-in-worker",
  enforce: "pre" as const,
  applyToEnvironment: (environment: {name: string}) => environment.name === "ssr",
  resolveId: (source: string) => (BROWSER_ONLY_IMPORT.test(source) ? BROWSER_ONLY_STUB : null),
  load: (id: string) =>
    id === BROWSER_ONLY_STUB ? "export default function BrowserOnly() { return null; }" : null,
};

const config = defineConfig({
  staged: {"*": "vp fmt --no-error-on-unmatched-pattern"},
  fmt: {
    arrowParens: "avoid",
    bracketSpacing: false,
    bracketSameLine: true,
    embeddedLanguageFormatting: "auto",
    sortImports: true,
    sortTailwindcss: true,
    jsxSingleQuote: false,
    objectWrap: "collapse",
    quoteProps: "as-needed",
    tabWidth: 2,
    trailingComma: "es5",
  },
  lint: {
    // No react-perf plugin: React Compiler (see `viteReact({compiler: true})`) memoizes inline
    // functions/objects/JSX props, which is what those rules guard against.
    plugins: ["unicorn", "typescript", "oxc", "react", "jsx-a11y", "import", "promise"],
    categories: {correctness: "warn", suspicious: "warn", perf: "warn"},
    rules: {
      // Automatic JSX runtime: React doesn't need to be in scope.
      "react/react-in-jsx-scope": "off",
      // TanStack Form's documented API is `<form.Field children={field => ...} />`.
      "react/no-children-prop": "off",
      // Autofocus on HeroUI components (e.g. a dialog's first field when it opens) is intended UX.
      "jsx-a11y/no-autofocus": ["warn", {ignoreNonDOM: true}],
      "for-direction": "warn",
      "no-async-promise-executor": "warn",
      "no-caller": "warn",
      "no-class-assign": "warn",
      "no-compare-neg-zero": "warn",
      "no-cond-assign": "warn",
      "no-const-assign": "warn",
      "no-constant-binary-expression": "warn",
      "no-constant-condition": "warn",
      "no-control-regex": "warn",
      "no-debugger": "warn",
      "no-delete-var": "warn",
      "no-dupe-class-members": "warn",
      "no-dupe-else-if": "warn",
      "no-dupe-keys": "warn",
      "no-duplicate-case": "warn",
      "no-empty-character-class": "warn",
      "no-empty-pattern": "warn",
      "no-empty-static-block": "warn",
      "no-eval": "warn",
      "no-ex-assign": "warn",
      "no-extra-boolean-cast": "warn",
      "no-func-assign": "warn",
      "no-global-assign": "warn",
      "no-import-assign": "warn",
      "no-invalid-regexp": "warn",
      "no-irregular-whitespace": "warn",
      "no-loss-of-precision": "warn",
      "no-new-native-nonconstructor": "warn",
      "no-nonoctal-decimal-escape": "warn",
      "no-obj-calls": "warn",
      "no-self-assign": "warn",
      "no-setter-return": "warn",
      "no-shadow-restricted-names": "warn",
      "no-sparse-arrays": "warn",
      "no-this-before-super": "warn",
      "no-unassigned-vars": "warn",
      "no-unsafe-finally": "warn",
      "no-unsafe-negation": "warn",
      "no-unsafe-optional-chaining": "warn",
      "no-unused-expressions": "warn",
      "no-unused-labels": "warn",
      "no-unused-private-class-members": "warn",
      "no-unused-vars": "warn",
      "no-useless-backreference": "warn",
      "no-useless-catch": "warn",
      "no-useless-escape": "warn",
      "no-useless-rename": "warn",
      "no-with": "warn",
      "require-yield": "warn",
      "use-isnan": "warn",
      "valid-typeof": "warn",
      "oxc/bad-array-method-on-arguments": "warn",
      "oxc/bad-char-at-comparison": "warn",
      "oxc/bad-comparison-sequence": "warn",
      "oxc/bad-min-max-func": "warn",
      "oxc/bad-object-literal-comparison": "warn",
      "oxc/bad-replace-all-arg": "warn",
      "oxc/const-comparisons": "warn",
      "oxc/double-comparisons": "warn",
      "oxc/erasing-op": "warn",
      "oxc/missing-throw": "warn",
      "oxc/number-arg-out-of-range": "warn",
      "oxc/only-used-in-recursion": "warn",
      "oxc/uninvoked-array-callback": "warn",
      "typescript/await-thenable": "warn",
      "typescript/no-array-delete": "warn",
      "typescript/no-base-to-string": "warn",
      "typescript/no-duplicate-enum-values": "warn",
      "typescript/no-duplicate-type-constituents": "warn",
      "typescript/no-extra-non-null-assertion": "warn",
      "typescript/no-floating-promises": "warn",
      "typescript/no-for-in-array": "warn",
      "typescript/no-implied-eval": "warn",
      "typescript/no-meaningless-void-operator": "warn",
      "typescript/no-misused-new": "warn",
      "typescript/no-misused-spread": "warn",
      "typescript/no-non-null-asserted-optional-chain": "warn",
      "typescript/no-redundant-type-constituents": "warn",
      "typescript/no-this-alias": "warn",
      "typescript/unbound-method": "off",
      "typescript/no-unnecessary-parameter-property-assignment": "warn",
      "typescript/no-unsafe-declaration-merging": "warn",
      "typescript/no-unsafe-unary-minus": "warn",
      "typescript/no-useless-empty-export": "warn",
      "typescript/no-wrapper-object-types": "warn",
      "typescript/prefer-as-const": "warn",
      "typescript/require-array-sort-compare": "warn",
      "typescript/restrict-template-expressions": "warn",
      "typescript/triple-slash-reference": "warn",
      "unicorn/no-await-in-promise-methods": "warn",
      "unicorn/no-empty-file": "warn",
      "unicorn/no-invalid-fetch-options": "warn",
      "unicorn/no-invalid-remove-event-listener": "warn",
      "unicorn/no-new-array": "warn",
      "unicorn/no-single-promise-in-promise-methods": "warn",
      "unicorn/no-thenable": "warn",
      "unicorn/no-unnecessary-await": "warn",
      "unicorn/no-useless-fallback-in-spread": "warn",
      "unicorn/no-useless-length-check": "warn",
      "unicorn/no-useless-spread": "warn",
      "unicorn/prefer-set-size": "warn",
      "unicorn/prefer-string-starts-ends-with": "warn",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    settings: {
      "jsx-a11y": {components: {}, attributes: {}},
      next: {rootDir: []},
      react: {formComponents: [], linkComponents: []},
      jsdoc: {
        ignorePrivate: false,
        ignoreInternal: false,
        ignoreReplacesDocs: true,
        overrideReplacesDocs: true,
        augmentsExtendsReplacesDocs: false,
        implementsReplacesDocs: false,
        exemptDestructuredRootsFromChecks: false,
        tagNamePreference: {},
      },
      vitest: {typecheck: false},
    },
    env: {builtin: true},
    globals: {},
    ignorePatterns: [],
    options: {typeAware: true, typeCheck: true},
    jsPlugins: [{name: "vite-plus", specifier: "vite-plus/oxlint-plugin"}],
  },
  resolve: {tsconfigPaths: true},
  plugins: [
    devtools(),
    stubBrowserOnlyInWorker,
    cloudflare({viteEnvironment: {name: "ssr"}}),
    tailwindcss(),
    tanstackStart({spa: {enabled: true, prerender: {outputPath: "/index"}}}),
    viteReact({compiler: true}),
    slimClientSourceMaps,
    posthogSourcemapsPlugin,
  ],
  build: {sourcemap: true},
  optimizeDeps: {
    exclude: ["@tanstack/start-server-core"],
    // Dependencies only reached through lazily loaded code: pre-bundle them at startup, so Vite
    // doesn't discover them mid-session and re-optimize (which reloads the page, and 504s
    // "Outdated Optimize Dep" when two dev servers share node_modules/.vite).
    include: [
      "recharts",
      "@number-flow/react",
      "@formkit/auto-animate/react",
      "frimousse",
      "html-to-image",
      "partytracks/client",
      "webrtc-adapter",
      "rxjs",
      "@univerjs/presets",
      "@univerjs/preset-sheets-core",
      "@univerjs/preset-sheets-core/locales/en-US",
      "@univerjs/preset-sheets-conditional-formatting",
      "@univerjs/preset-sheets-conditional-formatting/locales/en-US",
      "@univerjs/preset-sheets-data-validation",
      "@univerjs/preset-sheets-data-validation/locales/en-US",
      "@univerjs/preset-sheets-drawing",
      "@univerjs/preset-sheets-drawing/locales/en-US",
      "@univerjs/preset-sheets-filter",
      "@univerjs/preset-sheets-filter/locales/en-US",
      "@univerjs/preset-sheets-find-replace",
      "@univerjs/preset-sheets-find-replace/locales/en-US",
      "@univerjs/preset-sheets-hyper-link",
      "@univerjs/preset-sheets-hyper-link/locales/en-US",
      "@univerjs/preset-sheets-note",
      "@univerjs/preset-sheets-note/locales/en-US",
      "@univerjs/preset-sheets-sort",
      "@univerjs/preset-sheets-sort/locales/en-US",
      "@univerjs/preset-sheets-thread-comment",
      "@univerjs/preset-sheets-thread-comment/locales/en-US",
    ],
  },
  ssr: {optimizeDeps: {exclude: ["@tanstack/start-server-core"]}},
});

export default config;
