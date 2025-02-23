import { logger, schedules } from "@trigger.dev/sdk/v3";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { generateObject } from "ai";
import {
  BasicPromotionSchema,
  JumboPromotion,
  LIMITS_PROMPT,
  PAYMENT_METHODS_PROMPT,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema";
import { savePromotions } from "../lib/git";
import {
  cleanup,
  createPlaywrightSession,
  createStagehandSession,
  generateElementDescription,
  storeCacheData,
} from "../lib";

const PromotionSchema = BasicPromotionSchema.extend({
  where: z.array(z.enum(["Jumbo", "Online"])),
});

export const jumboTask = schedules.task({
  id: "jumbo-extractor",
  cron: "0 0 * * *",
  maxDuration: 600,
  retry: {
    maxAttempts: 1,
  },
  run: async (payload, { ctx }) => {
    await using sessions = await createPlaywrightSession();
    const { page } = sessions;
    const url =
      "https://www.jumbo.com.ar/descuentos-del-dia?type=por-dia&day=1";

    await page.goto(url, {
      waitUntil: "networkidle",
    });

    const container = await page.$('ul:has(button:has-text("Lunes"))');
    if (!container)
      throw new Error("Could not find container with weekday buttons");

    const buttons = await container.$$("button");
    logger.info("Found weekday buttons", { count: buttons.length });

    const promotions: JumboPromotion[] = [];

    let i = 0;
    for (const button of buttons) {
      logger.info("Button text", { text: await button.textContent() });
      await button.click();
      await new Promise((resolve) => setTimeout(resolve, 500));

      const promotionEls = await page.$$(
        ".vtex-render__container-id-discounts-financing div:nth-of-type(3) ul li"
      );
      logger.info("Found promotion elements", { count: promotionEls.length });

      for (const promotionEl of promotionEls) {
        const verMasBtn = await promotionEl.$('div:has-text("Ver más") button');
        if (!verMasBtn) throw new Error("No ver más button found");
        await verMasBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 500));

        const screenshot = await promotionEl.screenshot();

        const text = await generateElementDescription(
          page,
          await promotionEl.evaluate((el, i) => {
            const allSimilar = document.querySelectorAll(
              `${el.tagName.toLowerCase()}${Array.from(el.attributes)
                .map((attr) => `[${attr.name}="${attr.value}"]`)
                .join("")}`
            );
            const index = Array.from(allSimilar).indexOf(el);
            return `${el.tagName.toLowerCase()}${Array.from(el.attributes)
              .map((attr) => `[${attr.name}="${attr.value}"]`)
              .join("")}:nth-of-type(${index + 1})`;
          })
        );
        logger.info("Text", { text });

        const { object } = await generateObject({
          model: google("gemini-2.0-flash"),
          schema: PromotionSchema,
          system: `You are a helpful assistant that extracts promotions from a text and converts them into structured JSON data with relevant information for argentinian users.

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

WHERE

"VÁLIDO EN COMPRAS PRESENCIALES" means the promotion is valid in physical stores ("Jumbo"), "ONLINE" means it's valid in online stores.

${LIMITS_PROMPT}
`,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Extract the promotions from the following screenshot, and the following text: \n\n" +
                    text,
                },
                { type: "image", image: screenshot },
              ],
            },
          ],
        });
        logger.info("Object", { object });
        promotions.push({
          ...object,
          source: "jumbo",
          url,
        });

        i++;
      }
    }

    const cleanedPromotions = await cleanup(
      "jumbo",
      promotions,
      PromotionSchema.extend({
        url: z.string(),
        source: z.literal("jumbo"),
      })
    );

    await savePromotions("jumbo", cleanedPromotions);
  },
});
