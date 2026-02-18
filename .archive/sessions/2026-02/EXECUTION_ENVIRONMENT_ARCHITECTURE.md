# Execution Environment Architecture: Algorithmic Recording & Validation

## Core Principle: System Records, Not Agent

**Wrong Approach** (what we analyzed before):
```
Agent: "I made a decision, let me record it..."
  → Calls record_decision() tool
  → Relies on agent discipline
  → Inconsistent, incomplete, unreliable
```

**Right Approach** (what we should build):
```
Execution Environment:
  → Agent executes step
  → System captures ALL behavior automatically
  → No agent involvement in recording
  → Complete, consistent, reliable
```

## New Architecture: Instrumented Execution

```
┌─────────────────────────────────────────────────────────────┐
│            metabob-opencode: Thin Orchestration Layer       │
│  - Present activities TO agent (not agent discovers)        │
│  - Spawn execution environment                              │
│  - Collect results                                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ MCP stdio
                           │
┌──────────────────────────▼──────────────────────────────────┐
│        metabob-cli: Instrumented Execution Environment      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Execution Tracer (NEW)                         │ │
│  │  - Intercepts ALL tool calls                           │ │
│  │  - Records before/after state                          │ │
│  │  - Extracts decisions automatically                    │ │
│  │  - Maps file changes → components → tasks              │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                   │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │         ActivityExecutor (Enhanced)                    │ │
│  │  - Step execution with full tracing                    │ │
│  │  - Automatic validation reuse                          │ │
│  │  - Component-aware task mapping                        │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                   │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │         CPG Component Mapper (NEW)                     │ │
│  │  - Maps file changes → components                      │ │
│  │  - Links components → tasks                            │ │
│  │  - Tracks component evolution                          │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                   │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │         ValidationRegistry (NEW)                       │ │
│  │  - Stores reusable validation rules                    │ │
│  │  - Consistent validation across activities             │ │
│  │  - Build validation from successful executions         │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                   │
└───────────────────────────┼───────────────────────────────────┘
                            │ HTTP
                            │
┌───────────────────────────▼───────────────────────────────────┐
│          metabob-rpc-api: Unified Learning Backend            │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │         Unified Execution Schema (NEW)                   │ │
│  │  - Single table: ExecutionTrace                          │ │
│  │  - Includes: steps, tools, components, validations      │ │
│  │  - No fragmentation                                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │         Tool Pattern Learner (NEW)                       │ │
│  │  - Learns which tools to call                            │ │
│  │  - Learns how to call them (effective args)             │ │
│  │  - Builds tool call graphs                              │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │         Validation Builder (NEW)                         │ │
│  │  - Extracts validation from successful executions       │ │
│  │  - Reuses validation across templates                   │ │
│  │  - Consistent quality gates                             │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

## Part 1: Activities Presented TO Agent

### Current (Wrong)
```typescript
// Agent discovers and chooses
Agent: "Let me search for activities..."
  → search_activities()
  → Reviews results
  → Decides which to use
```

**Problems:**
- Agent might ignore activities
- Agent might choose poorly
- Inconsistent selection behavior
- Extra tokens/cost for discovery

### New (Right)
```typescript
// System presents best activity in context
SystemPrompt: `
<recommended_activity>
  Based on your intent (fix TypeError), the recommended workflow is:
  
  Activity: Fix Bug with TDD
  Success Rate: 86%
  Avg Cost: $0.28
  Avg Duration: 20 minutes
  
  To use this activity, simply say:
  "Use fix-bug activity" or "I'll use the recommended activity"
</recommended_activity>
`

Agent: "I'll use the recommended activity"  # Natural, simple
```

**Benefits:**
- Zero discovery cost (already in prompt)
- Best activity pre-selected by backend
- Agent just accepts or provides alternative
- Consistent behavior

### Implementation

**metabob-opencode: Modified Activity Recommendation Hook**
```typescript
TurnLifecycle.registerHook({
  name: "activity-recommendation",
  priority: 15,
  
  execute: async (ctx) => {
    // Query backend for BEST activity (not multiple options)
    const recommended = await mcpCall("get_recommended_activity", {
      intent: ctx.classifiedIntent,  // From memory agent
      context: ctx.recentFiles,
      history: ctx.sessionHistory
    })
    
    if (recommended) {
      // Inject SINGLE recommendation prominently
      return {
        agentContext: [{
          type: "activity-recommendation",
          content: formatRecommendation(recommended),
          priority: "high"
        }]
      }
    }
  }
})
```

**metabob-cli: Single-Best Recommendation**
```python
@mcp.tool()
async def get_recommended_activity(
    intent: str,
    context: dict,
    history: list[str]
) -> dict:
    """Get THE recommended activity (singular), not a list."""
    
    # Call backend for Thompson Sampling selection
    response = await client.post("/activity-recommendations/select-best", json={
        "intent": intent,
        "context": context,
        "history": history,
        "auto_select": True  # Backend picks best
    })
    
    return response.json()  # Single activity, not array
```

**metabob-rpc-api: Automatic Best Selection**
```python
@router.post("/activity-recommendations/select-best")
async def select_best_activity(request: BestActivityRequest):
    """Select single best activity using Thompson Sampling."""
    
    # Thompson Sampling draws ONE sample (not ranking multiple)
    best_activity = thompson_sampling.draw_best(
        intent=request.intent,
        context=request.context,
        history=request.history
    )
    
    return {
        "activity_id": best_activity.id,
        "variant_id": best_activity.variant_id,
        "selection_id": generate_selection_id(),
        "expected_success_rate": best_activity.success_rate,
        "expected_cost": best_activity.avg_cost,
        "expected_duration": best_activity.avg_duration,
        "description": best_activity.description,
        "auto_selected": True
    }
```

## Part 2: Execution Environment Records Automatically

### Instrumented Execution Environment

```python
# metabob-cli: Execution tracer wraps agent execution

