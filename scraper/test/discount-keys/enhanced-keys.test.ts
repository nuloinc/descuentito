import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { generateDiscountKey, generateUniqueDiscountKeys } from "../../lib/discount-keys/discount-keys";
import { analyzeDiscountKeys } from "../../lib/discount-keys/discount-analysis";
import type { Discount } from "promos-db/schema";

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

describe("Enhanced Key Generation", () => {
  it("should test improved uniqueness with enhanced keys", () => {
    const sources = ['carrefour', 'changomas', 'coto', 'dia', 'jumbo', 'makro'];
    const allDiscounts: Discount[] = [];
    
    for (const source of sources) {
      const discounts = loadDiscountData(source);
      allDiscounts.push(...discounts);
    }

    if (allDiscounts.length === 0) {
      console.log("Skipping test - no data available");
      return;
    }

    const originalAnalysis = analyzeDiscountKeys(allDiscounts);
    
    console.log("=== ENHANCED KEY GENERATION RESULTS ===");
    console.log(`Original uniqueness: ${originalAnalysis.uniquenessRate.toFixed(1)}% (${originalAnalysis.uniqueKeys}/${originalAnalysis.totalDiscounts})`);
    console.log(`Original duplicate groups: ${originalAnalysis.duplicateGroups.length}`);
    console.log("");

    // Analyze by source
    for (const [source, stats] of Object.entries(originalAnalysis.sourceBreakdown)) {
      console.log(`${source.toUpperCase()}:`);
      console.log(`  Uniqueness: ${stats.uniquenessRate.toFixed(1)}% (${stats.uniqueKeys}/${stats.discounts})`);
      
      if (stats.uniquenessRate < 100) {
        const sourceDiscounts = allDiscounts.filter(d => d.source === source);
        const sourceAnalysis = analyzeDiscountKeys(sourceDiscounts);
        
        console.log(`  Duplicate groups: ${sourceAnalysis.duplicateGroups.length}`);
        
        // Show what the duplicates are
        sourceAnalysis.duplicateGroups.slice(0, 3).forEach((group, i) => {
          console.log(`    Group ${i + 1}: "${group.key}" (${group.count} discounts)`);
          
          // Check if enhanced keys would differentiate them
          const enhancedKeys = group.discounts.map(d => generateDiscountKey(d));
          const uniqueEnhancedKeys = new Set(enhancedKeys);
          
          if (uniqueEnhancedKeys.size > 1) {
            console.log(`      ✅ Enhanced keys WOULD differentiate: ${uniqueEnhancedKeys.size} unique keys`);
          } else {
            console.log(`      ❌ Enhanced keys still identical - likely true duplicates`);
          }
        });
      }
    }

    // Test the improvement
    expect(originalAnalysis.totalDiscounts).toBeGreaterThan(0);
    expect(originalAnalysis.uniquenessRate).toBeGreaterThan(85);
  });

  it("should show before/after comparison for specific duplicate groups", () => {
    const changomas = loadDiscountData('changomas');
    if (changomas.length === 0) return;

    const analysis = analyzeDiscountKeys(changomas);
    
    console.log("\n=== BEFORE/AFTER COMPARISON FOR CHANGOMAS ===");
    
    analysis.duplicateGroups.forEach((group, i) => {
      console.log(`\nDuplicate Group ${i + 1}: (${group.count} discounts)`);
      console.log(`  Original key: "${group.key}"`);
      
      group.discounts.forEach((discount, j) => {
        const enhancedKey = generateDiscountKey(discount);
        console.log(`    Discount ${j + 1}: "${enhancedKey}"`);
        
        if (j === 0) {
          console.log(`      Payment methods: ${JSON.stringify(discount.paymentMethods)}`);
          console.log(`      Restrictions: ${JSON.stringify(discount.restrictions?.slice(0, 2))}`);
        }
      });
      
      const enhancedKeys = group.discounts.map(d => generateDiscountKey(d));
      const uniqueEnhanced = new Set(enhancedKeys);
      
      console.log(`  Result: ${enhancedKeys.length} discounts → ${uniqueEnhanced.size} unique enhanced keys`);
      
      if (uniqueEnhanced.size > 1) {
        console.log(`  ✅ IMPROVED: Enhanced keys successfully differentiate these discounts`);
      } else {
        console.log(`  ⚠️  UNCHANGED: These discounts are still identical (likely true duplicates)`);
      }
    });
  });

  it("should measure overall improvement in uniqueness", () => {
    const sources = ['changomas', 'jumbo']; // Focus on problematic sources
    
    console.log("\n=== OVERALL IMPROVEMENT METRICS ===");
    
    for (const source of sources) {
      const discounts = loadDiscountData(source);
      if (discounts.length === 0) continue;
      
      const analysis = analyzeDiscountKeys(discounts);
      
      // Count how many duplicate groups would be resolved
      let resolvedGroups = 0;
      let totalDuplicates = 0;
      
      analysis.duplicateGroups.forEach(group => {
        const enhancedKeys = group.discounts.map(d => generateDiscountKey(d));
        const uniqueEnhanced = new Set(enhancedKeys);
        
        if (uniqueEnhanced.size > 1) {
          resolvedGroups++;
        }
        totalDuplicates += group.count;
      });
      
      console.log(`${source.toUpperCase()}:`);
      console.log(`  Total duplicate groups: ${analysis.duplicateGroups.length}`);
      console.log(`  Groups that would be resolved: ${resolvedGroups}`);
      console.log(`  Resolution rate: ${analysis.duplicateGroups.length > 0 ? ((resolvedGroups / analysis.duplicateGroups.length) * 100).toFixed(1) : 0}%`);
      console.log(`  Total duplicate discounts: ${totalDuplicates}`);
      console.log(`  Original uniqueness: ${analysis.uniquenessRate.toFixed(1)}%`);
      
      // Calculate theoretical improved uniqueness
      const duplicatesResolved = analysis.duplicateGroups.reduce((acc, group) => {
        const enhancedKeys = group.discounts.map(d => generateDiscountKey(d));
        const uniqueEnhanced = new Set(enhancedKeys);
        return acc + (uniqueEnhanced.size - 1); // How many additional unique keys we'd get
      }, 0);
      
      const improvedUniqueKeys = analysis.uniqueKeys + duplicatesResolved;
      const improvedUniquenessRate = (improvedUniqueKeys / analysis.totalDiscounts) * 100;
      
      console.log(`  Theoretical improved uniqueness: ${improvedUniquenessRate.toFixed(1)}%`);
      console.log(`  Improvement: +${(improvedUniquenessRate - analysis.uniquenessRate).toFixed(1)} percentage points`);
    }
  });

  it("should test with collision handling for perfect uniqueness", () => {
    const allDiscounts: Discount[] = [];
    const sources = ['carrefour', 'changomas', 'coto', 'dia', 'jumbo', 'makro'];
    
    for (const source of sources) {
      const discounts = loadDiscountData(source);
      allDiscounts.push(...discounts);
    }

    if (allDiscounts.length === 0) return;

    console.log("\n=== COLLISION HANDLING TEST ===");
    console.log(`Testing with ${allDiscounts.length} total discounts`);
    
    const uniqueKeys = generateUniqueDiscountKeys(allDiscounts);
    const uniqueKeySet = new Set(uniqueKeys);
    
    console.log(`Unique keys generated: ${uniqueKeySet.size}`);
    console.log(`Perfect uniqueness achieved: ${uniqueKeySet.size === allDiscounts.length ? 'YES' : 'NO'}`);
    
    if (uniqueKeySet.size !== allDiscounts.length) {
      console.log(`⚠️  Still have ${allDiscounts.length - uniqueKeySet.size} collisions after collision handling`);
      
      // Find remaining collisions
      const keyCount = new Map<string, number>();
      uniqueKeys.forEach(key => {
        keyCount.set(key, (keyCount.get(key) || 0) + 1);
      });
      
      const remainingCollisions = Array.from(keyCount.entries())
        .filter(([_, count]) => count > 1);
      
      console.log(`Remaining collision keys:`);
      remainingCollisions.forEach(([key, count]) => {
        console.log(`  "${key}" (${count} times)`);
      });
    }
    
    expect(uniqueKeySet.size).toBe(allDiscounts.length);
  });
});