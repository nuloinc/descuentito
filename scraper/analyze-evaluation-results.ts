#!/usr/bin/env bun
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import type { Discount, GenericDiscount } from "../promos-db/schema";
import type { ExtractionResult } from "./llm-evaluation";

// Important fields to compare (excluding restrictions, etc.)
const IMPORTANT_FIELDS: (keyof GenericDiscount)[] = [
  "discount",
  "validFrom",
  "validUntil", 
  "weekdays",
  "paymentMethods",
  "limits",
  "excludesProducts",
  "onlyForProducts",
];

interface FieldComparison {
  field: string;
  accuracy: number;
  totalComparisons: number;
  details: string;
}

interface ModelAnalysis {
  modelName: string;
  sources: Record<string, SourceAnalysis>;
  overallAccuracy: number;
  avgExecutionTime: number;
  totalErrors: number;
}

interface SourceAnalysis {
  source: string;
  referenceCount: number;
  extractedCount: number;
  fieldAccuracies: FieldComparison[];
  overallAccuracy: number;
  executionTimeMs: number;
  errors: string[];
}

interface ComparisonSummary {
  models: ModelAnalysis[];
  bestModel: string;
  worstModel: string;
  avgAccuracyByField: Record<string, number>;
  summary: string;
}

class ResultAnalyzer {
  private resultsDir: string;

  constructor(resultsDir: string) {
    this.resultsDir = resultsDir;
  }

  private compareField(actual: any, expected: any, fieldName: string): { score: number; details: string } {
    if (actual === undefined && expected === undefined) {
      return { score: 1, details: "Both undefined" };
    }
    if (actual === undefined || expected === undefined) {
      return { score: 0, details: `One undefined: actual=${actual}, expected=${expected}` };
    }

    switch (fieldName) {
      case "discount":
        return this.compareDiscount(actual, expected);
      case "paymentMethods":
        return this.comparePaymentMethods(actual, expected);
      case "weekdays":
        return this.compareArrays(actual, expected, "weekdays");
      case "limits":
        return this.compareLimits(actual, expected);
      case "validFrom":
      case "validUntil":
        return this.compareDates(actual, expected);
      default:
        const matches = actual === expected;
        return { 
          score: matches ? 1 : 0, 
          details: matches ? "Exact match" : `Different: '${actual}' vs '${expected}'`
        };
    }
  }

  private compareDiscount(actual: any, expected: any): { score: number; details: string } {
    if (!actual || !expected) {
      return { score: 0, details: "Missing discount object" };
    }
    
    const typeMatch = actual.type === expected.type;
    const valueMatch = Math.abs(actual.value - expected.value) <= 1; // 1% tolerance
    
    if (typeMatch && valueMatch) {
      return { score: 1, details: `Exact match: ${actual.type} ${actual.value}%` };
    } else if (typeMatch) {
      return { score: 0.5, details: `Type match but value diff: ${actual.value} vs ${expected.value}` };
    } else {
      return { score: 0, details: `Type mismatch: ${actual.type} vs ${expected.type}` };
    }
  }

  private comparePaymentMethods(actual: any, expected: any): { score: number; details: string } {
    if (!actual && !expected) {
      return { score: 1, details: "Both null/undefined" };
    }
    if (!actual || !expected) {
      return { score: 0, details: "One is null/undefined" };
    }
    
    const actualFlat = actual.flat();
    const expectedFlat = expected.flat();
    const intersection = actualFlat.filter((x: string) => expectedFlat.includes(x));
    
    if (expectedFlat.length === 0) {
      const score = actualFlat.length === 0 ? 1 : 0;
      return { score, details: score ? "Both empty" : "Expected empty but got values" };
    }
    
    const accuracy = intersection.length / expectedFlat.length;
    const score = accuracy >= 0.5 ? 1 : 0;
    
    return { 
      score, 
      details: `${intersection.length}/${expectedFlat.length} methods match (${(accuracy*100).toFixed(1)}%)`
    };
  }

  private compareArrays(actual: any[], expected: any[], fieldName: string): { score: number; details: string } {
    if (!actual && !expected) {
      return { score: 1, details: "Both null/undefined" };
    }
    if (!actual || !expected) {
      return { score: 0, details: "One is null/undefined" };
    }
    
    const intersection = actual.filter(x => expected.includes(x));
    if (expected.length === 0) {
      const score = actual.length === 0 ? 1 : 0;
      return { score, details: score ? "Both empty" : "Expected empty but got values" };
    }
    
    const accuracy = intersection.length / expected.length;
    const score = accuracy >= 0.8 ? 1 : 0;
    
    return { 
      score, 
      details: `${intersection.length}/${expected.length} ${fieldName} match (${(accuracy*100).toFixed(1)}%)`
    };
  }

