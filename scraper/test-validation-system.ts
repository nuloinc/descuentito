#!/usr/bin/env bun

/**
 * Script de prueba para demostrar el sistema de validación de extracciones
 * 
 * Uso: bun run test-validation-system.ts
 */

import type { GenericDiscount } from "../promos-db/schema";

// Simulación de funciones para testing (en producción vendrían de los archivos reales)
interface ValidationResult {
  confidenceScore: number;
  issues: Array<{
    severity: "low" | "medium" | "high";
    type: string;
    message: string;
    field?: string;
  }>;
  recommendation: "accept" | "review" | "reject";
  reasoning: string;
}

interface ExtractionAlert {
  severity: "low" | "medium" | "high";
  category: string;
  message: string;
  field?: string;
  confidence?: number;
}

// Datos de prueba
const testContent = `
🛒 CARREFOUR MAXI - DESCUENTO ESPECIAL

✨ 30% de descuento en toda la tienda
💳 Válido con tarjetas Banco Galicia
📅 Vigente hasta fin de mes
🏪 Solo en sucursales físicas
💰 Tope de reintegro: $5.000

* Excluye bebidas alcohólicas y cigarrillos
* No acumulable con otras promociones
* Válido solo para clientes Plan Sueldo
`;

const testExtraction: GenericDiscount = {
  title: "30% descuento Carrefour Maxi",
  description: "Descuento especial en toda la tienda",
  discount: {
    type: "porcentaje",
    value: 30
  },
  validFrom: "2024-01-01",
  validUntil: "2024-01-31", // Ambiguo: "fin de mes"
  paymentMethods: [["Banco Galicia"]], 
  restrictions: ["Solo para clientes Plan Sueldo", "No acumulable con otras promociones"],
  excludesProducts: "Bebidas alcohólicas y cigarrillos",
  limits: {
    maxDiscount: 5000,
    explicitlyHasNoLimit: false
  },
  url: "https://carrefour.com.ar",
  membership: ["Plan Sueldo"]
};

const testExtractionAlerts: ExtractionAlert[] = [
  {
    severity: "medium",
    category: "missing_data",
    message: "Fecha de fin ambigua: 'hasta fin de mes' - asumiendo enero",
    field: "validUntil",
    confidence: 80
  },
  {
    severity: "low", 
    category: "uncertainty",
    message: "No se especifica si el Plan Sueldo debe ser de Banco Galicia",
    field: "membership",
    confidence: 65
  }
];

// Simulaciones de las funciones de validación
async function simulateValidation(
  content: string,
  discount: GenericDiscount
): Promise<ValidationResult> {
  console.log("🔍 Validando extracción con LLM secundario...");
  
  // Simular delay de API
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const issues = [];
  let score = 90;
  
  // Verificar fechas
  if (discount.validUntil === "2024-01-31") {
    issues.push({
      severity: "medium" as const,
      type: "date",
      message: "Fecha de vencimiento inferida de texto ambiguo",
      field: "validUntil"
    });
    score -= 10;
  }
  
  // Verificar consistencia de membresía
  if (discount.membership?.includes("Plan Sueldo") && 
      discount.paymentMethods?.[0]?.includes("Banco Galicia")) {
    issues.push({
      severity: "low" as const,
      type: "consistency",
      message: "Relación entre Plan Sueldo y Banco Galicia no explícita",
      field: "membership"
    });
    score -= 5;
  }
  
  let recommendation: "accept" | "review" | "reject" = "accept";
  if (score < 70) recommendation = "reject";
  else if (score < 85 || issues.some(i => i.severity === "medium")) recommendation = "review";
  
  return {
    confidenceScore: score,
    issues,
    recommendation,
    reasoning: `Score: ${score}/100. ${issues.length > 0 ? 'Issues encontrados requieren atención.' : 'Extracción sólida.'}`
  };
}

function processExtractionWithAlerts(alerts: ExtractionAlert[]) {
  console.log("⚠️  Procesando alertas de extracción...");
  
  const needsReview = alerts.some(alert => 
    alert.severity === "high" || 
    (alert.severity === "medium" && (alert.confidence || 0) > 75)
  );

  const summary = {
    totalAlerts: alerts.length,
    highSeverity: alerts.filter(a => a.severity === "high").length,
    mediumSeverity: alerts.filter(a => a.severity === "medium").length,
    lowSeverity: alerts.filter(a => a.severity === "low").length,
    needsReview
  };

  return { summary, needsReview };
}

