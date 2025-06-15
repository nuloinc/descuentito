import { createHash } from "crypto";
import type { Discount, GenericDiscount } from "promos-db/schema";

/**
 * Generates a unique, deterministic key for a discount based on its core identifying properties.
 * 
 * The key combines the most stable and distinguishing characteristics:
 * - source (supermarket)
 * - discount type and value
 * - validity period
 * - weekdays (if applicable)
 * - primary payment method (if specific)
 * - location applicability
 * 
 * Keys are designed to be:
 * - Deterministic: same discount = same key
 * - Human-readable when possible
 * - Unique within reasonable collision bounds
 * - Stable across scraping runs
 */
export function generateDiscountKey(discount: Discount, index?: number): string {
  const parts: string[] = [];
  
  // 1. Source (always present)
  parts.push(discount.source);
  
  // 2. Discount type and value
  parts.push(`${discount.discount.type.replace(/\s+/g, '')}-${discount.discount.value}`);
  
  // 3. Date range (format as compact MMDD-MMDD if same year, otherwise full dates)
  const fromDate = new Date(discount.validFrom);
  const toDate = new Date(discount.validUntil);
  const sameYear = fromDate.getFullYear() === toDate.getFullYear();
  const daysDiff = Math.abs(toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (sameYear && daysDiff <= 90) {
    // Short format for dates within same year and reasonable range (<=90 days)
    const fromMD = `${String(fromDate.getMonth() + 1).padStart(2, '0')}${String(fromDate.getDate()).padStart(2, '0')}`;
    const toMD = `${String(toDate.getMonth() + 1).padStart(2, '0')}${String(toDate.getDate()).padStart(2, '0')}`;
    parts.push(`${fromMD}-${toMD}`);
  } else {
    // Full format for longer ranges or different years
    parts.push(`${discount.validFrom}-${discount.validUntil}`);
  }
  
  // 4. Weekdays (if specific days are mentioned)
  if (discount.weekdays && discount.weekdays.length > 0 && discount.weekdays.length < 7) {
    const weekdayMap: Record<string, string> = {
      'Lunes': 'lun',
      'Martes': 'mar', 
      'Miercoles': 'mie',
      'Jueves': 'jue',
      'Viernes': 'vie',
      'Sabado': 'sab',
      'Domingo': 'dom'
    };
    const weekdayAbbrevs = discount.weekdays
      .map(day => weekdayMap[day] || day.toLowerCase().slice(0, 3))
      .sort()
      .join('');
    parts.push(weekdayAbbrevs);
  }
  
  // 5. Primary payment method (if specific and not "all methods")
  if (discount.paymentMethods && discount.paymentMethods.length > 0) {
    const firstMethod = discount.paymentMethods[0];
    if (Array.isArray(firstMethod) && firstMethod.length > 0) {
      // Use the first payment method as primary identifier
      const paymentKey = normalizePaymentMethod(firstMethod[0]);
      if (paymentKey) {
        parts.push(paymentKey);
      }
    }
  }
  
  // 6. Location/where (if specific)
  if ('where' in discount && discount.where.length > 0) {
    const locations = [...discount.where].sort();
    if (locations.length === 1) {
      parts.push(locations[0].toLowerCase());
    } else if (locations.length > 1 && locations.length < 3) {
      parts.push(locations.map(l => l.toLowerCase()).join(''));
    }
    // Skip if all locations (too generic)
  }
  
  // 7. Additional discriminators for edge cases
  const additionalKeys: string[] = [];
  
  // Membership requirements
  if (discount.membership && discount.membership.length > 0) {
    const membershipKey = discount.membership[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 6);
    additionalKeys.push(membershipKey);
  }
  
  // Special targeting (anses, jubilados, etc.)
  if (discount.appliesOnlyTo) {
    const targeting = Object.entries(discount.appliesOnlyTo)
      .filter(([_, value]) => value)
      .map(([key, _]) => key.slice(0, 3))
      .sort()
      .join('');
    if (targeting) {
      additionalKeys.push(targeting);
    }
  }
  
  // Limits - include both max discount and explicit no limit
  if (discount.limits?.explicitlyHasNoLimit) {
    additionalKeys.push('notope');
  }
  if (discount.limits?.maxDiscount) {
    additionalKeys.push(`max${discount.limits.maxDiscount}`);
  }
  
  // Product exclusions hash for major differences
  if (discount.excludesProducts) {
    const exclusionKey = createHash('md5')
      .update(discount.excludesProducts.toLowerCase())
      .digest('hex')
      .slice(0, 4);
    additionalKeys.push(`ex${exclusionKey}`);
  }
  
  // Restriction hash for differentiating discount tiers with same core terms
  if (discount.restrictions && discount.restrictions.length > 0) {
    // Only include restrictions hash if there are payment methods (indicating this might be a tier)
    if (discount.paymentMethods && discount.paymentMethods.length > 0) {
      const restrictionKey = createHash('md5')
        .update(discount.restrictions.join('|').toLowerCase())
        .digest('hex')
        .slice(0, 3);
      additionalKeys.push(`rs${restrictionKey}`);
    }
  }
  
  // Add additional keys if they help differentiate
  if (additionalKeys.length > 0) {
    parts.push(additionalKeys.join(''));
  }
  
  // Join all parts
  let key = parts.join('-');
  
  // Add index suffix if provided (for handling truly identical discounts)
  if (index !== undefined && index > 0) {
    key = `${key}-${index}`;
  }
  
  // If key is too long, hash the end part to keep it manageable
  if (key.length > 85) {
    const baseKey = parts.slice(0, 3).join('-'); // Keep source, discount, and dates
    const additionalPart = parts.slice(3).join('-');
    const indexSuffix = index !== undefined && index > 0 ? `-${index}` : '';
    const hashSuffix = createHash('md5').update(additionalPart + indexSuffix).digest('hex').slice(0, 8);
    key = `${baseKey}-${hashSuffix}`;
  }
  
  return key.toLowerCase();
}

/**
 * Normalizes payment methods to consistent short identifiers
 */
function normalizePaymentMethod(method: string): string | null {
  const methodLower = method.toLowerCase();
  
  // Specific product mappings (more granular for better differentiation)
  const specificMappings: Record<string, string> = {
    'tarjeta carrefour prepaga': 'carrefourpre',
    'tarjeta carrefour crédito': 'carrefourcred',
    'banco macro - tarjeta platinum': 'macroplatinum',
    'banco macro - tarjeta selecta': 'macroselecta',
    'tarjeta de crédito patagonia 365': 'patagonia365',
    'banco nación - tarjeta nativa': 'nativan',
    'banco ciudad - plan sueldo y jubilados': 'ciudadplan',
    'banco galicia - eminent': 'galiciaem',
    'banco santander - jubilados': 'santjub',
    'banco santander - women': 'santwomen',
    'sidecreer': 'sidecreer'
  };
  
  // Check specific mappings first (most granular)
  for (const [fullName, shortName] of Object.entries(specificMappings)) {
    if (methodLower.includes(fullName)) {
      return shortName;
    }
  }
  
  // Bank mappings (general)
  const bankMappings: Record<string, string> = {
    'mercado pago': 'mp',
    'banco galicia': 'galicia',
    'banco ciudad': 'ciudad',
    'personal pay': 'ppay',
    'uala': 'uala',
    'banco patagonia': 'patagonia',
    'banco bbva': 'bbva',
    'banco nación': 'nacion',
    'banco macro': 'macro',
    'banco santander': 'santander',
    'banco icbc': 'icbc',
    'banco credicoop': 'credicoop',
    'banco comafi': 'comafi',
    'banco supervielle': 'supervielle',
    'naranjax': 'naranja',
    'cuenta dni': 'dni',
    'banco santa fe': 'santafe',
    'prex': 'prex',
    'yoy': 'yoy'
  };
  
  // Rail mappings
  const railMappings: Record<string, string> = {
    'modo': 'modo',
    'tarjeta de crédito visa': 'visa',
    'tarjeta de débito visa': 'visadebit',
    'tarjeta de crédito mastercard': 'master',
    'tarjeta de débito mastercard': 'masterdebit',
    'tarjeta prepaga mastercard': 'masterprepaga',
    'tarjeta de crédito cabal': 'cabal',
    'tarjeta american express': 'amex'
  };
  
  // Check bank mappings
  for (const [fullName, shortName] of Object.entries(bankMappings)) {
    if (methodLower.includes(fullName)) {
      return shortName;
    }
  }
  
  // Check rail mappings
  for (const [fullName, shortName] of Object.entries(railMappings)) {
    if (methodLower === fullName) {
      return shortName;
    }
  }
  
  // If no specific mapping found, return null to exclude from key
  // (This helps avoid cluttering keys with too-generic payment methods)
  return null;
}

/**
 * Generates unique keys for an array of discounts, handling collisions with indices
 */
export function generateUniqueDiscountKeys(discounts: Discount[]): string[] {
  const keyToCount = new Map<string, number>();
  
  return discounts.map((discount) => {
    const baseKey = generateDiscountKey(discount);
    const currentCount = keyToCount.get(baseKey) || 0;
    keyToCount.set(baseKey, currentCount + 1);
    
    if (currentCount === 0) {
      return baseKey;
    } else {
      return generateDiscountKey(discount, currentCount);
    }
  });
}

/**
 * Validates that a discount key is properly formatted and not too long
 */
export function validateDiscountKey(key: string): boolean {
  return /^[a-z0-9\-]+$/.test(key) && key.length <= 85 && key.length >= 10;
}

/**
 * Extracts components from a discount key for debugging/analysis
 */
export function parseDiscountKey(key: string): {
  source: string;
  discountType: string;
  dateRange: string;
  additional: string[];
} {
  const parts = key.split('-');
  
  return {
    source: parts[0] || '',
    discountType: parts[1] || '',
    dateRange: parts[2] || '',
    additional: parts.slice(3)
  };
}