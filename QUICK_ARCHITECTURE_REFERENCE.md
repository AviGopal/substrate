# Quick Architecture Reference

## The Three-System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      metabob-opencode                           │
│                  (Agent Orchestration Layer)                    │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐ │
│  │ Primary Agent│ │ Memory Agent │ │ Subagents (delegated)  │ │
│  │ (user-facing)│ │ (pre-turn)   │ │ (config,tool,session)  │ │
│  └──────┬───────┘ └──────┬───────┘ └──────┬─────────────────┘ │
│         └────────────────┴────────────────┘                    │
│                          │                                      │
│         ┌────────────────▼──────────────────┐                  │
│         │   Session & Activity Management   │                  │
│         │  - Turn lifecycle hooks           │                  │
│         │  - Impulse system                 │                  │
│         │  - Message/usage tracking         │                  │
│         └────────────────┬──────────────────┘                  │
│                          │                                      │
│  Storage: ~/.opencode/storage/                                 │
│  - Sessions, messages, parts                                   │
│  - Impulses (lazy-loaded content)                              │
│  - Activity→session mappings                                   │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           │ MCP stdio (20+ tools)
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                        metabob-cli                              │
│                  (Code Analysis & Execution)                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              MCP Server (tools.py)                      │  │
│  │  - Activity: search/start/next_step/report             │  │
│  │  - Analysis: search/annotate/mark_complete             │  │
│  │  - CPG: get_component_graph                            │  │
│  └────────────────────────┬────────────────────────────────┘  │
│                           │                                    │
│  ┌────────────────────────▼────────────────────────────────┐  │
│  │         ActivityManager (activity_manager.py)          │  │
│  │  - Incremental step delivery                           │  │
│  │  - Execution state tracking                            │  │
│  │  - Step result recording                               │  │
│  └────────────────────────┬────────────────────────────────┘  │
│                           │                                    │
│  ┌────────────────────────▼────────────────────────────────┐  │
│  │         AnalysisEngine & FileWatcher                   │  │
│  │  - File watching (inotify/polling)                     │  │
│  │  - Code analysis & CPG                                 │  │
│  │  - Result caching                                      │  │
│  └────────────────────────┬────────────────────────────────┘  │
│                           │                                    │
│  Storage: .metabob/state                                       │
│  - Session token & session_id                                  │
│  - File hashes                                                 │
│  - Analysis cache                                              │
│  - Execution state                                             │
└────────────────────────────┼──────────────────────────────────┘
                             │
                             │ HTTP/WebSocket
                             │
┌────────────────────────────▼──────────────────────────────────┐
│                    metabob-rpc-api                            │
│                  (Learning & Storage Backend)                 │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Activity Templates (SurrealDB)             │   │
│  │  - Template storage & versioning                     │   │
│  │  - Variant management (A/B testing)                  │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                     │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │          Learning System                             │   │
│  │  - Thompson Sampling recommendations                 │   │
│  │  - Success rate tracking                             │   │
│  │  - Template evolution triggers                       │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                     │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │         Analytics & Orchestration                    │   │
│  │  - Aggregate execution data                          │   │
│  │  - Send evolution tasks to agents                    │   │
│  │  - Quality gate enforcement                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  Storage: SurrealDB                                           │
│  - Templates, variants, metrics                               │
│  - Execution history                                          │
│  - Learning parameters                                        │
└───────────────────────────────────────────────────────────────┘
```

## Data Flow: Activity Execution (Numbered Steps)

### 1️⃣ Pre-Turn: Memory Agent Preparation

```
User: "Fix TypeError in Tool.execute"
  ↓
metabob-opencode: TurnLifecycle Hook (priority 10)
  ↓
Memory Agent Session spawned → analyzes intent → creates impulses
  ↓
Impulses loaded: errorFile(1450t), relatedTest(950t), recentChanges(800t)
  ↓
Main agent system prompt includes <impulse_context> with loaded content
```

**Recorded**: Memory session, intent, impulses, $0.01 cost

### 2️⃣ Pre-Turn: Activity Recommendations

```
metabob-opencode: TurnLifecycle Hook (priority 15)
  ↓ MCP
metabob-cli: search_activities(query="bug fix")
  ↓ HTTP
metabob-rpc-api: Thompson Sampling → rank templates
  ↑ HTTP
metabob-cli: [fix-bug (86%), debug-with-tests (72%)]
  ↑ MCP
metabob-opencode: Inject into system prompt <activity_recommendations>
```

**Recorded**: Search query, rankings, selection_ids

### 3️⃣ Pre-Turn: Metabob Context

```
metabob-opencode: TurnLifecycle Hook (priority 20)
  ↓ MCP
metabob-cli: get_priority_issues(file="src/tool.ts")
  ↓ (from cache, populated by file watching)
