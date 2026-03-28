# Activity System ↔ Metabob Data Custody Chain

**Complete Architectural Map: How Task/Execution History Flows Through the System**

This document answers the 6 core questions about data custody, storage, and feedback loops in the Activity System ↔ Metabob integration.

---

## Executive Summary

### The 6 Core Questions - Answered

1. **How do we attach task/execution history/intent to components?**
   - **Answer**: Via `metabob_annotate_component` MCP tool (lines 856-905 in `turn-lifecycle-hooks.ts`)
   - **Custody**: Session impulses → Activity outcomes → Component annotations → Metabob backend
   - **Storage**: Metabob CPG component graph + OpenCode local activity metadata

2. **How can we scan using the activity system?**
   - **Answer**: Turn lifecycle hooks inject Metabob context before each turn
   - **Custody**: User prompt → Intent analysis → Impulse creation → Memory agent loads → Agent receives
   - **Entry Point**: `metabob-context-preparation` hook (priority 20) in `turn-lifecycle-hooks.ts:332-516`

3. **How do we feed information back via impulse system?**
   - **Answer**: Post-turn hooks annotate loaded components with session context
   - **Custody**: Impulse loads → Component usage tracking → Annotation → Backend storage → Future retrieval
   - **Feedback Loop**: Lines 856-923 in `turn-lifecycle-hooks.ts` (component annotation after optimization)

4. **What is the custody of data?**
   - **Answer**: See "Complete Data Custody Chain" section below
   - **Owners**: OpenCode (session/activity data), Metabob Backend (outcomes/annotations/CPG)
   - **Sync**: Real-time MCP calls + async outcome recording

5. **How does the activity system interact with this?**
   - **Answer**: Activity execution triggers outcome recording + component annotation
   - **Integration Points**: 
     - Activity start: Expectations recorded (component predictions)
     - Activity complete: Outcomes recorded + annotations created (lines 146-150 in `activity-complete.ts`)
     - Turn lifecycle: Component usage annotated (lines 856-923 in `turn-lifecycle-hooks.ts`)

6. **How do we collect information from sessions?**
   - **Answer**: SessionContext module tracks all file access/modifications per session
   - **Implementation**: `session/context.ts` - in-memory tracking with Maps
   - **Retrieval**: `SessionContext.getModifiedFiles()`, `SessionContext.getActiveFiles()`

---

## Complete Data Custody Chain

### Phase 1: User Intent → Session Context
```
User Prompt
    ↓
[Entry: TurnLifecycle.execute()]
repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle.ts:93-140
    ↓
[Hook: session-memory-preparation, priority 10]
repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts:113-183
    ↓
[SessionMemoryAgent.analyzeIntent()]
repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts:97-500
    ↓ (LLM analyzes intent + suggests impulses)
    ↓
[SystemPrompt.analyzeUserIntent() - lightweight version]
repos/metabob-opencode/packages/opencode/src/session/system.ts:1-150
    ↓
STORED: Intent analysis cached in turn context
CUSTODY: OpenCode memory (turn-scoped, not persisted)
```

### Phase 2: Context Impulse Creation
```
[Hook: metabob-context-preparation, priority 20]
repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts:332-516
    ↓
Creates 5 impulse types:
    1. Priority issues (metabob-priorities-{ulid})
    2. Component annotations (metabob-annotations-{ulid})  [if enabled]
    3. Impact warnings (metabob-impact-{ulid})  [if refactor keywords]
    4. Related changes (metabob-related-{ulid})
    5. Recommendations (metabob-recommendations-{ulid})
    ↓
[SessionMemory.addImpulse() - for each impulse]
repos/metabob-opencode/packages/opencode/src/session/session-memory.ts:150-250
    ↓
STORED: Impulse metadata in opencode.db (SQLite)
CUSTODY: OpenCode local database
    - id: string (e.g., "metabob-priorities-01KHDK...")
    - sessionID: string
    - type: "memo" (will resolve via custom resolver)
    - pointer: { type: "custom", resolver: "metabob-priorities", data: {...} }
    - budget: number (token allocation)
    - priority: "high" | "medium" | "low"
    - content: undefined (not yet loaded)
    - tokenCount: undefined (not yet loaded)
```

