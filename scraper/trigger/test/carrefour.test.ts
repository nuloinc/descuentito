import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { extractDiscounts } from "../carrefour";

const domDescription = await readFile(
  "./trigger/test/snapshots/carrefour/dom-description.txt",
  "utf-8"
);

it.concurrent(
  "extracts correct mercadopago maxi discount",
  { timeout: 180_000 },
  async () => {
    let found = false;
    for await (const discount of extractDiscounts({ domDescription })) {
      if (
        discount.discount.type === "porcentaje" &&
        discount.discount.value === 10 &&
        discount.weekdays &&
        discount.weekdays.length === 3 &&
        discount.weekdays.includes("Viernes") &&
        discount.weekdays.includes("Sabado") &&
        discount.weekdays.includes("Domingo") &&
        discount.paymentMethods &&
        discount.paymentMethods[0][0] === "Mercado Pago"
      ) {
        found = true;
        expect(discount.where).toEqual(["Maxi"]);
        return;
      }
    }
    if (!found) throw new Error("Couldn't find discount");
  }
);
