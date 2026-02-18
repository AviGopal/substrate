# Context Requirements Flow - Confirmed ✅

**Date**: February 16, 2026  
**Status**: **ARCHITECTURE VALIDATED - Flow Exists and is Functional**

## Executive Summary

**Context requirements DO flow through the entire system** from template → memory agent → impulse creation → agent context. The architecture is correctly implemented across multiple files and the flow has been traced end-to-end.

## Complete Data Flow (Validated)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Backend Template Storage (metabob-rpc-api)                          │
│    - Templates stored with context_requirements field                   │
│    - 5 core templates have 2-3 requirements each                        │
│    - Data structure: { key, hint, impulse_types, required, budget }    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. CLI Layer (metabob-cli)                                             │
│    File: src/metabob_cli/mcp/activity_manager.py                       │
│    - Lines 235, 545-549: Convert snake_case ↔ camelCase                │
│    - Fetches template with context_requirements                         │
│    - Passes to OpenCode MCP tools                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. Activity Tool (OpenCode)                                             │
│    File: repos/metabob-opencode/packages/opencode/src/tool/activity.ts │
│    - Receives activity execution request                                │
│    - Loads template via TemplateRepository.get()                        │
│    - Validates variables                                                │
│    - Starts MCP execution via MetabobCLI.startExecution()              │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. Session Prompt Handler (CRITICAL CONNECTION POINT)                   │
│    File: repos/metabob-opencode/packages/opencode/src/session/prompt.ts│
│    Lines 2589-2628: Extract context requirements from template          │
│                                                                          │
│    CODE FLOW:                                                            │
│    1. Get activityId for session (line 2592)                            │
│    2. Load Activity object (line 2596)                                  │
│    3. Get template metadata (line 2598)                                 │
│    4. Extract contextRequirements (line 2600):                          │
│       activityContextHints = template.contextRequirements               │
│    5. Build memory agent prompt (line 2618):                            │
│       buildMemoryAgentPrompt({                                           │
│         contextRequirements: activityContextHints                        │
│       })                                                                 │
│    6. Create memory agent subagent (line 2631)                          │
│    7. Execute memory agent with prompt (line 2646)                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. Build Memory Agent Prompt                                            │
│    Function: buildMemoryAgentPrompt() (lines 2529-2550)                │
│                                                                          │
│    Formats context requirements as:                                     │
│    ```                                                                   │
│    Activity requirements:                                               │
│    - target-code (REQUIRED): Code to be refactored                     │
│      Allowed types: file, component                                     │
│      Budget range: 5000-10000 tokens                                    │
│    - usage-patterns (REQUIRED): Examples of how code is used           │
│      Allowed types: file, bashOutput                                    │
│      Budget range: 3000-8000 tokens                                     │
│    ...                                                                   │
│    ```                                                                   │
│                                                                          │
│    Instructions to memory agent:                                        │
│    1. Check current context state: memory_budget()                      │
│    2. See existing impulses: memory_outline()                           │
│    3. Create impulses matching requirements: impulse_create()           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. Memory Agent Receives Prompt                                         │
│    File: repos/metabob-opencode/packages/opencode/src/session/         │
│          memory-agent.ts                                                │
│    Lines 97-211: analyzeIntent() function                              │
│                                                                          │
│    Memory agent is a SUBAGENT that:                                     │
│    - Receives formatted prompt with context requirements                │
│    - Has tools: memory_budget, impulse_create, impulse_load             │
│    - Creates impulses that satisfy requirements                         │
│    - Operates on parent session's impulse space                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 7. Impulse Creation                                                     │
│    Memory agent uses impulse_create tool:                               │
│    - Creates impulses matching required types (file, component, etc)    │
│    - Respects budget ranges (5000-10000 tokens)                         │
│    - Sets priority based on "required" field                            │
│    - Stores in parent session's impulse space                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 8. Impulse Loading (Session Context)                                    │
│    Lines 940-942 in memory-agent.ts:                                    │
│    - Impulses are loaded into <session_memory>                          │
│    - Required impulses prioritized                                      │
│    - Budget constraints enforced                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 9. Agent Receives Context                                               │
│    Main agent receives <session_memory> with:                           │
│    - Impulses created by memory agent                                   │
│    - Content matching context requirements                              │
│    - Properly formatted with budgets respected                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Files with Line Numbers

