import { defineConfig } from "@trigger.dev/sdk/v3";

import { puppeteer } from "@trigger.dev/build/extensions/puppeteer";
import { additionalPackages } from "@trigger.dev/build/extensions/core";
export default defineConfig({
  project: "proj_wghcrdvyxvmsbgsmfufc",
  runtime: "node",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 600,
  machine: "medium-1x",
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["trigger"],
  build: {
    extensions: [
      puppeteer(),
      additionalPackages({ packages: ["@libsql/linux-x64-gnu"] }),
      {
        name: "PlaywrightExtension",
        onBuildComplete: async (context, manifest) => {
          if (context.target === "dev") {
            return;
          }

          const instructions = [`RUN npx playwright install --with-deps`];

          context.addLayer({
            id: "puppeteer",
            image: {
              instructions,
            },
          });
        },
      },
    ],
    external: [
      "@libsql/client",
      "@libsql/darwin-arm64",
      "@libsql/linux-x64-gnu",
      "fsevents",
      "playwright",
    ],
  },
});
