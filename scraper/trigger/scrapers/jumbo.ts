import logger from "../lib/logger";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { generateObject, streamObject } from "ai";
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

export async function scrapeJumbo() {
  await using sessions = await createPlaywrightSession();
  const { page } = sessions;
  const url = "https://www.jumbo.com.ar/descuentos-del-dia?type=por-dia&day=1";

  await page.goto(url, {
    waitUntil: "domcontentloaded",
  });

  const container = await page.$('ul:has(button:has-text("Lunes"))');
  if (!container)
    throw new Error("Could not find container with weekday buttons");

  const buttons = await container.$$("button");

  const discounts: JumboDiscount[] = [];

  for (const button of buttons) {
    const previousDaysDiscounts = [...discounts];
    await button.click();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const promotionEls = await page.$$(
      ".vtex-render__container-id-discounts-financing div:nth-of-type(3) ul li"
    );

    for (const promotionEl of promotionEls) {
      const verMasBtn = await promotionEl.$('div:has-text("Ver más") button');
      if (!verMasBtn) throw new Error("No ver más button found");
      await verMasBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 500));

      const screenshot = await promotionEl.screenshot();

      const text = await generateElementDescription(
        page,
        await promotionEl.evaluate((el: Element, i: number) => {
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

      const { elementStream } = streamObject({
        model: google("gemini-2.0-flash"),
        output: "array",
        schema: BasicDiscountSchema.extend({
          where: z.array(z.enum(["Jumbo", "Online"])),
          membership: z.array(z.enum(["Clarin 365"])).optional(),
        }),
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
                  "Extract the discounts from the following screenshot, and the following text: \n\n" +
                  text,
              },
              { type: "image", image: screenshot },
            ],
          },
        ],
      });

      for await (const generatedDiscount of elementStream) {
        // hack porque iteramos por cada dia de semana, entonces los descuentos que estan en varios dias de semana se repiten
        // lo hacemos sobre un array de los descuentos de los dias anteriores para no tener falsos positivos sobre descuentos del mismo banco pero de distinto tipo
        const existingDiscount = previousDaysDiscounts.find(
          (p) =>
            (p.weekdays
              ? p.weekdays.every((day) =>
                  generatedDiscount.weekdays?.includes(day)
                )
              : !generatedDiscount.weekdays) &&
            p.where?.every((where) =>
              generatedDiscount.where?.includes(where)
            ) &&
            p.limits?.maxDiscount === generatedDiscount.limits?.maxDiscount &&
            p.discount.value === generatedDiscount.discount.value &&
            p.paymentMethods &&
            generatedDiscount.paymentMethods &&
            getBankOrWallet(p.paymentMethods) ===
              getBankOrWallet(generatedDiscount.paymentMethods)
        );

        if (existingDiscount) {
          logger.info("Discount already exists, skipping", {
            existingDiscount,
          });
          continue;
        }

        discounts.push({
          ...generatedDiscount,
          source: "jumbo",
          url,
        });
      }
    }
  }

  return cleanDiscounts(discounts);
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
