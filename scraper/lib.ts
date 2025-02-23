import puppeteer, { Page } from "puppeteer";
import ProxyChain from "proxy-chain";
import { s3, BUCKET_NAME } from "./fetch-cacher";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { format } from "date-fns";
import { logger } from "@trigger.dev/sdk/v3";
import { Stagehand } from "@browserbasehq/stagehand";
import StagehandConfig from "./trigger/stagehand.config";
import { AISdkClient } from "./trigger/lib/aisdk_client";
import { google } from "@ai-sdk/google";
import * as pw from "playwright-core";
import { Promotion, Source } from "promos-db/schema";
import { z, ZodSchema } from "zod";
import { streamObject } from "ai";

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

export async function createBrowserSession() {
  const server = await createProxyServer();
  // const browser = await puppeteer.connect({
  //   browserURL: `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}`,
  // });
  const browser = await puppeteer.launch({
    args: [`--proxy-server=localhost:8000`],
    headless: process.env.NODE_ENV === "development" ? false : true,
  });

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
      await browser.close();
      await server.close(true);
    },
    browser,
    page,
  };
}

export async function createPlaywrightSession() {
  let browser: pw.Browser;
  if (process.env.NODE_ENV === "development") {
    browser = await pw.chromium.launch({
      headless: false,
    });
  } else {
    const bcatUrl = "wss://api.browsercat.com/connect";
    browser = await pw.chromium.connect(bcatUrl, {
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

      // Handle current element
      const tagName = element.tagName.toLowerCase();

      // Handle text nodes directly within the element
      const textNodes = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim())
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
        // For non-div elements, build the description as before
        description += `<${tagName}`;

        // Add alt attribute for images
        if (tagName === "img") {
          const alt = element.getAttribute("alt");
          if (alt) {
            description += ` alt="${alt}"`;
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

        // Recursively process child elements
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

export async function cleanup<T extends Promotion>(
  source: Source,
  promotions: T[],
  zodSchema: ZodSchema<T>
) {
  logger.info("Cleaning up promotions", { source, promotions });
  const oldPromotions = await fetch(
    `https://raw.githubusercontent.com/nuloinc/descuentito-data/refs/heads/main/${source}.json`
  )
    .then((res) => res.json())
    .catch(() => []);

  logger.info("Old promotions", {
    oldPromotions,
    length: oldPromotions.length,
  });

  let newPromotions: T[] = [];

  const { elementStream } = streamObject({
    model: google("gemini-2.0-pro-exp-02-05"),
    output: "array",
    schema: zodSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Here's the previous promotion array: ${JSON.stringify(
              oldPromotions
            )}.\n\n Extract the promotions from the following JSON: ${promotions.map((p) => JSON.stringify(p)).join("\n")}.`,
          },
        ],
      },
    ],
    system: `You are a helpful assistant that cleans up promotions from existing structured JSON data. If the promotion is already in the previous array, copy the previous promotion without any changes unless there's a meaningful change.`,
  });

  for await (const element of elementStream) {
    newPromotions.push(element);
  }

  return newPromotions;
}
