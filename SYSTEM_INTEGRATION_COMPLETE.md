# Metabob System Integration: Complete Picture

## TL;DR: How It All Works Together

```
metabob-opencode: Agent orchestration, session management, context preparation
        ↕ MCP stdio (JSON-RPC)
metabob-cli: Code analysis, activity execution, behavior recording
        ↕ HTTP/WebSocket
metabob-rpc-api: Learning, storage, workflow orchestration
```

All three applications work as **one unified system** with clear responsibilities.

## Component Responsibilities

### metabob-opencode: The Agent Brain

**What it does:**
1. **Agent Execution** - Runs primary agents (activity, plan, review) and subagents
2. **Session Management** - Tracks conversations, messages, tool calls
3. **Context Preparation** - Memory agent analyzes intent, creates impulses
4. **Activity Coordination** - Links sessions to activities, manages lifecycle
5. **Turn Lifecycle** - Pre-turn hooks for memory, recommendations, metabob context

**What it DOESN'T do:**
- ❌ Code analysis (delegates to metabob-cli)
- ❌ Activity template storage (backend responsibility)
- ❌ Learning metrics (backend responsibility)
- ❌ Template evolution (backend sends tasks)

**Key Data Structures:**
```typescript
Session: {
  id, projectID, directory, activityId, title,
  messages[], parts[], usage{ tokens, cost }
}

Activity: {
  id, templateId, status, prompts[], commits[], stats
}

Impulse: {
  id, type, pointer, description, budget, priority,
  loaded: boolean, content?: string, tokenCount?: number
}
```

### metabob-cli: The Code Analysis Engine

**What it does:**
1. **MCP Server** - Exposes tools to metabob-opencode (20+ tools)
2. **Activity Execution** - Incremental step delivery, state tracking
3. **Behavior Recording** - Step results, tool calls, costs
4. **Backend Communication** - HTTP bridge to metabob-rpc-api
5. **File Watching** - Monitor codebase changes, trigger analysis
6. **State Persistence** - Session tokens, file hashes, analysis cache

**What it DOESN'T do:**
- ❌ Agent orchestration (metabob-opencode responsibility)
- ❌ Template creation (agents create, backend stores)
- ❌ Learning algorithms (backend responsibility)
- ❌ Session memory (metabob-opencode responsibility)

**Key Data Structures:**
```python
ActivityExecution: {
  execution_id, activity_id, variant_id, selection_id,
  session_id, current_step_index, state,
  step_results: [StepResult], total_cost, total_tokens,
  cost_budget, trailblazing_attempts
}

StepResult: {
  step_id, success, output, error,
  cost, tokens, duration_ms, tool_calls[]
}

FileState: {
  session_token, session_id, file_hashes,
  analysis_results, job_state, last_activity
}
```

### metabob-rpc-api: The Backend Brain

**What it does:**
1. **Template Storage** - SurrealDB persistence for all templates
2. **Learning System** - Thompson Sampling, success rate tracking
3. **Activity Recommendations** - Ranked suggestions based on context
4. **Workflow Orchestration** - Triggers template evolution tasks
5. **Analytics** - Aggregate execution data, identify improvements
6. **Quality Gates** - Validation rules, quality enforcement

**What it DOESN'T do:**
- ❌ Agent execution (metabob-opencode responsibility)
- ❌ Code analysis (metabob-cli responsibility)
- ❌ File watching (metabob-cli responsibility)
- ❌ Session management (metabob-opencode responsibility)

**Key Data Structures:**
```python
ActivityTemplate: {
  id, name, description, category, tasks[],
  executions, success_rate, avg_cost, avg_duration,
  thompson_alpha, thompson_beta,
  component_accuracy_history[], cochange_patterns
}

ActivityExecution: {
  execution_id, variant_id, selection_id,
  success, duration_ms, cost, step_results[],
  comparison{ component_accuracy, cost_delta, duration_delta },
  quality_validation, performance_metrics
}
```

## Data Flow: Complete Lifecycle

### 1. User Starts Session (No Activity Yet)

