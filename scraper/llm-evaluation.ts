#!/usr/bin/env bun
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { openrouter } from "@openrouter/ai-sdk-provider";
import type { Discount, GenericDiscount } from "../promos-db/schema";

// Configuration for different LLM models to test (OpenRouter only)
const MODELS_TO_TEST = [
  {
    name: "gemini-2.5-flash",
    model: openrouter.chat("google/gemini-2.5-flash-preview-05-20"),
  },
  {
    name: "gemini-2.0-flash",
    model: openrouter.chat("google/gemini-2.0-flash-exp-free"),
  },
  {
    name: "gpt-4o-mini",
    model: openrouter.chat("openai/gpt-4o-mini"),
  },
];

// Important fields to compare (excluding restrictions, etc.)
const IMPORTANT_FIELDS: (keyof GenericDiscount)[] = [
  "discount",
  "validFrom",
  "validUntil",
  "weekdays",
  "paymentMethods",
  "limits",
  "excludesProducts",
  "onlyForProducts",
];

interface ExtractionResult {
  modelName: string;
  source: string;
  extractedDiscounts: Discount[];
  errors: string[];
  executionTimeMs: number;
  timestamp: string;
}

// Helper functions to create model-specific extractors
async function createModelExtractor(model: any, source: string) {
  switch (source) {
    case "carrefour":
      return await createCarrefourExtractor(model);
    case "coto":
      return await createCotoExtractor(model);
    case "dia":
      return await createDiaExtractor(model);
    case "jumbo":
      return await createJumboExtractor(model);
    case "changomas":
      return await createChangoMasExtractor(model);
    case "makro":
      return await createMakroExtractor(model);
    default:
      throw new Error(`Unknown source: ${source}`);
  }
}

async function createCarrefourExtractor(model: any) {
  const { z } = await import("zod");
  const { generateObject } = await import("ai");
  const {
    BasicDiscountSchema,
    genStartPrompt,
    LIMITS_PROMPT,
    PAYMENT_METHODS_PROMPT,
    RESTRICTIONS_PROMPT,
  } = await import("../promos-db/schema");

  const DiscountSchema = BasicDiscountSchema.extend({
    where: z.array(z.enum(["Carrefour", "Maxi", "Market", "Express", "Online"])),
    membership: z.array(z.enum(["Mi Carrefour"])).optional(),
  });

  return async function extractCarrefourDiscounts(promotionsData: { domDescription: string }[]) {
    const promotions = await Promise.all(
      promotionsData.map(async ({ domDescription }) => {
        const { object } = await generateObject({
          model,
          schema: DiscountSchema,
          temperature: 0,
          experimental_telemetry: { isEnabled: true },
          system: `${genStartPrompt("Carrefour")}

${PAYMENT_METHODS_PROMPT}

Tarjeta Carrefour Prepaga/Crédito are DISTINCT from "Mi Carrefour" which is a membership program.

${RESTRICTIONS_PROMPT}

WHERE

"Comprando en:" describes WHERE the discount is valid. "logo$TYPE" is for Carrefour $TYPE. If the same discount is valid in different places, return all of them.

${LIMITS_PROMPT}`,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract the discount from the following pseudo-html: \\n\\n" + domDescription,
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
      })
    );

    return promotions;
  };
}

async function createCotoExtractor(model: any) {
  const { z } = await import("zod");
  const { generateObject } = await import("ai");
  const {
    BasicDiscountSchema,
    genStartPrompt,
    LIMITS_PROMPT,
    PAYMENT_METHODS_PROMPT,
    RESTRICTIONS_PROMPT,
    PRODUCTS_PROMPT,
  } = await import("../promos-db/schema");

  const DiscountSchema = BasicDiscountSchema.extend({
    where: z.array(z.enum(["Coto", "Online"])),
    membership: z.array(z.enum(["Comunidad Coto"])).optional(),
  });

  return async function extractCotoDiscounts(promotionsData: { domDescription: string }[]) {
    const promotions = await Promise.all(
      promotionsData.map(async ({ domDescription }) => {
        const { object } = await generateObject({
          model,
          schema: DiscountSchema,
          temperature: 0,
          experimental_telemetry: { isEnabled: true },
          system: `${genStartPrompt("Coto")}

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

${PRODUCTS_PROMPT}

${LIMITS_PROMPT}`,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract the discount from the following pseudo-html: \\n\\n" + domDescription,
                },
              ],
            },
          ],
        });

        return {
          ...object,
          url: "https://www.coto.com.ar/descuentos",
          source: "coto",
        };
      })
    );

    return promotions;
  };
}

