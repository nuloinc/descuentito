import { generateDiscountKey, generateUniqueDiscountKeys } from "./discount-keys";
import type { Discount } from "promos-db/schema";

export interface DiscountKeyAnalysis {
  totalDiscounts: number;
  uniqueKeys: number;
  duplicateKeys: number;
  uniquenessRate: number;
  duplicateGroups: Array<{
    key: string;
    discounts: Discount[];
    count: number;
  }>;
  keyLengthStats: {
    min: number;
    max: number;
    average: number;
  };
  sourceBreakdown: Record<string, {
    discounts: number;
    uniqueKeys: number;
    uniquenessRate: number;
    avgKeyLength: number;
    sampleKeys: string[];
  }>;
}

export interface DiscountComparisonResult {
  summary: {
    totalOld: number;
    totalNew: number;
    keysAdded: number;
    keysRemoved: number;
    keysUnchanged: number;
    stabilityRate: number;
  };
  changes: {
    added: Array<{ key: string; discount: Discount }>;
    removed: Array<{ key: string; discount: Discount }>;
    unchanged: Array<{ key: string; oldDiscount: Discount; newDiscount: Discount }>;
  };
  keyDrift: Array<{
    oldKey: string;
    newKey: string;
    discount: Discount;
    reason: string;
  }>;
}

/**
 * Analyzes discount keys for uniqueness, patterns, and statistics
 */
export function analyzeDiscountKeys(discounts: Discount[]): DiscountKeyAnalysis {
  const keys = discounts.map(discount => generateDiscountKey(discount));
  const uniqueKeys = new Set(keys);
  
  // Find duplicates
  const keyToDiscounts = new Map<string, Discount[]>();
  discounts.forEach((discount, index) => {
    const key = keys[index];
    if (!keyToDiscounts.has(key)) {
      keyToDiscounts.set(key, []);
    }
    keyToDiscounts.get(key)!.push(discount);
  });

  const duplicateGroups = Array.from(keyToDiscounts.entries())
    .filter(([_, discounts]) => discounts.length > 1)
    .map(([key, discounts]) => ({
      key,
      discounts,
      count: discounts.length
    }))
    .sort((a, b) => b.count - a.count);

  // Key length statistics
  const keyLengths = keys.map(key => key.length);
  const keyLengthStats = {
    min: Math.min(...keyLengths),
    max: Math.max(...keyLengths),
    average: keyLengths.reduce((sum, len) => sum + len, 0) / keyLengths.length
  };

  // Source breakdown
  const sourceBreakdown: Record<string, any> = {};
  const discountsBySource = new Map<string, Discount[]>();
  
  discounts.forEach(discount => {
    const source = discount.source;
    if (!discountsBySource.has(source)) {
      discountsBySource.set(source, []);
    }
    discountsBySource.get(source)!.push(discount);
  });

  for (const [source, sourceDiscounts] of discountsBySource.entries()) {
    const sourceKeys = sourceDiscounts.map(discount => generateDiscountKey(discount));
    const sourceUniqueKeys = new Set(sourceKeys);
    const sourceKeyLengths = sourceKeys.map(key => key.length);
    
    sourceBreakdown[source] = {
      discounts: sourceDiscounts.length,
      uniqueKeys: sourceUniqueKeys.size,
      uniquenessRate: (sourceUniqueKeys.size / sourceKeys.length) * 100,
      avgKeyLength: sourceKeyLengths.reduce((sum, len) => sum + len, 0) / sourceKeyLengths.length,
      sampleKeys: sourceKeys.slice(0, 3)
    };
  }

  return {
    totalDiscounts: discounts.length,
    uniqueKeys: uniqueKeys.size,
    duplicateKeys: keys.length - uniqueKeys.size,
    uniquenessRate: (uniqueKeys.size / keys.length) * 100,
    duplicateGroups,
    keyLengthStats,
    sourceBreakdown
  };
}

/**
 * Compares two sets of discounts to analyze key stability over time
 */
