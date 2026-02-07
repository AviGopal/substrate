# Metabob Data Flow Architecture

## Overview: Two Applications Working as One System

**metabob-opencode** and **metabob-cli** work together as a unified system with clear separation of concerns:

- **metabob-opencode**: Agent orchestration, session management, context preparation
- **metabob-cli**: Code analysis, activity execution, behavior recording, backend communication

Communication flows through **MCP (Model Context Protocol)** - stdio-based RPC between the two processes.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    metabob-opencode                         │
│                                                             │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │  User Agent  │  │ Memory Agent    │  │  Subagents   │  │
│  │  (primary)   │  │ (pre-turn hook) │  │  (delegated) │  │
│  └──────┬───────┘  └────────┬────────┘  └──────┬───────┘  │
│         │                   │                    │           │
│         │  ┌────────────────▼────────────────────▼──────┐  │
│         │  │     Session & Activity Management          │  │
│         │  │  - Session.create()                        │  │
│         │  │  - Activity.registerSession()              │  │
│         │  │  - SessionMemory (impulses)                │  │
│         │  │  - TurnLifecycle (hooks)                   │  │
│         │  └────────────────┬───────────────────────────┘  │
│         │                   │                               │
│         └───────────────────┼───────────────────────────────┘
│                             │
│                             │ MCP stdio
│                             │ (JSON-RPC)
└─────────────────────────────┼───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                       metabob-cli                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              MCP Server (tools.py)                    │ │
│  │  - Activity tools: search/start/next_step/report     │ │
│  │  - Analysis tools: search/annotate/mark_complete     │ │
│  │  - CPG tools: get_component_graph                    │ │
│  └──────────────────────┬────────────────────────────────┘ │
│                         │                                   │
│  ┌──────────────────────▼────────────────────────────────┐ │
│  │         ActivityManager (activity_manager.py)        │ │
│  │  - Template retrieval from backend                   │ │
│  │  - Incremental step delivery                         │ │
│  │  - Execution state tracking                          │ │
│  │  - Step result recording                             │ │
│  └──────────────────────┬────────────────────────────────┘ │
│                         │                                   │
│  ┌──────────────────────▼────────────────────────────────┐ │
│  │     AnalysisEngine & SessionManager                  │ │
│  │  - File watching & analysis                          │ │
│  │  - Backend session management                        │ │
│  │  - State persistence (FileStateManager)              │ │
│  └──────────────────────┬────────────────────────────────┘ │
│                         │                                   │
│                         │ HTTP/WebSocket                    │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                  metabob-rpc-api (Backend)                  │
│                                                             │
│  - Activity template storage (SurrealDB)                   │
│  - Learning metrics & recommendations                      │
│  - Task assignment to agents                               │
│  - Workflow evolution triggers                             │
│  - Code analysis results                                   │
└─────────────────────────────────────────────────────────────┘
```

## Responsibilities by Component

### metabob-opencode: Agent Orchestration & Session Management

#### 1. **Agent Execution** (`agent/agent.ts`)
- Manages primary agents (activity, plan, review modes)
- Spawns subagents via task delegation
- Tracks agent-level metabob config overrides
- Coordinates turn lifecycle

#### 2. **Session Management** (`session/index.ts`)
**Responsibilities:**
- Create and track sessions (`Session.create()`)
- Store messages and parts (conversation history)
- Track usage (tokens, cost) per message
- Associate sessions with activities (`activityId` field)
- Session memory lifecycle management

**Key Functions:**
```typescript
Session.create()          // Create new session
Session.fork()            // Fork from existing session
Session.createForActivity() // Create session for activity
Session.updateMessage()   // Store assistant message
Session.updatePart()      // Store message parts (tool calls, text)
Session.getUsage()        // Get token/cost usage
```

#### 3. **Activity Coordination** (`session/activity.ts`)
**Responsibilities:**
- Register session→activity mappings
- Track which sessions are running activities
- Coordinate memory agent sessions
- Clean up stale mappings

**Key Functions:**
```typescript
Activity.registerSession(sessionId, activityId)
Activity.getActivityForSession(sessionId)
Activity.unregisterSession(sessionId)
Activity.registerSessionMemory(sessionId)  // Track memory agent sessions
```

#### 4. **Turn Lifecycle Hooks** (`session/turn-lifecycle-hooks.ts`)
**Pre-turn hooks that run BEFORE agent processes message:**

**Memory Management Hook (priority: 10)**
- Runs the `manage-session-memory` activity template
- Analyzes user intent via SessionMemoryAgent
- Creates/loads impulses for context
- Prepares activity context hints

**Activity Recommendation Hook (priority: 15)**
- Injects relevant activity templates when no activity is running
- Uses Thompson Sampling for exploration/exploitation balance
- Makes agent aware of available workflows

**Metabob Context Hook (priority: 20)**
- Injects code quality issues
- Injects component annotations
- Injects impact warnings

#### 5. **Session Memory Agent** (`session/memory-agent.ts`)
**Responsibilities:**
- **ROUTER role**: Analyzes user intent, NOT a coder
- Classifies intent (code_fix, feature_request, question, etc.)
- Suggests relevant impulses (files, issues, commands)
- Fast analysis (<2s) using Claude Haiku
- No memory tools exposed to main agent

**Intent Classification:**
```typescript
{
  type: "code_fix" | "feature_request" | "question" | "refactor" | "exploration" | "other",
  confidence: 0.0-1.0,
  reasoning: "Why this classification",
  suggestedImpulses: [
    {
      id: "errorFile",
      type: "file",
      path: "src/module.ts",
      priority: "high",
      budget: 2000
    }
  ]
}
```

#### 6. **Impulse System** (`session/session-memory.ts`, `activity-template.ts`)
**Responsibilities:**
- Lazy-loaded pointers to content
- Token budget management
- Dynamic context allocation
- Cross-session serialization

**Impulse Types:**
- `memo` - In-memory content
- `file` - File paths with offsets
- `component` - Code components
- `commit` - Git commits
- `metabobIssue` - Code quality issues
- `metabobAnnotation` - Component annotations
- `activityOutput` - Previous activity results
- `bashOutput` - Command outputs
- `templateDefinition` - Activity templates
- `activityRecommendation` - Activity suggestions

#### 7. **Template Repository** (`session/activity-template-repository.ts`)
**Responsibilities:**
- Interface to Metabob backend for templates
- Read-through caching (5-min TTL)
- Save templates to backend
- Update execution metrics

**Note**: NO local file storage - Metabob backend (SurrealDB) is single source of truth.

#### 8. **Activity Outcome Recording** (`session/activity-outcome-recorder.ts`)
**Responsibilities:**
- Record activity execution results
- Track expectations vs reality
- Capture agent decisions at each step
- Quality validation
- Performance metrics

**Data Recorded:**
- Component accuracy (expected vs actual files modified)
- Cost delta (expected vs actual cost)
- Duration delta
- Agent decisions with reasoning
- Test results
- Code quality impact (issues fixed/introduced)

### metabob-cli: Code Analysis & Activity Execution

#### 1. **MCP Server** (`mcp/server.py`, `mcp/tools.py`)
**Exposed via MCP to metabob-opencode:**

**Activity Tools:**
- `search_activities` - Find available activities (Thompson Sampling)
- `start_activity_execution` - Begin activity, get metadata
- `get_next_activity_step` - Deliver next step incrementally
- `report_activity_step_result` - Record step completion, advance state

**Analysis Tools:**
- `search_codebase_issues` - Search code quality problems
- `get_priority_issues` - Get issues for active files
- `mark_problem_complete` - Mark issue as resolved
- `annotate_component` - Add component annotations
- `list_file_components` - List components in file
- `suggest_related_changes` - Co-change predictions
- `analyze_component_impact` - Impact analysis

**CPG Tools:**
- `get_component_graph` - Get Code Property Graph
- Various analysis tools

#### 2. **Activity Manager** (`mcp/activity_manager.py`)
**Responsibilities:**
- Retrieve templates from metabob-rpc-api backend
- Incremental step delivery (agent doesn't see full workflow upfront)
- Track execution state per session
- Report step results to backend
- Trigger trailblazing on validation failures

**Key Concept: Incremental Delivery**
```python
# Agent calls get_next_step()
step = activity_manager.get_next_step(execution_id)
# Returns ONLY current step, NOT all steps
# → { "step_index": 2, "current_step": {...}, "total_steps": 5 }

