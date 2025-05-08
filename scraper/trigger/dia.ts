import { schedules } from "@trigger.dev/sdk";
import { savePromotions } from "../lib/git";
import { scrapeDia } from "./scrapers";

export const diaTask = schedules.task({
  id: "dia-extractor",
  maxDuration: 600,
  retry: {
    maxAttempts: 1,
  },
  run: async (payload, { ctx }) => {
    const promotions = await scrapeDia();
    await savePromotions(ctx, "dia", promotions);
  },
});
