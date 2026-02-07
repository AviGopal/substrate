# Agent Behavior Recording: Complete System Design

## Recording Philosophy

**Goal**: Capture every aspect of agent execution to enable:
1. Learning and optimization (template evolution)
2. Debugging and transparency (why did agent do X?)
3. Quality assurance (did agent follow best practices?)
4. Cost optimization (which approaches are most efficient?)

## What Gets Recorded Where

### Level 1: Session & Message Recording (metabob-opencode)

**Stored in**: OpenCode Storage (`~/.opencode/storage/`)

```typescript
// Every agent message and its parts
Session.updateMessage({
  id: "msg_123",
  sessionID: "ses_456",
  role: "assistant",
  text: "I'll fix the TypeError by adding a null check...",
  tokens: {
    input: 5000,
    output: 1200,
    cache: { read: 3000, write: 500 }
  },
  cost: 0.05,
  provider: "anthropic",
  model: "claude-sonnet-4-5",
  finish_reason: "stop"
})

// Every tool call as a part
Session.updatePart({
  id: "part_789",
  messageID: "msg_123",
  sessionID: "ses_456",
  type: "tool_call",
  name: "str_replace",
  args: { path: "src/tool.ts", old_string: "...", new_string: "..." },
  result: "File updated successfully",
  duration_ms: 120
})
```

**What this captures:**
- ✅ Complete conversation history
- ✅ All tool calls with arguments and results
- ✅ Token usage per message
- ✅ Cost per message
- ✅ Model and provider used
- ✅ Timing data

**What's missing:**
- ❌ Why agent chose specific tool
- ❌ What alternatives were considered
- ❌ How context influenced decision
- ❌ Confidence in approach

### Level 2: Activity Step Recording (metabob-cli)

**Stored in**: FileStateManager → Backend API

```python
# After each activity step completes
StepResult(
    step_id="diagnose",
    success=True,
    output="Root cause: missing null check at line 142. "
           "The error occurs when bash command fails and stdout is undefined.",
    error=None,
    cost=0.05,
    tokens=1200,
    duration_ms=3000,
    tool_calls=[
        {
            "tool": "read",
            "args": {"path": "src/tool.ts", "offset": 135, "limit": 20},
            "result_size": 450,
            "duration_ms": 50
        },
        {
            "tool": "grep",
            "args": {"pattern": "stdout", "path": "src/tool.ts"},
            "match_count": 3,
            "duration_ms": 30
        },
        {
            "tool": "metabob_search_codebase_issues",
            "args": {"query": "undefined stdout"},
            "result_count": 2,
            "duration_ms": 200
        }
    ]
)
```

**What this captures:**
- ✅ Step-by-step execution record
- ✅ Success/failure per step
- ✅ Cost and tokens per step
- ✅ Tool sequence (order matters!)
- ✅ Tool arguments and result sizes
- ✅ Timing per tool call

**What's missing:**
- ❌ Why this tool sequence?
- ❌ Decision points within step
- ❌ Context that influenced approach
- ❌ Alternatives tried and discarded

### Level 3: Activity Outcome Recording (metabob-opencode → metabob-cli → backend)

**Sent to**: metabob-rpc-api

