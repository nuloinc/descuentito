import { logger, schedules } from "@trigger.dev/sdk/v3";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { generateObject, NoObjectGeneratedError, streamObject } from "ai";
import { CotoPromotion } from "promos-db/schema";
import { fetchPageData } from "./lib/fetch-page";
import { savePromotions } from "../lib/git";

const promotionSchema = z.object({
  title: z.string(),
  category: z.string().optional(),
  discount: z.object({
    type: z.enum(["porcentaje", "cuotas sin intereses"]),
    value: z
      .number()
      .describe("0 to 100 for percentage, 0 to 12 for cuotas"),
  }),
  validFrom: z.string().describe("YYYY-MM-DD"),
  validUntil: z.string().describe("YYYY-MM-DD"),
  weekdays: z
    .array(
      z.enum([
        "Lunes",
        "Martes",
        "Miercoles",
        "Jueves",
        "Viernes",
        "Sabado",
        "Domingo",
      ])
    )
    .optional(),
  restrictions: z.array(z.string()),
  where: z.array(z.enum(["Coto", "Online"])),
  paymentMethods: z
    .array(
      z.array(
        z.enum([
          "Banco Patagonia",
          "Banco BBVA",
          "Banco Nación",
          "Banco Ciudad",
          "Banco Galicia",
          "Banco Galicia - Eminent",
          "Banco Macro",
          "Banco Santander",
          "Banco ICBC",
          "Banco ICBC – Cliente Payroll",
          "Banco Credicoop",
          "Banco Credicoop - Plan Sueldo",
          "Banco Santander",
          "Banco Comafi",
          "Banco Galicia Más",
          "Banco Supervielle",
          "Banco Columbia",
          "Banco del Sol",
          ".Reba",
          "Mercado Pago",
          "Dinero en cuenta",
          "MODO",
          "Ualá",
          "Uilo",
          "NaranjaX",
          "Cuenta DNI",
          "Tarjeta Carrefour Prepaga",
          "Tarjeta Carrefour Crédito",
          "Tarjeta de crédito VISA",
          "Tarjeta de débito VISA",
          "Tarjeta de crédito Mastercard",
          "Tarjeta de débito Mastercard",
          "Tarjeta American Express",
          "Tarjeta Prepaga Mastercard",
          "Tarjeta de Crédito Coto TCI",
        ])
      )
    )
    .optional(),
  membership: z
    .array(z.enum(["Club La Nacion", "Comunidad Coto"]))
    .optional(),
  limits: z.object({
    maxDiscount: z.number().optional(),
    explicitlyHasNoLimit: z.boolean().optional(),
  }),
});

const SYSTEM_PROMPT = `You are a helpful assistant that extracts promotions from a text and converts them into structured JSON data with relevant information for argentinian users.

PAYMENT METHODS

Represent different combinations of payment methods as separate arrays of strings.

If there are multiple combinations possible, represent each and every one of them individually.

Example: Banco Galicia with either VISA or Mastercard credit cards: [["Banco Galicia", "Tarjeta de crédito VISA"], ["Banco Galicia", "Tarjeta de crédito Mastercard"]], NOT merging them like this: [["Banco Galicia", "Tarjeta de crédito VISA", "Tarjeta de crédito Mastercard"]]

"Banco Galicia Más" is a different payment method from "Banco Galicia".

RESTRICTIONS

Do not include irrelevant restrictions that are obvious, such as restrictions related to foreign credit cards, purchase cards, payments in foreign currencies, or social aid programs, or restrictions that specify "Solo para consumo familiar.".

Do not include redundant information that is mentioned elsewhere in the object, such as validity dates, days of the week, payment methods, where the promotion is valid or limits.

Order by relevance, starting with the most relevant restrictions.

WHERE

"Coto" means the promotion is valid in physical stores, "Online" means it's valid in cotodigital.com.ar.

LIMITS

\`maxDiscount\` is the maximum discount amount in pesos that can be applied to the promotion.

\`explicitlyHasNoLimit\` is true if the promotion explicitly states that there is no limit ("sin tope").`;

export const cotoTask = schedules.task({
  id: "coto-extractor",
  cron: "0 0 * * *",
  maxDuration: 300,
  retry: {
    maxAttempts: 1,
  },
  run: async (payload, { ctx }) => {
    const { domDescription,page } = await fetchPageData(
      "coto",
      "https://www.cotodigital.com.ar/sitios/cdigi/terminos-descuentos",
      {
        selector: ".atg_store_company_content",
        waitForSelector: ".atg_store_company_content",
      }
    );

    logger.info("DOM Description", { domDescription });

    let promotions: CotoPromotion[] = [];
    const paragraphs = (await Promise.all(
      (await page.$$('.atg_store_company_content p')).map(async (p) => {
        const text = await p.evaluate(el => el.textContent);
        return text?.trim() || "";
      })
    )).filter((p: string) => p.length > 0);

    logger.info("Processing paragraphs", { count: paragraphs.length });

    for (const paragraph of paragraphs) {
      try {
        const { object } = await generateObject({
          model: google("gemini-2.0-flash"),
          schema: promotionSchema,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract the promotions from the following text: " + paragraph,
                },
              ],
            },
          ],
          system: SYSTEM_PROMPT,
        });

        logger.info("Extracted promotion from paragraph", { 
          paragraph,
          object 
        });
          
        promotions.push({
          ...object,
          url: "https://www.cotodigital.com.ar/sitios/cdigi/terminos-descuentos",
          source: "coto",
        });
      } catch (error) {
        if (NoObjectGeneratedError.isInstance(error)) {
          logger.warn("No promotion found in paragraph", {
            paragraph,
            error: error.message,
            text: error.text,
            cause: error.cause,
          });
          // Continue processing other paragraphs
          continue;
        }
        // For other errors, log but continue processing
        logger.error("Error processing paragraph", {
          paragraph,
          error,
        });
      }
    }

    await savePromotions("coto", promotions);
  },
});
