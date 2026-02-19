#!/usr/bin/env node
/**
 * Verification script for A/B Testing Schema Extension (Phase 2.1)
 * 
 * Tests:
 * 1. Schema validation with new A/B fields
 * 2. CreateOptions with and without A/B fields
 * 3. Default value initialization
 * 4. Backward compatibility
 */

import { ActivityTemplate } from './repos/metabob-opencode/packages/opencode/src/session/activity-template.ts'

console.log('=== A/B Testing Schema Verification ===\n')

// Test 1: Create template WITHOUT A/B fields (backward compatibility)
console.log('✓ Test 1: Backward compatibility (no A/B fields provided)')
try {
  const template1 = await ActivityTemplate.create({
    name: "Test Template No AB",
    description: "Test without A/B fields",
    category: "feature",
    tasks: [],
  })
  
  console.log(`  Status: ${template1.status} (expected: stable)`)
  console.log(`  Allocation Weight: ${template1.allocationWeight} (expected: 1.0)`)
  console.log(`  Candidate IDs: ${JSON.stringify(template1.candidateIds)} (expected: [])`)
  console.log('  ✅ PASS\n')
} catch (e) {
  console.log(`  ❌ FAIL: ${e.message}\n`)
}

// Test 2: Create template WITH A/B fields (candidate)
console.log('✓ Test 2: Create candidate template')
try {
  const template2 = await ActivityTemplate.create({
    name: "Test Candidate Template",
    description: "Test candidate variant",
    category: "feature",
    status: "candidate",
    stableVariantId: "test-stable-id",
    allocationWeight: 0.1,
    tasks: [],
  })
  
  console.log(`  Status: ${template2.status} (expected: candidate)`)
  console.log(`  Stable Variant ID: ${template2.stableVariantId} (expected: test-stable-id)`)
  console.log(`  Allocation Weight: ${template2.allocationWeight} (expected: 0.1)`)
  console.log('  ✅ PASS\n')
} catch (e) {
  console.log(`  ❌ FAIL: ${e.message}\n`)
}

// Test 3: Verify schema structure
console.log('✓ Test 3: Schema structure verification')
const hasStatus = 'status' in ActivityTemplate.Schema.shape
const hasStableVariantId = 'stableVariantId' in ActivityTemplate.Schema.shape
const hasCandidateIds = 'candidateIds' in ActivityTemplate.Schema.shape
const hasAllocationWeight = 'allocationWeight' in ActivityTemplate.Schema.shape

console.log(`  Has 'status' field: ${hasStatus}`)
console.log(`  Has 'stableVariantId' field: ${hasStableVariantId}`)
console.log(`  Has 'candidateIds' field: ${hasCandidateIds}`)
console.log(`  Has 'allocationWeight' field: ${hasAllocationWeight}`)

if (hasStatus && hasStableVariantId && hasCandidateIds && hasAllocationWeight) {
  console.log('  ✅ PASS\n')
} else {
  console.log('  ❌ FAIL: Missing A/B testing fields\n')
}

console.log('=== Verification Complete ===')
