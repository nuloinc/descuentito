#!/usr/bin/env bun
import { sdk } from "./lib/instrumentation.ts";
import {
  scrapeJumboContent,
  extractJumboDiscounts,
  scrapeMakroContent,
  extractMakroDiscounts,
  scrapeDiaContent,
  extractDiaDiscounts,
  scrapeCarrefourContent,
  extractCarrefourDiscounts,
  scrapeChangoMasContent,
  extractChangoMasDiscounts,
  scrapeCotoContent,
  extractCotoDiscounts,
} from "./scrapers";
import { savePromotions } from "../lib/git";

// Generic interface for scraper functions with flexible content and result types
interface ScraperFunctions<TContent = any, TResult = any> {
  scrapeContent: () => Promise<TContent>;
  extractDiscounts: (content: TContent) => Promise<TResult>;
}

// Define scrapers with the proper interface
const scrapers: Record<string, ScraperFunctions> = {
  jumbo: {
    scrapeContent: scrapeJumboContent,
    extractDiscounts: extractJumboDiscounts,
  },
  makro: {
    scrapeContent: scrapeMakroContent,
    extractDiscounts: extractMakroDiscounts,
  },
  dia: {
    scrapeContent: scrapeDiaContent,
    extractDiscounts: extractDiaDiscounts,
  },
  carrefour: {
    scrapeContent: scrapeCarrefourContent,
    extractDiscounts: extractCarrefourDiscounts,
  },
  changomas: {
    scrapeContent: scrapeChangoMasContent,
    extractDiscounts: extractChangoMasDiscounts,
  },
  coto: {
    scrapeContent: scrapeCotoContent,
    extractDiscounts: extractCotoDiscounts,
  },
};

type ScraperName = keyof typeof scrapers;

async function processScraperResults(
  scraperName: string,
  results: any,
  saveFlag: boolean
) {
  if (saveFlag) {
    await savePromotions(undefined, scraperName, results);
    console.log(`Promotions saved for ${scraperName}`);
  } else {
    console.log(JSON.stringify(results, null, 2));
  }
}

async function main() {
  const scraperName = process.argv[2] as ScraperName | "all";
  const saveFlag = process.argv.includes("--save");
  const skipExtracting = process.argv.includes("--skip-extract");

  if (!scraperName) {
    console.error("Please provide a scraper name");
    console.error("Available scrapers:", Object.keys(scrapers).join(", "));
    process.exit(1);
  }

  if (scraperName === "all") {
    for (const [name, scraper] of Object.entries(scrapers)) {
      try {
        console.log(`Running ${name} scraper...`);

        // Step 1: Scrape content
        console.log(`[${name}] Scraping content...`);
        const scrapedContent = await scraper.scrapeContent();

        if (skipExtracting) {
          console.log(
            `[${name}] Skipping discount extraction (--skip-extract flag used)`
          );
          await processScraperResults(name, scrapedContent, saveFlag);
          continue;
        }

        // Step 2: Extract promotions using LLM
        console.log(`[${name}] Extracting promotions using LLM...`);
        const results = await scraper.extractDiscounts(scrapedContent);

        await processScraperResults(name, results, saveFlag);
      } catch (error) {
        console.error(`Error running ${name} scraper:`, error);
      }
    }
    return;
  }

  const scraper = scrapers[scraperName];
  if (!scraper) {
    console.error(`Unknown scraper: ${scraperName}`);
    console.error("Available scrapers:", Object.keys(scrapers).join(", "));
    process.exit(1);
  }

  try {
    // Step 1: Scrape content
    console.log(`[${scraperName}] Scraping content...`);
    const scrapedContent = await scraper.scrapeContent();

    if (skipExtracting) {
      console.log(
        `[${scraperName}] Skipping LLM extraction (--skip-llm flag used)`
      );
      await processScraperResults(scraperName, scrapedContent, saveFlag);
      return;
    }

    // Step 2: Extract promotions using LLM
    console.log(`[${scraperName}] Extracting promotions using LLM...`);
    const results = await scraper.extractDiscounts(scrapedContent);

    await processScraperResults(scraperName, results, saveFlag);
  } catch (error) {
    console.error("Error running scraper:", error);
    process.exit(1);
  }
}

if ((import.meta as any).main) {
  main().finally(() => {
    sdk.shutdown();
  });
}