async function createDiaExtractor(model: any) {
  const { z } = await import("zod");
  const { generateObject } = await import("ai");
  const {
    BasicDiscountSchema,
    genStartPrompt,
    LIMITS_PROMPT,
    PAYMENT_METHODS_PROMPT,
    RESTRICTIONS_PROMPT,
  } = await import("../promos-db/schema");

  const DiscountSchema = BasicDiscountSchema.extend({
    where: z.array(z.enum(["Dia", "Online"])),
  });

  return async function extractDiaDiscounts(promotionsData: { domDescription: string }[]) {
    const promotions = await Promise.all(
      promotionsData.map(async ({ domDescription }) => {
        const { object } = await generateObject({
          model,
          schema: DiscountSchema,
          temperature: 0,
          experimental_telemetry: { isEnabled: true },
          system: `${genStartPrompt("Dia")}

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

${LIMITS_PROMPT}`,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract the discount from the following pseudo-html: \\n\\n" + domDescription,
                },
              ],
            },
          ],
        });

        return {
          ...object,
          url: "https://diaonline.supermercadosdia.com.ar/beneficios",
          source: "dia",
        };
      })
    );

    return promotions;
  };
}

async function createJumboExtractor(model: any) {
  const { z } = await import("zod");
  const { generateObject } = await import("ai");
  const {
    BasicDiscountSchema,
    genStartPrompt,
    LIMITS_PROMPT,
    PAYMENT_METHODS_PROMPT,
    RESTRICTIONS_PROMPT,
    PAYMENT_METHODS,
  } = await import("../promos-db/schema");

  const DiscountSchema = BasicDiscountSchema.extend({
    where: z.array(z.enum(["Jumbo", "Online"])),
    paymentMethods: z.array(z.array(z.enum(PAYMENT_METHODS))).optional(),
  });

  return async function extractJumboDiscounts(promotionsData: { domDescription: string }[]) {
    const promotions = await Promise.all(
      promotionsData.map(async ({ domDescription }) => {
        const { object } = await generateObject({
          model,
          schema: DiscountSchema,
          temperature: 0,
          experimental_telemetry: { isEnabled: true },
          system: `${genStartPrompt("Jumbo")}

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

${LIMITS_PROMPT}`,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract the discount from the following pseudo-html: \\n\\n" + domDescription,
                },
              ],
            },
          ],
        });

        return {
          ...object,
          url: "https://www.jumbo.com.ar/",
          source: "jumbo",
        };
      })
    );

    return promotions;
  };
}

async function createChangoMasExtractor(model: any) {
  const { z } = await import("zod");
  const { generateObject } = await import("ai");
  const {
    BasicDiscountSchema,
    genStartPrompt,
    LIMITS_PROMPT,
    PAYMENT_METHODS_PROMPT,
    RESTRICTIONS_PROMPT,
  } = await import("../promos-db/schema");

  const DiscountSchema = BasicDiscountSchema.extend({
    where: z.array(z.enum(["ChangoMas", "Online"])),
  });

  return async function extractChangoMasDiscounts(promotionsData: { domDescription: string }[]) {
    const promotions = await Promise.all(
      promotionsData.map(async ({ domDescription }) => {
        const { object } = await generateObject({
          model,
          schema: DiscountSchema,
          temperature: 0,
          experimental_telemetry: { isEnabled: true },
          system: `${genStartPrompt("ChangoMas")}

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

${LIMITS_PROMPT}`,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract the discount from the following pseudo-html: \\n\\n" + domDescription,
                },
              ],
            },
          ],
        });

        return {
          ...object,
          url: "https://www.changomas.com.ar/",
          source: "changomas",
        };
      })
    );

    return promotions;
  };
}

