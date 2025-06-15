import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  addKeysToDiscounts,
  EnhancedDiscountScraper,
  DiscountChangeDetector,
  DiscountDataManager,
  RealTimeDiscountProcessor,
  BatchDiscountProcessor
} from "../../lib/discount-keys/example-integration";
import type { Discount, CotoDiscount } from "promos-db/schema";

// Helper to load real discount data
function loadDiscountData(source: string): Discount[] {
  try {
    const filePath = join(process.cwd(), `../../descuentito-data/${source}.json`);
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Discount[];
  } catch (error) {
    return [];
  }
}

// Sample test data
const sampleDiscounts: CotoDiscount[] = [
  {
    source: "coto",
    discount: { type: "porcentaje", value: 15 },
    validFrom: "2025-04-26",
    validUntil: "2025-04-27",
    url: "https://example.com",
    where: ["Coto"],
    restrictions: [],
    unknownPaymentMethods: [],
    limits: { explicitlyHasNoLimit: false }
  },
  {
    source: "coto",
    discount: { type: "porcentaje", value: 20 },
    validFrom: "2025-04-26",
    validUntil: "2025-04-27",
    url: "https://example.com",
    where: ["Coto"],
    restrictions: [],
    unknownPaymentMethods: [],
    limits: { explicitlyHasNoLimit: false }
  }
];

