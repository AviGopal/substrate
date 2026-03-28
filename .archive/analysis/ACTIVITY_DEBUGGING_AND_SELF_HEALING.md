# Activity Debugging and Self-Healing System

**Created**: February 15, 2026 14:45 UTC  
**Session**: ses_39ca6dc74ffeV56TLEZ2p2HFgb  
**Purpose**: Design a system for metabob-opencode to detect, diagnose, and fix failing activities

---

## Current State Analysis

### What Works ✅
- **Discovery**: search_activities returns 20 templates
- **Simple Execution**: 2-task templates complete successfully (demo-315bfaf1)
- **Metabob Tools**: All 30+ tools accessible in sessions
- **MCP Connection**: Functional after session bootstrapping

### What's Broken ❌
- **Task-Level Tracking**: Execution records created but `tasks: []` remains empty
- **Complex Templates**: 6+ task templates fail mid-execution
- **State Persistence**: OpenCode in-memory state not syncing to backend
- **Error Reporting**: Failures have no error messages or stack traces
- **Learning Loop**: No feedback from failures to improve variants

### Root Cause Hypothesis
**OpenCode Native Executor** operates independently from the backend learning system:
- Executes activity tasks in-memory
- **Does NOT report step results** back to CLI/backend
- No persistence of intermediate state
- No error context captured for learning

**Evidence**:
```
Activity Execution: exec_3c62f2398642
Status: Completed with error (2/6 tasks)
Backend Record: { tasks: 0, duration: 128523ms, success: false }
Missing: Which tasks failed, why, what the error was
```

---

## Architecture Review: Where Failures Occur

### Execution Flow

```
[User Request]
      ↓
[OpenCode Activity Executor]
  ├─ Task 1 (LLM + Tools) ✓
  ├─ Task 2 (LLM + Tools) ✓
  ├─ Task 3 (LLM + Tools) ❌ ← Failure here
  ├─ Task 4 (Not executed)
  ├─ Task 5 (Not executed)
  └─ Task 6 (Not executed)
      ↓
[CLI Activity Manager] ← No step-by-step feedback
      ↓
[Backend Activity Service] ← Only receives final success/fail
      ↓
[SurrealDB] ← Stores: { tasks: 0 } 😞
```

### Missing Feedback Loop

**Problem**: Backend learning system **cannot learn from failures** because it lacks:
1. Which task failed (task index/ID)
2. What the error message was
3. What tool calls were attempted
4. What the LLM context was at failure
5. What variables/impulses were loaded

**Impact**: Thompson Sampling has no data to improve variant selection

---

## Solution: Three-Tiered Debugging System

### Tier 1: Execution State Capture (CRITICAL)

**Goal**: Persist detailed execution state for every activity run

#### Component: OpenCode Activity Executor Enhancement

**File**: `repos/metabob-opencode/packages/opencode/src/session/enhanced-activity-integration.ts`

**Changes Needed**:

```typescript
interface ActivityExecutionState {
  execution_id: string;
  activity_id: string;
  session_id: string;
  tasks: TaskExecutionRecord[];
  variables: Record<string, any>;
  impulses_loaded: string[];
  start_time: number;
  end_time?: number;
  final_status: 'success' | 'failed' | 'partial' | 'cancelled';
  error?: ErrorContext;
}

interface TaskExecutionRecord {
  task_index: number;
  task_name: string;
  subagent_type: string;
  prompt: string;
  start_time: number;
  end_time?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  tool_calls: ToolCallRecord[];
  output?: string;
  error?: ErrorContext;
  tokens_used?: { input: number; output: number };
  cost?: number;
}

interface ErrorContext {
  message: string;
  stack?: string;
  tool_call?: string;
  llm_response?: string;
  recovery_attempted: boolean;
  recovery_strategy?: string;
}
```

**Implementation**:

