import { logger } from "../trigger/lib/logger.js";
import type { GenericDiscount } from "promos-db/schema";

// Demo mode flag - can be set via environment variable or defaulted to true when secrets are missing
export const isDemoMode = Bun.env.DEMO_MODE === "true" || 
  !Bun.env.FETCH_CACHER_ACCESS_KEY_ID || 
  !Bun.env.OPENROUTER_API_KEY ||
  !Bun.env.GITHUB_TOKEN;

if (isDemoMode) {
  console.log("🎭 DEMO MODE ENABLED - Using mock services to demonstrate scraper flow");
}

// Mock S3 Client that logs instead of uploading
export class MockS3Client {
  async send(command: any) {
    if (isDemoMode) {
      logger.info("📦 [DEMO] Mock S3 Upload", {
        bucket: command.input?.Bucket,
        key: command.input?.Key,
        contentType: command.input?.ContentType,
        bodySize: command.input?.Body?.length || 0
      });
      console.log(`📦 [DEMO] Would upload to S3: ${command.input?.Key}`);
    }
    return Promise.resolve({});
  }
}

// Mock fetch cacher that still fetches but doesn't upload to S3
export class MockFetchCacher {
  private responses: any[] = [];
  
  async fetch(input: string | URL, init?: any): Promise<Response> {
    const response = await fetch(input, init);
    const url = typeof input === "string" ? input : input.toString();
    
    if (isDemoMode) {
      this.responses.push({
        url,
        timestamp: new Date().toISOString(),
        status: response.status
      });
      console.log(`🌐 [DEMO] Fetched: ${url} (${response.status})`);
    }
    
    return response;
  }
  
  async waitForPendingUploads() {
    if (isDemoMode) {
      console.log(`📝 [DEMO] Would upload ${this.responses.length} cached responses to S3`);
      logger.info("📝 [DEMO] Mock cache upload complete", { 
        responseCount: this.responses.length,
        urls: this.responses.map(r => r.url)
      });
    }
  }
}

// Mock LLM that returns example discount data
export function createMockLLMResponse(scraperName: string): GenericDiscount[] {
  const mockDiscounts: GenericDiscount[] = [
    {
      source: scraperName as any,
      url: `https://example-${scraperName}.com/promotions`,
      title: `${scraperName.toUpperCase()} 30% OFF with Credit Card`,
      subtitle: "Valid on weekdays",
      description: "Get 30% discount on your purchase using any credit card",
      paymentMethod: ["Credit Card"],
      weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      restrictions: ["Minimum purchase $1000", "One per customer"],
      limits: ["Maximum discount $500"],
      where: [scraperName.charAt(0).toUpperCase() + scraperName.slice(1) as any]
    },
    {
      source: scraperName as any,
      url: `https://example-${scraperName}.com/promotions`,
      title: `${scraperName.toUpperCase()} 20% OFF Weekend Special`,
      subtitle: "Weekend promotion",
      description: "Special weekend discount with debit cards",
      paymentMethod: ["Debit Card"],
      weekdays: ["Saturday", "Sunday"],
      restrictions: ["Valid on groceries only"],
      limits: ["Maximum discount $300"],
      where: [scraperName.charAt(0).toUpperCase() + scraperName.slice(1) as any]
    }
  ];
  
  if (isDemoMode) {
    console.log(`🤖 [DEMO] Mock LLM generated ${mockDiscounts.length} discounts for ${scraperName}`);
    logger.info("🤖 [DEMO] Mock LLM extraction", { 
      scraper: scraperName,
      discountCount: mockDiscounts.length,
      discounts: mockDiscounts
    });
  }
  
  return mockDiscounts;
}

// Mock git operations
export async function mockUseCommit(source: string, metadata?: any) {
  const dir = `/tmp/mock-git-${source}-${Date.now()}`;
  let discountsFound = 0;
  
  if (isDemoMode) {
    console.log(`📁 [DEMO] Mock git initialized for ${source} in ${dir}`);
  }
  
  return {
    dir,
    updateDiscountsCount: (count: number) => {
      discountsFound = count;
      if (isDemoMode) {
        console.log(`📊 [DEMO] Updated discount count for ${source}: ${count}`);
      }
    },
    [Symbol.asyncDispose]: async () => {
      if (isDemoMode) {
        console.log(`🔄 [DEMO] Would commit ${discountsFound} discounts for ${source}`);
        console.log(`📤 [DEMO] Would push to GitHub and create PR`);
        logger.info("🔄 [DEMO] Mock git commit complete", {
          scraper: source,
          discountsFound,
          mockCommitUrl: `https://github.com/mock-org/mock-repo/pull/mock-${source}`
        });
      }
    }
  };
}

// Mock telegram notifications
export class MockTelegramNotifier {
  async sendScrapingComplete(result: any) {
    if (isDemoMode) {
      console.log(`📱 [DEMO] Would send Telegram notification:`);
      console.log(`   Scraper: ${result.scraper}`);
      console.log(`   Success: ${result.success}`);
      console.log(`   Discounts: ${result.discountsFound || 0}`);
      logger.info("📱 [DEMO] Mock Telegram notification", result);
    }
  }
  
  async sendBatchComplete(results: any[]) {
    if (isDemoMode) {
      console.log(`📱 [DEMO] Would send batch Telegram notification for ${results.length} scrapers`);
      logger.info("📱 [DEMO] Mock batch notification", { results });
    }
  }
  
  async sendCasharComparison(result: any) {
    if (isDemoMode) {
      console.log(`📱 [DEMO] Would send Cashar comparison notification`);
      logger.info("📱 [DEMO] Mock Cashar comparison", result);
    }
  }
}

// Mock scraper content - provides example HTML structure for demo
export function createMockScrapedContent(scraperName: string) {
  const mockContent = {
    url: `https://example-${scraperName}.com/promotions`,
    timestamp: new Date().toISOString(),
    promotions: [
      {
        domDescription: `<div class="promotion-card"><h3>${scraperName.toUpperCase()} Credit Card Promotion</h3><p>30% discount weekdays</p><button class="details-btn">Ver detalles</button></div>`,
        legalesText: "Promoción válida de lunes a viernes. Descuento máximo $500. Mínimo de compra $1000. Una promoción por cliente."
      },
      {
        domDescription: `<div class="promotion-card"><h3>${scraperName.toUpperCase()} Weekend Special</h3><p>20% off with debit card</p><button class="details-btn">Ver detalles</button></div>`,
        legalesText: "Válido sábados y domingos. Solo productos de almacén. Descuento máximo $300."
      }
    ]
  };
  
  if (isDemoMode) {
    console.log(`🕷️ [DEMO] Mock scraping content for ${scraperName}`);
    logger.info("🕷️ [DEMO] Mock content generated", { 
      scraper: scraperName, 
      promotionCount: mockContent.promotions.length 
    });
  }
  
  return mockContent.promotions;
}