  private compareLimits(actual: any, expected: any): { score: number; details: string } {
    if (!actual && !expected) {
      return { score: 1, details: "Both null/undefined" };
    }
    if (!actual || !expected) {
      return { score: 0, details: "One is null/undefined" };
    }
    
    let score = 0;
    let fields = 0;
    const details: string[] = [];
    
    if (actual.maxDiscount !== undefined || expected.maxDiscount !== undefined) {
      fields++;
      const diff = Math.abs((actual.maxDiscount || 0) - (expected.maxDiscount || 0));
      if (diff <= 1000) {
        score++;
        details.push(`maxDiscount match (±$1000)`);
      } else {
        details.push(`maxDiscount diff: $${diff}`);
      }
    }
    
    if (actual.explicitlyHasNoLimit !== undefined || expected.explicitlyHasNoLimit !== undefined) {
      fields++;
      if (actual.explicitlyHasNoLimit === expected.explicitlyHasNoLimit) {
        score++;
        details.push(`explicitlyHasNoLimit match`);
      } else {
        details.push(`explicitlyHasNoLimit diff: ${actual.explicitlyHasNoLimit} vs ${expected.explicitlyHasNoLimit}`);
      }
    }
    
    const finalScore = fields > 0 ? score / fields : 1;
    return { score: finalScore, details: details.join(", ") };
  }

