import { logger, schedules } from "@trigger.dev/sdk";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { generateObject, NoObjectGeneratedError, streamObject } from "ai";
import {
  BasicDiscountSchema,
  CotoDiscount,
  genStartPrompt,
  LIMITS_PROMPT,
  PAYMENT_METHODS,
  PAYMENT_METHODS_PROMPT,
  PRODUCTS_PROMPT,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema";
import { savePromotions } from "../lib/git";
import { createPlaywrightSession, openrouter } from "../lib";
import assert from "assert";
import { cleanDiscounts } from "../lib/clean";

const promotionSchema = BasicDiscountSchema.extend({
  where: z.array(z.enum(["Coto", "Online"])),
  membership: z.array(z.enum(["Club La Nacion", "Comunidad Coto"])).optional(),
});

const SOURCE = "coto";
const URL = "https://www.coto.com.ar/descuentos/index.asp";

const SYSTEM_PROMPT = `${genStartPrompt("Coto")} 

IMPORTANT: The screenshot image is your PRIMARY source for accurate, current discounts. The legal text provided is secondary and may be outdated - use it ONLY to supplement details not visible in the image.

For each discount visible in the screenshot:
1. Extract all details shown in the image
2. Where image information is incomplete, carefully supplement with legal text details
3. If there's a contradiction between image and legal text, the image takes precedence

Important fields to extract from legal text:
- excludesProducts: Always check the legal text for product exclusions (like "Vinos, Harina", "Marca Coca Cola, Alcohol")
- restrictions: Look for any non-obvious limitations in the legal text

If there's no specific mention of discount amount or cuotas sin interes, don't return the discount. If the discount doesn't apply to CABA, don't return the discount.

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

WHERE

"Coto" means the promotion is valid in physical stores, "Online" means it's valid in cotodigital.com.ar.

${PRODUCTS_PROMPT}

${LIMITS_PROMPT}
`;

export const cotoTask = schedules.task({
  id: "coto-extractor",
  maxDuration: 1800,
  retry: {
    maxAttempts: 3,
  },
  run: async (payload, { ctx }) => {
    await using session = await createPlaywrightSession();
    const { page } = session;
    let content: string;
    {
      await page.goto("https://www.coto.com.ar/legales/", {
        waitUntil: "networkidle",
      });
      content = await page.evaluate(() => {
        const container = document.querySelector("section .container");
        ["button", "input", "#button-container"].forEach((selector) => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element) => {
            element.remove();
          });
        });
        return container?.textContent || "";
      });
      logger.info("Content", { length: content.length, content });

      if (!content) {
        throw new Error("No content found");
      }
    }

    const processedContent = content
      .split("\n**")
      .slice(1)
      .filter(
        (c) =>
          // !c.includes("DESCUENTOS SÁBADO Y DOMINGO **") &&
          !c.includes("MIX ALIMENTOS **") &&
          !c.includes("SALÓN") &&
          !c.includes("ELECTRO (MOTIVO") &&
          !c.includes("PROMOS HOGAR (MENSUALES) **") &&
          !c.includes("PROMOS HOGAR (SEMANALES) **") &&
          !c.includes("VOLVEMOS AL COLE **") &&
          !c.includes("MAR DEL PLATA **") &&
          !c.includes("COSTA **") &&
          !c.includes("ELECTRO **") &&
          !c.includes("NESTLÉ **") &&
          !c.includes("DESCUENTO COLEGIAL ONLINE **") &&
          !c.includes("COMUNIDAD MENSUAL **") &&
          !c.includes("PARANÁ – SANTA FE **") &&
          !c.includes("DEVOLUCION O CAMBIO DE PRODUCTOS") &&
          !c.includes("ANSES **") &&
          !c.includes(
            "PARA TODAS LAS PROMOCIONES BANCARIAS Y/O ENTIDADES. VER EXCLUSIONES ESPECÍFICAS DE CADA PROMOCIÓN BUSCANDO POR SECCIÓN,"
          )
      )
      .join("\n\n");

    // Extract and highlight product exclusions and restrictions
    let highlightedContent = processedContent;

    // Look for common exclusion phrases and highlight them
    const exclusionPatterns = [
      /NO PARTICIPA[N]?[\s\:]+(.*?)(?=\.|$)/gi,
      /EXCLU[YIÍ]DOS?[\s\:]+(.*?)(?=\.|$)/gi,
      /NO APLICA (PARA|A|EN) (.*?)(?=\.|$)/gi,
      /EXCLUYE[N]?[\s\:]+(.*?)(?=\.|$)/gi,
      /EXCLUDES?[\s\:]+(.*?)(?=\.|$)/gi,
      /SIN INCLUIR[\s\:]+(.*?)(?=\.|$)/gi,
      /QUEDAN EXCLU[IÍ]DOS?[\s\:]+(.*?)(?=\.|$)/gi,
    ];

    for (const pattern of exclusionPatterns) {
      highlightedContent = highlightedContent.replace(pattern, (match) => {
        return `\n\n**PRODUCT EXCLUSIONS:** ${match}\n\n`;
      });
    }

    // const oldPromotions = await fetch(
    //   `https://raw.githubusercontent.com/nuloinc/descuentito-data/refs/heads/main/${source}.json`
    // )
    //   .then((res) => res.json())
    //   .catch(() => []);

    let discounts: CotoDiscount[] = [];

    await page.setViewportSize({ width: 1920, height: 3840 });
    await page.goto(URL, { waitUntil: "networkidle" });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // merge all weekdays
    await page.evaluate(() => {
      document.querySelectorAll(".nav").forEach((e) => e.remove());
      document.querySelectorAll("#discounts > *").forEach((e) => {
        (e as HTMLElement).style.position = "unset";
        (e as HTMLElement).style.display = "inline-block";
      });
      (document.querySelector(".portfolio-grid") as HTMLElement).style.height =
        "auto";
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const els = await page.$$("#descuentos .grid-item");
    if (!els) throw new Error("No discounts found");

    console.log(els.length);

    let discountData: {
      highlightedContent: string;
      txt: string;
      screenshot: Buffer;
    }[] = [];
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const txt = (await el.textContent()) || "";
      const screenshot = await el.screenshot();
      discountData.push({
        highlightedContent,
        txt,
        screenshot,
      });
    }
    await Promise.all(
      discountData.map(async (data) => {
        if (
          data.txt.includes("EXCLUSIVO SUCURSALES") ||
          data.txt.includes("descuentos del fin de semana")
        )
          return;
        discounts.push(
          ...(await getDiscounts({
            highlightedContent: data.highlightedContent,
            screenshot: data.screenshot,
          }))
        );
      })
    );

    assert(discounts.length > 4, "Not enough discounts found");

    await savePromotions(ctx, SOURCE, cleanDiscounts(discounts));
  },
});