# Agent executes step, reports result
activity_manager.report_step_result(execution_id, step_id, success=True, ...)
# → Advances state, returns next action
```

**Why Incremental?**
- Agent doesn't get to "look ahead" at future steps
- Forces authentic step-by-step execution
- Enables dynamic adjustments (trailblazing)
- Better reflects real agent behavior

#### 3. **Session Manager** (`core/session_manager.py`)
**Responsibilities:**
- Manage backend API session (Bearer token)
- Keep session alive (5-min keepalive)
- Session resumption on restart
- State persistence via FileStateManager

**Session Token Lifecycle:**
```python
# On start:
session_manager.ensure_session()
# → Creates or resumes session with backend
# → Stores session_token and session_id in state file

# During operation:
session_manager.keepalive_loop()
# → Pings backend every 5 minutes
# → Refreshes session token if needed

# On restart:
session_manager.ensure_session()
# → Reads session_token from state file
# → Validates with backend
# → Resumes or creates new if expired
```

#### 4. **File State Manager** (`core/file_state.py`)
**Responsibilities:**
- Persist all state (session, analysis, file hashes)
- File locking for concurrent access
- Atomic read-modify-write operations

**State Stored:**
- `session_token` - Backend authentication
- `session_id` - Backend session ID
- `file_hashes` - Track file changes
- `analysis_results` - Cached analysis per file
- `job_state` - Active analysis jobs

#### 5. **Analysis Engine** (`core/analysis_engine.py`)
**Responsibilities:**
- File watching (inotify/polling)
- Batch file analysis
- Job submission to backend
- Result collection and caching

#### 6. **Behavior Recording** (IMPLICIT - not yet fully implemented)
**Current State:**
- Step results recorded via `report_step_result()`
- Usage tracked in session state
- Outcomes sent to backend

**Missing Pieces** (future work):
- Comprehensive agent behavior tracking
- Decision point recording
- Tool usage patterns
- Context effectiveness metrics

## Complete Data Flow: Activity Execution

### Phase 1: Activity Discovery & Selection

```
┌─────────────────────────────────────────────────────────────┐
│ metabob-opencode: Activity Recommendation Hook             │
└─────────────────────────────────────────────────────────────┘

