# Activity-First TUI Session Interactions - Data Flow

**Feature**: activity-first-tui-session-interactions  
**Purpose**: Enforce activity-based execution for complex TUI user requests  
**Last Updated**: 2026-03-18  
**Status**: ✅ Implemented

---

## Overview

This flow ensures that all complex user requests in the TUI are routed through the activity system, enabling:
- **Consistency**: Standardized execution pathway for multi-step tasks
- **Tracking**: Full observability of user interactions and outcomes
- **Reusability**: Complex workflows captured as templates for future use
- **Learning Loop Integration**: Metrics and patterns feed back into recommendation engine

**Key Principle**: Simple tasks (≤8 tool calls) execute directly; complex tasks (>8 tool calls) MUST use activities.

---

## Complete Flow Diagram

```mermaid
graph TD
    %% Entry Point
    A[TUI User Input<br/>prompt.input + parts] -->|User submits| B[submit\(\) Handler<br/>tui/component/prompt/index.tsx:389]
    
    %% HTTP Boundary
    B -->|HTTP POST<br/>/session/:id/message| C[Hono Route Handler<br/>server/server.ts:1144]
    C -->|Zod Validation<br/>PromptInput schema| D[SessionPrompt.prompt\(\)<br/>session/prompt.ts:515]
    
    %% Enforcement Decision Path
    D -->|Extract prompt text| E{Is Activity<br/>Command?}
    E -->|Yes| F[Skip Enforcement<br/>Already using activity]
    E -->|No| G[extractTaskScope\(\)<br/>system.ts:120]
    
    G -->|TaskScope| H[MetabobCLI.getPriorityIssues\(\)<br/>util/metabob.ts]
    H -->|issues array<br/>best-effort| I[assessComplexity\(\)<br/>recommendation-engine.ts:86]
    
    I -->|ComplexityAssessment| J{estimatedToolCalls<br/>> 8?}
    
    %% Simple Task Path
    J -->|No ≤8 tools| K[No Enforcement<br/>All tools available]
    K -->|tools object| L[LLM API Call<br/>Full tool access]
    L -->|Direct execution| M[Tool Results]
    
    %% Complex Task Path (Enforced)
    J -->|Yes >8 tools| N[enforce\(\)<br/>activity-enforcement-gate.ts:65]
    N -->|EnforcementDecision<br/>enforced=true| O[getEnforcementContext\(\)<br/>Generate system prompt]
    O -->|enforcement context| P[Inject into System Prompt]
    
    P -->|system + context| Q[resolveTools\(\)<br/>Filter tool registry<br/>prompt.ts:919]
    Q -->|Restricted tools<br/>activity + core only| R[LLM API Call<br/>Limited tool access]
    
    R -->|LLM must use<br/>activity tool| S[activity tool call<br/>tool/activity.ts:425]
    
    %% Activity Execution
    S -->|templateId + variables| T[Select Template<br/>Thompson Sampling]
    T -->|Template schema| U[Validate Variables<br/>activity-template.ts:1751]
    U -->|Valid variables| V[Create Activity Session<br/>Activity.Info]
    
    V -->|activity info| W[executeTemplate\(\)<br/>tool/activity.ts:2400]
    W -->|For each task| X[TrailblazingExecutor<br/>session/trailblazing-executor.ts:63]
    
    X -->|Load impulses<br/>Interpolate prompt| Y[TaskTool.execute\(\)<br/>tool/task.ts]
    Y -->|Create sub-session| Z[SessionPrompt.prompt\(\)<br/>RECURSIVE<br/>No enforcement]
    
    Z -->|Full tools available| AA[Task Execution<br/>edit, write, bash, etc.]
    AA -->|Task result| AB[Validate Output<br/>Run validation commands]
    
    AB -->|success/failure| AC{More tasks?}
    AC -->|Yes| X
    AC -->|No| AD[Activity Complete<br/>Aggregate metrics]
    
    %% Exit Points
    F -->|Regular flow| L
    M -->|Response| AE[Return to TUI<br/>Display result]
    AD -->|Activity result| AE
    
    %% Storage
    V -.->|Write| AF[(Storage<br/>activity/*.json)]
    Z -.->|Write| AG[(Storage<br/>session/*.json)]
    AB -.->|Write| AH[(Storage<br/>message/*.json)]
    
    %% External Services
    H -.->|MCP call<br/>10s timeout| AI[Metabob MCP<br/>External Service]
    
    %% Styling
    classDef entryPoint fill:#e1f5ff,stroke:#0066cc,stroke-width:2px
    classDef exitPoint fill:#ffe1e1,stroke:#cc0000,stroke-width:2px
    classDef enforcement fill:#fff4e1,stroke:#ff9900,stroke-width:2px
    classDef decision fill:#f0e1ff,stroke:#9900cc,stroke-width:2px
    classDef storage fill:#e1ffe1,stroke:#00cc00,stroke-width:2px
    classDef external fill:#ffe1f0,stroke:#cc0066,stroke-width:2px
    
    class A entryPoint
    class AE exitPoint
    class N,O,P,Q enforcement
    class E,J,AC decision
    class AF,AG,AH storage
    class AI external
```