```typescript
ActivityOutcome {
  activityId: "act_123",
  templateId: "fix-bug",
  executionId: "exec_456",
  selectionId: "sel_789",  // For Thompson Sampling update
  
  // Expectations (before execution)
  expectation: {
    expectedComponents: ["Tool.execute", "bash.test.ts"],
    expectedDurationMs: 15000,
    expectedCost: 0.25,
    predictedCochanges: ["error-handler.ts"],
    correlationId: "corr_abc"
  },
  
  // Reality (after execution)
  actualComponents: ["Tool.execute", "bash.test.ts", "tool.ts"],  // Extra file!
  actualDurationMs: 18000,  // 3s slower
  actualCost: 0.23,  // $0.02 cheaper!
  actualCochanges: [],  // Didn't touch error-handler
  
  // Comparison (learning data)
  comparison: {
    componentAccuracy: 0.66,  // 2/3 files matched
    missedComponents: [],
    extraComponents: ["tool.ts"],  // Why was this modified?
    costDelta: -0.02,  // Better than expected!
    durationDeltaMs: 3000,  // Slower than expected
    cochangeAccuracy: 0.0  // Prediction was wrong
  },
  
  // Agent decisions (captured during execution)
  decisions: [
    {
      step: 0,
      taskId: "diagnose",
      context: "Analyzing TypeError stack trace",
      decision: "Check Tool.execute implementation first",
      reasoning: "Stack trace points to line 142 in Tool.execute",
      outcome: "success"
    },
    {
      step: 1,
      taskId: "fix",
      context: "Found missing null check",
      decision: "Add conditional check before stdout access",
      reasoning: "stdout is undefined when bash command fails",
      outcome: "success"
    }
  ],
  
  // Quality validation
  qualityValidation: {
    intentPreserved: true,
    testResults: { passed: 15, failed: 0, skipped: 0 },
    codeQualityImpact: { issuesFixed: 1, issuesIntroduced: 0, netImprovement: 1 }
  },
  
  // Performance metrics
  performanceMetrics: {
    executionTime: 18000,
    tokenUsage: { input: 5000, output: 3500, cache: 3500 },
    costBreakdown: { llmCost: 0.23, infrastructureCost: 0.0, total: 0.23 }
  }
}
```

**What this captures:**
- ✅ Complete activity execution record
- ✅ Expectations vs reality comparison
- ✅ Quality validation results
- ✅ Performance metrics
- ✅ Learning data for template improvement

**What's missing:**
- ❌ Full decision trees (only major decisions)
- ❌ Context effectiveness per step
- ❌ Tool pattern analysis
- ❌ Confidence evolution over steps

### Level 4: Backend Analytics (metabob-rpc-api)

**Stored in**: SurrealDB

```sql
-- Activity executions table
CREATE execution {
  execution_id: "exec_456",
  activity_id: "fix-bug",
  variant_id: "fix-bug_v2_abc123",
  selection_id: "sel_789",
  success: true,
  duration_ms: 18000,
  cost: 0.23,
  step_results: [...],
  comparison: {...},
  timestamp: "2026-02-06T18:00:00Z"
}

-- Learning metrics updates
UPDATE activity_variant:fix-bug_v2_abc123 SET
  executions = executions + 1,
  successes = successes + 1,
  avg_cost = (avg_cost * executions + 0.23) / (executions + 1),
  avg_duration = (avg_duration * executions + 18000) / (executions + 1),
  thompson_alpha = thompson_alpha + 1,  -- Success
  component_accuracy_history.append(0.66)
```

## Recording Flow: End-to-End

### Step 1: Session Creation
```
metabob-opencode:
  Session.create() → Assigns session ID
  ├─→ Stores to OpenCode Storage
  └─→ Event: session.created

metabob-cli:
  (not involved in initial session creation)
```

### Step 2: Pre-Turn Memory Management
```
metabob-opencode:
  TurnLifecycle Hook (priority 10) → Memory Management
  │
  ├─→ Create Memory Agent Session
  │   - Separate session ID
  │   - Activity.registerSessionMemory(memorySessionId)
  │
  ├─→ Memory Agent: Analyze Intent
  │   - SessionMemoryAgent.analyzeIntent()
  │   - Classifies: code_fix, feature_request, etc.
  │   - Suggests impulses
  │
  ├─→ Memory Agent: Create Impulses
  │   - SessionMemory.create() for each suggestion
  │   - Stored in OpenCode Storage
  │   - Associated with memory session ID
  │
  ├─→ Memory Agent: Load Impulses
  │   - Resolve pointers (read files, query metabob, run commands)
  │   - Apply token budgets
  │   - Store loaded content
  │
  └─→ Main Session: Impulses available
      - System prompt injection reads from SessionMemory
      - Content prepared BEFORE main agent runs

RECORDED:
  ✅ Memory agent session (messages, costs)
  ✅ Intent classification
  ✅ Impulse creation and loading
  ✅ Token usage for memory preparation
```

