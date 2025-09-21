#!/usr/bin/env bun
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
import { telegramNotifier } from "../lib/telegram.js";

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

const command = process.argv[2] as ScraperName | "all";
const saveFlag = process.argv.includes("--save");
const skipExtracting = process.argv.includes("--skip-extract");
const telegramFlag = process.argv.includes("--telegram");
const prOnlyFlag = process.argv.includes("--pr-only");

async function runSingleScraper(
  scraperName: string,
  scraper: ScraperFunctions,
) {
  const executionStartTime = Date.now();

  try {
    await using commit = await (saveFlag
      ? useCommit(scraperName, { executionStartTime, prOnly: prOnlyFlag })
      : Promise.resolve(undefined));

    console.log(`[${scraperName}] Scraping content...`);
    const scrapedContent = await scraper.scrapeContent();
    if (commit) {
      mkdirSync(`${commit.dir}/scrapped`, { recursive: true });
      writeFileSync(
        `${commit.dir}/scrapped/${scraperName}.json`,
        JSON.stringify(scrapedContent, null, 2),
      );
    } else {
      console.log(JSON.stringify(scrapedContent, null, 2));
    }

    if (!skipExtracting) {
      console.log(`[${scraperName}] Extracting promotions using LLM...`);
      const results = await scraper.extractDiscounts(scrapedContent);

      if (commit) {
        commit.setCurrentDiscounts(results);
        writeFileSync(
          `${commit.dir}/${scraperName}.json`,
          JSON.stringify(results, null, 2),
        );
      } else {
        console.log(JSON.stringify(results, null, 2));
      }
    }
  } catch (error) {
    // Send error notification if saving is enabled
    if (saveFlag) {
      await telegramNotifier.sendScrapingComplete({
        scraper: scraperName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stackTrace: error instanceof Error ? error.stack : undefined,
        executionTime: Date.now() - executionStartTime,
      });
    }
    throw error; // Re-throw to maintain existing error handling
  }
}

async function main() {
  if (!command) {
    console.error("Please provide a command");
    console.error("Available commands:");
    console.error("  Scrapers:", Object.keys(scrapers).join(", "));
    console.error("  Other: all");
    process.exit(1);
  }

  if (command === "all") {
    const batchResults: Array<{
      scraper: string;
      success: boolean;
      discountsFound?: number;
      executionTime?: number;
      error?: string;
      stackTrace?: string;
    }> = [];

    for (const [name, scraper] of Object.entries(scrapers)) {
      const startTime = Date.now();
      try {
        console.log(`Running ${name} scraper...`);
        await runSingleScraper(name, scraper);
        batchResults.push({
          scraper: name,
          success: true,
          executionTime: Date.now() - startTime,
        });
      } catch (error) {
        console.error(`Error running ${name} scraper:`, error);
        batchResults.push({
          scraper: name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          stackTrace: error instanceof Error ? error.stack : undefined,
          executionTime: Date.now() - startTime,
        });
      }
    }

    // Send batch notification if saving is enabled
    if (saveFlag) {
      try {
        await telegramNotifier.sendBatchComplete(batchResults);
      } catch (error) {
        console.error("Failed to send batch Telegram notification:", error);
      }
      const successes = batchResults.reduce(
        (prev, curr) => prev + (curr.success ? 1 : 0),
        0,
      );
      if (process.env.FINISHED_URL && successes > batchResults.length * 0.7) {
        await fetch(process.env.FINISHED_URL, { method: "POST" });
      }
    }
    return;
  }

  const scraper = scrapers[command];
  if (!scraper) {
    console.error(`Unknown command: ${command}`);
    console.error("Available commands:");
    console.error("  Scrapers:", Object.keys(scrapers).join(", "));
    console.error("  Other: all");
    process.exit(1);
  }

  try {
    await runSingleScraper(command, scraper);
  } catch (error) {
    console.error("Error running scraper:", error);
    process.exit(1);
  }
}

if ((import.meta as any).main) {
  main();
}