### Phase 3: Impulse Loading (Memory Agent Decision)
```
[SessionPrompt.prepareSessionMemory()]
repos/metabob-opencode/packages/opencode/src/session/prompt.ts:500-700
    ↓
[SessionMemoryManager.loadImpulses()]
repos/metabob-opencode/packages/opencode/src/session/memory-manager.ts:200-400
    ↓
Decisions per impulse:
    - Check budget availability (utilization < 85%)
    - Check priority (high > medium > low)
    - Check staleness (last used turn)
    - Load if: budget available + priority justified + not stale
    ↓
[Custom Resolver: metabob-priorities]
repos/metabob-opencode/packages/opencode/src/session/system.ts:150-300
    ↓
Resolver calls:
    - MetabobCLI.getPriorityIssues()
    - MetabobCLI.listFileComponents()
    - MetabobCLI.suggestRelatedChanges()
    ↓
[MCP Call: metabob_get_priority_issues]
repos/metabob-opencode/packages/opencode/src/util/metabob.ts:200-300
    ↓
[MCP Client Transport: SSE/StreamableHTTP]
repos/metabob-opencode/packages/opencode/src/mcp/index.ts:245-263
    ↓
HTTP Request to Metabob Backend:
    POST http://metabob-rpc-api:3000/mcp/call
    { tool: "metabob_get_priority_issues", args: {...} }
    ↓
RETRIEVED: Priority issues from Metabob CPG + issue cache
CUSTODY: Metabob Backend SurrealDB
    - Issues table (security, performance, bugs)
    - Component table (CPG nodes + annotations)
    - Cochange embeddings (vector similarity)
    ↓
LOADED: Content returned to impulse
CUSTODY: OpenCode memory (session-scoped)
    - impulse.content = "⚠️ 3 HIGH priority issues in src/..."
    - impulse.tokenCount = 1500
    - impulse.lastUsed = currentTurn
```

### Phase 4: Agent Execution (Activity System)
```
[Activity.execute()]
repos/metabob-opencode/packages/opencode/src/session/activity.ts:200-500
    ↓
Agent receives context in system prompt:
    <session_memory>
        ## High Priority Context
        
        ### memo: Priority code issues (metabob-priorities-01KHDK...)
        Budget: 2000 tokens | Used: 1500 tokens
        ```
        ⚠️ 3 HIGH priority issues:
        1. [Security] SQL injection in auth.ts:42
        2. [Performance] N+1 query in users.ts:156
        3. [Bug] Null pointer in session.ts:89
        ```
    </session_memory>
    ↓
Agent makes decisions + writes code
    ↓
[SessionContext.trackFileModification() - on every file write]
repos/metabob-opencode/packages/opencode/src/session/context.ts:128-157
    ↓
TRACKED: File modifications per session
CUSTODY: OpenCode memory (in-memory Map, not persisted)
    - modifiedFiles.set(sessionID, { files: Map<path, {type, timestamp}> })
```

### Phase 5: Component Annotation (Activity Complete)
```
[Activity Complete Hook]
repos/metabob-opencode/packages/opencode/src/session/activity-complete.ts:1-150
    ↓
[identifyKeyComponents() - extract from git diff]
activity-complete.ts:50-100
    ↓
[generateAnnotations() - create annotation records]
activity-complete.ts:100-150
    ↓
For each key component (max 5):
    [MetabobCLI.annotateComponent()]
    activity-complete.ts:146-150
        ↓
    [MCP Call: metabob_annotate_component]
    repos/metabob-opencode/packages/opencode/src/util/metabob.ts:400-450
        ↓
    HTTP Request to Metabob Backend:
        POST http://metabob-rpc-api:3000/mcp/call
        {
          tool: "annotate_component",
          args: {
            file_path: "src/auth.ts",
            component_name: "authenticate",
            component_type: "function",
            reason: "ACTIVITY: Fixed SQL injection by using parameterized queries..."
          }
        }
        ↓
STORED: Component annotation in Metabob backend
CUSTODY: Metabob Backend SurrealDB
    - component_annotations table
    - Linked to CPG component node
    - Searchable by file/component/reason
    - Used for future context retrieval
```

### Phase 6: Outcome Recording (Learning Loop)
```
[ActivityOutcomeRecorder.recordOutcome()]
repos/metabob-opencode/packages/opencode/src/session/activity-outcome-recorder.ts:150-600
    ↓
Collects:
    - Expectation (before execution):
        - expectedComponents: ["auth.ts", "users.ts"]
        - predictedCochanges: ["session.ts", "middleware.ts"]
        - expectedDurationMs: 60000
    - Comparison (after execution):
        - componentAccuracy: 0.75 (3/4 predicted correctly)
        - cochangeAccuracy: 0.50 (1/2 cochange files modified)
        - durationDeltaMs: +15000 (took longer than expected)
    - Decisions (during execution):
        - Array of agent decision points with reasoning
    - Quality validation:
        - intentPreserved: true
        - testResults: { passed: 15, failed: 0 }
        - codeQualityImpact: { issuesFixed: 3, issuesIntroduced: 0 }
    ↓
[MCP Call: metabob_record_outcome]
repos/metabob-opencode/packages/opencode/src/util/metabob.ts:500-550
    ↓
HTTP Request to Metabob Backend:
    POST http://metabob-rpc-api:3000/mcp/call
    {
      tool: "record_activity_outcome",
      args: { outcome: {...} }
    }
    ↓
STORED: Activity outcome in Metabob backend
CUSTODY: Metabob Backend SurrealDB
    - activity_outcomes table
    - Linked to template variants
    - Used for Thompson Sampling (template selection)
    - Used for template evolution (performance analysis)
```

