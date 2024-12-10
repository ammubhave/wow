import mdx from "@mdx-js/rollup";
import {
  fromNodeRequest,
  toNodeRequest,
} from "@remix-run/dev/dist/vite/node-adapter";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
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

          fetch(url, new Request(req, { redirect: "manual" })).then(
            async (res) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await toNodeRequest(res as any, nodeRes);
            },
          );
        });
      },
    },
    mdx(),
    react(),
    sentryVitePlugin({
      org: "wafflehaus-organized-workspace",
      project: "wow-frontend",
      sourcemaps: {
        filesToDeleteAfterUpload: ["dist/**/*.js.map"],
      },
      telemetry: false,
    }),
    tsconfigPaths(),
  ],
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