```
USER: "Fix the TypeError in Tool.execute"

metabob-opencode:
  ├─→ Session.create()
  │   - Assigns session ID: "ses_123"
  │   - Stores in OpenCode Storage
  │   - Tracks: directory, projectID, title
  │
  ├─→ TurnLifecycle Hook 1: Memory Management (priority 10)
  │   │
  │   ├─→ Create Memory Agent Session (ses_mem_456)
  │   │   - Separate session ID
  │   │   - Activity.registerSessionMemory(ses_mem_456)
  │   │
  │   ├─→ Memory Agent: analyzeIntent()
  │   │   - Classifies as: "code_fix"
  │   │   - Confidence: 0.95
  │   │   - Suggests impulses:
  │   │     * file: "src/tool.ts" (errorFile)
  │   │     * file: "test/tool/bash.test.ts" (relatedTest)
  │   │     * bashOutput: "git log --oneline -10" (recentChanges)
  │   │
  │   ├─→ Memory Agent: Create & Load Impulses
  │   │   - SessionMemory.create() × 3
  │   │   - SessionMemory.load() × 3
  │   │   - Total: 3200 tokens loaded, $0.01 cost
  │   │
  │   └─→ Memory Agent Session Recorded:
  │       - Messages: memory agent analysis
  │       - Tool calls: impulse_create × 3, impulse_load × 3
  │       - Cost: $0.01, Tokens: 800
  │
  ├─→ TurnLifecycle Hook 2: Activity Recommendations (priority 15)
  │   │
  │   └─→ MCP call: search_activities(query="TypeError fix", category="bugfix")
  │       │
  │       └─→ metabob-cli → backend: GET /activity-recommendations/recommendations
  │           │
  │           └─→ Backend: Thompson Sampling
  │               - Explores: try "debug-with-tests" (low executions)
  │               - Exploits: favor "fix-bug" (high success rate)
  │               - Returns: [
  │                   { activity_id: "fix-bug", success_rate: 0.86, selection_id: "sel_789" },
  │                   { activity_id: "debug-with-tests", success_rate: 0.72, selection_id: "sel_790" }
  │                 ]
  │
  ├─→ TurnLifecycle Hook 3: Metabob Context (priority 20)
  │   │
  │   └─→ MCP call: get_priority_issues()
  │       │
  │       └─→ metabob-cli: Cached analysis results
  │           └─→ Returns: 3 MEDIUM+ issues in src/tool.ts
  │
  └─→ Main Agent Turn Begins:
      System Prompt includes:
        <impulse_context>
          [errorFile content - 1450 tokens]
          [relatedTest content - 950 tokens]
          [recentChanges output - 800 tokens]
        </impulse_context>
        
        <activity_recommendations>
          - fix-bug (success rate: 86%)
          - debug-with-tests (success rate: 72%)
        </activity_recommendations>
        
        <code_quality_issues>
          - Issue #142: Missing null check in Tool.execute
          - Issue #143: Error handling could be improved
        </code_quality_issues>
```

**Recorded at this point:**
- ✅ Memory agent session (messages, costs)
- ✅ Intent classification (code_fix, 0.95 confidence)
- ✅ Impulses created and loaded
- ✅ Activity recommendations retrieved
- ✅ Metabob issues injected

### 2. Agent Decides to Use Activity