describe("Integration Examples", () => {
  describe("addKeysToDiscounts", () => {
    it("should add unique keys to discount array", () => {
      const discountsWithKeys = addKeysToDiscounts(sampleDiscounts);
      
      expect(discountsWithKeys).toHaveLength(2);
      expect(discountsWithKeys[0]).toHaveProperty('uniqueKey');
      expect(discountsWithKeys[1]).toHaveProperty('uniqueKey');
      expect(discountsWithKeys[0].uniqueKey).not.toBe(discountsWithKeys[1].uniqueKey);
      
      // Should preserve original properties
      expect(discountsWithKeys[0].source).toBe("coto");
      expect(discountsWithKeys[0].discount.value).toBe(15);
      expect(discountsWithKeys[1].discount.value).toBe(20);
      
      console.log("Sample discount with key:");
      console.log(`  Original: ${sampleDiscounts[0].source} ${sampleDiscounts[0].discount.value}%`);
      console.log(`  With key: ${discountsWithKeys[0].uniqueKey}`);
    });

    it("should work with real discount data", () => {
      const carrefourDiscounts = loadDiscountData('carrefour');
      if (carrefourDiscounts.length === 0) {
        console.log("Skipping real data test - no data available");
        return;
      }

      const discountsWithKeys = addKeysToDiscounts(carrefourDiscounts);
      
      expect(discountsWithKeys).toHaveLength(carrefourDiscounts.length);
      
      // All should have unique keys
      const keys = discountsWithKeys.map(d => d.uniqueKey);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
      
      console.log(`Added keys to ${carrefourDiscounts.length} Carrefour discounts`);
      console.log(`Sample keys: ${keys.slice(0, 3).join(', ')}`);
    });
  });

  describe("DiscountChangeDetector", () => {
    it("should detect added, removed, and unchanged discounts", () => {
      const detector = new DiscountChangeDetector();
      
      // First run - all should be added
      const firstRun = detector.detectChanges(sampleDiscounts);
      expect(firstRun.added).toHaveLength(2);
      expect(firstRun.removed).toHaveLength(0);
      expect(firstRun.unchanged).toHaveLength(0);
      
      // Second run with same data - all should be unchanged
      const secondRun = detector.detectChanges(sampleDiscounts);
      expect(secondRun.added).toHaveLength(0);
      expect(secondRun.removed).toHaveLength(0);
      expect(secondRun.unchanged).toHaveLength(2);
      
      // Third run with modified data
      const modifiedDiscounts = [
        sampleDiscounts[0], // Keep first
        // Remove second, add new
        {
          source: "coto",
          discount: { type: "porcentaje", value: 25 },
          validFrom: "2025-04-26",
          validUntil: "2025-04-27",
          url: "https://example.com",
          where: ["Coto"],
          restrictions: [],
          unknownPaymentMethods: [],
          limits: { explicitlyHasNoLimit: false }
        } as CotoDiscount
      ];
      
      const thirdRun = detector.detectChanges(modifiedDiscounts);
      expect(thirdRun.added).toHaveLength(1);
      expect(thirdRun.removed).toHaveLength(1);
      expect(thirdRun.unchanged).toHaveLength(1);
      
      console.log("Change detection results:");
      console.log(`  Third run: +${thirdRun.added.length} -${thirdRun.removed.length} =${thirdRun.unchanged.length}`);
    });
  });

  describe("RealTimeDiscountProcessor", () => {
    it("should process discounts in real-time and detect duplicates", () => {
      const processor = new RealTimeDiscountProcessor();
      
      // Process first discount
      const result1 = processor.processDiscountInRealTime(sampleDiscounts[0]);
      expect(result1.isDuplicate).toBe(false);
      expect(result1.uniqueKey).toBeDefined();
      
      // Process second discount (different)
      const result2 = processor.processDiscountInRealTime(sampleDiscounts[1]);
      expect(result2.isDuplicate).toBe(false);
      expect(result2.uniqueKey).not.toBe(result1.uniqueKey);
      
      // Process first discount again (duplicate)
      const result3 = processor.processDiscountInRealTime(sampleDiscounts[0]);
      expect(result3.isDuplicate).toBe(true);
      expect(result3.uniqueKey).toBe(result1.uniqueKey);
      
      // Check stats
      const stats = processor.getStats();
      expect(stats.total).toBe(3);
      expect(stats.unique).toBe(2);
      expect(stats.duplicates).toBe(1);
      
      console.log("Real-time processing stats:", stats);
    });
  });

  describe("DiscountDataManager", () => {
    it("should save and load discounts with metadata", async () => {
      const manager = new DiscountDataManager();
      const tempFile = '/tmp/test-discounts.json';
      
      try {
        // Save discounts
        await manager.saveDiscountsWithKeys(sampleDiscounts, tempFile);
        
        // Load and validate
        const loadedDiscounts = await manager.loadDiscountsWithKeys(tempFile);
        
        expect(loadedDiscounts).toHaveLength(2);
        expect(loadedDiscounts[0]).toHaveProperty('uniqueKey');
        expect(loadedDiscounts[1]).toHaveProperty('uniqueKey');
        
        // Keys should be consistent
        const originalKeys = addKeysToDiscounts(sampleDiscounts);
        expect(loadedDiscounts[0].uniqueKey).toBe(originalKeys[0].uniqueKey);
        expect(loadedDiscounts[1].uniqueKey).toBe(originalKeys[1].uniqueKey);
        
        console.log("Data persistence test successful");
        
      } catch (error) {
        // Cleanup
        try {
          const fs = await import('fs');
          fs.unlinkSync(tempFile);
        } catch {}
        throw error;
      }
      
      // Cleanup
      try {
        const fs = await import('fs');
        fs.unlinkSync(tempFile);
      } catch {}
    });
  });

  describe("BatchDiscountProcessor", () => {
    it("should process multiple sources", async () => {
      const processor = new BatchDiscountProcessor();
      
      // Mock the loadSourceData method to return sample data
      const originalLoadSourceData = (processor as any).loadSourceData;
      (processor as any).loadSourceData = async (source: string) => {
        if (source === 'test1') return [sampleDiscounts[0]];
        if (source === 'test2') return [sampleDiscounts[1]];
        return [];
      };
      
      const results = await processor.processMultipleSources(['test1', 'test2', 'empty']);
      
      expect(results.size).toBe(3);
      expect(results.get('test1')).toHaveLength(1);
      expect(results.get('test2')).toHaveLength(1);
      expect(results.get('empty')).toHaveLength(0);
      
      // Restore original method
      (processor as any).loadSourceData = originalLoadSourceData;
      
      console.log("Batch processing results:");
      for (const [source, discounts] of results.entries()) {
        console.log(`  ${source}: ${discounts.length} discounts`);
      }
    });
  });

  describe("Integration with real data", () => {
    it("should demonstrate full integration workflow", () => {
      const sources = ['carrefour', 'coto'];
      
      console.log("\n=== FULL INTEGRATION WORKFLOW DEMO ===");
      
      for (const source of sources) {
        const discounts = loadDiscountData(source);
        if (discounts.length === 0) continue;
        
        console.log(`\n${source.toUpperCase()} Integration:`);
        
        // Step 1: Add keys
        const discountsWithKeys = addKeysToDiscounts(discounts);
        console.log(`  ✅ Added keys to ${discounts.length} discounts`);
        
        // Step 2: Analyze uniqueness
        const keySet = new Set(discountsWithKeys.map(d => d.uniqueKey));
        const uniquenessRate = (keySet.size / discounts.length) * 100;
        console.log(`  📊 Uniqueness: ${uniquenessRate.toFixed(1)}% (${keySet.size}/${discounts.length})`);
        
        // Step 3: Show sample keys
        const sampleKeys = discountsWithKeys.slice(0, 3).map(d => d.uniqueKey);
        console.log(`  🔑 Sample keys: ${sampleKeys.join(', ')}`);
        
        // Step 4: Simulate change detection
        const detector = new DiscountChangeDetector();
        detector.detectChanges(discounts); // Initial load
        
        // Simulate removing one discount
        const modifiedDiscounts = discounts.slice(1);
        const changes = detector.detectChanges(modifiedDiscounts);
        console.log(`  🔄 Change simulation: +${changes.added.length} -${changes.removed.length} =${changes.unchanged.length}`);
        
        expect(discountsWithKeys.length).toBe(discounts.length);
        expect(uniquenessRate).toBeGreaterThan(85);
      }
    });

    it("should benchmark key generation performance", () => {
      const allDiscounts: Discount[] = [];
      const sources = ['carrefour', 'changomas', 'coto', 'dia', 'jumbo', 'makro'];
      
      for (const source of sources) {
        const discounts = loadDiscountData(source);
        allDiscounts.push(...discounts);
      }

      if (allDiscounts.length === 0) return;

      console.log("\n=== PERFORMANCE BENCHMARK ===");
      console.log(`Testing with ${allDiscounts.length} discounts`);
      
      // Benchmark key generation
      const iterations = 10;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        addKeysToDiscounts(allDiscounts);
        const end = performance.now();
        times.push(end - start);
      }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const keysPerSecond = Math.round((allDiscounts.length * 1000) / avgTime);
      const timePerDiscount = avgTime / allDiscounts.length;
      
      console.log(`Performance results (${iterations} iterations):`);
      console.log(`  Average time: ${avgTime.toFixed(2)}ms`);
      console.log(`  Keys per second: ${keysPerSecond.toLocaleString()}`);
      console.log(`  Time per discount: ${timePerDiscount.toFixed(3)}ms`);
      
      // Performance should be reasonable
      expect(timePerDiscount).toBeLessThan(1); // Less than 1ms per discount
      expect(keysPerSecond).toBeGreaterThan(100); // More than 100 keys per second
    });
  });
});