#!/usr/bin/env bun
import { Instance } from "../repos/metabob-opencode/packages/opencode/src/project/instance"
import { SessionMemory } from "../repos/metabob-opencode/packages/opencode/src/session/session-memory"
import type { ActivityTemplate } from "../repos/metabob-opencode/packages/opencode/src/session/activity-template"

const SESSION_ID = `surrealdb-test-validation-${Date.now()}`
const IMPULSE_ID = "surrealdb-test-k8s-local-validation-20260226"

console.log("Creating SurrealDB test impulse...");

await Instance.provide({
  directory: `${process.cwd()}/repos/metabob-opencode`,
  fn: async () => {
    const resultsFile = await Bun.file("surrealdb-test-results.json").json();
    
    const content = `# SurrealDB Data Flow Test Results

## Test Run: ${resultsFile.testRunId}
**Test Name**: ${resultsFile.testName}
**Timestamp**: ${resultsFile.details.timestamp}
**Status**: ${resultsFile.status}

## Input-Output Validation

### Test Inputs
\`\`\`json
${JSON.stringify(resultsFile.inputs, null, 2)}
\`\`\`

### Test Outputs
\`\`\`json
${JSON.stringify(resultsFile.outputs, null, 2)}
\`\`\`

### Data Dependency Validation
${resultsFile.dataDependencies.map(dep => 
  `- ${dep.match ? '✅' : '❌'} **${dep.field}**: ${dep.match ? 'MATCH' : 'MISMATCH'}`
).join('\n')}

## Data Transformation Test

### Transformation Logic
\`\`\`
result = "transformation of: " + input
\`\`\`

### Results
- **Input**: ${resultsFile.transformation.input}
- **Expected Output**: ${resultsFile.transformation.expectedOutput}
- **Actual Output**: ${resultsFile.transformation.actualOutput}
- **Match**: ${resultsFile.transformation.match ? '✅ PASS' : '❌ FAIL'}

## Test Details

- **Table**: ${resultsFile.details.table}
- **Record ID**: ${resultsFile.details.recordId}
- **Namespace**: ${resultsFile.details.namespace}
- **Database**: ${resultsFile.details.database}
- **Connection**: localhost:8000 (port-forwarded from metabob/surrealdb)

### Operations Tested
- ✓ CONNECT to SurrealDB
- ✓ SIGNIN with authentication
- ✓ USE namespace and database
- ✓ CREATE record with parameterized query
- ✓ SELECT record with WHERE clause
- ✓ UPDATE record with data transformation
- ✓ Data integrity verification
- ✓ DELETE cleanup
- ✓ DISCONNECT

## Conclusion

${resultsFile.status === "PASS" 
  ? "✅ SurrealDB is fully operational and can reliably persist, query, and transform activity data with complete data integrity."
  : "❌ SurrealDB test failed. Data corruption or transformation failure detected."}

---
**Test Script**: scripts/test-surrealdb-data-flow.ts
**Results File**: surrealdb-test-results.json`;

    const impulse: ActivityTemplate.Impulse.Schema = {
      id: IMPULSE_ID,
      type: "memo",
      pointer: {
        type: "memo",
        content: content,
        source: "testing"
      },
      description: "SurrealDB data flow test results with transformation validation",
      budget: 2500,
      priority: "high",
      scope: "session",
      sessionID: SESSION_ID,
      metadata: resultsFile
    };

    await SessionMemory.addImpulse(SESSION_ID, impulse);
    
    console.log("\n✓ SurrealDB test impulse created:", IMPULSE_ID);
    console.log("\nTest Summary:");
    console.log(JSON.stringify(resultsFile, null, 2));
  }
});