```
USER AGENT: "I'll use the fix-bug activity to resolve this TypeError"

metabob-opencode:
  └─→ activity() tool call
      │
      └─→ MCP: start_activity_execution(
            activity_id="fix-bug",
            session_id="ses_123",
            variables={ component: "Tool.execute", file: "src/tool.ts" },
            reason="TypeError when bash fails"
          )
          │
          └─→ metabob-cli: ActivityManager.start_execution()
              │
              ├─→ Generate: execution_id = "exec_456"
              │
              ├─→ HTTP: POST /activity-recommendations/select
              │   Body: {
              │     "selection_id": "sel_789",  # From recommendations
              │     "variant_id": "fix-bug_v2_abc123",
              │     "context": {
              │       "session_id": "ses_123",
              │       "reason": "TypeError when bash fails",
              │       "variables": {...}
              │     }
              │   }
              │   │
              │   └─→ Backend: Record selection decision
              │       - Thompson Sampling updates
              │       - Tracks: which variant was chosen
              │       - Links: execution_id → selection_id
              │
              ├─→ Load template into cache
              │   - GET /activity-templates/fix-bug?variant=v2_abc123
              │   - Full template with all steps
              │   - Stored in _activity_cache (NOT returned to agent)
              │
              ├─→ Create ActivityExecution
              │   {
              │     execution_id: "exec_456",
              │     activity_id: "fix-bug",
              │     variant_id: "fix-bug_v2_abc123",
              │     selection_id: "sel_789",
              │     session_id: "ses_123",
              │     current_step_index: 0,
              │     state: PENDING,
              │     step_results: [],
              │     total_cost: 0.0,
              │     cost_budget: 1.0,
              │     variables: {...}
              │   }
              │
              └─→ Return metadata (NOT steps):
                  {
                    "execution_id": "exec_456",
                    "activity_id": "fix-bug",
                    "variant_id": "fix-bug_v2_abc123",
                    "task_count": 3,  # How many steps, but NOT what they are
                    "context_requirements": [...],
                    "cost_budget": 1.0
                  }
  
  ├─→ Session.createForActivity()
  │   - Creates activity session: "ses_act_789"
  │   - Links to main session via parentID
  │   - Stores activityId field
  │
  └─→ Activity.registerSession(ses_act_789, "act_abc")
      - Maps session → activity for context lookup
```

**Recorded at this point:**
- ✅ Activity selection (which one, why)
- ✅ Variables and reason
- ✅ Backend tracks selection_id → execution_id link
- ✅ Activity session created
- ✅ Session→activity mapping established

### 3. Incremental Step Execution

```
STEP LOOP (3 iterations for 3-step activity):

╔═══════════════════════════════════════════════════════════╗
║ STEP 1: Diagnose                                          ║
╚═══════════════════════════════════════════════════════════╝

metabob-opencode (Activity Session ses_act_789):
  │
  ├─→ MCP: get_next_step(execution_id="exec_456")
  │   │
  │   └─→ metabob-cli: ActivityManager.get_next_step()
  │       - Checks: execution.current_step_index = 0
  │       - Gets: tasks[0] from cached template
  │       - Returns: ONLY step 0, NOT steps 1-2
  │       │
  │       └─→ {
  │             "execution_id": "exec_456",
  │             "step_index": 0,
  │             "total_steps": 3,
  │             "current_step": {
  │               "step_id": "diagnose",
  │               "title": "Diagnose root cause",
  │               "description": "Analyze the error and identify where to fix",
  │               "prompt_template": "{{variables.file}} has an error. Find the cause...",
  │               "tools": {
  │                 "required": ["read"],
  │                 "optional": ["grep", "metabob_search"],
  │                 "disabled": ["write", "str_replace"]
  │               }
  │             },
  │             "variables": { component: "Tool.execute", file: "src/tool.ts" },
  │             "cost_remaining": 1.0
  │           }
  │
  ├─→ Task Agent: Execute Step 0
  │   - System prompt includes step instructions
  │   - Agent uses tools: read, grep, metabob_search
  │   - Agent produces output: "Root cause: missing null check at line 142..."
  │   - Tracks tool calls internally
  │
  └─→ MCP: report_step_result(
        execution_id="exec_456",
        step_id="diagnose",
        success=true,
        output="Root cause: missing null check...",
        cost=0.08,
        tokens=3000,
        tool_calls=[
          {tool: "read", args: {...}, duration_ms: 50},
          {tool: "grep", args: {...}, duration_ms: 30},
          {tool: "metabob_search", args: {...}, duration_ms: 200}
        ]
      )
      │
      └─→ metabob-cli: ActivityManager.report_step_result()
          │
          ├─→ Create StepResult and store
          │   - execution.step_results.append(result)
          │   - execution.total_cost += 0.08
          │   - execution.total_tokens += 3000
          │   - execution.current_step_index = 1
          │
          ├─→ HTTP: POST /activity-recommendations/record-step
          │   - Real-time step result to backend
          │   - Backend tracks progress
          │   - Backend can monitor and intervene
          │
          └─→ Return next action:
              { "continue": true, "message": "Step 0 complete" }

╔═══════════════════════════════════════════════════════════╗
║ STEP 2: Fix (repeats same flow)                          ║
╚═══════════════════════════════════════════════════════════╝

[get_next_step → execute → report_step_result]
- Step index: 1
- Tools: str_replace, read_lints (now allowed!)
- Output: "Added null check at line 142"
- Cost: $0.07, Tokens: 2800

╔═══════════════════════════════════════════════════════════╗
║ STEP 3: Test (final step)                                ║
╚═══════════════════════════════════════════════════════════╝

[get_next_step → execute → report_step_result]
- Step index: 2
- Tools: shell
- Output: "Tests passing (15 pass, 0 fail)"
- Cost: $0.11, Tokens: 4500
```

