#!/usr/bin/env bun
/**
 * Apply Activity System Schema to SurrealDB
 * 
 * Reads the schema from repos/metabob-activity-api/sql/001-init-schema.surql
 * and applies it to the SurrealDB instance via HTTP API.
 * 
 * Usage: bun run scripts/apply-activity-schema.ts
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SURREAL_URL = Bun.env.SURREAL_URL || 'http://localhost:8000';
const SURREAL_NS = 'activity-system';
const SURREAL_DB = 'learning_loop';
const SURREAL_USER = Bun.env.SURREAL_USER || 'root';
const SURREAL_PASS = Bun.env.SURREAL_PASS || 'surrealdb-local-123';

const SCHEMA_FILE = join(import.meta.dir, '../repos/metabob-activity-api/sql/001-init-schema.surql');

async function applySchema() {
  console.log('🔧 Applying Activity System Schema to SurrealDB...\n');
  
  // Read schema file
  const schema = await readFile(SCHEMA_FILE, 'utf-8');
  console.log(`📄 Loaded schema from ${SCHEMA_FILE}`);
  console.log(`📏 Schema size: ${schema.length} bytes\n`);
  
  // Create basic auth header
  const auth = btoa(`${SURREAL_USER}:${SURREAL_PASS}`);
  
  // Apply schema via HTTP API
  console.log(`🔗 Connecting to ${SURREAL_URL}...`);
  console.log(`   Namespace: ${SURREAL_NS}`);
  console.log(`   Database: ${SURREAL_DB}\n`);
  
  const response = await fetch(`${SURREAL_URL}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Accept': 'application/json',
      'Authorization': `Basic ${auth}`,
      'surreal-ns': SURREAL_NS,
      'surreal-db': SURREAL_DB,
    },
    body: schema,
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ Schema application failed: ${response.status} ${response.statusText}`);
    console.error(error);
    process.exit(1);
  }
  
  const result = await response.json();
  console.log('✅ Schema applied successfully!\n');
  console.log('📊 Results:');
  console.log(JSON.stringify(result, null, 2));
  
  // Verify tables were created
  console.log('\n🔍 Verifying tables...');
  const infoResponse = await fetch(`${SURREAL_URL}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Accept': 'application/json',
      'Authorization': `Basic ${auth}`,
      'surreal-ns': SURREAL_NS,
      'surreal-db': SURREAL_DB,
    },
    body: 'INFO FOR DB;',
  });
  
  if (infoResponse.ok) {
    const info = await infoResponse.json();
    console.log('✅ Database info:');
    console.log(JSON.stringify(info, null, 2));
  }
  
  console.log('\n✨ Schema application complete!');
  console.log('🎯 Next step: Run bulk-register-templates.ts to populate data');
}

applySchema().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