metabob-cli: [Issue #142: Missing null check, MEDIUM severity]
  ↑ MCP
metabob-opencode: Inject into system prompt <code_quality_issues>
```

**Recorded**: Issues injected, context size

### 4️⃣ Main Turn: Agent Decides to Use Activity

```
Main Agent: "I'll use the fix-bug activity"
  ↓
metabob-opencode: activity() tool call
  ↓ MCP: start_activity_execution(activity_id, variables, reason)
metabob-cli: ActivityManager.start_execution()
  ↓ HTTP: POST /activity-recommendations/select
metabob-rpc-api: Record selection (selection_id → execution_id link)
  ↑ HTTP: { execution_id, variant_id, task_count }
metabob-cli: Create ActivityExecution state
  ↑ MCP: { execution_id, metadata }
metabob-opencode: Create activity session, register mapping
```

**Recorded**: Selection, variables, reason, execution start

### 5️⃣ Step Execution Loop (× N steps)

```
FOR EACH STEP:

Activity Session: Get next step
  ↓ MCP: get_next_step(execution_id)
metabob-cli: Return ONLY current step (hide future steps)
  ↑ MCP: { step_index, current_step{id, description, tools}, cost_remaining }
  ↓
Task Agent: Execute step (uses tools, produces output)
  ↓ MCP: report_step_result(execution_id, step_id, success, output, cost, tokens, tool_calls)
metabob-cli: Record step result, advance state
  ↓ HTTP: POST /activity-recommendations/record-step
metabob-rpc-api: Track progress in real-time
  ↑ HTTP: {"continue": true} or {"complete": true}
metabob-cli: Return next action
  ↑ MCP: {"continue": true}
Activity Session: Loop to next step
```

**Recorded per step**: 
- Success/failure
- Output text
- Cost, tokens, duration
- Tool calls (name, args, results)

### 6️⃣ Activity Completion & Learning

```
metabob-cli: All steps done → calculate final metrics
  ↓ HTTP: POST /activity-recommendations/record-outcome
  Body: {
    selection_id, success, duration, cost, step_results[],
    comparison{ component_accuracy, cost_delta, duration_delta },
    quality_validation, performance_metrics
  }
  ↓
metabob-rpc-api: Learning System Update
  ├─→ Thompson Sampling: alpha += 1
  ├─→ Success rate: 0.857 → 0.860
  ├─→ Avg cost: $0.28 → $0.277
  ├─→ Avg duration: 20000ms → 19953ms
  └─→ Check evolution triggers:
      ✓ Performing well, no evolution needed
  ↑ HTTP: {"success": true}
metabob-cli: Execution complete
  ↑ MCP: {"status": "done"}
metabob-opencode: Activity cleanup
  - Activity.unregisterSession()
  - Return summary to user
```

**Recorded**: Complete execution, learning data, template improvements

## Recording: What Gets Captured

### Session Level (metabob-opencode)
```
Session {
  messages: [
    { role: "user", text: "Fix TypeError...", timestamp, tokens: 0 },
    { role: "assistant", text: "I'll analyze...", 
      tokens: { input: 5000, output: 1200, cache: 3500 },
      cost: 0.05,
      parts: [
        { type: "tool_call", name: "read", args: {...}, result: "...", duration: 50ms }
      ]
    }
  ],
  usage: {
    total_cost: 0.32,
    total_tokens: 13300,
    messages_count: 7
  }
}
```

### Step Level (metabob-cli)
```
StepResult {
  step_id: "diagnose",
  success: true,
  output: "Root cause: missing null check at line 142...",
  cost: 0.08,
  tokens: 3000,
  duration_ms: 3000,
  tool_calls: [
    { tool: "read", args: {...}, duration_ms: 50 },
    { tool: "grep", args: {...}, duration_ms: 30 },
    { tool: "metabob_search", args: {...}, duration_ms: 200 }
  ]
}
```

### Activity Level (metabob-rpc-api)
```
ActivityExecution {
  execution_id: "exec_456",
  variant_id: "fix-bug_v2_abc123",
  selection_id: "sel_789",
  success: true,
  duration_ms: 18000,
  cost: 0.26,
  step_results: [3 steps],
  comparison: {
    component_accuracy: 0.92,
    cost_delta: -0.02,      # Cheaper!
    duration_delta_ms: -2000  # Faster!
  },
  quality_validation: { tests_passed: 15, issues_fixed: 1 }
}
```

### Template Metrics (metabob-rpc-api)
```
ActivityTemplate {
  id: "fix-bug",
  variant_id: "v2_abc123",
  executions: 43,
  successes: 37,
  success_rate: 0.860,
  avg_cost: 0.277,
  avg_duration: 19953,
  thompson_alpha: 37,
  thompson_beta: 6,
  component_accuracy_history: [0.85, 0.91, 0.92, ...],
  last_evolved: "2026-01-15T10:30:00Z"
}
```

## Key Integration Points

### MCP Tools (metabob-opencode → metabob-cli)

| Category | Tools | Purpose |
|----------|-------|---------|
| **Activity** | search_activities, start_activity_execution, get_next_step, report_step_result | Activity lifecycle |
| **Analysis** | search_codebase_issues, get_priority_issues, mark_problem_complete, annotate_component | Code quality |
| **CPG** | get_component_graph, list_file_components, suggest_related_changes | Code structure |

### HTTP API (metabob-cli → metabob-rpc-api)

| Endpoint | Purpose | Data Flow |
|----------|---------|-----------|
| `GET /activity-recommendations/recommendations` | Thompson Sampling search | Query params → Ranked templates |
| `POST /activity-recommendations/select` | Record selection | selection_id → execution tracking |
| `POST /activity-recommendations/record-step` | Step completion | Step result → real-time monitoring |
| `POST /activity-recommendations/record-outcome` | Final outcome | Complete execution → learning update |
| `GET /activity-templates/{id}` | Get template | template_id → full template spec |
| `POST /activity-templates` | Register template | Template data → SurrealDB storage |

### Event Bus (metabob-opencode internal)

| Event | When | Listeners |
|-------|------|-----------|
| `session.created` | New session | Sharing, logging |
| `session.negotiation` | Memory agent needs context | Activity coordination |
| `session.impulse.updated` | Impulse lifecycle | Metrics, debugging |

## Memory & Impulse Flow

### Turn Lifecycle
```
Request arrives
  ↓
Hook 10: Memory Management
  ├─→ Spawn memory agent session
  ├─→ Analyze intent (code_fix? feature_request?)
  ├─→ Create impulses (file, issue, bash)
  └─→ Load high-priority impulses
  ↓
Hook 15: Activity Recommendations  
  ├─→ MCP: search_activities()
  ├─→ Backend: Thompson Sampling
  └─→ Inject recommendations
  ↓
Hook 20: Metabob Context
  ├─→ MCP: get_priority_issues()
  ├─→ CLI: Cached analysis
  └─→ Inject code quality issues
  ↓
Main Agent Turn (prepared context loaded)
  - Has impulses
  - Has activity recommendations
  - Has code quality issues
  ↓
Post-Turn: Cleanup (if configured)
  - Unload low-priority impulses
  - Free memory for next turn
```

### Impulse Lifecycle
```
CREATE → LOAD → INJECT → USE → UNLOAD → CLEANUP
  ↓       ↓       ↓       ↓      ↓        ↓
 Pointer Content System Agent Memory  Persist
  only   loaded  prompt  refs   freed   stats
```

## Recording Levels

### Level 1: Message Recording ✅
**Where**: metabob-opencode Storage  
**What**: Messages, parts, tool calls, usage  
**Granularity**: Per message

### Level 2: Step Recording ✅
**Where**: metabob-cli FileState → Backend  
**What**: Step results, tool sequences, costs  
**Granularity**: Per activity step

### Level 3: Activity Recording ✅
**Where**: metabob-rpc-api SurrealDB  
**What**: Complete execution, comparison, validation  
**Granularity**: Per activity

### Level 4: Template Metrics ✅
**Where**: metabob-rpc-api SurrealDB  
**What**: Success rates, costs, Thompson params  
**Granularity**: Per template variant

### Level 5: Decision Recording ❌ (Future)
**Where**: All three systems  
**What**: Why decisions, alternatives, confidence  
**Granularity**: Per decision point

## Who Manages What

| Concern | Owner | Why |
|---------|-------|-----|
| **Agent execution** | metabob-opencode | Closest to LLM, session context |
| **Session storage** | metabob-opencode | Owns conversation history |
| **Context preparation** | metabob-opencode | Memory agent, impulse system |
| **Code analysis** | metabob-cli | File watching, CPG, caching |
| **Activity execution** | metabob-cli | Incremental delivery, state tracking |
| **Step recording** | metabob-cli | Closest to execution, reports to backend |
| **Template storage** | metabob-rpc-api | Single source of truth (SurrealDB) |
| **Learning algorithms** | metabob-rpc-api | Thompson Sampling, metrics, analytics |
| **Workflow orchestration** | metabob-rpc-api | Evolution triggers, task assignment |

## Key Design Decisions

### ✅ Incremental Step Delivery
**Decision**: Agent gets steps one at a time, NOT all upfront  
**Why**: Forces authentic execution, enables dynamic adjustment  
**Benefit**: True behavior recording, trailblazing possible

### ✅ Memory Agent as Separate Session
**Decision**: Memory prep runs in separate session  
**Why**: Isolates memory work from main conversation  
**Benefit**: Can optimize independently, track costs separately

### ✅ Backend Controls Learning
**Decision**: metabob-rpc-api manages recommendations & evolution  
**Why**: Centralized control, aggregate data, consistent algorithms  
**Benefit**: No client-side config drift, easier to improve

### ✅ MCP for Inter-Process Communication
**Decision**: stdio-based JSON-RPC, not HTTP  
**Why**: Tight coupling, low latency, type-safe  
**Benefit**: Fast (<50ms typical), reliable, easy to extend

### ✅ File Watching in metabob-cli
**Decision**: CLI watches files, not metabob-opencode  
**Why**: Closer to analysis engine, persistent process  
**Benefit**: Continuous analysis, cache warm, responsive

## Common Workflows

### Workflow A: Simple Bug Fix (No Activity)

```
User: "Fix this TypeError"
  ↓ Memory agent prepares context (impulses)
  ↓ Metabob injects issues
  ↓ Main agent fixes directly (no activity)
  ↓ Session recording: messages + tool calls

Recorded: Session level only
```

### Workflow B: Activity-Based Bug Fix

```
User: "Fix this TypeError"
  ↓ Memory agent prepares context
  ↓ Activity recommendations injected
  ↓ Agent: "I'll use fix-bug activity"
  ↓ Activity execution (3 steps)
  ↓ Step recording → Backend
  ↓ Outcome recording → Learning update

Recorded: Session + Activity + Steps + Learning
```

### Workflow C: Multi-Agent Activity

```
User: "Add new REST endpoint"
  ↓ Memory agent prepares context
  ↓ Agent: "I'll use add-rest-endpoint activity"
  ↓ Activity step 1: Config agent adds schema
    ↓ Subagent session created
    ↓ Schema agent executes
    ↓ Step result recorded
  ↓ Activity step 2: Session agent adds handler
    ↓ Subagent session created
    ↓ Session agent executes
    ↓ Step result recorded
  ↓ Activity step 3: Test agent adds tests
  ↓ All steps → Outcome recording → Learning

Recorded: Main session + 3 subagent sessions + Activity + Learning
```

## What Works Today

✅ **Session tracking** - All messages, parts, usage  
✅ **Activity execution** - Incremental steps, state tracking  
✅ **Step recording** - Full results to backend  
✅ **Outcome recording** - Complete execution + comparison  
✅ **Learning loop** - Thompson Sampling updates from outcomes  
✅ **Template metrics** - Success rate, cost, duration tracking  
✅ **Memory agent** - Intent analysis, impulse creation  
✅ **Turn lifecycle hooks** - Pre-turn context preparation  
✅ **File watching** - Continuous analysis, large project support  

## What's Next

🚀 **Phase 1: Explicit Decision Recording**
- Add `record_decision` MCP tool
- Agents call it for major decisions
- Captures alternatives and reasoning

🚀 **Phase 2: Context Effectiveness**
- Track which impulses are used
- Optimize token budgets
- Reduce wasted context

🚀 **Phase 3: Tool Pattern Analysis**
- Analyze effective tool sequences
- Learn from successful patterns
- Suggest better approaches

🔮 **Phase 4: Real-Time Intervention**
- Backend monitors execution live
- Suggests improvements mid-activity
- Prevents costly mistakes early

## Configuration: Minimal by Design

```json
{
  "metabob": {
    "cli_path": "metabob-cli",
    "base_url": "http://localhost:8080",
    "api_key": ""
  }
}
```

**That's all you need!** Everything else is automatic:
- ✅ Activity learning managed by backend
- ✅ Template registration in create-activity-template workflow
- ✅ File watching with intelligent defaults
- ✅ All core features always enabled
- ✅ Context preparation automatic
- ✅ Recording comprehensive

## Quick Answers

**Q: Where are activity templates stored?**  
A: metabob-rpc-api backend (SurrealDB), accessed via metabob-cli MCP

**Q: Where are sessions stored?**  
A: metabob-opencode Storage (`~/.opencode/storage/`)

**Q: Where is analysis cached?**  
A: metabob-cli FileStateManager (`.metabob/state`)

**Q: How are activities registered?**  
A: Via `create-activity-template` workflow → metabob-cli MCP → backend

**Q: How is agent behavior recorded?**  
A: Messages in opencode Storage, steps in CLI → backend, outcomes in backend

**Q: Where does learning happen?**  
A: metabob-rpc-api backend (Thompson Sampling, metrics, evolution)

**Q: How do agents get context?**  
A: Memory agent (pre-turn) → impulses → system prompt injection

**Q: Who triggers template evolution?**  
A: metabob-rpc-api backend sends tasks to agents when needed

**Q: How do large projects work?**  
A: metabob-cli auto-switches to polling mode, 70+ exclusion patterns

**Q: What if backend is down?**  
A: metabob-cli caches analysis, metabob-opencode works with local storage
