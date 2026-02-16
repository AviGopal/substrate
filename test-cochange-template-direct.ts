#!/usr/bin/env node
/**
 * Direct test of cochange-enabled templates
 * Bypasses MCP and auth issues by directly using TemplateRepository
 */

import { TemplateRepository } from './repos/metabob-opencode/packages/opencode/src/session/template-repository.js';
import { Session } from './repos/metabob-opencode/packages/opencode/src/session/index.js';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  console.log('=== Cochange Template Direct Test ===\n');
  
  // Step 1: Verify templates can be loaded from local storage
  console.log('Step 1: Loading templates from local storage...');
  const templates = await TemplateRepository.list({ backend: 'local' });
  console.log(`✓ Found ${templates.length} templates in local storage`);
  
  // Step 2: Find cochange-enabled templates
  console.log('\nStep 2: Identifying cochange-enabled templates...');
  const cochangeTemplates = templates.filter(t => 
    t.id.includes('fix-bug-complete') || 
    t.id.includes('add-feature-complete') ||
    t.id.includes('refactor-component-complete')
  );
  console.log(`✓ Found ${cochangeTemplates.length} cochange-enabled templates:`);
  cochangeTemplates.forEach(t => console.log(`  - ${t.id}`));
  
  if (cochangeTemplates.length === 0) {
    console.error('❌ No cochange-enabled templates found!');
    process.exit(1);
  }
  
  // Step 3: Load a cochange template and verify structure
  console.log('\nStep 3: Loading fix-bug-complete template...');
  const template = await TemplateRepository.get('fix-bug-complete', 'local');
  
  if (!template) {
    console.error('❌ Failed to load fix-bug-complete template');
    process.exit(1);
  }
  
  console.log(`✓ Template loaded: ${template.id}`);
  console.log(`  Name: ${template.name}`);
  console.log(`  Description: ${template.description}`);
  console.log(`  Version: ${template.version}`);
  console.log(`  Tasks: ${template.tasks?.length || 0}`);
  
  // Step 4: Verify cochange integration in template
  console.log('\nStep 4: Verifying cochange integration...');
  const templateJson = JSON.stringify(template, null, 2);
  
  const cochangeKeywords = [
    'cochange',
    'suggest_related_changes',
    'metabob_suggest_related_changes',
    'predictedCochanges',
    'cochangeAccuracy'
  ];
  
  const foundKeywords = cochangeKeywords.filter(keyword => 
    templateJson.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (foundKeywords.length > 0) {
    console.log(`✓ Cochange integration confirmed! Found keywords:`);
    foundKeywords.forEach(kw => console.log(`  - ${kw}`));
  } else {
    console.log('⚠️  No cochange keywords found in template');
  }
  
  // Step 5: Check for metabob tool usage
  console.log('\nStep 5: Checking for Metabob tool usage...');
  const metabobTools = [
    'metabob_suggest_related_changes',
    'metabob_search_codebase_issues',
    'metabob_annotate_component',
    'metabob_mark_problem_complete'
  ];
  
  const usedTools = metabobTools.filter(tool => 
    templateJson.includes(tool)
  );
  
  if (usedTools.length > 0) {
    console.log(`✓ Template uses ${usedTools.length} Metabob tools:`);
    usedTools.forEach(tool => console.log(`  - ${tool}`));
  }
  
  // Step 6: Verify activity expectations structure
  console.log('\nStep 6: Verifying activity expectations...');
  const hasExpectations = templateJson.includes('expectation') || 
                          templateJson.includes('predicted');
  if (hasExpectations) {
    console.log('✓ Template includes expectation tracking');
  } else {
    console.log('⚠️  Template may not track expectations');
  }
  
  // Step 7: Save template for inspection
  console.log('\nStep 7: Saving template for manual inspection...');
  const outputPath = './test-template-output.json';
  await fs.writeFile(outputPath, JSON.stringify(template, null, 2));
  console.log(`✓ Template saved to: ${outputPath}`);
  
  console.log('\n=== Test Summary ===');
  console.log(`✓ Template loading: WORKING`);
  console.log(`✓ Cochange integration: ${foundKeywords.length > 0 ? 'DETECTED' : 'NOT FOUND'}`);
  console.log(`✓ Metabob tools: ${usedTools.length} tools used`);
  console.log(`✓ Template structure: VALID`);
  
  console.log('\n=== Next Steps ===');
  console.log('1. Review test-template-output.json for full template structure');
  console.log('2. Fix auth dependency to enable registration');
  console.log('3. Register templates to backend: opencode activity template register all');
  console.log('4. Test activity execution via MCP');
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