### Phase 7: Component Usage Annotation (Post-Turn)
```
[Hook: session-memory-optimization, priority 110]
repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts:799-957
    ↓
After turn completes:
    - Optimizes session memory (unload stale, delete old)
    - Annotates loaded components with usage context
    ↓
[Component annotation loop]
turn-lifecycle-hooks.ts:856-923
    ↓
For each loaded impulse (where tokenCount > 0):
    If impulse is file/component:
        [MetabobCLI.annotateComponent()]
            file: impulse.pointer.path
            component: extracted from path
            reason: "SESSION MEMORY: Loaded {tokens} tokens\n
                     Priority: {priority}\n
                     Turn: {turnNumber}\n
                     Task: {promptText}\n
                     Load reason: {metadata.loadReason}\n
                     Context requirement: {metadata.requirement}"
        ↓
    [MCP Call: metabob_annotate_component]
        ↓
STORED: Component usage annotation in Metabob backend
CUSTODY: Metabob Backend SurrealDB
    - component_annotations table (usage tracking)
    - Captures: when component loaded, why, what task, priority
    - Used for: priority scoring, relevance ranking, usage patterns
```

### Phase 8: Feedback Loop (Next Session)
```
[Future Session - Same Component]
    ↓
[Hook: metabob-context-preparation]
    → Creates impulse: metabob-annotations-{ulid}
    ↓
[Custom Resolver: metabob-annotations]
repos/metabob-opencode/packages/opencode/src/session/system.ts:480-600
    ↓
[MetabobCLI.listFileComponents() - with annotations]
repos/metabob-opencode/packages/opencode/src/util/metabob.ts:300-350
    ↓
[MCP Call: metabob_list_file_components]
    ↓
RETRIEVED: Component with ALL historical annotations
CUSTODY: Metabob Backend SurrealDB
    - Annotations from past activities
    - Annotations from past session memory loads
    - Design decisions, constraints, alternatives
    ↓
LOADED: Agent receives component WITH historical context
    <session_memory>
        ### file: auth.ts (auth-component)
        Budget: 2500 tokens | Used: 2100 tokens
        ```
        // Component: authenticate()
        // 
        // HISTORY (3 annotations):
        // 1. ACTIVITY: Fixed SQL injection by using parameterized queries (2025-02-10)
        // 2. SESSION MEMORY: Loaded for security analysis task (2025-02-11)
        // 3. ACTIVITY: Added rate limiting to prevent brute force (2025-02-12)
        ```
    </session_memory>
    ↓
Agent makes INFORMED decisions based on historical context
```

---

## Data Storage Locations

### OpenCode Local Storage

**File**: `~/.local/share/opencode/{projectId}/opencode.db` (SQLite)

**Tables**:
- `sessions` - Session metadata (id, created, updated)
- `impulses` - Impulse records (id, sessionID, type, pointer, budget, priority)
- `session_memory_state` - Context space snapshots
- `activity_executions` - Activity execution logs (local, not synced)

**In-Memory State** (NOT persisted):
- `SessionContext.recentFiles` - Map<sessionID, Set<filePath>>
- `SessionContext.modifiedFiles` - Map<sessionID, Map<filePath, {type, timestamp}>>
- `SessionContext.currentPrompts` - Map<sessionID, string>
- `SessionContext.sessionMetadata` - Map<sessionID, {issuesSeen, analysesDone, patternsAsked}>

**Lifecycle**: Cleared on process restart, periodic cleanup (60s interval)

### Metabob Backend Storage

**Database**: SurrealDB at `metabob-rpc-api:3000`

**Tables**:
- `components` - CPG component nodes (file, name, type, dependencies)
- `component_annotations` - Annotation history (file, component, reason, timestamp, source)
- `issues` - Code quality issues (type, severity, file, line, status)
- `activity_outcomes` - Activity execution results (templateId, expectation, comparison, decisions)
- `activity_templates` - Template definitions + variants
- `cochange_embeddings` - File relationship vectors (768-dim)
- `cochange_pairs` - File pair co-change frequency

**Lifecycle**: Persistent, no automatic cleanup (managed by backend)

---

## Integration Points (File:Line References)

### 1. Session Context Tracking
**File**: `repos/metabob-opencode/packages/opencode/src/session/context.ts`
- **Line 58-87**: `trackFileAccess()` - Tracks file reads
- **Line 128-157**: `trackFileModification()` - Tracks file writes
- **Line 159-191**: `getModifiedFiles()` - Retrieves session modifications
- **Line 89-126**: `getActiveFiles()` - Retrieves recently accessed files

**Usage Sites**:
- File tool: Calls `trackFileAccess()` on read
- Write tool: Calls `trackFileModification()` on write
- Cochange prediction: Calls `getModifiedFiles()` to get changed files