### Step 3: Activity Discovery (if applicable)
```
metabob-opencode:
  TurnLifecycle Hook (priority 15) → Activity Recommendations
  │
  └─→ MCP: search_activities(query, category, limit)
      │
      └─→ metabob-cli: ActivityManager.search_activities()
          │
          └─→ HTTP: GET /activity-recommendations/recommendations
              │
              └─→ metabob-rpc-api: Thompson Sampling
                  - Explores (try less-used templates)
                  - Exploits (favor high success rate)
                  - Balances learning vs performance
                  │
                  └─→ Returns ranked activities with selection_ids

RECORDED (backend):
  ✅ Search query and context
  ✅ Thompson Sampling parameters at time of search
  ✅ Rankings returned
  ✅ Which activities were candidates
```

### Step 4: Activity Start
```
metabob-opencode:
  Main Agent: Decides to use activity
  │
  └─→ activity() tool call
      │
      └─→ MCP: start_activity_execution(activity_id, variables, reason)
          │
          └─→ metabob-cli: ActivityManager.start_execution()
              │
              ├─→ Generate execution_id = "exec_" + uuid
              │
              ├─→ HTTP: POST /activity-recommendations/select
              │   - Records selection decision
              │   - Links selection_id for outcome tracking
              │   - Backend knows: "Agent chose this activity"
              │
              ├─→ Load template from cache or backend
              │   - Full template stored internally
              │   - NOT exposed to agent yet
              │
              └─→ Create ActivityExecution state
                  - execution_id, activity_id, session_id
                  - variant_id, selection_id (for backend)
                  - current_step_index = 0
                  - cost_budget = 1.0
                  - step_results = []

RECORDED:
  ✅ Activity selection (which one, why)
  ✅ Variables provided
  ✅ Cost budget allocated
  ✅ Reason for starting activity
  
  → metabob-opencode: Create activity session
    - Session.createForActivity()
    - Activity.registerSession(sessionId, activityId)
    - Links main session to activity
```

### Step 5: Step Execution Loop
```
FOR each step in activity:

metabob-opencode (Task Agent Session):
  │
  ├─→ MCP: get_next_step(execution_id)
  │   │
  │   └─→ metabob-cli: ActivityManager.get_next_step()
  │       - Returns ONLY current step
  │       - Hides future steps
  │       │
  │       └─→ Returns: {
  │             "step_index": 0,
  │             "total_steps": 3,
  │             "current_step": {
  │               "step_id": "diagnose",
  │               "title": "Diagnose root cause",
  │               "description": "...",
  │               "prompt_template": "...",  # Step instructions
  │               "tools": {
  │                 "required": ["read"],
  │                 "optional": ["grep", "metabob_search"],
  │                 "disabled": ["write"]  # Prevent writes in diagnosis
  │               }
  │             },
  │             "variables": {...},  # For prompt interpolation
  │             "cost_remaining": 0.95
  │           }
  │
  ├─→ Task Agent: Execute step
  │   - Injects step instructions into agent prompt
  │   - Agent uses tools to complete step
  │   - Agent produces output
  │   - Tracks tool calls internally
  │
  └─→ MCP: report_step_result(execution_id, step_id, success, output, cost, tokens, tool_calls)
      │
      └─→ metabob-cli: ActivityManager.report_step_result()
          │
          ├─→ Create StepResult(step_id, success, output, cost, tokens, tool_calls)
          │
          ├─→ Update ActivityExecution state
          │   - step_results.append(result)
          │   - total_cost += cost
          │   - total_tokens += tokens
          │   - current_step_index += 1
          │
          ├─→ HTTP: POST /activity-recommendations/record-step
          │   - Real-time step result to backend
          │   - Backend can monitor progress
          │   - Backend can intervene if needed
          │
          └─→ Check next action:
              - More steps? → return { "continue": true }
              - All done? → run validation
              - Failed validation? → trigger trailblazing

RECORDED PER STEP:
  ✅ Step ID and description
  ✅ Success/failure
  ✅ Agent output (text produced)
  ✅ Error message if failed
  ✅ Cost and tokens
  ✅ Tool calls (name, args, duration)
  ✅ Duration of entire step
  
  FUTURE:
  ☐ Decision points within step
  ☐ Context references (which impulses used)
  ☐ Confidence indicators
  ☐ Exploration vs exploitation mode
```