**Recorded for entire activity:**
- ✅ 3 step results with full detail
- ✅ Tool calls for each step (9 total tools used)
- ✅ Cost per step ($0.08, $0.07, $0.11 = $0.26)
- ✅ Tokens per step (3000, 2800, 4500 = 10300)
- ✅ Duration per step (3s, 5s, 10s = 18s)

### 4. Activity Completion & Learning

```
metabob-cli: All steps complete
  │
  ├─→ ActivityManager._check_completion()
  │   - Validates all steps successful
  │   - Runs validation commands if configured
  │   - Calculates final metrics
  │
  └─→ HTTP: POST /activity-recommendations/record-outcome
      Body: {
        "selection_id": "sel_789",  # Links back to selection
        "success": true,
        "duration_ms": 18000,
        "cost": 0.26,
        "tokens": 10300,
        "step_results": [...],  # All 3 steps
        "comparison": {
          "component_accuracy": 0.92,  # Expected 2 files, modified 2+1 extra
          "cost_delta": -0.02,  # $0.02 cheaper than expected
          "duration_delta_ms": -2000,  # 2s faster
          "cochange_accuracy": 0.0  # Predictions were wrong
        },
        "quality_validation": {
          "tests_passed": 15,
          "issues_fixed": 1,
          "issues_introduced": 0
        }
      }
      │
      └─→ metabob-rpc-api: Learning System Update
          │
          ├─→ Thompson Sampling Update
          │   - Variant v2_abc123: alpha += 1 (success)
          │   - Recalculate success rate: 36/42 → 37/43 = 0.860
          │   - Update selection probability
          │
          ├─→ Template Metrics Update
          │   - executions: 42 → 43
          │   - avg_cost: $0.28 → $0.277 (improving!)
          │   - avg_duration: 20000ms → 19953ms (faster!)
          │   - component_accuracy_history.push(0.92)
          │
          ├─→ Store Complete Execution
          │   - Full record in SurrealDB
          │   - Available for analytics
          │   - Used for template evolution
          │
          └─→ Check Evolution Triggers
              ✗ success_rate (0.860) > threshold (0.7) → no evolution needed
              ✓ cost_delta negative → performing well
              ✗ component_accuracy (0.92) > threshold (0.8) → acceptable
              
              Decision: No evolution triggered, template is performing well

metabob-opencode: Cleanup
  │
  ├─→ ActivityOutcomeRecorder.recordOutcome()
  │   - Records outcome locally (backup)
  │   - Sends to backend (already done by CLI)
  │
  ├─→ Activity.unregisterSession(ses_act_789)
  │   - Remove session→activity mapping
  │   - Cleanup memory agent session
  │
  └─→ Session.updateMessage (final summary)
      - "Activity complete: Fixed TypeError in 18m, $0.26"
```

**Learning loop complete:**
- ✅ Execution → Recording → Analysis → Template Update
- ✅ Success rate improved: 0.857 → 0.860
- ✅ Cost improved: $0.28 → $0.277
- ✅ Duration improved: 20000ms → 19953ms
- ✅ Template getting better over time!

## Session Memory & Impulse System

### Memory Agent: The Context Preparer

**Role**: ROUTER, not CODER
- Analyzes user intent BEFORE main agent runs
- Decides which context to load
- Creates impulses (lazy-loaded pointers)
- Prepares context within token budgets

