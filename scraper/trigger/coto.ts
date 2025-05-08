import { schedules } from "@trigger.dev/sdk";
import { savePromotions } from "../lib/git";
import { scrapeCoto } from "./scrapers";

export const cotoTask = schedules.task({
  id: "coto-extractor",
  maxDuration: 1800,
  retry: {
    maxAttempts: 1,
  },
  run: async (payload, { ctx }) => {
    const discounts = await scrapeCoto();
    await savePromotions(ctx, "coto", discounts);
  },
});
