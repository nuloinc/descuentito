import { defineConfig } from "@trigger.dev/sdk";

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
      maxAttempts: 1,
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
      installPlaywrightChromium(),
    ],
    external: [
      "@libsql/client",
      "@libsql/darwin-arm64",
      "@libsql/linux-x64-gnu",
      "fsevents",
      "playwright",
      // https://github.com/microsoft/playwright/issues/35479
      "playwright-core",
    ],
  },
});

// https://trigger.dev/docs/guides/python/python-crawl4ai#features
export function installPlaywrightChromium() {
  return {
    name: "InstallPlaywrightChromium",
    onBuildComplete(context: any) {
      const instructions = [
        // Base and Chromium dependencies
        `RUN apt-get update && apt-get install -y --no-install-recommends \
          curl unzip npm libnspr4 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 \
          libasound2 libnss3 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
          libgbm1 libxkbcommon0 \
          && apt-get clean && rm -rf /var/lib/apt/lists/*`,

        // Install Playwright and Chromium
        `RUN npm install -g playwright`,
        `RUN mkdir -p /ms-playwright`,
        `RUN PLAYWRIGHT_BROWSERS_PATH=/ms-playwright npx playwright install --with-deps chromium chromium-headless-shell`,
      ];

      context.addLayer({
        id: "playwright",
        image: { instructions },
        deploy: {
          env: {
            PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright",
            PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
            PLAYWRIGHT_SKIP_BROWSER_VALIDATION: "1",
          },
          override: true,
        },
      });
    },
  };
}