1. TurnLifecycle hook triggers (priority: 15)
2. Check: Is activity already running? → NO
3. Call MCP: search_activities(query="user's recent context")
   │
   ├─→ metabob-cli: ActivityManager.search_activities()
   │   └─→ HTTP: GET /activity-recommendations/recommendations
   │       └─→ metabob-rpc-api: Thompson Sampling ranking
   │           └─→ Returns: [
   │                 { activity_id, variant_id, selection_id, 
   │                   expected_success_rate, description }
   │               ]
   │
4. metabob-opencode: Inject recommendations into system prompt
   <activity_recommendations>
     Activity: Fix Bug with TDD
     Success Rate: 85%
     ...
   </activity_recommendations>
```

### Phase 2: Memory Agent Preparation (Pre-Turn Hook)

```
┌─────────────────────────────────────────────────────────────┐
│ metabob-opencode: Memory Management Hook                   │
└─────────────────────────────────────────────────────────────┘

1. TurnLifecycle hook triggers (priority: 10) BEFORE main agent
2. Execute manage-session-memory activity template
   │
   ├─→ Spawn Memory Agent Session (separate agent)
   │   │
   │   ├─→ Memory Agent: SessionMemoryAgent.analyzeIntent()
   │   │   - Classifies user intent (code_fix, feature_request, etc.)
   │   │   - Suggests relevant impulses (files, issues, commands)
   │   │   - Fast (<2s) using Claude Haiku
   │   │
   │   ├─→ Memory Agent: Creates impulses via SessionMemory.create()
   │   │   - file impulses for relevant source files
   │   │   - metabobIssue impulses for code quality context
   │   │   - bashOutput impulses for codebase structure
   │   │
   │   └─→ Memory Agent: Loads high-priority impulses
   │       - Resolves pointers to actual content
   │       - Enforces token budgets
   │       - Returns loaded content to calling session
   │
3. Main Agent Session: Impulses injected into system prompt
   <impulse_context>
     <impulse id="errorFile" type="file" tokens="1450/2000">
       [file content]
     </impulse>
     <impulse id="relatedTest" type="file" tokens="950/1500">
       [test content]
     </impulse>
   </impulse_context>
```

### Phase 3: Activity Execution Start

```
┌─────────────────────────────────────────────────────────────┐
│ metabob-opencode: User Agent decides to start activity     │
└─────────────────────────────────────────────────────────────┘

User Agent: "I'll use the fix-bug activity to resolve this TypeError"

1. Agent calls activity tool:
   activity({
     templateId: "fix-bug",
     variables: { component: "Tool.execute", file: "src/tool.ts" },
     reason: "TypeError in bash output processing"
   })
   
2. metabob-opencode: Activity tool handler
   │
   ├─→ MCP call: start_activity_execution(activity_id, variables, reason)
   │   │
   │   ├─→ metabob-cli: ActivityManager.start_execution()
   │   │   - Generate execution_id
   │   │   - Call backend: POST /activity-recommendations/select
   │   │   - Store execution state
   │   │   - Return metadata (NOT steps!)
   │   │   
   │   └─→ Returns: {
   │         "execution_id": "exec_123",
   │         "activity_id": "fix-bug",
   │         "variant_id": "fix-bug_v2_hash",
   │         "selection_id": "sel_456",  # For outcome recording
   │         "task_count": 3,
   │         "context_requirements": [...],
   │         "cost_budget": 1.0
   │       }
   │
3. metabob-opencode: Create activity session
   - Session.createForActivity()
   - Activity.registerSession(sessionId, activityId)
   - Store execution_id for step coordination
```

### Phase 4: Incremental Step Execution

```
┌─────────────────────────────────────────────────────────────┐
│ metabob-opencode: Activity Session (Task Agent)            │
└─────────────────────────────────────────────────────────────┘

LOOP for each step:

1. MCP call: get_next_activity_step(execution_id)
   │
   ├─→ metabob-cli: ActivityManager.get_next_step()
   │   - Checks execution state
   │   - Returns ONLY current step (NOT future steps!)
   │   - Step includes: title, description, tools needed
   │   
   └─→ Returns: {
         "execution_id": "exec_123",
         "step_index": 0,
         "total_steps": 3,
         "current_step": {
           "step_id": "diagnose",
           "title": "Diagnose root cause",
           "description": "Analyze error and identify fix location",
           "tools": ["read", "grep", "metabob_search"]
         },
         "variables": {...},
         "cost_remaining": 0.95
       }

2. metabob-opencode: Inject step into agent context
   <activity_execution>
     Step 1 of 3: Diagnose root cause
     
     Analyze error and identify fix location.
     
     Available tools: read, grep, metabob_search
     Cost remaining: $0.95
   </activity_execution>

