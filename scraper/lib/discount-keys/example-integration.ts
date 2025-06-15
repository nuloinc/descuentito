/**
 * Integration examples showing how to add unique discount keys to scrapers
 */

import { generateUniqueDiscountKeys, generateDiscountKey } from "./discount-keys";
import { analyzeDiscountKeys, generateAnalysisReport } from "./discount-analysis";
import type { Discount, CarrefourDiscount, CotoDiscount } from "promos-db/schema";

// Example 1: Basic integration - adding keys to scraped discounts
export function addKeysToDiscounts<T extends Discount>(discounts: T[]): Array<T & { uniqueKey: string }> {
  const keys = generateUniqueDiscountKeys(discounts);
  
  return discounts.map((discount, index) => ({
    ...discount,
    uniqueKey: keys[index]
  }));
}

// Example 2: Integration with existing scraper pattern
export class EnhancedDiscountScraper {
  /**
   * Example of how to integrate key generation into a scraper class
   */
  async scrapeDiscountsWithKeys(source: string): Promise<Array<Discount & { uniqueKey: string }>> {
    // 1. Scrape discounts using existing logic (mock example)
    const rawDiscounts = await this.scrapeRawDiscounts(source);
    
    // 2. Process into standard discount format
    const processedDiscounts = this.processDiscounts(rawDiscounts);
    
    // 3. Add unique keys
    const discountsWithKeys = addKeysToDiscounts(processedDiscounts);
    
    // 4. Optional: Generate analysis report
    if (process.env.NODE_ENV === 'development') {
      const analysis = analyzeDiscountKeys(processedDiscounts);
      console.log(generateAnalysisReport(analysis));
    }
    
    return discountsWithKeys;
  }
  
  private async scrapeRawDiscounts(source: string): Promise<any[]> {
    // Mock implementation - replace with actual scraping logic
    return [];
  }
  
  private processDiscounts(rawData: any[]): Discount[] {
    // Mock implementation - replace with actual processing logic
    return [];
  }
}

// Example 3: Using keys for change detection
export class DiscountChangeDetector {
  private previousKeys = new Set<string>();
  
  detectChanges(newDiscounts: Discount[]): {
    added: Array<Discount & { uniqueKey: string }>;
    removed: string[];
    unchanged: Array<Discount & { uniqueKey: string }>;
  } {
    const discountsWithKeys = addKeysToDiscounts(newDiscounts);
    const newKeys = new Set(discountsWithKeys.map(d => d.uniqueKey));
    
    const added = discountsWithKeys.filter(d => !this.previousKeys.has(d.uniqueKey));
    const removed = Array.from(this.previousKeys).filter(key => !newKeys.has(key));
    const unchanged = discountsWithKeys.filter(d => this.previousKeys.has(d.uniqueKey));
    
    // Update stored keys
    this.previousKeys = newKeys;
    
    return { added, removed, unchanged };
  }
}

// Example 4: Integration with data persistence
export class DiscountDataManager {
  /**
   * Save discounts with keys to storage (file, database, etc.)
   */
  async saveDiscountsWithKeys(discounts: Discount[], filepath: string): Promise<void> {
    const discountsWithKeys = addKeysToDiscounts(discounts);
    
    // Add metadata
    const dataWithMetadata = {
      metadata: {
        scrapedAt: new Date().toISOString(),
        totalDiscounts: discounts.length,
        uniqueKeys: new Set(discountsWithKeys.map(d => d.uniqueKey)).size,
        sources: [...new Set(discounts.map(d => d.source))]
      },
      discounts: discountsWithKeys
    };
    
    // Save to file (example)
    const fs = await import('fs');
    fs.writeFileSync(filepath, JSON.stringify(dataWithMetadata, null, 2));
    
    console.log(`Saved ${discounts.length} discounts with ${dataWithMetadata.metadata.uniqueKeys} unique keys to ${filepath}`);
  }
  
  /**
   * Load and validate discount keys from storage
   */
  async loadDiscountsWithKeys(filepath: string): Promise<Array<Discount & { uniqueKey: string }>> {
    const fs = await import('fs');
    const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    
    if (!data.discounts) {
      throw new Error('Invalid discount data format');
    }
    
    // Validate that keys are still consistent
    const discountsWithKeys = data.discounts as Array<Discount & { uniqueKey: string }>;
    const currentKeys = generateUniqueDiscountKeys(discountsWithKeys);
    
    let inconsistentCount = 0;
    discountsWithKeys.forEach((discount, index) => {
      if (discount.uniqueKey !== currentKeys[index]) {
        console.warn(`Key inconsistency detected for discount ${index}: stored="${discount.uniqueKey}", current="${currentKeys[index]}"`);
        inconsistentCount++;
      }
    });
    
    if (inconsistentCount > 0) {
      console.warn(`Found ${inconsistentCount} key inconsistencies. Consider regenerating keys.`);
    }
    
    return discountsWithKeys;
  }
}