```typescript
class EnhancedActivityExecutor {
  private async executeTask(task: ActivityTask, context: ExecutionContext): Promise<TaskResult> {
    const taskRecord: TaskExecutionRecord = {
      task_index: context.currentTaskIndex,
      task_name: task.name,
      subagent_type: task.subagent_type,
      prompt: task.prompt,
      start_time: Date.now(),
      status: 'running',
      tool_calls: []
    };

    try {
      // Execute task with tool call tracking
      const result = await this.runSubagent(task, {
        onToolCall: (toolName, params, result) => {
          taskRecord.tool_calls.push({
            tool: toolName,
            params,
            result,
            timestamp: Date.now()
          });
        }
      });

      taskRecord.status = 'completed';
      taskRecord.output = result.output;
      taskRecord.tokens_used = result.usage;
      taskRecord.cost = result.cost;
      taskRecord.end_time = Date.now();

      // ✅ CRITICAL: Report to backend immediately
      await this.reportTaskResult(taskRecord);

      return { success: true, output: result.output };

    } catch (error) {
      taskRecord.status = 'failed';
      taskRecord.error = {
        message: error.message,
        stack: error.stack,
        tool_call: taskRecord.tool_calls[taskRecord.tool_calls.length - 1]?.tool,
        llm_response: error.llmResponse,
        recovery_attempted: false
      };
      taskRecord.end_time = Date.now();

      // ✅ CRITICAL: Report failure to backend
      await this.reportTaskResult(taskRecord);

      throw error;
    }
  }

  private async reportTaskResult(taskRecord: TaskExecutionRecord): Promise<void> {
    // Report via MCP to CLI, which forwards to backend
    await this.mcpClient.call('metabob_report_task_result', {
      execution_id: this.executionState.execution_id,
      task_record: taskRecord
    });
  }
}
```

#### Component: CLI Task Result Receiver

**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

**New MCP Tool**:

```python
@mcp.tool()
async def metabob_report_task_result(
    execution_id: str,
    task_record: dict
) -> dict:
    """
    Receive task execution results from OpenCode and persist to backend.
    
    Called by OpenCode after each task completes or fails.
    """
    manager = get_activity_manager()
    
    # Forward to backend API
    result = await manager.report_task_result(
        execution_id=execution_id,
        task_index=task_record['task_index'],
        status=task_record['status'],
        tool_calls=task_record['tool_calls'],
        output=task_record.get('output'),
        error=task_record.get('error'),
        tokens_used=task_record.get('tokens_used'),
        cost=task_record.get('cost'),
        duration_ms=task_record['end_time'] - task_record['start_time']
    )
    
    return result
```

#### Component: Backend Task Storage

**File**: `repos/metabob-rpc-api/src/metabob_rpc_api/activities/service.py`

**New Endpoint**:

```python
class ActivityService:
    async def record_task_result(
        self,
        execution_id: str,
        task_record: TaskExecutionRecord
    ) -> None:
        """
        Store task execution record for learning and debugging.
        """
        async with self.db.get_session() as session:
            # Update execution record
            await session.execute(
                """
                UPDATE activity_executions 
                SET tasks += $task_record
                WHERE execution_id = $execution_id
                """,
                {
                    'execution_id': execution_id,
                    'task_record': {
                        'task_index': task_record.task_index,
                        'task_name': task_record.task_name,
                        'status': task_record.status,
                        'tool_calls': len(task_record.tool_calls),
                        'duration_ms': task_record.end_time - task_record.start_time,
                        'error': task_record.error.message if task_record.error else None,
                        'tokens_used': task_record.tokens_used,
                        'cost': task_record.cost
                    }
                }
            )
            
            # If task failed, increment variant failure stats
            if task_record.status == 'failed':
                await self.increment_variant_failure(
                    execution_id=execution_id,
                    task_index=task_record.task_index,
                    error_category=self.categorize_error(task_record.error)
                )
```

---

### Tier 2: Failure Analysis System (HIGH PRIORITY)

**Goal**: Automatically analyze failed executions and categorize root causes

