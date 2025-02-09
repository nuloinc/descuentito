import { logger, schedules, wait } from "@trigger.dev/sdk/v3";
import puppeteer from "puppeteer";
export const firstScheduledTask = schedules.task({
  id: "first-scheduled-task",
  cron: "0 * * * *",
  maxDuration: 300,
  run: async (payload, { ctx }) => {
    const ProxyChain = require("proxy-chain");

    const server = new ProxyChain.Server({
      port: 8000,
      host: "localhost",
      prepareRequestFunction: ({}) => {
        return {
          upstreamProxyUrl: `${process.env.PROXY_URI}`,
        };
      },
    });

    await new Promise((resolve) =>
      server.listen(() => {
        resolve(true);
      })
    );

    const browser = await puppeteer.launch({
      args: [`--proxy-server=localhost:8000`],
    });
    const context = await browser.createBrowserContext({});
    const page = await context.newPage();

    // Get IP address
    await page.goto("https://api.ipify.org?format=json");
    const ip = await page.evaluate(() => {
      // @ts-ignore DOM
      return JSON.parse(document.body.textContent).ip;
    });
    logger.info("Current IP address:", { ip });

    await page.goto("https://www.google.com");
    await page.screenshot({ path: "screenshot.png" });
    // Get the page title
    const title = await page.title();
    logger.info("Page title:", { title });

    // Get all links on the page
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a"), (a) => a.href);
    });
    logger.info("Found links:", { length: links.length });

    // Get the search box text
    const searchBoxText = await page.evaluate(() => {
      const searchInput = document.querySelector('input[name="q"]');
      return searchInput ? searchInput.getAttribute("aria-label") : null;
    });
    logger.info("Search box label:", { searchBoxText });
    await browser.close();
  },
});
