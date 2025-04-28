import { expect, it } from "vitest";
import { getDiscount } from "../coto";
import WHc from "./8WHc.json";

it("should work", async () => {
  const snapshot = WHc.discountData.ggussvrkzcebpwjxxgsbb;
  const discount = await getDiscount({
    legales: WHc.legales,
    domDescription: snapshot.domDescription,
    id: snapshot.id,
  });
  console.log(discount);
  expect(discount.limits?.maxDiscount).toBeFalsy();
  expect(discount.limits?.maxDiscount).not.toBe(0);
  expect(discount.limits?.explicitlyHasNoLimit).toBeTruthy();
});
