#!/usr/bin/env bun
import { Instance } from "../repos/metabob-opencode/packages/opencode/src/project/instance"
import { SessionMemory } from "../repos/metabob-opencode/packages/opencode/src/session/session-memory"
import type { ActivityTemplate } from "../repos/metabob-opencode/packages/opencode/src/session/activity-template"

const SESSION_ID = `acp-test-${Date.now()}`
const TEST_RUN_ID = "k8s-local-validation-20260226"

console.log("Starting DevBob ACP delegation test...\n");

await Instance.provide({
  directory: `${process.cwd()}/repos/metabob-opencode`,
  fn: async () => {
    // Test 1: Create echo test impulse
    const echoImpulseId = `acp-test-input-${TEST_RUN_ID}`;
    const echoInput = "k8s-acp-test";
    
    await SessionMemory.addImpulse(SESSION_ID, {
      id: echoImpulseId,
      type: "memo",
      pointer: {
        type: "memo",
        content: `Test Input Data for ACP Echo Test

Expected behavior: DevBob should echo back the exact text provided.

Test Input: ${echoInput}

This impulse is shared with DevBob to verify impulse resolution works across ACP connections.`,
        source: "testing"
      },
      description: "ACP echo test input data",
      budget: 1000,
      priority: "high",
      scope: "session",
      sessionID: SESSION_ID
    });
    
    console.log(`✓ Created echo test impulse: ${echoImpulseId}\n`);
    
    // Test 2: Create impulse share test data
    const shareImpulseId = `acp-share-test-${TEST_RUN_ID}`;
    const shareInputs = {
      value1: "devbob-container",
      value2: "kubernetes-ready"
    };
    
    await SessionMemory.addImpulse(SESSION_ID, {
      id: shareImpulseId,
      type: "memo",
      pointer: {
        type: "memo",
        content: `Impulse Share Test Data

This impulse contains structured data that DevBob should use to compute a result.

Data:
- value1: ${shareInputs.value1}
- value2: ${shareInputs.value2}

Expected computation: Combine these two values in the response.`,
        source: "testing"
      },
      description: "Impulse sharing test data",
      budget: 1000,
      priority: "high",
      scope: "session",
      sessionID: SESSION_ID,
      metadata: shareInputs
    });
    
    console.log(`✓ Created impulse share test data: ${shareImpulseId}\n`);
    
    console.log("Test impulses created. Ready for ACP delegation.");
    console.log("\nTo run the delegation tests, use the acp_delegate tool with:");
    console.log(`- Session: ${SESSION_ID}`);
    console.log(`- Echo impulse: ${echoImpulseId}`);
    console.log(`- Share impulse: ${shareImpulseId}`);
    
    // Save test context
    const testContext = {
      sessionId: SESSION_ID,
      testRunId: TEST_RUN_ID,
      echoTest: {
        impulseId: echoImpulseId,
        input: echoInput
      },
      impulseShareTest: {
        impulseId: shareImpulseId,
        inputs: shareInputs
      }
    };
    
    await Bun.write("acp-test-context.json", JSON.stringify(testContext, null, 2));
    console.log("\n✓ Test context saved to acp-test-context.json");
    
    return testContext;
  }
});
