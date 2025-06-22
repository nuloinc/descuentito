import { createServerFn } from "@tanstack/react-start";
import { SOURCES } from "../lib/state";
import type { Discount } from "promos-db/schema";

import { KVNamespace, DurableObjectNamespace } from "@cloudflare/workers-types";

// Define the data structure we expect
export type PromotionData = {
  [key in (typeof SOURCES)[number]]?: Discount[];
};
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    interface Platform {
      env?: {
        DESCUENTITO_DATA: KVNamespace;
      };
      // interface Error {}
      // interface Locals {}
      // interface PageData {}
      // interface PageState {}
    }
  }
}

export {};

export const getPromotions = createServerFn({
  method: "GET",
}).handler(async () => {
  const platform = (globalThis as any).platform as App.Platform | undefined;

  const dataEntries = await Promise.all(
    SOURCES.map(async (source) => {
      let kv;

      // Try to get data from Cloudflare KV first if we're in a server environment
      if (platform?.env?.DESCUENTITO_DATA) {
        try {
          kv = await platform.env.DESCUENTITO_DATA.get(source);
        } catch (error) {
          console.warn(`Failed to fetch ${source} from KV:`, error);
        }
      }

      // In dev environment, try to read from local descuentito-data directory first
      if (process.env.NODE_ENV === "development") {
        try {
          const fs = await import("fs/promises");
          const path = await import("path");
          const localPath = path.join(
            process.cwd(),
            "..",
            "..",
            "descuentito-data",
            `${source}.json`,
          );
          const localData = await fs.readFile(localPath, "utf-8");
          return [source, JSON.parse(localData) as Discount[]];
        } catch (error) {
          console.warn(`Failed to read local ${source}.json:`, error);
        }
      }

      // If no KV data found, fetch from GitHub
      if (!kv) {
        const url = `https://raw.githubusercontent.com/nuloinc/descuentito-data/refs/heads/main/${source}.json`;
        try {
          const response = await fetch(url);
          if (!response.ok) {
            console.warn(
              `Failed to fetch ${source}:`,
              response.status,
              response.statusText,
            );
            return [source, []];
          }
          kv = await response.text();
        } catch (error) {
          console.error(`Error fetching or parsing ${source}:`, error);
          return [source, []];
        }
      }

      try {
        return [source, JSON.parse(kv) as Discount[]];
      } catch (error) {
        console.error(`Error parsing data for ${source}:`, error);
        return [source, []];
      }
    }),
  );

  return Object.fromEntries(dataEntries) as PromotionData;
});
