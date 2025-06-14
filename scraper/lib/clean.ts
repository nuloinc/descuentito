import { Discount, GenericDiscount } from "promos-db/schema";

const INVALID_RESTRICTIONS = ["todo el surtido", "todos los productos", "n/a"];

export function cleanDiscounts<T extends GenericDiscount>(discounts: T[]): T[] {
  return discounts.map((discount) => {
    let newDiscount = { ...discount };
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
    return newDiscount;
  });
}
