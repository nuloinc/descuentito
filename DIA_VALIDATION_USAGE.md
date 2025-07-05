# Día Scraper con Sistema de Validación

El scraper de Día ahora incluye un sistema de validación automático que mejora la calidad de las extracciones mediante:

1. **Alertas durante extracción**: El LLM puede marcar incertidumbres
2. **Validación post-extracción**: Un LLM secundario más barato valida los resultados
3. **Filtrado automático**: Los descuentos se clasifican en accepted/needsReview/rejected

## 🚀 Uso Básico

### Modo tradicional (sin cambios):
```bash
bun run cli.ts dia
```

### Modo con validación mejorada:
```bash
bun run cli.ts dia --with-validation
```

### Guardar resultados con validación:
```bash
bun run cli.ts dia --with-validation --save
```

## 📊 Salida Mejorada

Con `--with-validation`, verás:

```
[dia] Using enhanced validation system...
[dia] Enhanced results: {
  extracted: 15,
  accepted: 12,    # ✅ Alta calidad, guardados automáticamente
  needsReview: 2,  # ⚠️  Requieren revisión manual
  rejected: 1,     # ❌ Calidad insuficiente
  avgConfidence: 78
}

[DIA] Validation Results: {
  extracted: 15,
  accepted: 12,
  needsReview: 2,
  rejected: 1,
  avgConfidence: 78,
  totalAlerts: 5
}
[DIA] 2 discounts need manual review
[DIA] 1 discounts were rejected
```

## 📁 Archivos Generados

Con `--save`, se generan:

- `dia.json` - Solo descuentos aceptados (compatible con sistema existente)
- `dia_validation_full.json` - Resultados completos de validación con stats y alertas

## ⚙️ Configuración

### En el código (modificando `scrapeDiaWithValidation`):

```typescript
const result = await scrapeDiaWithValidation({
  minConfidence: 70,        // Mínimo score para aceptar (0-100)
  allowReview: true,        // Permitir "needsReview" en lugar de rechazar
  enablePostValidation: true,   // Usar LLM secundario para validar
  enableExtractionAlerts: true, // Permitir alertas durante extracción
});
```

### Configuraciones pre-definidas:

**Conservador** (máxima precisión):
```typescript
{ minConfidence: 85, allowReview: false }
```

**Balanceado** (por defecto):
```typescript
{ minConfidence: 70, allowReview: true }
```

**Permisivo** (máxima captura):
```typescript
{ minConfidence: 50, allowReview: true }
```

## 🔍 Tipos de Alertas Esperadas

### Comunes en Día:
- **missing_data**: Fechas de vigencia poco claras
- **uncertainty**: "Tarjetas participantes" sin especificar cuáles
- **inconsistency**: Descuentos vs topes contradictorios
- **ambiguity**: Términos como "hasta fin de mes"

### Ejemplo de alerta:
```json
{
  "severity": "medium",
  "category": "missing_data",
  "message": "Fecha de vencimiento ambigua: 'válido todo enero'",
  "field": "validUntil",
  "confidence": 85
}
```

## 🛠️ Uso Programático

### Función individual con validación:
```typescript
import { scrapeDiaWithValidation } from "./scrapers/dia";

const result = await scrapeDiaWithValidation({
  minConfidence: 75,
  allowReview: true
});

console.log(`Aceptados: ${result.accepted.length}`);
console.log(`Para revisar: ${result.needsReview.length}`);
console.log(`Rechazados: ${result.rejected.length}`);

// Usar solo los aceptados
const validDiscounts = result.accepted;
```

### Función reutilizable para otros scrapers:
```typescript
import { withValidation } from "../../lib/validation-adapter";

const result = await withValidation(
  () => extractJumboDiscounts(content),
  originalContent,
  "jumbo",
  { minConfidence: 70 }
);
```

## 📈 Beneficios

1. **Calidad mejorada**: Filtrado automático de extracciones problemáticas
2. **Visibilidad**: Alertas específicas sobre qué revisar manualmente
3. **Compatibilidad**: Sin cambios en el flujo existente
4. **Eficiencia**: Validación con modelo más barato (Haiku vs Gemini)
5. **Métricas**: Tracking de performance y calidad

## 🚨 Migración Gradual

El sistema es **completamente opcional**:

- Sin `--with-validation`: Funciona exactamente igual que antes
- Con `--with-validation`: Mejoras automáticas sin romper compatibilidad
- Los archivos generados mantienen la misma estructura

## 🔧 Troubleshooting

### Si no hay descuentos aceptados:
1. Reducir `minConfidence` (ej. de 70 a 50)
2. Verificar que `allowReview: true`
3. Revisar logs de alertas para entender problemas

### Si hay muchos "needsReview":
1. Aumentar `minConfidence` si quieres más restrictivo
2. O revisar manualmente - las alertas te dicen qué verificar

### Para debugging:
```bash
# Ver todos los detalles en consola
bun run cli.ts dia --with-validation

# Ver logs detallados
LOG_LEVEL=debug bun run cli.ts dia --with-validation
```

## 🔮 Próximos Pasos

Una vez validado el sistema con Día:
1. Extender a otros scrapers (Carrefour, Jumbo, etc.)
2. Agregar métricas a dashboard/monitoring
3. Usar feedback manual para mejorar prompts
4. A/B testing entre modelos