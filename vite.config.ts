import mdx from "@mdx-js/rollup";
import { vitePlugin as remix } from "@remix-run/dev";
import {
  fromNodeRequest,
  toNodeRequest,
} from "@remix-run/dev/dist/vite/node-adapter";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";
import { cjsInterop } from "vite-plugin-cjs-interop";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  optimizeDeps: {
    entries: ["./app/**/*.ts", "./app/**/*.tsx"],
  },
  plugins: [
    cjsInterop({
      dependencies: ["@kinde-oss/kinde-auth-react"],
    }),
    {
      name: "cloudflare-proxy",
      async configureServer(server) {
        server.middlewares.use((nodeReq, nodeRes, next) => {
          if (
            !nodeReq.url?.startsWith("/api/") &&
            !nodeReq.url?.startsWith("/healthz")
          ) {
            return next();
          }
          const req = fromNodeRequest(nodeReq, nodeRes);
          req.headers.set("accept-encoding", "identity");
          const url = new URL(req.url);
          url.host = "localhost:8787";
          url.protocol = "http";
          fetch(url, req).then(async (res) => {
            await toNodeRequest(res as any, nodeRes);
          });
        });
      },
    },
    {
      enforce: "pre",
      ...mdx(),
    },
    remix({
      ssr: false,
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    sentryVitePlugin({
      org: "wafflehaus-organized-workspace",
      project: "wow-frontend",
      sourcemaps: {
        filesToDeleteAfterUpload: ["build/client/**/*.js.map"],
      },
      telemetry: false,
    }),
    tsconfigPaths(),
  ],
  build: {
    sourcemap: true,
  },
});
