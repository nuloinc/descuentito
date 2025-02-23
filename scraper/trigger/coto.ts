import { logger, schedules } from "@trigger.dev/sdk/v3";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { NoObjectGeneratedError, streamObject } from "ai";
import {
  BasicPromotionSchema,
  CotoPromotion,
  LIMITS_PROMPT,
  PAYMENT_METHODS_PROMPT,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema";
import { savePromotions } from "../lib/git";
import { cleanup, createPlaywrightSession } from "../lib";

const promotionSchema = BasicPromotionSchema.extend({
  where: z.array(z.enum(["Coto", "Online"])),
  membership: z.array(z.enum(["Club La Nacion", "Comunidad Coto"])).optional(),
});

const SYSTEM_PROMPT = `You are a helpful assistant that extracts promotions from a text and converts them into structured JSON data with relevant information for argentinian users.

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

WHERE

"Coto" means the promotion is valid in physical stores, "Online" means it's valid in cotodigital.com.ar.

${LIMITS_PROMPT}
`;

export const cotoTask = schedules.task({
  id: "coto-extractor",
  cron: "0 0 * * *",
  maxDuration: 1800,
  retry: {
    maxAttempts: 3,
  },
  run: async (payload, { ctx }) => {
    let content: string;
    const source = "coto";
    {
      const url =
        "https://www.cotodigital.com.ar/sitios/cdigi/terminos-descuentos";

      await using session = await createPlaywrightSession();
      const { page } = session;
      await page.goto(url, { waitUntil: "networkidle" });

      content =
        (await page.$eval(
          ".atg_store_company_content",
          (el) => el.textContent
        )) || "";
      logger.info("Content", { content });

      if (!content) {
        throw new Error("No content found");
      }
    }

    let promotions: CotoPromotion[] = [];
    const { elementStream } = streamObject({
      model: google("gemini-2.0-pro-exp-02-05"),
      output: "array",
      schema: promotionSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract the promotions from the following text: ${content}`,
            },
          ],
        },
      ],
      system: SYSTEM_PROMPT,
    });

    try {
      for await (const object of elementStream) {
        logger.info("Extracted promotion", { object });

        promotions.push({
          ...object,
          url: "https://www.cotodigital.com.ar/sitios/cdigi/terminos-descuentos",
          source,
        });
      }
    } catch (error) {
      logger.error("Error processing content", { error });
    }

    const cleanedPromotions = await cleanup(
      source,
      promotions,
      promotionSchema.extend({
        url: z.string(),
        source: z.literal("coto"),
      })
    );

    await savePromotions(source, cleanedPromotions);
  },
});
