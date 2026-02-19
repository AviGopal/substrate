# Impulse & Activity Template Execution Flow: Visual Guide

## Complete Message Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ User Request: "Fix the bug in auth.ts"                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Activity Template: "fix-bug-complete"                           │
│ • Task 1: gather-context (memory agent)                         │
│ • Task 2: fix-bug (general agent)                               │
│ • Task 3: test-fix (general agent)                              │
│ • Task 4: commit-changes (general agent)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
         TASK 1: Gather Context      │
                    │                 │
                    ▼                 │
┌─────────────────────────────────────────────────────────────────┐
│ 1. Create Impulses (unloaded)                                   │
│    • errorFile: { pointer: "auth.ts", budget: 2000 }            │
│    • metabobIssues: { pointer: "query auth bugs", budget: 3000 }│
│    • relatedTests: { pointer: "test/auth", budget: 1500 }       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Load Task Impulses                                           │
│    ImpulseResolver.load() → Resolve pointers, load content      │
│                                                                  │
│    errorFile: { loaded: true, content: "...", tokens: 1850 }    │
│    metabobIssues: { loaded: true, content: "...", tokens: 2100 }│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Format Impulses for Context                                  │
│    formatImpulsesForContext() → XML wrapper                     │
│                                                                  │
│    <impulse_context>                                             │
│      <impulse id="errorFile" type="file" tokens="1850/2000">    │
│        [actual file content]                                     │
│      </impulse>                                                  │
│      <impulse id="metabobIssues" type="metabob" ...>            │
│        [metabob analysis]                                        │
│      </impulse>                                                  │
│    </impulse_context>                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Interpolate Task Prompt                                      │
│    task.prompt.template + variables → user message              │
│                                                                  │
│    "Analyze the error in {{file}} and summarize the bug."       │
│      → "Analyze the error in auth.ts and summarize the bug."    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Combine: Impulse Context + Task Prompt                       │
│                                                                  │
│    enrichedPrompt = impulseContext + "\n\n" + taskPrompt        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Execute via Subagent                                         │
│    executeViaSubagent("memory", ..., enrichedPrompt, ...)       │
│                                                                  │
│    • Get agent config: Agent.get("memory")                      │
│    • Add Metabob scoped context (if enabled)                    │
│    • Resolve prompt parts                                       │
│    • Determine model (agent.model or complexity-based)          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. SessionPrompt.prompt()                                       │
│    Build LLM messages array                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ LLM REQUEST STRUCTURE                                           │
│ ═══════════════════════════════════════════════════════════     │
│                                                                  │
│ messages: [                                                      │
│   {                                                              │
│     role: "system",                                              │
│     content: "You are Claude Code..."  ← Base system prompt     │
│   },                                                             │
│   {                                                              │
│     role: "system",                                              │
│     content: "You are the Memory Agent responsible for..."       │
│              ↑                                                   │
│              └─ From agent.prompt (agent.ts line 383)           │
│   },                                                             │
│   {                                                              │
│     role: "user",                                                │
│     content: "                                                   │
│       <impulse_context>                                          │
│         <impulse id='errorFile' ...>...</impulse>               │
│         <impulse id='metabobIssues' ...>...</impulse>           │
│       </impulse_context>                                         │
│                                                                  │
│       Analyze the error in auth.ts and summarize the bug.       │
│       ↑                                                          │
│       └─ From task.prompt.template (activity template)          │
│     "                                                            │
│   }                                                              │
│ ]                                                                │
│                                                                  │
│ tools: {                                                         │
│   impulse_create: true,  ← From agent.tools                     │
│   impulse_load: true,                                            │
│   memory_budget: true,                                           │
│   bash: true,                                                    │
│   metabob_*: true                                                │
│ }                                                                │
│                                                                  │
│ model: {                                                         │
│   providerID: "anthropic",  ← From agent.model                  │
│   modelID: "claude-4-5-haiku"                                    │
│ }                                                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ LLM RESPONSE                                                     │
│ ═══════════════════════════════════════════════════════════     │
│                                                                  │
│ {                                                                │
│   role: "assistant",                                             │
│   content: "Bug Summary: The authentication function in         │
│             auth.ts has a race condition where...",              │
│   tool_calls: [                                                  │
│     {                                                            │
│       name: "impulse_create",                                    │
│       args: {                                                    │
│         id: "bugSummary",                                        │
│         content: "Race condition in auth function..."            │
│       }                                                          │
│     }                                                            │
│   ]                                                              │
│ }                                                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Task Complete                                                │
│    • Extract tokens, cost                                       │
│    • Validate result                                            │
│    • Update activity stats                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. Optimize for Next Task                                       │
│    optimizeImpulsesForNextTask()                                │
│                                                                  │
│    • Unload errorFile (not needed by task 2)                    │
│    • Keep bugSummary (high priority)                            │
│    • Free 1850 tokens                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             └────────────┐
                                          │
                             TASK 2: Fix Bug (general agent)
                                          │
                                          ▼
                        [Repeat steps 2-9 with different
                         agent, impulses, and task prompt]