#### Component: Failure Analyzer Agent

**File**: `repos/metabob-cli/src/metabob_cli/analysis/failure_analyzer.py`

```python
from dataclasses import dataclass
from typing import Literal

ErrorCategory = Literal[
    'tool_not_found',      # Metabob tool unavailable
    'variable_missing',    # Required variable not provided
    'impulse_not_found',   # Impulse ID doesn't exist
    'timeout',             # LLM or tool call timeout
    'llm_refusal',         # LLM refused to perform action
    'syntax_error',        # Generated code has syntax error
    'test_failure',        # Tests failed after code change
    'network_error',       # API call failed
    'permission_denied',   # File system access denied
    'unknown'              # Uncategorized failure
]

@dataclass
class FailureAnalysis:
    execution_id: str
    activity_id: str
    variant_id: str
    failed_task_index: int
    error_category: ErrorCategory
    root_cause: str
    suggested_fix: str
    fixable_by_agent: bool
    requires_human: bool
    related_failures: list[str]  # Similar past failures

class FailureAnalyzer:
    async def analyze_failure(
        self,
        execution_id: str
    ) -> FailureAnalysis:
        """
        Analyze a failed activity execution to determine root cause and fix.
        """
        # Fetch full execution record
        execution = await self.backend.get_execution(execution_id)
        
        # Find failed task
        failed_task = next(
            (task for task in execution.tasks if task.status == 'failed'),
            None
        )
        
        if not failed_task:
            raise ValueError(f"No failed task found in {execution_id}")
        
        # Categorize error
        error_category = self.categorize_error(failed_task.error)
        
        # Search for similar failures
        similar_failures = await self.find_similar_failures(
            activity_id=execution.activity_id,
            error_category=error_category,
            limit=10
        )
        
        # Generate fix suggestion
        suggested_fix = await self.generate_fix_suggestion(
            failed_task=failed_task,
            error_category=error_category,
            similar_failures=similar_failures
        )
        
        return FailureAnalysis(
            execution_id=execution_id,
            activity_id=execution.activity_id,
            variant_id=execution.variant_id,
            failed_task_index=failed_task.task_index,
            error_category=error_category,
            root_cause=self.extract_root_cause(failed_task.error),
            suggested_fix=suggested_fix,
            fixable_by_agent=error_category in [
                'variable_missing', 
                'syntax_error', 
                'test_failure'
            ],
            requires_human=error_category in [
                'tool_not_found',
                'permission_denied'
            ],
            related_failures=[f.execution_id for f in similar_failures]
        )
    
    def categorize_error(self, error: ErrorContext) -> ErrorCategory:
        """Categorize error based on message and context."""
        if 'tool' in error.message.lower() and 'not found' in error.message.lower():
            return 'tool_not_found'
        elif 'variable' in error.message.lower() or 'undefined' in error.message.lower():
            return 'variable_missing'
        elif 'timeout' in error.message.lower():
            return 'timeout'
        elif 'test' in error.message.lower() and 'fail' in error.message.lower():
            return 'test_failure'
        elif 'syntax' in error.message.lower():
            return 'syntax_error'
        elif 'permission' in error.message.lower():
            return 'permission_denied'
        else:
            return 'unknown'
    
    async def generate_fix_suggestion(
        self,
        failed_task: TaskExecutionRecord,
        error_category: ErrorCategory,
        similar_failures: list[FailureAnalysis]
    ) -> str:
        """
        Use LLM to generate fix suggestion based on error context.
        """
        # Check if similar failures were resolved
        resolved_similar = [
            f for f in similar_failures 
            if f.resolution and f.resolution.success
        ]
        
        if resolved_similar:
            # Use past resolution as template
            return f"Similar failure resolved by: {resolved_similar[0].resolution.fix_applied}"
        
        # Use LLM to generate fix
        prompt = f"""
Analyze this activity task failure and suggest a fix:

Task: {failed_task.task_name}
Subagent: {failed_task.subagent_type}
Error: {failed_task.error.message}
Error Category: {error_category}

Tool Calls Before Failure:
{self.format_tool_calls(failed_task.tool_calls)}

Suggest a specific fix that can be applied to the activity template.
"""
        
        fix_suggestion = await self.llm.complete(prompt)
        return fix_suggestion
```

