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
import { runCasharComparison } from "../lib/cashar-comparison.ts";

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

const command = process.argv[2] as ScraperName | "all" | "compare-cashar";
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
        commit.updateDiscountsCount(results.length);
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

async function runCasharComparisonCommand() {
  console.log('🔍 Running Cashar.pro comparison...\n');
  
  try {
    const result = await runCasharComparison();
    
    console.log('📊 COMPARISON RESULTS:');
    console.log(`Cashar discounts: ${result.casharTotal}`);
    console.log(`Our discounts: ${result.ourTotal}`);
    console.log(`Missing: ${result.missing}`);
    console.log(`Flexible matches: ${result.flexibleMatches}`);
    
    if (result.missingHighValue.length > 0) {
      console.log('\n🎯 HIGH-VALUE MISSING (25%+):');
      result.missingHighValue.slice(0, 10).forEach((missing, i) => {
        console.log(`${i + 1}. ${missing.store.toUpperCase()} ${missing.percentage}% on ${missing.weekday}`);
        console.log(`   Payment: ${missing.paymentMethod}`);
        console.log(`   Source: "${missing.source}"`);
      });
    }
    
    if (result.topMissing.length > 0) {
      console.log('\n🔴 TOP MISSING OPPORTUNITIES:');
      result.topMissing.slice(0, 10).forEach((missing, i) => {
        console.log(`${i + 1}. ${missing.store.toUpperCase()} ${missing.percentage}% on ${missing.weekday}`);
        console.log(`   Payment: ${missing.paymentMethod}`);
        console.log(`   Source: "${missing.source}"`);
      });
    }
    
    // Send to Telegram if requested
    if (telegramFlag) {
      console.log('\n📱 Sending results to Telegram...');
      try {
        await telegramNotifier.sendCasharComparison(result);
        console.log('✅ Telegram notification sent successfully');
      } catch (error) {
        console.error('❌ Failed to send Telegram notification:', error);
      }
    }
    
    console.log('\n✅ Comparison complete!');
    
  } catch (error) {
    console.error('❌ Error running comparison:', error);
    process.exit(1);
  }
}

async function main() {
  if (!command) {
    console.error("Please provide a command");
    console.error("Available commands:");
    console.error("  Scrapers:", Object.keys(scrapers).join(", "));
    console.error("  Other: all, compare-cashar");
    process.exit(1);
  }

  if (command === "compare-cashar") {
    await runCasharComparisonCommand();
    return;
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
        
        // Run Cashar comparison after successful batch scraping
        if (batchResults.some(r => r.success)) {
          console.log('Running Cashar.pro comparison...');
          try {
            const comparisonResult = await runCasharComparison();
            await telegramNotifier.sendCasharComparison(comparisonResult);
          } catch (error) {
            console.error("Failed to run Cashar comparison:", error);
          }
        }
      } catch (error) {
        console.error("Failed to send batch Telegram notification:", error);
      }
    }
    return;
  }

  const scraper = scrapers[command];
  if (!scraper) {
    console.error(`Unknown command: ${command}`);
    console.error("Available commands:");
    console.error("  Scrapers:", Object.keys(scrapers).join(", "));
    console.error("  Other: all, compare-cashar");
    process.exit(1);
  }

  try {
    await runSingleScraper(command, scraper);
    
    // Run Cashar comparison after successful single scraping (if saving)
    if (saveFlag) {
      console.log('Running Cashar.pro comparison...');
      try {
        const comparisonResult = await runCasharComparison();
        await telegramNotifier.sendCasharComparison(comparisonResult);
      } catch (error) {
        console.error("Failed to run Cashar comparison:", error);
      }
    }
  } catch (error) {
    console.error("Error running scraper:", error);
    process.exit(1);
  }
}

if ((import.meta as any).main) {
  main();
}
