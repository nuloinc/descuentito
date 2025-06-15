import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  analyzeDiscountKeys,
  compareDiscountKeys,
  generateAnalysisReport,
  generateComparisonReport
} from "../../lib/discount-keys/discount-analysis";
import type { Discount, CotoDiscount, CarrefourDiscount } from "promos-db/schema";

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

// Sample test data
const sampleDiscounts: Discount[] = [
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
  } as CotoDiscount,
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
  } as CotoDiscount,
  {
    source: "carrefour",
    discount: { type: "porcentaje", value: 15 },
    validFrom: "2025-04-26",
    validUntil: "2025-04-27",
    url: "https://example.com",
    where: ["Carrefour"],
    restrictions: [],
    unknownPaymentMethods: [],
    limits: { explicitlyHasNoLimit: false }
  } as CarrefourDiscount
];

describe("Discount Analysis Tools", () => {
  describe("analyzeDiscountKeys", () => {
    it("should analyze sample discount keys correctly", () => {
      const analysis = analyzeDiscountKeys(sampleDiscounts);
      
      expect(analysis.totalDiscounts).toBe(3);
      expect(analysis.uniqueKeys).toBe(3);
      expect(analysis.duplicateKeys).toBe(0);
      expect(analysis.uniquenessRate).toBe(100);
      
      expect(analysis.sourceBreakdown.coto).toBeDefined();
      expect(analysis.sourceBreakdown.carrefour).toBeDefined();
      expect(analysis.sourceBreakdown.coto.discounts).toBe(2);
      expect(analysis.sourceBreakdown.carrefour.discounts).toBe(1);
      
      expect(analysis.keyLengthStats.min).toBeGreaterThan(0);
      expect(analysis.keyLengthStats.max).toBeGreaterThan(0);
      expect(analysis.keyLengthStats.average).toBeGreaterThan(0);
    });

    it("should identify duplicate keys correctly", () => {
      const duplicateDiscounts: Discount[] = [
        ...sampleDiscounts,
        // Add a duplicate of the first discount
        {
          source: "coto",
          discount: { type: "porcentaje", value: 15 },
          validFrom: "2025-04-26",
          validUntil: "2025-04-27",
          url: "https://different-url.com", // Different URL shouldn't affect key
          where: ["Coto"],
          restrictions: ["Different restriction"], // Different restriction shouldn't affect key
          unknownPaymentMethods: [],
          limits: { explicitlyHasNoLimit: false }
        } as CotoDiscount
      ];

      const analysis = analyzeDiscountKeys(duplicateDiscounts);
      
      expect(analysis.totalDiscounts).toBe(4);
      expect(analysis.uniqueKeys).toBe(3);
      expect(analysis.duplicateKeys).toBe(1);
      expect(analysis.uniquenessRate).toBe(75);
      expect(analysis.duplicateGroups).toHaveLength(1);
      expect(analysis.duplicateGroups[0].count).toBe(2);
    });

    it("should work with real discount data", () => {
      const carrefourDiscounts = loadDiscountData('carrefour');
      if (carrefourDiscounts.length === 0) {
        console.log("Skipping real data test - no data available");
        return;
      }

      const analysis = analyzeDiscountKeys(carrefourDiscounts);
      
      expect(analysis.totalDiscounts).toBe(carrefourDiscounts.length);
      expect(analysis.uniqueKeys).toBeGreaterThan(0);
      expect(analysis.uniquenessRate).toBeGreaterThan(0);
      expect(analysis.sourceBreakdown.carrefour).toBeDefined();
      
      console.log(`Carrefour analysis:`);
      console.log(`  Discounts: ${analysis.totalDiscounts}`);
      console.log(`  Unique keys: ${analysis.uniqueKeys} (${analysis.uniquenessRate.toFixed(1)}%)`);
      console.log(`  Avg key length: ${analysis.keyLengthStats.average.toFixed(1)} chars`);
    });
  });

  describe("compareDiscountKeys", () => {
    it("should detect added and removed discounts", () => {
      const oldDiscounts = sampleDiscounts.slice(0, 2); // First 2 discounts
      const newDiscounts = sampleDiscounts.slice(1); // Last 2 discounts

      const comparison = compareDiscountKeys(oldDiscounts, newDiscounts);
      
      expect(comparison.summary.totalOld).toBe(2);
      expect(comparison.summary.totalNew).toBe(2);
      expect(comparison.summary.keysAdded).toBe(1);
      expect(comparison.summary.keysRemoved).toBe(1);
      expect(comparison.summary.keysUnchanged).toBe(1);
      expect(comparison.summary.stabilityRate).toBe(50);
      
      expect(comparison.changes.added).toHaveLength(1);
      expect(comparison.changes.removed).toHaveLength(1);
      expect(comparison.changes.unchanged).toHaveLength(1);
    });

    it("should detect key drift", () => {
      const oldDiscounts: Discount[] = [
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
        } as CotoDiscount
      ];

      const newDiscounts: Discount[] = [
        {
          source: "coto",
          discount: { type: "porcentaje", value: 15 },
          validFrom: "2025-04-27", // Date changed by 1 day
          validUntil: "2025-04-28",
          url: "https://example.com",
          where: ["Coto"],
          restrictions: [],
          unknownPaymentMethods: [],
          limits: { explicitlyHasNoLimit: false }
        } as CotoDiscount
      ];

      const comparison = compareDiscountKeys(oldDiscounts, newDiscounts);
      
      expect(comparison.keyDrift).toHaveLength(1);
      expect(comparison.keyDrift[0].reason).toContain("date range changed");
    });

    it("should handle empty datasets", () => {
      const emptyComparison = compareDiscountKeys([], []);
      
      expect(emptyComparison.summary.totalOld).toBe(0);
      expect(emptyComparison.summary.totalNew).toBe(0);
      expect(emptyComparison.summary.stabilityRate).toBe(100);
      
      const newOnlyComparison = compareDiscountKeys([], sampleDiscounts);
      expect(newOnlyComparison.summary.keysAdded).toBe(3);
      expect(newOnlyComparison.summary.stabilityRate).toBe(100);
    });
  });

  describe("generateAnalysisReport", () => {
    it("should generate a comprehensive report", () => {
      const analysis = analyzeDiscountKeys(sampleDiscounts);
      const report = generateAnalysisReport(analysis);
      
      expect(report).toContain("# Discount Key Analysis Report");
      expect(report).toContain("## Summary");
      expect(report).toContain("- Total discounts: 3");
      expect(report).toContain("- Unique keys: 3");
      expect(report).toContain("## Source Breakdown");
      expect(report).toContain("### COTO");
      expect(report).toContain("### CARREFOUR");
      
      console.log("Sample Analysis Report:");
      console.log("=".repeat(50));
      console.log(report);
    });
  });

  describe("generateComparisonReport", () => {
    it("should generate a comprehensive comparison report", () => {
      const oldDiscounts = sampleDiscounts.slice(0, 2);
      const newDiscounts = sampleDiscounts.slice(1);
      
      const comparison = compareDiscountKeys(oldDiscounts, newDiscounts);
      const report = generateComparisonReport(comparison);
      
      expect(report).toContain("# Discount Key Comparison Report");
      expect(report).toContain("## Summary");
      expect(report).toContain("- Old dataset: 2 discounts");
      expect(report).toContain("- New dataset: 2 discounts");
      expect(report).toContain("- Stability rate: 50.0%");
      
      console.log("Sample Comparison Report:");
      console.log("=".repeat(50));
      console.log(report);
    });
  });

  describe("Real Data Analysis", () => {
    it("should analyze all real discount data and generate comprehensive report", () => {
      const sources = ['carrefour', 'changomas', 'coto', 'dia', 'jumbo', 'makro'];
      const allDiscounts: Discount[] = [];
      
      for (const source of sources) {
        const discounts = loadDiscountData(source);
        allDiscounts.push(...discounts);
      }

      if (allDiscounts.length === 0) {
        console.log("Skipping real data analysis - no data available");
        return;
      }

      const analysis = analyzeDiscountKeys(allDiscounts);
      const report = generateAnalysisReport(analysis);
      
      expect(analysis.totalDiscounts).toBeGreaterThan(0);
      expect(report).toContain("# Discount Key Analysis Report");
      
      console.log("Full Real Data Analysis Report:");
      console.log("=".repeat(80));
      console.log(report);
      console.log("=".repeat(80));
    });

    it("should simulate historical comparison by modifying data", () => {
      const carrefourDiscounts = loadDiscountData('carrefour');
      if (carrefourDiscounts.length === 0) {
        console.log("Skipping historical comparison test - no data available");
        return;
      }

      // Simulate "old" data by taking first half
      const oldDiscounts = carrefourDiscounts.slice(0, Math.floor(carrefourDiscounts.length / 2));
      
      // Simulate "new" data by taking second half + some modifications
      const newDiscounts = carrefourDiscounts.slice(Math.floor(carrefourDiscounts.length / 2));
      
      // Add a modified version of the first discount to simulate key drift
      if (oldDiscounts.length > 0) {
        const modifiedDiscount = {
          ...oldDiscounts[0],
          validFrom: "2025-05-01", // Change date to create key drift
          validUntil: "2025-05-31"
        } as Discount;
        newDiscounts.push(modifiedDiscount);
      }

      const comparison = compareDiscountKeys(oldDiscounts, newDiscounts);
      const report = generateComparisonReport(comparison);
      
      console.log("Simulated Historical Comparison:");
      console.log("=".repeat(50));
      console.log(report);
      
      expect(comparison.summary.stabilityRate).toBeGreaterThanOrEqual(0);
      expect(comparison.summary.stabilityRate).toBeLessThanOrEqual(100);
    });
  });
});