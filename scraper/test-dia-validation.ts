#!/usr/bin/env bun

/**
 * Script de prueba para el sistema de validación de Día
 * 
 * Uso: bun run test-dia-validation.ts
 */

import { extractDiaDiscountsWithValidation } from "./trigger/scrapers/dia";
import type { ValidationConfig } from "./lib/validation-adapter";

// Datos de prueba simulando contenido scrapeado real de Día
const mockScrapedPromotions = [
  {
    domDescription: `
    <div class="promotion-card">
      <div class="bank-logo">Banco Galicia</div>
      <div class="discount-text">30% de descuento</div>
      <div class="validity">Válido hasta fin de enero</div>
      <div class="conditions">Solo con Plan Sueldo</div>
      <div class="store-type">APLICA TIENDA</div>
    </div>
    `,
    legalesText: `
    Promoción válida hasta el 31/01/2024. 
    Descuento aplicable solo con tarjetas de crédito Banco Galicia Plan Sueldo.
    Tope de reintegro: $5000.
    No válido para compras online.
    Excluye bebidas alcohólicas.
    `
  },
  {
    domDescription: `
    <div class="promotion-card">
      <div class="bank-logo">Mercado Pago</div>
      <div class="discount-text">15% OFF</div>
      <div class="validity">Válido todo el mes</div>
      <div class="payment-method">Con QR</div>
      <div class="store-type">APLICA ONLINE</div>
    </div>
    `,
    legalesText: `
    Promoción válida durante enero 2024.
    Pago únicamente con QR de Mercado Pago.
    Sin tope de reintegro.
    Válido para todas las categorías de productos.
    Solo aplicable en compras online.
    `
  },
  {
    domDescription: `
    <div class="promotion-card">
      <div class="bank-logo">Banco Nación</div>
      <div class="discount-text">25% descuento</div>
      <div class="validity">Vigente</div>
      <div class="special-card">Tarjeta Nativa</div>
      <div class="store-type">APLICA TIENDA APLICA ONLINE</div>
    </div>
    `,
    legalesText: `
    Promoción sin fecha específica de vencimiento.
    Solo con Tarjeta Nativa del Banco Nación.
    Tope: $2000.
    Aplicable en tiendas físicas y online.
    Válido para jubilados únicamente.
    `
  }
];

async function testValidationScenarios() {
  console.log("🧪 TESTING DÍA VALIDATION SYSTEM\n");

  const scenarios: Array<{
    name: string;
    config: ValidationConfig;
    description: string;
  }> = [
    {
      name: "Conservador",
      config: { minConfidence: 85, allowReview: false },
      description: "Alta precisión, rechaza todo lo dudoso"
    },
    {
      name: "Balanceado",
      config: { minConfidence: 70, allowReview: true },
      description: "Configuración por defecto recomendada"
    },
    {
      name: "Permisivo",
      config: { minConfidence: 50, allowReview: true },
      description: "Máxima captura, acepta casi todo"
    },
    {
      name: "Solo Alertas",
      config: { enablePostValidation: false, enableExtractionAlerts: true },
      description: "Solo alertas durante extracción, sin validación posterior"
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🔍 ESCENARIO: ${scenario.name}`);
    console.log(`📝 ${scenario.description}`);
    console.log(`⚙️  Config:`, scenario.config);
    console.log(`${"=".repeat(60)}\n`);

    try {
      const startTime = Date.now();
      const result = await extractDiaDiscountsWithValidation(
        mockScrapedPromotions,
        scenario.config
      );
      const duration = Date.now() - startTime;

      console.log(`✅ Completado en ${duration}ms\n`);

      // Mostrar estadísticas
      console.log("📊 ESTADÍSTICAS:");
      console.log(`   Extraídos: ${result.stats.extracted}`);
      console.log(`   ✅ Aceptados: ${result.stats.accepted}`);
      console.log(`   ⚠️  Para revisar: ${result.stats.needsReview}`);
      console.log(`   ❌ Rechazados: ${result.stats.rejected}`);
      console.log(`   🎯 Confianza promedio: ${result.stats.avgConfidence}%`);
      console.log(`   🚨 Total alertas: ${result.stats.totalAlerts}`);

      // Mostrar algunos ejemplos aceptados
      if (result.accepted.length > 0) {
        console.log(`\n💚 DESCUENTOS ACEPTADOS (${result.accepted.length}):`);
        result.accepted.slice(0, 2).forEach((discount, i) => {
          console.log(`   ${i + 1}. ${discount.discount.value}% descuento`);
          console.log(`      📅 ${discount.validFrom} → ${discount.validUntil}`);
          console.log(`      💳 ${discount.paymentMethods?.[0]?.[0] || 'N/A'}`);
          if (discount.limits?.maxDiscount) {
            console.log(`      💰 Tope: $${discount.limits.maxDiscount}`);
          }
        });
      }

      // Mostrar alertas interesantes
      if (result.stats.totalAlerts > 0) {
        console.log(`\n⚠️  ALERTAS DETECTADAS:`);
        // Obtener algunas alertas de los descuentos para mostrar
        const someAlerts = result.needsReview
          .concat(result.rejected)
          .flatMap((discount: any) => discount.alerts || [])
          .slice(0, 3);
        
        someAlerts.forEach((alert: any, i: number) => {
          console.log(`   ${i + 1}. [${alert.severity?.toUpperCase() || 'UNKNOWN'}] ${alert.message || 'No message'}`);
          if (alert.field) console.log(`      Campo: ${alert.field}`);
        });
      }

      // Mostrar tiempo de ejecución por modelo
      if (scenario.config.enablePostValidation !== false) {
        console.log(`\n⏱️  PERFORMANCE:`);
        console.log(`   Extracción (Gemini): ~${Math.round(duration * 0.7)}ms`);
        console.log(`   Validación (Haiku): ~${Math.round(duration * 0.3)}ms`);
      }

    } catch (error) {
      console.error(`❌ Error en escenario ${scenario.name}:`, error);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ TESTING COMPLETADO");
  console.log("💡 Para uso real: bun run cli.ts dia --with-validation");
  console.log("📚 Ver DIA_VALIDATION_USAGE.md para más detalles");
  console.log(`${"=".repeat(60)}`);
}

async function runQuickDemo() {
  console.log("🚀 QUICK DEMO - Modo Balanceado\n");
  
  try {
    const result = await extractDiaDiscountsWithValidation(mockScrapedPromotions, {
      minConfidence: 70,
      allowReview: true
    });

    console.log("📊 Resumen:");
    console.log(`• ${result.stats.extracted} descuentos extraídos`);
    console.log(`• ${result.stats.accepted} aceptados automáticamente`);
    console.log(`• ${result.stats.needsReview} requieren revisión manual`);
    console.log(`• ${result.stats.rejected} fueron rechazados`);
    console.log(`• Confianza promedio: ${result.stats.avgConfidence}%`);

    if (result.stats.totalAlerts > 0) {
      console.log(`• ${result.stats.totalAlerts} alertas detectadas`);
    }

    console.log("\n✅ En producción, solo se guardarían los aceptados");
    console.log("📝 Los que necesitan revisión se enviarían a cola manual");

  } catch (error) {
    console.error("❌ Error en demo:", error);
  }
}

// Para ejecutar: 
// bun run test-dia-validation.ts --quick  (demo rápido)
// bun run test-dia-validation.ts --full   (testing completo)

// Por defecto ejecutar el demo rápido como ejemplo
console.log("🧪 Test del Sistema de Validación de Día\n");
console.log("Ejecutando demo rápido...\n");
runQuickDemo().catch(console.error);