### 2. Turn Lifecycle Integration
**File**: `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts`
- **Line 21-104**: Hook: activity-decision-reminder (priority 5)
- **Line 113-183**: Hook: session-memory-preparation (priority 10)
- **Line 204-302**: Hook: activity-recommendation-injection (priority 15)
- **Line 332-516**: Hook: metabob-context-preparation (priority 20)
- **Line 535-668**: Hook: boredom-task-suggestion (priority 25)
- **Line 676-766**: Hook: post-turn-cleanup (priority 100)
- **Line 799-957**: Hook: session-memory-optimization (priority 110)

**Key Lines**:
- **Line 369-388**: Creates `metabob-priorities` impulse
- **Line 391-411**: Creates `metabob-annotations` impulse (if enabled)
- **Line 414-435**: Creates `metabob-impact` impulse (if refactor)
- **Line 438-455**: Creates `metabob-related` impulse
- **Line 458-477**: Creates `metabob-recommendations` impulse
- **Line 856-923**: Annotates loaded components with usage context

### 3. Memory Agent (Intent Analysis)
**File**: `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`
- **Line 97-500**: `analyzeIntent()` - LLM-based intent analysis + impulse suggestions
- **Line 150-350**: System prompt for memory agent (routing logic)
- **Line 400-600**: Impulse creation from LLM suggestions

**Flow**:
1. User prompt → LLM analysis (Haiku)
2. LLM returns: intent type + suggested impulses
3. Create impulses via `SessionMemory.addImpulse()`
4. Impulses loaded by memory manager on next prompt build

### 4. Activity Complete (Component Annotation)
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-complete.ts`
- **Line 50-100**: `identifyKeyComponents()` - Extract components from git diff
- **Line 100-150**: `generateAnnotations()` - Create annotation records
- **Line 146-150**: `MetabobCLI.annotateComponent()` call

**Example**:
```typescript
await MetabobCLI.annotateComponent(
  "src/auth.ts",
  "authenticate",
  "function",
  "ACTIVITY: Fixed SQL injection using parameterized queries. Chose this over ORM for performance. Applied same pattern to 3 other files."
)
```

### 5. Outcome Recording
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-outcome-recorder.ts`
- **Line 43-89**: `ActivityOutcome` type definition
- **Line 135-150**: `discoverConfiguration()` - Auto-discover backend URL
- **Line 300-400**: `recordOutcome()` - Submit outcome to backend
- **Line 510-526**: Cochange accuracy calculation

**Outcome Structure**:
```typescript
{
  activityId: "act_01KHDK...",
  templateId: "fix-bug-complete",
  expectation: {
    expectedComponents: ["auth.ts", "session.ts"],
    predictedCochanges: ["middleware.ts"],
    expectedDurationMs: 60000
  },
  comparison: {
    componentAccuracy: 0.75,  // 3/4 correct
    cochangeAccuracy: 0.50,   // 1/2 cochanged
    durationDeltaMs: +15000   // Took 15s longer
  },
  decisions: [
    {
      step: 1,
      taskId: "fix-sql-injection",
      decision: "Use parameterized queries",
      reasoning: "Prevents SQL injection, standard practice",
      outcome: "success"
    }
  ]
}
```

### 6. System Prompt Integration
**File**: `repos/metabob-opencode/packages/opencode/src/session/system.ts`
- **Line 440-478**: `injectImpactWarnings()` - Inject change impact analysis
- **Line 480-600**: `injectComponentAnnotations()` - Inject historical annotations
- **Line 515-522**: Uses `SessionContext.getModifiedFiles()` to get active work area

**Call Chain**:
```
SystemPrompt.build()
  → injectComponentAnnotations()
    → SessionContext.getModifiedFiles(sessionID, { onlyWrites: true })
    → SessionContext.getActiveFiles(sessionID, { limit: 5 })
    → MetabobCLI.listFileComponents(filePath, sessionID)
      → MCP call: metabob_list_file_components
        → Returns: components WITH annotations
```

### 7. MCP Integration Layer
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`
- **Line 100-150**: `getPriorityIssues()` - Wrapper for MCP call
- **Line 200-250**: `annotateComponent()` - Wrapper for MCP call
- **Line 300-350**: `listFileComponents()` - Wrapper for MCP call
- **Line 400-450**: `suggestRelatedChanges()` - Wrapper for MCP call

**File**: `repos/metabob-opencode/packages/opencode/src/mcp/index.ts`
- **Line 245-263**: MCP client transport (SSE/StreamableHTTP)
- **Line 300-350**: `callMCPTool()` - Generic MCP tool invocation

---

## Example: Complete Lifecycle of Component Annotation

### Scenario: Fix SQL Injection Bug

**Turn 1: User Reports Issue**
```
User: "Fix the SQL injection in auth.ts"
```

**Phase 1: Intent Analysis**
```typescript
// SessionMemoryAgent.analyzeIntent()
// File: memory-agent.ts:97-500

