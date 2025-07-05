import { generateText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import logger from "../trigger/lib/logger.ts";
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

/**
 * Valida un descuento extraído usando un LLM más barato para detectar errores
 */
export async function validateExtractedDiscount(
  originalContent: string,
  extractedDiscount: GenericDiscount,
  source: string
): Promise<ValidationResult> {
  try {
    const prompt = `Eres un validador experto de descuentos argentinos. Tu trabajo es evaluar si un descuento extraído por IA es correcto y confiable.

CONTENIDO ORIGINAL:
${originalContent}

DESCUENTO EXTRAÍDO:
${JSON.stringify(extractedDiscount, null, 2)}

FUENTE: ${source}

Evalúa la extracción considerando:

1. **Exactitud de datos**: ¿Los datos extraídos coinciden con el contenido original?
2. **Completitud**: ¿Se capturó toda la información relevante?
3. **Lógica**: ¿Tienen sentido las fechas, porcentajes y restricciones?
4. **Consistencia**: ¿Son coherentes entre sí todos los campos?

CRITERIOS ESPECÍFICOS:
- Fechas válidas y lógicas (validFrom <= validUntil)
- Porcentajes realistas (0-100% para descuentos, 0-12 para cuotas)
- Métodos de pago correctamente mapeados
- Restricciones relevantes y no redundantes
- Productos/exclusiones bien categorizados

Responde en formato JSON:
{
  "confidenceScore": <número 0-100>,
  "issues": [
    {
      "severity": "low|medium|high",
      "type": "date|payment|discount|logic|consistency",
      "message": "descripción del problema",
      "field": "campo afectado (opcional)"
    }
  ],
  "recommendation": "accept|review|reject",
  "reasoning": "explicación de 1-2 líneas"
}

Puntajes sugeridos:
- 90-100: Extracción excelente, sin problemas
- 70-89: Buena extracción, problemas menores
- 50-69: Extracción regular, requiere revisión
- 0-49: Extracción problemática, rechazar`;

    const { text } = await generateText({
      model: openrouter.chat("anthropic/claude-3-5-haiku-20241022"), // LLM más barato
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Parse the JSON response
    const result = JSON.parse(text.trim()) as ValidationResult;
    
    logger.info("Validation completed", {
      source,
      confidenceScore: result.confidenceScore,
      recommendation: result.recommendation,
      issuesCount: result.issues.length,
    });

    return result;
  } catch (error) {
    logger.error("Validation failed", { error, source });
    
    // Return a conservative validation result on error
    return {
      confidenceScore: 30,
      issues: [
        {
          severity: "high",
          type: "logic",
          message: "Error durante la validación - requiere revisión manual",
        },
      ],
      recommendation: "review",
      reasoning: "Error técnico durante validación",
    };
  }
}

/**
 * Valida múltiples descuentos en lote
 */
export async function validateExtractedDiscounts(
  originalContent: string,
  extractedDiscounts: GenericDiscount[],
  source: string
): Promise<ValidationResult[]> {
  const validations = await Promise.all(
    extractedDiscounts.map((discount) =>
      validateExtractedDiscount(originalContent, discount, source)
    )
  );

  // Log aggregate stats
  const avgConfidence = validations.reduce((sum, v) => sum + v.confidenceScore, 0) / validations.length;
  const highIssues = validations.flatMap(v => v.issues).filter(i => i.severity === "high").length;
  
  logger.info("Batch validation completed", {
    source,
    count: validations.length,
    avgConfidence: Math.round(avgConfidence),
    highIssues,
  });

  return validations;
}

/**
 * Filtra descuentos basado en las validaciones
 */
export function filterDiscountsByValidation(
  discounts: GenericDiscount[],
  validations: ValidationResult[],
  options: {
    minConfidence?: number;
    allowReview?: boolean;
  } = {}
): {
  accepted: GenericDiscount[];
  needsReview: GenericDiscount[];
  rejected: GenericDiscount[];
} {
  const { minConfidence = 70, allowReview = true } = options;
  
  const accepted: GenericDiscount[] = [];
  const needsReview: GenericDiscount[] = [];
  const rejected: GenericDiscount[] = [];

  discounts.forEach((discount, index) => {
    const validation = validations[index];
    
    if (validation.recommendation === "accept" && validation.confidenceScore >= minConfidence) {
      accepted.push(discount);
    } else if (validation.recommendation === "review" && allowReview) {
      needsReview.push(discount);
    } else {
      rejected.push(discount);
    }
  });

  logger.info("Discounts filtered by validation", {
    accepted: accepted.length,
    needsReview: needsReview.length,
    rejected: rejected.length,
  });

  return { accepted, needsReview, rejected };
}