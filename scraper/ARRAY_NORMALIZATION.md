# Array Normalization for Scrapers

## Overview

This implementation adds consistent array sorting to all scrapers to prevent unnecessary diffs between scraping iterations. When scrapers extract data, arrays like payment methods, weekdays, restrictions, etc. can be returned in different orders even if the underlying data hasn't changed, leading to false positives in change detection.

## Implementation

### Enhanced `cleanDiscounts()` Function

Located in `scraper/lib/clean.ts`, the `cleanDiscounts()` function now includes a `normalizeArrays()` helper that sorts all array fields consistently:

**Array Fields Normalized:**
- `paymentMethods` - Payment method groups sorted alphabetically within each group, then groups sorted by string representation
- `unknownPaymentMethods` - Unknown payment methods sorted alphabetically
- `weekdays` - Sorted by calendar order (Lunes, Martes, Miércoles, etc.)
- `restrictions` - Sorted alphabetically 
- `membership` - Sorted by predefined priority order, then alphabetically
- `where` - Sorted by predefined priority order (physical stores first, then "Online")

### Integration Across All Scrapers

All 6 scrapers now use the `cleanDiscounts()` function:

✅ **Updated scrapers:**
- `carrefour.ts` - Added `cleanDiscounts()` call
- `changomas.ts` - Added `cleanDiscounts()` call  
- `dia.ts` - Added `cleanDiscounts()` call

✅ **Already using:**
- `coto.ts` - Was already using `cleanDiscounts()`
- `jumbo.ts` - Was already using `cleanDiscounts()`
- `makro.ts` - Was already using `cleanDiscounts()`

## Sorting Logic

### Payment Methods
```typescript
// Within each payment method group: alphabetical sort
// Between groups: sorted by string representation
[
  ["Banco BBVA", "Banco Nación"],           // Sorted alphabetically
  ["Banco Galicia", "Tarjeta de crédito VISA"] // Sorted alphabetically  
]
```

### Weekdays
```typescript
// Calendar order maintained
["Lunes", "Miércoles", "Viernes"] // Not alphabetical - preserves day sequence
```

### Where Field
```typescript
// Physical stores prioritized, then Online
["Carrefour", "Express", "Online"] // Carrefour/Express before Online
```

### Membership Programs
```typescript
// Predefined priority order, then alphabetical fallback
["Club La Nacion", "Comunidad Coto"] // Priority order maintained
```

## Benefits

1. **Reduced False Positives** - Eliminates diffs caused purely by array ordering changes
2. **Consistent Output** - Same data always produces same JSON structure
3. **Better Debugging** - Easier to spot actual content changes vs. ordering changes
4. **Improved Reliability** - More stable scraping pipeline with fewer spurious alerts

## Additional Fields Candidates

Other array-like fields that could benefit from similar treatment:

- **Product categories** in `onlyForProducts`/`excludesProducts` (currently strings, could be arrays)
- **Bank variations** within payment method groups
- **Geographic restrictions** if they become arrays
- **Promotion conditions** if structured as arrays

## Testing

The implementation includes comprehensive tests covering:
- Payment method group sorting
- Weekday calendar ordering  
- Where field priority sorting
- Restriction alphabetical sorting
- Membership priority ordering
- Unknown payment method handling
- Preservation of already-sorted data

## Usage

No changes required in scraper implementations - the normalization happens automatically through the existing `cleanDiscounts()` call that all scrapers now use.

```typescript
// All scrapers now do this:
return cleanDiscounts(promotions);
```

The normalization is applied transparently to all discount objects, ensuring consistent array ordering across all scraped data.