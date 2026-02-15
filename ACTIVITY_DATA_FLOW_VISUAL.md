# Activity System Data Flow - Visual Architecture

**Quick Reference: Data Custody Chain at a Glance**

---

## High-Level Flow

```
┌──────────────┐
│ User Prompt  │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: INTENT ANALYSIS                                    │
├─────────────────────────────────────────────────────────────┤
│ • TurnLifecycle.execute()                                   │
│ • SessionMemoryAgent.analyzeIntent()                        │
│ • SystemPrompt.analyzeUserIntent()                          │
│                                                             │
│ CUSTODY: OpenCode Memory (turn-scoped)                      │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: IMPULSE CREATION                                   │
├─────────────────────────────────────────────────────────────┤
│ • Hook: metabob-context-preparation (priority 20)          │
│ • Creates 5 impulse types:                                  │
│   1. metabob-priorities (high, 2000 tokens)                │
│   2. metabob-annotations (medium, 1500 tokens)             │
│   3. metabob-impact (high, 1000 tokens)                    │
│   4. metabob-related (medium, 800 tokens)                  │
│   5. metabob-recommendations (low, 1200 tokens)            │
│                                                             │
│ CUSTODY: OpenCode SQLite (opencode.db)                      │
│ STORAGE: Impulse metadata (id, pointer, budget, priority)   │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: IMPULSE LOADING                                    │
├─────────────────────────────────────────────────────────────┤
│ • SessionMemoryManager.loadImpulses()                       │
│ • Budget check (utilization < 85%)                          │
│ • Priority evaluation (high > medium > low)                 │
│ • Custom resolver: metabob-priorities                       │
│                                                             │
│ CUSTODY: OpenCode → Metabob Backend (MCP call)              │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: MCP CALL TO BACKEND                                │
├─────────────────────────────────────────────────────────────┤
│ • MetabobCLI.getPriorityIssues()                            │
│ • MCP Transport: SSE/StreamableHTTP                         │
│ • HTTP POST to metabob-rpc-api:3000/mcp/call               │
│                                                             │
│ RETRIEVED FROM: Metabob Backend SurrealDB                   │
│ • Issues table (security, performance, bugs)                │
│ • Component table (CPG nodes + annotations)                 │
│ • Cochange embeddings (vector similarity)                   │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: CONTENT LOADED INTO IMPULSE                        │
├─────────────────────────────────────────────────────────────┤
│ • impulse.content = "⚠️ 3 HIGH priority issues..."          │
│ • impulse.tokenCount = 1500                                 │
│ • impulse.lastUsed = currentTurn                            │
│                                                             │
│ CUSTODY: OpenCode Memory (session-scoped)                   │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 6: AGENT RECEIVES CONTEXT                             │
├─────────────────────────────────────────────────────────────┤
│ • System prompt includes <session_memory> section           │
│ • Agent sees: priority issues, annotations, impact          │
│ • Agent makes informed decisions                            │
│                                                             │
│ CUSTODY: Agent context (LLM prompt)                         │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 7: AGENT EXECUTION                                    │
├─────────────────────────────────────────────────────────────┤
│ • Activity.execute()                                        │
│ • Agent writes code                                         │
│ • SessionContext.trackFileModification()                    │
│                                                             │
│ TRACKED: modifiedFiles Map (in-memory)                      │
│ CUSTODY: OpenCode Memory (session-scoped)                   │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 8: ACTIVITY COMPLETE - COMPONENT ANNOTATION           │
├─────────────────────────────────────────────────────────────┤
│ • identifyKeyComponents() - extract from git diff           │
│ • generateAnnotations() - create annotation records         │
│ • MetabobCLI.annotateComponent()                            │
│ • MCP call: metabob_annotate_component                      │
│                                                             │
│ STORED: Metabob Backend SurrealDB                           │
│ • component_annotations table                               │
│ • Linked to CPG component node                              │
│ • Searchable by file/component/reason                       │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 9: OUTCOME RECORDING (LEARNING LOOP)                  │
├─────────────────────────────────────────────────────────────┤
│ • ActivityOutcomeRecorder.recordOutcome()                   │
│ • Collects: expectation, comparison, decisions              │
│ • MCP call: metabob_record_outcome                          │
│                                                             │
│ STORED: Metabob Backend SurrealDB                           │
│ • activity_outcomes table                                   │
│ • Used for Thompson Sampling (template selection)           │
│ • Used for template evolution (performance analysis)        │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 10: POST-TURN - COMPONENT USAGE ANNOTATION            │
├─────────────────────────────────────────────────────────────┤
│ • Hook: session-memory-optimization (priority 110)          │
│ • For each loaded impulse (tokenCount > 0):                 │
│   - Annotate component with usage context                   │
│   - Capture: turn, task, priority, load reason              │
│                                                             │
│ STORED: Metabob Backend SurrealDB                           │
│ • component_annotations table (usage tracking)              │
│ • Used for priority scoring, relevance ranking              │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 11: FEEDBACK LOOP (FUTURE SESSIONS)                   │
├─────────────────────────────────────────────────────────────┤
│ • Next session: Same component requested                    │
│ • Impulse resolver: metabob-annotations                     │
│ • MetabobCLI.listFileComponents() - with annotations        │
│ • Agent receives component WITH historical context          │
│                                                             │
│ RESULT: Informed decisions based on past activity           │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Custody by System

```
┌─────────────────────────────────────────────────────────────────┐
│                      OpenCode (Local)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  IN-MEMORY (Ephemeral - cleared on restart)                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ SessionContext Maps:                                   │    │
│  │ • recentFiles: Map<sessionID, Set<filePath>>           │    │
│  │ • modifiedFiles: Map<sessionID, Map<path, {type,ts}>>  │    │
│  │ • currentPrompts: Map<sessionID, string>               │    │
│  │ • sessionMetadata: Map<sessionID, {...}>               │    │
│  │                                                        │    │
│  │ Lifecycle: Cleared every 60s (cleanup interval)        │    │
│  │ Memory: ~0.2KB per file per session                    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  SQLite: ~/.local/share/opencode/{projectId}/opencode.db       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Tables:                                                │    │
│  │ • sessions (id, created, updated)                      │    │
│  │ • impulses (id, sessionID, type, pointer, budget)      │    │
│  │ • session_memory_state (snapshots)                     │    │
│  │ • activity_executions (logs, not synced)               │    │
│  │                                                        │    │
│  │ Lifecycle: Persistent across restarts                  │    │
│  │ Size: ~1-10MB per project                              │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  Metabob Backend (Distributed)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SurrealDB: metabob-rpc-api:3000                                │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Tables:                                                │    │
│  │ • components (CPG nodes)                               │    │
│  │ • component_annotations (history)                      │    │
│  │ • issues (security, performance, bugs)                 │    │
│  │ • activity_outcomes (learning data)                    │    │
│  │ • activity_templates (definitions + variants)          │    │
│  │ • cochange_embeddings (768-dim vectors)                │    │
│  │ • cochange_pairs (co-change frequency)                 │    │
│  │                                                        │    │
│  │ Lifecycle: Persistent, no automatic cleanup            │    │
│  │ Size: ~100MB-1GB per project (depends on activity)     │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Turn Lifecycle Hook Priorities (Execution Order)