---

## Data Flow Summary

### Entry Point
**Location**: `repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx:389`  
**Format**: React UI state → HTTP request body
```typescript
Input: {
  prompt.input: string,           // User text
  parts: Array<Part>,             // File/agent references
  extmarkToPartIndex: Map<number, number>  // Pasted content mapping
}

Transform: Expand pasted content inline, filter duplicates

Output: HTTP POST /session/:id/message
{
  parts: [
    { type: "text", text: expandedInput },
    ...fileAndAgentParts
  ],
  agent?: string,
  messageID: string
}
```

**Boundary Crossed**: TUI (React) → HTTP API (Hono)  
**Validation**: Non-empty input, session exists

---

### Transformation 1: HTTP → PromptInput
**Location**: `server/server.ts:1144 → session/prompt.ts:265`  
**Format**: HTTP body → Zod-validated schema
```typescript
Input: HTTP request body (JSON)

Validation: SessionPrompt.PromptInput schema
- sessionID: Identifier.schema("session")
- parts: Array<TextPart | FilePart | AgentPart>  // Discriminated union
- agent?: string
- model?: { providerID, modelID }
- tools?: Record<string, boolean>

Output: PromptInput (type-safe)
```

**Boundary Crossed**: HTTP layer → Business logic  
**Validation**: Zod schema, 400 error on failure

---

### Transformation 2: User Prompt → TaskScope
**Location**: `session/prompt.ts:515 → session/system.ts:120`  
**Format**: Free-form text → Structured task context
```typescript
Input: User prompt text (string)

Transform: extractTaskScope()
1. Extract files via regex (quoted, unquoted, with extensions)
2. Filter false positives (URLs)
3. Analyze keywords (fix, refactor, test, add, create)
4. Determine task type with confidence scoring
5. Detect implicit file references ("current work")

Output: TaskScope {
  mentionedFiles: string[],
  mentionedComponents: string[],
  directories: Set<string>,
  taskType: "feature" | "bugfix" | "refactor" | "test" | "docs",
  keywords: { refactor, fix, test, pattern, change, modify },
  includeModifiedFiles: boolean
}
```

**Boundary Crossed**: User intent → Structured data  
**Validation**: Regex patterns, confidence threshold (0.5-0.9)

---

### Transformation 3: TaskScope → ComplexityAssessment
**Location**: `session/system.ts:120 → recommendation-engine.ts:86`  
**Format**: Task context + issues → Estimated tool calls
```typescript
Input: {
  taskScope: TaskScope,
  issues: MetabobIssue[],  // Best-effort from MCP
  relatedFiles: string[],
  sessionID: string
}

Transform: assessComplexity()
1. Base: 2 tool calls (read + execute)
2. Add: 2 per file (read + edit)
3. Add: 3 per HIGH severity issue (analyze + fix + verify)
4. Add: 5 if refactor task
5. Add: 3 if test task
6. Calculate: requiresActivity = (total > 8)

Output: ComplexityAssessment {
  estimatedToolCalls: number,
  complexity: "low" | "medium" | "high",
  requiresActivity: boolean,  // TRUE if > 8 tool calls
  reasons: string[]           // Explanation of estimate
}
```