### 1. Backend Templates
- **Location**: SurrealDB (via metabob-rpc-api)
- **Templates with context_requirements**: 5 core templates
  - `refactor-72eb4607`: 3 requirements
  - `bug-fix-93374d0f`: 3 requirements
  - `feature-impl-c4b2e8ee`: 3 requirements
  - `add-rest-endpoint-97b69d8d`: 2 requirements
  - `activity-create-29e9d6c5`: 3 requirements

### 2. CLI Layer (metabob-cli)
- **File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`
- **Key Lines**:
  - Line 235: Convert camelCase → snake_case when fetching from backend
  - Lines 545-549: Convert snake_case → camelCase when exposing to OpenCode

### 3. OpenCode Activity Tool
- **File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
- **Key Lines**:
  - Line 319: Load template via `TemplateRepository.get()`
  - Line 341: Validate variables
  - Line 497: Start MCP execution via `MetabobCLI.startExecution()`

### 4. Session Prompt Handler (THE MISSING LINK!)
- **File**: `repos/metabob-opencode/packages/opencode/src/session/prompt.ts`
- **Key Lines**:
  - **Line 2589**: Declare `activityContextHints` variable
  - **Line 2592**: Get activityId for current session
  - **Line 2596**: Load Activity object
  - **Line 2598**: Get template metadata
  - **Line 2600**: **Extract context requirements from template**:
    ```typescript
    activityContextHints = template.contextRequirements
    ```
  - **Line 2618**: Build memory agent prompt with requirements:
    ```typescript
    const memoryPrompt = buildMemoryAgentPrompt({
      userMessage: input.promptText,
      contextRequirements: activityContextHints,  // PASSED HERE!
      targetSession: input.sessionID
    })
    ```
  - **Line 2631**: Create memory agent subagent session
  - **Line 2646**: Execute memory agent with formatted prompt

### 5. Memory Agent Prompt Builder
- **File**: `repos/metabob-opencode/packages/opencode/src/session/prompt.ts`
- **Function**: `buildMemoryAgentPrompt()` (lines 2529-2550)
- **Key Lines**:
  - **Lines 2538-2544**: Format context requirements into prompt:
    ```typescript
    ${input.contextRequirements.map(r => 
      `- ${r.key} (${r.required ? 'REQUIRED' : 'optional'}): ${r.hint}
       Allowed types: ${r.impulseTypes.join(", ")}
       Budget range: ${r.budgetRange[0]}-${r.budgetRange[1]} tokens`
    ).join("\n")}
    ```

### 6. Memory Agent (Receives Requirements)
- **File**: `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`
- **Key Lines**:
  - Lines 97-211: `analyzeIntent()` function (accepts `activityContextHints` parameter)
  - Lines 940-942: Impulse loading with context requirements prioritization

## Data Structure Schema

### Backend Format (snake_case)
```json
{
  "context_requirements": [
    {
      "key": "target-code",
      "hint": "Code to be refactored with current structure",
      "impulse_types": ["file", "component"],
      "required": true,
      "budget_min": 5000,
      "budget_max": 10000
    }
  ]
}
```

### CLI Conversion (Line 545-549)
```python
"contextRequirements": [
    {
        "key": req["key"],
        "hint": req["hint"],
        "impulseTypes": req["impulse_types"],  # snake → camel
        "required": req["required"],
        "budgetRange": [req["budget_min"], req["budget_max"]]  # array conversion
    }
]
```

### OpenCode Format (camelCase)
```typescript
interface ContextRequirement {
  key: string
  hint: string
  impulseTypes: string[]
  required: boolean
  budgetRange: [number, number]
}
```

## Architecture Validation Results

### ✅ Confirmed Working
1. **Backend Storage**: Templates have context_requirements field populated
2. **CLI Conversion**: Snake case → camel case working (bugs fixed Feb 15)
3. **Activity Tool**: Loads templates correctly
4. **Session Prompt**: **Extracts context requirements and passes to memory agent** ✅
5. **Memory Agent**: Receives formatted requirements in prompt ✅
6. **Prompt Builder**: Formats requirements into actionable instructions ✅
7. **Data Structures**: All layers use correct schema

### 🟡 Needs Runtime Validation
1. **Actual Impulse Creation**: Does memory agent actually create matching impulses?
2. **Budget Enforcement**: Are token budgets respected?
3. **Type Matching**: Are impulse types (file, component, etc) correctly matched?
4. **Priority Handling**: Are "required" requirements prioritized?

### ❓ Unanswered Questions
1. **Execution Frequency**: Is memory agent called for EVERY prompt or just session start?
2. **Caching**: Are impulses cached across tasks in same activity?
3. **Validation**: Is there validation that requirements were satisfied?
4. **Failure Handling**: What happens if memory agent can't satisfy requirements?

## Next Steps for Complete Validation

### 1. Add Execution Tracing
Add logging to confirm runtime behavior:

**File**: `repos/metabob-opencode/packages/opencode/src/session/prompt.ts`
```typescript
// Line 2600 - After extracting context requirements
l.info("CONTEXT_REQUIREMENTS_EXTRACTED", {
  templateId: activity.templateId,
  requirementCount: activityContextHints.length,
  requirements: activityContextHints.map(r => ({
    key: r.key,
    required: r.required,
    types: r.impulseTypes
  }))
})

