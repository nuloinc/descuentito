import { schedules } from "@trigger.dev/sdk";
import { savePromotions } from "../lib/git";
import { scrapeJumbo } from "./scrapers";

export const jumboTask = schedules.task({
  id: "jumbo-extractor",
  maxDuration: 600,
  retry: {
    maxAttempts: 1,
  },
  run: async (payload, { ctx }) => {
    const discounts = await scrapeJumbo();
    await savePromotions(ctx, "jumbo", discounts);
  },
});
