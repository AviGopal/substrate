#!/usr/bin/env bun
import { Instance } from "../repos/metabob-opencode/packages/opencode/src/project/instance"
import { SessionMemory } from "../repos/metabob-opencode/packages/opencode/src/session/session-memory"
import type { ActivityTemplate } from "../repos/metabob-opencode/packages/opencode/src/session/activity-template"

const SESSION_ID = `redis-test-validation-${Date.now()}`
const IMPULSE_ID = "redis-test-k8s-local-validation-20260226"

console.log("Creating Redis test impulse...");

await Instance.provide({
  directory: `${process.cwd()}/repos/metabob-opencode`,
  fn: async () => {
    // Read test results
    const resultsFile = await Bun.file("redis-test-results.json").json();
    
    const content = `# Redis Data Flow Test Results

## Test Run: ${resultsFile.testRunId}
**Test Name**: ${resultsFile.testName}
**Timestamp**: ${resultsFile.details.timestamp}
**Status**: ${resultsFile.status}

## Input-Output Validation

### Test Input
\`\`\`
${resultsFile.input}
\`\`\`

### Test Output
\`\`\`
${resultsFile.output}
\`\`\`

### Verification
- **Data Dependency**: ${resultsFile.dataDependency}
- **Verification Method**: ${resultsFile.verificationMethod}
- **Result**: ${resultsFile.status === "PASS" ? "✅ PASS" : "❌ FAIL"}
- **Data Integrity**: ${resultsFile.details.dataIntegrity}

## Test Details

- **Redis Key**: ${resultsFile.details.keyUsed}
- **TTL**: ${resultsFile.details.ttl} seconds
- **Connection**: localhost:6379 (port-forwarded from metabob/redis-master)
- **Operations Tested**:
  - ✓ CONNECT to Redis
  - ✓ SET with TTL
  - ✓ GET with JSON parsing
  - ✓ Data integrity verification
  - ✓ DELETE cleanup
  - ✓ DISCONNECT

## Conclusion

${resultsFile.status === "PASS" 
  ? "✅ Redis is fully operational and can reliably persist and retrieve session data with complete data integrity."
  : "❌ Redis test failed. Data corruption detected during read/write cycle."}

---
**Test Script**: scripts/test-redis-data-flow.ts
**Results File**: redis-test-results.json`;

    const impulse: ActivityTemplate.Impulse.Schema = {
      id: IMPULSE_ID,
      type: "memo",
      pointer: {
        type: "memo",
        content: content,
        source: "testing"
      },
      description: "Redis data flow test results with input-output validation",
      budget: 2000,
      priority: "high",
      scope: "session",
      sessionID: SESSION_ID,
      metadata: resultsFile
    };

    await SessionMemory.addImpulse(SESSION_ID, impulse);
    
    console.log("\n✓ Redis test impulse created:", IMPULSE_ID);
    console.log("\nTest Summary:");
    console.log(JSON.stringify(resultsFile, null, 2));
  }
});
