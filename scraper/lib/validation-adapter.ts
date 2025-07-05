import { streamObject, generateText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import logger from "../trigger/lib/logger";
import type { GenericDiscount } from "../../promos-db/schema";

export interface ValidationResult {
  confidenceScore: number; // 0-100
  issues: ValidationIssue[];
  recommendation: "accept" | "review" | "reject";
  reasoning: string;
}

export interface ValidationIssue {
  severity: "low" | "medium" | "high";
  type: "date" | "payment" | "discount" | "logic" | "consistency";
  message: string;
  field?: string;
}

export interface ExtractionAlert {
  severity: "low" | "medium" | "high";
  category: "uncertainty" | "inconsistency" | "missing_data" | "ambiguity" | "validation_error";
  message: string;
  field?: string;
  confidence?: number;
}

export interface ValidationConfig {
  minConfidence?: number;
  allowReview?: boolean;
  enablePostValidation?: boolean;
  enableExtractionAlerts?: boolean;
}

const DEFAULT_CONFIG: ValidationConfig = {
  minConfidence: 70,
  allowReview: true,
  enablePostValidation: true,
  enableExtractionAlerts: true,
};

/**
 * Enhanced prompt instructions that can be added to any existing extraction prompt
 */
export const EXTRACTION_ALERT_INSTRUCTIONS = `
## SISTEMA DE ALERTAS

Si encuentras problemas durante la extracción, incluye un campo "alerts" en tu respuesta:

USAR ALERTAS cuando:
1. **No estés seguro** de cómo interpretar información ambigua
2. **Falte información** crítica en el contenido original  
3. **Encuentres inconsistencias** en los datos
4. **Los datos no tengan sentido** lógicamente
5. **Tengas que hacer suposiciones** importantes

**Formato de alertas:**
\`\`\`json
{
  "alerts": [
    {
      "severity": "low|medium|high",
      "category": "uncertainty|inconsistency|missing_data|ambiguity|validation_error",
      "message": "descripción específica del problema",
      "field": "campo afectado (opcional)",
      "confidence": 85
    }
  ]
}
\`\`\`

**Ejemplos:**
- \`{"severity": "medium", "category": "missing_data", "message": "Fecha de vencimiento no clara", "field": "validUntil"}\`
- \`{"severity": "high", "category": "inconsistency", "message": "Descuento 50% pero tope $1000 sugiere 10%"}\`

**IMPORTANTE:** Aún debes generar la extracción completa, las alertas son adicionales.
`;

/**
 * Post-extraction validation using a cheaper model
 */
async function validateWithSecondaryLLM(
  originalContent: string,
  extractedDiscount: GenericDiscount,
  source: string
): Promise<ValidationResult> {
  try {
    const prompt = `Eres un validador de descuentos argentinos. Evalúa si esta extracción es correcta.

CONTENIDO ORIGINAL:
${originalContent}

DESCUENTO EXTRAÍDO:
${JSON.stringify(extractedDiscount, null, 2)}

FUENTE: ${source}

Evalúa:
1. ¿Los datos coinciden con el contenido?
2. ¿Las fechas son lógicas?
3. ¿Los porcentajes son realistas?
4. ¿Los métodos de pago están bien mapeados?

Responde en JSON:
{
  "confidenceScore": <0-100>,
  "issues": [{"severity": "low|medium|high", "type": "date|payment|discount|logic|consistency", "message": "descripción", "field": "campo"}],
  "recommendation": "accept|review|reject",
  "reasoning": "explicación breve"
}`;

    const { text } = await generateText({
      model: openrouter.chat("anthropic/claude-3-5-haiku-20241022"),
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    });

    return JSON.parse(text.trim()) as ValidationResult;
  } catch (error) {
    logger.error("Validation failed", { error, source });
    return {
      confidenceScore: 30,
      issues: [{ severity: "high", type: "logic", message: "Error durante validación" }],
      recommendation: "review",
      reasoning: "Error técnico durante validación",
    };
  }
}

/**
 * Process extraction results and extract alerts
 */
function processExtractionAlerts(extractionResult: any): {
  cleanedResult: any;
  alerts: ExtractionAlert[];
} {
  const alerts = extractionResult.alerts || [];
  
  // Remove alerts from the main result to avoid schema issues
  const cleanedResult = { ...extractionResult };
  delete cleanedResult.alerts;
  
  return { cleanedResult, alerts };
}

/**
 * Filter discounts based on validation results and alerts
 */
function shouldAcceptDiscount(
  validationResult: ValidationResult | null,
  alerts: ExtractionAlert[],
  config: ValidationConfig
): { status: "accepted" | "needsReview" | "rejected"; reason: string } {
  // Check validation score
  if (validationResult && validationResult.confidenceScore < (config.minConfidence || 70)) {
    return { status: "rejected", reason: "Confianza insuficiente" };
  }

  // Check validation recommendation
  if (validationResult?.recommendation === "reject") {
    return { status: "rejected", reason: "Validación recomienda rechazo" };
  }

  // Check high severity alerts
  const highSeverityAlerts = alerts.filter(a => a.severity === "high");
  if (highSeverityAlerts.length > 0) {
    return config.allowReview 
      ? { status: "needsReview", reason: "Alertas de alta severidad" }
      : { status: "rejected", reason: "Alertas críticas y review no permitido" };
  }

  // Check medium severity alerts with high confidence
  const criticalMediumAlerts = alerts.filter(a => 
    a.severity === "medium" && (a.confidence || 0) > 80
  );
  if (criticalMediumAlerts.length > 0 || validationResult?.recommendation === "review") {
    return config.allowReview
      ? { status: "needsReview", reason: "Issues detectados requieren revisión" }
      : { status: "rejected", reason: "Review requerido pero no permitido" };
  }

  return { status: "accepted", reason: "Validación exitosa" };
}

/**
 * Enhanced extraction wrapper that can be used with existing scrapers
 */
export async function withValidation<T extends GenericDiscount>(
  extractionFunction: () => Promise<T[]> | AsyncIterable<T>,
  originalContent: string,
  source: string,
  config: ValidationConfig = {}
): Promise<{
  accepted: T[];
  needsReview: T[];
  rejected: T[];
  stats: {
    extracted: number;
    accepted: number;
    needsReview: number;
    rejected: number;
    totalAlerts: number;
    avgConfidence: number;
  };
}> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  logger.info("Starting enhanced extraction", { source, config: finalConfig });

  // Execute the original extraction function
  const extractionResult = await extractionFunction();
  
  // Handle both Promise<T[]> and AsyncIterable<T>
  let discounts: T[];
  if (Array.isArray(extractionResult)) {
    discounts = extractionResult;
  } else {
    // Convert AsyncIterable to Array
    discounts = [];
    for await (const item of extractionResult) {
      discounts.push(item);
    }
  }

  const accepted: T[] = [];
  const needsReview: T[] = [];
  const rejected: T[] = [];
  const allValidations: ValidationResult[] = [];
  const allAlerts: ExtractionAlert[] = [];

  // Process each discount
  for (const discount of discounts) {
    let validationResult: ValidationResult | null = null;
    let alerts: ExtractionAlert[] = [];

    // Extract alerts if the discount has them
    if ('alerts' in discount && Array.isArray((discount as any).alerts)) {
      alerts = (discount as any).alerts;
      allAlerts.push(...alerts);
      
      // Clean the discount object
      const cleanedDiscount = { ...discount };
      delete (cleanedDiscount as any).alerts;
      Object.assign(discount, cleanedDiscount);
    }

    // Post-extraction validation
    if (finalConfig.enablePostValidation) {
      validationResult = await validateWithSecondaryLLM(
        originalContent,
        discount,
        source
      );
      allValidations.push(validationResult);
    }

    // Determine acceptance
    const decision = shouldAcceptDiscount(validationResult, alerts, finalConfig);
    
    switch (decision.status) {
      case "accepted":
        accepted.push(discount);
        break;
      case "needsReview":
        needsReview.push(discount);
        break;
      case "rejected":
        rejected.push(discount);
        break;
    }

    // Log individual decision
    logger.debug("Discount processed", {
      source,
      status: decision.status,
      reason: decision.reason,
      confidence: validationResult?.confidenceScore,
      alertCount: alerts.length,
    });
  }

  const stats = {
    extracted: discounts.length,
    accepted: accepted.length,
    needsReview: needsReview.length,
    rejected: rejected.length,
    totalAlerts: allAlerts.length,
    avgConfidence: allValidations.length > 0 
      ? Math.round(allValidations.reduce((sum, v) => sum + v.confidenceScore, 0) / allValidations.length)
      : 0,
  };

  logger.info("Enhanced extraction completed", { source, stats });

  return { accepted, needsReview, rejected, stats };
}

/**
 * Helper to add alert instructions to any existing prompt
 */
export function enhancePromptWithAlerts(originalPrompt: string): string {
  return `${originalPrompt}

${EXTRACTION_ALERT_INSTRUCTIONS}`;
}