---

### Tier 3: Self-Healing Activity System (GAME-CHANGER)

**Goal**: Automatically fix failing activities using failure analysis

#### Component: Activity Self-Healer

**File**: `repos/metabob-cli/src/metabob_cli/activities/self_healer.py`

```python
from dataclasses import dataclass

@dataclass
class HealingStrategy:
    strategy_type: Literal[
        'add_variable_default',
        'fix_prompt',
        'change_subagent',
        'add_error_handling',
        'split_task',
        'add_impulse',
        'increase_timeout'
    ]
    description: str
    changes: dict

class ActivitySelfHealer:
    async def attempt_heal(
        self,
        analysis: FailureAnalysis
    ) -> Optional[str]:
        """
        Attempt to automatically fix a failing activity.
        
        Returns: New variant ID if healing successful, None if human needed
        """
        if analysis.requires_human:
            return None  # Cannot auto-fix
        
        if not analysis.fixable_by_agent:
            return None  # Not safe to auto-fix
        
        # Determine healing strategy
        strategy = await self.determine_strategy(analysis)
        
        if not strategy:
            return None  # No automated fix available
        
        # Apply fix and create new variant
        new_variant_id = await self.apply_healing_strategy(
            activity_id=analysis.activity_id,
            failed_variant_id=analysis.variant_id,
            strategy=strategy,
            failure_context=analysis
        )
        
        # Test new variant
        test_result = await self.test_variant(
            variant_id=new_variant_id,
            test_variables=self.extract_test_variables(analysis)
        )
        
        if test_result.success:
            # Mark variant as healed
            await self.backend.mark_variant_as_healed(
                new_variant_id=new_variant_id,
                healed_failure=analysis.execution_id,
                healing_strategy=strategy
            )
            return new_variant_id
        else:
            # Healing failed, mark variant as broken
            await self.backend.mark_variant_as_broken(
                variant_id=new_variant_id,
                reason="Healing strategy did not resolve failure"
            )
            return None
    
    async def determine_strategy(
        self,
        analysis: FailureAnalysis
    ) -> Optional[HealingStrategy]:
        """Determine healing strategy based on failure category."""
        
        if analysis.error_category == 'variable_missing':
            return HealingStrategy(
                strategy_type='add_variable_default',
                description=f"Add default value for missing variable",
                changes={
                    'variable_defaults': {
                        self.extract_missing_variable(analysis): None
                    }
                }
            )
        
        elif analysis.error_category == 'syntax_error':
            return HealingStrategy(
                strategy_type='fix_prompt',
                description=f"Fix task prompt to prevent syntax errors",
                changes={
                    'task_index': analysis.failed_task_index,
                    'prompt_fix': analysis.suggested_fix
                }
            )
        
        elif analysis.error_category == 'test_failure':
            return HealingStrategy(
                strategy_type='add_error_handling',
                description=f"Add error handling to task",
                changes={
                    'task_index': analysis.failed_task_index,
                    'add_try_catch': True
                }
            )
        
        elif analysis.error_category == 'timeout':
            return HealingStrategy(
                strategy_type='increase_timeout',
                description=f"Increase timeout for long-running task",
                changes={
                    'task_index': analysis.failed_task_index,
                    'timeout_ms': 600000  # 10 minutes
                }
            )
        
        else:
            return None  # No automated strategy
    
    async def apply_healing_strategy(
        self,
        activity_id: str,
        failed_variant_id: str,
        strategy: HealingStrategy,
        failure_context: FailureAnalysis
    ) -> str:
        """
        Apply healing strategy by creating a new variant.
        """
        # Fetch original variant
        original_variant = await self.backend.get_variant(failed_variant_id)
        
        # Clone variant
        new_variant = original_variant.clone()
        
        # Apply strategy changes
        if strategy.strategy_type == 'add_variable_default':
            new_variant.variables.update(strategy.changes['variable_defaults'])
        
        elif strategy.strategy_type == 'fix_prompt':
            task_idx = strategy.changes['task_index']
            new_variant.tasks[task_idx].prompt = strategy.changes['prompt_fix']
        
        elif strategy.strategy_type == 'add_error_handling':
            task_idx = strategy.changes['task_index']
            new_variant.tasks[task_idx].prompt += "\n\nIMPORTANT: Wrap operations in try/catch to handle errors gracefully."
        
        elif strategy.strategy_type == 'increase_timeout':
            task_idx = strategy.changes['task_index']
            new_variant.tasks[task_idx].timeout_ms = strategy.changes['timeout_ms']
        
        # Save new variant with healing metadata
        new_variant_id = await self.backend.create_variant(
            activity_id=activity_id,
            variant=new_variant,
            metadata={
                'healed_from': failed_variant_id,
                'healing_strategy': strategy.strategy_type,
                'healed_failure': failure_context.execution_id,
                'created_at': datetime.utcnow().isoformat()
            }
        )
        
        return new_variant_id
```

