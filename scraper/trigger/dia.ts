import { logger, schedules } from "@trigger.dev/sdk/v3";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { generateObject } from "ai";
import {
  BasicPromotionSchema,
  DiaPromotion,
  LIMITS_PROMPT,
  PAYMENT_METHODS_PROMPT,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema";
import { savePromotions } from "../lib/git";
import { createStagehandSession, storeCacheData } from "../lib";

export const diaTask = schedules.task({
  id: "dia-extractor",
  cron: "0 0 * * *",
  maxDuration: 300,
  retry: {
    maxAttempts: 1,
  },
  run: async (payload, { ctx }) => {
    await using sessions = await createStagehandSession();
    const {stagehand} = sessions;

    // desactivar popup de club dia
    await stagehand.context.addCookies([{
      name: "clubdiapopup",
      value: "true",
      domain: "diaonline.supermercadosdia.com.ar",
      path: "/",
      secure: false,
      httpOnly: false,
      sameSite: "Lax"
    }]);

    await stagehand.page.goto("https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones");

    const elements = await stagehand.page.$$(
      ".diaio-custom-bank-promotions-0-x-list-by-days__item"
    );

    let promotions: DiaPromotion[] = [];

    const closeModal = async () => {
      await (
        await stagehand.page.$(".vtex-modal__close-icon")
      )?.click();
    };

    let i = 0;
    for (const element of elements) {
      await closeModal();
      const screenshot = await element.screenshot();
      await storeCacheData("dia", `-element${i}.png`, screenshot);

      const legalBtn = await element.$('.diaio-custom-bank-promotions-0-x-bank-modal__button')
      if (!legalBtn) throw new Error("No legal button found");
      await legalBtn.click()
      await new Promise(resolve => setTimeout(resolve, 1000));

      const legalesText:string =await(await stagehand.page.$('.diaio-custom-bank-promotions-0-x-bank-modal__text'))?.textContent() || ''
      if (!legalesText) throw new Error("No legal text found");
      logger.info("Legal text", { legalesText });

      await closeModal()
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
                text: "Extract the promotions from the following screenshot, and the following legal text: \n\n" + legalesText,
              },
              { type: "image", image: screenshot },
              // { type: "image", image: legalesScreenshot },
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