**Boundary Crossed**: Task analysis → Policy decision  
**Validation**: Integer constraints, threshold check (8 tools)

---

### Transformation 4: ComplexityAssessment → EnforcementDecision
**Location**: `recommendation-engine.ts:134 → activity-enforcement-gate.ts:65`  
**Format**: Complexity estimate → Tool access control list
```typescript
Input: {
  complexity: ComplexityAssessment,
  allTools: string[]  // All available tool names
}

Transform: enforce()
IF requiresActivity = false:
  return { enforced: false, allowedTools: allTools }
ELSE:
  Filter tools to allowlist:
    - Activity tools: activity, search_activities, create_activity_goal_seeking, etc.
    - Core tools: read, list, grep, glob, invalid
  return { enforced: true, allowedTools: filteredTools }

Output: EnforcementDecision {
  enforced: boolean,
  allowedTools: string[],  // 9 activity + 5 core = 14 tools (if enforced)
  reason: string,          // User-facing explanation
  complexity: ComplexityAssessment
}
```

**Boundary Crossed**: Business logic → Access control  
**Validation**: Allowlist check, logging for audit

---

### Transformation 5: EnforcementDecision → System Prompt Injection
**Location**: `activity-enforcement-gate.ts:114 → prompt.ts:562`  
**Format**: Enforcement decision → LLM instructions
```typescript
Input: EnforcementDecision (enforced = true)

Transform: getEnforcementContext()
Generate markdown text:
## Activity-First Enforcement
This task has been assessed as **complex** (estimated N tool calls).

**Tool Access Restricted**: You have access only to activity-related tools:
- search_activities - Find existing activity templates
- activity - Execute an activity template
- create_activity_goal_seeking - Create new activity from goal

**Required Workflow**:
1. Search for relevant activities using search_activities
2. If suitable template exists, execute it with the activity tool
3. If no template fits, create one with create_activity_goal_seeking
4. Direct tool execution is NOT available for this task

**Reason**: [enforcement reason]

Output: system prompt context (string)
```

**Boundary Crossed**: Policy → LLM guidance  
**Validation**: None (pure transformation)

---

### Transformation 6: EnforcementDecision → Filtered Tool Registry
**Location**: `prompt.ts:919 → LLM API`  
**Format**: Tool allowlist → Tool definitions object
```typescript
Input: {
  enforcementDecision: EnforcementDecision,
  allTools: ToolDefinition[]  // From ToolRegistry
}

Transform: resolveTools()
allowedSet = new Set(enforcementDecision.allowedTools)

FOR EACH tool IN allTools:
  IF enforcementDecision.enforced AND tool.id NOT IN allowedSet:
    SKIP (blocked by enforcement gate)
  IF input.tools[tool.id] === false:
    SKIP (user disabled)
  ELSE:
    tools[tool.id] = await tool.init()

Output: tools object
{
  activity: { description, parameters, execute },
  search_activities: { ... },
  read: { ... },
  // edit, write, bash NOT included (blocked)
}
```

**Boundary Crossed**: Tool registry → LLM API payload  
**Validation**: Enforcement check per tool, logging blocked tools

---

### Transformation 7: Activity Tool Call → Template Variables
**Location**: `tool/activity.ts:425 → activity-template.ts:1751`  
**Format**: LLM arguments → Validated template variables
```typescript
Input: {
  templateId: string,
  variables: Record<string, unknown>,
  reason: string,
  trailblazing?: TrailblazingOptions
}

Transform: Validate variables
1. Collect expected variables from template tasks
2. Check required variables present
3. Check for unexpected variables (typos)
4. Fuzzy match suggestions (Levenshtein distance)
5. Type validation (string, number, boolean)

Output: Validated variables
Record<string, unknown>  // Guaranteed to have all required fields

Error: ActivityValidationError with suggestions
```