### Step 6: Activity Completion
```
metabob-cli: Final step reported
  │
  ├─→ ActivityManager._check_completion()
  │   - All steps successful?
  │   - Run validation if configured
  │   - Calculate final metrics
  │
  └─→ HTTP: POST /activity-recommendations/record-outcome
      {
        "selection_id": "sel_789",  # Links to selection decision
        "success": true,
        "duration_ms": 18000,
        "cost": 0.23,
        "tokens": 8500,
        "step_results": [...],  # All step data
        "comparison": {
          "component_accuracy": 0.92,
          "cost_delta": -0.02,
          "duration_delta_ms": -2000
        },
        "quality_validation": {...},
        "performance_metrics": {...}
      }
      │
      └─→ metabob-rpc-api: Learning system update
          │
          ├─→ Update Thompson Sampling params
          │   - thompson_alpha += 1 (success)
          │   - Recalculate success rate
          │
          ├─→ Update template metrics
          │   - executions += 1
          │   - avg_cost = weighted_average(old_avg, new_cost)
          │   - avg_duration = weighted_average(old_avg, new_duration)
          │
          ├─→ Store execution for analytics
          │   - Full execution record in SurrealDB
          │   - Available for template evolution
          │
          └─→ Trigger evolution if needed
              if success_rate < 0.7:
                → Send task to agent: "Improve fix-bug template"
              if cost_delta > 0.2:
                → Optimize prompt budgets
              if component_accuracy < 0.8:
                → Refine step instructions

metabob-opencode: Activity cleanup
  │
  ├─→ ActivityOutcomeRecorder.recordOutcome()
  │   - Stores outcome data locally
  │   - Backs up to file if backend unavailable
  │
  ├─→ Activity.unregisterSession(sessionId)
  │   - Remove session→activity mapping
  │   - Cleanup memory agent session
  │
  └─→ Return summary to calling agent

RECORDED:
  ✅ Complete activity execution
  ✅ All step results
  ✅ Final outcome (success/failure)
  ✅ Expectations vs reality
  ✅ Quality validation
  ✅ Cost and duration metrics
  ✅ Learning data for template improvement
```

## Comprehensive Recording: What's Captured Today

### ✅ Currently Recorded

**1. Session Level** (metabob-opencode Storage)
- All messages and tool calls
- Token usage and cost per message
- Provider and model used
- Session creation and lifetime

**2. Step Level** (metabob-cli → backend)
- Step success/failure
- Agent output per step
- Tool calls with args and results
- Cost and tokens per step
- Duration timing

**3. Activity Level** (metabob-cli → backend)
- Complete execution record
- Expectations vs reality
- Quality validation results
- Performance metrics
- Comparison data for learning

**4. Backend Level** (metabob-rpc-api)
- Thompson Sampling parameters
- Template metrics (success rate, avg cost, avg duration)
- Execution history
- Co-change patterns

### ❌ Missing (Future Work)

**1. Decision Recording**
- Why agent chose specific approach
- What alternatives were considered
- How context influenced decision
- Confidence in chosen path

**2. Context Effectiveness**
- Which impulses were actually used
- Which impulses were wasted (loaded but not referenced)
- Optimal budget for each impulse type
- When to load/unload specific context

**3. Tool Strategy Analysis**
- Exploratory vs targeted tool usage
- Tool sequence patterns
- Effectiveness of different tool combinations
- Tool argument patterns

**4. Subagent Coordination**
- Delegation decision reasoning
- Handoff quality (how well was task specified)
- Subagent effectiveness
- Communication overhead

**5. Learning Insights**
- What worked well (to repeat)
- What didn't work (to avoid)
- Unexpected successes (to amplify)
- Failed approaches (to prevent)

## How to Implement Complete Recording

### Option A: Explicit MCP Tools (Recommended)

```python
# metabob-cli: Add behavior recording tools

@mcp.tool()
async def record_decision(
    session_id: str,
    step: int,
    context: str,
    decision: str,
    reasoning: str,
    alternatives: list[str] = None,
    confidence: float = 0.5
) -> dict:
    """Record a major decision point."""
    # Store in execution state
    # Send to backend asynchronously
    return {"recorded": True}

@mcp.tool()
async def record_context_reference(
    session_id: str,
    impulse_id: str,
    usage: str = "referenced" | "key_insight" | "ignored"
) -> dict:
    """Track which impulses were actually useful."""
    # Update impulse usage stats
    # Feed into context optimization
    return {"recorded": True}

@mcp.tool()
async def record_tool_strategy(
    session_id: str,
    strategy: str = "exploratory" | "targeted" | "recovery",
    reasoning: str = ""
) -> dict:
    """Record tool usage strategy."""
    # Helps understand agent's approach
    # Pattern: exploratory (read/grep) → targeted (str_replace)
    return {"recorded": True}
```

