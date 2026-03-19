#!/usr/bin/env tsx
/**
 * Test Goal Inference Engine Only
 * 
 * Tests just the goal inference component without triggering full template creation.
 * This is a safe test that validates the core autonomous recovery logic.
 */

import { GoalInferenceEngine } from './repos/metabob-opencode/packages/opencode/src/session/goal-inference-engine';

async function testGoalInference() {
  console.log('='.repeat(80));
  console.log('Goal Inference Engine Test');
  console.log('='.repeat(80));
  console.log('');
  
  const testCases = [
    {
      name: 'Test 1: Full context (templateId + reason + variables)',
      context: {
        attemptedTemplateId: 'fix-authentication-sql-injection',
        reason: 'Fix SQL injection vulnerability in authentication module using parameterized queries',
        variables: {
          file: 'src/auth/login.ts',
          vulnerability: 'SQL injection in user login'
        }
      }
    },
    {
      name: 'Test 2: Minimal context (rule-based fallback)',
      context: {
        attemptedTemplateId: 'refactor-database-connection-pool',
        variables: {}
      }
    },
    {
      name: 'Test 3: Feature template ID',
      context: {
        attemptedTemplateId: 'add-user-registration-feature',
        reason: 'Implement user registration with email verification and password strength validation'
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n${testCase.name}`);
    console.log('-'.repeat(80));
    console.log('Input:', JSON.stringify(testCase.context, null, 2));
    
    try {
      const result = await GoalInferenceEngine.infer(testCase.context);
      
      console.log('\n✅ SUCCESS');
      console.log('  Description:', result.description);
      console.log('  Template Name:', result.templateName);
      console.log('  Category:', result.category);
      
      // Validate result structure
      if (!result.description || !result.templateName || !result.category) {
        console.log('\n⚠️  WARNING: Missing required fields in result');
      }
      
      // Validate category
      const validCategories = ['feature', 'bugfix', 'refactor', 'tool', 'infrastructure'];
      if (!validCategories.includes(result.category)) {
        console.log('\n⚠️  WARNING: Invalid category:', result.category);
      }
      
    } catch (error: any) {
      console.log('\n❌ FAILED');
      console.log('  Error:', error.message);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('Test Complete');
  console.log('='.repeat(80));
}

testGoalInference().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