3. Task Agent: Execute step
   - Uses tools to complete step
   - Tracks cost, tokens, tool calls
   - Produces output

4. metabob-opencode: Report step result
   MCP call: report_activity_step_result(
     execution_id,
     step_id="diagnose",
     success=true,
     output="Root cause: missing null check at line 142",
     cost=0.05,
     tokens=1200,
     tool_calls=[{tool: "read", ...}, {tool: "grep", ...}]
   )
   │
   ├─→ metabob-cli: ActivityManager.report_step_result()
   │   - Store step result
   │   - Update execution state
   │   - Advance step index
   │   - Calculate cost remaining
   │   - Send to backend: POST /activity-recommendations/record-step
   │   
   └─→ Returns: {
         "continue": true,
         "message": "Step completed, proceed to next"
       }

5. Repeat: Get next step → Execute → Report
```

### Phase 5: Activity Completion & Learning

```
┌─────────────────────────────────────────────────────────────┐
│ All steps complete                                          │
└─────────────────────────────────────────────────────────────┘

1. metabob-cli: ActivityManager checks completion
   - All steps executed successfully?
   - Run validation if configured
   - Calculate final metrics

2. metabob-cli: Record outcome to backend
   POST /activity-recommendations/record-outcome
   {
     "selection_id": "sel_456",  # From start_execution
     "success": true,
     "duration_ms": 18000,
     "cost": 0.23,
     "step_results": [...],
     "quality_validation": {...},
     "comparison": {
       "component_accuracy": 0.92,
       "cost_delta": -0.02,  # Better than expected!
       "duration_delta_ms": -2000
     }
   }

3. metabob-rpc-api: Learning system updates
   - Thompson Sampling parameters updated
   - Template success rate recalculated
   - Trigger template evolution if needed:
     - If success_rate < 0.7: Send evolution task to agent
     - If cost_delta > 0.2: Optimize prompt budgets
     - If duration_delta > 10000ms: Investigate bottlenecks

4. metabob-opencode: Activity completion cleanup
   - Activity.unregisterSession(sessionId)
   - Update activity status to "done"
   - Store activity summary
   - Return summary to calling agent
```

## Session Memory & Impulse Flow

### Memory Agent Session Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ Memory Agent: Separate session from main agent             │
└─────────────────────────────────────────────────────────────┘

1. PRE-TURN: Memory Management Hook triggers
   
2. Create Memory Agent Session
   - Session.createForActivity(
       title: "Memory Management",
       callingSessionID: mainSessionId,
       activityId: "manage-session-memory"
     )
   - Activity.registerSessionMemory(memorySessionId)
   - Separate session ID, separate conversation history

3. Memory Agent: Analyze user intent
   SessionMemoryAgent.analyzeIntent({
     sessionID: memorySessionId,
     promptText: userMessage,
     recentMessages: [...last 5 messages from main session]
   })
   
   ↓ Uses Claude Haiku (<2s, <$0.01)
   
   Returns: Intent with suggested impulses

4. Memory Agent: Create impulses
   for suggestion in intent.suggestedImpulses:
     SessionMemory.create(memorySessionId, {
       id: suggestion.id,
       pointer: suggestion.pointer,
       budget: suggestion.budget,
       priority: suggestion.priority
     })

5. Memory Agent: Load high-priority impulses
   - Load files, resolve pointers
   - Enforce token budgets (truncate if needed)
   - Store in session state

6. MAIN AGENT TURN: Impulses available
   - System prompt includes <impulse_context>
   - Main agent sees prepared context
   - Memory agent session persists for later adjustments

7. POST-TURN: Memory cleanup (if configured)
   - Unload low-priority impulses
   - Free memory for next turn
   - Keep high-value impulses cached
```

### Cross-Session Communication

**Memory Agent ↔ Main Agent:**
```typescript
// Memory agent session
const impulses = SessionMemory.list(memorySessionId)
// → Returns impulses created by memory agent

// Main agent session
const availableImpulses = SessionMemory.getAvailableForSession(mainSessionId)
// → Sees impulses from associated memory agent session
```

**Activity Session ↔ Calling Session:**
```typescript
// Activity session creates output impulse
ActivityTemplate.Impulse.create({
  type: "activityOutput",
  pointer: { activityId: "act_123", taskId: "task-1" }
})

// Calling session can load activity results
const output = ImpulseResolver.load(impulse)
// → Gets activity execution summary
```

## Recording Agent Behavior

### Current Recording (metabob-cli)

#### 1. **Step-Level Recording** (via `report_step_result`)
```python
# Recorded for each step:
{
  "step_id": "diagnose",
  "success": true,
  "output": "Root cause identified...",
  "cost": 0.05,
  "tokens": 1200,
  "tool_calls": [
    {"tool": "read", "args": {"path": "src/tool.ts"}, "duration_ms": 50},
    {"tool": "grep", "args": {"pattern": "execute"}, "duration_ms": 30}
  ],
  "duration_ms": 3000
}
```

**Sent to backend:** POST `/activity-recommendations/record-step`

