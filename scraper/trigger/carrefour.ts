import { logger, schedules } from "@trigger.dev/sdk/v3";
import { extractPromotions } from "./extract-promotions";
import { BUCKET_NAME, s3 } from "../fetch-cacher";
import { format } from "date-fns";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { db, schema } from "promos-db/db";
import { eq, sql } from "drizzle-orm";
import { createBrowserSession } from "../lib";
import { google } from '@ai-sdk/google';


import { z } from "zod";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
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
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `carrefour/${new Date().toISOString()}.png`,
          Body: screenshot,
        })
      );

       html = await page.evaluate(() => {
        return document.querySelector(".vtex-tabs__content")?.innerHTML || '';
      });
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `carrefour/${new Date().toISOString()}.html`,
          Body: html,
        })
      );
      text = await page.evaluate(() => {
        return document.querySelector(".vtex-tabs__content")?.textContent || '';
      });
    } 

    // const openrouter = createOpenRouter({
    //   apiKey: process.env.OPENROUTER_API_KEY,
    // });

    const { object } = await generateObject({
      // model: openrouter("openai/gpt-4o-2024-11-20"),
      model: google("gemini-2.0-flash-001"),
      schema: z.array(
        z.object({
          //   id: z.number(),
          title: z.string(),
            description: z.string(),
            category: z.string().optional(),
            discount: z.object({
              type: z.string(),
              value: z.number(),
            }),
            validFrom: z.string(),
            validUntil: z.string(),
            paymentMethods: z.array(z.string()).optional(),
            restrictions: z.array(z.string()).optional(),
            additionalInfo: z.string().optional(),
            limits: z
              .object({
                maxDiscount: z.number().optional(),
              })
              .optional(),
        })
      ),
      system: `You are a helpful assistant that converts promotions into structured data.`,
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


    const promotions : CarrefourPromotion[] = object.map((promotion) => {
      return {
        ...promotion,
        url: "https://www.carrefour.com.ar/descuentos-bancarios",
        source: "carrefour",
        validFrom: promotion.validFrom,
        validUntil: promotion.validUntil,
      };
    });


    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${format(
          new Date(),
          "yyyy-MM-dd"
        )}/carrefour/${new Date().toISOString()}.json`,
        Body: JSON.stringify(promotions),
      })
    );

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