function filterByValidation(
  discount: GenericDiscount,
  validation: ValidationResult,
  alertsNeedReview: boolean,
  options = { minConfidence: 70, allowReview: true }
) {
  console.log("🔄 Filtrando resultados...");
  
  if (validation.recommendation === "reject" || validation.confidenceScore < options.minConfidence) {
    return { status: "rejected", reason: "Confianza insuficiente o validación negativa" };
  }
  
  if (validation.recommendation === "review" || alertsNeedReview) {
    if (options.allowReview) {
      return { status: "needsReview", reason: "Issues detectados requieren revisión manual" };
    } else {
      return { status: "rejected", reason: "Review requerido pero no permitido en configuración" };
    }
  }
  
  return { status: "accepted", reason: "Validación exitosa" };
}

// Función principal de demostración
async function runValidationDemo() {
  console.log("🚀 DEMO: Sistema de Validación de Extracciones LLM\n");
  
  console.log("📄 Contenido original:");
  console.log(testContent);
  console.log("\n" + "=".repeat(60) + "\n");
  
  console.log("📊 Descuento extraído:");
  console.log(JSON.stringify(testExtraction, null, 2));
  console.log("\n" + "=".repeat(60) + "\n");
  
  console.log("🚨 Alertas durante extracción:");
  testExtractionAlerts.forEach((alert, i) => {
    console.log(`${i + 1}. [${alert.severity.toUpperCase()}] ${alert.message}`);
    if (alert.field) console.log(`   Campo: ${alert.field}`);
    if (alert.confidence) console.log(`   Confianza: ${alert.confidence}%`);
  });
  console.log("\n" + "=".repeat(60) + "\n");
  
  // Procesar alertas
  const { summary, needsReview } = processExtractionWithAlerts(testExtractionAlerts);
  console.log("📋 Resumen de alertas:");
  console.log(`- Total: ${summary.totalAlerts}`);
  console.log(`- High: ${summary.highSeverity}, Medium: ${summary.mediumSeverity}, Low: ${summary.lowSeverity}`);
  console.log(`- Requiere revisión: ${needsReview ? "SÍ" : "NO"}`);
  console.log("\n" + "=".repeat(60) + "\n");
  
  // Validación post-extracción
  const validation = await simulateValidation(testContent, testExtraction);
  
  console.log("🔍 Resultado de validación:");
  console.log(`- Confianza: ${validation.confidenceScore}/100`);
  console.log(`- Recomendación: ${validation.recommendation.toUpperCase()}`);
  console.log(`- Razonamiento: ${validation.reasoning}`);
  
  if (validation.issues.length > 0) {
    console.log("- Issues encontrados:");
    validation.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
    });
  }
  console.log("\n" + "=".repeat(60) + "\n");
  
  // Filtrado final
  console.log("🎯 Decisiones finales:\n");
  
  const scenarios = [
    { name: "Conservador", config: { minConfidence: 85, allowReview: false } },
    { name: "Balanceado", config: { minConfidence: 70, allowReview: true } },
    { name: "Permisivo", config: { minConfidence: 50, allowReview: true } }
  ];
  
  scenarios.forEach(scenario => {
    const result = filterByValidation(testExtraction, validation, needsReview, scenario.config);
    console.log(`${scenario.name} (minConf: ${scenario.config.minConfidence}, allowReview: ${scenario.config.allowReview}):`);
    console.log(`  → Status: ${result.status.toUpperCase()}`);
    console.log(`  → Razón: ${result.reason}`);
    console.log();
  });
  
  console.log("=".repeat(60));
  console.log("✅ Demo completado!");
  console.log("\n💡 En producción:");
  console.log("- Los descuentos 'accepted' se guardarían en la base de datos");
  console.log("- Los 'needsReview' se enviarían a una cola de revisión manual");
  console.log("- Los 'rejected' se logearían para análisis posterior");
  console.log("- Las métricas se enviarían a un sistema de monitoreo");
}

// Ejecutar demo al importar directamente
// Para ejecutar: bun run test-validation-system.ts

export { runValidationDemo };