**Usage in metabob-opencode:**
```typescript
// Agent prompt includes these tools
// Agent calls them explicitly:

"I'll check the Tool.execute implementation first since the stack trace points there."

record_decision({
  session_id: "ses_456",
  step: 0,
  context: "Analyzing TypeError stack trace",
  decision: "Check Tool.execute implementation",
  reasoning: "Stack trace points to line 142",
  alternatives: ["Check bash tool", "Search for similar issues"],
  confidence: 0.9
})
```

### Option B: Automatic Extraction (Lower Quality)

```python
# metabob-cli: Extract decisions from output automatically

def extract_decisions_from_output(output: str, tool_calls: list) -> list[dict]:
    """Extract implicit decisions from agent output."""
    
    decisions = []
    
    # Pattern 1: "I'll [action] because [reason]"
    pattern1 = re.findall(r"I'?ll\s+([^.]+?)\s+because\s+([^.]+)", output)
    for action, reason in pattern1:
        decisions.append({
            "decision": action.strip(),
            "reasoning": reason.strip(),
            "confidence": 0.7,  # Explicit reasoning → medium-high confidence
            "extraction_method": "explicit_because"
        })
    
    # Pattern 2: Tool sequence analysis
    if len(tool_calls) > 3 and all(t["tool"] in ["read", "grep", "glob"] for t in tool_calls[:3]):
        decisions.append({
            "decision": "Exploratory investigation",
            "reasoning": "Multiple read/search tools used",
            "confidence": 0.6,
            "extraction_method": "tool_sequence"
        })
    
    # Pattern 3: Error recovery
    if any("error" in str(t.get("result", "")).lower() for t in tool_calls):
        if "try" in output.lower() or "instead" in output.lower():
            decisions.append({
                "decision": "Error recovery attempt",
                "reasoning": "Encountered error, trying alternative",
                "confidence": 0.5,
                "extraction_method": "error_recovery"
            })
    
    return decisions
```

**Pros:**
- No agent modifications needed
- Works with existing messages
- Can backfill historical data

**Cons:**
- Lower quality (inferred, not explicit)
- Misses subtle decisions
- Confidence scores are estimates
- Can't capture alternatives considered

### Option C: Hybrid Approach (Best)

```typescript
// metabob-opencode: Message metadata layer

Session.updateMessage({
  ...message,
  
  // Automatic extraction (always runs)
  extractedMetadata: {
    decisions: extractDecisions(message.text, toolCalls),
    toolStrategy: inferStrategy(toolCalls),
    phase: detectPhase(message.text),
    confidence: estimateConfidence(message.text)
  },
  
  // Explicit recording (if agent used tools)
  explicitMetadata: {
    decisions: [...],  // From record_decision calls
    contextReferences: [...],  // From record_context_reference calls
    toolReasoning: [...],  // From record_tool_strategy calls
  }
})
```

**Best of both worlds:**
- Automatic baseline (always have something)
- Explicit detail (when agent provides it)
- Backward compatible
- Gradual improvement over time

## Complete Recording Example