**Boundary Crossed**: LLM output → Template execution  
**Validation**: Required check, type check, fuzzy matching

---

### Transformation 8: Template Variables → Interpolated Prompt
**Location**: `activity-template.ts:1666 → trailblazing-executor.ts:63`  
**Format**: Template string + variables → Executable prompt
```typescript
Input: {
  template: "Fix {{vulnerabilityType}} in {{file}}",
  variables: { vulnerabilityType: "SQL injection", file: "database.ts" },
  options: { activityId, repoRoot }
}

Transform: interpolatePrompt()
1. Add built-in variables (ACTIVITY_TEMP_DIR, REPO_ROOT, ACTIVITY_ID)
2. Merge user variables (override built-in)
3. Sanitize values (prevent shell injection)
4. Replace {{variable}} placeholders with sanitized values
5. Check for missing variables (excluding code blocks)

Output: Interpolated prompt (string)
"Fix SQL injection in database.ts"
```

**Boundary Crossed**: Template → Execution  
**Validation**: Sanitization, missing variable check

**Security**: Sanitization escapes shell metacharacters (backticks, $(), pipes, etc.)

---

### Transformation 9: Interpolated Prompt → Task Execution
**Location**: `trailblazing-executor.ts:200 → tool/task.ts → prompt.ts:515`  
**Format**: Task prompt → Sub-session creation
```typescript
Input: {
  task: { id, description, prompt, subagent },
  variables: Record<string, unknown>,
  sessionID: string,  // Activity session (parent)
  trailblazingOptions: { maxCostPerTask, maxRecoveryAttempts }
}

Transform: executeTaskWithTrailblazing()
1. Load impulses (if task references them)
2. Enrich variables with impulse metadata
3. Interpolate task prompt template
4. Inject impulse content into prompt
5. Inject calling agent reason
6. Create NEW sub-session (Session.create)
7. Call SessionPrompt.prompt() RECURSIVELY
   - NO enforcement (already inside activity)
   - Full tool access (edit, write, bash)

Output: TaskResult {
  success: boolean,
  attempts: number,
  duration: number,
  cost: number,
  tokens: { input, output, cache },
  recoveryAttempts?: number
}
```

**Boundary Crossed**: Task prompt → Recursive session  
**Validation**: Impulse budget, trailblazing cost limits

**CRITICAL**: Task sessions have NO enforcement (full tool access)

---

### Exit Point 1: Direct Execution (Simple Tasks)
**Location**: `prompt.ts:595 → TUI`  
**Format**: LLM response → User display
```typescript
Input: LLM API response {
  message: { role: "assistant", content: [...], tool_calls: [...] }
}

Transform: Process tool calls, return message

Output: Assistant message
{
  id: messageID,
  role: "assistant",
  parts: [{ type: "text", text: "..." }],
  time: { created, updated }
}

Storage: message/{sessionID}/{messageID}.json
```

**Boundary Crossed**: Business logic → HTTP API → TUI  
**Side Effects**: Message stored, session state updated

---

### Exit Point 2: Activity Execution (Complex Tasks)
**Location**: `tool/activity.ts:2400 → Storage`  
**Format**: Activity result → Persistent storage
```typescript
Input: Activity execution state {
  activity: Activity.Info,
  taskResults: TaskResult[],
  totalCost: number,
  totalTokens: { input, output, cache }
}

Transform: Aggregate results
1. Mark activity as "done" or "failed"
2. Set completedAt timestamp
3. Calculate total cost, tokens, duration
4. Capture final git commit
5. Store activity info

Output: Activity.Info (persisted)
{
  id: activityId,
  templateId: string,
  status: "done" | "failed",
  stats: { cost: { total, ... }, tokens: { ... }, duration },
  startedAt: timestamp,
  completedAt: timestamp,
  tasks: { [taskId]: TaskResult },
  error?: string
}

Storage: activity/{activityId}.json
```