{
  type: "code_fix",
  confidence: 0.95,
  reasoning: "User reports security issue with specific file",
  suggestedImpulses: [
    {
      id: "errorFile",
      type: "file",
      description: "File containing the vulnerability",
      priority: "high",
      budget: 2500,
      pointer: { type: "file", path: "src/auth.ts" }
    }
  ]
}
```

**Phase 2: Metabob Context Injection**
```typescript
// Hook: metabob-context-preparation
// File: turn-lifecycle-hooks.ts:332-516

// Creates impulses:
{
  id: "metabob-priorities-01KHDK...",
  type: "memo",
  pointer: { 
    type: "custom", 
    resolver: "metabob-priorities",
    data: { sessionID, intent, agentConfig }
  },
  budget: 2000,
  priority: "high"
}
```

**Phase 3: Impulse Loading**
```typescript
// SessionMemoryManager.loadImpulses()
// File: memory-manager.ts:200-400

// Resolver calls:
const issues = await MetabobCLI.getPriorityIssues()
// Returns:
[
  {
    id: "iss_sql_injection_auth",
    severity: "HIGH",
    type: "security",
    file: "src/auth.ts",
    line: 42,
    message: "SQL injection vulnerability",
    description: "String concatenation in SQL query"
  }
]

// Loaded into impulse:
impulse.content = "⚠️ 1 HIGH priority issue:\n[Security] SQL injection in auth.ts:42..."
impulse.tokenCount = 800
impulse.lastUsed = 1
```

**Phase 4: Agent Receives Context**
```xml
<session_memory>

## High Priority Context

### memo: Priority code issues (metabob-priorities-01KHDK...)
Budget: 2000 tokens | Used: 800 tokens
```
⚠️ 1 HIGH priority issue:
[Security] SQL injection in auth.ts:42
String concatenation in SQL query
```

</session_memory>
```

**Phase 5: Agent Fixes Bug**
```typescript
// Agent writes code
// SessionContext.trackFileModification() called
// File: context.ts:128-157

SessionContext.trackFileModification(
  "ses_abc123",
  "src/auth.ts",
  "write"
)

// Stored in memory:
modifiedFiles.set("ses_abc123", {
  files: Map([
    ["src/auth.ts", { type: "write", timestamp: 1739491200000 }]
  ])
})
```

**Phase 6: Activity Completes - Component Annotation**
```typescript
// Activity complete hook
// File: activity-complete.ts:1-150

// 1. Identify key components from git diff
const components = identifyKeyComponents(gitDiff)
// Returns: [{ file: "src/auth.ts", component: "authenticate", type: "function" }]

// 2. Generate annotations
for (const comp of components) {
  await MetabobCLI.annotateComponent(
    comp.file,
    comp.component,
    comp.type,
    `ACTIVITY: Fixed SQL injection by using parameterized queries.
     
     Before: query = "SELECT * FROM users WHERE id = " + userId
     After: query = "SELECT * FROM users WHERE id = ?"
     
     Why: Prevents SQL injection, standard security practice
     Alternatives considered: ORM (rejected - performance critical)
     Applied same pattern to 3 other auth functions.`
  )
}

// 3. MCP call to backend
// MCP transport: HTTP POST to metabob-rpc-api:3000
{
  tool: "annotate_component",
  args: {
    file_path: "src/auth.ts",
    component_name: "authenticate",
    component_type: "function",
    reason: "ACTIVITY: Fixed SQL injection..."
  }
}

// 4. Stored in Metabob backend SurrealDB
INSERT INTO component_annotations {
  id: "ann_01KHDK...",
  file: "src/auth.ts",
  component: "authenticate",
  component_type: "function",
  reason: "ACTIVITY: Fixed SQL injection...",
  timestamp: "2025-02-10T10:30:00Z",
  source: "activity",
  sessionID: "ses_abc123",
  activityID: "act_01KHDK..."
}
```

**Phase 7: Post-Turn - Usage Annotation**
```typescript
// Hook: session-memory-optimization
// File: turn-lifecycle-hooks.ts:856-923

// After turn completes, annotate loaded components
const impulses = await SessionMemory.listImpulses(sessionID)

for (const imp of impulses) {
  if (imp.tokenCount > 0 && imp.pointer.type === "file") {
    await MetabobCLI.annotateComponent(
      imp.pointer.path,  // "src/auth.ts"
      extractComponent(imp.pointer.path),  // "auth"
      "file",
      `SESSION MEMORY: Loaded 800 tokens
       Priority: high
       Turn: 1
       Task: Fix the SQL injection in auth.ts
       Load reason: Priority issue in active work area
       Context requirement: Security analysis`
    )
  }
}

// Stored in Metabob backend:
INSERT INTO component_annotations {
  id: "ann_usage_01KHDK...",
  file: "src/auth.ts",
  component: "auth",
  component_type: "file",
  reason: "SESSION MEMORY: Loaded 800 tokens...",
  timestamp: "2025-02-10T10:31:00Z",
  source: "session_memory",
  sessionID: "ses_abc123"
}
```

**Turn 2: Future Reference (Days Later)**
```
User: "Add rate limiting to auth"
```

**Phase 1: Component Annotations Retrieved**
```typescript
// Hook: metabob-context-preparation
// Creates impulse: metabob-annotations-{ulid}