#### 2. **Execution-Level Recording** (via `record_outcome`)
```python
# Recorded at activity completion:
{
  "selection_id": "sel_456",
  "success": true,
  "duration_ms": 18000,
  "total_cost": 0.23,
  "total_tokens": 8500,
  "step_results": [...all steps],
  "comparison": {
    "component_accuracy": 0.92,
    "cost_delta": -0.02,
    "duration_delta_ms": -2000
  },
  "quality_validation": {
    "tests_passed": 15,
    "issues_fixed": 2,
    "issues_introduced": 0
  }
}
```

**Sent to backend:** POST `/activity-recommendations/record-outcome`

#### 3. **Session State Persistence** (FileStateManager)
```python
# Persisted to .metabob/state file:
{
  "session_token": "...",
  "session_id": "ses_123",
  "file_hashes": {...},
  "analysis_results": {...},
  "last_activity": {
    "execution_id": "exec_123",
    "activity_id": "fix-bug",
    "step_index": 2,
    "cost_so_far": 0.15
  }
}
```

### Future Recording (Comprehensive Agent Behavior)

#### What Should Be Recorded:

**1. Decision Points**
```typescript
{
  "step": 2,
  "context": "Looking at Tool.execute implementation",
  "decision": "Add null check before stdout access",
  "reasoning": "Stack trace shows TypeError on line 142, stdout is undefined in error case",
  "alternatives_considered": [
    "Use optional chaining",
    "Validate in caller",
    "Add default value"
  ],
  "chosen_alternative": 0,
  "outcome": "success"
}
```

**2. Tool Usage Patterns**
```typescript
{
  "tool": "read",
  "frequency": 5,  // Used 5 times in this step
  "avg_duration_ms": 45,
  "success_rate": 1.0,
  "typical_args": {"path": "src/*.ts"},
  "effectiveness": "high"  // Led to successful step
}
```

**3. Context Effectiveness**
```typescript
{
  "impulse_id": "errorFile",
  "loaded_at_step": 0,
  "referenced_in_steps": [0, 1],  // Agent referred to it
  "effectiveness": "high",  // Led to solution
  "tokens_used": 1450,
  "tokens_wasted": 0  // All content was relevant
}
```

**4. Subagent Delegation Patterns**
```typescript
{
  "delegated_to": "config",
  "task_description": "Add field to schema",
  "success": true,
  "duration_ms": 5000,
  "cost": 0.03,
  "handoff_quality": 0.9,  // How well was task specified
  "result_quality": 0.95  // How well did subagent execute
}
```

#### How to Implement (Future):

**Option 1: Enhance metabob-cli MCP Tools**
```python
# Add new MCP tool: record_agent_decision
@mcp.tool()
async def record_agent_decision(
    session_id: str,
    step: int,
    decision: str,
    reasoning: str,
    alternatives: list[str] = None,
    context: str = ""
) -> dict:
    """Record agent decision point for learning."""
    # Store in FileStateManager
    # Send to backend API
    return {"recorded": True}
```

**Option 2: Automatic Extraction from Messages**
```python
# In report_step_result(), analyze the output:
def extract_decision_pattern(output: str, tool_calls: list) -> dict:
    """Extract implicit decision from agent behavior."""
    # Look for patterns:
    # - "I'll [decision] because [reasoning]"
    # - Multiple tool calls → exploration phase
    # - Single tool call → confident execution
    # Return structured decision
```

**Option 3: Message Annotation Layer**
```typescript
// metabob-opencode: Tag messages with metadata
Session.updateMessage({
  ...message,
  metadata: {
    phase: "diagnosis" | "implementation" | "validation",
    confidence: 0.0-1.0,
    referencedImpulses: ["errorFile", "stackTrace"],
    toolStrategy: "exploratory" | "targeted",
    decisionQuality: 0.0-1.0
  }
})
```

## Impulse System Integration

### Impulse Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Creation (Memory Agent or Activity Template)            │
└─────────────────────────────────────────────────────────────┘

// Memory Agent creates impulse from intent analysis
SessionMemory.create(sessionId, {
  id: "errorFile",
  type: "file",
  pointer: { type: "file", path: "src/tool.ts", offset: 135, limit: 20 },
  description: "File containing TypeError",
  priority: "high",
  budget: 2000
})

┌─────────────────────────────────────────────────────────────┐
│ 2. Loading (Before agent needs content)                    │
└─────────────────────────────────────────────────────────────┘

// Load impulse content
const loaded = await SessionMemory.load(sessionId, "errorFile")
// → Resolves pointer, reads file, applies budget
// → Returns: { ...impulse, content: "[file contents]", tokenCount: 1450 }

┌─────────────────────────────────────────────────────────────┐
│ 3. Injection (System prompt includes content)              │
└─────────────────────────────────────────────────────────────┘

// System prompt builder injects loaded impulses
<impulse_context>
  <impulse id="errorFile" type="file" tokens="1450/2000">
    [file content here]
  </impulse>
</impulse_context>

┌─────────────────────────────────────────────────────────────┐
│ 4. Usage Tracking (During agent execution)                 │
└─────────────────────────────────────────────────────────────┘

// Automatic tracking (future):
- Did agent reference this impulse in response?
- How many times?
- Did it lead to solution?
- Was budget appropriate (too much/too little)?