// Line 2656 - After memory agent completes
l.info("MEMORY_AGENT_COMPLETED", {
  duration,
  impulsesCreated: /* count impulses in session */
})
```

### 2. Execute Activity with Tracing
Run a template execution with full logging:

```bash
# Enable debug logging
export LOG_LEVEL=debug

# Execute activity with context requirements
opencode activity --id refactor-72eb4607 --variables '{...}'

# Check logs for:
# - "CONTEXT_REQUIREMENTS_EXTRACTED" with 3 requirements
# - Memory agent subagent creation
# - Impulse creation matching requirements
# - <session_memory> section with loaded impulses
```

### 3. Validate Impulse Content
Check that created impulses match requirements:

```typescript
// After activity execution, query session impulses
const session = await Session.load(sessionId)
const impulses = session.impulses

// Verify:
// - Impulse count >= required count
// - Impulse types match requirement types
# - Impulse budgets within requirement ranges
// - Required impulses have high priority
```

## Evidence Summary

### Architecture Evidence ✅
- ✅ **Line 2600**: Context requirements extracted from template
- ✅ **Line 2618**: Requirements passed to prompt builder
- ✅ **Lines 2538-2544**: Requirements formatted into memory agent prompt
- ✅ **Line 2646**: Memory agent executed with formatted prompt
- ✅ **Lines 97-211**: Memory agent has capability to process requirements
- ✅ **Lines 940-942**: Impulse loading considers requirements

### Runtime Evidence 🟡 (Needs Confirmation)
- 🟡 Memory agent execution logs
- 🟡 Impulse creation logs matching requirements
- 🟡 <session_memory> contents showing loaded impulses
- 🟡 Agent receiving contextualized information

### Missing Evidence ❓
- ❓ End-to-end trace showing full flow
- ❓ Validation that requirements were satisfied
- ❓ Self-healing behavior on requirement failure

## Conclusion

**The context requirements flow EXISTS and is FUNCTIONAL at the architecture level.** The code clearly shows:

1. Templates stored with context requirements (backend)
2. CLI properly converts data structures (metabob-cli)
3. Activity tool loads templates (activity.ts)
4. **Session prompt handler extracts requirements** (prompt.ts:2600) ✅
5. **Requirements passed to memory agent** (prompt.ts:2618) ✅
6. **Prompt builder formats requirements** (prompt.ts:2538-2544) ✅
7. Memory agent receives formatted instructions ✅
8. Memory agent has tools to create matching impulses ✅

**What's left to validate**: Runtime execution traces confirming that:
- Memory agent actually creates impulses matching requirements
- Impulses are loaded into <session_memory>
- Agent receives properly contextualized information
- Budget and type constraints are enforced
- Required requirements are prioritized

This is the difference between "architecture exists" (✅ confirmed) and "system works as designed" (🟡 needs runtime validation).

---

**Status**: 🟢 **ARCHITECTURE VALIDATED - Ready for Runtime Testing**

**Next Session Goal**: Add tracing and execute activity to confirm runtime behavior matches architectural design.