```
BEFORE MAIN AGENT TURN:
┌────────────────────────────────────────────────────────────┐
│ Priority 5:  activity-decision-reminder                    │
│              - Adds "check activities first" reminder      │
│              - Once per session                            │
├────────────────────────────────────────────────────────────┤
│ Priority 10: session-memory-preparation                    │
│              - SessionMemoryAgent.analyzeIntent()          │
│              - LLM-based intent analysis + impulse suggest │
├────────────────────────────────────────────────────────────┤
│ Priority 15: activity-recommendation-injection             │
│              - Searches activities based on prompt         │
│              - Injects recommended templates               │
├────────────────────────────────────────────────────────────┤
│ Priority 20: metabob-context-preparation ⭐                │
│              - Creates 5 impulse types                     │
│              - Priority issues, annotations, impact, etc.  │
├────────────────────────────────────────────────────────────┤
│ Priority 25: boredom-task-suggestion                       │
│              - Suggests improvement tasks when idle        │
└────────────────────────────────────────────────────────────┘

MAIN AGENT TURN EXECUTION:
┌────────────────────────────────────────────────────────────┐
│ • SessionMemoryManager.loadImpulses()                      │
│ • Custom resolvers fetch content from Metabob             │
│ • Agent receives context in <session_memory>               │
│ • Agent executes task                                      │
└────────────────────────────────────────────────────────────┘

AFTER MAIN AGENT TURN:
┌────────────────────────────────────────────────────────────┐
│ Priority 100: post-turn-cleanup                            │
│               - Unload low-priority impulses if >80%       │
│               - Quick utilization-based triage             │
├────────────────────────────────────────────────────────────┤
│ Priority 110: session-memory-optimization ⭐               │
│               - Comprehensive turn-based cleanup           │
│               - Annotate loaded components with context    │
│               - Delete stale impulses (>10 turns old)      │
└────────────────────────────────────────────────────────────┘
```