// Example 5: CLI utility for adding keys to existing data
export async function addKeysToExistingData(inputPath: string, outputPath: string): Promise<void> {
  const fs = await import('fs');
  
  try {
    // Load existing discount data
    const existingData = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as Discount[];
    
    console.log(`Loaded ${existingData.length} discounts from ${inputPath}`);
    
    // Generate analysis before adding keys
    const analysis = analyzeDiscountKeys(existingData);
    console.log(`Current uniqueness: ${analysis.uniquenessRate.toFixed(1)}% (${analysis.uniqueKeys}/${analysis.totalDiscounts})`);
    
    // Add keys
    const discountsWithKeys = addKeysToDiscounts(existingData);
    
    // Save enhanced data
    fs.writeFileSync(outputPath, JSON.stringify(discountsWithKeys, null, 2));
    
    console.log(`✅ Enhanced ${discountsWithKeys.length} discounts with unique keys`);
    console.log(`💾 Saved to ${outputPath}`);
    
    // Show sample keys
    console.log(`\nSample keys:`);
    discountsWithKeys.slice(0, 5).forEach((discount, i) => {
      console.log(`  ${i + 1}. ${discount.uniqueKey} (${discount.source} ${discount.discount.value}%)`);
    });
    
  } catch (error) {
    console.error(`Error processing ${inputPath}:`, error);
    throw error;
  }
}

// Example 6: Real-time key generation during scraping
export class RealTimeDiscountProcessor {
  private seenKeys = new Set<string>();
  private duplicateCount = 0;
  
  processDiscountInRealTime(discount: Discount): Discount & { uniqueKey: string; isDuplicate: boolean } {
    const key = generateDiscountKey(discount);
    const isDuplicate = this.seenKeys.has(key);
    
    if (isDuplicate) {
      this.duplicateCount++;
      console.log(`⚠️  Duplicate discount detected: ${key}`);
    } else {
      this.seenKeys.add(key);
    }
    
    return {
      ...discount,
      uniqueKey: key,
      isDuplicate
    };
  }
  
  getStats(): { total: number; unique: number; duplicates: number } {
    return {
      total: this.seenKeys.size + this.duplicateCount,
      unique: this.seenKeys.size,
      duplicates: this.duplicateCount
    };
  }
  
  reset(): void {
    this.seenKeys.clear();
    this.duplicateCount = 0;
  }
}

// Example 7: Integration with existing scraper files
export function integrateWithCarrefourScraper() {
  /**
   * Example showing how to modify an existing scraper like carrefour.ts
   */
  
  // Before (typical scraper flow):
  async function originalScraperFlow(): Promise<CarrefourDiscount[]> {
    // 1. Scrape content
    const scrapedContent = await scrapeCarrefourContent();
    
    // 2. Extract discounts
    const discounts = await extractCarrefourDiscounts(scrapedContent);
    
    return discounts;
  }
  
  // After (with key integration):
  async function enhancedScraperFlow(): Promise<Array<CarrefourDiscount & { uniqueKey: string }>> {
    // 1. Scrape content
    const scrapedContent = await scrapeCarrefourContent();
    
    // 2. Extract discounts
    const discounts = await extractCarrefourDiscounts(scrapedContent);
    
    // 3. Add unique keys
    const discountsWithKeys = addKeysToDiscounts(discounts);
    
    // 4. Optional: Log analysis for monitoring
    if (process.env.NODE_ENV !== 'production') {
      const analysis = analyzeDiscountKeys(discounts);
      console.log(`Carrefour scraping results: ${analysis.uniquenessRate.toFixed(1)}% unique (${analysis.uniqueKeys}/${analysis.totalDiscounts})`);
      
      if (analysis.duplicateGroups.length > 0) {
        console.log(`⚠️  Found ${analysis.duplicateGroups.length} duplicate groups - consider investigating`);
      }
    }
    
    return discountsWithKeys;
  }
  
  // Mock functions (replace with actual implementations)
  async function scrapeCarrefourContent(): Promise<any> { return {}; }
  async function extractCarrefourDiscounts(content: any): Promise<CarrefourDiscount[]> { return []; }
}

// Example 8: Batch processing utility
export class BatchDiscountProcessor {
  async processMultipleSources(sources: string[]): Promise<Map<string, Array<Discount & { uniqueKey: string }>>> {
    const results = new Map<string, Array<Discount & { uniqueKey: string }>>();
    
    for (const source of sources) {
      try {
        console.log(`Processing ${source}...`);
        
        // Load source data (mock - replace with actual loading logic)
        const discounts = await this.loadSourceData(source);
        
        // Add keys
        const discountsWithKeys = addKeysToDiscounts(discounts);
        
        // Analyze
        const analysis = analyzeDiscountKeys(discounts);
        console.log(`  ${source}: ${analysis.uniquenessRate.toFixed(1)}% unique (${analysis.uniqueKeys}/${analysis.totalDiscounts})`);
        
        results.set(source, discountsWithKeys);
        
      } catch (error) {
        console.error(`Error processing ${source}:`, error);
        results.set(source, []);
      }
    }
    
    return results;
  }
  
  private async loadSourceData(source: string): Promise<Discount[]> {
    // Mock implementation - replace with actual data loading
    return [];
  }
}

// Example CLI usage
if (require.main === module) {
  // Example command line usage
  const args = process.argv.slice(2);
  
  if (args.length === 2) {
    const [inputPath, outputPath] = args;
    addKeysToExistingData(inputPath, outputPath)
      .then(() => console.log('✅ Key addition completed'))
      .catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage: node example-integration.js <input-file> <output-file>');
    console.log('Example: node example-integration.js ../descuentito-data/carrefour.json carrefour-with-keys.json');
  }
}