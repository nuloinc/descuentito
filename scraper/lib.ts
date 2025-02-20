import puppeteer, { Page } from "puppeteer";
import ProxyChain from "proxy-chain";
import { s3, BUCKET_NAME } from "./fetch-cacher";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { format } from "date-fns";

export async function createBrowserSession() {
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

export async function storeCacheData(
  key: string,
  suffix: string,
  data: string | Buffer | Uint8Array
) {
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
  page: Page,
  selector: string
): Promise<string> {
  return await page.evaluate((selector: string) => {
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
  }, selector);
}