class ExecutionTracer:
    """
    Automatically records ALL agent behavior during step execution.
    
    NO AGENT INVOLVEMENT - System captures everything:
    - Tool calls (before/after state)
    - File changes (which components modified)
    - Time spent on each operation
    - Decision patterns (extracted from behavior)
    - Context references (which impulses accessed)
    """
    
    def __init__(self, execution_id: str, step_id: str):
        self.execution_id = execution_id
        self.step_id = step_id
        self.trace = ExecutionTrace(
            execution_id=execution_id,
            step_id=step_id,
            started_at=time.time(),
            tool_calls=[],
            file_changes=[],
            component_changes=[],
            context_accesses=[],
            decisions_extracted=[]
        )
    
    def trace_tool_call(self, tool: str, args: dict, before_state: dict) -> CallContext:
        """Wrap tool call with automatic tracing."""
        
        call_id = generate_call_id()
        start_time = time.time()
        
        # Record before state
        before_snapshot = {
            "files_modified": list_modified_files(),
            "components_touched": [],  # Will populate after
            "context_loaded": list_loaded_impulses()
        }
        
        # Create call context for during-execution tracking
        return CallContext(
            call_id=call_id,
            tool=tool,
            args=args,
            before_state=before_snapshot,
            start_time=start_time
        )
    
    def record_tool_result(self, ctx: CallContext, result: any, error: any = None):
        """Record tool call completion with full trace."""
        
        end_time = time.time()
        duration = end_time - ctx.start_time
        
        # Capture after state
        after_snapshot = {
            "files_modified": list_modified_files(),
            "components_touched": [],  # Populate from CPG
            "context_loaded": list_loaded_impulses()
        }
        
        # Analyze what changed
        file_changes = diff_snapshots(ctx.before_state, after_snapshot)
        
        # Map file changes to components (using CPG)
        if file_changes:
            component_changes = await self._map_files_to_components(file_changes)
            after_snapshot["components_touched"] = component_changes
        
        # Extract decision pattern from tool usage
        decision = self._extract_decision_from_tool_call(
            tool=ctx.tool,
            args=ctx.args,
            result=result,
            before=ctx.before_state,
            after=after_snapshot
        )
        
        # Record complete tool call trace
        tool_trace = ToolCallTrace(
            call_id=ctx.call_id,
            tool=ctx.tool,
            args=ctx.args,
            result=result,
            error=error,
            success=error is None,
            duration_ms=int(duration * 1000),
            before_state=ctx.before_state,
            after_state=after_snapshot,
            file_changes=file_changes,
            component_changes=component_changes,
            decision_extracted=decision
        )
        
        self.trace.tool_calls.append(tool_trace)
        
        # Real-time send to backend (async, non-blocking)
        asyncio.create_task(self._send_trace_to_backend(tool_trace))
    
    def _extract_decision_from_tool_call(
        self, tool: str, args: dict, result: any,
        before: dict, after: dict
    ) -> dict:
        """Extract decision pattern from tool usage."""
        
        # Pattern 1: Exploration (read/grep/search tools)
        if tool in ["read", "grep", "glob", "search_codebase_issues"]:
            return {
                "type": "exploration",
                "target": args.get("path") or args.get("pattern"),
                "outcome": "found" if result else "not_found",
                "confidence": 0.5  # Exploratory = lower confidence
            }
        
        # Pattern 2: Implementation (write/str_replace)
        if tool in ["str_replace", "write"]:
            return {
                "type": "implementation",
                "decision": f"Modify {args.get('path')}",
                "reasoning": "Inferred from file modification",
                "confidence": 0.8  # Implementation = higher confidence
            }
        
        # Pattern 3: Validation (shell, read_lints)
        if tool in ["shell", "read_lints"]:
            success = not (result and "error" in str(result).lower())
            return {
                "type": "validation",
                "check": args.get("command") or "linter",
                "passed": success,
                "confidence": 1.0  # Validation = objective
            }
        
        # Pattern 4: Error recovery (same tool called multiple times)
        # (Handled by sequence analysis)
        
        return {"type": "unknown"}
    
    async def _map_files_to_components(self, file_changes: list[str]) -> list[dict]:
        """Map changed files to CPG components."""
        
        component_changes = []
        
        for file_path in file_changes:
            # Query CPG for components in this file
            components = await cpg_client.list_components(file_path)
            
            for component in components:
                component_changes.append({
                    "file": file_path,
                    "component": component["name"],
                    "type": component["type"],  # function, class, method
                    "line_range": component.get("line_range"),
                    "modified": True  # File was modified
                })
        
        return component_changes
    
    async def finalize_trace(self, step_output: str, step_success: bool) -> ExecutionTrace:
        """Finalize trace after step completion."""
        
        self.trace.ended_at = time.time()
        self.trace.duration_ms = int((self.trace.ended_at - self.trace.started_at) * 1000)
        self.trace.success = step_success
        self.trace.output = step_output
        
        # Analyze tool sequence
        self.trace.tool_sequence_pattern = self._analyze_tool_sequence()
        
        # Calculate effectiveness metrics
        self.trace.effectiveness = self._calculate_effectiveness()
        
        # Send complete trace to backend
        await self._send_complete_trace()
        
        return self.trace
    
    def _analyze_tool_sequence(self) -> dict:
        """Analyze the sequence of tools called."""
        
        tools_used = [call.tool for call in self.trace.tool_calls]
        
        # Identify phases
        phases = []
        if any(t in ["read", "grep", "search"] for t in tools_used[:3]):
            phases.append("exploration")
        if any(t in ["str_replace", "write"] for t in tools_used):
            phases.append("implementation")
        if any(t in ["shell", "read_lints"] for t in tools_used):
            phases.append("validation")
        
        return {
            "tools_used": tools_used,
            "tool_count": len(tools_used),
            "unique_tools": len(set(tools_used)),
            "phases": phases,
            "pattern_type": " → ".join(phases)
        }
    
    def _calculate_effectiveness(self) -> dict:
        """Calculate effectiveness metrics."""
        
        # Tool success rate
        successful_tools = sum(1 for call in self.trace.tool_calls if call.success)
        tool_success_rate = successful_tools / len(self.trace.tool_calls) if self.trace.tool_calls else 1.0
        
        # Time efficiency (were tools fast or slow?)
        avg_tool_duration = sum(call.duration_ms for call in self.trace.tool_calls) / len(self.trace.tool_calls) if self.trace.tool_calls else 0
        
        # Component coverage (what % of expected components were touched?)
        # (Calculated by comparing to activity's expected components)
        
        return {
            "tool_success_rate": tool_success_rate,
            "avg_tool_duration_ms": avg_tool_duration,
            "efficient": avg_tool_duration < 500  # Fast tools
        }