```
Activity: Fix TypeError in Tool.execute
Duration: 18 minutes
Cost: $0.23
Agent: Activity mode, Config subagent

┌──────────────────────────────────────────────────────┐
│ SESSION LEVEL (metabob-opencode Storage)            │
└──────────────────────────────────────────────────────┘

Messages:
  [0] user: "Fix TypeError in Tool.execute when bash fails"
  [1] assistant (memory agent): "[internal] Created 3 impulses for context"
      - Tokens: 800, Cost: $0.01, Duration: 1.2s
      - Tool calls: impulse_create × 3, impulse_load × 3
  [2] assistant (main agent): "I'll use the fix-bug activity..."
      - Tokens: 1200, Cost: $0.03, Duration: 2s
      - Tool calls: activity, start_activity_execution
  [3] assistant (task agent, step 0): "Let me analyze the error..."
      - Tokens: 3000, Cost: $0.08, Duration: 3s
      - Tool calls: read × 2, grep × 1, metabob_search × 1
  [4] assistant (task agent, step 1): "I'll add a null check..."
      - Tokens: 2800, Cost: $0.07, Duration: 5s
      - Tool calls: str_replace, read_lints
  [5] assistant (task agent, step 2): "Running tests..."
      - Tokens: 4500, Cost: $0.11, Duration: 10s
      - Tool calls: shell
  [6] assistant (main agent): "Activity complete! Fixed TypeError."
      - Tokens: 1000, Cost: $0.02, Duration: 1s
      - Summary of activity

Total Session:
  - Messages: 7
  - Tokens: 13300 (input + output)
  - Cost: $0.32 (includes memory agent)
  - Duration: 22.2s (wall time)

┌──────────────────────────────────────────────────────┐
│ ACTIVITY LEVEL (metabob-cli → backend)              │
└──────────────────────────────────────────────────────┘

Execution Record:
  execution_id: "exec_456"
  activity_id: "fix-bug"
  variant_id: "fix-bug_v2_abc123"
  selection_id: "sel_789"
  session_id: "ses_456"
  
  Step Results:
    [0] diagnose:
        - success: true
        - output: "Root cause: missing null check at line 142..."
        - cost: $0.08
        - tokens: 3000
        - duration: 3000ms
        - tools: [read, read, grep, metabob_search]
        - tool_sequence: "exploratory → targeted"
        
    [1] fix:
        - success: true
        - output: "Added null check before stdout access..."
        - cost: $0.07
        - tokens: 2800
        - duration: 5000ms
        - tools: [str_replace, read_lints]
        - tool_sequence: "implementation → validation"
        
    [2] test:
        - success: true
        - output: "All tests passing (15 pass, 0 fail)"
        - cost: $0.11
        - tokens: 4500
        - duration: 10000ms
        - tools: [shell]
        - tool_sequence: "validation"
  
  Totals:
    - total_cost: $0.26 (excludes memory agent $0.01)
    - total_tokens: 10300
    - total_duration: 18000ms (excludes memory prep)
    - steps_completed: 3/3
  
  Outcome:
    - success: true
    - validation: { tests: 15, passed: 15 }
    - quality: { issues_fixed: 1, issues_introduced: 0 }

┌──────────────────────────────────────────────────────┐
│ LEARNING LEVEL (metabob-rpc-api SurrealDB)          │
└──────────────────────────────────────────────────────┘

Template Metrics Updated:
  activity: fix-bug
  variant: v2_abc123
  
  Before execution:
    - executions: 42
    - successes: 36
    - success_rate: 0.857
    - avg_cost: $0.28
    - avg_duration: 20000ms
    - thompson_alpha: 36, thompson_beta: 6
  
  After this execution:
    - executions: 43
    - successes: 37
    - success_rate: 0.860  (improved!)
    - avg_cost: $0.277  (cheaper!)
    - avg_duration: 19953ms  (faster!)
    - thompson_alpha: 37, thompson_beta: 6
  
  Learning Insights:
    - Cost better than expected: adjust prompt budgets DOWN
    - Component accuracy (0.92): good but not perfect
    - Tool sequence (read→grep→search): effective pattern
    - Duration predictable: good planning

  Evolution Triggers:
    ✗ No evolution needed (success_rate > 0.85)
    ✓ Slight prompt optimization scheduled
```

## Recording Gaps & Solutions

### Gap 1: Decision Reasoning

**Problem**: We record decisions ("add null check") but not alternatives considered.

**Solution**:
```python
# Add to StepResult
decisions: list[DecisionPoint] = [
    {
        "context": "Found undefined stdout at line 142",
        "decision": "Add conditional check",
        "alternatives": [
            "Use optional chaining (?.)",
            "Add default value",
            "Validate in caller"
        ],
        "chosen_index": 0,
        "reasoning": "Explicit check is clearer and easier to test",
        "confidence": 0.9
    }
]
```

### Gap 2: Context Effectiveness

**Problem**: Don't know which impulses were actually useful.