async function createMakroExtractor(model: any) {
  const { z } = await import("zod");
  const { generateObject } = await import("ai");
  const {
    BasicDiscountSchema,
    genStartPrompt,
    LIMITS_PROMPT,
    PAYMENT_METHODS_PROMPT,
    RESTRICTIONS_PROMPT,
  } = await import("../promos-db/schema");

  const DiscountSchema = BasicDiscountSchema.extend({
    where: z.array(z.enum(["Makro"])),
  });

  return async function extractMakroDiscounts(promotionsData: { domDescription: string }[]) {
    const promotions = await Promise.all(
      promotionsData.map(async ({ domDescription }) => {
        const { object } = await generateObject({
          model,
          schema: DiscountSchema,
          temperature: 0,
          experimental_telemetry: { isEnabled: true },
          system: `${genStartPrompt("Makro")}

${PAYMENT_METHODS_PROMPT}

${RESTRICTIONS_PROMPT}

${LIMITS_PROMPT}`,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract the discount from the following pseudo-html: \\n\\n" + domDescription,
                },
              ],
            },
          ],
        });

        return {
          ...object,
          url: "https://www.makro.com.ar/",
          source: "makro",
        };
      })
    );

    return promotions;
  };
}

class LLMEvaluator {
  private outputDir: string;

  constructor() {
    // Check required environment variables
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY environment variable is required");
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    this.outputDir = join(process.cwd(), "llm-evaluation-results", timestamp);
  }

  private async loadScrapedData(source: string): Promise<ScrapedData[]> {
    const dataPath = join(process.env.HOME!, "proy", "descuentito-data", "scrapped", `${source}.json`);
    try {
      const content = await readFile(dataPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load scraped data for ${source}: ${error}`);
    }
  }

  private async saveResults(result: ExtractionResult): Promise<void> {
    await mkdir(this.outputDir, { recursive: true });
    const filename = `${result.modelName}-${result.source}.json`;
    const filepath = join(this.outputDir, filename);
    await writeFile(filepath, JSON.stringify(result, null, 2));
  }

  private async extractWithModel(
    model: typeof MODELS_TO_TEST[0],
    scrapedData: { domDescription: string }[],
    source: string
  ): Promise<Discount[]> {
    const extractor = await createModelExtractor(model.model, source);
    return await extractor(scrapedData);
  }

  async extractForModel(model: typeof MODELS_TO_TEST[0], source: string): Promise<ExtractionResult> {
    console.log(`Extracting ${source} with ${model.name}...`);
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      const scrapedData = await this.loadScrapedData(source);
      const extractedDiscounts = await this.extractWithModel(model, scrapedData, source);
      
      const executionTime = Date.now() - startTime;
      const timestamp = new Date().toISOString();

      return {
        modelName: model.name,
        source,
        extractedDiscounts,
        errors,
        executionTimeMs: executionTime,
        timestamp,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      errors.push(error instanceof Error ? error.message : String(error));
      
      return {
        modelName: model.name,
        source,
        extractedDiscounts: [],
        errors,
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async runEvaluation(): Promise<void> {
    const sources = ["carrefour", "coto", "dia", "jumbo", "changomas", "makro"];

    console.log("Starting LLM evaluation...\n");
    console.log(`Results will be saved to: ${this.outputDir}\n`);

    for (const model of MODELS_TO_TEST) {
      console.log(`Testing ${model.name}...`);
      
      for (const source of sources) {
        try {
          const result = await this.extractForModel(model, source);
          await this.saveResults(result);
          
          console.log(`  ${source}: ${result.extractedDiscounts.length} discounts extracted, ${result.executionTimeMs}ms`);
          if (result.errors.length > 0) {
            console.log(`    Errors: ${result.errors.length}`);
          }
        } catch (error) {
          console.error(`  ${source}: ERROR - ${error}`);
        }
      }
      console.log();
    }

    // Save reference data for comparison
    console.log("Copying reference data...");
    for (const source of sources) {
      try {
        const referenceData = await this.loadReferenceData(source);
        const refPath = join(this.outputDir, `reference-${source}.json`);
        await writeFile(refPath, JSON.stringify(referenceData, null, 2));
      } catch (error) {
        console.warn(`Could not copy reference data for ${source}:`, error);
      }
    }

    console.log(`\nEvaluation complete! Results saved to: ${this.outputDir}`);
  }

  private async loadReferenceData(source: string): Promise<Discount[]> {
    const dataPath = join(process.env.HOME!, "proy", "descuentito-data", `${source}.json`);
    try {
      const content = await readFile(dataPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load reference data for ${source}: ${error}`);
    }
  }
}

// Main execution
async function main() {
  const evaluator = new LLMEvaluator();
  
  try {
    await evaluator.runEvaluation();
  } catch (error) {
    console.error("Evaluation failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { LLMEvaluator, type ExtractionResult };