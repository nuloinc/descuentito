import {
  createBrowserSession,
  generateElementDescription,
  storeCacheData,
} from "../../lib";

export interface PageData {
  screenshot: Uint8Array;
  html: string;
  text: string;
  domDescription: string;
}

export async function fetchPageData(
  source: string,
  url: string,
  selector?: string
): Promise<PageData> {
  await using session = await createBrowserSession();
  const { page } = session;

  await page.goto(url, { waitUntil: "domcontentloaded" });

  if (selector) {
    await page.waitForSelector(selector);
  }

  const screenshot = await page.screenshot({ fullPage: true });
  await storeCacheData(source, ".png", screenshot);

  const elementToQuery = selector || "body";

  const html = await page.evaluate((selector) => {
    return document.querySelector(selector)?.innerHTML || "";
  }, elementToQuery);
  await storeCacheData(source, ".html", html);

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

  return { screenshot, html, text, domDescription };
}
