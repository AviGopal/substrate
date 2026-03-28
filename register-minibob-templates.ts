#!/usr/bin/env tsx
/**
 * Register MiniBob templates to SurrealDB via activity-api
 * 
 * This script:
 * 1. Reads all template JSON files from demos/ directories
 * 2. Transforms them to SurrealDB schema format
 * 3. Inserts them into activity_template table
 * 4. Creates initial performance metrics records
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Configuration
// =============================================================================

const SURREAL_HTTP_ENDPOINT = 'http://localhost:8000/sql';
const SURREAL_NS = 'production';
const SURREAL_DB = 'metabob_activities';
const SURREAL_USER = 'root';
const SURREAL_PASS = 'metabob123';

const TEMPLATE_DIRS = [
  'demos/meta-composition/templates',
  'demos/minibob-self-development/templates',
];

// =============================================================================
// Types
// =============================================================================

interface TemplateFile {
  id?: string;
  variant_id?: string;
  activity_id?: string;
  name: string;
  description: string;
  category: string;
  tasks: any[];
}

// =============================================================================
// Functions
// =============================================================================

/**
 * Find all JSON files in template directories
 */
function findTemplateFiles(): string[] {
  const files: string[] = [];
  
  for (const dir of TEMPLATE_DIRS) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        if (statSync(fullPath).isFile() && entry.endsWith('.json')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}:`, error);
    }
  }
  
  return files;
}

/**
 * Generate variant_id from template name
 */
function generateId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Load and parse template file
 */
function loadTemplate(filePath: string): TemplateFile | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading template from ${filePath}:`, error);
    return null;
  }
}

/**
 * Execute SurrealDB query via HTTP
 */
async function executeSurrealQuery(query: string): Promise<any> {
  const auth = Buffer.from(`${SURREAL_USER}:${SURREAL_PASS}`).toString('base64');
  
  const response = await fetch(SURREAL_HTTP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      'NS': SURREAL_NS,
      'DB': SURREAL_DB,
    },
    body: query,
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SurrealDB query failed: ${response.status} ${text}`);
  }
  
  const result = await response.json();
  return result;
}

/**
 * Register a single template to SurrealDB
 */
async function registerTemplate(template: TemplateFile): Promise<void> {
  const variantId = template.variant_id || template.id || generateId(template.name);
  const activityId = template.activity_id || variantId;
  
  console.log(`\nRegistering template: ${template.name} (${variantId})`);
  
  // Insert into activity_template table
  const insertTemplateQuery = `
    INSERT INTO activity_template {
      variant_id: "${variantId}",
      activity_id: "${activityId}",
      variant_name: "${template.name}",
      description: "${template.description}",
      category: "${template.category}",
      task_steps: ${JSON.stringify(template.tasks)},
      scope: "global",
      org_id: NULL,
      project_id: NULL,
      created_at: time::now(),
      updated_at: time::now()
    };
  `;
  
  await executeSurrealQuery(insertTemplateQuery);
  console.log(`  ✓ Template inserted`);
  
  // Create initial performance metrics
  const insertMetricsQuery = `
    INSERT INTO variant_performance_metrics {
      variant_id: "${variantId}",
      activity_id: "${activityId}",
      total_executions: 0,
      successful_executions: 0,
      failed_executions: 0,
      success_rate: 0.0,
      avg_duration_ms: 0.0,
      avg_cost_usd: 0.0,
      thompson_alpha: 1.0,
      thompson_beta: 1.0,
      total_selections: 0,
      created_at: time::now(),
      updated_at: time::now()
    };
  `;
  
  await executeSurrealQuery(insertMetricsQuery);
  console.log(`  ✓ Metrics initialized`);
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(80));
  console.log('MiniBob Template Registration to SurrealDB');
  console.log('='.repeat(80));
  
  // Find all template files
  const templateFiles = findTemplateFiles();
  console.log(`\nFound ${templateFiles.length} template files:`);
  templateFiles.forEach(f => console.log(`  - ${f}`));
  
  // Load and register each template
  let successCount = 0;
  let failCount = 0;
  
  for (const filePath of templateFiles) {
    const template = loadTemplate(filePath);
    
    if (!template) {
      console.error(`Failed to load: ${filePath}`);
      failCount++;
      continue;
    }
    
    try {
      await registerTemplate(template);
      successCount++;
    } catch (error) {
      console.error(`Failed to register ${filePath}:`, error);
      failCount++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`Registration complete: ${successCount} succeeded, ${failCount} failed`);
  console.log('='.repeat(80));
}

// =============================================================================
// Execution
// =============================================================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
