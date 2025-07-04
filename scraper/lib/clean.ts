import { GenericDiscount } from "promos-db/schema.ts";

const INVALID_RESTRICTIONS = ["todo el surtido", "todos los productos", "n/a"];

// Define sort orders for consistent array ordering
const WEEKDAY_ORDER = [
  "Lunes",
  "Martes", 
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
  "Domingo"
] as const;

const WHERE_ORDER = [
  // Physical stores first, then online
  "Carrefour", "Maxi", "Market", "Express",
  "Coto",
  "Dia", 
  "Jumbo",
  "ChangoMas",
  "Makro",
  "Online"
] as const;

const MEMBERSHIP_ORDER = [
  "Mi Carrefour",
  "Club La Nacion", 
  "Comunidad Coto",
  "Clarin 365",
  "MasClub",
  "Club +Simple"
] as const;

/**
 * Normalizes arrays within discount objects to ensure consistent ordering
 * across different scraping iterations. This prevents unnecessary diffs.
 */
function normalizeArrays<T extends GenericDiscount>(discount: T): T {
  const normalized = { ...discount };

  // Sort payment methods arrays for consistency
  if (normalized.paymentMethods) {
    normalized.paymentMethods = normalized.paymentMethods
      .map(group => [...group].sort()) // Sort within each payment method group
      .sort((a, b) => a.join(',').localeCompare(b.join(','))); // Sort groups by their string representation
  }

  // Sort unknown payment methods (if present)
  if ('unknownPaymentMethods' in normalized && normalized.unknownPaymentMethods) {
    (normalized as any).unknownPaymentMethods = [...(normalized as any).unknownPaymentMethods].sort();
  }

  // Sort weekdays according to day order
  if (normalized.weekdays) {
    normalized.weekdays = [...normalized.weekdays].sort((a, b) => {
      const indexA = WEEKDAY_ORDER.indexOf(a as any);
      const indexB = WEEKDAY_ORDER.indexOf(b as any);
      // If both found in order, use that order; otherwise sort alphabetically
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }

  // Sort restrictions alphabetically for consistency
  if (normalized.restrictions) {
    normalized.restrictions = [...normalized.restrictions].sort();
  }

  // Sort membership programs according to defined order
  if (normalized.membership) {
    normalized.membership = [...normalized.membership].sort((a, b) => {
      const indexA = MEMBERSHIP_ORDER.indexOf(a as any);
      const indexB = MEMBERSHIP_ORDER.indexOf(b as any);
      // If both found in order, use that order; otherwise sort alphabetically
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }

  // Sort 'where' field according to defined order
  if ('where' in normalized && normalized.where) {
    (normalized as any).where = [...(normalized as any).where].sort((a: string, b: string) => {
      const indexA = WHERE_ORDER.indexOf(a as any);
      const indexB = WHERE_ORDER.indexOf(b as any);
      // If both found in order, use that order; otherwise sort alphabetically
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }

  return normalized;
}

export function cleanDiscounts<T extends GenericDiscount>(discounts: T[]): T[] {
  return discounts.map((discount) => {
    let newDiscount = { ...discount };
    
    // Existing cleaning logic
    if (newDiscount.onlyForProducts) {
      if (
        INVALID_RESTRICTIONS.includes(newDiscount.onlyForProducts.toLowerCase())
      ) {
        newDiscount.onlyForProducts = undefined;
      }
    }
    if (newDiscount.excludesProducts) {
      if (
        INVALID_RESTRICTIONS.includes(
          newDiscount.excludesProducts.toLowerCase(),
        )
      ) {
        newDiscount.excludesProducts = undefined;
      }
    }

    // Apply array normalization
    return normalizeArrays(newDiscount);
  });
}
