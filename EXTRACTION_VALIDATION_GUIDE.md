# Sistema de Validación de Extracciones LLM

Este documento describe las dos estrategias implementadas para mejorar la calidad y confiabilidad de las extracciones de descuentos realizadas por LLMs.

## 🎯 Objetivo

Evitar tomar descuentos que el LLM sabe que son incorrectos/no soporta, pero está obligado a generar debido a las limitaciones del prompt. Implementamos dos enfoques complementarios:

1. **Validación Post-Extracción**: Un LLM evaluador más barato valida los resultados
2. **Sistema de Alertas**: El LLM extractor puede marcar incertidumbres durante el proceso

## 🔍 Estrategia 1: Validación Post-Extracción

### Archivo: `scraper/lib/validation.ts`

Un sistema que usa Claude 3.5 Haiku (más barato) para evaluar la calidad de extracciones realizadas por modelos más caros.

### Características:

- **Puntaje de Confianza**: 0-100 basado en exactitud, completitud y lógica
- **Categorización de Issues**: Fechas, pagos, descuentos, lógica, consistencia
- **Recomendaciones**: Accept/Review/Reject
- **Filtrado Automático**: Separa descuentos según calidad

### Uso:

```typescript
import { validateExtractedDiscounts, filterDiscountsByValidation } from "./validation";

// Validar descuentos extraídos
const validations = await validateExtractedDiscounts(
  originalContent,
  extractedDiscounts,
  "carrefour"
);

// Filtrar basado en validación
const { accepted, needsReview, rejected } = filterDiscountsByValidation(
  discounts,
  validations,
  { minConfidence: 70, allowReview: true }
);
```

### Ejemplo de Respuesta:

```json
{
  "confidenceScore": 85,
  "issues": [
    {
      "severity": "medium",
      "type": "missing_data",
      "message": "Fecha de vencimiento no especificada claramente",
      "field": "validUntil"
    }
  ],
  "recommendation": "review",
  "reasoning": "Extracción buena pero con fecha ambigua"
}
```

## ⚠️ Estrategia 2: Sistema de Alertas Durante Extracción

### Archivo: `scraper/lib/extraction-tools.ts`

Permite al LLM extractor marcar incertidumbres y problemas en tiempo real durante la extracción.

### Características:

- **Alertas Graduales**: Low/Medium/High severity
- **Categorías Específicas**: Uncertainty, Inconsistency, Missing Data, Ambiguity, Validation Error
- **Contexto Rico**: Campo afectado, confianza, contexto adicional
- **No Bloquea Extracción**: Las alertas son adicionales, no reemplazan la extracción

### Instrucciones para el LLM:

El sistema incluye `EXTRACTION_ALERT_INSTRUCTIONS` que se puede agregar a cualquier prompt de extracción. Instruye al LLM sobre cuándo y cómo usar alertas.

### Ejemplos de Uso de Alertas:

```
ALERT("medium", "missing_data", "No se especifica fecha de vencimiento", {field: "validUntil", confidence: 85})

ALERT("high", "inconsistency", "El descuento dice 50% pero el tope de $1000 sugiere solo 10%", {field: "discount.value", confidence: 95})

ALERT("low", "uncertainty", "El texto menciona 'tarjetas seleccionadas' sin especificar cuáles", {field: "paymentMethods", confidence: 70})
```

### Formato de Respuesta del LLM:

```json
{
  "discount": {
    "title": "50% descuento Carrefour",
    "discount": { "type": "porcentaje", "value": 50 },
    // ... resto de campos
  },
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
```

## 🚀 Implementación Completa

### Archivo: `scraper/lib/enhanced-extraction-example.ts`

Combina ambas estrategias en una función única que:

1. Agrega instrucciones de alertas al prompt
2. Extrae con LLM principal (que puede alertar)
3. Valida con LLM secundario más barato
4. Filtra resultados basado en ambas validaciones
5. Registra métricas de calidad

### Integración en Scrapers Existentes:

```typescript
// Reemplazar función extractXXXDiscounts existente
export async function extractCarrefourDiscounts(content: any) {
  const result = await enhancedExtractionWithValidation(
    content.domDescription,
    "carrefour", 
    originalPrompt
  );
  
  return result.discounts; // Solo discuentos aceptados
}
```

