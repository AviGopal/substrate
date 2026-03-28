import { ImpulseManager } from './repos/opencode/src/impulses/ImpulseManager.js';
import { promises as fs } from 'fs';
import path from 'path';

async function main() {
  const traceData = await fs.readFile('/tmp/async_ripple_trace.json', 'utf-8');
  const trace = JSON.parse(traceData);

  const manager = new ImpulseManager({
    workingDirectory: process.cwd(),
    sessionId: 'trace-session',
  });

  await manager.initialize();

  const impulse = await manager.create({
    id: 'trace-Complete-Async-Ripple-Changes-for-SurrealDB-Official-Library',
    type: 'templateDefinition',
    pointer: {
      type: 'memo',
      content: JSON.stringify(trace, null, 2),
      source: 'specification-trace',
    },
    priority: 'high',
    budget: 5000,
    scope: 'global',
  });

  console.log('✅ Impulse created successfully');
  console.log('ID:', impulse.id);
  console.log('Type:', impulse.type);
  console.log('Budget:', impulse.budget);
  console.log('\nTrace Summary:');
  console.log(`- Specification: ${trace.specificationName}`);
  console.log(`- Root Cause: ${trace.rootCause}`);
  console.log(`- Progress: ${trace.currentState.phase1Complete.percentComplete} complete (${trace.currentState.phase1Complete.awaitedCalls}/${trace.currentState.phase1Complete.totalCalls} calls)`);
  console.log(`- Affected modules: ${trace.currentState.phase2Incomplete.affectedModules.length}`);
  console.log(`- Components to convert: ${trace.components.length}`);
}

main().catch(console.error);
