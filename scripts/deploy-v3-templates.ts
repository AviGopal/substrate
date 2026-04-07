#!/usr/bin/env bun
/**
 * Deploy V3 Activity Templates to Production
 *
 * Registers the fixed v3 visualization templates to the Activity API.
 * These templates fix validation failures where LLMs weren't explicitly
 * instructed to use the write tool.
 *
 * Usage:
 *   bun run scripts/deploy-v3-templates.ts
 *
 * Environment:
 *   API_ENDPOINT - Activity API endpoint (default: https://activity.metabob.com)
 *   API_KEY - API key for authentication (optional, uses unauthenticated for public templates)
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const API_ENDPOINT = Bun.env.API_ENDPOINT || 'https://activity.metabob.com';
const API_KEY = Bun.env.API_KEY;

// V3 templates to deploy
const V3_TEMPLATES = [
  'repos/metabob-proto/activities/dashboard/visualize-shapes-v3.json',
  'repos/metabob-proto/activities/dashboard/visualize-learning-loop-v3.json',
  'repos/metabob-proto/activities/dashboard/visualize-database-state-v3.json',
];

interface TemplateFile {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  tasks: any[];
  variables?: any[];
  inputSchema?: any;
  outputSchema?: any;
  version?: number;
  parentVersion?: string;
  [key: string]: any;
}

interface RegisterPayload {
  variant_id: string;
  activity_id: string;
  variant_name: string;
  description: string;
  category: string;
  task_steps: any[];
  scope: 'global' | 'org' | 'project';
  tags?: string[];
  input_shapes?: string[];
  output_shapes?: string[];
  variables?: any[];
}

function transformTemplate(template: TemplateFile): RegisterPayload {
  // Extract shapes from schema
  const inputShapes = template.inputSchema?.required?.map((r: any) => r.shape) ||
                      template.inputSchema?.optional?.map((o: any) => o.shape) || [];
  const outputShapes = template.outputSchema?.produces?.map((p: any) => p.shape) || [];

  // Determine category from tags or default to 'tool'
  let category = 'tool';
  if (template.tags?.includes('visualization') || template.tags?.includes('dashboard')) {
    category = 'tool';
  }

  // Send raw ID - the API wraps it with activity:⟨...⟩ format
  // Template ID should be like "visualize:shapes:v3" not "activity:⟨visualize:shapes:v3⟩"
  const rawId = template.id;

  return {
    variant_id: rawId,
    activity_id: rawId,
    variant_name: template.name,
    description: template.description || `Activity template: ${template.name}`,
    category,
    task_steps: template.tasks,
    scope: 'global',
    tags: template.tags,
    input_shapes: inputShapes.filter((s: string) => s),
    output_shapes: outputShapes.filter((s: string) => s),
    variables: template.variables,
  };
}

async function registerTemplate(payload: RegisterPayload): Promise<{ success: boolean; message: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (API_KEY) {
    headers['Authorization'] = `ApiKey ${API_KEY}`;
  }

  try {
    const response = await fetch(`${API_ENDPOINT}/v2/activities/templates`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.status === 201) {
      return { success: true, message: 'Created' };
    } else if (response.status === 200) {
      return { success: true, message: 'Updated' };
    } else if (response.status === 409) {
      // Conflict - template exists, try to update instead
      const updateResponse = await fetch(`${API_ENDPOINT}/v2/activities/templates/${encodeURIComponent(payload.variant_id)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });

      if (updateResponse.ok) {
        return { success: true, message: 'Updated (via PUT)' };
      }
      return { success: false, message: `Conflict: ${JSON.stringify(result)}` };
    } else {
      return { success: false, message: `HTTP ${response.status}: ${JSON.stringify(result)}` };
    }
  } catch (error: any) {
    return { success: false, message: `Network error: ${error.message}` };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Deploy V3 Activity Templates to Production');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Endpoint: ${API_ENDPOINT}`);
  console.log(`Auth: ${API_KEY ? 'API Key' : 'Unauthenticated (public templates)'}`);
  console.log('');

  // Check API health
  console.log('Checking API health...');
  try {
    const healthResponse = await fetch(`${API_ENDPOINT}/health`);
    const health = await healthResponse.json();
    console.log(`  Status: ${health.status}`);
    console.log(`  SurrealDB: ${health.checks?.surrealdb?.status || 'unknown'}`);
    console.log('');
  } catch (error: any) {
    console.error(`❌ Cannot connect to API: ${error.message}`);
    process.exit(1);
  }

  // Load and deploy templates
  console.log('Deploying templates...');
  console.log('');

  let successCount = 0;
  let failCount = 0;

  for (const templatePath of V3_TEMPLATES) {
    const fullPath = join(process.cwd(), templatePath);
    const fileName = templatePath.split('/').pop();

    try {
      console.log(`📦 ${fileName}`);

      // Load template file
      const content = await readFile(fullPath, 'utf-8');
      const template = JSON.parse(content) as TemplateFile;

      // Transform to API payload
      const payload = transformTemplate(template);

      console.log(`   ID: ${payload.variant_id}`);
      console.log(`   Name: ${payload.variant_name}`);

      // Register
      const result = await registerTemplate(payload);

      if (result.success) {
        console.log(`   ✅ ${result.message}`);
        successCount++;
      } else {
        console.log(`   ❌ ${result.message}`);
        failCount++;
      }
    } catch (error: any) {
      console.log(`   ❌ Failed to load: ${error.message}`);
      failCount++;
    }

    console.log('');
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Deployment Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Total:   ${V3_TEMPLATES.length}`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Failed:  ${failCount}`);
  console.log('═══════════════════════════════════════════════════════════');

  if (failCount > 0) {
    process.exit(1);
  }

  console.log('\n✅ V3 templates deployed successfully!');
  console.log('\nNext: Thompson Sampling will select v3 over v2 based on performance.');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