export async function getDiscounts({
  highlightedContent,
  screenshot,
}: {
  highlightedContent: string;
  screenshot: Buffer;
}) {
  let discounts: CotoDiscount[] = [];
  const { elementStream } = streamObject({
    // model: openrouter.chat("google/gemini-2.5-pro-preview-03-25"),
    model: google("gemini-2.5-pro-exp-03-25"),
    schema: promotionSchema,
    mode: "json",
    output: "array",
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Your primary task is to extract the discount information from the screenshot image, which shows a single valid promotion. The screenshot is your PRIMARY source of truth.

The legal text that follows is ONLY for supplementing specific details not visible in the screenshot:
1. Most importantly, use it to identify excluded products (excludesProducts field). Look for sections marked with **NO INCLUYE** in the legal text.
2. Look for restrictions and limitations
3. Check for validity periods if not clear in the image

The screenshot contains the accurate and current promotion information. If there's a contradiction between the image and legal text, the image ALWAYS takes precedence.

For the "where" field, look for visual indicators in the image that specify if the discount applies to physical stores (mark as "Coto"), online (mark as "Online"), or both. By default, assume discounts apply to physical stores unless explicitly stated otherwise.

Legal text for reference (use ONLY to supplement missing details, particularly for excludesProducts): \n\n${highlightedContent}`,
          },
          {
            type: "image",
            image: screenshot,
          },
        ],
      },
    ],
    system: SYSTEM_PROMPT,
  });

  try {
    for await (const object of elementStream) {
      if (object.discount.value === 0) {
        logger.info("Skipping discount", { object });
        continue;
      }
      logger.info("Extracted discount", { object });

      discounts.push({
        ...object,
        url: URL,
        source: SOURCE,
      });
    }
  } catch (error) {
    logger.error("Error processing content", { error });
  }
  return discounts;
}