// Resolver: metabob-annotations
const components = await MetabobCLI.listFileComponents("src/auth.ts", sessionID)

// Backend query:
SELECT * FROM component_annotations
WHERE file = "src/auth.ts"
ORDER BY timestamp DESC

// Returns 2 annotations:
[
  {
    id: "ann_01KHDK...",
    component: "authenticate",
    reason: "ACTIVITY: Fixed SQL injection by using parameterized queries...",
    timestamp: "2025-02-10T10:30:00Z",
    source: "activity"
  },
  {
    id: "ann_usage_01KHDK...",
    component: "auth",
    reason: "SESSION MEMORY: Loaded 800 tokens...",
    timestamp: "2025-02-10T10:31:00Z",
    source: "session_memory"
  }
]
```

**Phase 2: Agent Receives Historical Context**
```xml
<session_memory>

## High Priority Context

### file: auth.ts (auth-security-context)
Budget: 2500 tokens | Used: 2100 tokens
```typescript
// src/auth.ts

export function authenticate(userId: string) {
  // Uses parameterized query to prevent SQL injection
  const query = "SELECT * FROM users WHERE id = ?"
  return db.execute(query, [userId])
}

// HISTORY (2 annotations):
//
// 1. ACTIVITY: Fixed SQL injection (2025-02-10)
//    - Before: String concatenation in query
//    - After: Parameterized queries
//    - Why: Security best practice
//    - Applied to 3 other auth functions
//
// 2. SESSION MEMORY: Security analysis (2025-02-10)
//    - Loaded for: Fix SQL injection task
//    - Priority: HIGH
//    - Result: Issue resolved
```

</session_memory>
```

**Phase 3: Agent Makes Informed Decision**
```typescript
// Agent sees historical context:
// - SQL injection was fixed recently
// - Parameterized queries are used
// - Security is important for this component
//
// Agent adds rate limiting WITHOUT breaking existing security fix
// Preserves parameterized query pattern
// Adds rate limiting as separate concern
```

---

## Key Architectural Insights

### 1. Custody is Distributed
- **OpenCode**: Owns session state, activity metadata, impulse lifecycle
- **Metabob Backend**: Owns component annotations, outcomes, CPG, embeddings
- **Sync**: Real-time via MCP + async outcome recording

### 2. Data Flows Bidirectionally
**Forward Flow** (User → Backend):
- User intent → Session context → Impulses → Metabob queries → Backend storage

**Reverse Flow** (Backend → Agent):
- Backend storage → MCP responses → Impulse content → Agent context → Informed decisions

### 3. Three Types of Annotations
1. **Activity Annotations** (WHY component changed)
   - Source: Activity complete hook
   - Content: Design decisions, alternatives, constraints
   - Purpose: Preserve reasoning for future modifications

2. **Session Memory Annotations** (HOW component used)
   - Source: Post-turn optimization hook
   - Content: Load reason, priority, task context
   - Purpose: Track usage patterns, relevance scoring

3. **Manual Annotations** (DOMAIN knowledge)
   - Source: Developer via CLI/API
   - Content: Architecture notes, gotchas, requirements
   - Purpose: Human expertise capture

### 4. Feedback Loop is Automatic
- No manual "save annotations" step required
- Every component usage → annotated automatically
- Every activity completion → outcomes recorded
- Every session → contributes to learning

### 5. Storage is Optimized
**In-Memory (Fast, Ephemeral)**:
- Session file tracking (cleared on restart)
- Impulse resolution cache (turn-scoped)
- Agent context (per-turn)

**SQLite (Fast, Local, Persistent)**:
- Impulse metadata (id, pointer, budget)
- Session records (basic info)
- Activity execution logs (local only)

**SurrealDB (Distributed, Permanent, Queryable)**:
- Component annotations (full history)
- Activity outcomes (learning data)
- CPG + embeddings (structural analysis)

---

## Usage Examples

### Example 1: Query Component History
```bash
# Find all annotations for a component
opencode metabob list-annotations \
  --file src/auth.ts \
  --component authenticate

# Output:
# 3 annotations found:
#
# 1. ACTIVITY: Fixed SQL injection (2025-02-10)
#    - Used parameterized queries
#    - Applied to 3 functions
#
# 2. SESSION MEMORY: Security analysis (2025-02-10)
#    - Loaded for SQL injection fix
#    - Priority: HIGH
#
# 3. ACTIVITY: Added rate limiting (2025-02-12)
#    - Prevents brute force attacks
#    - 5 attempts per minute limit
```

### Example 2: Track Session Activity
```typescript
// Get all files modified in session
const files = SessionContext.getModifiedFiles(sessionID, {
  maxAge: 3600000,  // 1 hour
  onlyWrites: true  // Only write operations
})

// Returns:
[
  "src/auth.ts",
  "src/middleware.ts",
  "test/auth.test.ts"
]

