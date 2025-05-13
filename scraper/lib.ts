import puppeteer, { Page } from "puppeteer";
import type * as puppeteerr from "puppeteer";
import ProxyChain from "proxy-chain";
import { s3, BUCKET_NAME } from "./fetch-cacher";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { format } from "date-fns";
import { logger } from "@trigger.dev/sdk";
import { Stagehand } from "@browserbasehq/stagehand";
import StagehandConfig from "./trigger/stagehand.config";
import { AISdkClient } from "./trigger/lib/aisdk_client";
import { google } from "@ai-sdk/google";
import * as pw from "playwright";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

async function createProxyServer() {
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
  return server;
}

const BCAT_URL = "wss://api.browsercat.com/connect";
const LOCAL_BROWSER = process.env.LOCAL_BROWSER
  ? process.env.LOCAL_BROWSER === "true"
  : process.env.NODE_ENV === "development";

export async function createBrowserSession() {
  const server = await createProxyServer();
  let browser: puppeteerr.Browser;
  if (LOCAL_BROWSER) {
    browser = await puppeteer.launch({
      args: [`--proxy-server=localhost:8000`],
      headless: false,
    });
  } else {
    browser = await puppeteer.connect({
      browserWSEndpoint: BCAT_URL,
      headers: { "api-key": process.env.BROWSERCAT_API_KEY! },
    });
  }

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );

  await page.goto("https://api.ipify.org?format=json");
  const ip = await page.evaluate(() => {
    // @ts-ignore DOM
    return JSON.parse(document.body.textContent).ip;
  });
  console.info("Current IP address:", { ip });

  return {
    [Symbol.asyncDispose]: async () => {
      try {
        await browser.close();
      } catch (error) {
        logger.error("Error closing browser", { error });
        throw error;
      }
      try {
        await server.close(true);
      } catch (error) {
        logger.warn("Error closing server", { error });
      }
    },
    browser,
    page,
  };
}

export async function createPlaywrightSession() {
  let browser: pw.Browser;
  if (LOCAL_BROWSER) {
    browser = await pw.chromium.launch({
      headless: false,
    });
  } else {
    browser = await pw.chromium.connect(BCAT_URL, {
      headers: { "Api-Key": process.env.BROWSERCAT_API_KEY! },
    });
  }

  const page = await browser.newPage();

  return {
    [Symbol.asyncDispose]: async () => {
      await browser.close();
    },
    browser,
    page,
  };
}

export async function createStagehandSession() {
  // const server = await createProxyServer();
  const stagehand = new Stagehand({
    ...StagehandConfig,
    // localBrowserLaunchOptions: {
    //   args: [`--proxy-server=localhost:8000`],
    // },
    llmClient: new AISdkClient({
      model: google("gemini-2.0-pro-exp-02-05"),
    }),
  });
  await stagehand.init();

  return {
    [Symbol.asyncDispose]: async () => {
      await stagehand.close();
      // await server.close(true);
    },
    stagehand,
  };
}

export async function storeCacheData(
  key: string,
  suffix: string,
  data: string | Buffer | Uint8Array
) {
  logger.debug("Storing cache data", { key, suffix });
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${format(
        new Date(),
        "yyyy-MM-dd"
      )}/${key}/${new Date().toISOString()}${suffix}`,
      Body: data,
    })
  );
}

/**
 * Generates a simplified text description of an element's DOM tree,
 * prioritizing text content and alt attributes from images.
 * Reduces nested divs to a single div representation.
 */
export async function generateElementDescription(
  page: Page | pw.Page,
  selector: string
): Promise<string> {
  const evalFn = (selector: string) => {
    function generateElementDescriptionInner(element: Element): string {
      let description = "";

      const tagName = element.tagName.toLowerCase();

      const textNodes = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) =>
          node.textContent
            ?.trim()
            .replace(/[\u00A0\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, " ")
        )
        .filter((text) => text && text.length > 0);

      if (
        tagName === "div" &&
        element.children.length === 1 &&
        element.children[0].tagName === "div" &&
        typeof element.className === "string" &&
        !element.className.includes("logo")
      ) {
        return generateElementDescriptionInner(element.children[0]);
      } else {
        description += `<${tagName}`;

        if (tagName === "img") {
          const alt = element.getAttribute("alt");
          if (alt) {
            description += ` alt="${alt}"`;
          }
          const src = element.getAttribute("src");
          if (src) {
            description += ` src="${src}"`;
          }
        }

        if (
          typeof element.className === "string" &&
          element.className.includes("logo")
        ) {
          description += ` class="${element.className}"`;
        }

        description += ">";

        if (textNodes.length > 0) {
          description += ` "${textNodes.join(" ")}"`;
        }

        for (const child of Array.from(element.children)) {
          description += generateElementDescriptionInner(child);
        }
      }

      return description;
    }

    const element = document.querySelector(selector);
    if (!element) {
      return "";
    }
    return generateElementDescriptionInner(element);
  };

  if (page instanceof Page) {
    return await page.evaluate(evalFn, selector);
  }
  return await page.evaluate(evalFn, selector);
}

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});
