import { logger, schedules } from "@trigger.dev/sdk/v3";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { generateObject, NoObjectGeneratedError, streamObject } from "ai";
import {
  BasicDiscountSchema,
  CotoDiscount,
  genStartPrompt,
  LIMITS_PROMPT,
  PAYMENT_METHODS,
  PAYMENT_METHODS_PROMPT,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema";
import { savePromotions } from "../lib/git";
import { createPlaywrightSession, openrouter } from "../lib";
import assert from "assert";

const promotionSchema = BasicDiscountSchema.extend({
  where: z.array(z.enum(["Coto", "Online"])),
  membership: z.array(z.enum(["Club La Nacion", "Comunidad Coto"])).optional(),
});

const SYSTEM_PROMPT = `${genStartPrompt("Coto")} If there's no specific mention of discount amount or cuotas sin interes, don't return the discount. If the discount doesn't apply to CABA, don't return the discount.

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

WHERE

"Coto" means the promotion is valid in physical stores, "Online" means it's valid in cotodigital.com.ar.

${LIMITS_PROMPT}
`;

export const cotoTask = schedules.task({
  id: "coto-extractor",
  maxDuration: 1800,
  retry: {
    maxAttempts: 3,
  },
  run: async (payload, { ctx }) => {
    let content: string;
    const source = "coto";
    const url = "https://www.coto.com.ar/legales/";
    {
      await using session = await createPlaywrightSession();
      const { page } = session;
      await page.goto(url, { waitUntil: "networkidle" });
      content = await page.evaluate(() => {
        const container = document.querySelector("section .container");
        ["button", "input", "#button-container"].forEach((selector) => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element) => {
            element.remove();
          });
        });
        return container?.textContent || "";
      });
      logger.info("Content", { length: content.length, content });

      if (!content) {
        throw new Error("No content found");
      }
    }

    // const oldPromotions = await fetch(
    //   `https://raw.githubusercontent.com/nuloinc/descuentito-data/refs/heads/main/${source}.json`
    // )
    //   .then((res) => res.json())
    //   .catch(() => []);

    let discounts: CotoDiscount[] = [];

    for (const paragraph of content
      .split("\n**")
      .slice(1)
      .filter(
        (c) =>
          // !c.includes("DESCUENTOS SÁBADO Y DOMINGO **") &&
          !c.includes("MIX ALIMENTOS **") &&
          !c.includes("SALÓN") &&
          !c.includes("ELECTRO (MOTIVO") &&
          !c.includes("PROMOS HOGAR (MENSUALES) **") &&
          !c.includes("PROMOS HOGAR (SEMANALES) **") &&
          !c.includes("VOLVEMOS AL COLE **") &&
          !c.includes("MAR DEL PLATA **") &&
          !c.includes("COSTA **") &&
          !c.includes("ELECTRO **") &&
          !c.includes("NESTLÉ **") &&
          !c.includes("DESCUENTO COLEGIAL ONLINE **") &&
          !c.includes("COMUNIDAD MENSUAL **") &&
          !c.includes("PARANÁ – SANTA FE **") &&
          !c.includes("DEVOLUCION O CAMBIO DE PRODUCTOS") &&
          !c.includes("ANSES **") &&
          !c.includes(
            "PARA TODAS LAS PROMOCIONES BANCARIAS Y/O ENTIDADES. VER EXCLUSIONES ESPECÍFICAS DE CADA PROMOCIÓN BUSCANDO POR SECCIÓN,"
          )
      )) {
      const { elementStream } = streamObject({
        // model: openrouter.chat("google/gemini-2.0-flash-001"),
        model: google("gemini-2.0-flash"),
        schema: promotionSchema,
        mode: "json",
        output: "array",
        // temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  // oldPromotions.length > 0
                  //   ? `Here's the previous promotion array: ${JSON.stringify(
                  //       oldPromotions
                  //     )}.\n\n`
                  //   : "" +
                  `Extract the promotions from the following text: ${paragraph}`,
              },
            ],
          },
        ],
        system: SYSTEM_PROMPT,
      });

      try {
        for await (const object of elementStream) {
          if (object.discount.value === 0) {
            logger.info("Skipping discount", { object });
            continue;
          }
          logger.info("Extracted discount", { object });

          discounts.push({
            ...object,
            url,
            source,
          });
        }
      } catch (error) {
        logger.error("Error processing content", { error });
      }
    }

    assert(discounts.length > 4, "Not enough discounts found");

    await savePromotions(source, discounts);
  },
});
