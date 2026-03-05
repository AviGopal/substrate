#!/usr/bin/env bun
import fs from 'fs';

const harnessImpulse = {
  id: 'harness-activity-template-flow-via-mcp-backend',
  type: 'file',
  pointer: {
    type: 'file',
    path: 'tests/validation-harnesses/activity-template-flow-via-mcp-backend-harness.ts',
    source: 'validation-harness'
  },
  budget: 2000,
  priority: 'high',
  metadata: {
    specification: 'Activity Template Flow via MCP Backend',
    harnessType: 'static-analysis',
    testCount: 7,
    requiresLLM: false,
    canRunOffline: true,
    description: 'Validates that activity templates flow exclusively through MCP backend path (MCP → RPC API → SurrealDB) rather than bypassing via direct file system access'
  }
};

fs.writeFileSync(
  `./impulses/${harnessImpulse.id}.json`,
  JSON.stringify(harnessImpulse, null, 2)
);

console.log(`✅ Created harness impulse: ${harnessImpulse.id}`);
console.log(`📁 Location: ./impulses/${harnessImpulse.id}.json`);
console.log(`📝 Harness file: ${harnessImpulse.pointer.path}`);
console.log(`🧪 Test count: ${harnessImpulse.metadata.testCount}`);
console.log(`🤖 Requires LLM: ${harnessImpulse.metadata.requiresLLM}`);
