import { logger } from "@trigger.dev/sdk/v3";
import {
  createBrowserSession,
  generateElementDescription,
  storeCacheData,
} from "../../lib.js";
import { Page } from "puppeteer";

export interface PageData {
  screenshot: Uint8Array;
  text: string;
  domDescription: string;
}

export async function fetchPageData(
  source: string,
  url: string,
  {
    selector,
    waitForSelector,
  }: {
    selector?: string;
    waitForSelector?: string;
  } = {}
): Promise<PageData> {
  await using session = await createBrowserSession();
  const { page } = session;

  await page.goto(url, { waitUntil: "domcontentloaded" });

  if (waitForSelector) {
    try {
      await page.waitForSelector(waitForSelector, {});
    } catch (error) {
      logger.error("Error waiting for selector", {
        waitForSelector,
        error,
      });
      await storeCacheData(
        source,
        "-failed.png",
        await page.screenshot({ fullPage: true })
      );
      await storeCacheData(source, "-failed.html", (await getHtml(page)) || "");
      throw error;
    }
  }

  const screenshot = await page.screenshot({ fullPage: true });
  await storeCacheData(source, ".png", screenshot);

  const elementToQuery = selector || "body";

  await storeCacheData(
    source,
    ".html",
    (await getHtml(page, elementToQuery)) || ""
  );

  await page.exposeFunction(
    "generateElementDescription",
    generateElementDescription
  );

  const domDescription = await generateElementDescription(page, elementToQuery);
  await storeCacheData(source, "-dom.txt", domDescription);

  const text = await page.evaluate((selector) => {
    return document.querySelector(selector)?.textContent || "";
  }, elementToQuery);
  await storeCacheData(source, ".txt", text);

  return { screenshot, text, domDescription };
}

export async function getHtml(page: Page, selector?: string) {
  return await page.evaluate((selector) => {
    return (
      selector ? document.querySelector(selector) : document.documentElement
    )?.innerHTML;
  }, selector);
}