**Flow:**
```
1. Memory Agent analyzes user message (Claude Haiku, <2s, <$0.01)
   ↓
2. Classifies intent: code_fix, feature_request, question, refactor, exploration, other
   ↓
3. Suggests impulses based on intent:
   - code_fix → errorFile + relatedTests + recentChanges
   - feature_request → similarFeatures + designDocs + tests
   - question → relevantFiles + documentation
   ↓
4. Creates impulses (pointers only, no content yet)
   ↓
5. Loads high-priority impulses (resolves content)
   ↓
6. Main agent gets prepared context in system prompt
```

**Why Separate Session?**
- Keeps memory agent work isolated
- Tracks memory prep cost separately
- Can optimize memory agent independently
- No interference with main agent conversation

### Impulse Types & Use Cases

| Impulse Type | When to Use | Example |
|--------------|-------------|---------|
| `memo` | Short text/data | Stack trace, error message |
| `file` | Source files | `src/tool.ts` lines 135-155 |
| `component` | Specific code component | `Tool.execute` function |
| `commit` | Git history | Recent commit that broke something |
| `metabobIssue` | Code quality issue | Issue #142 details |
| `metabobAnnotation` | Component docs | Why Tool.execute was designed this way |
| `activityOutput` | Previous activity result | Output from related activity |
| `bashOutput` | Command output | `git log`, `find`, `ls` results |
| `templateDefinition` | Activity templates | Template for similar workflow |
| `activityRecommendation` | Activity suggestions | Ranked templates from backend |

### Impulse Lifecycle

```
1. CREATION (Memory Agent)
   SessionMemory.create(sessionId, {
     id: "errorFile",
     type: "file",
     pointer: { type: "file", path: "src/tool.ts", offset: 135, limit: 20 },
     description: "File containing TypeError",
     priority: "high",
     budget: 2000  # Max tokens for this content
   })
   
   State: loaded=false, content=undefined

2. LOADING (Before main agent turn)
   const loaded = SessionMemory.load(sessionId, "errorFile")
   - Reads file content
   - Applies token budget (truncates if > 2000 tokens)
   - Stores content in memory
   
   State: loaded=true, content="[file contents]", tokenCount=1450

3. INJECTION (System prompt)
   <impulse_context>
     <impulse id="errorFile" type="file" tokens="1450/2000">
       [file content here]
     </impulse>
   </impulse_context>

4. USAGE (Main agent references it)
   Agent: "Looking at Tool.execute (line 142), I see the issue..."
   
   TRACKED (future):
   - impulse "errorFile" was referenced
   - Contributed to solution
   - All 1450 tokens were relevant (0 wasted)

5. UNLOADING (Free memory)
   SessionMemory.unload(sessionId, "errorFile")
   - Keeps pointer
   - Removes content
   - Frees ~1450 tokens of memory
   
   State: loaded=false, content=undefined

6. RELOADING (If needed again)
   SessionMemory.load(sessionId, "errorFile")
   - Re-reads content from pointer
   - Applies budget again
   
   TRACKED:
   - loadCount += 1
   - totalCost += cost_of_reload
   - Helps optimize: should this be kept loaded?

7. CLEANUP (Activity or session ends)
   SessionMemory.cleanup(sessionId)
   - Removes all impulses
   - Stores usage stats for learning
   - Frees all memory
```

## Recording: What Works Today

### ✅ Fully Implemented

**1. Message & Tool Call Recording**
- Location: metabob-opencode Storage
- Granularity: Per message, per tool call
- Data: Full arguments, results, timing, cost
- Access: `Session.messages()`, `Session.usage()`

**2. Step Result Recording**
- Location: metabob-cli FileStateManager → Backend API
- Granularity: Per activity step
- Data: Success, output, cost, tokens, tool calls
- Access: `ActivityManager.report_step_result()`

**3. Activity Outcome Recording**
- Location: metabob-rpc-api SurrealDB
- Granularity: Complete activity execution
- Data: All steps, comparison, validation, metrics
- Access: Backend analytics API

**4. Template Metrics**
- Location: metabob-rpc-api SurrealDB
- Granularity: Per template variant
- Data: Success rate, avg cost/duration, Thompson params
- Access: `GET /activity-templates/{id}/metrics`

### ❌ Not Yet Implemented (Future)