// Get active files (reads + writes)
const active = SessionContext.getActiveFiles(sessionID, {
  maxAge: 3600000,
  limit: 10
})

// Returns (most recent first):
[
  "src/auth.ts",
  "src/session.ts",
  "src/middleware.ts",
  "package.json",
  "test/auth.test.ts"
]
```

### Example 3: Retrieve Priority Issues
```typescript
// Get priority issues for current session
const issues = await MetabobCLI.getPriorityIssues()

// Returns (max 5, MEDIUM+ severity):
[
  {
    id: "iss_sql_injection_auth",
    severity: "HIGH",
    type: "security",
    file: "src/auth.ts",
    line: 42,
    message: "SQL injection vulnerability"
  },
  {
    id: "iss_n_plus_one_users",
    severity: "MEDIUM",
    type: "performance",
    file: "src/users.ts",
    line: 156,
    message: "N+1 query pattern detected"
  }
]
```

### Example 4: Record Activity Outcome
```typescript
// After activity completes
await ActivityOutcomeRecorder.recordOutcome({
  activityId: "act_01KHDK...",
  templateId: "fix-bug-complete",
  expectation: {
    expectedComponents: ["auth.ts", "session.ts"],
    predictedCochanges: ["middleware.ts"],
    expectedDurationMs: 60000
  },
  comparison: {
    componentAccuracy: 0.75,      // 3/4 files predicted correctly
    cochangeAccuracy: 0.50,       // 1/2 cochange files modified
    durationDeltaMs: +15000,      // Took 15s longer than expected
    costDelta: +0.05              // Cost $0.05 more than expected
  },
  decisions: [
    {
      step: 1,
      taskId: "fix-sql-injection",
      context: "Found SQL injection in authenticate()",
      decision: "Use parameterized queries",
      reasoning: "Standard security practice, prevents injection",
      outcome: "success",
      timestamp: new Date()
    }
  ]
})

// Outcome used for:
// - Thompson Sampling (template selection)
// - Template evolution (performance analysis)
// - Cochange accuracy tracking
// - Cost prediction improvement
```

---

## Configuration

### OpenCode Configuration
**File**: `~/.config/opencode/config.json`

```json
{
  "sessionMemory": {
    "enabled": true,
    "defaultBudget": 50000,
    "utilizationThreshold": 0.85
  },
  "metabob": {
    "enabled": true,
    "auto_inject": true,
    "inject_annotations": true,
    "auto_impact_analysis": true,
    "max_issues": 5,
    "min_severity": "MEDIUM"
  }
}
```

### MCP Configuration
**File**: `~/.config/opencode/mcp.json`

```json
{
  "clients": {
    "metabob": {
      "type": "remote",
      "url": "http://metabob-rpc-api:3000/mcp",
      "enabled": true,
      "transport": "sse"
    }
  }
}
```

---

## Performance Characteristics

### Impulse Loading
- **Discovery** (metadata fetch): 5-10ms
- **Resolution** (content fetch): 50-250ms per impulse
  - File pointer: 10-50ms (local disk read)
  - MCP call: 100-200ms (network + backend query)
  - Custom resolver: 50-150ms (depends on complexity)
- **Total per turn**: 200-800ms (4-5 impulses loaded)

### Component Annotation
- **Write operation**: 50-150ms per annotation
- **Async**: Non-blocking (fire-and-forget)
- **Batch**: Can batch 10+ annotations in single MCP call

### Outcome Recording
- **Write operation**: 200-500ms per outcome
- **Async**: Background submission (doesn't block activity complete)
- **Retry**: Exponential backoff (3 retries max)

### Session Context Tracking
- **trackFileModification**: <1ms (in-memory Map operation)
- **getModifiedFiles**: <5ms (filter + sort Map entries)
- **Memory overhead**: ~0.2KB per file per session

---

## Monitoring & Debugging

### Session Memory Stats
```typescript
// Get memory statistics
const stats = SessionContext.getMemoryStats()

// Returns:
{
  sessions: 5,
  recentFiles: 50,
  modifiedFiles: 25,
  prompts: 5,
  metadata: 5,
  fileTimeEntries: 30,
  estimatedMemoryKB: 15  // ~15KB total
}
```

### Impulse State
```typescript
// Get session state (includes impulse stats)
const state = await SessionState.get(sessionID)

// Returns:
{
  impulses: {
    impulseCount: 10,
    loadedCount: 5,
    unloadedCount: 5,
    usedTokens: 8500,
    totalBudget: 50000,
    utilization: 17.0  // 17% utilization
  }
}
```

### Turn Lifecycle Hooks
```typescript
// Check hook execution times
// Logs emitted by TurnLifecycle system

