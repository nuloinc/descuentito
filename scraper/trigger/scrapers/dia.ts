import logger from "../lib/logger";
import { z } from "zod";
import { streamObject } from "ai";
import {
  BasicDiscountSchema,
  DiaDiscount,
  genStartPrompt,
  LIMITS_PROMPT,
  PAYMENT_METHODS_PROMPT,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema";
import { createPlaywrightSession, storeCacheData } from "../../lib";
import assert from "node:assert";
import { openrouter } from "@openrouter/ai-sdk-provider";

const URL =
  "https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones";

interface ScrapedDiaPromotion {
  screenshot: Buffer;
  legalesText: string;
}

export async function scrapeDiaContent(): Promise<ScrapedDiaPromotion[]> {
  await using sessions = await createPlaywrightSession();
  const { page } = sessions; // Removed browser as it's not used directly here

  // desactivar popup de club dia
  await page.context().addCookies([
    {
      name: "clubdiapopup",
      value: "true",
      domain: "diaonline.supermercadosdia.com.ar",
      path: "/",
      secure: false,
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  await page.goto(URL, {
    waitUntil: "domcontentloaded",
  });
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const elements = await page.$$(
    ".diaio-custom-bank-promotions-0-x-list-by-days__item"
  );

  const scrapedPromotions: ScrapedDiaPromotion[] = [];

  const closeModal = async () => {
    await (await page.$(".vtex-modal__close-icon"))?.click();
  };

  let i = 0;
  for (const element of elements) {
    await closeModal();
    const screenshot = await element.screenshot();
    await storeCacheData("dia", `-element${i}.png`, screenshot);

    const legalBtn = await element.$(
      ".diaio-custom-bank-promotions-0-x-bank-modal__button"
    );
    if (!legalBtn) throw new Error("No legal button found");
    await legalBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const legalesText: string =
      (await (
        await page.$(".diaio-custom-bank-promotions-0-x-bank-modal__text")
      )?.textContent()) || "";
    if (!legalesText) throw new Error("No legal text found");

    await closeModal();
    /////////////////
    scrapedPromotions.push({ screenshot, legalesText });
    i++;
  }
  return scrapedPromotions;
}

export async function extractDiaDiscounts(
  scrapedPromotions: ScrapedDiaPromotion[]
) {
  let promotions: DiaDiscount[] = [];
  for (const { screenshot, legalesText } of scrapedPromotions) {
    const { elementStream } = streamObject({
      model: openrouter.chat("google/gemini-2.5-flash-preview"),
      schema: BasicDiscountSchema.extend({
        where: z.array(z.enum(["Dia", "Online"])),
      }),
      output: "array",
      system: `${genStartPrompt("dia")}

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
              text:
                "Extract the promotions from the following screenshot, and the following legal text: \n\n" +
                legalesText,
            },
            { type: "image", image: screenshot },
          ],
        },
      ],
    });
    for await (const object of elementStream) {
      promotions.push({
        ...object,
        source: "dia",
        url: URL,
      });
    }
  }

  assert(promotions.length > 0, "No promotions found");

  return promotions;
}

// Backward compatibility function
export async function scrapeDia() {
  const contentData = await scrapeDiaContent();
  return await extractDiaDiscounts(contentData);
}