┌─────────────────────────────────────────────────────────────┐
│ 5. Unloading (Free memory between turns)                   │
└─────────────────────────────────────────────────────────────┘

// Unload low-priority impulses
SessionMemory.unload(sessionId, "stackTrace")
// → Keeps pointer, removes content
// → Frees memory for new impulses

┌─────────────────────────────────────────────────────────────┐
│ 6. Cleanup (End of activity or session)                    │
└─────────────────────────────────────────────────────────────┘

// Cleanup when activity completes
SessionMemory.cleanup(sessionId)
// → Removes all impulses for this session
// → Persists usage stats for learning
```

### Impulse → metabob-cli Integration

**Currently:**
- Impulses are managed in metabob-opencode memory
- metabob-cli doesn't directly interact with impulses
- Impulses surface implicitly through context injection

**Future: MCP Impulse Tools**
```python
# metabob-cli could provide impulse-related MCP tools:

@mcp.tool()
async def suggest_impulses_for_activity(
    activity_id: str,
    session_context: dict
) -> list[dict]:
    """Suggest impulses based on activity requirements."""
    # Query backend for activity's typical context needs
    # Return impulse suggestions based on historical data
    
@mcp.tool()
async def validate_impulse_effectiveness(
    impulse_id: str,
    step_output: str
) -> dict:
    """Check if impulse was actually useful."""
    # Analyze if step output referenced impulse content
    # Return effectiveness score
```

## Complete Data Flow Diagram

```
USER MESSAGE
    │
    ▼
┌───────────────────────────────────────────────┐
│ metabob-opencode: TurnLifecycle              │
└───────────────────────────────────────────────┘
    │
    ├─→ Hook 1 (priority 10): Memory Management
    │   │
    │   ├─→ Spawn Memory Agent Session
    │   │   └─→ SessionMemoryAgent.analyzeIntent()
    │   │       └─→ Creates impulses (file, issue, bash)
    │   │
    │   └─→ Load high-priority impulses
    │       └─→ Content ready for main agent
    │
    ├─→ Hook 2 (priority 15): Activity Recommendations
    │   │
    │   └─→ MCP: search_activities()
    │       └─→ metabob-cli → backend API
    │           └─→ Thompson Sampling ranking
    │               └─→ Inject recommendations into prompt
    │
    └─→ Hook 3 (priority 20): Metabob Context
        │
        └─→ MCP: get_priority_issues()
            └─→ metabob-cli → cached analysis
                └─→ Inject issues into prompt
    
┌───────────────────────────────────────────────┐
│ metabob-opencode: Main Agent Turn            │
└───────────────────────────────────────────────┘
    │
    │ System prompt includes:
    │ - <impulse_context> (from memory agent)
    │ - <activity_recommendations> (from backend)
    │ - <code_quality_issues> (from metabob-cli)
    │
    ├─→ Agent decides to start activity
    │   └─→ Calls activity() tool
    │       └─→ MCP: start_activity_execution()
    │           └─→ metabob-cli: ActivityManager.start_execution()
    │               └─→ backend API: POST /activity-recommendations/select
    │                   └─→ Returns execution_id, metadata
    │
    └─→ ACTIVITY LOOP:
        │
        ├─→ MCP: get_next_activity_step(execution_id)
        │   └─→ metabob-cli: Returns step 1 (NOT steps 2-5!)
        │
        ├─→ Agent: Execute step 1
        │   - Uses tools (read, grep, etc.)
        │   - Produces output
        │
        ├─→ MCP: report_activity_step_result(...)
        │   └─→ metabob-cli: Records step, advances state
        │       └─→ backend API: POST /activity-recommendations/record-step
        │
        ├─→ MCP: get_next_activity_step(execution_id)
        │   └─→ metabob-cli: Returns step 2
        │
        └─→ ... (repeat for all steps)
    
┌───────────────────────────────────────────────┐
│ metabob-opencode: Activity Completion        │
└───────────────────────────────────────────────┘
    │
    ├─→ Final MCP: report_activity_step_result(last step)
    │   └─→ metabob-cli: Validates completion
    │       └─→ backend API: POST /activity-recommendations/record-outcome
    │           └─→ Learning system updates
    │
    ├─→ ActivityOutcomeRecorder.recordOutcome()
    │   - Captures expectations vs reality
    │   - Quality validation
    │   - Performance metrics
    │
    ├─→ Activity.unregisterSession()
    │   - Cleanup session mappings
    │
    └─→ Return summary to user
        - "Activity complete: Fixed TypeError in 18m, $0.23"