```

---

## Component Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        ARCHITECTURE LAYERS                       │
└─────────────────────────────────────────────────────────────────┘

LAYER 1: Agent Definition (agent.ts)
┌────────────────────────────────────────────────────────────────┐
│ memory: {                                                       │
│   name: "memory",                              ← WHO am I?     │
│   model: { ... },                              ← WHAT model?   │
│   prompt: "You are Memory Agent...",           ← IDENTITY      │
│   tools: { impulse_create: true, ... },       ← CAPABILITIES   │
│   permission: { edit: "allow", ... },         ← PERMISSIONS    │
│   mode: "subagent"                             ← ROLE          │
│ }                                                               │
└────────────────────────────────────────────────────────────────┘
                             │
                             │ Referenced by
                             ▼
LAYER 2: Activity Template (JSON)
┌────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "id": "manage-session-memory",               ← WHAT to do?   │
│   "tasks": [                                                    │
│     {                                                           │
│       "id": "analyze-intent",                  ← TASK NAME     │
│       "subagent": "memory",  ──────────────────┘ USE THIS AGENT│
│       "prompt": {                              ← INSTRUCTIONS   │
│         "template": "Analyze: {{userMessage}}" ← USER MESSAGE  │
│       },                                                        │
│       "impulseReferences": ["contextSpace"]    ← NEEDED DATA   │
│     }                                                           │
│   ]                                                             │
│ }                                                               │
└────────────────────────────────────────────────────────────────┘
                             │
                             │ Creates/uses
                             ▼
LAYER 3: Impulses (Runtime)
┌────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   id: "contextSpace",                          ← WHAT data?    │
│   pointer: { type: "memo", content: "..." },  ← WHERE IS IT?   │
│   budget: 1000,                                ← TOKEN LIMIT   │
│   loaded: true,                                ← IS IT LOADED? │
│   content: "Current context: 20000 tokens...", ← ACTUAL DATA   │
│   tokenCount: 500                              ← ACTUAL SIZE   │
│ }                                                               │
└────────────────────────────────────────────────────────────────┘
                             │
                             │ Combined into
                             ▼
LAYER 4: LLM Request
┌────────────────────────────────────────────────────────────────┐
│ messages: [                                                     │
│   { role: "system", content: agent.prompt },  ← FROM LAYER 1   │
│   { role: "user", content:                    ← FROM LAYER 2+3 │
│       impulseContext + taskPrompt                               │
│   }                                                             │
│ ],                                                              │
│ tools: agent.tools,                           ← FROM LAYER 1   │
│ model: agent.model                            ← FROM LAYER 1   │
└────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Timeline

```
TIME: t=0 (Activity Start)
┌─────────────────────────────────────────────────────────────────┐
│ Activity Memory State:                                          │
│   Impulses: {}                                                  │
│   Total Budget: 0 tokens                                        │
│   Used: 0 tokens                                                │
└─────────────────────────────────────────────────────────────────┘

TIME: t=1 (Create Impulses)
┌─────────────────────────────────────────────────────────────────┐
│ Activity Memory State:                                          │
│   Impulses: {                                                   │
│     errorFile: { loaded: false, budget: 2000, content: null }   │
│     metabob: { loaded: false, budget: 3000, content: null }     │
│     tests: { loaded: false, budget: 1500, content: null }       │
│   }                                                              │
│   Total Budget: 6500 tokens                                     │
│   Used: 0 tokens (nothing loaded yet)                           │
└─────────────────────────────────────────────────────────────────┘

