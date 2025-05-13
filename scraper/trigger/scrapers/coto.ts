import { z } from "zod";
import { generateObject } from "ai";
import {
  BasicDiscountSchema,
  CotoDiscount,
  genStartPrompt,
  LIMITS_PROMPT,
  PAYMENT_METHODS_PROMPT,
  PRODUCTS_PROMPT,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema";
import { createPlaywrightSession, generateElementDescription } from "../../lib";
import assert from "assert";
import { cleanDiscounts } from "../../lib/clean";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { customAlphabet } from "nanoid";
import { Browser } from "playwright-core";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz");

const promotionSchema = BasicDiscountSchema.extend({
  where: z.array(z.enum(["Coto", "Online"])),
  membership: z.array(z.enum(["Club La Nacion", "Comunidad Coto"])).optional(),
});

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

export async function scrapeCoto() {
  const [legales, discountData] = await (async () => {
    await using session = await createPlaywrightSession();
    const { browser } = session;
    return await Promise.all([getLegales(browser), getDiscountData(browser)]);
  })();
  console.log("discountData", discountData.size);
  const discounts: CotoDiscount[] = await Promise.all(
    Array.from(discountData.values())
      .filter(
        ({ txt }) =>
          !txt.includes("EXCLUSIVO SUCURSALES") &&
          !txt.includes("descuentos del fin de semana")
      )
      .map((data) => getDiscount({ legales, ...data }))
  );
  assert(discounts.length > 4, "Not enough discounts found");
  return cleanDiscounts(discounts);
}

async function getDiscount({
  legales,
  domDescription,
  id,
}: {
  legales: string;
  domDescription: string;
  id: string;
}): Promise<CotoDiscount> {
  console.log("getting discount", domDescription);
  const text = `Your primary task is to extract the discount information from the screenshot image, which shows a single valid promotion. The screenshot is your PRIMARY source of truth.

The legal text that follows is ONLY for supplementing specific details not visible in the screenshot:
1. Most importantly, use it to identify excluded products (excludesProducts field). Look for sections marked with **NO INCLUYE** in the legal text.
2. Look for restrictions and limitations
3. Check for validity periods if not clear in the image

The screenshot contains the accurate and current promotion information. If there's a contradiction between the image and legal text, the image ALWAYS takes precedence.

For the "where" field, look for visual indicators in the image that specify if the discount applies to physical stores (mark as "Coto"), online (mark as "Online"), or both. By default, assume discounts apply to physical stores unless explicitly stated otherwise.

Legal text for reference (use ONLY to supplement missing details, particularly for excludesProducts): \n\n${legales}

Here is the description of the DOM:
${domDescription}
`;
  const result = await generateObject({
    model: openrouter.chat("google/gemini-2.5-flash-preview:thinking"),
    schema: promotionSchema,
    temperature: 0,
    messages: [{ role: "user", content: [{ type: "text", text }] }],
    system: SYSTEM_PROMPT,
  });
  console.log("scrapped", result.object);
  return {
    ...result.object,
    source: "coto",
    url: URL,
  } as CotoDiscount;
}

async function getLegales(browser: Browser) {
  const page = await browser.newPage();
  await page.goto("https://www.coto.com.ar/legales/", {
    waitUntil: "domcontentloaded",
  });
  let legales = await page.evaluate(() => {
    const container = document.querySelector("section .container");
    ["button", "input", "#button-container"].forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        element.remove();
      });
    });
    return container?.textContent || "";
  });
  if (!legales) {
    throw new Error("No content found");
  }
  legales = legales
    .split("\n**")
    .slice(1)
    .filter(
      (c) =>
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
    legales = legales.replace(pattern, (match) => {
      return `\n\n**PRODUCT EXCLUSIONS:** ${match}\n\n`;
    });
  }
  return legales;
}

async function getDiscountData(browser: Browser) {
  const page = await browser.newPage();
  const discountData = new Map<
    string,
    { id: string; txt: string; domDescription: string }
  >();

  await page.setViewportSize({ width: 1920, height: 3840 });
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await page.evaluate(async () => {
    document.querySelectorAll(".nav").forEach((e) => e.remove());
    await new Promise((resolve) => setTimeout(resolve, 200));
    document.querySelectorAll("#discounts > *").forEach((e) => {
      (e as HTMLElement).style.position = "unset";
      (e as HTMLElement).style.display = "inline-block";
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    (document.querySelector(".portfolio-grid") as HTMLElement).style.height =
      "auto";
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const els = await page.$$("#descuentos .grid-item");
  if (!els) throw new Error("No discounts found");
  assert(els.length > 12, "muy pocos elementos");
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    const id = nanoid();
    await el.evaluate((node, id) => (node.id = id), id);
    const txt = (await el.textContent()) || "";
    const domDescription = await generateElementDescription(page, `#${id}`);
    discountData.set(id, {
      id,
      txt,
      domDescription,
    });
  }
  return discountData;
}
