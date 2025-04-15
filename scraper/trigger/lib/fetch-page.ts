import { logger } from "@trigger.dev/sdk";
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
  page: Page;
}

export async function waitForSelectorOrFail(
  page: Page,
  selector: string,
  source: string
) {
  try {
    await page.waitForSelector(selector, {});
  } catch (error) {
    logger.error("Error waiting for selector", {
      selector,
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

export async function fetchPageDataFromPage(
  page: Page,
  url: string,
  {
    selector,
    waitForSelector,
    source,
  }: {
    selector?: string;
    waitForSelector?: string;
    source: string;
  }
) {
  await page.goto(url, { waitUntil: "domcontentloaded" });

  if (waitForSelector) {
    await waitForSelectorOrFail(page, waitForSelector, source);
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

  return { screenshot, text, domDescription, page };
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
  return await fetchPageDataFromPage(page, url, {
    selector,
    waitForSelector,
    source,
  });
}

export async function getHtml(page: Page, selector?: string) {
  return await page.evaluate((selector) => {
    return (
      selector ? document.querySelector(selector) : document.documentElement
    )?.innerHTML;
  }, selector);
}
