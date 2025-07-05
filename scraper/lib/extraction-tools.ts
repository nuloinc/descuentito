import logger from "../trigger/lib/logger";

export interface ExtractionAlert {
  severity: "low" | "medium" | "high";
  category: "uncertainty" | "inconsistency" | "missing_data" | "ambiguity" | "validation_error";
  message: string;
  field?: string;
  context?: string;
  confidence?: number; // 0-100, how sure the LLM is about this being an issue
}

export interface ExtractionContext {
  source: string;
  contentType: "html" | "text" | "image";
  alerts: ExtractionAlert[];
}

/**
 * Creates an extraction context that the LLM can use to flag issues
 */
export function createExtractionContext(source: string, contentType: "html" | "text" | "image"): ExtractionContext {
  return {
    source,
    contentType,
    alerts: [],
  };
}

/**
 * Alert function that can be made available to the LLM through tools or instructions
 */
export function createAlertFunction(context: ExtractionContext) {
  return function alert(
    severity: ExtractionAlert["severity"],
    category: ExtractionAlert["category"],
    message: string,
    options?: {
      field?: string;
      context?: string;
      confidence?: number;
    }
  ) {
    const alert: ExtractionAlert = {
      severity,
      category,
      message,
      field: options?.field,
      context: options?.context,
      confidence: options?.confidence,
    };

    context.alerts.push(alert);
    
    logger.warn("Extraction alert raised", {
      source: context.source,
      severity,
      category,
      message,
      field: options?.field,
    });

    return `ALERT LOGGED: ${severity.toUpperCase()} - ${message}`;
  };
}

/**
 * Enhanced prompt that instructs the LLM on how to use alerts
 */
export const EXTRACTION_ALERT_INSTRUCTIONS = `
## SISTEMA DE ALERTAS

Tienes acceso a un sistema de alertas para marcar problemas durante la extracción. USA ESTA FUNCIÓN cuando:

1. **No estés seguro** de cómo interpretar información ambigua
2. **Falte información** crítica en el contenido original
3. **Encuentres inconsistencias** en los datos
4. **Los datos no tengan sentido** lógicamente
5. **Tengas que hacer suposiciones** importantes

### Función de Alerta:
Usa la función \`ALERT(severity, category, message, {field?, context?, confidence?})\` cuando sea necesario.

**Severidades:**
- \`low\`: Datos menores faltantes o ambiguos
- \`medium\`: Información importante ambigua o inconsistente  
- \`high\`: Problemas críticos que afectan la validez del descuento

**Categorías:**
- \`uncertainty\`: No estás seguro de cómo interpretar algo
- \`inconsistency\`: Datos contradictorios en el contenido
- \`missing_data\`: Información importante faltante
- \`ambiguity\`: Múltiples interpretaciones posibles
- \`validation_error\`: Datos que no pasan validación lógica

**Ejemplos de uso:**
- \`ALERT("medium", "missing_data", "No se especifica fecha de vencimiento", {field: "validUntil", confidence: 85})\`
- \`ALERT("high", "inconsistency", "El descuento dice 50% pero el tope de $1000 sugiere solo 10%", {field: "discount.value", confidence: 95})\`
- \`ALERT("low", "uncertainty", "El texto menciona 'tarjetas seleccionadas' sin especificar cuáles", {field: "paymentMethods", confidence: 70})\`

**IMPORTANTE:** 
- Aún debes generar el JSON del descuento lo mejor que puedas
- Las alertas son ADICIONALES, no reemplazan la extracción
- Sé específico en tus alertas para facilitar la revisión posterior
- Prefiere errar hacia la precaución - mejor alertar de más que de menos

### Formato de respuesta:
\`\`\`json
{
  "discount": { /* tu extracción normal */ },
  "alerts": [
    {
      "severity": "medium",
      "category": "missing_data", 
      "message": "No se especifica fecha de vencimiento",
      "field": "validUntil",
      "confidence": 85
    }
  ]
}
\`\`\`
`;

/**
 * Processes extraction results that may include alerts
 */
export function processExtractionWithAlerts<T>(
  extractionResult: any,
  context: ExtractionContext
): {
  data: T;
  alerts: ExtractionAlert[];
  needsReview: boolean;
} {
  // Extract alerts from the LLM response if included
  const responseAlerts = extractionResult.alerts || [];
  
  // Combine with context alerts
  const allAlerts = [...context.alerts, ...responseAlerts];
  
  // Determine if manual review is needed
  const needsReview = allAlerts.some(alert => 
    alert.severity === "high" || 
    (alert.severity === "medium" && (alert.confidence || 0) > 80)
  );

  // Log summary
  if (allAlerts.length > 0) {
    logger.info("Extraction completed with alerts", {
      source: context.source,
      alertCount: allAlerts.length,
      highSeverity: allAlerts.filter(a => a.severity === "high").length,
      needsReview,
    });
  }

  return {
    data: extractionResult.discount || extractionResult,
    alerts: allAlerts,
    needsReview,
  };
}

/**
 * Generates a summary of alerts for logging/monitoring
 */
export function summarizeAlerts(alerts: ExtractionAlert[]): {
  summary: string;
  riskLevel: "low" | "medium" | "high";
  actionRequired: boolean;
} {
  if (alerts.length === 0) {
    return {
      summary: "No alerts - extraction completed successfully",
      riskLevel: "low", 
      actionRequired: false,
    };
  }

  const highAlerts = alerts.filter(a => a.severity === "high").length;
  const mediumAlerts = alerts.filter(a => a.severity === "medium").length;
  const lowAlerts = alerts.filter(a => a.severity === "low").length;

  let riskLevel: "low" | "medium" | "high" = "low";
  let actionRequired = false;

  if (highAlerts > 0) {
    riskLevel = "high";
    actionRequired = true;
  } else if (mediumAlerts > 0) {
    riskLevel = "medium";
    actionRequired = mediumAlerts > 1 || alerts.some(a => (a.confidence || 0) > 85);
  }

  const summary = `${alerts.length} alert(s): ${highAlerts} high, ${mediumAlerts} medium, ${lowAlerts} low severity`;

  return { summary, riskLevel, actionRequired };
}