---

## Integration: How OpenCode Uses Self-Healing

### New MCP Tool: Check for Healing Opportunities

**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

```python
@mcp.tool()
async def metabob_check_healing_opportunities() -> dict:
    """
    Check for failed activities that can be automatically healed.
    
    Returns list of failures with healing strategies.
    """
    analyzer = get_failure_analyzer()
    healer = get_activity_healer()
    
    # Find recent failures
    recent_failures = await analyzer.get_recent_failures(
        hours=24,
        limit=10
    )
    
    # Analyze each failure
    opportunities = []
    for failure in recent_failures:
        analysis = await analyzer.analyze_failure(failure.execution_id)
        
        if analysis.fixable_by_agent:
            # Check if healing strategy exists
            strategy = await healer.determine_strategy(analysis)
            
            if strategy:
                opportunities.append({
                    'execution_id': failure.execution_id,
                    'activity_id': analysis.activity_id,
                    'activity_name': failure.activity_name,
                    'error_category': analysis.error_category,
                    'root_cause': analysis.root_cause,
                    'suggested_fix': analysis.suggested_fix,
                    'healing_strategy': strategy.strategy_type,
                    'auto_fixable': True
                })
    
    return {
        'count': len(opportunities),
        'opportunities': opportunities
    }

@mcp.tool()
async def metabob_heal_activity(execution_id: str) -> dict:
    """
    Attempt to automatically heal a failed activity.
    
    Creates new variant with fix applied.
    """
    analyzer = get_failure_analyzer()
    healer = get_activity_healer()
    
    # Analyze failure
    analysis = await analyzer.analyze_failure(execution_id)
    
    # Attempt healing
    new_variant_id = await healer.attempt_heal(analysis)
    
    if new_variant_id:
        return {
            'success': True,
            'new_variant_id': new_variant_id,
            'message': f'Activity healed successfully. New variant: {new_variant_id}',
            'strategy': analysis.suggested_fix
        }
    else:
        return {
            'success': False,
            'message': 'Could not auto-heal. Human intervention required.',
            'reason': analysis.root_cause,
            'requires_human': analysis.requires_human
        }
```

### Activity Mode Prompt Addition

**File**: `repos/metabob-opencode/packages/opencode/src/prompts/activity-mode-prompt.ts`

Add to the Activity Mode system prompt:

```markdown
## Self-Healing Activities

After any activity failure, you have access to self-healing tools:

1. **Check for Healing Opportunities**:
   ```
   metabob_check_healing_opportunities()
   ```
   Returns list of recent failures with auto-fix suggestions.

2. **Heal Activity**:
   ```
   metabob_heal_activity(execution_id="exec_...")
   ```
   Automatically creates a new variant with the fix applied.

### When to Use Self-Healing

**Always check after**:
- Activity execution failures (red X)
- Partial completions (2/6 tasks)
- Timeout errors

**Workflow**:
1. Activity fails
2. Call `metabob_check_healing_opportunities()`
3. If opportunities found → Call `metabob_heal_activity(execution_id)`
4. If heal succeeds → Retry activity with new variant
5. If heal fails → Report to user with root cause

**Example**:
```
Activity "add-rest-endpoint-v1" failed (2/6 tasks completed)

Checking for healing opportunities...
✅ Found 1 auto-fixable failure:
   Error: Variable 'endpoint_path' not provided
   Fix: Add default value for endpoint_path
   Strategy: add_variable_default

Healing activity...
✅ New variant created: other-97e440b7-healed-v2
   Change: Added endpoint_path default = "/api/resource"

Retrying activity with healed variant...
✅ Success! 6/6 tasks completed
```
```

---

## Implementation Roadmap

### Phase 1: State Capture (Week 1) 🚨 CRITICAL
1. ✅ Add `reportTaskResult()` to OpenCode activity executor
2. ✅ Add `metabob_report_task_result` MCP tool to CLI
3. ✅ Add backend endpoint to store task execution records
4. ✅ Test: Run simple activity, verify tasks[] populated in backend

**Success Metric**: Backend execution records show `tasks: [...]` with detailed task-level data

### Phase 2: Failure Analysis (Week 2) 📊 HIGH PRIORITY
1. ✅ Implement FailureAnalyzer class
2. ✅ Add error categorization logic
3. ✅ Implement similar failure search
4. ✅ Add `metabob_analyze_failure` MCP tool
5. ✅ Test: Manually trigger failure, analyze with tool

**Success Metric**: Can analyze any failed execution and get root cause + fix suggestion

### Phase 3: Self-Healing (Week 3) 🔧 GAME-CHANGER
1. ✅ Implement ActivitySelfHealer class
2. ✅ Add healing strategy determination logic
3. ✅ Implement variant cloning and modification
4. ✅ Add `metabob_heal_activity` and `metabob_check_healing_opportunities` MCP tools
5. ✅ Update Activity Mode prompt with self-healing workflow
6. ✅ Test: Trigger failure, auto-heal, verify new variant works

**Success Metric**: OpenCode automatically heals 50%+ of fixable failures without human intervention

### Phase 4: Learning Loop (Week 4) 🧠 ADVANCED
1. ✅ Integrate healing into Thompson Sampling
2. ✅ Track healing success rates per strategy
3. ✅ Implement variant evolution tracking
4. ✅ Add "healing history" to activity dashboard
5. ✅ Test: Run 100 activities, measure improvement over time

**Success Metric**: Activity success rates improve 20%+ over baseline after 100 executions

---

## Quick Start: Testing the System

### Step 1: Trigger a Debuggable Failure

```python
# Test script: trigger_failure.py
from metabob_cli.mcp.activity_manager import get_activity_manager

async def trigger_failure():
    manager = get_activity_manager()
    
    # Execute activity with missing variable (should fail)
    exec_id = await manager.start_execution(
        activity_id="other-97e440b7",  # add-rest-endpoint-v1
        variables={
            # Missing 'endpoint_path' - should cause failure
            "resource_name": "users"
        },
        session_id="anonymous:default:..."
    )
    
    print(f"Execution started: {exec_id}")
    # Let it fail naturally

asyncio.run(trigger_failure())
```

### Step 2: Analyze Failure (After Phase 2)

```javascript
// In OpenCode Activity Mode
const analysis = await metabob_analyze_failure({
  execution_id: "exec_..."  // From step 1
});

console.log(analysis);
// {
//   error_category: "variable_missing",
//   root_cause: "Required variable 'endpoint_path' not provided",
//   suggested_fix: "Add default value or make variable optional",
//   fixable_by_agent: true
// }
```

