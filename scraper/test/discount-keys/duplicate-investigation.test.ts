import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { generateDiscountKey } from "../../lib/discount-keys/discount-keys";
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

describe("Duplicate Discount Investigation", () => {
  it("should investigate duplicate discounts in detail", () => {
    const sources = ['changomas', 'jumbo']; // Focus on sources with most duplicates
    
    for (const source of sources) {
      const discounts = loadDiscountData(source);
      if (discounts.length === 0) continue;
      
      const analysis = analyzeDiscountKeys(discounts);
      
      console.log(`\n=== ${source.toUpperCase()} DUPLICATE ANALYSIS ===`);
      console.log(`Total discounts: ${discounts.length}`);
      console.log(`Unique keys: ${analysis.uniqueKeys}`);
      console.log(`Duplicate groups: ${analysis.duplicateGroups.length}`);
      
      // Examine each duplicate group in detail
      analysis.duplicateGroups.forEach((group, groupIndex) => {
        console.log(`\nDuplicate Group ${groupIndex + 1}: "${group.key}" (${group.count} discounts)`);
        
        group.discounts.forEach((discount, i) => {
          console.log(`  Discount ${i + 1}:`);
          console.log(`    Source: ${discount.source}`);
          console.log(`    Discount: ${discount.discount.type} ${discount.discount.value}%`);
          console.log(`    Dates: ${discount.validFrom} to ${discount.validUntil}`);
          console.log(`    Weekdays: ${JSON.stringify(discount.weekdays)}`);
          console.log(`    Payment Methods: ${JSON.stringify(discount.paymentMethods)}`);
          console.log(`    Where: ${JSON.stringify('where' in discount ? discount.where : 'N/A')}`);
          console.log(`    Limits: ${JSON.stringify(discount.limits)}`);
          console.log(`    Restrictions: ${JSON.stringify(discount.restrictions?.slice(0, 2))}`);
          console.log(`    URL: ${discount.url}`);
          
          // Check what differs between duplicates
          if (i > 0) {
            const firstDiscount = group.discounts[0];
            const differences = findDetailedDifferences(firstDiscount, discount);
            if (differences.length > 0) {
              console.log(`    Differences from first: ${differences.join(', ')}`);
            } else {
              console.log(`    ⚠️  IDENTICAL to first discount`);
            }
          }
        });
      });
    }
  });

  it("should test enhanced key generation for better differentiation", () => {
    const jumboDiscounts = loadDiscountData('jumbo');
    if (jumboDiscounts.length === 0) return;
    
    console.log(`\n=== ENHANCED KEY GENERATION TEST ===`);
    
    // Get the first duplicate group
    const analysis = analyzeDiscountKeys(jumboDiscounts);
    if (analysis.duplicateGroups.length === 0) return;
    
    const firstDuplicateGroup = analysis.duplicateGroups[0];
    console.log(`Testing with duplicate group: "${firstDuplicateGroup.key}"`);
    
    // Try enhanced key generation with additional fields
    firstDuplicateGroup.discounts.forEach((discount, i) => {
      const originalKey = generateDiscountKey(discount);
      const enhancedKey = generateEnhancedDiscountKey(discount);
      
      console.log(`  Discount ${i + 1}:`);
      console.log(`    Original key: ${originalKey}`);
      console.log(`    Enhanced key: ${enhancedKey}`);
      console.log(`    Keys differ: ${originalKey !== enhancedKey}`);
    });
  });

  it("should propose solutions for duplicate handling", () => {
    const sources = ['changomas', 'jumbo'];
    
    console.log(`\n=== DUPLICATE HANDLING SOLUTIONS ===`);
    
    for (const source of sources) {
      const discounts = loadDiscountData(source);
      if (discounts.length === 0) continue;
      
      const analysis = analyzeDiscountKeys(discounts);
      
      console.log(`\n${source.toUpperCase()} Analysis:`);
      console.log(`  ${analysis.duplicateGroups.length} duplicate groups found`);
      
      let identicalCount = 0;
      let nearIdenticalCount = 0;
      let legitimateVariationsCount = 0;
      
      analysis.duplicateGroups.forEach(group => {
        const firstDiscount = group.discounts[0];
        let hasIdentical = false;
        let hasLegitimateVariation = false;
        
        for (let i = 1; i < group.discounts.length; i++) {
          const differences = findDetailedDifferences(firstDiscount, group.discounts[i]);
          
          if (differences.length === 0) {
            hasIdentical = true;
          } else if (differences.some(diff => isSignificantDifference(diff))) {
            hasLegitimateVariation = true;
          }
        }
        
        if (hasIdentical) identicalCount++;
        if (hasLegitimateVariation) legitimateVariationsCount++;
        if (!hasIdentical && !hasLegitimateVariation) nearIdenticalCount++;
      });
      
      console.log(`  Breakdown:`);
      console.log(`    - Truly identical discounts: ${identicalCount} groups`);
      console.log(`    - Near-identical (minor diffs): ${nearIdenticalCount} groups`);
      console.log(`    - Legitimate variations: ${legitimateVariationsCount} groups`);
      
      if (identicalCount > 0) {
        console.log(`  ✅ Recommendation: Remove ${identicalCount} duplicate discount entries`);
      }
      if (legitimateVariationsCount > 0) {
        console.log(`  🔧 Recommendation: Enhance key generation for ${legitimateVariationsCount} groups`);
      }
    }
  });
});