**1. Decision Point Recording**
```python
# When agent makes major decision
record_decision({
  "step": 0,
  "decision": "Check Tool.execute first",
  "reasoning": "Stack trace points there",
  "alternatives": ["Check bash tool", "Search similar issues"],
  "confidence": 0.9
})
```

**2. Context Effectiveness Tracking**
```typescript
// After step completes
analyzeContextUsage({
  impulseId: "errorFile",
  referenced: true,  // Agent mentioned it
  keyInsight: true,  // Led to solution
  tokensEffective: 1450,
  tokensWasted: 0
})
```

**3. Tool Pattern Analysis**
```python
# Automatic analysis by backend
findEffectiveToolPatterns([
  "read → grep → metabob_search" → diagnosis
  "str_replace → read_lints" → implementation
  "shell" → validation
])
# → Learns: This sequence works well for bug fixes
```

**4. Subagent Performance Tracking**
```typescript
// When delegating to subagent
trackDelegation({
  subagent: "config",
  taskQuality: 0.9,  // How well was task specified
  executionQuality: 0.95,  // How well did subagent do
  handoffEfficiency: 0.85  // Ratio of useful info provided
})
```

## How to Record ALL Agent Behavior

### Immediate Implementation (Phase 1)

**Add 3 MCP Tools to metabob-cli:**

```python
@mcp.tool()
async def record_agent_decision(
    session_id: str,
    step: int,
    decision: str,
    reasoning: str,
    alternatives: list[str] = None,
    confidence: float = 0.5,
    context: str = ""
) -> dict:
    """Record major decision point."""
    # Add to ActivityExecution.step_results[step].decisions[]
    # Send to backend asynchronously
    return {"recorded": True}

@mcp.tool()
async def record_impulse_usage(
    session_id: str,
    impulse_id: str,
    usage_type: str,  # "referenced" | "key_insight" | "ignored"
    contribution: str = ""
) -> dict:
    """Track impulse effectiveness."""
    # Update impulse usage stats
    # Feed into budget optimization
    return {"recorded": True}

@mcp.tool()
async def record_tool_strategy(
    session_id: str,
    strategy: str,  # "exploratory" | "targeted" | "recovery"
    phase: str = ""  # "diagnosis" | "implementation" | "validation"
) -> dict:
    """Record tool usage approach."""
    # Helps understand agent methodology
    return {"recorded": True}
```

**Modify Activity Agent Prompt to Use These:**
```
You have access to behavior recording tools:
- record_agent_decision: Call when making major decisions
- record_impulse_usage: Call when an impulse is helpful (or not)
- record_tool_strategy: Call when changing approach

Example:
"I'll check Tool.execute first since the stack trace points there."

record_agent_decision({
  step: 0,
  decision: "Check Tool.execute implementation",
  reasoning: "Stack trace points to line 142",
  alternatives: ["Check bash tool", "Search for similar issues"],
  confidence: 0.9
})
```

**Benefits:**
- High-quality explicit recording
- Agent self-reports decisions
- Captures reasoning and alternatives
- Can be made optional (graceful degradation)

### Medium-Term (Phase 2)

**Automatic Extraction Layer:**
```python
# metabob-cli: Extract decisions from output automatically
def enrich_step_result(result: StepResult) -> StepResult:
    """Add extracted metadata to step result."""
    
    result.extracted_decisions = extract_decisions(result.output)
    result.tool_strategy = infer_strategy(result.tool_calls)
    result.confidence_indicators = find_confidence_phrases(result.output)
    result.error_recovery = detect_recovery(result.tool_calls, result.output)
    
    return result
```

**Message Metadata Layer:**
```typescript
// metabob-opencode: Add metadata to messages
Session.updateMessage({
  ...message,
  metadata: {
    activityPhase: detectPhase(message),  // diagnosis | implementation | validation
    toolStrategy: inferStrategy(toolCalls),  // exploratory | targeted
    confidence: estimateConfidence(message.text),
    impulsesReferenced: findImpulseReferences(message.text, loadedImpulses),
    decisionsDetected: extractDecisions(message.text)
  }
})
```

### Long-Term (Phase 3)