### Step 3: Heal Activity (After Phase 3)

```javascript
// In OpenCode Activity Mode
const result = await metabob_heal_activity({
  execution_id: "exec_..."
});

console.log(result);
// {
//   success: true,
//   new_variant_id: "other-97e440b7-healed-v1",
//   message: "Activity healed successfully",
//   strategy: "Added default: endpoint_path = '/api/resource'"
// }

// Retry with healed variant
const retry = await activity({
  activityId: "other-97e440b7",  // Uses new variant automatically
  variables: { resource_name: "users" },
  reason: "Retry with healed variant"
});
// ✅ Success!
```

---

## Success Metrics

### Before Self-Healing
- Complex activity success rate: ~30% (2/6 tasks typical)
- Failures require manual debugging
- No learning from failures
- Variant selection random

### After Self-Healing
- Complex activity success rate: **70%+** (auto-healed variants)
- 50%+ of failures fixed automatically
- Learning loop active (Thompson Sampling uses healing data)
- Variant selection optimized by success history

### Key Performance Indicators
1. **Healing Success Rate**: % of failures successfully auto-healed
2. **Time to Resolution**: Hours from failure to fix (human vs auto)
3. **Variant Evolution**: # of generations before stable variant
4. **Activity Reliability**: % increase in success rate over time

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Activity Execution                        │
│                                                              │
│  [OpenCode Executor]                                         │
│    ├─ Task 1 ✓ ─────> reportTaskResult() ──┐               │
│    ├─ Task 2 ✓ ─────> reportTaskResult() ──┤               │
│    └─ Task 3 ❌ ─────> reportTaskResult() ──┤               │
│                                               │               │
└───────────────────────────────────────────────┼───────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Failure Detection                          │
│                                                              │
│  [CLI Activity Manager]                                      │
│    └─ Receives: { task 3 failed, error: "variable missing" }│
│    └─ Triggers: FailureAnalyzer                              │
│                                                              │
└───────────────────────────────────────────────┼───────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Failure Analysis                           │
│                                                              │
│  [FailureAnalyzer]                                           │
│    ├─ Categorize error → "variable_missing"                 │
│    ├─ Search similar failures → 3 past occurrences          │
│    ├─ Generate fix → "Add default value"                    │
│    └─ Check fixable → YES                                   │
│                                                              │
└───────────────────────────────────────────────┼───────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Self-Healing                               │
│                                                              │
│  [ActivitySelfHealer]                                        │
│    ├─ Determine strategy → "add_variable_default"           │
│    ├─ Clone variant → "other-97e440b7-v2"                   │
│    ├─ Apply fix → Add endpoint_path = "/api/resource"       │
│    ├─ Test variant → Execute with test variables ✓          │
│    └─ Mark healed → Update Thompson Sampling stats          │
│                                                              │
└───────────────────────────────────────────────┼───────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Learning Loop                              │
│                                                              │
│  [Backend Learning System]                                   │
│    ├─ Update variant stats:                                 │
│    │   - v1: 30% success (deprecated)                       │
│    │   - v2: 85% success (healed variant) ← SELECTED        │
│    ├─ Thompson Sampling: Prefers v2 for future executions   │
│    └─ Activity reliability: ↑ 55% improvement               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Immediate**: Implement Phase 1 (State Capture) - CRITICAL for all debugging
2. **This Week**: Test task-level tracking with demo activity
3. **Next Week**: Implement Phase 2 (Failure Analysis)
4. **Following Week**: Implement Phase 3 (Self-Healing)

**Goal**: Have self-healing system operational by March 1, 2026

---

**Status**: 📝 Design Complete - Ready for Implementation  
**Priority**: 🚨 CRITICAL - Blocks activity system reliability  
**Impact**: 🚀 GAME-CHANGER - Enables autonomous improvement
