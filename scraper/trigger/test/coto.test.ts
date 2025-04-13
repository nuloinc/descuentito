import { expect, it } from "vitest";
import { getDiscounts } from "../coto";
import { readFile } from "node:fs/promises";

const highlightedContent = await readFile(
  "./trigger/test/snapshots/highlightedContent.txt",
  "utf-8"
);
const sc17 = await readFile("./trigger/test/snapshots/coto-17.png");
const sc18 = await readFile("./trigger/test/snapshots/coto-18.png");

it.concurrent("extracts excludesProducts from debito", {}, async () => {
  const discounts = await getDiscounts({
    highlightedContent,
    screenshot: sc17,
  });
  expect(discounts).toHaveLength(1);
  expect(discounts[0].excludesProducts).toBeTruthy();
  expect(discounts[0].excludesProducts).toMatch(/SPRITE/i);
});

it.concurrent("extracts excludesProducts from mercadopago", {}, async () => {
  const discounts = await getDiscounts({
    highlightedContent,
    screenshot: sc18,
  });
  expect(discounts).toHaveLength(1);
  expect(discounts[0].excludesProducts).toBeTruthy();
  expect(discounts[0].excludesProducts).toMatch(/SPRITE/i);
});
