import { z } from "zod";
import { generateObject } from "ai";
import {
  BasicDiscountSchema,
  genStartPrompt,
  LIMITS_PROMPT,
  PAYMENT_METHODS_PROMPT,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema";
import { waitForSelectorOrFail } from "../lib/fetch-page";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { createPlaywrightSession, generateElementDescription } from "../../lib";

const DiscountSchema = BasicDiscountSchema.extend({
  where: z.array(z.enum(["Carrefour", "Maxi", "Market", "Express", "Online"])),
  membership: z.array(z.enum(["Mi Carrefour"])).optional(),
});

export async function scrapeCarrefourContent() {
  await using session = await createPlaywrightSession({ useProxy: true });
  const { page } = session;

  await page.goto("https://www.carrefour.com.ar/descuentos-bancarios", {
    waitUntil: "domcontentloaded",
  });
  await waitForSelectorOrFail(
    page,
    ".valtech-carrefourar-bank-promotions-0-x-ColRightTittle",
    "carrefour",
  );

  const numberOfPromotions = await page.evaluate(() => {
    return document.querySelectorAll(
      ".valtech-carrefourar-bank-promotions-0-x-cardBox",
    ).length;
  });

  const promotionsDomDescriptions = await Promise.all(
    Array.from(
      { length: numberOfPromotions },
      async (_, i) =>
        await generateElementDescription(
          page,
          `.valtech-carrefourar-bank-promotions-0-x-cardBox:nth-child(${i + 1})`,
        ),
    ),
  );

  return promotionsDomDescriptions
    .sort((a, b) => a.localeCompare(b))
    .map((domDescription) => ({
      domDescription,
    }));
}

export async function extractCarrefourDiscounts(
  promotionsData: { domDescription: string }[],
) {
  const promotions = await Promise.all(
    promotionsData.map(async (data) => extractDiscount(data)),
  );

  return promotions;
}

async function extractDiscount({ domDescription }: { domDescription: string }) {
  const { object } = await generateObject({
    model: openrouter.chat("google/gemini-2.5-flash-preview-05-20"),
    schema: DiscountSchema,
    temperature: 0,
    experimental_telemetry: { isEnabled: true },
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
              "Extract the discount from the following pseudo-html: \\n\\n" +
              domDescription,
          },
        ],
      },
    ],
  });

  return {
    ...object,
    url: "https://www.carrefour.com.ar/descuentos-bancarios",
    source: "carrefour",
  };
}

// Backward compatibility function
export async function scrapeCarrefour() {
  const contentData = await scrapeCarrefourContent();
  return await extractCarrefourDiscounts(contentData);
}
