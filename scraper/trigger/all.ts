import { batch, task } from "@trigger.dev/sdk";
import { carrefourTask } from "./carrefour";
import { cotoTask } from "./coto";
import { diaTask } from "./dia";
import { jumboTask } from "./jumbo";
import { makroTask } from "./makro";
import { changomasTask } from "./changomas";

export const allScrapersTask = task({
  id: "all-scrapers",
  description: "Runs all supermarket scrapers in parallel",
  maxDuration: 1800,
  machine: "micro",
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: {}, { ctx }) => {
    const p = {
      type: "DECLARATIVE" as const,
      timestamp: new Date(),
      timezone: "America/Argentina/Buenos_Aires",
      scheduleId: "all-scrapers",
      upcoming: [],
    };
    const results = await batch.triggerByTask([
      { task: carrefourTask, payload: p },
      { task: cotoTask, payload: p },
      { task: diaTask, payload: p },
      { task: jumboTask, payload: p },
      { task: makroTask, payload: p },
      { task: changomasTask, payload: p },
    ]);

    return {
      message: "All scrapers triggered successfully",
      results,
    };
  },
});
