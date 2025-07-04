import { describe, it, expect } from "vitest";
import { calculateDiscountDiff, formatDiscountKey } from "../lib/discount-diff.js";
import type { GenericDiscount } from "promos-db/schema.ts";

describe("Discount Diff", () => {
  const sampleDiscount1: GenericDiscount = {
    source: "carrefour",
    discount: {
      type: "porcentaje",
      value: 15
    },
    validFrom: "2024-01-01",
    validUntil: "2024-01-31",
    paymentMethods: [["VISA"]],
    weekdays: [],
    membership: [],
    restrictions: [],
    where: [],
    appliesOnlyTo: {
      anses: false,
      jubilados: false,
      programaCiudadaniaPorteña: false
    },
    limits: {},
    excludesProducts: ""
  };

  const sampleDiscount2: GenericDiscount = {
    source: "carrefour",
    discount: {
      type: "porcentaje",
      value: 20
    },
    validFrom: "2024-01-01",
    validUntil: "2024-01-31",
    paymentMethods: [["Mastercard"]],
    weekdays: [],
    membership: [],
    restrictions: [],
    where: [],
    appliesOnlyTo: {
      anses: false,
      jubilados: false,
      programaCiudadaniaPorteña: false
    },
    limits: {},
    excludesProducts: ""
  };

  it("should detect new discounts", () => {
    const previousDiscounts: GenericDiscount[] = [sampleDiscount1];
    const currentDiscounts: GenericDiscount[] = [sampleDiscount1, sampleDiscount2];

    const diff = calculateDiscountDiff(previousDiscounts, currentDiscounts);

    expect(diff.added.length).toBe(1);
    expect(diff.removed.length).toBe(0);
    expect(diff.totalOld).toBe(1);
    expect(diff.totalNew).toBe(2);
  });

  it("should detect removed discounts", () => {
    const previousDiscounts: GenericDiscount[] = [sampleDiscount1, sampleDiscount2];
    const currentDiscounts: GenericDiscount[] = [sampleDiscount1];

    const diff = calculateDiscountDiff(previousDiscounts, currentDiscounts);

    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(1);
    expect(diff.totalOld).toBe(2);
    expect(diff.totalNew).toBe(1);
  });

  it("should detect no changes", () => {
    const previousDiscounts: GenericDiscount[] = [sampleDiscount1];
    const currentDiscounts: GenericDiscount[] = [sampleDiscount1];

    const diff = calculateDiscountDiff(previousDiscounts, currentDiscounts);

    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(0);
    expect(diff.totalOld).toBe(1);
    expect(diff.totalNew).toBe(1);
  });

  it("should handle empty arrays", () => {
    const diff = calculateDiscountDiff([], []);

    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(0);
    expect(diff.totalOld).toBe(0);
    expect(diff.totalNew).toBe(0);
  });

  it("should format discount keys correctly", () => {
    const key = "carrefour-porcentaje15-0101-0131-visa";
    const formatted = formatDiscountKey(key);
    
    expect(formatted).toContain("CARREFOUR");
    expect(formatted).toContain("15%");
    expect(formatted).toContain("01/01");
    expect(formatted).toContain("visa");
  });
});