// Example log:
{
  "level": "info",
  "service": "turn-lifecycle",
  "message": "hook completed",
  "hook": "metabob-context-preparation",
  "priority": 20,
  "duration": 150,
  "success": true,
  "modified": true,
  "metadata": {
    "impulsesCreated": 5
  }
}
```

---

## Troubleshooting

### Issue: Impulses Not Loading
**Symptoms**: Agent has no Metabob context in `<session_memory>`

**Check**:
1. Is MCP client connected?
   ```bash
   opencode mcp status
   ```
2. Is metabob-context-preparation hook enabled?
   ```bash
   opencode config get sessionMemory.enabled
   ```
3. Is budget available?
   ```typescript
   const space = await SessionMemoryManager.getContextSpace(sessionID)
   console.log(space.stats.utilization)  // Should be < 85%
   ```

**Fix**:
- Enable MCP client: `opencode mcp enable metabob`
- Increase budget: `opencode config set sessionMemory.defaultBudget 100000`
- Unload stale impulses: Happens automatically in post-turn hook

### Issue: Annotations Not Persisting
**Symptoms**: Component annotations disappear after restart

**Check**:
1. Is Metabob backend reachable?
   ```bash
   curl http://metabob-rpc-api:3000/health
   ```
2. Are MCP calls succeeding?
   ```bash
   tail -f ~/.local/share/opencode/log/dev.log | grep annotate_component
   ```

**Fix**:
- Check backend health: `docker ps | grep metabob-rpc-api`
- Restart backend: `docker-compose restart metabob-rpc-api`
- Check network: Ensure containers can communicate

### Issue: Session Context Empty
**Symptoms**: `SessionContext.getModifiedFiles()` returns empty array

**Check**:
1. Are file operations tracked?
   ```typescript
   // Should be called on every write
   SessionContext.trackFileModification(sessionID, filePath, "write")
   ```
2. Is session too old?
   ```typescript
   // Default maxAge is 1 hour
   const files = SessionContext.getModifiedFiles(sessionID, { maxAge: 7200000 })  // 2 hours
   ```

**Fix**:
- Ensure write tool calls `trackFileModification()`
- Increase maxAge parameter
- Check cleanup interval (runs every 60s)

---

## Future Enhancements

### Planned Features

1. **Persistent Session Context**
   - Store modified files in SQLite (currently in-memory)
   - Survive process restarts
   - Query across sessions

2. **Component Usage Analytics**
   - Track load frequency per component
   - Identify hot/cold components
   - Optimize budget allocation

3. **Annotation Search**
   - Full-text search across annotations
   - Filter by source (activity/session/manual)
   - Timeline visualization

4. **Outcome Aggregation**
   - Template performance dashboard
   - Cochange accuracy trends
   - Cost optimization insights

5. **Real-time Cochange**
   - Predict next file modifications in real-time
   - Proactive context loading
   - Adaptive budget allocation

---

## Summary: The 6 Questions - Complete Answers

### 1. How do we attach task/execution history/intent to components?
**Answer**: Via `metabob_annotate_component` MCP tool called at:
- Activity complete (line 146-150 in `activity-complete.ts`)
- Post-turn optimization (line 856-923 in `turn-lifecycle-hooks.ts`)

**Storage**: Metabob backend SurrealDB `component_annotations` table

### 2. How can we scan using the activity system?
**Answer**: Turn lifecycle hooks inject Metabob context impulses before each turn:
- Hook: `metabob-context-preparation` (priority 20, lines 332-516)
- Creates 5 impulse types: priorities, annotations, impact, related, recommendations
- Memory agent loads impulses based on budget + priority

### 3. How do we feed information back via impulse system?
**Answer**: Post-turn hook annotates loaded components:
- Hook: `session-memory-optimization` (priority 110, lines 856-923)
- For each loaded impulse → annotate component with usage context
- Backend stores annotation → available for future sessions

### 4. What is the custody of data?
**Answer**: Distributed custody:
- **OpenCode**: Session state (SQLite + in-memory Maps)
- **Metabob Backend**: Annotations, outcomes, CPG (SurrealDB)
- **Sync**: Real-time MCP calls + async outcome recording

### 5. How does the activity system interact with this?
**Answer**: Three integration points:
1. Activity start: Expectations recorded
2. Activity complete: Annotations created + outcomes recorded
3. Turn lifecycle: Component usage tracked + annotated

### 6. How do we collect information from sessions?
**Answer**: SessionContext module (in-memory tracking):
- `trackFileModification()` - Called on every file write
- `getModifiedFiles()` - Retrieves session modifications
- `getActiveFiles()` - Retrieves recently accessed files
- Used by cochange prediction, context enrichment, impact analysis

---

## Conclusion

The Activity System ↔ Metabob data flow is a **closed-loop learning system**:

1. **User intent** → Session context tracked
2. **Context impulses** → Metabob data loaded
3. **Agent execution** → Components modified
4. **Activity complete** → Annotations + outcomes recorded
5. **Post-turn** → Component usage annotated
6. **Future sessions** → Historical context available

**Result**: Every interaction contributes to institutional knowledge, making the system smarter over time.

**Key Innovation**: Automatic annotation of component usage (lines 856-923) ensures no human effort required - the system learns from its own activity.