```

## Part 2: CPG Component Mapping

### File Changes → Components → Tasks

```python
class CPGComponentMapper:
    """
    Maps file changes to CPG components and links to activity tasks.
    
    Key capability: Understand WHAT was actually modified (at component level),
    not just which files changed.
    """
    
    def __init__(self, cpg_client, activity_spec: dict):
        self.cpg = cpg_client
        self.activity = activity_spec
        self.component_map = {}  # Cache CPG components
    
    async def map_execution_to_intent(
        self,
        execution_trace: ExecutionTrace,
        activity_intent: str
    ) -> ComponentMapping:
        """
        Map what was actually done (execution) to what was intended (activity).
        
        This is the KEY to understanding if execution matched intent.
        """
        
        # Step 1: Get all file changes from execution
        file_changes = set()
        for tool_call in execution_trace.tool_calls:
            if tool_call.tool in ["str_replace", "write"]:
                file_changes.add(tool_call.args.get("path"))
        
        # Step 2: Map files → components using CPG
        actual_components = []
        for file_path in file_changes:
            components = await self._get_components_in_file(file_path)
            
            for component in components:
                # Check if component was actually modified
                # (component might exist in file but not touched)
                if await self._component_was_modified(component, tool_call.args):
                    actual_components.append({
                        "file": file_path,
                        "component": component["name"],
                        "type": component["type"],
                        "line_range": component["line_range"]
                    })
        
        # Step 3: Extract expected components from activity intent
        expected_components = self._extract_expected_components(activity_intent)
        
        # Step 4: Map tasks → components
        task_component_map = {}
        for task in self.activity["tasks"]:
            task_components = self._extract_task_components(task)
            task_component_map[task["step_id"]] = task_components
        
        # Step 5: Calculate mapping accuracy
        mapping = ComponentMapping(
            expected_components=expected_components,
            actual_components=actual_components,
            task_component_map=task_component_map,
            
            # Accuracy metrics
            accuracy=self._calculate_accuracy(expected_components, actual_components),
            missed_components=[c for c in expected_components if c not in actual_components],
            extra_components=[c for c in actual_components if c not in expected_components],
            
            # Task alignment
            tasks_aligned=self._check_task_alignment(actual_components, task_component_map),
            tasks_deviated=self._find_deviations(actual_components, task_component_map)
        )
        
        return mapping
    
    async def _get_components_in_file(self, file_path: str) -> list[dict]:
        """Get all CPG components in file."""
        
        # Check cache first
        if file_path in self.component_map:
            return self.component_map[file_path]
        
        # Query CPG
        components = await self.cpg.list_file_components(file_path)
        
        # Cache for reuse
        self.component_map[file_path] = components
        
        return components
    
    async def _component_was_modified(self, component: dict, str_replace_args: dict) -> bool:
        """Check if a str_replace actually touched this component."""
        
        # If we have line range and str_replace has old_string, check if they overlap
        if "line_range" in component and "old_string" in str_replace_args:
            component_lines = set(range(component["line_range"][0], component["line_range"][1] + 1))
            
            # Parse old_string location (would need to read file and find it)
            # For now, return True (conservative - assume modified)
            return True
        
        return True
    
    def _extract_expected_components(self, intent: str) -> list[str]:
        """Extract expected components from activity intent/description."""
        
        # Parse intent for component references
        # Examples:
        # - "Fix TypeError in Tool.execute" → ["Tool.execute"]
        # - "Add POST endpoint" → ["router", "handler", "schema"]
        
        components = []
        
        # Pattern 1: "in ComponentName"
        pattern1 = re.findall(r"in\s+([A-Z][a-zA-Z0-9_\.]+)", intent)
        components.extend(pattern1)
        
        # Pattern 2: Known component types
        if "schema" in intent.lower():
            components.append("schema")
        if "handler" in intent.lower():
            components.append("handler")
        if "test" in intent.lower():
            components.append("test")
        
        return list(set(components))
    
    def _extract_task_components(self, task: dict) -> list[str]:
        """Extract which components a task is expected to modify."""
        
        # Look in task description and prompt
        text = f"{task.get('description', '')} {task.get('prompt', {}).get('template', '')}"
        
        # Extract component references
        components = []
        
        # Common patterns in task descriptions
        if "schema" in text.lower():
            components.append("schema")
        if "handler" in text.lower():
            components.append("handler")
        if "test" in text.lower():
            components.append("test")
        
        # Parse {{variables}} - these often contain component names
        variables = re.findall(r"{{(\w+)}}", text)
        for var in variables:
            if var in ["component", "componentName", "function", "class"]:
                components.append(f"<{var}>")  # Placeholder
        
        return components
    
    def _calculate_accuracy(
        self, expected: list[str], actual: list[str]
    ) -> float:
        """Calculate component-level accuracy."""
        
        if not expected:
            return 1.0  # No expectations = perfect
        
        expected_set = set(expected)
        actual_set = set(actual)
        intersection = expected_set & actual_set
        
        return len(intersection) / len(expected_set)
    
    def _check_task_alignment(
        self,
        actual_components: list[dict],
        task_component_map: dict[str, list[str]]
    ) -> dict:
        """Check if actual components align with task assignments."""
        
        alignment = {}
        
        for step_id, expected_components in task_component_map.items():
            # Check how many actual components match this task
            actual_names = [c["component"] for c in actual_components]
            matched = [c for c in expected_components if c in actual_names]
            
            alignment[step_id] = {
                "expected": expected_components,
                "matched": matched,
                "alignment_score": len(matched) / len(expected_components) if expected_components else 1.0
            }
        
        return alignment
    
    def _find_deviations(
        self,
        actual_components: list[dict],
        task_component_map: dict[str, list[str]]
    ) -> list[dict]:
        """Find components modified outside expected tasks."""
        
        # Flatten all expected components
        all_expected = set()
        for components in task_component_map.values():
            all_expected.update(components)
        
        # Find actual components not in any task
        actual_names = [c["component"] for c in actual_components]
        deviations = []
        
        for component in actual_components:
            if component["component"] not in all_expected:
                deviations.append({
                    "component": component["component"],
                    "file": component["file"],
                    "unexpected": True,
                    "reason": "Not in any task's expected components"
                })
        
        return deviations
```

### Automatic Tool Call Wrapping

```python
# metabob-cli: Worker execution with automatic tracing