export function compareDiscountKeys(
  oldDiscounts: Discount[],
  newDiscounts: Discount[]
): DiscountComparisonResult {
  const oldKeys = new Map<string, Discount>();
  const newKeys = new Map<string, Discount>();

  // Generate keys for old discounts
  oldDiscounts.forEach(discount => {
    const key = generateDiscountKey(discount);
    oldKeys.set(key, discount);
  });

  // Generate keys for new discounts
  newDiscounts.forEach(discount => {
    const key = generateDiscountKey(discount);
    newKeys.set(key, discount);
  });

  const oldKeySet = new Set(oldKeys.keys());
  const newKeySet = new Set(newKeys.keys());

  // Find changes
  const addedKeys = [...newKeySet].filter(key => !oldKeySet.has(key));
  const removedKeys = [...oldKeySet].filter(key => !newKeySet.has(key));
  const unchangedKeys = [...oldKeySet].filter(key => newKeySet.has(key));

  const changes = {
    added: addedKeys.map(key => ({ key, discount: newKeys.get(key)! })),
    removed: removedKeys.map(key => ({ key, discount: oldKeys.get(key)! })),
    unchanged: unchangedKeys.map(key => ({ 
      key, 
      oldDiscount: oldKeys.get(key)!, 
      newDiscount: newKeys.get(key)! 
    }))
  };

  // Detect potential key drift (same discount with different keys)
  const keyDrift: Array<{
    oldKey: string;
    newKey: string;
    discount: Discount;
    reason: string;
  }> = [];

  // Simple heuristic: check if removed and added discounts are similar
  for (const removedItem of changes.removed) {
    for (const addedItem of changes.added) {
      if (areSimilarDiscounts(removedItem.discount, addedItem.discount)) {
        keyDrift.push({
          oldKey: removedItem.key,
          newKey: addedItem.key,
          discount: addedItem.discount,
          reason: explainKeyDifference(removedItem.discount, addedItem.discount)
        });
      }
    }
  }

  const stabilityRate = oldKeys.size > 0 
    ? (unchangedKeys.length / oldKeys.size) * 100 
    : 100;

  return {
    summary: {
      totalOld: oldDiscounts.length,
      totalNew: newDiscounts.length,
      keysAdded: addedKeys.length,
      keysRemoved: removedKeys.length,
      keysUnchanged: unchangedKeys.length,
      stabilityRate
    },
    changes,
    keyDrift
  };
}

/**
 * Checks if two discounts are similar (likely the same discount with minor changes)
 */
function areSimilarDiscounts(discount1: Discount, discount2: Discount): boolean {
  return (
    discount1.source === discount2.source &&
    discount1.discount.type === discount2.discount.type &&
    discount1.discount.value === discount2.discount.value &&
    Math.abs(
      new Date(discount1.validFrom).getTime() - new Date(discount2.validFrom).getTime()
    ) < 7 * 24 * 60 * 60 * 1000 // Within 7 days
  );
}

/**
 * Explains why two similar discounts have different keys
 */
function explainKeyDifference(discount1: Discount, discount2: Discount): string {
  const differences: string[] = [];

  if (discount1.validFrom !== discount2.validFrom || discount1.validUntil !== discount2.validUntil) {
    differences.push("date range changed");
  }

  if (JSON.stringify(discount1.weekdays) !== JSON.stringify(discount2.weekdays)) {
    differences.push("weekdays changed");
  }

  if (JSON.stringify(discount1.paymentMethods) !== JSON.stringify(discount2.paymentMethods)) {
    differences.push("payment methods changed");
  }

  if ('where' in discount1 && 'where' in discount2) {
    if (JSON.stringify(discount1.where) !== JSON.stringify(discount2.where)) {
      differences.push("locations changed");
    }
  }

  if (discount1.excludesProducts !== discount2.excludesProducts) {
    differences.push("excluded products changed");
  }

  if (JSON.stringify(discount1.limits) !== JSON.stringify(discount2.limits)) {
    differences.push("limits changed");
  }

  return differences.length > 0 ? differences.join(", ") : "unknown difference";
}

/**
 * Generates a detailed report of discount key analysis
 */