**Backend Analytics Engine:**
```python
class AgentBehaviorAnalyzer:
    def analyze_template_effectiveness(self, template_id: str):
        """Deep analysis of template performance."""
        
        executions = get_executions(template_id, limit=100)
        
        # Analyze decision patterns
        decision_analysis = self.analyze_decisions(executions)
        # → Which decisions lead to success?
        # → Which alternatives should be tried?
        
        # Analyze tool patterns
        tool_analysis = self.analyze_tool_sequences(executions)
        # → What sequences are most effective?
        # → Which tools are underutilized?
        
        # Analyze context effectiveness
        context_analysis = self.analyze_context_usage(executions)
        # → Which impulses are actually helpful?
        # → Optimize token budgets
        
        # Generate evolution recommendations
        return {
            "improve_prompts": [
                "Step 1: Add hint about checking error handling path",
                "Step 2: Suggest null check pattern explicitly"
            ],
            "optimize_budgets": [
                "Reduce errorFile budget: 2000 → 1500 tokens",
                "Increase relatedTest budget: 1500 → 2000 tokens"
            ],
            "reorder_steps": [],  # Current order is optimal
            "add_validation": [
                "Add linter check after step 2"
            ]
        }
```

## Integration Summary

### What metabob-opencode Provides:
1. **Agent Orchestration** - Primary agents, subagents, coordination
2. **Session Tracking** - Messages, parts, usage, history
3. **Context Preparation** - Memory agent, impulses, turn hooks
4. **Activity Lifecycle** - Session→activity mapping, cleanup
5. **Template Interface** - TemplateRepository, TemplateProvider
6. **Outcome Recording** - ActivityOutcomeRecorder (local backup)

### What metabob-cli Provides:
1. **MCP Interface** - 20+ tools exposed to metabob-opencode
2. **Activity Execution** - Incremental step delivery, state tracking
3. **Step Recording** - Full step results to backend
4. **Backend Bridge** - HTTP communication to metabob-rpc-api
5. **File Analysis** - Watching, CPG, issue detection
6. **State Persistence** - Session tokens, analysis cache

### What metabob-rpc-api Provides:
1. **Template Storage** - Single source of truth (SurrealDB)
2. **Learning System** - Thompson Sampling, metrics, analytics
3. **Activity Recommendations** - Ranked template suggestions
4. **Workflow Orchestration** - Evolution triggers, task assignment
5. **Quality Gates** - Validation enforcement
6. **Analytics** - Aggregate data, insights, optimizations

### How They Work Together:

```
metabob-opencode: "I need code quality context for this file"
        ↓ MCP: get_priority_issues(file_path)
metabob-cli: "Here are 3 issues from my analysis cache"
        ↓ (metabob-cli already got these from backend earlier via file watching)
metabob-rpc-api: (provided analysis asynchronously via WebSocket)

---

metabob-opencode: "What activities are available for bug fixing?"
        ↓ MCP: search_activities(query="bug fix", category="bugfix")
metabob-cli: "Let me query the backend..."
        ↓ HTTP: GET /activity-recommendations/recommendations
metabob-rpc-api: "Based on Thompson Sampling, try fix-bug (86% success)"
        ↓ HTTP response
metabob-cli: "Here are the recommendations"
        ↓ MCP response
metabob-opencode: "I'll use fix-bug activity"

---

metabob-opencode: "Start executing fix-bug activity"
        ↓ MCP: start_activity_execution(activity_id, variables, reason)
metabob-cli: "Creating execution state, notifying backend..."
        ↓ HTTP: POST /activity-recommendations/select
metabob-rpc-api: "Selection recorded, tracking execution_id → selection_id"
        ↓ HTTP response
metabob-cli: "Execution started, here's metadata (NOT steps)"
        ↓ MCP response
metabob-opencode: "Ready to execute, creating activity session"

---

metabob-opencode: "Get first step"
        ↓ MCP: get_next_step(execution_id)
metabob-cli: "Here's step 0 (NOT steps 1-2)"
        ↓ MCP response
metabob-opencode: Agent executes step 0
metabob-opencode: "Step 0 done"
        ↓ MCP: report_step_result(execution_id, step_id, success, ...)
metabob-cli: "Recorded, sending to backend..."
        ↓ HTTP: POST /activity-recommendations/record-step
metabob-rpc-api: "Step received, activity progressing well"
        ↓ (monitors execution in real-time)

---

(Repeat get_next_step → execute → report for all steps)

---

metabob-opencode: "Final step complete"
        ↓ MCP: report_step_result(last step)
metabob-cli: "All steps done, validating..."
        ↓ Run validation, calculate metrics
        ↓ HTTP: POST /activity-recommendations/record-outcome
metabob-rpc-api: "Execution complete, updating learning metrics..."
        ↓ Thompson Sampling update
        ↓ Template metrics update
        ↓ Check evolution triggers
        ↓ HTTP response: { "success": true }
metabob-cli: "Activity complete"
        ↓ MCP response
metabob-opencode: "Cleanup session mappings, return summary"
```

