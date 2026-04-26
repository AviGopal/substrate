#!/usr/bin/env node
/**
 * Test: Thompson Sampling Recommendation System
 *
 * Demonstrates how MiniBob would select templates for a given goal
 */

import { execSync } from 'child_process';

const ACTIVITY_API = 'https://activity.metabob.com';

console.log('='.repeat(80));
console.log('TEST: Thompson Sampling Template Selection');
console.log('='.repeat(80));
console.log();

console.log('This test simulates how MiniBob selects templates using Thompson Sampling');
console.log();

// =============================================================================
// Fetch All Templates and Compute Thompson Scores
// =============================================================================

console.log('1. Fetching all templates from backend...');
const allTemplates = JSON.parse(
  execSync(`curl -s "${ACTIVITY_API}/v2/activities/templates?limit=100"`, {
    encoding: 'utf-8'
  })
);

console.log(`   Found ${allTemplates.total} templates`);
console.log();

// =============================================================================
// Compute Thompson Sampling Scores
// =============================================================================

console.log('2. Computing Thompson Sampling scores...');
console.log();

// Sample from Beta distribution (simplified: just use mean)
const scored = allTemplates.templates.map(t => {
  const alpha = t.thompson_alpha || t.metrics?.thompson_alpha || 1;
  const beta = t.thompson_beta || t.metrics?.thompson_beta || 1;
  const mean = alpha / (alpha + beta);
  const executions = t.total_executions || t.metrics?.total_executions || 0;
  const successRate = t.metrics?.success_rate || t.success_rate || 0;

  return {
    id: t.id,
    name: t.name,
    category: t.category,
    tags: t.tags || [],
    alpha,
    beta,
    thompsonMean: mean,
    executions,
    successRate
  };
});

// Sort by Thompson mean (higher = better)
scored.sort((a, b) => b.thompsonMean - a.thompsonMean);

console.log('Top 10 templates by Thompson Sampling score:');
console.log();

scored.slice(0, 10).forEach((t, i) => {
  console.log(`${i + 1}. ${t.name?.substring(0, 60)}`);
  console.log(`   Thompson: α=${t.alpha}, β=${t.beta}, mean=${(t.thompsonMean * 100).toFixed(1)}%`);
  console.log(`   Executions: ${t.executions}, Success Rate: ${(t.successRate * 100).toFixed(1)}%`);
  console.log(`   Category: ${t.category}, Tags: ${t.tags.slice(0, 3).join(', ')}`);
  console.log();
});

// =============================================================================
// Filter by Category
// =============================================================================

console.log('3. Filtering by category (tool)...');
console.log();

const toolTemplates = scored.filter(t => t.category === 'tool');
console.log(`   Found ${toolTemplates.length} tool templates`);
console.log();
console.log('   Top 5 tool templates:');
toolTemplates.slice(0, 5).forEach((t, i) => {
  console.log(`   ${i + 1}. ${t.name?.substring(0, 50)}`);
  console.log(`      Thompson mean: ${(t.thompsonMean * 100).toFixed(1)}%`);
});

// =============================================================================
// Filter by Tag
// =============================================================================

console.log();
console.log('4. Filtering by tag (workbench.created)...');
console.log();

const workbenchTemplates = scored.filter(t =>
  t.tags.some(tag => tag === 'workbench.created')
);
console.log(`   Found ${workbenchTemplates.length} workbench-created templates`);

if (workbenchTemplates.length > 0) {
  console.log();
  console.log('   Top 5 workbench templates:');
  workbenchTemplates.slice(0, 5).forEach((t, i) => {
    console.log(`   ${i + 1}. ${t.name?.substring(0, 50)}`);
    console.log(`      Thompson mean: ${(t.thompsonMean * 100).toFixed(1)}%`);
  });
}

// =============================================================================
// Simulation: What Would MiniBob Select?
// =============================================================================

console.log();
console.log('5. Simulation: Template selection for different goals');
console.log();

