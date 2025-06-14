import logger from "../lib/logger";
import { z } from "zod";
import { streamObject } from "ai";
import {
  BANKS_OR_WALLETS,
  BasicDiscountSchema,
  genStartPrompt,
  JumboDiscount,
  LIMITS_PROMPT,
  PAYMENT_METHODS_PROMPT,
  PaymentMethod,
  PRODUCTS_PROMPT,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema";
import { createPlaywrightSession, generateElementDescription } from "../../lib";
import { cleanDiscounts } from "../../lib/clean";
import { openrouter } from "@openrouter/ai-sdk-provider";

interface ScrapedPromotion {
  text: string;
  weekdayIndex: number;
}

const URL = "https://www.jumbo.com.ar/descuentos-del-dia?type=por-dia&day=1";

export async function scrapeJumboContent() {
  await using sessions = await createPlaywrightSession();
  const { page } = sessions;

  await page.goto(URL, {
    waitUntil: "domcontentloaded",
  });

  const container = await page.$('ul:has(button:has-text("Lunes"))');
  if (!container)
    throw new Error("Could not find container with weekday buttons");

  const buttons = await container.$$("button");

  // Step 1: Scrape all promotions first
  const scrapedPromotions: ScrapedPromotion[] = [];

  for (let weekdayIndex = 0; weekdayIndex < buttons.length; weekdayIndex++) {
    const button = buttons[weekdayIndex];
    await button.click();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const promotionEls = await page.$$(
      ".vtex-render__container-id-discounts-financing div:nth-of-type(3) ul li",
    );

    for (const promotionEl of promotionEls) {
      const verMasBtn = await promotionEl.$('div:has-text("Ver más") button');
      if (!verMasBtn) throw new Error("No ver más button found");
      await verMasBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 500));

      const text = await generateElementDescription(
        page,
        await promotionEl.evaluate((el: Element) => {
          const allSimilar = document.querySelectorAll(
            `${el.tagName.toLowerCase()}${Array.from(el.attributes)
              .map((attr) => `[${attr.name}="${attr.value}"]`)
              .join("")}`,
          );
          const index = Array.from(allSimilar).indexOf(el);
          return `${el.tagName.toLowerCase()}${Array.from(el.attributes)
            .map((attr) => `[${attr.name}="${attr.value}"]`)
            .join("")}:nth-of-type(${index + 1})`;
        }),
      );

      scrapedPromotions.push({
        text,
        weekdayIndex,
      });
    }
  }

  logger.info(
    `Scraped ${scrapedPromotions.length} promotions, now processing with LLM`,
  );

  return scrapedPromotions;
}

export async function extractJumboDiscounts(
  scrapedPromotions: ScrapedPromotion[],
) {
  logger.info(
    `Processing ${scrapedPromotions.length} scraped promotions with LLM`,
  );

  // Step 2: Process with LLM in parallel
  const discountsMap = new Map<number, JumboDiscount[]>();
  await Promise.all(
    scrapedPromotions.map(async (promotion) => {
      const { text, weekdayIndex } = promotion;

      const { elementStream } = streamObject({
        model: openrouter.chat("google/gemini-2.5-flash-preview-05-20"),
        output: "array",
        schema: BasicDiscountSchema.extend({
          where: z.array(z.enum(["Jumbo", "Online"])),
          membership: z.array(z.enum(["Clarin 365"])).optional(),
        }),
        experimental_telemetry: { isEnabled: true },
        system: `${genStartPrompt("Jumbo")} Jumbo is part of the Cencosud group.

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

${PRODUCTS_PROMPT}

## WHERE

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
                  "Extract the discounts from the following text: \n\n" + text,
              },
            ],
          },
        ],
      });

      // Create array for this weekday if it doesn't exist
      if (!discountsMap.has(weekdayIndex)) {
        discountsMap.set(weekdayIndex, []);
      }

      for await (const generatedDiscount of elementStream) {
        const previousDaysDiscounts = Array.from(discountsMap.values())
          .slice(0, weekdayIndex)
          .flat();

        // hack porque iteramos por cada dia de semana, entonces los descuentos que estan en varios dias de semana se repiten
        // lo hacemos sobre un array de los descuentos de los dias anteriores para no tener falsos positivos sobre descuentos del mismo banco pero de distinto tipo
        const existingDiscount = previousDaysDiscounts.find(
          (p) =>
            (p.weekdays
              ? p.weekdays.every((day) =>
                  generatedDiscount.weekdays?.includes(day),
                )
              : !generatedDiscount.weekdays) &&
            p.where?.every((where) =>
              generatedDiscount.where?.includes(where),
            ) &&
            p.limits?.maxDiscount === generatedDiscount.limits?.maxDiscount &&
            p.discount.value === generatedDiscount.discount.value &&
            p.paymentMethods &&
            generatedDiscount.paymentMethods &&
            getBankOrWallet(p.paymentMethods) ===
              getBankOrWallet(generatedDiscount.paymentMethods),
        );

        if (existingDiscount) {
          logger.info("Discount already exists, skipping", {
            existingDiscount,
          });
          continue;
        }

        const newDiscount: JumboDiscount = {
          ...generatedDiscount,
          source: "jumbo" as const,
          url: URL,
        };

        discountsMap.get(weekdayIndex)?.push(newDiscount);
      }
    }),
  );

  // Combine all discounts from all weekdays
  const allDiscounts = Array.from(discountsMap.values()).flat();
  return cleanDiscounts(allDiscounts);
}

function getBankOrWallet(paymentMethodss: PaymentMethod[][]) {
  for (const paymentMethods of paymentMethodss) {
    for (const paymentMethod of paymentMethods) {
      if (BANKS_OR_WALLETS.includes(paymentMethod as any)) {
        return paymentMethod;
      }
    }
  }
}

// Backward compatibility function
export async function scrapeJumbo() {
  const contentData = await scrapeJumboContent();
  return await extractJumboDiscounts(contentData);
}
