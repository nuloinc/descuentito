import logger from "./logger.ts";
import {
  createPlaywrightSession,
  generateElementDescription,
  storeCacheData,
} from "../../lib.ts";
import type { Page } from "playwright";

export interface PageData {
  screenshot: Buffer;
  text: string;
  domDescription: string;
  page: Page;
}

export async function waitForSelectorOrFail(
  page: Page,
  selector: string,
  source: string,
) {
  try {
    await page.waitForSelector(selector);
  } catch (error) {
    logger.error("Error waiting for selector", {
      selector,
      error,
    });
    await storeCacheData(
      source,
      "-failed.png",
      await page.screenshot({ fullPage: true }),
    );
    await storeCacheData(source, "-failed.html", (await getHtml(page)) || "");
    throw error;
  }
}

export async function getHtml(page: Page, selector?: string) {
  return await page.evaluate((selector) => {
    return (
      selector ? document.querySelector(selector) : document.documentElement
    )?.innerHTML;
  }, selector);
}
