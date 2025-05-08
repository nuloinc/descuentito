import { schedules } from "@trigger.dev/sdk";
import { savePromotions } from "../lib/git";
import { scrapeCarrefour } from "./scrapers";

export const carrefourTask = schedules.task({
  id: "carrefour-extractor",
  maxDuration: 300,
  retry: {
    maxAttempts: 3,
  },
  run: async (payload, { ctx }) => {
    const promotions = await scrapeCarrefour();
    await savePromotions(ctx, "carrefour", promotions);
  },
});