**Boundary Crossed**: Business logic → File system  
**Side Effects**: Activity stored, session messages stored, git commits recorded

---

## Architectural Boundaries

### 1. Package Boundary: TUI ↔ SDK
**Type**: Repository boundary  
**Contract**: `OpencodeClient` interface from `@opencode-ai/sdk`  
**Coupling**: Loose (one-way dependency, versioned package)  
**Resilience**: SDK handles HTTP errors, TUI shows toast notifications

---

### 2. Service Boundary: HTTP Server ↔ Session Logic
**Type**: Internal service boundary  
**Contract**: Zod-validated `PromptInput` schema  
**Coupling**: Medium (direct function call, shared types)  
**Resilience**: Zod validation (400 errors), error propagation to HTTP layer

---

### 3. Service Boundary: MetabobCLI ↔ MCP Server
**Type**: External service boundary  
**Contract**: MCP protocol (JSON-RPC)  
**Coupling**: Loose (client-server, separate process)  
**Resilience**: 10s timeout, circuit breaker, graceful degradation (returns undefined)

---

### 4. Data Store Boundary: Session Logic ↔ File Storage
**Type**: Data persistence boundary  
**Contract**: `Storage` namespace (`write`, `read`, `update`, `remove`)  
**Coupling**: Medium (direct calls, JSON serialization)  
**Resilience**: File locking, path validation, ENOENT handling, migrations

---

### 5. Layer Boundary: Activity Tool ↔ Template Execution
**Type**: Controller → Service pattern  
**Contract**: `execute()` → `executeTemplate()` handoff  
**Coupling**: Tight (same file, direct call)  
**Resilience**: Pre-flight checks, abort signal propagation, partial state saving

---

### 6. Layer Boundary: Task Executor ↔ Session Recursion
**Type**: Execution layer → Session layer (recursive)  
**Contract**: `TaskTool.execute()` → `SessionPrompt.prompt()`  
**Coupling**: Medium (indirect recursion, session isolation)  
**Resilience**: Abort signal, timeout per task, cost tracking, NO depth limit (ISSUE)

---

## Key Insights

### Business Purpose
The activity-first-tui-session-interactions flow enforces a critical architectural principle:

**All complex user workflows in the TUI must be tracked, reusable, and integrated into the learning loop.**

This ensures:
1. **Consistency**: Multi-step tasks follow standardized execution patterns
2. **Observability**: Full visibility into what agents do, how long it takes, what it costs
3. **Reusability**: Successful workflows captured as templates for future use
4. **Learning**: Metrics feed recommendation engine for better template selection
5. **Quality**: Activity templates are reviewed, tested, and versioned

### Critical Decision Points

#### Decision Point 1: Activity Command Detection (prompt.ts:515)
```typescript
if (promptText && !isActivityCommand) {
  // Proceed with enforcement
}
```
**Impact**: Determines whether to apply enforcement gate  
**Risk**: If detection is wrong, enforcement skipped or double-applied  
**Mitigation**: Explicit keyword check ("activity", "template", "search_activities")

#### Decision Point 2: Complexity Threshold (recommendation-engine.ts)
```typescript
requiresActivity = (estimatedToolCalls > 8)
```
**Impact**: Decides simple vs complex task routing  
**Risk**: Threshold too low → overhead; too high → missed tracking  
**Mitigation**: Empirically derived (80/20 rule), configurable in future

#### Decision Point 3: Tool Allowlist (activity-enforcement-gate.ts:88)
```typescript
allowedTools = allTools.filter(
  t => ACTIVITY_TOOLS.includes(t) || CORE_ALLOWED_TOOLS.includes(t)
)
```
**Impact**: Determines which tools are available during enforcement  
**Risk**: Missing activity tools → LLM cannot proceed  
**Mitigation**: Hardcoded allowlist, logging for blocked tools

