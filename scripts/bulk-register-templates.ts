#!/usr/bin/env bun
/**
 * Bulk Template Registration Script
 * 
 * Registers all local activity templates to the Activity API backend.
 * This populates the SurrealDB database and enables dashboard visualization.
 * 
 * Usage: bun run scripts/bulk-register-templates.ts
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

// API configuration  
// Default to localhost:8080 (requires port-forward to metabob-activity-api)
const API_BASE_URL = Bun.env.API_BASE_URL || 'http://localhost:8080';
const TEMPLATE_DIR = join(homedir(), '.local/share/opencode/storage/activity-template');

interface LocalTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  version?: {
    timestamp: number;
    variant_hash: string;
    generation: number;
  };
  genealogy?: {
    generation: number;
    parent_id?: string;
    variant_hash?: string;
    evolution?: {
      reason: string;
      author: string;
      notes: string;
    };
  };
  tasks: any[];
  executions?: number;
  successRate?: number;
  avgDuration?: number;
  avgCost?: number;
}

interface CreateTemplatePayload {
  variant_id: string;
  activity_id: string;
  variant_name: string;
  description: string;
  category: 'feature' | 'bugfix' | 'refactor' | 'tool' | 'infrastructure';
  task_steps: any[];
  scope: 'global' | 'org' | 'project';
  genealogy?: Record<string, any>;
}

async function loadTemplates(): Promise<LocalTemplate[]> {
  try {
    const files = await readdir(TEMPLATE_DIR);
    const jsonFiles = files.filter((f: string) => f.endsWith('.json'));
    
    console.log(`📂 Found ${jsonFiles.length} template files in ${TEMPLATE_DIR}`);
    
    const templates: LocalTemplate[] = [];
    
    for (const file of jsonFiles) {
      try {
        const content = await readFile(join(TEMPLATE_DIR, file), 'utf-8');
        const template = JSON.parse(content);
        templates.push(template);
      } catch (error: any) {
        console.error(`❌ Failed to load ${file}:`, error.message);
      }
    }
    
    return templates;
  } catch (error: any) {
    console.error(`❌ Failed to read template directory:`, error.message);
    throw error;
  }
}

function normalizeCategory(category: string): 'feature' | 'bugfix' | 'refactor' | 'tool' | 'infrastructure' {
  const lower = category.toLowerCase();
  if (lower.includes('feature')) return 'feature';
  if (lower.includes('bug') || lower.includes('fix')) return 'bugfix';
  if (lower.includes('refactor')) return 'refactor';
  if (lower.includes('tool')) return 'tool';
  return 'infrastructure';
}

function transformTemplate(local: LocalTemplate): CreateTemplatePayload {
  // Generate variant_id from template id and version
  const variantHash = local.version?.variant_hash || local.genealogy?.variant_hash || 'v1';
  const variant_id = `${local.id}::${variantHash}`;
  
  return {
    variant_id,
    activity_id: local.id,
    variant_name: local.name,
    description: local.description,
    category: normalizeCategory(local.category),
    task_steps: local.tasks || [],
    scope: 'global',
    // Skip genealogy for now due to SurrealDB SCHEMAFULL nested field validation
    // TODO: Fix schema to allow flexible genealogy object
    // genealogy: local.genealogy ? {
    //   generation: local.genealogy.generation || 0,
    //   parent_id: local.genealogy.parent_id || null,
    //   variant_hash: local.genealogy.variant_hash || variantHash,
    //   evolution: local.genealogy.evolution || null,
    // } : undefined,
  };
}

async function registerTemplate(payload: CreateTemplatePayload): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/v2/activities/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    
    if (response.status === 201) {
      console.log(`✅ Registered: ${payload.variant_name} (${payload.variant_id})`);
      return true;
    } else if (response.status === 409) {
      console.log(`⏭️  Already exists: ${payload.variant_name} (${payload.variant_id})`);
      return false;
    } else {
      console.error(`❌ Failed to register ${payload.variant_name}:`, result);
      return false;
    }
  } catch (error: any) {
    console.error(`❌ Network error for ${payload.variant_name}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting bulk template registration...\n');
  
  // Check API connectivity
  try {
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    const health = await healthResponse.json();
    
    // Check for proper Activity API health response
    if (!health.checks || !health.checks.redis || !health.checks.surrealdb) {
      console.error('❌ Wrong API endpoint - got response:', health);
      console.error('💡 Expected Activity API health response with Redis and SurrealDB checks');
      process.exit(1);
    }
    
    if (health.status !== 'healthy') {
      console.error('❌ API is unhealthy:', health);
      process.exit(1);
    }
    
    console.log(`✅ API is healthy (Redis: ${health.checks.redis.status}, SurrealDB: ${health.checks.surrealdb.status})\n`);
  } catch (error: any) {
    console.error(`❌ Cannot connect to API at ${API_BASE_URL}:`, error.message);
    console.error('💡 Hint: Start port-forward with: kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080');
    process.exit(1);
  }
  
  // Load templates
  const templates = await loadTemplates();
  
  if (templates.length === 0) {
    console.log('⚠️  No templates found to register');
    return;
  }
  
  console.log(`📋 Loaded ${templates.length} templates\n`);
  
  // Transform and register
  let registered = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const template of templates) {
    const payload = transformTemplate(template);
    const success = await registerTemplate(payload);
    
    if (success) {
      registered++;
    } else {
      // Could be duplicate or failure
      if (payload.variant_id) {
        skipped++;
      } else {
        failed++;
      }
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`   ✅ Registered: ${registered}`);
  console.log(`   ⏭️  Skipped (duplicates): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📦 Total: ${templates.length}`);
  
  console.log('\n🎉 Bulk registration complete!');
  console.log('🔗 View dashboard at: http://dashboard.minibob.local');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
