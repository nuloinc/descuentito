import { z } from "zod";
import { streamObject } from "ai";
import {
  BasicDiscountSchema,
  DiaDiscount,
  genStartPrompt,
  LIMITS_PROMPT,
  PAYMENT_METHODS_PROMPT,
  RESTRICTIONS_PROMPT,
} from "promos-db/schema.ts";
import { createPlaywrightSession } from "../../lib.ts";
import assert from "node:assert";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { 
  withValidation, 
  enhancePromptWithAlerts,
  type ValidationConfig 
} from "../../lib/validation-adapter";

const URL =
  "https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones";

interface DayToShow {
  all: boolean;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

interface DiaApiPromotion {
  promotionFirstText: string;
  promotionSecondText: string;
  promotionThirdText: string;
  ModalButtonText: string;
  ModalText: string;
  ModalBankText: string;
  DarkFlag: string;
  LightFlag: string;
  isBank: boolean;
  daysToShow: DayToShow;
  logo: string;
}

interface ScrapedDiaPromotion {
  apiPromotion: DiaApiPromotion;
}

export async function scrapeDiaContent(): Promise<ScrapedDiaPromotion[]> {
  await using sessions = await createPlaywrightSession();
  const { page } = sessions;

  // Store API response data
  let apiPromotions: DiaApiPromotion[] = [];

  // desactivar popup de club dia
  await page.context().addCookies([
    {
      name: "clubdiapopup",
      value: "true",
      domain: "diaonline.supermercadosdia.com.ar",
      path: "/",
      secure: false,
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  await page.goto(URL, {
    waitUntil: "domcontentloaded",
  });
  await new Promise((resolve) => setTimeout(resolve, 3000)); // Give more time for all API calls

  // Wait for content to load to ensure API call has been made
  await page.waitForSelector(
    ".diaio-custom-bank-promotions-0-x-list-by-days__item",
  );

  // Parse promotions from __RUNTIME__ template data
  try {
    const runtimeData = await page.evaluate(() => {
      const template = document.querySelector<HTMLTemplateElement>(
        'template[data-varname="__RUNTIME__"][data-field="extensions"]',
      );
      if (template) {
        // The template contains a <script> tag with JSON data
        const script = template.content.querySelector("script");
        if (script && script.textContent) {
          return JSON.parse(script.textContent);
        }
      }
      return null;
    });

    if (runtimeData) {
      // Search for promotions in the runtime data structure
      const searchForPromotions = (obj: any): any => {
        if (obj && typeof obj === "object") {
          // Check if this is an array of promotions
          if (
            Array.isArray(obj) &&
            obj.length > 0 &&
            obj[0]?.promotionFirstText
          ) {
            return obj;
          }
          // Recursively search through object properties
          for (const value of Object.values(obj)) {
            const result = searchForPromotions(value);
            if (result) return result;
          }
        }
        return null;
      };

      const foundPromotions = searchForPromotions(runtimeData);
      if (foundPromotions) {
        console.log("Found promotions data in __RUNTIME__ template");
        apiPromotions = foundPromotions;
      }
    }
  } catch (error) {
    console.warn("Failed to parse __RUNTIME__ template:", error);
  }

  // Convert API promotions to scraped format, filtering out empty ones
  const scrapedPromotions: ScrapedDiaPromotion[] = apiPromotions
    .filter(
      (apiPromotion) =>
        apiPromotion.promotionFirstText ||
        apiPromotion.promotionSecondText ||
        apiPromotion.ModalText,
    )
    .map((apiPromotion) => ({
      apiPromotion,
    }));

  assert(scrapedPromotions.length > 0, "No promotions found");

  return scrapedPromotions;
}

function convertDaysToShowToWeekdays(
  daysToShow: DayToShow,
): (
  | "Lunes"
  | "Martes"
  | "Miercoles"
  | "Jueves"
  | "Viernes"
  | "Sabado"
  | "Domingo"
)[] {
  // Extract weekdays based only on the individual day flags
  // The "all" flag just means "show in the 'all days' filter" not "applies to all days"
  const weekdays: (
    | "Lunes"
    | "Martes"
    | "Miercoles"
    | "Jueves"
    | "Viernes"
    | "Sabado"
    | "Domingo"
  )[] = [];

  if (daysToShow.monday) weekdays.push("Lunes");
  if (daysToShow.tuesday) weekdays.push("Martes");
  if (daysToShow.wednesday) weekdays.push("Miercoles");
  if (daysToShow.thursday) weekdays.push("Jueves");
  if (daysToShow.friday) weekdays.push("Viernes");
  if (daysToShow.saturday) weekdays.push("Sabado");
  if (daysToShow.sunday) weekdays.push("Domingo");

  return weekdays;
}

export async function extractDiaDiscounts(
  scrapedPromotions: ScrapedDiaPromotion[],
) {
  let promotions: DiaDiscount[] = [];
  for (const { apiPromotion } of scrapedPromotions) {
    const { elementStream } = streamObject({
      model: openrouter.chat("google/gemini-2.5-flash-preview-05-20"),
      schema: BasicDiscountSchema.extend({
        where: z.array(z.enum(["Dia", "Online"])),
      }),
      output: "array",
      experimental_telemetry: { isEnabled: true },
      system: `${genStartPrompt("dia")}

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

WHERE

"APLICA TIENDA" means the promotion is valid in physical stores ("Dia"), "APLICA ONLINE" means it's valid in online stores.

${LIMITS_PROMPT}
`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract the promotion from the following JSON data:

Promotion Display Text: ${apiPromotion.promotionFirstText}
Secondary Text: ${apiPromotion.promotionSecondText}
Third Text: ${apiPromotion.promotionThirdText}
Dark Flag: ${apiPromotion.DarkFlag}
Light Flag: ${apiPromotion.LightFlag}
Is Bank: ${apiPromotion.isBank}

Legal Text: ${apiPromotion.ModalText}

IMPORTANT: Some promotions offer BOTH percentage discounts AND installment plans (cuotas sin interés). Extract ALL discount types mentioned. For example:
- "25% descuento + 3 cuotas sin interés" should generate TWO promotions: one for 25% discount and one for 3 installments
- Look for phrases like "cuotas sin interés", "sin interés", "cuotas", "installments" in the legal text
- If you find both percentage AND installments, create separate entries for each

Extract complete promotion(s) with all required fields based on this information.`,
            },
          ],
        },
      ],
    });
    for await (const object of elementStream) {
      const weekdays = convertDaysToShowToWeekdays(apiPromotion.daysToShow);

      const basePromotion = {
        ...object,
        source: "dia" as const,
        url: URL,
        weekdays,
      };

      promotions.push(basePromotion as DiaDiscount);
    }
  }

  // assert(promotions.length > 0, "No promotions found");

  return promotions;
}

/**
 * Enhanced version with validation system
 */
export async function extractDiaDiscountsWithValidation(
  scrapedPromotions: ScrapedDiaPromotion[],
  config: ValidationConfig = {}
) {
  const extractionFunction = async function*() {
    for (const { apiPromotion } of scrapedPromotions) {
      const { elementStream } = streamObject({
        model: openrouter.chat("google/gemini-2.5-flash-preview-05-20"),
        schema: BasicDiscountSchema.extend({
          where: z.array(z.enum(["Dia", "Online"])),
          // Add optional alerts field
          alerts: z.array(z.object({
            severity: z.enum(["low", "medium", "high"]),
            category: z.enum(["uncertainty", "inconsistency", "missing_data", "ambiguity", "validation_error"]),
            message: z.string(),
            field: z.string().optional(),
            confidence: z.number().optional(),
          })).optional(),
        }),
        output: "array",
        experimental_telemetry: { isEnabled: true },
        system: enhancePromptWithAlerts(`${genStartPrompt("dia")}

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

WHERE

"APLICA TIENDA" means the promotion is valid in physical stores ("Dia"), "APLICA ONLINE" means it's valid in online stores.

${LIMITS_PROMPT}`),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract the promotion from the following JSON data:

Promotion Display Text: ${apiPromotion.promotionFirstText}
Secondary Text: ${apiPromotion.promotionSecondText}
Third Text: ${apiPromotion.promotionThirdText}
Dark Flag: ${apiPromotion.DarkFlag}
Light Flag: ${apiPromotion.LightFlag}
Is Bank: ${apiPromotion.isBank}

Legal Text: ${apiPromotion.ModalText}

IMPORTANT: Some promotions offer BOTH percentage discounts AND installment plans (cuotas sin interés). Extract ALL discount types mentioned. For example:
- "25% descuento + 3 cuotas sin interés" should generate TWO promotions: one for 25% discount and one for 3 installments
- Look for phrases like "cuotas sin interés", "sin interés", "cuotas", "installments" in the legal text
- If you find both percentage AND installments, create separate entries for each

Extract complete promotion(s) with all required fields based on this information.`,
              },
            ],
          },
        ],
      });
      
      for await (const object of elementStream) {
        const weekdays = convertDaysToShowToWeekdays(apiPromotion.daysToShow);

        yield {
          ...object,
          source: "dia" as const,
          url: URL,
          weekdays,
        };
      }
    }
  };

  const originalContent = scrapedPromotions
    .map(p => `Promotion: ${p.apiPromotion.promotionFirstText}\nSecondary: ${p.apiPromotion.promotionSecondText}\nThird: ${p.apiPromotion.promotionThirdText}\nLegal: ${p.apiPromotion.ModalText}`)
    .join('\n\n---\n\n');

  const result = await withValidation(
    extractionFunction,
    originalContent,
    "dia",
    config
  );

  assert(result.accepted.length > 0, "No promotions accepted after validation");

  return result;
}

// Backward compatibility function
export async function scrapeDia() {
  const contentData = await scrapeDiaContent();
  return await extractDiaDiscounts(contentData);
}

/**
 * Enhanced version of scrapeDia with validation system
 * Returns only accepted discounts by default, but provides full stats
 */
export async function scrapeDiaWithValidation(config: ValidationConfig = {}) {
  const contentData = await scrapeDiaContent();
  const result = await extractDiaDiscountsWithValidation(contentData, config);
  
  // Log summary for monitoring
  console.log(`[DIA] Validation Results:`, {
    extracted: result.stats.extracted,
    accepted: result.stats.accepted,
    needsReview: result.stats.needsReview,
    rejected: result.stats.rejected,
    avgConfidence: result.stats.avgConfidence,
    totalAlerts: result.stats.totalAlerts,
  });

  if (result.needsReview.length > 0) {
    console.log(`[DIA] ${result.needsReview.length} discounts need manual review`);
  }

  if (result.rejected.length > 0) {
    console.log(`[DIA] ${result.rejected.length} discounts were rejected`);
  }

  // Return the full result for flexibility, not just accepted
  return result;
}
