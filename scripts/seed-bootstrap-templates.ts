#!/usr/bin/env bun
/**
 * Seed Bootstrap Templates
 *
 * Seeds the self-hosting bootstrap templates to the activity-api.
 * These templates enable the vessel to:
 * 1. Create new activities from goals (genesis)
 * 2. Create improved variants from failures (trailblazer)
 * 3. Extend its own capabilities (vessel-extend)
 * 4. Extract templates from traces (ribosome - existing)
 *
 * Together, these form the "compiler written in its own language" -
 * the minimal set needed for true self-hosting.
 */

import { readdir } from "fs/promises";
import path from "path";

const API_URL = process.env.API_URL || process.env.ACTIVITY_API_URL || 'http://localhost:8080';
const ORG_ID = process.env.ORG_ID || 'metabob_internal';

// Template directories to seed
const TEMPLATE_DIRS = [
  // Bootstrap templates (genesis, trailblazer, vessel-extend)
  '../repos/minibob/templates/bootstrap',
  // Development templates (ribosome, variant creation, debugging)
  '../repos/minibob/templates/development',
  // Meta-learning templates (failure analysis, pattern discovery)
  '../repos/minibob/templates/meta-learning',
];

interface TemplateTask {
  id: string;
  subagent?: string;
  description: string;
  dependencies?: string[];
  prompt: {
    template: string;
    maxTokens?: number;
    variables?: Array<{ name: string; type: string; required: boolean; description?: string }>;
  };
  validation?: {
    requiredFiles?: string[];
    requiredPatterns?: string[] | Array<{ file: string; pattern: string }>;
    forbiddenPatterns?: Array<{ file: string; pattern: string }>;
    commands?: Array<{ command: string; expectedOutput?: string }>;
  };
  retry?: {
    maxAttempts: number;
    strategy: string;
  };
}

interface TemplateImpulse {
  id: string;
  pointer: {
    type: string;
    [key: string]: unknown;
  };
  budget: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  description?: string;
}

interface LocalTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  variables?: Array<{
    name: string;
    type: string;
    description?: string;
    required: boolean;
    default?: unknown;
  }>;
  impulses?: TemplateImpulse[];
  input_schema?: {
    required?: Array<{ shape: string; description?: string; collection?: boolean }>;
    optional?: Array<{ shape: string; description?: string; collection?: boolean }>;
  };
  output_schema?: {
    produces?: Array<{ shape: string; description?: string }>;
  };
  tasks: TemplateTask[];
  metrics?: {
    alpha?: number;
    beta?: number;
    total_executions?: number;
    successes?: number;
    failures?: number;
  };
  metadata?: Record<string, unknown>;
}

interface ApiTemplate {
  variant_id: string;
  activity_id: string;
  variant_name: string;
  description: string;
  category: string;
  task_steps: TemplateTask[];
  scope: 'global' | 'org' | 'project';
  org_id?: string;
  impulses?: TemplateImpulse[];
  input_schema?: LocalTemplate['input_schema'];
  output_schema?: LocalTemplate['output_schema'];
}

// Valid categories in the API
const VALID_CATEGORIES = ['feature', 'bugfix', 'refactor', 'tool', 'infrastructure'];

// Map non-standard categories to valid ones
const CATEGORY_MAP: Record<string, string> = {
  'development': 'tool',  // Development templates are tools
};

/**
 * Transform local template format to API format
 */
function transformTemplate(local: LocalTemplate): ApiTemplate {
  // Map category to valid enum value
  let category = local.category;
  if (!VALID_CATEGORIES.includes(category)) {
    category = CATEGORY_MAP[category] || 'tool';
  }

  return {
    variant_id: local.id,
    activity_id: local.id.replace(/-v\d+$/, ''), // Strip version suffix for activity_id
    variant_name: local.name,
    description: local.description,
    category,
    task_steps: local.tasks.map(task => ({
      ...task,
      subagent: task.subagent || 'default',
      dependencies: task.dependencies || [],
    })),
    scope: 'global',
    org_id: ORG_ID,
    impulses: local.impulses,
    input_schema: local.input_schema,
    output_schema: local.output_schema,
  };
}

