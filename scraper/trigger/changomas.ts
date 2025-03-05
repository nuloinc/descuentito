import { logger, schedules } from "@trigger.dev/sdk/v3";
import { google } from "@ai-sdk/google";
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
import { savePromotions } from "../lib/git";
import assert from "assert";
import { createPlaywrightSession } from "../lib";

const DiscountSchema = BasicDiscountSchema.extend({
  where: z.array(z.enum(["ChangoMas", "MasOnline"])),
  membership: z.array(z.enum(["MasClub"])).optional(),
});

export const changomasTask = schedules.task({
  id: "changomas-extractor",
  maxDuration: 300,
  retry: {
    maxAttempts: 3,
  },
  run: async (payload, { ctx }) => {
    const URL = "https://www.masonline.com.ar/promociones-bancarias";
    await using sessions = await createPlaywrightSession();
    const { page } = sessions;

    await page.goto(URL, {
      waitUntil: "networkidle",
    });

    await page.waitForSelector(
      "li a.valtech-gdn-banks-promotions-0-x-menuItem"
    );
    const menuItem = await page.locator(
      "li a.valtech-gdn-banks-promotions-0-x-menuItem",
      {
        hasText: "Por Banco/Tarjeta",
      }
    );
    await menuItem.click();

    await page.waitForSelector(".valtech-gdn-banks-promotions-0-x-dateText");

    const elements = await page.$$(".valtech-gdn-banks-promotions-0-x-cardBox");

    let promotions: ChangoMasDiscount[] = [];

    for (const element of elements) {
      const screenshot = await element.screenshot();
      const html = await element.evaluate((el) => el.outerHTML);

      const { elementStream } = await streamObject({
        model: google("gemini-2.0-flash"),
        output: "array",
        schema: DiscountSchema,
        temperature: 0,
        system: `${genStartPrompt("ChangoMas")}

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

## WHERE

"Pagando:" describes WHERE the discount is valid. "Sucursal" is for ChangoMas, "MasOnline" is for MasOnline.

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
        logger.info("Element", { element });
        promotions.push({
          ...element,
          url: URL,
          source: "changomas",
        });
      }
    }

    assert(promotions.length > 10, "No promotions found");

    await savePromotions("changomas", promotions);
  },
});
