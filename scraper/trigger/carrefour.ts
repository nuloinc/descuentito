import { logger, schedules } from "@trigger.dev/sdk/v3";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { NoObjectGeneratedError, streamObject } from "ai";
import { BasicPromotionSchema, CarrefourPromotion } from "promos-db/schema";
import { fetchPageData } from "./lib/fetch-page";
import { savePromotions } from "../lib/git";
import { cleanup } from "../lib";

const PromotionSchema = BasicPromotionSchema.extend({
  where: z.array(z.enum(["Carrefour", "Maxi", "Market", "Express", "Online"])),
  membership: z.array(z.enum(["Mi Carrefour"])).optional(),
});

export const carrefourTask = schedules.task({
  id: "carrefour-extractor",
  cron: "0 0 * * *",
  maxDuration: 300,
  retry: {
    maxAttempts: 3,
  },
  run: async (payload, { ctx }) => {
    const { domDescription } = await fetchPageData(
      "carrefour",
      "https://www.carrefour.com.ar/descuentos-bancarios",
      {
        selector: ".vtex-tabs__content",
        waitForSelector:
          ".valtech-carrefourar-bank-promotions-0-x-ColRightTittle",
      }
    );

    logger.info("DOM Description", { domDescription });

    let promotions: CarrefourPromotion[] = [];
    try {
      const { elementStream } = streamObject({
        model: google("gemini-2.0-flash"),
        output: "array",
        schema: PromotionSchema,
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

    const cleanedPromotions = await cleanup(
      "carrefour",
      promotions,
      PromotionSchema.extend({
        url: z.string(),
        source: z.literal("carrefour"),
      })
    );

    await savePromotions("carrefour", cleanedPromotions);
  },
});
