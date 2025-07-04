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
import {
  createPlaywrightSession,
  generateElementDescriptionFromElement,
} from "../../lib";
import assert from "node:assert";
import { openrouter } from "@openrouter/ai-sdk-provider";

const URL =
  "https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones";

interface ScrapedDiaPromotion {
  domDescription: string;
  legalesText: string;
}



export async function scrapeDiaContent(): Promise<ScrapedDiaPromotion[]> {
  await using sessions = await createPlaywrightSession();
  const { page } = sessions;

  console.log(`🌐 Scraping DIA promotions from: ${URL}`);

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
  await new Promise((resolve) => setTimeout(resolve, 500));

  await page.waitForSelector(
    ".diaio-custom-bank-promotions-0-x-list-by-days__item",
  );
  const elements = await page.$$(
    ".diaio-custom-bank-promotions-0-x-list-by-days__item",
  );

  console.log(`🔍 Found ${elements.length} promotion elements to scrape`);
  
  const scrapedPromotions: ScrapedDiaPromotion[] = [];

  const closeModal = async () => {
    await (await page.$(".vtex-modal__close-icon"))?.click();
  };

  let i = 0;
  for (const element of elements) {
    await closeModal();
    const domDescription = await generateElementDescriptionFromElement(
      page,
      element,
    );

    const legalBtn = await element.$(
      ".diaio-custom-bank-promotions-0-x-bank-modal__button",
    );
    if (!legalBtn) {
      console.warn(`⚠️  No legal button found for element ${i + 1}`);
      continue;
    }
    
    await legalBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const legalesText: string =
      (await (
        await page.$(".diaio-custom-bank-promotions-0-x-bank-modal__text")
      )?.textContent()) || "";
    
    if (!legalesText) {
      console.warn(`⚠️  No legal text found for element ${i + 1}`);
    }

    await closeModal();
    
    scrapedPromotions.push({ domDescription, legalesText });
    console.log(`✅ Scraped promotion ${i + 1}/${elements.length}`);
    i++;
  }
  
  console.log(`🎉 Successfully scraped ${scrapedPromotions.length} DIA promotions`);
  return scrapedPromotions;
}

export async function extractDiaDiscounts(
  scrapedPromotions: ScrapedDiaPromotion[],
): Promise<DiaDiscount[]> {
  console.log(`🤖 Using OpenRouter LLM to extract discounts from ${scrapedPromotions.length} promotions`);
  
  let promotions: DiaDiscount[] = [];
  for (const { domDescription, legalesText } of scrapedPromotions) {
    const { elementStream } = streamObject({
      model: openrouter.chat("google/gemini-2.5-flash-preview-05-20"),
      schema: BasicDiscountSchema.extend({
        where: z.array(z.enum(["Dia", "Online"])),
      }),
      output: "array",
      experimental_telemetry: { isEnabled: true },
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
                "Extract the promotions from the following DOM description, and the following legal text: \n\n" +
                "DOM Description:\n" +
                domDescription +
                "\n\nLegal Text:\n" +
                legalesText,
            },
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
  console.log(`✅ LLM extracted ${promotions.length} DIA discounts`);

  return promotions;
}

// Backward compatibility function
export async function scrapeDia() {
  const contentData = await scrapeDiaContent();
  return await extractDiaDiscounts(contentData);
}
