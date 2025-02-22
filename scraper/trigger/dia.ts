import { logger, schedules } from "@trigger.dev/sdk/v3";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { generateObject } from "ai";
import {
  BasicPromotionSchema,
  CotoPromotion,
  DiaPromotion,
  LIMITS_PROMPT,
  PAYMENT_METHODS_PROMPT,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema";
import {
  fetchPageData,
  fetchPageDataFromPage,
  waitForSelectorOrFail,
} from "./lib/fetch-page";
import { savePromotions } from "../lib/git";
import { createBrowserSession, storeCacheData } from "../lib";

export const diaTask = schedules.task({
  id: "dia-extractor",
  cron: "0 0 * * *",
  maxDuration: 300,
  retry: {
    maxAttempts: 1,
  },
  run: async (payload, { ctx }) => {
    await using session = await createBrowserSession();
    const { page } = session;
    await fetchPageDataFromPage(
      page,
      "https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones",
      {
        selector: ".diaio-custom-bank-promotions-0-x-list-by-days__item",
        source: "dia",
      }
    );

    const elements = await page.$$(
      ".diaio-custom-bank-promotions-0-x-list-by-days__item"
    );

    let promotions: DiaPromotion[] = [];

    // close legal modal OR close annoying promo modal
    const close = async (wait: boolean = false) => {
      await (
        await page[wait ? "waitForSelector" : "$"](".vtex-modal__close-icon")
      )?.click();
    };

    let i = 0;
    for (const element of elements) {
      await close();
      const screenshot = await element.screenshot();
      await storeCacheData("dia", `-element${i}.png`, screenshot);

      await close();
      await page.click(".diaio-custom-bank-promotions-0-x-bank-modal__button");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const legalesScreenshot = await page.screenshot();
      await storeCacheData("dia", `-legales${i}.png`, legalesScreenshot);

      await close();

      /////////////////

      const { object } = await generateObject({
        model: google("gemini-2.0-flash"),
        schema: BasicPromotionSchema.extend({
          where: z.array(z.enum(["Dia", "Online"])),
        }),
        system: `You are a helpful assistant that extracts promotions from a text and converts them into structured JSON data with relevant information for argentinian users.

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

WHERE

"APLICA TIENDA" means the promotion is valid in physical stores ("Dia"), "APLICA ONLINE" means it's valid in online stores.

${LIMITS_PROMPT}
`,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the promotions from the following screenshot, and the following legal text: ",
              },
              { type: "image", image: screenshot },
              { type: "image", image: legalesScreenshot },
            ],
          },
        ],
      });
      logger.info("Object", { object });
      promotions.push({
        ...object,
        source: "dia",
        url: "https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones",
      });

      /////////////////

      i++;
    }

    await savePromotions("dia", promotions);
  },
});