#### Decision Point 4: Metabob Integration (prompt.ts:522)
```typescript
const issues = await MetabobCLI.getPriorityIssues({ limit: 10 })
  .catch(() => [])
```
**Impact**: Affects complexity assessment accuracy  
**Risk**: Metabob unavailable → degraded estimation  
**Mitigation**: Best-effort non-blocking, graceful degradation

---

### Potential Risks and Technical Debt

#### HIGH PRIORITY RISKS

**Risk 1: Unbounded Polling Loop**  
**Location**: `session/prompt.ts:1683`  
**Issue**: No maximum iteration count, only abort signal  
**Impact**: Resource exhaustion if tools hang indefinitely  
**Mitigation**: Add max poll count (300000ms / pollInterval)

**Risk 2: Prompt Injection Vulnerability**  
**Location**: `session/activity-template.ts:1617`  
**Issue**: Variable sanitization only escapes shell chars, not LLM prompt injection  
**Impact**: Malicious variables can manipulate system prompt, bypass enforcement  
**Mitigation**: Add XML/markdown tag filtering, length limits

**Risk 3: No Recursion Depth Limit**  
**Location**: Task execution creates sub-sessions recursively  
**Issue**: No depth tracking or limit  
**Impact**: Infinite recursion possible (DoS via malicious template)  
**Mitigation**: Track session depth, enforce max depth (e.g., 5 levels)

#### MEDIUM PRIORITY RISKS

**Risk 4: Silent Error Swallowing**  
**Location**: `session/prompt.ts:522`  
**Issue**: Metabob errors return empty array, no logging  
**Impact**: Complexity assessment may be inaccurate, no visibility into why  
**Mitigation**: Log warnings on Metabob failure

**Risk 5: Missing Activity Tool Validation**  
**Location**: `session/prompt.ts:538`  
**Issue**: No check that activity tools exist before enforcement  
**Impact**: If tools missing, enforcement results in NO available tools  
**Mitigation**: Validate activity tools exist, skip enforcement if missing

**Risk 6: Race Condition in Session Queue**  
**Location**: `session/prompt.ts` (queue management)  
**Issue**: Queue access not protected by mutex  
**Impact**: Messages may be lost or reordered under concurrent access  
**Mitigation**: Add lock around queue read/modify/write

#### TECHNICAL DEBT

**Debt 1: Hardcoded Tool Lists**  
**Location**: `activity-enforcement-gate.ts:24-46`  
**Issue**: ACTIVITY_TOOLS and CORE_ALLOWED_TOOLS are hardcoded constants  
**Impact**: Requires code changes to extend, no runtime configuration  
**Future**: Move to config file or database

**Debt 2: No Caching for Complexity Assessment**  
**Location**: `session/prompt.ts:515-560`  
**Issue**: Every prompt re-runs full complexity assessment  
**Impact**: Repeated work if user rephrases same request  
**Future**: Cache based on prompt similarity (embeddings)

**Debt 3: Regex-Based Intent Analysis**  
**Location**: `session/system.ts:58-118`  
**Issue**: Regex may miss unconventional file references, limited accuracy  
**Impact**: Incorrect task scope extraction for edge cases  
**Future**: Consider LLM-based extraction with caching

---

### Suggested Improvements

#### Improvement 1: Add Enforcement Pre-Flight Check
```typescript
// Before enforcement
const missingActivityTools = ACTIVITY_TOOLS.filter(t => !allTools.includes(t))
if (missingActivityTools.length > 0) {
  log.error("activity tools missing, skipping enforcement", { missingActivityTools })
  enforcementDecision = { enforced: false, allowedTools: allTools, ... }
}
```

#### Improvement 2: Add Recursion Depth Tracking
```typescript
// In Session.create()
const parentDepth = parentSessionID ? await Session.getDepth(parentSessionID) : 0
if (parentDepth >= MAX_SESSION_DEPTH) {
  throw new Error(`Session depth limit exceeded (${MAX_SESSION_DEPTH})`)
}
session.depth = parentDepth + 1
```