```

## Backend (metabob-rpc-api) Responsibilities

### 1. Activity Template Storage
- SurrealDB storage for all templates
- Version management
- Variant generation (A/B testing)

### 2. Learning & Recommendations
- Thompson Sampling for activity selection
- Success rate tracking
- Cost/duration optimization
- Co-change prediction

### 3. Workflow Orchestration
- Trigger template evolution
- Send tasks to agents for improvements
- Manage activity lifecycle
- Quality gates

### 4. Metrics & Analytics
- Aggregate execution data across users
- Identify improvement opportunities
- Track template effectiveness
- Component accuracy trends

## How to Record ALL Agent Behavior (Implementation Plan)

### Phase 1: Enhanced Step Recording (metabob-cli)

```python
# In report_step_result(), capture more detail:
@dataclass
class EnhancedStepResult:
    # Existing
    step_id: str
    success: bool
    output: str
    cost: float
    tokens: int
    tool_calls: list
    duration_ms: int
    
    # NEW: Behavioral data
    decision_points: list[dict]  # Extracted from output
    tool_sequence: list[str]  # Order tools were called
    context_references: list[str]  # Which impulses were used
    confidence_indicators: dict  # "I'll", "Let me try", etc.
    error_recovery_attempts: int
    exploration_vs_exploitation: str  # "exploratory" | "targeted"
```

### Phase 2: Decision Extraction (metabob-opencode)

```typescript
// In activity tool, before reporting step:
const decisions = extractDecisions(stepOutput, toolCalls)
// → Analyzes output for decision patterns
// → Extracts reasoning
// → Identifies alternatives considered

await reportStepResult({
  ...stepData,
  decisions: decisions,
  contextUsage: analyzeContextUsage(stepOutput, loadedImpulses)
})
```

### Phase 3: Message Metadata (metabob-opencode)

```typescript
// Enhance Session.updateMessage to include behavior metadata
Session.updateMessage({
  ...message,
  metadata: {
    // Phase of activity
    activityPhase: "diagnosis" | "implementation" | "validation" | "reflection",
    
    // Agent behavior
    confidence: 0.0-1.0,  // Based on language patterns
    toolStrategy: "exploratory" | "targeted" | "mixed",
    errorRecovery: boolean,  // Did agent recover from error?
    
    // Context usage
    impulsesReferenced: ["errorFile", "relatedTest"],
    impulsesIgnored: ["stackTrace"],  // Loaded but not used
    
    // Decision quality
    decisionCount: 3,  // Major decisions in this message
    reasoningQuality: 0.0-1.0,  // Based on explanation depth
    
    // Metabob integration
    issuesReferenced: ["issue-123"],
    annotationsAdded: 2,
    qualityImprovements: ["fixed-null-check"]
  }
})
```

### Phase 4: Backend Analytics

```python
# metabob-rpc-api: Process recorded behavior
class AgentBehaviorAnalyzer:
    def analyze_execution(self, execution_data: dict):
        """Analyze complete activity execution."""
        
        # Decision quality
        decision_accuracy = self._calc_decision_accuracy(execution_data)
        # → Which decisions led to success? Which to dead ends?
        
        # Tool effectiveness
        tool_patterns = self._extract_tool_patterns(execution_data)
        # → Which tool sequences are most effective?
        
        # Context optimization
        context_waste = self._calc_context_waste(execution_data)
        # → Which impulses were loaded but not used?
        
        # Learning insights
        return {
            "improve_prompts": [...],  # Where to improve step prompts
            "optimize_budgets": [...],  # Adjust token budgets
            "reorder_steps": [...],  # Better step sequencing
            "add_validation": [...]  # Missing checks
        }
```

## Integration Points Summary

### metabob-opencode → metabob-cli (via MCP)

| Operation | MCP Tool | Purpose |
|-----------|----------|---------|
| Search activities | `search_activities` | Find relevant templates |
| Start activity | `start_activity_execution` | Begin activity, get metadata |
| Get step | `get_next_activity_step` | Fetch current step only |
| Report step | `report_activity_step_result` | Record completion, advance |
| Search issues | `search_codebase_issues` | Code quality context |
| Get priority issues | `get_priority_issues` | Active file issues |
| Annotate | `annotate_component` | Add component annotations |
| Mark complete | `mark_problem_complete` | Resolve issues |

### metabob-cli → metabob-rpc-api (via HTTP)

| Operation | Endpoint | Purpose |
|-----------|----------|---------|
| Search activities | `GET /activity-recommendations/recommendations` | Thompson Sampling search |
| Select activity | `POST /activity-recommendations/select` | Start execution tracking |
| Record step | `POST /activity-recommendations/record-step` | Step completion |
| Record outcome | `POST /activity-recommendations/record-outcome` | Final results |
| Get template | `GET /activity-templates/{id}` | Fetch template spec |
| Save template | `POST /activity-templates` | Register new template |
| Analysis API | Various endpoints | File analysis, CPG, etc. |

### metabob-opencode Internal

| Component | Stores | Used By |
|-----------|--------|---------|
| Session.updateMessage | Messages, parts, usage | All agents |
| SessionMemory | Impulses, loaded content | Memory agent, main agent |
| Activity.registerSession | Session→activity mapping | Activity coordination |
| TurnLifecycle | Hook execution results | System orchestration |
| Storage | All persistent data | Sessions, activities, config |

### metabob-cli Internal

| Component | Stores | Used By |
|-----------|--------|---------|
| FileStateManager | Session token, file hashes, analysis | All components |
| ActivityManager._executions | Execution state | Activity tools |
| ActivityManager._activity_cache | Cached templates | Step delivery |
| SessionManager | Backend session | All backend communication |
| AnalysisEngine | Analysis results, jobs | CPG tools |

## Key Design Principles

### 1. Single Source of Truth
- **Templates**: metabob-rpc-api backend (SurrealDB)
- **Sessions**: metabob-opencode Storage
- **Analysis**: metabob-cli FileStateManager
- **Learning**: metabob-rpc-api backend

### 2. Incremental Disclosure
- Agent doesn't see full activity upfront
- Steps delivered one at a time
- Enables authentic behavior recording
- Supports dynamic adjustments (trailblazing)

### 3. Separation of Concerns
- **metabob-opencode**: Agent behavior, session context
- **metabob-cli**: Code analysis, backend communication
- **metabob-rpc-api**: Learning, storage, orchestration

### 4. Async Coordination
- Pre-turn hooks prepare context
- Memory agent runs in separate session
- Main agent gets prepared context
- No blocking between components

### 5. Comprehensive Recording
- Every step recorded with cost/tokens
- Decisions tracked (partially implemented)
- Context usage monitored (future)
- Tool patterns analyzed (future)

## Next Steps for Complete Behavior Recording

### Immediate (Low-Hanging Fruit)
1. ✅ Step results already recorded
2. ✅ Tool calls already tracked
3. ☐ Add decision extraction from step output
4. ☐ Track impulse references in output

### Short-Term (Enhance metabob-cli)
1. ☐ Add `record_agent_decision` MCP tool
2. ☐ Extract decision patterns automatically
3. ☐ Track context effectiveness
4. ☐ Monitor tool usage patterns

### Medium-Term (Enhance metabob-opencode)
1. ☐ Message metadata layer
2. ☐ Activity phase tracking
3. ☐ Confidence indicators
4. ☐ Context usage analysis

### Long-Term (Backend Analytics)
1. ☐ Aggregate behavior patterns
2. ☐ Template optimization engine
3. ☐ Agent performance profiles
4. ☐ Workflow evolution automation

## Example: Complete Recording of One Activity

```
Activity: Fix TypeError in Tool.execute
Template: fix-bug
Duration: 18 minutes
Cost: $0.23
Steps: 3 (diagnose → fix → test)

