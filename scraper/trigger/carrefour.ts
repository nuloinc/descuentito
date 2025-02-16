import { logger, schedules } from "@trigger.dev/sdk/v3";
import { extractPromotions } from "./extract-promotions";
import { BUCKET_NAME, s3 } from "../fetch-cacher";
import { format } from "date-fns";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { db, schema } from "promos-db/db";
import { eq, sql } from "drizzle-orm";
import { createBrowserSession, storeCacheData } from "../lib";
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
      text = await page.evaluate(() => {
        return document.querySelector(".vtex-tabs__content")?.textContent || "";
      });
    }

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
            type: z.string(),
            value: z.number(),
          }),
          validFrom: z.string().describe("YYYY-MM-DD"),
          validUntil: z.string().describe("YYYY-MM-DD"),
          weekdays: z
            .array(
              z
                .enum([
                  "Lunes",
                  "Martes",
                  "Miercoles",
                  "Jueves",
                  "Viernes",
                  "Sabado",
                  "Domingo",
                ])
                .describe(
                  "Lunes, Martes, Miercoles, Jueves, Viernes, Sabado, Domingo"
                )
            )
            .optional(),
          restrictions: z.array(z.string()).optional(),
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
                  "MODO",
                  "Tarjeta Carrefour Prepaga",
                  "Tarjeta Carrefour Crédito",
                  "Tarjeta de crédito VISA",
                  "Tarjeta de débito VISA",
                  "Tarjeta de crédito Mastercard",
                  "Tarjeta de débito Mastercard",
                  "Visa",
                  "Mastercard",
                ])
                // .describe(
                //   `possibly: 'Tarjeta Carrefour Prepaga', 'Tarjeta Carrefour Crédito', 'Banco Patagonia', 'Banco Nación', 'MODO', 'MercadoPago', 'Mastercard', 'VISA'`
                // )
              )
            )
            .describe(
              `Payment methods for the promotion. Represent each payment method as a string. Represent different combinations of payment methods as separate arrays of strings. If a promotion has conditions that apply to a single payment method (e.g., specific bank and specific card), represent each condition as a nested array of strings. If no payment methods are specified, return an empty array.`
            )
            .optional(),
          additionalInfo: z.string().optional(),
          limits: z
            .object({
              maxDiscount: z.number().optional(),
            })
            .optional(),
        }),
        system: `You are a helpful assistant that converts promotions into structured JSON data.`,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the promotions from the following text: " + text,
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