class InstrumentedActivityExecutor:
    """
    Executes activity steps with AUTOMATIC recording.
    Agent doesn't know it's being traced.
    """
    
    async def execute_step(
        self,
        execution_id: str,
        step: dict,
        agent_session_id: str
    ) -> StepResult:
        """Execute step with full automatic tracing."""
        
        # Create tracer
        tracer = ExecutionTracer(execution_id, step["step_id"])
        
        # Wrap ALL tool calls with tracing
        original_tools = get_tool_registry(agent_session_id)
        wrapped_tools = self._wrap_tools_with_tracing(original_tools, tracer)
        set_tool_registry(agent_session_id, wrapped_tools)
        
        try:
            # Execute step (agent uses wrapped tools)
            # Agent is UNAWARE of tracing - tools look identical
            result = await execute_agent_step(
                session_id=agent_session_id,
                prompt=step["prompt_template"],
                variables=step.get("variables", {}),
                tools=wrapped_tools
            )
            
            # Finalize trace (automatic)
            trace = await tracer.finalize_trace(
                step_output=result.output,
                step_success=result.success
            )
            
            # Create step result with trace embedded
            return StepResult(
                step_id=step["step_id"],
                success=result.success,
                output=result.output,
                cost=result.cost,
                tokens=result.tokens,
                duration_ms=trace.duration_ms,
                tool_calls=trace.tool_calls,  # Full traces
                component_changes=trace.component_changes,  # CPG mapped
                decisions_extracted=trace.decisions_extracted,  # Automatic
                trace=trace  # Complete trace object
            )
            
        finally:
            # Restore original tools
            set_tool_registry(agent_session_id, original_tools)
    
    def _wrap_tools_with_tracing(
        self, tools: dict, tracer: ExecutionTracer
    ) -> dict:
        """Wrap each tool with automatic tracing."""
        
        wrapped = {}
        
        for tool_name, tool_func in tools.items():
            async def traced_tool(*args, **kwargs):
                # Before tool execution
                ctx = tracer.trace_tool_call(
                    tool=tool_name,
                    args={"args": args, "kwargs": kwargs},
                    before_state=capture_state()
                )
                
                try:
                    # Execute actual tool
                    result = await tool_func(*args, **kwargs)
                    
                    # After successful execution
                    tracer.record_tool_result(ctx, result, error=None)
                    
                    return result
                    
                except Exception as error:
                    # After failed execution
                    tracer.record_tool_result(ctx, result=None, error=error)
                    raise
            
            wrapped[tool_name] = traced_tool
        
        return wrapped
```

## Part 3: Unified Backend Schema

### Current Problem: Fragmented Storage

```
❌ Multiple tables with redundant data:
- activity_templates (template definition)
- activity_executions (execution data)
- activity_step_results (step-level data)
- activity_decisions (decision data)
- activity_context_usage (context tracking)
- activity_tool_patterns (tool analysis)
- activity_component_changes (CPG data)

Problem: Data spread across 7+ tables, complex joins, slow queries
```

### New: Unified Execution Schema

```python
# metabob-rpc-api: Single unified schema

class ExecutionTrace(BaseModel):
    """
    SINGLE unified record for entire execution trace.
    All data in one place - no fragmentation.
    """
    
    # Identification
    execution_id: str
    activity_id: str
    variant_id: str
    selection_id: str  # Links to Thompson Sampling
    session_id: str
    
    # Timing
    started_at: datetime
    ended_at: datetime
    duration_ms: int
    
    # Outcome
    success: bool
    output: str
    error: Optional[str]
    
    # Costs
    total_cost: float
    total_tokens: int
    cost_by_step: dict[str, float]  # step_id → cost
    
    # Steps (embedded, not separate table)
    steps: list[StepTrace] = [
        {
            "step_id": "diagnose",
            "step_index": 0,
            "success": true,
            "output": "Root cause found...",
            "duration_ms": 3000,
            "cost": 0.08,
            "tokens": 3000,
            
            # Tool calls (embedded)
            "tool_calls": [
                {
                    "call_id": "call_1",
                    "tool": "read",
                    "args": {"path": "src/tool.ts"},
                    "result": "[file content]",
                    "duration_ms": 50,
                    "before_state": {"files_modified": []},
                    "after_state": {"files_modified": []},
                    "decision_extracted": {
                        "type": "exploration",
                        "target": "src/tool.ts",
                        "outcome": "found"
                    }
                }
            ],
            
            # Component changes (embedded)
            "component_changes": [
                {
                    "file": "src/tool.ts",
                    "component": "Tool.execute",
                    "type": "function",
                    "action": "analyzed"  # or "modified", "created", "deleted"
                }
            ],
            
            # Decisions (embedded, extracted automatically)
            "decisions": [
                {
                    "type": "exploration",
                    "decision": "Check Tool.execute implementation",
                    "reasoning": "Inferred from read tool call",
                    "confidence": 0.5
                }
            ]
        }
    ],
    
    # Component mapping (links to intent)
    component_mapping: ComponentMapping = {
        "expected_components": ["Tool.execute", "bash.test.ts"],
        "actual_components": ["Tool.execute", "bash.test.ts", "tool.ts"],
        "accuracy": 0.66,
        "missed": [],
        "extra": ["tool.ts"],
        
        # Task alignment
        "task_alignment": {
            "diagnose": {
                "expected": ["Tool.execute"],
                "matched": ["Tool.execute"],
                "alignment_score": 1.0
            },
            "fix": {
                "expected": ["Tool.execute"],
                "matched": ["Tool.execute", "tool.ts"],
                "alignment_score": 0.5  # Expected 1, got 2
            }
        },
        
        # Deviations
        "deviations": [
            {
                "component": "tool.ts",
                "unexpected": true,
                "reason": "Not in activity intent"
            }
        ]
    },
    
    # Tool patterns (embedded)
    tool_patterns: ToolPatternAnalysis = {
        "sequence": ["read", "grep", "search", "str_replace", "read_lints", "shell"],
        "phases": ["exploration", "implementation", "validation"],
        "pattern_type": "exploration → implementation → validation",
        "effectiveness": {
            "tool_success_rate": 1.0,
            "avg_tool_duration_ms": 93,
            "efficient": true
        },
        
        # Tool-specific learning
        "tool_usage": {
            "read": {"count": 2, "success_rate": 1.0, "avg_duration_ms": 50},
            "grep": {"count": 1, "success_rate": 1.0, "avg_duration_ms": 30},
            "str_replace": {"count": 1, "success_rate": 1.0, "avg_duration_ms": 120}
        }
    },
    
    # Validation (embedded)
    validation: ValidationResult = {
        "ran": true,
        "rules_checked": ["typecheck", "tests", "linter"],
        "results": {
            "typecheck": {"passed": true, "duration_ms": 1200},
            "tests": {"passed": 15, "failed": 0, "duration_ms": 8000},
            "linter": {"issues": 0, "duration_ms": 500}
        },
        "overall_passed": true
    },
    
    # Context usage (embedded)
    context_usage: dict = {
        "impulses_loaded": ["errorFile", "relatedTest", "recentChanges"],
        "impulses_referenced": ["errorFile", "relatedTest"],  # Analyzed from output
        "impulses_ignored": ["recentChanges"],
        "token_efficiency": {
            "errorFile": {"budget": 2000, "used": 1450, "wasted": 0, "effective": true},
            "relatedTest": {"budget": 1500, "used": 950, "wasted": 200, "effective": true},
            "recentChanges": {"budget": 1000, "used": 800, "wasted": 800, "effective": false}
        }
    },
    
    # Learning metadata (derived)
    learning_data: dict = {
        "component_accuracy": 0.66,
        "task_alignment_score": 0.75,
        "tool_pattern_effectiveness": 0.92,
        "validation_consistency": 1.0,
        "cost_efficiency": 1.08,  # Better than expected (lower cost)
        "duration_efficiency": 1.11  # Faster than expected
    }
