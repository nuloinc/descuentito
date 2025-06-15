import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { generateDiscountKey, generateUniqueDiscountKeys, validateDiscountKey } from "../../lib/discount-keys/discount-keys";
import type { Discount } from "promos-db/schema";

// Helper to load real discount data
function loadDiscountData(source: string): Discount[] {
  try {
    const filePath = join(process.cwd(), `../../descuentito-data/${source}.json`);
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Discount[];
  } catch (error) {
    console.warn(`Could not load ${source}.json:`, error);
    return [];
  }
}

// Load all available discount data
const sources = ['carrefour', 'changomas', 'coto', 'dia', 'jumbo', 'makro'];
const allDiscounts: Discount[] = [];
const discountsBySource: Record<string, Discount[]> = {};

for (const source of sources) {
  const discounts = loadDiscountData(source);
  discountsBySource[source] = discounts;
  allDiscounts.push(...discounts);
}

describe("Real Data Validation", () => {
  it("should load real discount data successfully", () => {
    expect(allDiscounts.length).toBeGreaterThan(0);
    console.log(`Loaded ${allDiscounts.length} total discounts:`);
    
    for (const [source, discounts] of Object.entries(discountsBySource)) {
      console.log(`  ${source}: ${discounts.length} discounts`);
    }
  });

  it("should generate valid keys for all real discounts", () => {
    let validKeyCount = 0;
    let invalidKeyCount = 0;
    
    for (const discount of allDiscounts) {
      const key = generateDiscountKey(discount);
      if (validateDiscountKey(key)) {
        validKeyCount++;
      } else {
        invalidKeyCount++;
        console.warn(`Invalid key generated: "${key}" for discount:`, {
          source: discount.source,
          discount: discount.discount,
          validFrom: discount.validFrom,
          validUntil: discount.validUntil
        });
      }
    }

    console.log(`Key validation results:`);
    console.log(`  Valid keys: ${validKeyCount}`);
    console.log(`  Invalid keys: ${invalidKeyCount}`);
    console.log(`  Success rate: ${((validKeyCount / allDiscounts.length) * 100).toFixed(1)}%`);

    expect(validKeyCount).toBe(allDiscounts.length);
    expect(invalidKeyCount).toBe(0);
  });

  it("should measure key uniqueness on real data", () => {
    const keys = allDiscounts.map(discount => generateDiscountKey(discount));
    const uniqueKeys = new Set(keys);
    
    const uniquenessRate = (uniqueKeys.size / keys.length) * 100;
    
    console.log(`Key uniqueness analysis:`);
    console.log(`  Total discounts: ${keys.length}`);
    console.log(`  Unique keys: ${uniqueKeys.size}`);
    console.log(`  Duplicate keys: ${keys.length - uniqueKeys.size}`);
    console.log(`  Uniqueness rate: ${uniquenessRate.toFixed(1)}%`);

    // Find duplicates for analysis
    const keyToDiscounts = new Map<string, Discount[]>();
    
    allDiscounts.forEach((discount, index) => {
      const key = keys[index];
      if (!keyToDiscounts.has(key)) {
        keyToDiscounts.set(key, []);
      }
      keyToDiscounts.get(key)!.push(discount);
    });

    const duplicates = Array.from(keyToDiscounts.entries())
      .filter(([_, discounts]) => discounts.length > 1);

    if (duplicates.length > 0) {
      console.log(`\nDuplicate key analysis:`);
      duplicates.slice(0, 5).forEach(([key, discounts]) => {
        console.log(`  Key: "${key}" (${discounts.length} discounts)`);
        discounts.forEach((discount, i) => {
          console.log(`    ${i + 1}. ${discount.source} - ${discount.discount.value}% - ${discount.validFrom} to ${discount.validUntil}`);
        });
      });
    }

    // We expect reasonably high uniqueness (>85%) but not necessarily 100%
    expect(uniquenessRate).toBeGreaterThan(85);
  });

  it("should test collision handling with generateUniqueDiscountKeys", () => {
    const uniqueKeys = generateUniqueDiscountKeys(allDiscounts);
    const uniqueKeySet = new Set(uniqueKeys);
    
    console.log(`Unique key generation results:`);
    console.log(`  Total discounts: ${allDiscounts.length}`);
    console.log(`  Unique keys generated: ${uniqueKeySet.size}`);
    console.log(`  Perfect uniqueness: ${uniqueKeySet.size === allDiscounts.length ? 'YES' : 'NO'}`);

    // With collision handling, we should get 100% unique keys
    expect(uniqueKeySet.size).toBe(allDiscounts.length);
    expect(uniqueKeys.length).toBe(allDiscounts.length);
  });

  it("should analyze key patterns across sources", () => {
    console.log(`\nKey pattern analysis by source:`);
    
    for (const [source, discounts] of Object.entries(discountsBySource)) {
      if (discounts.length === 0) continue;
      
      const keys = discounts.map(discount => generateDiscountKey(discount));
      const uniqueKeys = new Set(keys);
      const avgKeyLength = keys.reduce((sum, key) => sum + key.length, 0) / keys.length;
      
      console.log(`  ${source}:`);
      console.log(`    Discounts: ${discounts.length}`);
      console.log(`    Unique keys: ${uniqueKeys.size} (${((uniqueKeys.size / keys.length) * 100).toFixed(1)}% unique)`);
      console.log(`    Avg key length: ${avgKeyLength.toFixed(1)} chars`);
      
      // Show a few sample keys
      const sampleKeys = keys.slice(0, 3);
      console.log(`    Sample keys: ${sampleKeys.join(', ')}`);
    }
  });

  it("should measure key generation performance", () => {
    const iterations = 5;
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      // Generate keys for all discounts
      allDiscounts.forEach(discount => generateDiscountKey(discount));
      
      const end = performance.now();
      times.push(end - start);
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const keysPerSecond = Math.round((allDiscounts.length * 1000) / avgTime);
    
    console.log(`\nPerformance analysis:`);
    console.log(`  Discounts processed: ${allDiscounts.length}`);
    console.log(`  Average time: ${avgTime.toFixed(2)}ms`);
    console.log(`  Keys per second: ${keysPerSecond.toLocaleString()}`);
    console.log(`  Time per key: ${(avgTime / allDiscounts.length).toFixed(3)}ms`);

    // Performance should be reasonable - less than 1ms per key on average
    expect(avgTime / allDiscounts.length).toBeLessThan(1);
  });

  it("should test key stability with minor variations", () => {
    // Test that keys remain stable when non-essential fields change
    if (allDiscounts.length === 0) return;
    
    const originalDiscount = allDiscounts[0];
    const originalKey = generateDiscountKey(originalDiscount);
    
    // Create variations that shouldn't change the key (non-core fields)
    const variations = [
      {
        ...originalDiscount,
        url: "https://different-url.com"
      },
      {
        ...originalDiscount,
        title: "Different title",
        description: "Different description"
      },
      {
        ...originalDiscount,
        additionalInfo: "Different additional info"
      }
    ];
    
    console.log(`\nKey stability test:`);
    console.log(`  Original key: "${originalKey}"`);
    
    variations.forEach((variation, index) => {
      const variationKey = generateDiscountKey(variation as Discount);
      const isStable = originalKey === variationKey;
      
      console.log(`  Variation ${index + 1}: ${isStable ? 'STABLE' : 'CHANGED'} - "${variationKey}"`);
      
      expect(isStable).toBe(true);
    });
  });
});