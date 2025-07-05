import { generateText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import logger from "../trigger/lib/logger";
import type { GenericDiscount } from "../../promos-db/schema";
import { 
  validateExtractedDiscounts, 
  filterDiscountsByValidation,
  type ValidationResult 
} from "./validation";
import {
  createExtractionContext,
  processExtractionWithAlerts,
  summarizeAlerts,
  EXTRACTION_ALERT_INSTRUCTIONS,
  type ExtractionAlert,
  type ExtractionContext
} from "./extraction-tools";

/**
 * Enhanced extraction function that combines both validation approaches
 */
export async function enhancedExtractionWithValidation(
  content: string,
  source: string,
  extractionPrompt: string
): Promise<{
  discounts: GenericDiscount[];
  validationResults: ValidationResult[];
  extractionAlerts: ExtractionAlert[];
  stats: {
    extracted: number;
    accepted: number;
    needsReview: number;
    rejected: number;
    totalAlerts: number;
    highRiskAlerts: number;
  };
}> {
  // Step 1: Create extraction context for alerts
  const extractionContext = createExtractionContext(source, "html");
  
  // Step 2: Enhanced prompt with alert instructions
  const enhancedPrompt = `${extractionPrompt}

${EXTRACTION_ALERT_INSTRUCTIONS}

RECUERDA: Si tienes dudas sobre algún dato, usa el sistema de alertas. Es mejor marcar una incertidumbre que generar datos incorrectos.`;

  logger.info("Starting enhanced extraction", { source });

  // Step 3: Extract with LLM that can flag issues
  const { text } = await generateText({
    model: openrouter.chat("anthropic/claude-3-5-sonnet-20241022"),
    temperature: 0.1,
    messages: [
      {
        role: "user",
        content: enhancedPrompt,
      },
    ],
  });

  // Step 4: Process extraction results and alerts
  let extractionResult;
  try {
    extractionResult = JSON.parse(text.trim());
  } catch (error) {
    logger.error("Failed to parse extraction result", { error, source });
    throw new Error("Invalid JSON response from extraction LLM");
  }

  // Handle both single discount and array responses
  const extractedDiscounts = Array.isArray(extractionResult) 
    ? extractionResult 
    : extractionResult.discounts || [extractionResult.discount || extractionResult];

  // Process alerts from extraction
  const { alerts: extractionAlerts } = processExtractionWithAlerts(
    extractionResult, 
    extractionContext
  );

  logger.info("Extraction completed", {
    source,
    extractedCount: extractedDiscounts.length,
    alertsCount: extractionAlerts.length,
  });

  // Step 5: Post-extraction validation with cheaper LLM
  const validationResults = await validateExtractedDiscounts(
    content,
    extractedDiscounts,
    source
  );

  // Step 6: Filter discounts based on validation and alerts
  const { accepted, needsReview, rejected } = filterDiscountsByValidation(
    extractedDiscounts,
    validationResults,
    {
      minConfidence: 70,
      allowReview: true,
    }
  );

  // Additional filtering based on extraction alerts
  const highRiskAlerts = extractionAlerts.filter(alert => 
    alert.severity === "high" || 
    (alert.severity === "medium" && (alert.confidence || 0) > 85)
  );

  // Log final stats
  const stats = {
    extracted: extractedDiscounts.length,
    accepted: accepted.length,
    needsReview: needsReview.length,
    rejected: rejected.length,
    totalAlerts: extractionAlerts.length,
    highRiskAlerts: highRiskAlerts.length,
  };

  logger.info("Enhanced extraction completed", { source, stats });

  // Log alert summary if there are alerts
  if (extractionAlerts.length > 0) {
    const alertSummary = summarizeAlerts(extractionAlerts);
    logger.info("Alert summary", { 
      source, 
      summary: alertSummary.summary,
      riskLevel: alertSummary.riskLevel,
      actionRequired: alertSummary.actionRequired,
    });
  }

  return {
    discounts: accepted, // Only return accepted discounts
    validationResults,
    extractionAlerts,
    stats,
  };
}

/**
 * Example of how to integrate this into an existing scraper
 * This replaces the extractXXXDiscounts function in any scraper
 */
export async function enhancedCarrefourExtraction(content: any): Promise<GenericDiscount[]> {
  const discountsToProcess = content.promotionsData || [];
  
  const allDiscounts: GenericDiscount[] = [];
  const allValidations: ValidationResult[] = [];
  const allAlerts: ExtractionAlert[] = [];

  // Process each promotion with enhanced extraction
  for (const promotionData of discountsToProcess) {
    try {
      const extractionPrompt = `
Extract the discount from the following pseudo-html:

${promotionData.domDescription}

Return a JSON object with the discount information.`;

      const result = await enhancedExtractionWithValidation(
        promotionData.domDescription,
        "carrefour",
        extractionPrompt
      );

      allDiscounts.push(...result.discounts);
      allValidations.push(...result.validationResults);
      allAlerts.push(...result.extractionAlerts);

    } catch (error) {
      logger.error("Failed to process promotion", { 
        error, 
        source: "carrefour",
        promotionIndex: discountsToProcess.indexOf(promotionData) 
      });
    }
  }

  // Log aggregated results
  logger.info("Carrefour extraction completed", {
    totalProcessed: discountsToProcess.length,
    totalExtracted: allDiscounts.length,
    totalAlerts: allAlerts.length,
    averageConfidence: allValidations.length > 0 
      ? Math.round(allValidations.reduce((sum, v) => sum + v.confidenceScore, 0) / allValidations.length)
      : 0,
  });

  return allDiscounts;
}

/**
 * Monitoring function to track extraction quality over time
 */
export async function logExtractionMetrics(
  source: string,
  validationResults: ValidationResult[],
  extractionAlerts: ExtractionAlert[]
) {
  if (validationResults.length === 0) return;

  const avgConfidence = validationResults.reduce((sum, v) => sum + v.confidenceScore, 0) / validationResults.length;
  const lowConfidence = validationResults.filter(v => v.confidenceScore < 70).length;
  const needsReview = validationResults.filter(v => v.recommendation === "review").length;
  const rejected = validationResults.filter(v => v.recommendation === "reject").length;
  
  const alertsByCategory = extractionAlerts.reduce((acc, alert) => {
    acc[alert.category] = (acc[alert.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const metrics = {
    source,
    timestamp: new Date().toISOString(),
    avgConfidence: Math.round(avgConfidence),
    lowConfidence,
    needsReview,
    rejected,
    totalAlerts: extractionAlerts.length,
    alertsByCategory,
    qualityScore: Math.max(0, avgConfidence - (extractionAlerts.length * 5)), // Penalize alerts
  };

  logger.info("Extraction quality metrics", metrics);

  // Here you could send metrics to monitoring system, database, etc.
  // await sendToMonitoring(metrics);
}