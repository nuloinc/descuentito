import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { logger } from "../trigger/lib/logger.js";
import { generateUniqueDiscountKeys, generateUniqueDiscountKeysWithoutDates } from "./discount-keys/discount-keys.js";
import type { GenericDiscount, Discount } from "promos-db/schema.ts";

export interface DiscountDiffResult {
  added: string[];
  removed: string[];
  validityChanged: Array<{
    baseKey: string;
    oldPeriod: string;
    newPeriod: string;
    fullOldKey: string;
    fullNewKey: string;
  }>;
  totalNew: number;
  totalOld: number;
}

/**
 * Loads previous discount data from the committed git data
 */
export async function loadPreviousDiscounts(
  scraperName: string,
  repoDir: string
): Promise<GenericDiscount[]> {
  const filePath = join(repoDir, `${scraperName}.json`);
  
  if (!existsSync(filePath)) {
    logger.info(`No previous discount data found for ${scraperName}`);
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // Handle both direct array and wrapped object formats
    if (Array.isArray(data)) {
      return data as GenericDiscount[];
    } else if (data.discounts && Array.isArray(data.discounts)) {
      return data.discounts as GenericDiscount[];
    } else {
      logger.warn(`Unexpected data format in ${filePath}`);
      return [];
    }
  } catch (error) {
    logger.error(`Error loading previous discounts for ${scraperName}:`, error);
    return [];
  }
}

/**
 * Compares two discount arrays and returns the differences using unique keys
 */
export function calculateDiscountDiff(
  previousDiscounts: GenericDiscount[],
  currentDiscounts: GenericDiscount[]
): DiscountDiffResult {
  // Generate unique keys with and without dates
  const previousKeys = generateUniqueDiscountKeys(previousDiscounts as Discount[]);
  const currentKeys = generateUniqueDiscountKeys(currentDiscounts as Discount[]);
  
  const previousKeysNoDates = generateUniqueDiscountKeysWithoutDates(previousDiscounts as Discount[]);
  const currentKeysNoDates = generateUniqueDiscountKeysWithoutDates(currentDiscounts as Discount[]);

  // Create maps for efficient lookup
  const previousKeySet = new Set(previousKeys);
  const currentKeySet = new Set(currentKeys);
  
  const previousNoDateMap = new Map<string, string[]>();
  const currentNoDateMap = new Map<string, string[]>();
  
  // Build maps from no-date keys to full keys
  previousKeysNoDates.forEach((noDateKey, index) => {
    if (!previousNoDateMap.has(noDateKey)) {
      previousNoDateMap.set(noDateKey, []);
    }
    previousNoDateMap.get(noDateKey)!.push(previousKeys[index]);
  });
  
  currentKeysNoDates.forEach((noDateKey, index) => {
    if (!currentNoDateMap.has(noDateKey)) {
      currentNoDateMap.set(noDateKey, []);
    }
    currentNoDateMap.get(noDateKey)!.push(currentKeys[index]);
  });

  // Find truly added and removed discounts (no match even without dates)
  const previousNoDateSet = new Set(previousKeysNoDates);
  const currentNoDateSet = new Set(currentKeysNoDates);
  
  const trulyAddedNoDates = currentKeysNoDates.filter(key => !previousNoDateSet.has(key));
  const trulyRemovedNoDates = previousKeysNoDates.filter(key => !currentNoDateSet.has(key));
  
  // Convert back to full keys for truly added/removed
  const trulyAdded = trulyAddedNoDates.flatMap(noDateKey => currentNoDateMap.get(noDateKey) || []);
  const trulyRemoved = trulyRemovedNoDates.flatMap(noDateKey => previousNoDateMap.get(noDateKey) || []);
  
  // Find validity changes (same base discount but different dates)
  const validityChanged: Array<{
    baseKey: string;
    oldPeriod: string;
    newPeriod: string;
    fullOldKey: string;
    fullNewKey: string;
  }> = [];
  
  // Check discounts that exist in both sets but with different dates
  const commonNoDates = previousKeysNoDates.filter(key => currentNoDateSet.has(key));
  
  for (const noDateKey of commonNoDates) {
    const oldKeys = previousNoDateMap.get(noDateKey) || [];
    const newKeys = currentNoDateMap.get(noDateKey) || [];
    
    // Simple approach: pair up keys and treat differences as validity changes
    const maxLength = Math.max(oldKeys.length, newKeys.length);
    
    for (let i = 0; i < maxLength; i++) {
      const oldKey = oldKeys[i];
      const newKey = newKeys[i];
      
      if (oldKey && newKey && oldKey !== newKey) {
        // This is a validity change
        const oldParts = oldKey.split('-');
        const newParts = newKey.split('-');
        
        validityChanged.push({
          baseKey: noDateKey,
          oldPeriod: oldParts.length >= 3 ? oldParts[2] : '',
          newPeriod: newParts.length >= 3 ? newParts[2] : '',
          fullOldKey: oldKey,
          fullNewKey: newKey
        });
      } else if (oldKey && !newKey) {
        // This old key doesn't have a match, it's truly removed
        // But it will be filtered out by the trulyRemoved logic above
      } else if (!oldKey && newKey) {
        // This new key doesn't have a match, it's truly added
        // But it will be filtered out by the trulyAdded logic above
      }
    }
  }
  
  // Remove validity changes from truly added/removed lists
  const validityChangedOldKeys = new Set(validityChanged.map(v => v.fullOldKey));
  const validityChangedNewKeys = new Set(validityChanged.map(v => v.fullNewKey));
  
  const finalAdded = trulyAdded.filter(key => !validityChangedNewKeys.has(key));
  const finalRemoved = trulyRemoved.filter(key => !validityChangedOldKeys.has(key));

  return {
    added: finalAdded,
    removed: finalRemoved,
    validityChanged,
    totalNew: currentDiscounts.length,
    totalOld: previousDiscounts.length,
  };
}