  private compareDates(actual: string, expected: string): { score: number; details: string } {
    if (actual === expected) {
      return { score: 1, details: "Exact date match" };
    }
    
    // Try to parse and compare dates with some tolerance
    try {
      const actualDate = new Date(actual);
      const expectedDate = new Date(expected);
      const diffDays = Math.abs(actualDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (diffDays <= 1) {
        return { score: 1, details: `Date within 1 day: ${actual} vs ${expected}` };
      } else {
        return { score: 0, details: `Date diff ${diffDays.toFixed(1)} days: ${actual} vs ${expected}` };
      }
    } catch {
      return { score: 0, details: `Date parse error: ${actual} vs ${expected}` };
    }
  }

  private calculateFieldAccuracy(extractedDiscounts: Discount[], referenceDiscounts: Discount[]): FieldComparison[] {
    const fieldComparisons: Record<string, { scores: number[]; details: string[] }> = {};
    
    // Initialize field tracking
    IMPORTANT_FIELDS.forEach(field => {
      fieldComparisons[field] = { scores: [], details: [] };
    });

    // Compare each discount (match by index)
    const minLength = Math.min(extractedDiscounts.length, referenceDiscounts.length);
    
    for (let i = 0; i < minLength; i++) {
      const extracted = extractedDiscounts[i];
      const reference = referenceDiscounts[i];
      
      IMPORTANT_FIELDS.forEach(field => {
        const comparison = this.compareField(extracted[field], reference[field], field);
        fieldComparisons[field].scores.push(comparison.score);
        fieldComparisons[field].details.push(`Item ${i}: ${comparison.details}`);
      });
    }

    // Calculate accuracy for each field
    return IMPORTANT_FIELDS.map(field => {
      const { scores, details } = fieldComparisons[field];
      const accuracy = scores.length > 0 
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
        : 0;
      
      return {
        field,
        accuracy,
        totalComparisons: scores.length,
        details: `${(accuracy * 100).toFixed(1)}% accuracy (${scores.filter(s => s > 0).length}/${scores.length} matches)`
      };
    });
  }

  private async loadExtractionResult(filepath: string): Promise<ExtractionResult> {
    const content = await readFile(filepath, "utf-8");
    return JSON.parse(content);
  }

  private async loadReferenceData(source: string): Promise<Discount[]> {
    const filepath = join(this.resultsDir, `reference-${source}.json`);
    try {
      const content = await readFile(filepath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load reference data for ${source}: ${error}`);
    }
  }

  async analyzeResults(): Promise<ComparisonSummary> {
    const files = await readdir(this.resultsDir);
    const extractionFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('reference-'));
    
    // Group files by model
    const modelFiles: Record<string, string[]> = {};
    extractionFiles.forEach(file => {
      const modelName = file.split('-')[0];
      if (!modelFiles[modelName]) {
        modelFiles[modelName] = [];
      }
      modelFiles[modelName].push(file);
    });

    const models: ModelAnalysis[] = [];

    for (const [modelName, files] of Object.entries(modelFiles)) {
      const sources: Record<string, SourceAnalysis> = {};
      let totalTime = 0;
      let totalErrors = 0;

      for (const file of files) {
        const result = await this.loadExtractionResult(join(this.resultsDir, file));
        const referenceData = await this.loadReferenceData(result.source);
        
        const fieldAccuracies = this.calculateFieldAccuracy(result.extractedDiscounts, referenceData);
        const overallAccuracy = fieldAccuracies.reduce((sum, fa) => sum + fa.accuracy, 0) / fieldAccuracies.length;
        
        sources[result.source] = {
          source: result.source,
          referenceCount: referenceData.length,
          extractedCount: result.extractedDiscounts.length,
          fieldAccuracies,
          overallAccuracy,
          executionTimeMs: result.executionTimeMs,
          errors: result.errors,
        };

        totalTime += result.executionTimeMs;
        totalErrors += result.errors.length;
      }

      const sourceAccuracies = Object.values(sources).map(s => s.overallAccuracy);
      const modelOverallAccuracy = sourceAccuracies.reduce((sum, acc) => sum + acc, 0) / sourceAccuracies.length;

      models.push({
        modelName,
        sources,
        overallAccuracy: modelOverallAccuracy,
        avgExecutionTime: totalTime / files.length,
        totalErrors,
      });
    }

    // Find best and worst models
    const sortedModels = [...models].sort((a, b) => b.overallAccuracy - a.overallAccuracy);
    const bestModel = sortedModels[0]?.modelName || "none";
    const worstModel = sortedModels[sortedModels.length - 1]?.modelName || "none";

    // Calculate average accuracy by field across all models
    const avgAccuracyByField: Record<string, number> = {};
    IMPORTANT_FIELDS.forEach(field => {
      const allAccuracies: number[] = [];
      models.forEach(model => {
        Object.values(model.sources).forEach(source => {
          const fieldAccuracy = source.fieldAccuracies.find(fa => fa.field === field);
          if (fieldAccuracy) {
            allAccuracies.push(fieldAccuracy.accuracy);
          }
        });
      });
      avgAccuracyByField[field] = allAccuracies.length > 0 
        ? allAccuracies.reduce((sum, acc) => sum + acc, 0) / allAccuracies.length 
        : 0;
    });

    const summary = this.generateSummary(models, bestModel, worstModel, avgAccuracyByField);

    return {
      models,
      bestModel,
      worstModel,
      avgAccuracyByField,
      summary,
    };
  }

  private generateSummary(models: ModelAnalysis[], bestModel: string, worstModel: string, avgAccuracyByField: Record<string, number>): string {
    const lines: string[] = [];
    
    lines.push("=== LLM EVALUATION ANALYSIS SUMMARY ===\n");
    
    lines.push("Model Performance:");
    lines.push("=================");
    models.forEach(model => {
      lines.push(`${model.modelName.padEnd(20)} ${(model.overallAccuracy * 100).toFixed(1)}% accuracy, ${model.avgExecutionTime.toFixed(0)}ms avg, ${model.totalErrors} errors`);
    });
    
    lines.push(`\nBest Model: ${bestModel}`);
    lines.push(`Worst Model: ${worstModel}`);
    
    lines.push("\nField Performance (Average across all models):");
    lines.push("===============================================");
    Object.entries(avgAccuracyByField).forEach(([field, accuracy]) => {
      lines.push(`${field.padEnd(16)} ${(accuracy * 100).toFixed(1)}%`);
    });

    lines.push("\nDetailed Analysis:");
    lines.push("==================");
    models.forEach(model => {
      lines.push(`\n${model.modelName}:`);
      Object.values(model.sources).forEach(source => {
        lines.push(`  ${source.source}: ${source.extractedCount}/${source.referenceCount} discounts, ${(source.overallAccuracy * 100).toFixed(1)}% accuracy`);
        if (source.errors.length > 0) {
          lines.push(`    Errors: ${source.errors.join("; ")}`);
        }
      });
    });

    return lines.join("\n");
  }

  printAnalysis(analysis: ComparisonSummary): void {
    console.log(analysis.summary);
  }
}

// Main execution
async function main() {
  const resultsDir = process.argv[2];
  
  if (!resultsDir) {
    console.error("Usage: bun analyze-evaluation-results.ts <results-directory>");
    process.exit(1);
  }

  try {
    const analyzer = new ResultAnalyzer(resultsDir);
    const analysis = await analyzer.analyzeResults();
    analyzer.printAnalysis(analysis);
    
    // Save detailed analysis
    const analysisPath = join(resultsDir, "analysis.json");
    await Bun.write(analysisPath, JSON.stringify(analysis, null, 2));
    console.log(`\nDetailed analysis saved to: ${analysisPath}`);
    
  } catch (error) {
    console.error("Analysis failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { ResultAnalyzer, type ComparisonSummary, type ModelAnalysis };