---

## Impulse Lifecycle

```
┌──────────────┐
│ IMPULSE      │
│ CREATION     │
└──────┬───────┘
       │
       │ SessionMemory.addImpulse()
       │ • id: "metabob-priorities-01KHDK..."
       │ • sessionID: "ses_abc123"
       │ • type: "memo"
       │ • pointer: { type: "custom", resolver: "metabob-priorities" }
       │ • budget: 2000
       │ • priority: "high"
       │ • content: undefined (not yet loaded)
       │ • tokenCount: undefined
       │
       ▼
┌─────────────────┐
│ IMPULSE         │
│ METADATA STORED │
│ (SQLite)        │
└──────┬──────────┘
       │
       │ Memory Manager decides to load
       │ • Budget available? ✓
       │ • Priority justified? ✓
       │ • Not stale? ✓
       │
       ▼
┌─────────────────┐
│ IMPULSE         │
│ RESOLUTION      │
└──────┬──────────┘
       │
       │ Custom resolver: metabob-priorities
       │ • MetabobCLI.getPriorityIssues()
       │ • MCP call to backend
       │ • Returns: priority issues data
       │
       ▼
┌─────────────────┐
│ IMPULSE         │
│ LOADED          │
└──────┬──────────┘
       │
       │ • content: "⚠️ 3 HIGH priority issues..."
       │ • tokenCount: 1500
       │ • lastUsed: 1 (current turn)
       │
       ▼
┌─────────────────┐
│ IMPULSE         │
│ USAGE IN TURN   │
└──────┬──────────┘
       │
       │ Agent receives context
       │ Agent uses information
       │ Agent modifies components
       │
       ▼
┌─────────────────┐
│ IMPULSE         │
│ ANNOTATION      │
└──────┬──────────┘
       │
       │ Post-turn hook: session-memory-optimization
       │ • For each loaded impulse (tokenCount > 0)
       │ • Annotate component with usage context
       │ • MCP call: metabob_annotate_component
       │
       ▼
┌─────────────────┐
│ COMPONENT       │
│ HISTORY UPDATED │
│ (Backend)       │
└──────┬──────────┘
       │
       │ Next turn: Check staleness
       │ • lastUsed > 5 turns ago? → Unload
       │ • lastUsed > 10 turns ago? → Delete
       │
       ▼
┌─────────────────┐
│ IMPULSE         │
│ CLEANUP         │
└─────────────────┘
```

---

## Component Annotation Types