┌─────────────────────────────────────────────┐
│ RECORDED DATA (Currently Implemented)      │
└─────────────────────────────────────────────┘

Step Results:
- Step 1 (diagnose): 
  - success: true
  - output: "Root cause: missing null check"
  - cost: $0.05
  - tokens: 1200
  - tools: ["read", "grep", "metabob_search"]
  - duration: 3000ms

- Step 2 (fix):
  - success: true
  - output: "Added null check at line 142"
  - cost: $0.08
  - tokens: 2800
  - tools: ["read", "str_replace", "read_lints"]
  - duration: 5000ms

- Step 3 (test):
  - success: true
  - output: "Tests passing (15 pass, 0 fail)"
  - cost: $0.10
  - tokens: 4500
  - tools: ["shell"]
  - duration: 10000ms

Outcome:
- success: true
- total_cost: $0.23
- total_tokens: 8500
- duration: 18000ms
- component_accuracy: 0.92

┌─────────────────────────────────────────────┐
│ FUTURE RECORDING (To Be Implemented)       │
└─────────────────────────────────────────────┘

Decisions:
- Step 1, Decision 1:
  - context: "Reading Tool.execute implementation"
  - decision: "Need to check error handling path"
  - reasoning: "Stack trace shows line 142, need to see surrounding code"
  - tools_used: ["read"]
  - outcome: "success" (found the issue)

- Step 2, Decision 1:
  - context: "Identified missing null check"
  - decision: "Add conditional check before stdout access"
  - reasoning: "stdout can be undefined in error cases"
  - alternatives: ["optional chaining", "default value", "validation in caller"]
  - chosen: 0 (conditional check)
  - outcome: "success"

Context Usage:
- errorFile impulse:
  - loaded: step 0
  - referenced: steps 0, 1
  - effectiveness: "high"
  - tokens: 1450/2000 (73% used)
  - wasted: 0 tokens (all relevant)

- relatedTest impulse:
  - loaded: step 2
  - referenced: step 2
  - effectiveness: "medium"
  - tokens: 950/1500 (63% used)
  - wasted: ~200 tokens (some unrelated tests)

Tool Patterns:
- read → grep → metabob_search (exploratory phase)
- read → str_replace → read_lints (implementation phase)
- shell (validation phase)

Quality Metrics:
- Issues referenced: ["issue-142"]
- Issues fixed: 1
- Issues introduced: 0
- Annotations added: 1
- Component: "Tool.execute"
```

## Conclusion

The system has a well-designed architecture with clear separation of concerns:

1. **metabob-opencode** orchestrates agents and prepares context
2. **metabob-cli** handles analysis and backend communication
3. **metabob-rpc-api** manages learning and workflow evolution

**Current State:**
- ✅ Activity execution working
- ✅ Step-level recording functional
- ✅ Outcome tracking implemented
- ✅ Basic metrics captured

**Future Work:**
- ☐ Comprehensive decision recording
- ☐ Context effectiveness tracking
- ☐ Tool pattern analysis
- ☐ Automatic template evolution

The foundation is solid for expanding behavior recording to capture every aspect of agent execution.