```

**Benefits:**
- ✅ **Single query** to get complete execution data
- ✅ **No joins** across multiple tables
- ✅ **Embedded relationships** (steps, tools, components)
- ✅ **Atomic updates** (one write operation)
- ✅ **Easy analytics** (all data co-located)

### SurrealDB Schema

```sql
-- Single unified table
DEFINE TABLE execution_trace SCHEMAFULL;

-- All fields in one place
DEFINE FIELD execution_id ON execution_trace TYPE string;
DEFINE FIELD activity_id ON execution_trace TYPE string;
DEFINE FIELD variant_id ON execution_trace TYPE string;
DEFINE FIELD steps ON execution_trace TYPE array;
DEFINE FIELD component_mapping ON execution_trace TYPE object;
DEFINE FIELD tool_patterns ON execution_trace TYPE object;
DEFINE FIELD validation ON execution_trace TYPE object;
DEFINE FIELD context_usage ON execution_trace TYPE object;
DEFINE FIELD learning_data ON execution_trace TYPE object;

-- Indexes for fast queries
DEFINE INDEX idx_activity ON execution_trace FIELDS activity_id;
DEFINE INDEX idx_variant ON execution_trace FIELDS variant_id;
DEFINE INDEX idx_success ON execution_trace FIELDS success, ended_at;

-- Query examples (FAST - no joins!)
SELECT * FROM execution_trace WHERE activity_id = 'fix-bug' AND success = true;
SELECT AVG(learning_data.component_accuracy) FROM execution_trace WHERE variant_id = 'fix-bug_v2';
SELECT tool_patterns.sequence FROM execution_trace WHERE success = true GROUP BY tool_patterns.sequence;
```

## Part 4: Reusable Validation System

### Validation Registry

```python
# metabob-cli: ValidationRegistry

class ValidationRegistry:
    """
    Central registry for reusable validation rules.
    Validation is EXTRACTED from successful executions, not manually defined.
    """
    
    def __init__(self, backend_url: str):
        self.backend_url = backend_url
        self._validation_cache = {}
    
    async def extract_validation_from_execution(
        self,
        execution_trace: ExecutionTrace
    ) -> ValidationRule:
        """
        Automatically extract validation from successful execution.
        
        Key insight: If execution succeeded, its validations are GOOD.
        Reuse them for similar activities.
        """
        
        if not execution_trace.success:
            return None  # Don't extract from failures
        
        validation = execution_trace.validation
        if not validation or not validation.get("ran"):
            return None  # No validation to extract
        
        # Build reusable validation rule
        rule = ValidationRule(
            rule_id=generate_rule_id(execution_trace),
            name=f"Validation from {execution_trace.activity_id}",
            category=execution_trace.activity.get("category"),
            
            # Extract checks that passed
            checks=[
                {
                    "type": "command",
                    "command": check_name,
                    "expected": "success",
                    "timeout_ms": result["duration_ms"] * 2  # 2× observed time
                }
                for check_name, result in validation["results"].items()
                if result.get("passed")
            ],
            
            # Metadata
            extracted_from: execution_trace.execution_id,
            success_count: 1,
            failure_count: 0,
            last_used: execution_trace.ended_at,
            
            # Applicability (when to use this rule)
            applicable_to: {
                "categories": [execution_trace.activity.get("category")],
                "components": execution_trace.component_mapping["actual_components"],
                "file_patterns": [c["file"] for c in execution_trace.component_mapping["actual_components"]]
            }
        )
        
        # Save to registry
        await self._save_validation_rule(rule)
        
        return rule
    
    async def find_applicable_validation(
        self,
        activity: dict,
        components: list[str]
    ) -> list[ValidationRule]:
        """
        Find validation rules applicable to this activity.
        
        Reuses validation from similar successful executions.
        """
        
        # Query backend for matching rules
        response = await httpx.post(f"{self.backend_url}/validation/find", json={
            "category": activity.get("category"),
            "components": components,
            "min_success_rate": 0.8  # Only use reliable rules
        })
        
        rules = response.json()
        
        return [ValidationRule(**rule) for rule in rules]
    
    async def apply_validation(
        self,
        execution_id: str,
        rules: list[ValidationRule]
    ) -> ValidationResult:
        """
        Apply reusable validation rules.
        
        Consistent validation across all activities.
        """
        
        results = {}
        overall_passed = True
        
        for rule in rules:
            for check in rule.checks:
                if check["type"] == "command":
                    # Run command with timeout
                    result = await run_command(
                        check["command"],
                        timeout_ms=check["timeout_ms"]
                    )
                    
                    passed = (result.exit_code == 0) if check["expected"] == "success" else (result.exit_code != 0)
                    
                    results[check["command"]] = {
                        "passed": passed,
                        "duration_ms": result.duration_ms,
                        "output": result.output[:1000],  # Truncate
                        "rule_id": rule.rule_id
                    }
                    
                    if not passed:
                        overall_passed = False
                        
                        # Update rule stats (failed)
                        await self._update_rule_stats(rule.rule_id, success=False)
                    else:
                        # Update rule stats (success)
                        await self._update_rule_stats(rule.rule_id, success=True)
        
        return ValidationResult(
            ran=True,
            rules_checked=[r.rule_id for r in rules],
            results=results,
            overall_passed=overall_passed
        )
    
    async def evolve_validation_rules(self):
        """
        Periodically improve validation rules based on usage.
        
        - Rules with high success rate: keep
        - Rules that always pass: might be redundant
        - Rules that fail often: need investigation
        """
        
        response = await httpx.get(f"{self.backend_url}/validation/analyze")
        insights = response.json()
        
        # Example insights:
        # - "typecheck" rule: 100% pass rate, always useful → KEEP
        # - "linter" rule: 95% pass rate, caught 5% of issues → KEEP
        # - "custom-check" rule: 100% pass rate, never caught anything → REMOVE?
        
        return insights