**Solution**:
```typescript
// Track impulse references in output
const contextUsage = {
  errorFile: {
    loaded: true,
    referenced: true,  // Agent mentioned file content
    key_insight: true,  // Led to solution
    tokens_effective: 1450,  // All content was relevant
    tokens_wasted: 0
  },
  stackTrace: {
    loaded: true,
    referenced: false,  // Agent never mentioned it
    tokens_effective: 0,
    tokens_wasted: 480  // Wasted budget
  }
}
```

### Gap 3: Tool Pattern Effectiveness

**Problem**: Don't analyze which tool sequences work best.

**Solution**:
```python
# Backend analytics
class ToolPatternAnalyzer:
    def analyze_patterns(self, executions: list[dict]):
        """Find effective tool sequences."""
        
        patterns = {}
        for exec in executions:
            for step in exec["step_results"]:
                sequence = " → ".join(t["tool"] for t in step["tool_calls"])
                if sequence not in patterns:
                    patterns[sequence] = {
                        "count": 0,
                        "success_rate": 0.0,
                        "avg_duration": 0
                    }
                patterns[sequence]["count"] += 1
                if step["success"]:
                    patterns[sequence]["success_rate"] += 1
        
        # Find most effective patterns
        effective = sorted(
            patterns.items(),
            key=lambda p: (p[1]["success_rate"] / p[1]["count"], p[1]["count"]),
            reverse=True
        )
        
        return effective[:10]  # Top 10 patterns
```

### Gap 4: Subagent Performance

**Problem**: When main agent delegates to subagent, don't track handoff quality.

**Solution**:
```typescript
// When delegating via task() tool
await task({
  subagent_type: "config",
  description: "Add schema field",
  prompt: "Add timeout field to Tool schema...",
  
  // NEW: Track delegation
  tracking: {
    delegation_reason: "Schema changes require config agent expertise",
    context_provided: ["Tool.Info schema", "existing patterns"],
    expected_duration_ms: 5000,
    expected_cost: 0.03
  }
})

// After subagent completes
const result = await taskResult
record_subagent_performance({
  subagent: "config",
  handoff_quality: 0.9,  // Was task well-specified?
  execution_quality: 0.95,  // Did subagent do it well?
  duration_delta: -1000,  // 1s faster than expected
  cost_delta: -0.01  // $0.01 cheaper
})
```

## Implementation Priority

### Phase 1: Explicit Decision Recording (High Value, Low Effort)
```python
# Add record_decision MCP tool
# Agents call it explicitly for major decisions
# Captures: decision, reasoning, alternatives, confidence
```

**Benefit**: ~80% of decision insight with ~20% implementation effort

### Phase 2: Context Usage Tracking (High Value, Medium Effort)
```typescript
// Track which impulses are referenced in output
// Analyze token effectiveness
// Optimize budget allocation
```

**Benefit**: Optimize context budgets, reduce wasted tokens (cost savings!)

### Phase 3: Automatic Pattern Extraction (Medium Value, High Effort)
```python
# Extract decisions, strategies, patterns from existing data
// Apply ML to find effective approaches
// Requires significant backend analytics
```

**Benefit**: Full automation, but complex to implement correctly

### Phase 4: Real-Time Intervention (Future)
```
Backend monitors execution in real-time:
  - If step cost > 2× expected → suggest cheaper approach
  - If exploration > 3 minutes → suggest targeted strategy
  - If validation failing → offer trailblazing hints
```

**Benefit**: Interactive learning, but requires streaming infrastructure

## Summary: Current State & Future

### Currently Working ✅
1. **Session recording** - All messages, tools, costs in metabob-opencode
2. **Step recording** - Success, output, cost, tools in metabob-cli
3. **Outcome recording** - Complete execution + comparison in backend
4. **Learning loop** - Thompson Sampling updates from outcomes

### Ready to Add 🚀
1. **Decision recording** - Add `record_decision` MCP tool
2. **Context tracking** - Track impulse effectiveness
3. **Tool patterns** - Analyze sequence effectiveness
4. **Subagent metrics** - Track delegation quality

### Future Vision 🔮
1. **Real-time coaching** - Backend suggests improvements during execution
2. **Automatic evolution** - Templates optimize themselves from data
3. **Agent profiles** - Per-agent learning (Config agent vs Tool agent)
4. **Cross-project learning** - Patterns from one codebase help others

The foundation is solid. Adding comprehensive recording is mainly about exposing the right MCP tools and having agents use them.