/**
 * Load template from JSON file
 */
async function loadTemplate(filePath: string): Promise<LocalTemplate | null> {
  try {
    const content = await Bun.file(filePath).text();
    return JSON.parse(content) as LocalTemplate;
  } catch (error) {
    console.error(`Failed to load ${filePath}:`, error);
    return null;
  }
}

/**
 * Seed a single template to the API
 */
async function seedTemplate(template: ApiTemplate): Promise<{ success: boolean; status: string }> {
  try {
    const response = await fetch(`${API_URL}/v2/activities/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(template),
    });

    const result = await response.json();

    if (response.ok) {
      return { success: true, status: 'created' };
    } else if (response.status === 409) {
      return { success: true, status: 'exists' };
    } else {
      console.error(`  Error:`, result);
      return { success: false, status: `error: ${result.error || response.status}` };
    }
  } catch (error) {
    console.error(`  Error:`, error);
    return { success: false, status: `error: ${error}` };
  }
}

/**
 * Load all templates from a directory
 */
async function loadTemplatesFromDir(dirPath: string): Promise<LocalTemplate[]> {
  const templates: LocalTemplate[] = [];
  const absolutePath = path.resolve(__dirname, dirPath);

  try {
    const files = await readdir(absolutePath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const template = await loadTemplate(path.join(absolutePath, file));
      if (template) {
        templates.push(template);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dirPath}:`, error);
  }

  return templates;
}

/**
 * Main entry point
 */
async function main() {
  console.log('Bootstrap Template Seeder');
  console.log('========================');
  console.log(`API: ${API_URL}`);
  console.log(`Org: ${ORG_ID}`);
  console.log('');

  // Check API health first
  try {
    const health = await fetch(`${API_URL}/health`);
    if (!health.ok) {
      console.error('API health check failed');
      process.exit(1);
    }
    console.log('API health: OK\n');
  } catch (error) {
    console.error(`Cannot connect to API at ${API_URL}`);
    console.error('Make sure the activity-api is running.');
    process.exit(1);
  }

  // Load templates from all directories
  const allTemplates: LocalTemplate[] = [];

  for (const dir of TEMPLATE_DIRS) {
    const templates = await loadTemplatesFromDir(dir);
    console.log(`Loaded ${templates.length} templates from ${dir}`);
    allTemplates.push(...templates);
  }

  console.log(`\nTotal: ${allTemplates.length} templates to seed\n`);

  // Seed templates
  let created = 0;
  let exists = 0;
  let failed = 0;

  for (const local of allTemplates) {
    const api = transformTemplate(local);
    process.stdout.write(`  ${local.id}... `);

    const result = await seedTemplate(api);

    if (result.status === 'created') {
      console.log('created');
      created++;
    } else if (result.status === 'exists') {
      console.log('exists');
      exists++;
    } else {
      console.log(result.status);
      failed++;
    }
  }

  // Summary
  console.log('\n========================');
  console.log('Summary:');
  console.log(`  Created: ${created}`);
  console.log(`  Already exists: ${exists}`);
  console.log(`  Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }

  // Print the available templates
  console.log('\nBootstrap Templates Available:');
  console.log('  - bootstrap:genesis-from-goal    (create activity from goal)');
  console.log('  - bootstrap:trailblazer-from-failures (improve from failures)');
  console.log('  - bootstrap:vessel-extend        (add new capability)');
  console.log('  - extract-template-from-trace    (ribosome pattern)');
  console.log('  - create-activity-variant        (create variant)');
  console.log('  - debug-failing-activity         (diagnose failures)');
  console.log('\nMeta-Learning Templates Available:');
  console.log('  - analyze-failure-v1             (understand execution failures)');
  console.log('  - discover-missing-impulses-v1   (find helpful impulses)');
  console.log('  - specialize-activity-v1         (create optimized variants)');
  console.log('  - generalize-pattern-v1          (extract reusable patterns)');
  console.log('  - discover-composition-patterns-v1 (learn activity sequences)');
  console.log('\nThe vessel is now self-hosting and self-improving.');
}

main().catch(console.error);