```

### Consistent Validation Application

```python
# Every activity automatically gets validation

async def execute_activity(execution_id: str, activity: dict):
    """Execute activity with automatic validation."""
    
    # Execute all steps...
    for step in activity["tasks"]:
        step_result = await execute_step(execution_id, step)
        if not step_result.success:
            return failure_result
    
    # AUTOMATIC VALIDATION (no configuration needed)
    # Find applicable validation rules based on components touched
    component_changes = get_component_changes(execution_id)
    validation_rules = await validation_registry.find_applicable_validation(
        activity=activity,
        components=[c["component"] for c in component_changes]
    )
    
    # Apply all applicable rules
    validation_result = await validation_registry.apply_validation(
        execution_id,
        validation_rules
    )
    
    if not validation_result.overall_passed:
        # Validation failed - enter trailblazing or fail
        return handle_validation_failure(execution_id, validation_result)
    
    # Validation passed
    # Extract NEW validation rules from this successful execution
    new_rule = await validation_registry.extract_validation_from_execution(
        get_execution_trace(execution_id)
    )
    
    return success_result
```

## Part 4: Tool Call Learning

### Tool Call Graph

```python
# metabob-rpc-api: Learn tool calling patterns

class ToolCallGraphBuilder:
    """
    Builds graphs of effective tool sequences.
    Learns which tools to call and how to call them.
    """
    
    async def build_graph_from_executions(
        self, executions: list[ExecutionTrace]
    ) -> ToolCallGraph:
        """Build tool call graph from execution history."""
        
        graph = ToolCallGraph()
        
        for execution in executions:
            if not execution.success:
                continue  # Only learn from successes
            
            # Extract tool sequence
            for step in execution.steps:
                prev_tool = None
                
                for tool_call in step.tool_calls:
                    tool = tool_call.tool
                    args = tool_call.args
                    
                    # Add node
                    graph.add_node(tool, {
                        "call_count": 1,
                        "success_rate": 1.0 if tool_call.success else 0.0,
                        "avg_duration_ms": tool_call.duration_ms,
                        "common_args": extract_arg_patterns(args)
                    })
                    
                    # Add edge (tool sequence)
                    if prev_tool:
                        graph.add_edge(prev_tool, tool, {
                            "frequency": 1,
                            "avg_gap_ms": tool_call.start_time - prev_tool.end_time,
                            "success_when_followed": 1.0 if tool_call.success else 0.0
                        })
                    
                    prev_tool = tool
        
        return graph
    
    def find_effective_sequences(
        self, graph: ToolCallGraph, for_intent: str
    ) -> list[ToolSequence]:
        """Find most effective tool sequences for given intent."""
        
        # Example: For "bug fix" intent
        # Common sequence: read → grep → str_replace → shell
        
        sequences = []
        
        # Find paths through graph with high success rates
        for path in graph.find_paths(min_success_rate=0.8):
            sequences.append(ToolSequence(
                tools=path.nodes,
                success_rate=path.success_rate,
                avg_duration_ms=path.avg_duration,
                usage_count=path.frequency,
                applicable_intents=[for_intent]
            ))
        
        # Sort by effectiveness
        sequences.sort(
            key=lambda s: (s.success_rate, -s.avg_duration_ms, s.usage_count),
            reverse=True
        )
        
        return sequences
    
    def suggest_next_tool(
        self, current_sequence: list[str], intent: str
    ) -> list[tuple[str, float]]:
        """Suggest next tool based on current sequence."""
        
        # Look at graph edges from last tool
        if not current_sequence:
            # Start of execution
            start_tools = self.graph.get_common_start_tools(intent)
            return start_tools  # [(tool, probability), ...]
        
        last_tool = current_sequence[-1]
        next_tools = self.graph.get_next_tools(last_tool, intent)
        
        # Sort by success_when_followed probability
        return sorted(next_tools, key=lambda t: t[1], reverse=True)
```

### Tool Argument Learning

```python
class ToolArgumentLearner:
    """
    Learns effective tool arguments from successful calls.
    """
    
    def analyze_tool_args(
        self, tool_name: str, successful_calls: list[ToolCallTrace]
    ) -> dict:
        """Analyze which arguments work well."""
        
        # Group by argument patterns
        arg_patterns = {}
        
        for call in successful_calls:
            # Extract argument signature
            sig = create_arg_signature(call.args)
            
            if sig not in arg_patterns:
                arg_patterns[sig] = {
                    "example_args": call.args,
                    "count": 0,
                    "success_rate": 0.0,
                    "avg_duration_ms": 0
                }
            
            arg_patterns[sig]["count"] += 1
            arg_patterns[sig]["success_rate"] += 1.0 if call.success else 0.0
            arg_patterns[sig]["avg_duration_ms"] += call.duration_ms
        
        # Calculate averages
        for pattern in arg_patterns.values():
            pattern["success_rate"] /= pattern["count"]
            pattern["avg_duration_ms"] /= pattern["count"]
        
        # Find most effective patterns
        best_patterns = sorted(
            arg_patterns.items(),
            key=lambda p: (p[1]["success_rate"], -p[1]["avg_duration_ms"]),
            reverse=True
        )
        
        return {
            "tool": tool_name,
            "total_calls": len(successful_calls),
            "unique_patterns": len(arg_patterns),
            "most_effective": best_patterns[:5],
            "recommendations": self._generate_recommendations(best_patterns)
        }
    
    def _generate_recommendations(self, patterns: list) -> list[str]:
        """Generate recommendations for tool usage."""
        
        recommendations = []
        
        # Example: read tool
        if patterns[0][1]["example_args"].get("limit"):
            recommendations.append(
                f"Prefer using 'limit' parameter (95% success rate vs 80% without)"
            )
        
        # Example: grep tool
        if "-i" in patterns[0][1]["example_args"]:
            recommendations.append(
                f"Case-insensitive search more effective (92% vs 78%)"
            )
        
        return recommendations
```

## Part 5: Implementation Plan

### Phase 1: Instrumented Execution (metabob-cli)

**Files to create/modify:**
```
src/metabob_cli/mcp/execution_tracer.py (NEW)
src/metabob_cli/mcp/instrumented_executor.py (NEW)
src/metabob_cli/mcp/cpg_component_mapper.py (NEW)
src/metabob_cli/mcp/activity_manager.py (MODIFY - integrate tracing)
```

**Key changes:**
```python
# In activity_manager.py

