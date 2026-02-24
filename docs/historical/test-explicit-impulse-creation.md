# Explicit Impulse Management Test

## Problem
The `manage-session-memory` activity's memory agent analyzes intent correctly but doesn't call impulse management tools (impulse_create, impulse_load, etc.) even though:
- ✅ Tools are available to memory agent (verified in agent.ts)
- ✅ Task prompts describe tool usage with examples
- ❌ Agent doesn't actually execute the tool calls

## Root Cause
LLM-based tool calling in tasks 2-5 is unreliable. The agent reads the instructions but doesn't take action.

## Workaround Approach

### Option 1: Imperative Tool Forcing
Add explicit tool requirements to task validation:

\`\`\`json
{
  "task_id": "create-impulses",
  "tools": {
    "required": ["impulse_create"],  // ← Force at least one call
    "validation": {
      "minCalls": 1,
      "errorOnMissing": true
    }
  }
}
\`\`\`

### Option 2: Direct Programmatic Implementation
Replace LLM-based tasks with direct code in SessionMemoryAgent:

\`\`\`typescript
// In memory-agent.ts
export async function createImpulsesFromIntent(intent: Intent, sessionID: string) {
  const impulses = [];
  
  for (const suggested of intent.suggestedImpulses) {
    // Directly call impulse creation (no LLM)
    const impulse = await Impulse.create({
      id: suggested.id,
      sessionID,
      pointer: suggested.pointer,
      budget: suggested.budget,
      priority: suggested.priority,
      metadata: {
        source: "intent-analysis",
        intentType: intent.type,
        reason: suggested.description
      }
    });
    
    impulses.push(impulse);
  }
  
  return impulses;
}
\`\`\`

### Option 3: Simplified Activity Template
Merge all 5 tasks into 1 task with explicit, imperative instructions:

\`\`\`
CRITICAL: You MUST execute these steps in order. DO NOT just describe what to do.

STEP 1: Analyze intent (output JSON as before)

STEP 2: FOR EACH suggested impulse:
  - IMMEDIATELY call impulse_create tool
  - DO NOT skip this step
  - REQUIRED: At least 1 impulse_create call

STEP 3: Call impulse_list to verify creation

STEP 4: FOR EACH high priority impulse:
  - IMMEDIATELY call impulse_load
  - REQUIRED: Load at least 1 impulse

STEP 5: Call memory_budget to show final state
\`\`\`

## Recommended Solution
**Option 2** (Direct Programmatic Implementation) because:
- ✅ Most reliable (no LLM ambiguity)
- ✅ Fastest (no LLM latency for simple operations)
- ✅ Deterministic (same inputs = same outputs)
- ✅ Task 1 (intent analysis) still uses LLM for intelligence
- ✅ Tasks 2-5 are just mechanical execution

## Next Steps
1. Implement Option 2 in memory-agent.ts
2. Update turn-lifecycle-hooks.ts to call new direct methods
3. Test with explicit verification
4. Document pattern for future lifecycle hooks
