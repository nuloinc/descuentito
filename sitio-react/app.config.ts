import { defineConfig } from "@tanstack/react-start/config";
import tsConfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "unenv";

export default defineConfig({
  tsr: {
    appDirectory: "app",
  },
  server: {
    preset: "cloudflare-pages",
    unenv: cloudflare,
  },
  vite: {
    build: {
      sourcemap: true,
    },
    plugins: [
      tsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
    ],
  },
});