async def execute_step_with_tracing(
    self, execution_id: str, step: dict
) -> StepResult:
    """Execute step with automatic tracing."""
    
    # Create tracer (captures everything)
    tracer = ExecutionTracer(execution_id, step["step_id"])
    
    # Execute with instrumented tools
    executor = InstrumentedActivityExecutor(tracer)
    result = await executor.execute_step(execution_id, step, agent_session_id)
    
    # Tracer has captured:
    # - All tool calls (before/after state)
    # - File changes → component changes (via CPG)
    # - Decision patterns (extracted automatically)
    # - Context references (which impulses used)
    
    # Send complete trace to backend
    await self._send_execution_trace(tracer.trace)
    
    return result
```

### Phase 2: Unified Backend Schema (metabob-rpc-api)

**Files to create/modify:**
```
server/models/execution_trace.py (NEW)
server/routes/execution_traces.py (NEW)
server/services/tool_pattern_learner.py (NEW)
server/services/validation_registry.py (NEW)
tasks/jobs/execution_analysis.py (NEW)
```

**Database migration:**
```sql
-- Create unified table
CREATE TABLE execution_trace ...;

-- Migrate existing data
INSERT INTO execution_trace 
  SELECT 
    e.execution_id,
    e.activity_id,
    -- Embed steps
    (SELECT JSON_AGG(s.*) FROM activity_step_results s WHERE s.execution_id = e.execution_id) as steps,
    -- Embed tool calls
    (SELECT JSON_AGG(t.*) FROM activity_tool_calls t WHERE t.execution_id = e.execution_id) as tool_calls,
    ...
  FROM activity_executions e;

-- Drop old fragmented tables
DROP TABLE activity_step_results;
DROP TABLE activity_tool_calls;
DROP TABLE activity_decisions;
...
```

### Phase 3: Component-Aware Task Mapping (metabob-cli)

**Files to create:**
```
src/metabob_cli/mcp/cpg_component_mapper.py (NEW)
src/metabob_cli/core/component_change_tracker.py (NEW)
```

**Integration:**
```python
# In execution_tracer.py

async def map_execution_to_intent(self, trace: ExecutionTrace) -> ComponentMapping:
    """Use CPG to understand what was actually done."""
    
    mapper = CPGComponentMapper(self.cpg_client, self.activity_spec)
    mapping = await mapper.map_execution_to_intent(trace, self.activity_intent)
    
    # Mapping tells us:
    # - Which components were modified (actual)
    # - Which components were intended (expected)
    # - Which tasks align with actual changes
    # - Which changes were unexpected
    
    return mapping
```

### Phase 4: Validation Extraction & Reuse (metabob-rpc-api)

**Files to create:**
```
server/services/validation_registry.py (NEW)
server/routes/validation_rules.py (NEW)
server/models/validation_rule.py (NEW)
```

**Workflow:**
```python
# After successful execution
trace = get_execution_trace(execution_id)

if trace.success and trace.validation.ran:
    # Extract validation as reusable rule
    rule = await validation_registry.extract_validation_from_execution(trace)
    
    # Rule is now available for similar activities
    # Next execution of similar activity automatically gets this validation

# Before executing new activity
applicable_rules = await validation_registry.find_applicable_validation(
    activity=new_activity,
    components=expected_components
)

# Apply accumulated validation
validation_result = await validation_registry.apply_validation(
    execution_id=new_execution_id,
    rules=applicable_rules
)
```

## Unified Schema Design

### Single ExecutionTrace Table

```python
class ExecutionTrace(BaseModel):
    """Unified execution record - NO FRAGMENTATION."""
    
    # === Identity ===
    execution_id: str
    activity_id: str
    variant_id: str
    selection_id: str
    session_id: str
    
    # === Timing ===
    started_at: datetime
    ended_at: datetime
    duration_ms: int
    
    # === Outcome ===
    success: bool
    output: str
    error: Optional[str] = None
    
    # === Costs ===
    total_cost: float
    total_tokens: int
    cost_breakdown: dict = {
        "by_step": {"step_id": float},
        "by_tool": {"tool_name": float},
        "by_phase": {"exploration": 0.05, "implementation": 0.10, "validation": 0.08}
    }
    
    # === Steps (EMBEDDED) ===
    steps: list[StepTrace] = [
        {
            "step_id": str,
            "step_index": int,
            "success": bool,
            "output": str,
            "duration_ms": int,
            "cost": float,
            "tokens": int,
            
            # Tool calls (EMBEDDED in step)
            "tool_calls": [
                {
                    "call_id": str,
                    "tool": str,
                    "args": dict,
                    "result": any,
                    "success": bool,
                    "duration_ms": int,
                    
                    # State capture (EMBEDDED in tool call)
                    "before_state": {
                        "files_modified": list[str],
                        "components_touched": list[dict]
                    },
                    "after_state": {
                        "files_modified": list[str],
                        "components_touched": list[dict]
                    },
                    
                    # Automatic extraction (EMBEDDED)
                    "decision_extracted": {
                        "type": "exploration" | "implementation" | "validation",
                        "reasoning": str,
                        "confidence": float
                    }
                }
            ],
            
            # Component changes (EMBEDDED in step)
            "component_changes": [
                {
                    "file": str,
                    "component": str,
                    "type": "function" | "class" | "method",
                    "action": "analyzed" | "modified" | "created" | "deleted",
                    "line_range": tuple[int, int]
                }
            ],
            
            # Decisions (EMBEDDED, extracted automatically)
            "decisions_extracted": [
                {
                    "type": str,
                    "decision": str,
                    "reasoning": str,
                    "confidence": float,
                    "extraction_method": str
                }
            ]
        }
    ]
    
    # === Component Mapping (EMBEDDED) ===
    component_mapping: ComponentMapping = {
        "intent": str,  # Original activity intent
        "expected_components": list[str],
        "actual_components": list[dict],
        "accuracy": float,
        "missed": list[str],
        "extra": list[str],
        
        # Task-level alignment
        "task_alignment": dict[str, dict],
        "deviations": list[dict]
    }
    
    # === Tool Patterns (EMBEDDED) ===
    tool_patterns: ToolPatternAnalysis = {
        "sequence": list[str],
        "phases": list[str],
        "pattern_type": str,
        "effectiveness": dict,
        "tool_usage": dict[str, dict]
    }
    
    # === Validation (EMBEDDED) ===
    validation: ValidationResult = {
        "ran": bool,
        "rules_applied": list[str],  # Which validation rules were used
        "results": dict[str, dict],
        "overall_passed": bool,
        "duration_ms": int
    }
    
    # === Context Usage (EMBEDDED) ===
    context_usage: dict = {
        "impulses_loaded": list[str],
        "impulses_referenced": list[str],
        "impulses_effective": list[str],
        "token_efficiency": dict[str, dict]
    }
    
    # === Learning Data (DERIVED, EMBEDDED) ===
    learning_data: dict = {
        "component_accuracy": float,
        "task_alignment_score": float,
        "tool_pattern_effectiveness": float,
        "validation_consistency": float,
        "cost_efficiency": float,
        "duration_efficiency": float,
        
        # Insights for evolution
        "strengths": list[str],  # What worked well
        "weaknesses": list[str],  # What needs improvement
        "recommendations": list[str]  # How to improve
    }
