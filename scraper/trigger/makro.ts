import { schedules } from "@trigger.dev/sdk";
import { savePromotions } from "../lib/git";
import { scrapeMakro } from "./scrapers";

export const makroTask = schedules.task({
  id: "makro-extractor",
  maxDuration: 300,
  retry: {
    maxAttempts: 3,
  },
  run: async (payload, { ctx }) => {
    const promotions = await scrapeMakro();
    await savePromotions(ctx, "makro", promotions);
  },
});