## 📊 Métricas y Monitoreo

El sistema registra métricas detalladas:

- **Confianza Promedio**: Score de validación
- **Distribución de Issues**: Por categoría y severidad
- **Rates de Aceptación**: Accepted/Review/Rejected
- **Quality Score**: Métrica combinada que penaliza alertas

### Ejemplo de Logs:

```json
{
  "source": "carrefour",
  "stats": {
    "extracted": 15,
    "accepted": 12,
    "needsReview": 2,
    "rejected": 1,
    "totalAlerts": 8,
    "highRiskAlerts": 1
  },
  "avgConfidence": 78,
  "qualityScore": 73
}
```

## 🔧 Configuración

### Variables de Entorno:

- Los modelos OpenRouter requieren `OPENROUTER_API_KEY`
- Logs configurables via `LOG_LEVEL`

### Modelos Recomendados:

- **Extracción Principal**: `anthropic/claude-3-5-sonnet-20241022` (mayor calidad)
- **Validación**: `anthropic/claude-3-5-haiku-20241022` (más barato, más rápido)

### Thresholds Sugeridos:

- **minConfidence**: 70 (puede ajustarse por fuente)
- **Alert Confidence**: >80 para medium alerts para marcar como "needs review"
- **High Severity**: Cualquier alert high requiere revisión

## 🎛️ Casos de Uso

### Conservador (Alta Precisión):
```typescript
const { accepted } = filterDiscountsByValidation(discounts, validations, {
  minConfidence: 85,
  allowReview: false
});
```

### Balanceado (Caso por Defecto):
```typescript
const { accepted, needsReview } = filterDiscountsByValidation(discounts, validations, {
  minConfidence: 70,
  allowReview: true
});
```

### Permisivo (Capturar Máximo):
```typescript
const { accepted, needsReview } = filterDiscountsByValidation(discounts, validations, {
  minConfidence: 50,
  allowReview: true
});
```

## 🚨 Alertas Comunes Esperadas

### Por Fuente:

**Carrefour/Supermercados:**
- Fechas de vigencia ambiguas
- Métodos de pago no específicos ("tarjetas participantes")
- Topes de descuento poco claros

**Bancos:**
- Exclusiones de productos complejas
- Requisitos de membresía específicos
- Múltiples tiers de descuentos

### Por Categoría:

- **missing_data**: Fechas, topes, métodos de pago faltantes
- **uncertainty**: Términos ambiguos, referencias vagas
- **inconsistency**: Descuentos vs topes contradictorios
- **validation_error**: Fechas inválidas, porcentajes imposibles

## 🔄 Flujo de Procesamiento

```
Contenido Original
       ↓
[LLM Extractor + Sistema de Alertas]
       ↓
Extracción + Alertas
       ↓
[LLM Validador Barato]
       ↓
Scores de Confianza + Issues
       ↓
[Filtrado Automático]
       ↓
Accepted / NeedsReview / Rejected
```

## 📈 Beneficios Esperados

1. **Reducción de Falsos Positivos**: Filtrado automático de extracciones problemáticas
2. **Visibilidad de Problemas**: Alertas específicas para revisión manual
3. **Métricas de Calidad**: Tracking de performance por fuente
4. **Cost Efficiency**: Validación con modelo más barato
5. **Escalabilidad**: Sistema automático que reduce intervención manual

## 🛠️ Instalación y Setup

1. Instalar dependencias (ya están en package.json):
   ```bash
   bun install
   ```

2. Configurar API keys en `.env`:
   ```
   OPENROUTER_API_KEY=your_key_here
   ```

3. Importar y usar en scrapers existentes:
   ```typescript
   import { enhancedExtractionWithValidation } from "./lib/enhanced-extraction-example";
   ```

4. Monitorear logs para ajustar thresholds según necesidad.

## 🔮 Extensiones Futuras

- **A/B Testing**: Comparar modelos de validación
- **Learning Loop**: Usar feedback manual para mejorar prompts
- **Alert Training**: Analizar patterns de alertas para optimizar detección
- **Multi-Model Consensus**: Usar múltiples LLMs para validación
- **Automated Retries**: Re-intentar extracciones con alertas usando prompts refinados