/**
 * Enhanced key generation that includes more differentiating factors
 */
function generateEnhancedDiscountKey(discount: Discount): string {
  // Use the original key as base
  const baseKey = generateDiscountKey(discount);
  
  const additionalFactors: string[] = [];
  
  // Add hash of restrictions for differentiation
  if (discount.restrictions && discount.restrictions.length > 0) {
    const restrictionsText = discount.restrictions.join('|').toLowerCase();
    const restrictionsHash = simpleHash(restrictionsText).toString(36).slice(0, 4);
    additionalFactors.push(`r${restrictionsHash}`);
  }
  
  // Add hash of URL for differentiation (in case same discount from different pages)
  if (discount.url) {
    const urlHash = simpleHash(discount.url).toString(36).slice(0, 3);
    additionalFactors.push(`u${urlHash}`);
  }
  
  // Add title/description hash if available
  if (discount.title || discount.description) {
    const textContent = `${discount.title || ''}|${discount.description || ''}`.toLowerCase();
    const textHash = simpleHash(textContent).toString(36).slice(0, 3);
    additionalFactors.push(`t${textHash}`);
  }
  
  if (additionalFactors.length > 0) {
    return `${baseKey}-${additionalFactors.join('')}`;
  }
  
  return baseKey;
}

/**
 * Simple hash function for strings
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Find detailed differences between two discounts
 */
function findDetailedDifferences(discount1: Discount, discount2: Discount): string[] {
  const differences: string[] = [];
  
  // Compare key fields
  if (discount1.validFrom !== discount2.validFrom) differences.push('validFrom');
  if (discount1.validUntil !== discount2.validUntil) differences.push('validUntil');
  if (JSON.stringify(discount1.weekdays) !== JSON.stringify(discount2.weekdays)) differences.push('weekdays');
  if (JSON.stringify(discount1.paymentMethods) !== JSON.stringify(discount2.paymentMethods)) differences.push('paymentMethods');
  if (JSON.stringify(discount1.limits) !== JSON.stringify(discount2.limits)) differences.push('limits');
  if (discount1.excludesProducts !== discount2.excludesProducts) differences.push('excludesProducts');
  if (discount1.onlyForProducts !== discount2.onlyForProducts) differences.push('onlyForProducts');
  
  // Compare "where" field if both have it
  if ('where' in discount1 && 'where' in discount2) {
    if (JSON.stringify(discount1.where) !== JSON.stringify(discount2.where)) differences.push('where');
  }
  
  // Compare non-key fields
  if (JSON.stringify(discount1.restrictions) !== JSON.stringify(discount2.restrictions)) differences.push('restrictions');
  if (discount1.url !== discount2.url) differences.push('url');
  if (discount1.title !== discount2.title) differences.push('title');
  if (discount1.description !== discount2.description) differences.push('description');
  if (discount1.category !== discount2.category) differences.push('category');
  if (discount1.additionalInfo !== discount2.additionalInfo) differences.push('additionalInfo');
  
  return differences;
}

/**
 * Determines if a difference is significant enough to warrant different keys
 */
function isSignificantDifference(difference: string): boolean {
  const significantFields = [
    'validFrom', 'validUntil', 'weekdays', 'paymentMethods', 
    'limits', 'excludesProducts', 'onlyForProducts', 'where'
  ];
  return significantFields.includes(difference);
}