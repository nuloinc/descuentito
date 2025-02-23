import { logger, schedules } from "@trigger.dev/sdk/v3";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { generateObject, streamObject } from "ai";
import {
  BANKS_OR_WALLETS,
  BasicDiscountSchema,
  JumboDiscount,
  LIMITS_PROMPT,
  PAYMENT_METHODS_PROMPT,
  PaymentMethod,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema";
import { savePromotions } from "../lib/git";
import { createPlaywrightSession, generateElementDescription } from "../lib";

export const jumboTask = schedules.task({
  id: "jumbo-extractor",
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

    const discounts: JumboDiscount[] = [];

    for (const button of buttons) {
      const previousDaysDiscounts = [...discounts];
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

        const { elementStream } = streamObject({
          model: google("gemini-2.0-flash"),
          output: "array",
          schema: BasicDiscountSchema.extend({
            where: z.array(z.enum(["Jumbo", "Online"])),
            membership: z.array(z.enum(["Clarin 365"])).optional(),
          }),
          system: `You are a helpful assistant that extracts discounts from text and converts them into structured JSON data with relevant information for argentinian users. You're extracting discounts from Jumbo's website. Jumbo is part of the Cencosud group.

You are given a screenshot of a promotion and a text that describes the promotion from Jumbo's website.

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

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
          logger.info("Object", { object: generatedDiscount });
          // hack porque iteramos por cada dia de semana, entonces los descuentos que estan en varios dias de semana se repiten
          // lo hacemos sobre un array de los descuentos de los dias anteriores para no tener falsos positivos sobre descuentos del mismo banco pero de distinto tipo
          const existingDiscount = previousDaysDiscounts.find(
            (p) =>
              p.weekdays?.every((day) =>
                generatedDiscount.weekdays?.includes(day)
              ) &&
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

    await savePromotions("jumbo", discounts);
  },
});

function getBankOrWallet(paymentMethodss: PaymentMethod[][]) {
  for (const paymentMethods of paymentMethodss) {
    for (const paymentMethod of paymentMethods) {
      if (BANKS_OR_WALLETS.includes(paymentMethod as any)) {
        return paymentMethod;
      }
    }
  }
}
