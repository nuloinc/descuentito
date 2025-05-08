import { schedules } from "@trigger.dev/sdk";
import { savePromotions } from "../lib/git";
import { scrapeChangoMas } from "./scrapers";

export const changomasTask = schedules.task({
  id: "changomas-extractor",
  maxDuration: 300,
  retry: {
    maxAttempts: 3,
  },
  run: async (payload, { ctx }) => {
    const promotions = await scrapeChangoMas();
    await savePromotions(ctx, "changomas", promotions);
  },
});
