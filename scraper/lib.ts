import { s3, BUCKET_NAME } from "./fetch-cacher.ts";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { format } from "date-fns";
import logger from "./trigger/lib/logger.ts";
import { chromium, Page, Browser, ElementHandle } from "playwright-core";
import { nanoid } from "nanoid";
import { generateText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";

const PROXY_URL = process.env.PROXY_URI
  ? new URL(process.env.PROXY_URI)
  : undefined;

if (PROXY_URL) console.log(`--> Using proxy at ${PROXY_URL.hostname}`);

const BCAT_URL = "wss://api.browsercat.com/connect";
const LOCAL_BROWSER = process.env.LOCAL_BROWSER
  ? process.env.LOCAL_BROWSER === "true"
  : true;
console.log(`--> Using ${LOCAL_BROWSER ? "LOCAL" : "REMOTE"} browser`);
const HEADLESS = process.env.HEADLESS === "false" ? false : true;
if (LOCAL_BROWSER)
  console.log(`--> Running ${HEADLESS ? "HEADLESSLY" : "HEADFULLY"}`);

export async function createPlaywrightSession({
  useProxy = false,
}: {
  useProxy?: boolean;
} = {}) {
  let browser: Browser;

  if (LOCAL_BROWSER) {
    browser = await chromium.launch({
      headless: HEADLESS,
      proxy: useProxy
        ? {
            server: `${PROXY_URL?.protocol}//${PROXY_URL?.host}`,
            username: PROXY_URL?.username,
            password: PROXY_URL?.password,
          }
        : undefined,
    });
  } else {
    browser = await chromium.connect(BCAT_URL, {
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

export async function storeCacheData(
  key: string,
  suffix: string,
  data: string | Buffer | Uint8Array,
) {
  logger.debug("Storing cache data", { key, suffix });
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${format(
        new Date(),
        "yyyy-MM-dd",
      )}/${key}/${new Date().toISOString()}${suffix}`,
      Body: data,
    }),
  );
}

/**
 * Generates a simplified text description of an element's DOM tree,
 * prioritizing text content and alt attributes from images.
 * Reduces nested divs to a single div representation.
 */
export async function generateElementDescription(
  page: Page,
  selector: string,
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
            .replace(/[\u00A0\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, " "),
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

  return await page.evaluate(evalFn, selector);
}

export async function generateElementDescriptionFromElement(
  page: Page,
  element: ElementHandle<HTMLElement | SVGElement>,
): Promise<string> {
  const id = nanoid();
  await element.evaluate((element, id) => {
    element.setAttribute("data-id", id);
  }, id);
  return await generateElementDescription(page, `[data-id="${id}"]`);
}

/**
 * Transcribes text from an image URL using Gemini 2.5 Flash Lite
 */
export async function transcribeImage(imageUrl: string): Promise<string> {
  try {
    console.log("Transcribing image:", imageUrl);
    const response = await fetch(imageUrl);
    const imageBuffer = await response.arrayBuffer();
    const { text } = await generateText({
      model: openrouter.chat("google/gemini-2.5-flash-lite-preview-06-17"),
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "transcribe all the text in this image. just output the text.",
            },
            {
              type: "image",
              image: imageBuffer,
            },
          ],
        },
      ],
    });

    return text.trim();
  } catch (error) {
    logger.warn("Failed to transcribe image:", { imageUrl, error });
    return "";
  }
}
