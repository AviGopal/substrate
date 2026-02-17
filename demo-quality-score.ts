#!/usr/bin/env bun
/**
 * Demonstration of the Activity Template Quality Score feature
 * 
 * This script shows how to use the quality scoring system to evaluate templates.
 */

import { TemplateQualityScore } from "./repos/metabob-opencode/packages/opencode/src/session/template-quality-score"

console.log("🎯 Activity Template Quality Score Demo\n")
console.log("=" .repeat(60))

// Example 1: Excellent template
console.log("\n📊 Example 1: Excellent Production Template")
console.log("-".repeat(60))

const excellentTemplate: TemplateQualityScore.MetricsInput = {
  successRate: 0.98,
  avgCost: 0.04,
  avgDuration: 45000, // 45 seconds
  executions: 50,
  hasDescription: true,
  hasGuidance: true,
  hasValidation: true,
}

const excellentResult = TemplateQualityScore.calculateQualityScore(excellentTemplate)

console.log(`Score: ${excellentResult.score}/100`)
console.log(`Grade: ${excellentResult.grade}`)
console.log(`Production Ready: ${excellentResult.productionReady ? "✅ Yes" : "❌ No"}`)
console.log("\nBreakdown:")
console.log(`  Success Rate:      ${excellentResult.breakdown.successScore}/40`)
console.log(`  Cost Efficiency:   ${excellentResult.breakdown.costScore}/20`)
console.log(`  Duration:          ${excellentResult.breakdown.durationScore}/20`)
console.log(`  Documentation:     ${excellentResult.breakdown.documentationScore}/20`)

if (excellentResult.recommendations.length > 0) {
  console.log("\nRecommendations:")
  excellentResult.recommendations.forEach(r => console.log(`  - ${r}`))
} else {
  console.log("\n✨ No improvements needed - excellent template!")
}

// Example 2: Template needing improvement
console.log("\n\n📊 Example 2: Template Needing Improvement")
console.log("-".repeat(60))

const needsWorkTemplate: TemplateQualityScore.MetricsInput = {
  successRate: 0.65,
  avgCost: 0.25,
  avgDuration: 350000, // 5.8 minutes
  executions: 8,
  hasDescription: true,
  hasGuidance: false,
  hasValidation: false,
}

const needsWorkResult = TemplateQualityScore.calculateQualityScore(needsWorkTemplate)

console.log(`Score: ${needsWorkResult.score}/100`)
console.log(`Grade: ${needsWorkResult.grade}`)
console.log(`Production Ready: ${needsWorkResult.productionReady ? "✅ Yes" : "❌ No"}`)
console.log("\nBreakdown:")
console.log(`  Success Rate:      ${needsWorkResult.breakdown.successScore}/40`)
console.log(`  Cost Efficiency:   ${needsWorkResult.breakdown.costScore}/20`)
console.log(`  Duration:          ${needsWorkResult.breakdown.durationScore}/20`)
console.log(`  Documentation:     ${needsWorkResult.breakdown.documentationScore}/20`)

if (needsWorkResult.recommendations.length > 0) {
  console.log("\n⚠️  Recommendations for Improvement:")
  needsWorkResult.recommendations.forEach(r => console.log(`  - ${r}`))
}

// Example 3: New template with no executions
console.log("\n\n📊 Example 3: New Untested Template")
console.log("-".repeat(60))

const newTemplate: TemplateQualityScore.MetricsInput = {
  successRate: 0.0,
  avgCost: 0.0,
  avgDuration: 0,
  executions: 0,
  hasDescription: true,
  hasGuidance: true,
  hasValidation: true,
}

const newResult = TemplateQualityScore.calculateQualityScore(newTemplate)

console.log(`Score: ${newResult.score}/100`)
console.log(`Grade: ${newResult.grade}`)
console.log(`Production Ready: ${newResult.productionReady ? "✅ Yes" : "❌ No"}`)
console.log("\nBreakdown:")
console.log(`  Success Rate:      ${newResult.breakdown.successScore}/40 (no data yet)`)
console.log(`  Cost Efficiency:   ${newResult.breakdown.costScore}/20`)
console.log(`  Duration:          ${newResult.breakdown.durationScore}/20`)
console.log(`  Documentation:     ${newResult.breakdown.documentationScore}/20`)

if (newResult.recommendations.length > 0) {
  console.log("\n💡 Recommendations:")
  newResult.recommendations.forEach(r => console.log(`  - ${r}`))
}

// Example 4: Using expectedCost and expectedDuration
console.log("\n\n📊 Example 4: Template with Expected Baselines")
console.log("-".repeat(60))

const baselineTemplate: TemplateQualityScore.MetricsInput = {
  successRate: 0.92,
  avgCost: 0.08,
  avgDuration: 95000, // 95 seconds
  executions: 20,
  hasDescription: true,
  hasGuidance: true,
  hasValidation: true,
  expectedCost: 0.10,      // Expected $0.10, actual $0.08 (under budget!)
  expectedDuration: 100000, // Expected 100s, actual 95s (faster!)
}

const baselineResult = TemplateQualityScore.calculateQualityScore(baselineTemplate)

console.log(`Score: ${baselineResult.score}/100`)
console.log(`Grade: ${baselineResult.grade}`)
console.log(`Production Ready: ${baselineResult.productionReady ? "✅ Yes" : "❌ No"}`)
console.log("\nBreakdown:")
console.log(`  Success Rate:      ${baselineResult.breakdown.successScore}/40`)
console.log(`  Cost Efficiency:   ${baselineResult.breakdown.costScore}/20 (80% of expected ✅)`)
console.log(`  Duration:          ${baselineResult.breakdown.durationScore}/20 (95% of expected ✅)`)
console.log(`  Documentation:     ${baselineResult.breakdown.documentationScore}/20`)

if (baselineResult.recommendations.length > 0) {
  console.log("\nRecommendations:")
  baselineResult.recommendations.forEach(r => console.log(`  - ${r}`))
} else {
  console.log("\n✨ Excellent performance - under budget and faster than expected!")
}

// Summary
console.log("\n\n📈 Quality Grade Distribution")
console.log("=".repeat(60))
console.log("A (90-100):  Production-ready, excellent quality")
console.log("B (80-89):   Production-ready, good quality")
console.log("C (70-79):   Needs minor improvements")
console.log("D (60-69):   Needs significant improvements")
console.log("F (<60):     Not production-ready")

console.log("\n✅ Demo complete!\n")
