/**
 * Discount Key Generation System
 * 
 * A comprehensive system for generating unique, deterministic keys for discount data.
 * Enables reliable tracking of discounts across time, deduplication, and comparison.
 */

// Core key generation functions
export {
  generateDiscountKey,
  generateUniqueDiscountKeys,
  validateDiscountKey,
  parseDiscountKey
} from './discount-keys';

// Analysis and comparison tools
export {
  analyzeDiscountKeys,
  compareDiscountKeys,
  generateAnalysisReport,
  generateComparisonReport,
  type DiscountKeyAnalysis,
  type DiscountComparisonResult
} from './discount-analysis';

// Integration utilities and examples
export {
  addKeysToDiscounts,
  EnhancedDiscountScraper,
  DiscountChangeDetector,
  DiscountDataManager,
  RealTimeDiscountProcessor,
  BatchDiscountProcessor,
  addKeysToExistingData
} from './example-integration';