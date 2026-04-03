#!/usr/bin/env bun
/**
 * Seed Meta-Learning Templates
 *
 * Seeds the meta-learning templates that enable the system to:
 * 1. Analyze failed executions (analyze-failure)
 * 2. Discover missing impulses (discover-missing-impulses)
 * 3. Create specialized variants (specialize-activity)
 * 4. Extract generalized patterns (generalize-pattern)
 * 5. Learn composition patterns (discover-composition-patterns)
 *
 * These templates implement the self-improvement loop:
 * Execution → Analysis → Learning → Template Evolution
 */

import { readdir } from "fs/promises";
import path from "path";

const API_URL = process.env.API_URL || process.env.ACTIVITY_API_URL || 'http://localhost:8080';
// Use record format for org_id consistency with JWT $auth.org_id
const ORG_ID = process.env.ORG_ID || 'organizations:metabob_internal';

// Template directory
const TEMPLATE_DIR = '../repos/minibob/templates/meta-learning';

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
  scope?: string;
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
  task_steps?: TemplateTask[];
  tasks?: TemplateTask[];
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
  'meta-learning': 'tool',  // Meta-learning templates are tools
  'development': 'tool',
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

  // Use task_steps if present, otherwise use tasks
  const tasks = local.task_steps || local.tasks || [];

  return {
    variant_id: local.id,
    activity_id: local.id.replace(/-v\d+$/, ''), // Strip version suffix for activity_id
    variant_name: local.name,
    description: local.description,
    category,
    task_steps: tasks.map(task => ({
      ...task,
      subagent: task.subagent || 'default',
      dependencies: task.dependencies || [],
    })),
    scope: (local.scope as 'global' | 'org' | 'project') || 'global',
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
 * Load all templates from the meta-learning directory
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
  console.log('Meta-Learning Template Seeder');
  console.log('=============================');
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

  // Load templates
  const templates = await loadTemplatesFromDir(TEMPLATE_DIR);
  console.log(`Loaded ${templates.length} templates from ${TEMPLATE_DIR}\n`);

  // Seed templates
  let created = 0;
  let exists = 0;
  let failed = 0;

  for (const local of templates) {
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
  console.log('\n=============================');
  console.log('Summary:');
  console.log(`  Created: ${created}`);
  console.log(`  Already exists: ${exists}`);
  console.log(`  Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }

  // Print the meta-learning capabilities
  console.log('\nMeta-Learning Templates Available:');
  console.log('  - analyze-failure-v1           (understand why executions fail)');
  console.log('  - discover-missing-impulses-v1 (find impulses that would help)');
  console.log('  - specialize-activity-v1       (create optimized variants)');
  console.log('  - generalize-pattern-v1        (extract reusable patterns)');
  console.log('  - discover-composition-patterns-v1 (learn activity sequences)');
  console.log('\nThe Learning Loop:');
  console.log('');
  console.log('  Execute → Fail → Analyze → Discover Missing → Specialize');
  console.log('                      ↓');
  console.log('  Execute → Succeed → Extract Pattern → Generalize → Compose');
  console.log('                      ↓');
  console.log('  Learn which compositions achieve which goals → Thompson Sampling');
  console.log('');
  console.log('The system can now learn from its own execution history.');
}

main().catch(console.error);
