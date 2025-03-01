import { logger, schedules } from "@trigger.dev/sdk/v3";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { NoObjectGeneratedError, streamObject } from "ai";
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
import { createPlaywrightSession } from "../lib";
import assert from "assert";

const promotionSchema = BasicDiscountSchema.extend({
  where: z.array(z.enum(["Coto", "Online"])),
  membership: z.array(z.enum(["Club La Nacion", "Comunidad Coto"])).optional(),
});

const SYSTEM_PROMPT = `${genStartPrompt("Coto")}

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

    // const oldPromotions = await fetch(
    //   `https://raw.githubusercontent.com/nuloinc/descuentito-data/refs/heads/main/${source}.json`
    // )
    //   .then((res) => res.json())
    //   .catch(() => []);

    let promotions: CotoDiscount[] = [];

    const { elementStream } = streamObject({
      model: google("gemini-2.0-flash"),
      output: "array",
      schema: promotionSchema,
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
                `Extract the promotions from the following text: ${content}`,
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

    assert(promotions.length > 0, "No promotions found");

    await savePromotions(source, promotions);
  },
});