/**
 * Formats a discount object for human-readable display
 */
export function formatDiscountForDisplay(discount: GenericDiscount | Discount): string {
  // Get source from the discount if it has one, otherwise use "Unknown"
  const source = 'source' in discount ? discount.source : 'Unknown';
  let result = source.toUpperCase();
  
  // Add discount value and type
  if (discount.discount.type === 'porcentaje') {
    result += ` ${discount.discount.value}% off`;
  } else if (discount.discount.type === 'cuotas sin intereses') {
    result += ` ${discount.discount.value} installments`;
  } else {
    result += ` ${discount.discount.value} ${discount.discount.type}`;
  }
  
  // Add payment method if specific
  if (discount.paymentMethods && discount.paymentMethods.length > 0) {
    const firstMethod = discount.paymentMethods[0];
    if (Array.isArray(firstMethod) && firstMethod.length > 0) {
      result += ` with ${firstMethod[0]}`;
    } else if (typeof firstMethod === 'string') {
      result += ` with ${firstMethod}`;
    }
  }
  
  // Add weekdays if specific
  if (discount.weekdays && discount.weekdays.length > 0 && discount.weekdays.length < 7) {
    result += ` on ${discount.weekdays.join(', ')}`;
  }
  
  // Add location if specific
  if ('where' in discount && discount.where && Array.isArray(discount.where) && discount.where.length > 0 && discount.where.length < 3) {
    result += ` at ${discount.where.join(', ')}`;
  }
  
  return result;
}

/**
 * Enhanced diff result that includes the actual discount objects for better formatting
 */
export interface EnhancedDiscountDiffResult extends DiscountDiffResult {
  addedDiscounts: GenericDiscount[];
  removedDiscounts: GenericDiscount[];
  validityChangedDiscounts: Array<{
    baseKey: string;
    oldDiscount: GenericDiscount;
    newDiscount: GenericDiscount;
  }>;
}

/**
 * Calculate diff with enhanced result that includes actual discount objects
 */
export function calculateEnhancedDiscountDiff(
  previousDiscounts: GenericDiscount[],
  currentDiscounts: GenericDiscount[]
): EnhancedDiscountDiffResult {
  const basicDiff = calculateDiscountDiff(previousDiscounts, currentDiscounts);
  
  // Generate key-to-discount maps for lookup
  const previousKeys = generateUniqueDiscountKeys(previousDiscounts as Discount[]);
  const currentKeys = generateUniqueDiscountKeys(currentDiscounts as Discount[]);
  
  const previousKeyToDiscount = new Map<string, GenericDiscount>();
  const currentKeyToDiscount = new Map<string, GenericDiscount>();
  
  previousKeys.forEach((key, index) => {
    previousKeyToDiscount.set(key, previousDiscounts[index]);
  });
  
  currentKeys.forEach((key, index) => {
    currentKeyToDiscount.set(key, currentDiscounts[index]);
  });
  
  // Map keys back to discount objects
  const addedDiscounts = basicDiff.added.map(key => currentKeyToDiscount.get(key)).filter(Boolean) as GenericDiscount[];
  const removedDiscounts = basicDiff.removed.map(key => previousKeyToDiscount.get(key)).filter(Boolean) as GenericDiscount[];
  
  const validityChangedDiscounts = basicDiff.validityChanged.map(change => ({
    baseKey: change.baseKey,
    oldDiscount: previousKeyToDiscount.get(change.fullOldKey)!,
    newDiscount: currentKeyToDiscount.get(change.fullNewKey)!
  })).filter(item => item.oldDiscount && item.newDiscount);
  
  return {
    ...basicDiff,
    addedDiscounts,
    removedDiscounts,
    validityChangedDiscounts
  };
}

/**
 * Formats discount keys for better readability in notifications (fallback)
 */
export function formatDiscountKey(key: string): string {
  // Extract meaningful parts from the key
  const parts = key.split('-');
  if (parts.length < 3) return key;

  const source = parts[0].toUpperCase();
  const discountPart = parts[1];
  const datePart = parts[2];
  
  // Parse discount type and value
  const discountMatch = discountPart.match(/^(\D+)(\d+)$/);
  if (!discountMatch) return key;
  
  const [, type, value] = discountMatch;
  const formattedType = type === 'porcentaje' ? '%' : type;
  
  // Format date if it's in MMDD format
  let formattedDate = datePart;
  if (datePart.match(/^\d{4}$/)) {
    // Single MMDD format
    const fromDate = `${datePart.slice(0, 2)}/${datePart.slice(2)}`;
    formattedDate = fromDate;
  } else if (datePart.match(/^\d{4}-\d{4}$/)) {
    // MMDD-MMDD format  
    const [from, to] = datePart.split('-');
    const fromDate = `${from.slice(0, 2)}/${from.slice(2)}`;
    const toDate = `${to.slice(0, 2)}/${to.slice(2)}`;
    formattedDate = `${fromDate}-${toDate}`;
  }
  
  let result = `${source} ${value}${formattedType} (${formattedDate})`;
  
  // Add additional context if available
  if (parts.length > 3) {
    const additional = parts.slice(3).join(' ');
    result += ` ${additional}`;
  }
  
  return result;
}