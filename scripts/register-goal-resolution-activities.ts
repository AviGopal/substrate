#!/usr/bin/env bun
/**
 * Register goal resolution activities with the backend.
 *
 * These activities implement the "goal → activity selection is itself an activity" pattern.
 * The system uses Thompson Sampling to learn which resolution strategy works best
 * for different goal types.
 */

const API_URL = process.env.API_URL || 'http://activity.metabob.local';
const MINIBOB_INSTANCE_ID = process.env.MINIBOB_INSTANCE_ID || 'minibob-local-001';
const MINIBOB_API_KEY = process.env.MINIBOB_API_KEY || 'test-api-key-123';

const TEMPLATES_DIR = './repos/minibob/templates/goal-resolution';

let authToken: string | null = null;

async function authenticate(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/v2/auth/minibob/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instance_id: MINIBOB_INSTANCE_ID,
        api_key: MINIBOB_API_KEY,
      }),
    });

    if (!response.ok) {
      console.error(`  ✗ Auth failed: ${await response.text()}`);
      return false;
    }

    const data = await response.json() as { token: string; org_id: string };
    authToken = data.token;
    console.log(`  ✓ Authenticated (org: ${data.org_id})`);
    return true;
  } catch (error) {
    console.error(`  ✗ Auth error:`, error);
    return false;
  }
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  input_shapes?: string[];
  output_shapes?: string[];
  execution_type?: string;
  child_activities?: string[];
  tasks?: any[];
  variables?: any[];
  metadata?: any;
}

async function loadTemplate(filename: string): Promise<Template | null> {
  try {
    const file = Bun.file(`${TEMPLATES_DIR}/${filename}`);
    if (!await file.exists()) {
      console.log(`  ✗ File not found: ${filename}`);
      return null;
    }
    return await file.json() as Template;
  } catch (error) {
    console.log(`  ✗ Failed to load ${filename}:`, error);
    return null;
  }
}

async function registerTemplate(template: Template): Promise<boolean> {
  try {
    // Convert to API format
    const payload = {
      variant_id: template.id,
      activity_id: template.id,
      variant_name: template.name,
      description: template.description,
      category: template.category,
      scope: 'global',
      // New paradigm fields
      input_shapes: template.input_shapes || [],
      output_shapes: template.output_shapes || [],
      execution_type: template.execution_type || 'template',
      child_activities: template.child_activities || [],
      // Legacy fields for compatibility
      task_steps: template.tasks?.map(task => ({
        id: task.id,
        description: task.description,
        dependencies: task.dependencies || [],
        subagent: 'general-purpose',
        prompt: task.prompt,
        validation: task.validation,
      })) || [],
      metadata: template.metadata,
    };

    const response = await fetch(`${API_URL}/v2/activities/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`  ✓ Registered: ${template.name}`);
      return true;
    } else if (response.status === 409) {
      console.log(`  ~ Already exists: ${template.name}`);
      return true;
    } else {
      const error = await response.text();
      console.log(`  ✗ Failed: ${template.name} (${response.status}): ${error}`);
      return false;
    }
  } catch (error) {
    console.log(`  ✗ Error registering ${template.name}:`, error);
    return false;
  }
}

async function registerToParadigmTable(template: Template): Promise<boolean> {
  try {
    // Also register in the new 'activity' table for paradigm schema
    const payload = {
      id: template.id,
      name: template.name,
      description: template.description,
      input_shapes: template.input_shapes || [],
      output_shapes: template.output_shapes || [],
      execution_type: template.execution_type || 'template',
      category: template.category,
      tasks: template.tasks,
      child_activities: template.child_activities,
      scope: 'global',
      public: true,
    };

    // Use raw SQL insert for paradigm table
    const response = await fetch(`${API_URL}/v2/activities/paradigm/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok || response.status === 404) {
      // 404 is expected if paradigm endpoint doesn't exist yet
      return true;
    }
    return false;
  } catch {
    // Paradigm registration is optional
    return true;
  }
}

async function main() {
  console.log('🎯 Registering Goal Resolution Activities');
  console.log('='.repeat(50));
  console.log(`API URL: ${API_URL}\n`);

  // Check health
  try {
    const health = await fetch(`${API_URL}/health`);
    if (!health.ok) {
      console.error('❌ Backend not healthy');
      process.exit(1);
    }
    console.log('✓ Backend healthy\n');
  } catch (error) {
    console.error('❌ Cannot connect to backend:', error);
    process.exit(1);
  }

  // Authenticate
  console.log('🔐 Authenticating...');
  if (!await authenticate()) {
    process.exit(1);
  }
  console.log('');

  // List template files
  const templateFiles = [
    'resolve-goal-deterministic.json',
    'resolve-goal-semantic.json',
    'resolve-goal-exploration.json',
    'resolve-goal-orchestrator.json',
  ];

  console.log(`📝 Registering ${templateFiles.length} goal resolution activities:\n`);

  let successCount = 0;
  let failCount = 0;

  for (const filename of templateFiles) {
    const template = await loadTemplate(filename);
    if (template) {
      const success = await registerTemplate(template);
      await registerToParadigmTable(template);
      if (success) successCount++;
      else failCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Registered: ${successCount}`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount}`);
  }

  // Verify
  console.log('\n📋 Verifying registered goal resolution activities...');
  const response = await fetch(`${API_URL}/v2/activities/templates?limit=50`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });

  if (response.ok) {
    const data = await response.json() as { templates: any[] };
    const goalActivities = data.templates.filter(
      (t: any) => t.variant_id?.startsWith('resolve-goal-')
    );
    console.log(`  Found ${goalActivities.length} goal resolution activities:`);
    for (const t of goalActivities) {
      const shapes = t.input_shapes?.length ? `[${t.input_shapes.join(', ')}]` : '[]';
      console.log(`    - ${t.variant_id}: ${shapes} → ${t.output_shapes?.join(', ') || '[]'}`);
    }
  }

  console.log('\n🔄 Goal Resolution Architecture:');
  console.log('');
  console.log('  ┌─────────────────────────────────────────────────────────────┐');
  console.log('  │                   Goal Impulse                               │');
  console.log('  └─────────────────────────┬───────────────────────────────────┘');
  console.log('                            │');
  console.log('                            ▼');
  console.log('  ┌─────────────────────────────────────────────────────────────┐');
  console.log('  │           resolve-goal-orchestrator-v1                      │');
  console.log('  │     (Thompson Sampling on resolution strategies)            │');
  console.log('  └─────────────────────────┬───────────────────────────────────┘');
  console.log('                            │');
  console.log('           ┌────────────────┼────────────────┐');
  console.log('           │                │                │');
  console.log('           ▼                ▼                ▼');
  console.log('  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐');
  console.log('  │deterministic│  │  semantic   │  │ exploration │');
  console.log('  │  (fast)     │  │  (accurate) │  │  (UCB1)     │');
  console.log('  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘');
  console.log('         │                │                │');
  console.log('         └────────────────┼────────────────┘');
  console.log('                          │');
  console.log('                          ▼');
  console.log('  ┌─────────────────────────────────────────────────────────────┐');
  console.log('  │               Recommendation Impulse                        │');
  console.log('  │     (activity_id, confidence, selection_trace)              │');
  console.log('  └─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('  The system learns which strategy works best for each goal type!');
}

main().catch(console.error);