#### Improvement 3: Improve Variable Sanitization
```typescript
function sanitizeVariableValue(value: string): string {
  // Length limit
  if (value.length > 10000) {
    throw new Error(`Variable too long (${value.length} chars, max 10000)`)
  }
  
  // Prevent prompt injection
  value = value.replace(/<\/(system|user|assistant)>/gi, "[REMOVED]")
  value = value.replace(/<(system|user|assistant)>/gi, "[REMOVED]")
  
  // Existing shell escaping
  value = value.replace(/`/g, "\\`")
  value = value.replace(/\$\(/g, "\\$(")
  // ...
  
  return value
}
```

#### Improvement 4: Add Polling Loop Timeout
```typescript
const maxPolls = Math.floor(300000 / pollInterval) // 5 minute max
let pollCount = 0

while (pendingToolCount > 0 && pollCount < maxPolls) {
  pollCount++
  // ...existing logic...
  
  if (pollCount >= maxPolls) {
    throw new Error(`Prompt processing timed out after ${maxPolls * pollInterval}ms`)
  }
}
```

#### Improvement 5: Add Metabob Error Logging
```typescript
const issues = await MetabobCLI.getPriorityIssues({ limit: 10 }).catch((error) => {
  log.warn("metabob unavailable, complexity assessment degraded", {
    error: error.message,
    sessionID: input.sessionID
  })
  return []
})
```

---

## Reusable Patterns

### Pattern 1: Enforcement Gate Pattern
**Universal Pattern**: Policy-based access control at runtime

**Components**:
1. **Assessment**: Analyze request to determine policy applicability
2. **Decision**: Apply policy rules to produce access decision
3. **Injection**: Inject decision into execution context (system prompt)
4. **Enforcement**: Filter available actions based on decision (tool registry)

**Reusability**:
- ✅ Can be abstracted for other access control scenarios
- ✅ Applicable to: Tool access, API rate limiting, feature gating, cost budgets
- ✅ Separates policy definition from enforcement mechanism

**Feature-Specific Aspects**:
- 8-tool threshold (domain-specific)
- Activity tools allowlist (domain-specific)
- Complexity assessment formula (domain-specific)

**Universal Aspects**:
- Two-stage enforcement (advisory + mandatory)
- Structured decision object (EnforcementDecision)
- Logging for audit trail
- Graceful degradation on missing dependencies

### Pattern 2: Best-Effort External Service Integration
**Universal Pattern**: Non-blocking integration with unreliable external services

**Components**:
1. **Timeout Wrapper**: Hard time limit per call (10s for MCP)
2. **Graceful Degradation**: Return undefined/empty on failure
3. **Circuit Breaker**: Detect repeated failures, stop calling
4. **Detailed Logging**: Classify error types, aid debugging

**Reusability**:
- ✅ Can be abstracted for any external service call
- ✅ Applicable to: Metabob MCP, backend API, third-party APIs
- ✅ Ensures system availability > service dependency

**Feature-Specific Aspects**:
- 10s timeout (tuned for MCP latency)
- Priority issues query (domain-specific)

**Universal Aspects**:
- Timeout pattern (withTimeout utility)
- Error classification (timeout, circuit breaker, unknown)
- Non-blocking fallback (undefined/empty return)

### Pattern 3: Variable Interpolation with Sanitization
**Universal Pattern**: Safe template variable substitution

**Components**:
1. **Built-in Variables**: Runtime context injection (ACTIVITY_ID, REPO_ROOT)
2. **Sanitization**: Escape dangerous characters before interpolation
3. **Missing Variable Detection**: Validate all placeholders replaced
4. **Code Block Exemption**: Allow examples to contain {{var}} syntax

**Reusability**:
- ✅ Can be abstracted for any template system
- ✅ Applicable to: Activity templates, email templates, config templates
- ✅ Security-first approach prevents injection

**Feature-Specific Aspects**:
- Shell metacharacter escaping (domain-specific)
- Activity-specific built-in variables

**Universal Aspects**:
- Placeholder syntax ({{variable}})
- Sanitization before interpolation
- Missing variable validation
- User override precedence (user vars > built-in)

### Pattern 4: Recursive Session with Isolation
**Universal Pattern**: Nested execution contexts with isolation

**Components**:
1. **Parent-Child Relationship**: Track session hierarchy
2. **Isolated State**: Each sub-session has own state, messages
3. **Abort Signal Propagation**: Parent can cancel children
4. **Metrics Aggregation**: Roll up cost/tokens from children

**Reusability**:
- ✅ Can be abstracted for nested workflows
- ✅ Applicable to: Multi-agent systems, workflow orchestration, distributed tasks
- ✅ Ensures fault isolation (child failure doesn't crash parent)

**Feature-Specific Aspects**:
- NO enforcement in child sessions (domain-specific)
- Task-specific sub-agent selection

**Universal Aspects**:
- Session.create() with parent reference
- Recursive SessionPrompt.prompt() call
- Abort signal chaining
- Cost/token aggregation

---

### Could This Flow Be an Activity Template?

**Short Answer**: Partially. The enforcement logic itself is system-level, but the pattern of "assess complexity → enforce policy → execute with restrictions" could be a reusable activity template for other governance scenarios.

#### Reusable as Activity Template?

**What CAN be abstracted**:
- Complexity assessment pattern (estimate resource usage)
- Policy enforcement pattern (restrict access based on assessment)
- Two-stage enforcement (guidance + hard restriction)
- Best-effort dependency integration (graceful degradation)

**What CANNOT be abstracted**:
- 8-tool threshold (empirically derived for OpenCode domain)
- Activity tools allowlist (specific to activity system)
- TUI integration (UI-specific)
- Recursive session creation (language/framework-specific)

#### Potential Activity Template: "Governed Execution"

**Template Name**: `governed-execution`  
**Purpose**: Execute tasks with policy-based access control

**Variables**:
- `taskDescription`: What to execute
- `assessmentCriteria`: How to estimate complexity
- `policyThreshold`: When to enforce restrictions
- `allowedActions`: What actions are permitted under enforcement
- `fallbackBehavior`: What to do if restricted actions needed

**Tasks**:
1. **Assess Complexity**: Analyze task requirements
2. **Apply Policy**: Determine if restrictions needed
3. **Execute with Controls**: Run task with allowed actions only
4. **Validate Outcome**: Ensure policy was followed

**Reusability**: High for scenarios requiring governance (security, compliance, cost control)

---

## Conclusion

The activity-first-tui-session-interactions flow successfully implements the architectural principle that complex TUI user requests must go through the activity system. The implementation is robust, with multiple layers of enforcement, graceful degradation on failures, and comprehensive logging.

**Key Strengths**:
- ✅ Defense in depth: Two-stage enforcement (guidance + restriction)
- ✅ Graceful degradation: System works without Metabob
- ✅ Clear separation: Policy logic isolated from execution logic
- ✅ Comprehensive logging: Full audit trail for debugging

**Key Weaknesses**:
- ⚠️ Unbounded polling loop (resource exhaustion risk)
- ⚠️ Prompt injection vulnerability (incomplete sanitization)
- ⚠️ No recursion depth limit (DoS risk)
- ⚠️ Silent error swallowing (degraded observability)

**Recommended Priority**:
1. **Immediate**: Fix unbounded polling loop (HIGH risk)
2. **Immediate**: Improve variable sanitization (HIGH risk, security)
3. **Short-term**: Add recursion depth limit (MEDIUM risk)
4. **Short-term**: Validate activity tools exist before enforcement (MEDIUM risk)
5. **Long-term**: Extract reusable patterns as libraries

The flow is production-ready with the noted HIGH-priority fixes applied.