```
┌────────────────────────────────────────────────────────────┐
│ Type 1: ACTIVITY ANNOTATIONS (WHY component changed)       │
├────────────────────────────────────────────────────────────┤
│ Source: Activity complete hook                             │
│ File: activity-complete.ts:146-150                         │
│                                                            │
│ Content Example:                                           │
│ "ACTIVITY: Fixed SQL injection using parameterized        │
│  queries. Chose this over ORM for performance. Applied    │
│  same pattern to 3 other files."                          │
│                                                            │
│ Purpose: Preserve design decisions for future mods         │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Type 2: SESSION MEMORY ANNOTATIONS (HOW component used)    │
├────────────────────────────────────────────────────────────┤
│ Source: Post-turn optimization hook                        │
│ File: turn-lifecycle-hooks.ts:856-923                      │
│                                                            │
│ Content Example:                                           │
│ "SESSION MEMORY: Loaded 1500 tokens                       │
│  Priority: high                                           │
│  Turn: 1                                                  │
│  Task: Fix SQL injection in auth.ts                       │
│  Load reason: Priority issue in active work area          │
│  Context requirement: Security analysis"                  │
│                                                            │
│ Purpose: Track usage patterns, relevance scoring           │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Type 3: MANUAL ANNOTATIONS (DOMAIN knowledge)              │
├────────────────────────────────────────────────────────────┤
│ Source: Developer via CLI/API                              │
│ Command: opencode metabob annotate                         │
│                                                            │
│ Content Example:                                           │
│ "ARCHITECTURE: authenticate() is entry point for all      │
│  auth flows. DO NOT modify signature without checking     │
│  20+ call sites. See SECURITY.md for threat model."       │
│                                                            │
│ Purpose: Capture human expertise and constraints           │
└────────────────────────────────────────────────────────────┘
```

---

## MCP Call Flow (Detailed)

```
┌────────────────────┐
│ OpenCode Component │
└──────┬─────────────┘
       │
       │ Example: MetabobCLI.getPriorityIssues()
       │ File: repos/metabob-opencode/packages/opencode/src/util/metabob.ts
       │
       ▼
┌──────────────────────────┐
│ MCP Client Wrapper       │
│ callMCPTool()            │
└──────┬───────────────────┘
       │
       │ MCP Transport: SSE/StreamableHTTP
       │ File: repos/metabob-opencode/packages/opencode/src/mcp/index.ts:245-263
       │
       ▼
┌──────────────────────────────────┐
│ HTTP Request                     │
│ POST metabob-rpc-api:3000/mcp   │
└──────┬───────────────────────────┘
       │
       │ Body:
       │ {
       │   "tool": "metabob_get_priority_issues",
       │   "args": { "sessionID": "ses_abc123" }
       │ }
       │
       ▼
┌──────────────────────────────────┐
│ Metabob RPC API Server          │
│ (Python FastAPI)                │
└──────┬───────────────────────────┘
       │
       │ File: repos/metabob-cli/src/metabob_cli/mcp/server.py
       │ Handler: handle_tool_call()
       │
       ▼
┌──────────────────────────────────┐
│ Tool Implementation              │
│ get_priority_issues()            │
└──────┬───────────────────────────┘
       │
       │ File: repos/metabob-cli/src/metabob_cli/mcp/tools.py
       │
       ▼
┌──────────────────────────────────┐
│ SurrealDB Query                  │
└──────┬───────────────────────────┘
       │
       │ Query: SELECT * FROM issues
       │        WHERE severity >= 'MEDIUM'
       │        AND status = 'open'
       │        ORDER BY severity DESC, created DESC
       │        LIMIT 5
       │
       ▼
┌──────────────────────────────────┐
│ Results + CPG Enrichment         │
└──────┬───────────────────────────┘
       │
       │ • Issues data
       │ • Component annotations (if available)
       │ • Related files (from CPG)
       │
       ▼
┌──────────────────────────────────┐
│ HTTP Response                    │
│ 200 OK                           │
└──────┬───────────────────────────┘
       │
       │ Body:
       │ {
       │   "issues": [
       │     { "id": "iss_01", "severity": "HIGH", ... },
       │     { "id": "iss_02", "severity": "MEDIUM", ... }
       │   ]
       │ }
       │
       ▼
┌──────────────────────────────────┐
│ OpenCode Component               │
│ Receives Results                 │
└──────────────────────────────────┘
       │
       │ Loaded into impulse.content
       │ Formatted for agent consumption
       │
       ▼
┌──────────────────────────────────┐
│ Agent Context                    │
│ <session_memory>                 │
└──────────────────────────────────┘
```

---

## Session Context Tracking (In-Memory)