TIME: t=2 (Load Impulses for Task 1)
┌─────────────────────────────────────────────────────────────────┐
│ Activity Memory State:                                          │
│   Impulses: {                                                   │
│     errorFile: { loaded: TRUE, budget: 2000, tokens: 1850 } ✓  │
│     metabob: { loaded: TRUE, budget: 3000, tokens: 2100 } ✓    │
│     tests: { loaded: false, budget: 1500, content: null }       │
│   }                                                              │
│   Total Budget: 6500 tokens                                     │
│   Used: 3950 tokens (60.8% utilization)                         │
└─────────────────────────────────────────────────────────────────┘

TIME: t=3 (Task 1 Execution)
┌─────────────────────────────────────────────────────────────────┐
│ LLM sees:                                                       │
│   System: "You are Memory Agent..." (from agent.prompt)         │
│   User: "<impulse_context>                                      │
│           <impulse id='errorFile'>...</impulse>                 │
│           <impulse id='metabob'>...</impulse>                   │
│         </impulse_context>                                      │
│         Analyze and summarize the bug."                         │
│                                                                  │
│ LLM responds:                                                   │
│   "Bug summary: Race condition in auth function..."             │
│   tool_call: impulse_create("bugSummary", "...")                │
└─────────────────────────────────────────────────────────────────┘

TIME: t=4 (After Task 1, Before Task 2)
┌─────────────────────────────────────────────────────────────────┐
│ Activity Memory State:                                          │
│   Impulses: {                                                   │
│     errorFile: { loaded: FALSE, tokens: 0 } ← UNLOADED          │
│     metabob: { loaded: FALSE, tokens: 0 } ← UNLOADED            │
│     tests: { loaded: false, budget: 1500, content: null }       │
│     bugSummary: { loaded: TRUE, budget: 500, tokens: 300 } ← NEW│
│   }                                                              │
│   Total Budget: 7500 tokens                                     │
│   Used: 300 tokens (4% utilization) ← OPTIMIZED!                │
└─────────────────────────────────────────────────────────────────┘

TIME: t=5 (Load Impulses for Task 2)
┌─────────────────────────────────────────────────────────────────┐
│ Activity Memory State:                                          │
│   Impulses: {                                                   │
│     errorFile: { loaded: TRUE, tokens: 1850 } ← RELOADED        │
│     bugSummary: { loaded: TRUE, tokens: 300 } ← KEPT            │
│     tests: { loaded: TRUE, tokens: 1200 } ← LOADED              │
│   }                                                              │
│   Total Budget: 7500 tokens                                     │
│   Used: 3350 tokens (44.7% utilization)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Insights from Flow

### 1. Impulses are Context, Not Instructions
```
❌ WRONG: Impulse defines what agent should do
✓ RIGHT: Impulse provides data agent needs
```

### 2. Task Prompt is User Message, Not System Prompt
```
❌ WRONG: task.prompt.template → system message
✓ RIGHT: task.prompt.template → user message
```

### 3. Agent Config is Static, Impulses are Dynamic
```
Agent Config (agent.ts):
  - Set once at startup
  - Defines capabilities
  - Never changes

Impulses:
  - Created per activity
  - Loaded/unloaded dynamically
  - Optimized between tasks
```

### 4. Memory Management is Automatic
```
Developer writes:
  impulseReferences: ["errorFile", "bugSummary"]

Executor handles:
  1. Load these impulses
  2. Format as XML
  3. Inject into prompt
  4. Unload after task
  5. Optimize for next task
```

### 5. Layered Architecture
```
Layer 1: Agent Definition (WHO)
Layer 2: Activity Template (WHAT)
Layer 3: Impulses (DATA)
Layer 4: Execution (HOW)

All layers compose together at runtime
```

---

## Summary

**The impulse system enables:**
- ✅ Dynamic context injection without prompt bloat
- ✅ Memory-efficient multi-task workflows
- ✅ Reusable activity templates
- ✅ Token budget management
- ✅ Context optimization between tasks

**It does NOT:**
- ❌ Replace agent system prompts
- ❌ Define agent capabilities
- ❌ Provide instructions (that's task.prompt)
- ❌ Supplant traditional agent config

**Instead, it provides a structured data layer** that sits between the static agent configuration and the dynamic task execution, enabling complex workflows while maintaining memory efficiency.
