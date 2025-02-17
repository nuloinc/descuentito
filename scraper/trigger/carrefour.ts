import { logger, schedules } from "@trigger.dev/sdk/v3";
import { extractPromotions } from "./extract-promotions";
import { BUCKET_NAME, s3 } from "../fetch-cacher";
import { format } from "date-fns";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { db, schema } from "promos-db/db";
import { eq, sql } from "drizzle-orm";
import {
  createBrowserSession,
  generateElementDescription,
  storeCacheData,
} from "../lib";
import { google } from "@ai-sdk/google";

import { z } from "zod";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, NoObjectGeneratedError, streamObject } from "ai";
import { CarrefourPromotion, GenericPromotion } from "promos-db/schema";

export const carrefourTask = schedules.task({
  id: "carrefour-extractor",
  cron: "0 0 * * *",
  maxDuration: 300,
  retry: {
    maxAttempts: 1,
  },
  run: async (payload, { ctx }) => {
    let screenshot: Uint8Array;
    let html: string;
    let text: string;
    let domDescription: string;
    {
      await using session = await createBrowserSession();
      const { page } = session;

      await page.goto("https://www.carrefour.com.ar/descuentos-bancarios", {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector(
        ".valtech-carrefourar-bank-promotions-0-x-legalHeader"
      );
      screenshot = await page.screenshot({ fullPage: true });
      await storeCacheData("carrefour", ".png", screenshot);

      html = await page.evaluate(() => {
        return document.querySelector(".vtex-tabs__content")?.innerHTML || "";
      });
      await storeCacheData("carrefour", ".html", html);

      await page.exposeFunction(
        "generateElementDescription",
        generateElementDescription
      );

      domDescription = await generateElementDescription(
        page,
        ".vtex-tabs__content"
      );
      await storeCacheData("carrefour", "-dom.txt", domDescription);

      text = await page.evaluate(() => {
        return document.querySelector(".vtex-tabs__content")?.textContent || "";
      });
      await storeCacheData("carrefour", ".txt", text);
    }

    logger.info("DOM Description", { domDescription });

    // const openrouter = createOpenRouter({
    //   apiKey: process.env.OPENROUTER_API_KEY,
    // });

    let promotions: CarrefourPromotion[] = [];
    try {
      const { elementStream } = await streamObject({
        // model: openrouter("openai/gpt-4o-2024-11-20"),
        model: google("gemini-2.0-flash"),
        output: "array",
        schema: z.object({
          //   id: z.number(),
          title: z.string(),
          description: z.string(),
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
          where: z.array(
            z.enum(["Carrefour", "Maxi", "Market", "Express", "Online"])
          ),
          paymentMethods: z
            .array(
              z.array(
                z.enum([
                  "Banco Patagonia",
                  "Banco BBVA",
                  "Banco Nación",
                  "Banco Galicia",
                  "Banco Macro",
                  "Banco Santander",
                  "Mercado Pago",
                  "Dinero en cuenta",
                  "MODO",
                  "Tarjeta Carrefour Prepaga",
                  "Tarjeta Carrefour Crédito",
                  "Tarjeta de crédito VISA",
                  "Tarjeta de débito VISA",
                  "Tarjeta de crédito Mastercard",
                  "Tarjeta de débito Mastercard",
                ])
                // .describe(
                //   `possibly: 'Tarjeta Carrefour Prepaga', 'Tarjeta Carrefour Crédito', 'Banco Patagonia', 'Banco Nación', 'MODO', 'MercadoPago', 'Mastercard', 'VISA'`
                // )
              )
            )
            .optional(),
          limits: z.object({
            maxDiscount: z.number().optional(),
            explicitlyHasNoLimit: z.boolean().optional(),
          }),
        }),
        system: `You are a helpful assistant that extracts promotions from a text and converts them into structured JSON data with relevant information for argentinian users.

PAYMENT METHODS

Represent different combinations of payment methods as separate arrays of strings.

If there are multiple combinations possible, represent each and every one of them individually.

Example: Banco Galicia with either VISA or Mastercard credit cards: [["Banco Galicia", "Tarjeta de crédito VISA"], ["Banco Galicia", "Tarjeta de crédito Mastercard"]], NOT merging them like this: [["Banco Galicia", "Tarjeta de crédito VISA", "Tarjeta de crédito Mastercard"]]

Tarjeta Carrefour Prepaga/Crédito are DISTINCT from "Mi Carrefour" which is a membership program.

RESTRICTIONS

Do not include irrelevant restrictions that are obvious, such as restrictions related to foreign credit cards, purchase cards, Carrefour-specific payment methods, payments in foreign currencies, or social aid programs, or restrictions that specify "Solo para consumo familiar.".

Do not include redundant information that is mentioned elsewhere in the object, such as validity dates, days of the week, payment methods, where the promotion is valid or limits.

Order by relevance, starting with the most relevant restrictions.

WHERE

"Comprando en:" describes WHERE the promotion is valid. "logo$TYPE" is for Carrefour $TYPE.

LIMITS

\`maxDiscount\` is the maximum discount amount in pesos that can be applied to the promotion.

\`explicitlyHasNoLimit\` is true if the promotion explicitly states that there is no limit ("sin tope").
`,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Extract the promotions from the following text: " +
                  domDescription,
                // text: "Extract the promotions from the following screenshot: ",
              },
              // { type: "image", image: screenshot },
            ],
          },
        ],
      });

      for await (const element of elementStream) {
        logger.info("Element", { element });
        promotions.push({
          ...element,
          url: "https://www.carrefour.com.ar/descuentos-bancarios",
          source: "carrefour",
        });
      }
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        logger.error("No object generated", {
          error,
          text: error.text,

          cause: error.cause,
          usage: error.usage,
          response: error.response,
        });
      }
      throw error;
    }

    await storeCacheData("carrefour", ".json", JSON.stringify(promotions));

    await db.transaction(async (tx) => {
      await tx
        .delete(schema.promotionsTable)
        .where(sql`${schema.promotionsTable.source} = 'carrefour'`);
      await tx.insert(schema.promotionsTable).values(
        promotions.map((promo) => ({
          source: "carrefour",
          json: promo,
        }))
      );
    });

    logger.info("Saved promotions", {
      count: promotions.length,
      promotions,
    });
  },
});