## Future: Dynamic Configuration from metabob-opencode

### Phase 1: File Watching Optimization

Currently metabob-cli uses static config for file watching. Future:

```typescript
// metabob-opencode: Analyze project structure
const analysis = await analyzeProject({
  cwd: Instance.directory,
  detectLanguages: true,
  estimateSize: true,
  findBulkyDirs: true
})

// → Detects:
// - Languages: TypeScript, Python
// - Size: ~45,000 files
// - Bulky: node_modules/ (128k files), .git/ (23k objects)
// - Source patterns: src/**/*.ts, test/**/*.test.ts

// Send optimized config to metabob-cli
await metabob_configure_watch({
  includePatterns: [
    "src/**/*.ts",
    "src/**/*.tsx", 
    "test/**/*.ts",
    "*.json",
    "*.md"
  ],
  excludePatterns: [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**"
  ],
  forcePolling: analysis.estimatedFiles > 100000,
  pollingInterval: analysis.estimatedFiles > 100000 ? 5.0 : 2.0
})
```

**Benefits:**
- Project-specific optimization
- Adapts as project grows
- No manual configuration
- Optimal performance

### Phase 2: Activity Template Registration

Currently templates registered manually. Future:

```typescript
// create-activity-template workflow includes registration steps
// Template.tasks includes:
{
  id: "register-with-backend",
  subagent: "memory",  // Has MCP access
  description: "Register template with metabob-rpc-api",
  prompt: {
    template: `Register the activity template:
    
    Name: {{name}}
    Category: {{category}}
    Tasks: {{taskCount}}
    
    Use MCP tool: metabob_register_template
    `
  }
}
```

**Flow:**
1. Agent creates template locally
2. create-activity-template workflow executes
3. Registration step calls metabob-cli MCP
4. metabob-cli → backend: POST /activity-templates
5. Backend stores in SurrealDB
6. Returns template_id

**Benefits:**
- Registration is part of workflow
- No separate config needed
- Guaranteed registration when template created
- Traceable (registration is a step in activity)

## Conclusion: A Well-Integrated System

### Clear Separation of Concerns

| System | Role | Storage | Knows About |
|--------|------|---------|-------------|
| metabob-opencode | Agent & Session | OpenCode Storage | Sessions, messages, impulses |
| metabob-cli | Analysis & Execution | FileState + Backend | Analysis, executions, steps |
| metabob-rpc-api | Learning & Storage | SurrealDB | Templates, metrics, outcomes |

### Data Flows Between All Three

**Forward Flow** (User → Backend):
```
User message
  → metabob-opencode (session recording)
    → MCP
      → metabob-cli (step recording)
        → HTTP
          → metabob-rpc-api (learning storage)
```

**Backward Flow** (Backend → User):
```
metabob-rpc-api (recommendations, templates)
  → HTTP response
    → metabob-cli (caching, state)
      → MCP response
        → metabob-opencode (context injection)
          → Agent system prompt
            → User sees results
```

### Everything Gets Recorded

**Today:**
- ✅ Sessions, messages, tool calls
- ✅ Activity steps, costs, timing
- ✅ Outcomes, comparisons, metrics
- ✅ Template performance, learning data

**Tomorrow:**
- ☐ Decisions with alternatives
- ☐ Context effectiveness
- ☐ Tool pattern analysis
- ☐ Real-time intervention

The foundation is excellent. Adding comprehensive behavior recording is primarily about exposing the right MCP tools and having agents use them systematically.