```

**Benefits of Unified Schema:**
- ✅ **Single query** for complete execution
- ✅ **No joins** required
- ✅ **Atomic writes** (consistency)
- ✅ **Embedded relationships** (fast access)
- ✅ **Easy analytics** (JSON queries)
- ✅ **Version-friendly** (add fields without migration)

## Part 5: Systematic Recording Flow

### Activity Start
```
Agent: "Use fix-bug activity"
  ↓
metabob-opencode: activity() tool → MCP: start_activity_execution()
  ↓
metabob-cli: ActivityManager.start_execution()
  ├─→ Create ExecutionTrace (unified record)
  ├─→ Create ExecutionTracer (instrumentation)
  ├─→ Initialize component mapper
  ├─→ Load applicable validation rules
  └─→ Return to agent: "Ready to execute"
```

### Step Execution (Automatic Recording)
```
metabob-cli: Execute step with tracing
  │
  ├─→ Wrap ALL tools with tracer
  │   - Tool calls intercepted
  │   - Before/after state captured
  │   - Decisions extracted automatically
  │
  ├─→ Agent executes (unaware of tracing)
  │   - Uses tools normally
  │   - Produces output
  │   - Tools record themselves
  │
  ├─→ After each tool call:
  │   - Capture state changes
  │   - Map files → components (CPG)
  │   - Extract decision pattern
  │   - Record to trace
  │   - Send to backend (async)
  │
  └─→ Step complete:
      - Finalize trace
      - Analyze tool sequence
      - Calculate effectiveness
      - Return result
```

### Activity Completion (Automatic Learning)
```
metabob-cli: All steps done
  ↓
Automatic validation:
  ├─→ Find applicable rules based on components touched
  ├─→ Apply rules (typecheck, tests, linter)
  ├─→ Record results in trace
  │
  ├─→ If validation passed:
  │   └─→ Extract NEW validation rule from this execution
  │       - Save to ValidationRegistry
  │       - Available for future activities
  │
  └─→ If validation failed:
      └─→ Trailblazing or fail
  ↓
Component mapping:
  ├─→ Map actual components modified to intended components
  ├─→ Calculate accuracy
  ├─→ Find deviations
  ├─→ Link to tasks
  ↓
Send complete trace to backend:
  ├─→ Single ExecutionTrace record (no fragmentation)
  ├─→ All data embedded (steps, tools, components, validations)
  ├─→ Learning data calculated
  ↓
Backend: Learning system update
  ├─→ Update Thompson Sampling
  ├─→ Update template metrics
  ├─→ Analyze tool patterns
  ├─→ Update validation rules
  ├─→ Trigger evolution if needed
```

## Benefits of New Architecture

### 1. No Agent Involvement
- ❌ No `record_decision` tool calls
- ❌ No manual recording
- ✅ System captures everything automatically
- ✅ Consistent, complete, reliable

### 2. Component-Level Understanding
- ❌ Just "file changes"
- ✅ Which components modified (CPG aware)
- ✅ Link components to tasks
- ✅ Understand if execution matched intent

### 3. Unified Backend Schema
- ❌ 7+ fragmented tables
- ✅ Single ExecutionTrace table
- ✅ All data embedded
- ✅ Fast queries, no joins

### 4. Reusable Validation
- ❌ Manually define validation per template
- ✅ Extract validation from successful executions
- ✅ Reuse across similar activities
- ✅ Consistent quality gates

### 5. Tool Call Learning
- ❌ Don't know which tools work
- ✅ Build tool call graph
- ✅ Learn effective sequences
- ✅ Suggest next tools

## Migration Path

### Step 1: Add Instrumentation (metabob-cli)
- Create ExecutionTracer
- Wrap tools with tracing
- Capture before/after state
- Extract decisions automatically

### Step 2: Add CPG Component Mapping (metabob-cli)
- Integrate CPG client
- Map file changes → components
- Link components → tasks
- Calculate alignment scores

### Step 3: Unified Backend Schema (metabob-rpc-api)
- Design ExecutionTrace model
- Create migration script
- Migrate existing data
- Update API endpoints

### Step 4: Validation Registry (metabob-rpc-api)
- Extract validation from successes
- Store in registry
- Find applicable rules
- Apply automatically

### Step 5: Tool Pattern Learning (metabob-rpc-api)
- Build tool call graphs
- Analyze effective sequences
- Learn argument patterns
- Generate recommendations

## Success Metrics

### Data Quality
- 100% of tool calls captured (not 0% today)
- 100% of file changes mapped to components (not done today)
- 100% of validations reusable (not done today)
- 90%+ decision extraction accuracy (automatic)

### Performance
- <10ms overhead per tool call (tracing)
- <100ms for component mapping (CPG query)
- <500ms for validation (reusable rules)
- <1s for complete trace finalization

### Learning
- Tool pattern library grows over time
- Validation rules accumulate automatically
- Component mappings improve accuracy
- Template evolution becomes data-driven

## Conclusion

This architecture shift moves from:
- **Agent-driven** (unreliable) → **System-driven** (reliable)
- **Manual recording** (inconsistent) → **Automatic recording** (complete)
- **Fragmented storage** (slow) → **Unified schema** (fast)
- **Manual validation** (tedious) → **Reusable validation** (consistent)
- **Unknown tool patterns** (guessing) → **Learned patterns** (data-driven)

The execution environment becomes **self-instrumenting** - it knows what agents do, why they do it, and whether it matched the intent. This enables true learning and continuous improvement.