const testGoals = [
  { goal: 'Check code quality', preferredCategory: 'tool' },
  { goal: 'Fix a bug', preferredCategory: 'bugfix' },
  { goal: 'Add new feature', preferredCategory: 'feature' },
  { goal: 'Analyze dependencies', preferredTags: ['dependency', 'analysis'] }
];

testGoals.forEach(({ goal, preferredCategory, preferredTags }) => {
  console.log(`   Goal: "${goal}"`);

  let candidates = scored;

  if (preferredCategory) {
    candidates = candidates.filter(t => t.category === preferredCategory);
    console.log(`   → Filtered by category: ${preferredCategory} (${candidates.length} matches)`);
  }

  if (preferredTags) {
    candidates = candidates.filter(t =>
      preferredTags.some(tag => t.tags.some(ttag => ttag.includes(tag)))
    );
    console.log(`   → Filtered by tags: ${preferredTags.join(', ')} (${candidates.length} matches)`);
  }

  if (candidates.length > 0) {
    const selected = candidates[0];
    console.log(`   → MiniBob would select: "${selected.name?.substring(0, 50)}"`);
    console.log(`      Thompson score: ${(selected.thompsonMean * 100).toFixed(1)}%`);
  } else {
    console.log(`   → No matching templates, MiniBob would improvise`);
  }

  console.log();
});

// =============================================================================
// Exploration vs Exploitation
// =============================================================================

console.log('6. Exploration vs Exploitation Analysis');
console.log();

const newTemplates = scored.filter(t => t.executions === 0);
const experiencedTemplates = scored.filter(t => t.executions > 0);

console.log(`   New templates (never executed): ${newTemplates.length}`);
console.log(`   Experienced templates: ${experiencedTemplates.length}`);
console.log();

if (newTemplates.length > 0) {
  console.log('   Thompson Sampling gives new templates 50% initial score (α=1, β=1)');
  console.log('   This encourages exploration while balancing exploitation');
  console.log();
  console.log('   Sample new templates:');
  newTemplates.slice(0, 3).forEach(t => {
    console.log(`   - ${t.name?.substring(0, 50)}`);
    console.log(`     Thompson: α=${t.alpha}, β=${t.beta}, mean=50%`);
  });
}

console.log();
console.log('   After execution, Thompson parameters update:');
console.log('   - Success: α++ (increases success estimate)');
console.log('   - Failure: β++ (decreases success estimate)');
console.log('   - Uncertainty decreases as more data collected');

// =============================================================================
// Summary
// =============================================================================

console.log();
console.log('='.repeat(80));
console.log('THOMPSON SAMPLING SUMMARY');
console.log('='.repeat(80));
console.log();

console.log('✅ Selection Algorithm:');
console.log('   1. Filter templates by goal requirements (category, tags, shapes)');
console.log('   2. Sample from Beta(α, β) for each template');
console.log('   3. Select template with highest sample value');
console.log('   4. Execute and update parameters');
console.log();

console.log('✅ Exploration Strategy:');
console.log('   - New templates start with uniform prior (50% estimate)');
console.log('   - Randomness in sampling enables exploration');
console.log('   - As data accumulates, uncertainty decreases');
console.log();

console.log('✅ Exploitation Strategy:');
console.log('   - Templates with high α/(α+β) sampled more often');
console.log('   - Proven templates favored but not exclusively');
console.log('   - Balance prevents over-reliance on single template');
console.log();

console.log('✅ Key Metrics:');
console.log(`   - Total templates: ${allTemplates.total}`);
console.log(`   - With execution history: ${experiencedTemplates.length}`);
console.log(`   - Never executed: ${newTemplates.length}`);
console.log(`   - Tool category: ${toolTemplates.length}`);
console.log(`   - Workbench-created: ${workbenchTemplates.length}`);
console.log();

console.log('CONCLUSION:');
console.log('  Thompson Sampling provides a mathematically sound approach to');
console.log('  balancing exploration of new templates with exploitation of');
console.log('  proven templates. MiniBob uses this to continuously improve');
console.log('  its template selection over time.');
console.log();
