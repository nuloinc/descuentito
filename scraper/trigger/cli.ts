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
import { useCommit } from "../lib/git";
import { GenericDiscount } from "promos-db/schema.ts";
import { mkdirSync, writeFileSync } from "node:fs";

// Generic interface for scraper functions with flexible content and result types
interface ScraperFunctions<TContent = any> {
  scrapeContent: () => Promise<TContent>;
  extractDiscounts: (content: TContent) => Promise<GenericDiscount[]>;
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

const scraperName = process.argv[2] as ScraperName | "all";
const saveFlag = process.argv.includes("--save");
const skipExtracting = process.argv.includes("--skip-extract");

async function runSingleScraper(
  scraperName: string,
  scraper: ScraperFunctions
) {
  await using commit = await (saveFlag
    ? useCommit(scraperName)
    : Promise.resolve(undefined));

  console.log(`[${scraperName}] Scraping content...`);
  const scrapedContent = await scraper.scrapeContent();
  if (commit) {
    mkdirSync(`${commit.dir}/scrapped`, { recursive: true });
    writeFileSync(
      `${commit.dir}/scrapped/${scraperName}.json`,
      JSON.stringify(scrapedContent, null, 2)
    );
  } else {
    console.log(JSON.stringify(scrapedContent, null, 2));
  }

  if (!skipExtracting) {
    console.log(`[${scraperName}] Extracting promotions using LLM...`);
    const results = await scraper.extractDiscounts(scrapedContent);
    if (commit) {
      writeFileSync(
        `${commit.dir}/${scraperName}.json`,
        JSON.stringify(results, null, 2)
      );
    } else {
      console.log(JSON.stringify(results, null, 2));
    }
  }
}

async function main() {
  if (!scraperName) {
    console.error("Please provide a scraper name");
    console.error("Available scrapers:", Object.keys(scrapers).join(", "));
    process.exit(1);
  }

  if (scraperName === "all") {
    for (const [name, scraper] of Object.entries(scrapers)) {
      try {
        console.log(`Running ${name} scraper...`);
        await runSingleScraper(name, scraper);
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
    await runSingleScraper(scraperName, scraper);
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
