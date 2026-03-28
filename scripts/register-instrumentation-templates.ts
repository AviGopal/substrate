#!/usr/bin/env bun
/**
 * Register instrumentation activity templates with the backend
 */

const API_URL = process.env.API_URL || 'http://activity.metabob.local';
const MINIBOB_INSTANCE_ID = process.env.MINIBOB_INSTANCE_ID || 'minibob-local-001';
const MINIBOB_API_KEY = process.env.MINIBOB_API_KEY || 'test-api-key-123';

const TEMPLATES_DIR = './repos/minibob/templates/instrumentation';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  tasks: any[];
  variables?: any[];
  inputSchema?: any;
  outputSchema?: any;
  metadata?: any;
}

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
      console.error(`  ✗ Authentication failed: ${await response.text()}`);
      return false;
    }

    const data = await response.json() as { token: string; org_id: string };
    authToken = data.token;
    console.log(`  ✓ Authenticated (org: ${data.org_id})`);
    return true;
  } catch (error) {
    console.error(`  ✗ Authentication error:`, error);
    return false;
  }
}

async function loadTemplate(filename: string): Promise<Template | null> {
  try {
    const file = Bun.file(`${TEMPLATES_DIR}/${filename}`);
    if (!await file.exists()) {
      console.log(`  ✗ File not found: ${filename}`);
      return null;
    }
    const content = await file.json();
    return content as Template;
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
      task_steps: template.tasks.map(task => ({
        id: task.id,
        description: task.description,
        dependencies: task.dependencies || [],
        subagent: 'general-purpose',
        prompt: task.prompt,
        validation: task.validation,
        retry: task.retry,
      })),
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

async function main() {
  console.log('🔧 Registering Instrumentation Activity Templates');
  console.log('='.repeat(50));
  console.log(`API URL: ${API_URL}\n`);

  // Check health
  try {
    const health = await fetch(`${API_URL}/health`);
    if (!health.ok) {
      console.error('❌ Backend API not healthy');
      process.exit(1);
    }
    console.log('✓ Backend API is healthy\n');
  } catch (error) {
    console.error('❌ Cannot connect to backend API:', error);
    process.exit(1);
  }

  // Authenticate
  console.log('🔐 Authenticating...');
  const authenticated = await authenticate();
  if (!authenticated) {
    process.exit(1);
  }
  console.log('');

  // List template files
  const glob = new Bun.Glob('*.json');
  const templateFiles: string[] = [];
  for await (const file of glob.scan({ cwd: TEMPLATES_DIR })) {
    templateFiles.push(file);
  }

  console.log(`📝 Found ${templateFiles.length} templates:\n`);

  let successCount = 0;
  let failCount = 0;

  for (const filename of templateFiles) {
    const template = await loadTemplate(filename);
    if (template) {
      const success = await registerTemplate(template);
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

  // List registered templates
  console.log('\n📋 Verifying registered templates...');
  const response = await fetch(`${API_URL}/v2/activities/templates?limit=50`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });

  if (response.ok) {
    const data = await response.json() as { templates: any[]; total: number };
    const instrumentationTemplates = data.templates.filter(
      (t: any) => t.variant_id?.startsWith('trace-') ||
                  t.variant_id?.startsWith('create-activity-') ||
                  t.variant_id?.startsWith('instrument-') ||
                  t.variant_id?.startsWith('execute-instrumented-')
    );
    console.log(`  Found ${instrumentationTemplates.length} instrumentation templates in backend:`);
    for (const t of instrumentationTemplates) {
      console.log(`    - ${t.variant_id}: ${t.variant_name || t.name}`);
    }
  }
}

main().catch(console.error);
