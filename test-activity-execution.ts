#!/usr/bin/env tsx
/**
 * Test script to execute activity in DevBob pod
 */

import { execSync } from 'child_process';

const POD_NAME = 'devbob-89d4997f6-4t4w6';
const templateId = 'trace-data-flow-single-feature';

console.log('═══════════════════════════════════════════════════════════');
console.log('  DevBob Activity Execution Test');
console.log('═══════════════════════════════════════════════════════════\n');

try {
  // Step 1: Check template exists
  console.log('Step 1: Verifying template exists...');
  const templatePath = `/root/.local/share/opencode/storage/activity-template/${templateId}.json`;
  const checkCmd = `kubectl exec -n metabob ${POD_NAME} -- test -f ${templatePath} && echo "EXISTS" || echo "NOT_FOUND"`;
  const exists = execSync(checkCmd, { encoding: 'utf-8' }).trim();
  
  if (exists !== 'EXISTS') {
    throw new Error(`Template ${templateId} not found at ${templatePath}`);
  }
  console.log(`✅ Template found: ${templateId}\n`);
  
  // Step 2: Read template to understand structure
  console.log('Step 2: Reading template structure...');
  const readCmd = `kubectl exec -n metabob ${POD_NAME} -- cat ${templatePath}`;
  const templateContent = execSync(readCmd, { encoding: 'utf-8' });
  const template = JSON.parse(templateContent);
  
  console.log(`   Name: ${template.name || 'N/A'}`);
  console.log(`   Tasks: ${template.tasks?.length || 0}`);
  console.log(`   Category: ${template.category || 'N/A'}`);
  console.log(`   Variables: ${template.variables?.map((v: any) => v.name).join(', ') || 'none'}\n`);
  
  // Step 3: Explain execution approach
  console.log('Step 3: Activity Execution Approach');
  console.log('────────────────────────────────────────────────────────────');
  console.log('DevBob runs as an ACP server. Activities can be executed via:');
  console.log('');
  console.log('Option A: Connect as ACP client and use activity() tool');
  console.log('  - Requires ACP client SDK');
  console.log('  - Proper approach for programmatic execution');
  console.log('');
  console.log('Option B: Use opencode run with activity prefix command');
  console.log('  - Example: opencode run "%trace-data-flow-single-feature Goal description"');
  console.log('  - Memory agent intercepts and calls activity() tool');
  console.log('');
  console.log('Option C: Direct TypeScript API (in-pod execution)');
  console.log('  - Requires code running inside pod');
  console.log('  - Uses ActivityExecutor directly');
  console.log('');
  console.log('For this validation, let\'s use Option B via kubectl exec:\n');
  
  // Step 4: Execute activity via opencode run
  console.log('Step 4: Executing activity...');
  const activityCmd = `kubectl exec -n metabob ${POD_NAME} -- opencode run "%${templateId} Validate variant_id tracking through hierarchical composition"`;
  
  console.log(`Command: ${activityCmd}\n`);
  console.log('Executing (this may take a few minutes)...\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const result = execSync(activityCmd, { 
    encoding: 'utf-8',
    stdio: 'inherit', // Stream output in real-time
    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
  });
  
} catch (error: any) {
  console.error('\n❌ Error:', error.message);
  if (error.stderr) {
    console.error('STDERR:', error.stderr.toString());
  }
  process.exit(1);
}
