import { z } from "zod";
import { streamObject } from "ai";
import {
  BasicDiscountSchema,
  genStartPrompt,
  LIMITS_PROMPT,
  MakroDiscount,
  PAYMENT_METHODS_PROMPT,
  PRODUCTS_PROMPT,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema";
import assert from "assert";
import { createPlaywrightSession } from "../../lib";
import { cleanDiscounts } from "../../lib/clean";
import { openrouter } from "@openrouter/ai-sdk-provider";

const DiscountSchema = BasicDiscountSchema.extend({
  where: z.array(z.enum(["Makro"])),
  membership: z.array(z.enum(["Club +Simple"])).optional(),
});

const URL = "https://makro.com.ar/beneficios-bancarios/";

export async function scrapeMakroContent() {
  await using sessions = await createPlaywrightSession();
  const { page } = sessions;

  await page.goto(URL, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".et_pb_blurb_content");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const x = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      ".et_builder_inner_content .section-promos-bancarias .et_pb_blurb_content:has(.et_pb_module_header)"
    );
    return elements;
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const elements = await page.$$(
    ".et_builder_inner_content .section-promos-bancarias .et_pb_blurb_content:has(.et_pb_module_header)"
  );

  const scrapedData = [];
  for (const element of elements) {
    const isVisible = await element.isVisible();
    if (!isVisible) continue;
    const screenshot = await element.screenshot();
    const text = (await element.evaluate((el: Element) => el.textContent))
      ?.trim()
      .replaceAll("\t", "");

    scrapedData.push({ screenshot, text });
  }

  return scrapedData;
}

export async function extractMakroDiscounts(
  scrapedData: { screenshot: Buffer; text: string }[]
) {
  let promotions: MakroDiscount[] = [];

  for (const { screenshot, text } of scrapedData) {
    const { elementStream } = await streamObject({
      model: openrouter.chat("google/gemini-2.5-flash-preview-05-20"),
      output: "array",
      schema: DiscountSchema,
      temperature: 0,
      experimental_telemetry: { isEnabled: true },
      system: `${genStartPrompt("Makro")}

${PAYMENT_METHODS_PROMPT}

### Banco Hipotecario

- "Banco Hipotecario Clientes Búho One, Clientes Plan sueldo y con packs" = "Banco Hipotecario - Búho/Plan Sueldo"
- ONLY return the first discount.

${RESTRICTIONS_PROMPT}

## WHERE

Always "Makro".

${PRODUCTS_PROMPT}

${LIMITS_PROMPT}
`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extract the promotion(s?) from the following html and screenshot: \n\n" +
                text,
            },
            { type: "image", image: screenshot },
          ],
        },
      ],
    });

    for await (const element of elementStream) {
      promotions.push({
        ...element,
        url: URL,
        source: "makro",
        onlyForProducts:
          element.onlyForProducts === "N/A"
            ? undefined
            : element.onlyForProducts,
        excludesProducts:
          element.excludesProducts === "N/A"
            ? undefined
            : element.excludesProducts,
      });
    }
  }

  assert(promotions.length > 6, "No promotions found");

  return cleanDiscounts(promotions);
}

// Backward compatibility function
export async function scrapeMakro() {
  const contentData = await scrapeMakroContent();
  // Ensure text is always a string before passing to extractMakroDiscounts
  const fixedContentData = contentData.map((item) => ({
    ...item,
    text: item.text || "",
  }));
  return await extractMakroDiscounts(fixedContentData);
}