export function generateAnalysisReport(analysis: DiscountKeyAnalysis): string {
  const report: string[] = [];
  
  report.push("# Discount Key Analysis Report");
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push("");

  // Summary
  report.push("## Summary");
  report.push(`- Total discounts: ${analysis.totalDiscounts}`);
  report.push(`- Unique keys: ${analysis.uniqueKeys}`);
  report.push(`- Duplicate keys: ${analysis.duplicateKeys}`);
  report.push(`- Uniqueness rate: ${analysis.uniquenessRate.toFixed(1)}%`);
  report.push("");

  // Key length stats
  report.push("## Key Length Statistics");
  report.push(`- Minimum: ${analysis.keyLengthStats.min} characters`);
  report.push(`- Maximum: ${analysis.keyLengthStats.max} characters`);
  report.push(`- Average: ${analysis.keyLengthStats.average.toFixed(1)} characters`);
  report.push("");

  // Source breakdown
  report.push("## Source Breakdown");
  for (const [source, stats] of Object.entries(analysis.sourceBreakdown)) {
    report.push(`### ${source.toUpperCase()}`);
    report.push(`- Discounts: ${stats.discounts}`);
    report.push(`- Unique keys: ${stats.uniqueKeys} (${stats.uniquenessRate.toFixed(1)}%)`);
    report.push(`- Average key length: ${stats.avgKeyLength.toFixed(1)} chars`);
    report.push(`- Sample keys: ${stats.sampleKeys.join(", ")}`);
    report.push("");
  }

  // Duplicates
  if (analysis.duplicateGroups.length > 0) {
    report.push("## Duplicate Keys Analysis");
    analysis.duplicateGroups.slice(0, 10).forEach(group => {
      report.push(`### "${group.key}" (${group.count} discounts)`);
      group.discounts.forEach((discount, i) => {
        report.push(`${i + 1}. ${discount.source} - ${discount.discount.value}% - ${discount.validFrom} to ${discount.validUntil}`);
      });
      report.push("");
    });
  }

  return report.join("\n");
}

/**
 * Generates a comparison report between two discount datasets
 */
export function generateComparisonReport(comparison: DiscountComparisonResult): string {
  const report: string[] = [];
  
  report.push("# Discount Key Comparison Report");
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push("");

  // Summary
  report.push("## Summary");
  report.push(`- Old dataset: ${comparison.summary.totalOld} discounts`);
  report.push(`- New dataset: ${comparison.summary.totalNew} discounts`);
  report.push(`- Keys added: ${comparison.summary.keysAdded}`);
  report.push(`- Keys removed: ${comparison.summary.keysRemoved}`);
  report.push(`- Keys unchanged: ${comparison.summary.keysUnchanged}`);
  report.push(`- Stability rate: ${comparison.summary.stabilityRate.toFixed(1)}%`);
  report.push("");

  // Key drift analysis
  if (comparison.keyDrift.length > 0) {
    report.push("## Key Drift Analysis");
    report.push("Discounts that likely represent the same promotion but with different keys:");
    comparison.keyDrift.forEach((drift, i) => {
      report.push(`${i + 1}. **${drift.discount.source}** - ${drift.discount.discount.value}%`);
      report.push(`   - Old key: \`${drift.oldKey}\``);
      report.push(`   - New key: \`${drift.newKey}\``);
      report.push(`   - Reason: ${drift.reason}`);
    });
    report.push("");
  }

  // Changes summary
  if (comparison.changes.added.length > 0) {
    report.push("## New Discounts Added");
    comparison.changes.added.slice(0, 10).forEach(item => {
      report.push(`- \`${item.key}\` - ${item.discount.source} ${item.discount.discount.value}%`);
    });
    if (comparison.changes.added.length > 10) {
      report.push(`... and ${comparison.changes.added.length - 10} more`);
    }
    report.push("");
  }

  if (comparison.changes.removed.length > 0) {
    report.push("## Discounts Removed");
    comparison.changes.removed.slice(0, 10).forEach(item => {
      report.push(`- \`${item.key}\` - ${item.discount.source} ${item.discount.discount.value}%`);
    });
    if (comparison.changes.removed.length > 10) {
      report.push(`... and ${comparison.changes.removed.length - 10} more`);
    }
    report.push("");
  }

  return report.join("\n");
}