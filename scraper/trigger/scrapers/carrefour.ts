import logger from "../lib/logger";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { NoObjectGeneratedError, streamObject } from "ai";
import {
  BasicDiscountSchema,
  CarrefourDiscount,
  genStartPrompt,
  LIMITS_PROMPT,
  PAYMENT_METHODS,
  PAYMENT_METHODS_PROMPT,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema";
import { fetchPageData } from "../lib/fetch-page";
import assert from "assert";

const DiscountSchema = BasicDiscountSchema.extend({
  where: z.array(z.enum(["Carrefour", "Maxi", "Market", "Express", "Online"])),
  membership: z.array(z.enum(["Mi Carrefour"])).optional(),
});

export async function scrapeCarrefour() {
  const { domDescription } = await fetchPageData(
    "carrefour",
    "https://www.carrefour.com.ar/descuentos-bancarios",
    {
      selector: ".vtex-tabs__content",
      waitForSelector:
        ".valtech-carrefourar-bank-promotions-0-x-ColRightTittle",
    }
  );

  let promotions = [];
  for await (const promotion of extractDiscounts({ domDescription }))
    promotions.push(promotion);

  assert(promotions.length > 0, "No promotions found");

  return promotions;
}

async function* extractDiscounts({
  domDescription,
}: {
  domDescription: string;
}) {
  const { elementStream } = streamObject({
    model: google("gemini-2.0-flash"),
    output: "array",
    schema: DiscountSchema,
    temperature: 0,
    system: `${genStartPrompt("Carrefour")}

${PAYMENT_METHODS_PROMPT}

Tarjeta Carrefour Prepaga/Crédito are DISTINCT from "Mi Carrefour" which is a membership program.

${RESTRICTIONS_PROMPT}

WHERE

"Comprando en:" describes WHERE the discount is valid. "logo$TYPE" is for Carrefour $TYPE. If the same discount is valid in different places, return all of them.

${LIMITS_PROMPT}
`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Extract the promotions from the following pseudo-html: \n\n" +
              domDescription,
          },
        ],
      },
    ],
  });

  for await (const element of elementStream) {
    yield {
      ...element,
      url: "https://www.carrefour.com.ar/descuentos-bancarios",
      source: "carrefour",
    };
  }
}