```
┌─────────────────────────────────────────────────────────────┐
│                    SessionContext Module                    │
│                  (In-Memory Maps - Ephemeral)               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  recentFiles: Map<sessionID, { files: Set<path>, lastUpdate }>
│  ┌─────────────────────────────────────────────────────┐   │
│  │ "ses_abc123" → {                                    │   │
│  │   files: Set([                                      │   │
│  │     "src/auth.ts",                                  │   │
│  │     "src/session.ts",                               │   │
│  │     "test/auth.test.ts"                             │   │
│  │   ]),                                               │   │
│  │   lastUpdate: 1739491200000                         │   │
│  │ }                                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  modifiedFiles: Map<sessionID, { files: Map<path, {type, ts}> }>
│  ┌─────────────────────────────────────────────────────┐   │
│  │ "ses_abc123" → {                                    │   │
│  │   files: Map([                                      │   │
│  │     ["src/auth.ts", {                               │   │
│  │       type: "write",                                │   │
│  │       timestamp: 1739491200000                      │   │
│  │     }],                                             │   │
│  │     ["test/auth.test.ts", {                         │   │
│  │       type: "write",                                │   │
│  │       timestamp: 1739491201000                      │   │
│  │     }]                                              │   │
│  │   ]),                                               │   │
│  │   lastUpdate: 1739491201000                         │   │
│  │ }                                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  API:                                                       │
│  • trackFileAccess(sessionID, path)                         │
│  • trackFileModification(sessionID, path, "read"|"write")   │
│  • getActiveFiles(sessionID, opts) → string[]               │
│  • getModifiedFiles(sessionID, opts) → string[]             │
│                                                             │
│  Lifecycle:                                                 │
│  • Cleanup every 60s (old sessions removed)                 │
│  • Emergency cleanup if memory > 500MB                      │
│  • Cleared on process restart                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Key File References (Quick Lookup)

### Session Context Tracking
- **File**: `repos/metabob-opencode/packages/opencode/src/session/context.ts`
- **Lines**: 58-87 (trackFileAccess), 128-157 (trackFileModification), 159-191 (getModifiedFiles)

### Turn Lifecycle Hooks
- **File**: `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts`
- **Lines**: 332-516 (metabob-context-preparation), 799-957 (session-memory-optimization + annotation)

### Memory Agent
- **File**: `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`
- **Lines**: 97-500 (analyzeIntent)

### Activity Complete
- **File**: `repos/metabob-opencode/packages/opencode/src/session/activity-complete.ts`
- **Lines**: 50-100 (identifyKeyComponents), 100-150 (generateAnnotations), 146-150 (annotate call)

### Outcome Recording
- **File**: `repos/metabob-opencode/packages/opencode/src/session/activity-outcome-recorder.ts`
- **Lines**: 43-89 (ActivityOutcome type), 135-150 (discoverConfiguration), 300-400 (recordOutcome)

### System Prompt Integration
- **File**: `repos/metabob-opencode/packages/opencode/src/session/system.ts`
- **Lines**: 440-478 (injectImpactWarnings), 480-600 (injectComponentAnnotations)

### MCP Integration
- **File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`
- **Lines**: 100-150 (getPriorityIssues), 200-250 (annotateComponent), 300-350 (listFileComponents)
- **File**: `repos/metabob-opencode/packages/opencode/src/mcp/index.ts`
- **Lines**: 245-263 (SSE/StreamableHTTP transport)

---

## Summary: 3 Custodians, 11 Phases, 1 Learning Loop

### The 3 Custodians
1. **OpenCode** - Session state, impulse lifecycle, activity metadata
2. **Metabob Backend** - Component annotations, outcomes, CPG, embeddings
3. **Agent Context** - Loaded context, decision-making, code generation

### The 11 Phases
1. Intent analysis
2. Impulse creation
3. Impulse loading
4. MCP call to backend
5. Content loaded into impulse
6. Agent receives context
7. Agent execution
8. Activity complete - component annotation
9. Outcome recording
10. Post-turn - component usage annotation
11. Feedback loop - historical context available

### The 1 Learning Loop
**Every interaction contributes to institutional knowledge:**
- Component annotations accumulate over time
- Activity outcomes improve template selection
- Usage patterns optimize context loading
- Historical context enables better decisions

**Result**: System gets smarter with every session, automatically and transparently.
