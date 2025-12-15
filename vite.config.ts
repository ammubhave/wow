import {cloudflare} from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import {devtools} from "@tanstack/devtools-vite";
import {tanstackStart} from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import {defineConfig} from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
  plugins: [
    devtools(),
    cloudflare({viteEnvironment: {name: "ssr"}}),
    viteTsConfigPaths({projects: ["./tsconfig.json"]}),
    tailwindcss(),
    tanstackStart({spa: {enabled: true}}),
    viteReact(),
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[hash].js",
        chunkFileNames: "assets/[hash].js",
        assetFileNames: "assets/[hash].[ext]",
      },
    },
  },
});

export default config;
