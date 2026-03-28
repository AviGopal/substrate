#!/usr/bin/env ts-node

/**
 * Create trace impulse for rpc-api-endpoint-database-integration specification
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const traceContent = readFileSync('./TRACE_rpc-api-endpoint-database-integration.md', 'utf-8');

const impulseData = {
  id: 'trace-rpc-api-endpoint-database-integration',
  type: 'memo',
  pointer: {
    type: 'memo',
    content: traceContent,
    source: 'trace-data-flow-analysis',
  },
  priority: 'high',
  budget: 5000,
  metadata: {
    specification: 'rpc-api-endpoint-database-integration',
    category: 'data-flow-trace',
    purpose: 'Complete implementation trace for validation and enforcement',
    components: [
      'repos/metabob-rpc-api/server/db/surrealdb_client.py',
      'repos/metabob-rpc-api/server/routes/activity.py',
      'repos/metabob-rpc-api/server/routes/learning_loop.py',
      'repos/metabob-rpc-api/server/actions/activity.py',
      'repos/metabob-rpc-api/server/db/operations/template_metrics.py',
      'repos/metabob-rpc-api/server/db/operations/template_data.py',
    ],
    criticalIssue: 'RecordID serialization bug in sanitize_record()',
    nextPhase: 'enforcement and validation',
    rootCause: 'sanitize_record() function exists but does not convert RecordID objects to strings',
    affectedEndpoints: [
      'GET /v2/activities/templates/{id}',
      'GET /v2/activities/templates',
      'GET /api/v1/learning-loop/templates/{id}/metrics',
    ],
    workingEndpoints: [
      'POST /v2/activities/templates',
    ],
  },
  createdAt: new Date().toISOString(),
};

// Write to impulses directory
const impulseDir = './impulses';
const impulseFile = join(impulseDir, 'trace-rpc-api-endpoint-database-integration.json');

writeFileSync(impulseFile, JSON.stringify(impulseData, null, 2));

console.log('✅ Trace impulse created successfully');
console.log('📄 File:', impulseFile);
console.log('🔍 Specification:', impulseData.metadata.specification);
console.log('🎯 Critical Issue:', impulseData.metadata.criticalIssue);
console.log('📦 Size:', traceContent.length, 'bytes');
console.log('💰 Budget:', impulseData.budget, 'tokens');
console.log('\nNext steps:');
console.log('1. Use this impulse in enforcement phase to fix sanitize_record()');
console.log('2. Create validation harness for all endpoints');
console.log('3. Run comprehensive endpoint tests');
