import { z } from "zod";
import { streamObject } from "ai";
import {
  BasicDiscountSchema,
  ChangoMasDiscount,
  genStartPrompt,
  LIMITS_PROMPT,
  PAYMENT_METHODS_PROMPT,
  PRODUCTS_PROMPT,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema";
import assert from "assert";
import { createPlaywrightSession } from "../../lib";
import { openrouter } from "@openrouter/ai-sdk-provider";

const DiscountSchema = BasicDiscountSchema.extend({
  where: z.array(z.enum(["ChangoMas", "Online"])),
  membership: z.array(z.enum(["MasClub"])).optional(),
});

const URL = "https://www.masonline.com.ar/promociones-bancarias?banco=Todas";

export async function scrapeChangoMasContent() {
  await using sessions = await createPlaywrightSession();
  const { page } = sessions;

  await page.goto(URL, {
    waitUntil: "domcontentloaded",
  });
  await new Promise((resolve) => setTimeout(resolve, 500));

  await page.waitForSelector("li a.valtech-gdn-banks-promotions-0-x-menuItem");
  const menuItem = page.locator(
    "li a.valtech-gdn-banks-promotions-0-x-menuItem",
    {
      hasText: "Por Banco/Tarjeta",
    }
  );
  await menuItem.click();

  const todasButton = page.locator(
    ".valtech-gdn-banks-promotions-0-x-bankButton",
    {
      hasText: "Todas",
    }
  );
  await todasButton.click();

  await page.waitForSelector(".valtech-gdn-banks-promotions-0-x-dateText", {
    timeout: 15000,
  });

  const elements = await page.$$(".valtech-gdn-banks-promotions-0-x-cardBox");

  const scrapedData = [];
  for (const element of elements) {
    const screenshot = await element.screenshot();
    const html = await element.evaluate((el: Element) => el.outerHTML);
    scrapedData.push({ html, screenshot });
  }
  return scrapedData;
}

export async function extractChangoMasDiscounts(
  scrapedData: { html: string; screenshot: Buffer }[]
) {
  let promotions: ChangoMasDiscount[] = [];

  for (const data of scrapedData) {
    const { html, screenshot } = data;
    const { elementStream } = await streamObject({
      model: openrouter.chat("google/gemini-2.5-flash-preview"),
      output: "array",
      schema: DiscountSchema,
      temperature: 0,
      experimental_telemetry: { isEnabled: true },
      system: `${genStartPrompt("ChangoMas")}

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

## WHERE

"Pagando:" describes WHERE the discount is valid. "Sucursal" is for ChangoMas, "MasOnline" is for Online.

${PRODUCTS_PROMPT}

${LIMITS_PROMPT}
`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extract the promotion from the following html and screenshot: \n\n" +
                html,
            },
            { type: "image", image: screenshot },
          ],
        },
      ],
    });

    for await (const element of elementStream) {
      promotions.push({
        ...element,
        url: URL,
        source: "changomas",
      });
    }
  }

  assert(promotions.length > 10, "No promotions found");

  return promotions;
}

// Backward compatibility function
export async function scrapeChangoMas() {
  const contentData = await scrapeChangoMasContent();
  return await extractChangoMasDiscounts(contentData);
}
