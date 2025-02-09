import { logger, schedules } from "@trigger.dev/sdk/v3";
import { extractPromotions } from "./extract-promotions";

export const galiciaPromotionsTask = schedules.task({
  id: "galicia-promotions-extractor",
  cron: "0 0 * * *",
  maxDuration: 300,
  run: async (payload, { ctx }) => {
    const promotions = await extractPromotions();
    console.log(promotions);
  },
});
