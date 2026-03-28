# Systematic Recording Implementation Plan

## Architectural Shift Summary

### From: Agent Records Itself ❌
```
Agent decides what to record → Incomplete, inconsistent, unreliable
```

### To: System Records Agent ✅
```
Execution environment instruments everything → Complete, consistent, automatic
```

## Implementation Phases

### Phase 1: Execution Tracer (metabob-cli)
**Priority**: HIGH  
**Effort**: Medium  
**Impact**: Captures 90% of missing behavioral data

#### File: `src/metabob_cli/mcp/execution_tracer.py`

```python
"""
Automatic execution tracing - captures ALL agent behavior without agent involvement.
"""

import time
import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class ToolCallTrace:
    """Complete trace of a single tool call."""
    call_id: str
    tool: str
    args: dict
    result: Any
    error: Optional[str]
    success: bool
    duration_ms: int
    
    # State snapshots
    before_state: dict  # Files, components before call
    after_state: dict   # Files, components after call
    
    # Changes detected
    file_changes: list[str]  # Files added/modified/deleted
    component_changes: list[dict]  # Components touched (from CPG)
    
    # Automatic extraction
    decision_extracted: dict  # Decision pattern inferred from tool usage
    context_references: list[str]  # Which impulses were accessed


@dataclass
class StepTrace:
    """Complete trace of activity step execution."""
    step_id: str
    step_index: int
    started_at: float
    ended_at: float
    duration_ms: int
    success: bool
    output: str
    cost: float
    tokens: int
    
    # All tool calls in this step
    tool_calls: list[ToolCallTrace] = field(default_factory=list)
    
    # Aggregate analysis
    tool_sequence: list[str] = field(default_factory=list)
    phases: list[str] = field(default_factory=list)  # exploration, implementation, validation
    component_changes: list[dict] = field(default_factory=list)
    decisions_extracted: list[dict] = field(default_factory=list)


@dataclass
class ExecutionTrace:
    """Complete trace of activity execution."""
    execution_id: str
    activity_id: str
    variant_id: str
    session_id: str
    
    started_at: float
    ended_at: Optional[float] = None
    duration_ms: int = 0
    
    success: bool = False
    
    # All steps
    steps: list[StepTrace] = field(default_factory=list)
    
    # Aggregates
    total_cost: float = 0.0
    total_tokens: int = 0
    tool_call_count: int = 0
    
    # Derived data
    component_mapping: Optional[dict] = None
    tool_patterns: Optional[dict] = None
    validation_result: Optional[dict] = None


class ExecutionTracer:
    """
    Instruments agent execution to capture all behavior automatically.
    
    NO AGENT INVOLVEMENT - Pure system-level tracing.
    """
    
    def __init__(
        self,
        execution_id: str,
        step_id: str,
        cpg_client=None,
        backend_client=None
    ):
        self.execution_id = execution_id
        self.step_id = step_id
        self.cpg_client = cpg_client
        self.backend_client = backend_client
        
        self.current_step_trace = StepTrace(
            step_id=step_id,
            step_index=0,
            started_at=time.time(),
            ended_at=0,
            duration_ms=0,
            success=False,
            output="",
            cost=0.0,
            tokens=0
        )
        
        self._file_snapshot_before = set()
        self._capture_initial_state()
    
    def _capture_initial_state(self):
        """Capture state before step execution."""
        try:
            # Get list of all files in project
            self._file_snapshot_before = set(self._list_project_files())
        except Exception as e:
            logger.warning(f"Failed to capture initial state: {e}")
            self._file_snapshot_before = set()
    
    def _list_project_files(self) -> list[str]:
        """List all project files."""
        # Implementation: walk project directory
        # Return list of file paths
        return []
    
    def wrap_tool(self, tool_name: str, tool_func: Callable) -> Callable:
        """
        Wrap a tool function with automatic tracing.
        
        The wrapped function looks identical to agent but records everything.
        """
        
        async def traced_tool(*args, **kwargs):
            # Generate call ID
            call_id = f"call_{len(self.current_step_trace.tool_calls)}_{int(time.time() * 1000)}"
            start_time = time.time()
            
            # Capture before state
            before_state = self._capture_state()
            
            logger.debug(f"[TRACE-{call_id}] Tool '{tool_name}' starting", extra={
                "execution_id": self.execution_id,
                "step_id": self.step_id,
                "tool": tool_name,
                "args": str(kwargs)[:200]
            })
            
            result = None
            error = None
            success = True
            
            try:
                # Execute actual tool
                result = await tool_func(*args, **kwargs)
                
            except Exception as e:
                error = str(e)
                success = False
                logger.warning(f"[TRACE-{call_id}] Tool '{tool_name}' failed: {error}")
                raise
                
            finally:
                # Capture after state (even if tool failed)
                after_state = self._capture_state()
                duration_ms = int((time.time() - start_time) * 1000)
                
                # Detect changes
                file_changes = self._diff_file_state(before_state, after_state)
                
                # Map to components (if CPG available)
                component_changes = []
                if self.cpg_client and file_changes:
                    component_changes = await self._map_files_to_components(file_changes)
                
                # Extract decision pattern
                decision = self._extract_decision(
                    tool_name, kwargs, result, before_state, after_state
                )
                
                # Create trace record
                trace = ToolCallTrace(
                    call_id=call_id,
                    tool=tool_name,
                    args=kwargs,
                    result=result,
                    error=error,
                    success=success,
                    duration_ms=duration_ms,
                    before_state=before_state,
                    after_state=after_state,
                    file_changes=file_changes,
                    component_changes=component_changes,
                    decision_extracted=decision,
                    context_references=[]  # Will populate from output analysis
                )
                
                # Add to step trace
                self.current_step_trace.tool_calls.append(trace)
                
                # Send to backend asynchronously (non-blocking)
                if self.backend_client:
                    asyncio.create_task(self._send_tool_trace(trace))
                
                logger.debug(f"[TRACE-{call_id}] Tool '{tool_name}' completed: {duration_ms}ms", extra={
                    "success": success,
                    "file_changes": len(file_changes),
                    "component_changes": len(component_changes)
                })
            
            return result
        
        # Preserve tool metadata
        traced_tool.__name__ = tool_func.__name__
        traced_tool.__doc__ = tool_func.__doc__
        
        return traced_tool
    
    def _capture_state(self) -> dict:
        """Capture current execution state."""
        return {
            "timestamp": time.time(),
            "files_modified": list(self._get_modified_files()),
            "files_created": [],  # Track new files
            "files_deleted": []   # Track deleted files
        }
    
    def _get_modified_files(self) -> set[str]:
        """Get list of currently modified files."""
        # Check git status or file mtimes
        # Return files changed since execution start
        return set()
    
    def _diff_file_state(self, before: dict, after: dict) -> list[str]:
        """Diff before/after file state."""
        before_files = set(before.get("files_modified", []))
        after_files = set(after.get("files_modified", []))
        return list(after_files - before_files)
    
    async def _map_files_to_components(self, files: list[str]) -> list[dict]:
        """Map changed files to CPG components."""
        if not self.cpg_client:
            return []
        
        components = []
        for file_path in files:
            try:
                file_components = await self.cpg_client.list_file_components(file_path)
                for comp in file_components:
                    components.append({
                        "file": file_path,
                        "component": comp.get("name"),
                        "type": comp.get("type"),
                        "action": "modified"  # analyzed, created, deleted
                    })
            except Exception as e:
                logger.warning(f"Failed to map {file_path} to components: {e}")
        
        return components
    
    def _extract_decision(
        self, tool: str, args: dict, result: Any,
        before: dict, after: dict
    ) -> dict:
        """Extract decision pattern from tool usage (automatic)."""
        
        # Exploration tools
        if tool in ["read", "grep", "glob", "semantic_search", "search_codebase_issues"]:
            has_result = bool(result)
            return {
                "type": "exploration",
                "action": f"Search for {args.get('pattern') or args.get('path')}",
                "outcome": "found" if has_result else "not_found",
                "confidence": 0.5,
                "extraction_method": "tool_type"
            }
        
        # Implementation tools
        elif tool in ["str_replace", "write", "delete"]:
            file_path = args.get("path", "unknown")
            return {
                "type": "implementation",
                "action": f"Modify {file_path}",
                "reasoning": "File modification detected",
                "confidence": 0.8,
                "extraction_method": "file_change"
            }
        
        # Validation tools
        elif tool in ["shell", "read_lints"]:
            success = not (result and "error" in str(result).lower())
            return {
                "type": "validation",
                "action": f"Run {args.get('command', 'validation')}",
                "outcome": "passed" if success else "failed",
                "confidence": 1.0,
                "extraction_method": "validation_result"
            }
        
        # Analysis tools
        elif tool.startswith("metabob_"):
            return {
                "type": "analysis",
                "action": f"Query code quality: {tool}",
                "confidence": 0.6,
                "extraction_method": "tool_prefix"
            }
        
        # Unknown
        return {
            "type": "unknown",
            "action": f"Call {tool}",
            "confidence": 0.3,
            "extraction_method": "fallback"
        }
    
    async def finalize_step_trace(
        self, output: str, success: bool, cost: float, tokens: int
    ) -> StepTrace:
        """Finalize step trace after execution completes."""
        
        self.current_step_trace.ended_at = time.time()
        self.current_step_trace.duration_ms = int(
            (self.current_step_trace.ended_at - self.current_step_trace.started_at) * 1000
        )
        self.current_step_trace.success = success
        self.current_step_trace.output = output
        self.current_step_trace.cost = cost
        self.current_step_trace.tokens = tokens
        
        # Analyze tool sequence
        self.current_step_trace.tool_sequence = [
            call.tool for call in self.current_step_trace.tool_calls
        ]
        
        # Identify phases
        self.current_step_trace.phases = self._identify_phases()
        
        # Aggregate component changes
        all_components = []
        for call in self.current_step_trace.tool_calls:
            all_components.extend(call.component_changes)
        self.current_step_trace.component_changes = self._deduplicate_components(all_components)
        
        # Aggregate decisions
        self.current_step_trace.decisions_extracted = [
            call.decision_extracted 
            for call in self.current_step_trace.tool_calls
            if call.decision_extracted.get("type") != "unknown"
        ]
        
        # Send complete step trace to backend
        if self.backend_client:
            await self._send_step_trace(self.current_step_trace)
        
        return self.current_step_trace
    
    def _identify_phases(self) -> list[str]:
        """Identify execution phases from tool sequence."""
        tools = self.current_step_trace.tool_sequence
        phases = []
        
        # Exploration phase: read/search tools
        if any(t in ["read", "grep", "search", "glob", "semantic_search"] for t in tools):
            phases.append("exploration")
        
        # Implementation phase: write/modify tools
        if any(t in ["str_replace", "write", "delete"] for t in tools):
            phases.append("implementation")
        
        # Validation phase: test/lint tools
        if any(t in ["shell", "read_lints"] for t in tools):
            phases.append("validation")
        
        return phases
    
    def _deduplicate_components(self, components: list[dict]) -> list[dict]:
        """Deduplicate component changes."""
        seen = set()
        unique = []
        
        for comp in components:
            key = (comp["file"], comp["component"])
            if key not in seen:
                seen.add(key)
                unique.append(comp)
        
        return unique
    
    async def _send_tool_trace(self, trace: ToolCallTrace):
        """Send tool trace to backend (async, non-blocking)."""
        try:
            await self.backend_client.post("/execution-traces/tool-call", json={
                "execution_id": self.execution_id,
                "step_id": self.step_id,
                "trace": trace.__dict__
            })
        except Exception as e:
            logger.error(f"Failed to send tool trace: {e}")
    
    async def _send_step_trace(self, trace: StepTrace):
        """Send complete step trace to backend."""
        try:
            await self.backend_client.post("/execution-traces/step", json={
                "execution_id": self.execution_id,
                "trace": trace.__dict__
            })
        except Exception as e:
            logger.error(f"Failed to send step trace: {e}")
```

#### File: `src/metabob_cli/mcp/instrumented_executor.py`

```python
"""
Executes activity steps with automatic instrumentation.
"""

from .execution_tracer import ExecutionTracer, StepTrace
import logging

logger = logging.getLogger(__name__)


class InstrumentedActivityExecutor:
    """Executes steps with full automatic recording."""
    
    def __init__(self, cpg_client, backend_client):
        self.cpg_client = cpg_client
        self.backend_client = backend_client
    
    async def execute_step(
        self,
        execution_id: str,
        step: dict,
        agent_session_context: dict
    ) -> StepTrace:
        """
        Execute step with automatic tracing.
        
        Agent is UNAWARE of instrumentation.
        """
        
        # Create tracer for this step
        tracer = ExecutionTracer(
            execution_id=execution_id,
            step_id=step["step_id"],
            cpg_client=self.cpg_client,
            backend_client=self.backend_client
        )
        
        # Get agent's tool registry
        tools = agent_session_context.get("tools", {})
        
        # Wrap ALL tools with tracing
        wrapped_tools = {}
        for tool_name, tool_func in tools.items():
            wrapped_tools[tool_name] = tracer.wrap_tool(tool_name, tool_func)
        
        # Replace tools with wrapped versions
        agent_session_context["tools"] = wrapped_tools
        
        try:
            # Execute step (agent uses wrapped tools)
            # Agent sees normal tool interface
            # Tracer captures everything automatically
            result = await self._execute_agent_step(
                session_context=agent_session_context,
                step_prompt=step["prompt_template"],
                variables=step.get("variables", {})
            )
            
            # Finalize trace (automatic analysis)
            trace = await tracer.finalize_step_trace(
                output=result.output,
                success=result.success,
                cost=result.cost,
                tokens=result.tokens
            )
            
            logger.info(f"Step executed with full trace", extra={
                "execution_id": execution_id,
                "step_id": step["step_id"],
                "tool_calls": len(trace.tool_calls),
                "component_changes": len(trace.component_changes),
                "decisions_extracted": len(trace.decisions_extracted)
            })
            
            return trace
            
        finally:
            # Restore original tools (cleanup)
            agent_session_context["tools"] = tools
    
    async def _execute_agent_step(
        self, session_context: dict, step_prompt: str, variables: dict
    ) -> AgentResult:
        """Execute agent step (placeholder - integrate with actual agent execution)."""
        # This would integrate with metabob-opencode agent execution
        # For now, return mock result
        return AgentResult(
            output="Step completed",
            success=True,
            cost=0.05,
            tokens=1000
        )


@dataclass
class AgentResult:
    """Result from agent step execution."""
    output: str
    success: bool
    cost: float
    tokens: int
```

### Phase 2: CPG Component Mapper (metabob-cli)

#### File: `src/metabob_cli/mcp/cpg_component_mapper.py`

```python
"""
Maps file changes to CPG components and links to activity tasks.
"""

import logging
from typing import Optional
import re

logger = logging.getLogger(__name__)


class ComponentMapping:
    """Result of mapping execution to intent via components."""
    
    def __init__(self):
        self.intent: str = ""
        self.expected_components: list[str] = []
        self.actual_components: list[dict] = []
        self.accuracy: float = 0.0
        self.missed: list[str] = []
        self.extra: list[dict] = []
        self.task_alignment: dict = {}
        self.deviations: list[dict] = []


class CPGComponentMapper:
    """Maps executions to components using CPG awareness."""
    
    def __init__(self, cpg_client, activity_spec: dict):
        self.cpg = cpg_client
        self.activity = activity_spec
        self._component_cache = {}
    
    async def map_execution_to_intent(
        self, step_traces: list[StepTrace], activity_intent: str
    ) -> ComponentMapping:
        """
        Core function: Map what was DONE to what was INTENDED.
        
        Uses CPG to understand at component level, not just file level.
        """
        
        mapping = ComponentMapping()
        mapping.intent = activity_intent
        
        # Step 1: Extract expected components from intent
        mapping.expected_components = self._parse_intent_for_components(activity_intent)
        
        # Step 2: Get actual components from traces
        mapping.actual_components = await self._get_actual_components(step_traces)
        
        # Step 3: Calculate accuracy
        expected_set = set(mapping.expected_components)
        actual_names = {c["component"] for c in mapping.actual_components}
        intersection = expected_set & actual_names
        
        mapping.accuracy = len(intersection) / len(expected_set) if expected_set else 1.0
        mapping.missed = list(expected_set - actual_names)
        mapping.extra = [c for c in mapping.actual_components if c["component"] not in expected_set]
        
        # Step 4: Map to tasks
        mapping.task_alignment = await self._align_components_to_tasks(
            mapping.actual_components
        )
        
        # Step 5: Find deviations
        mapping.deviations = self._find_component_deviations(
            mapping.actual_components,
            mapping.task_alignment
        )
        
        return mapping
    
    def _parse_intent_for_components(self, intent: str) -> list[str]:
        """Extract expected components from activity intent."""
        components = []
        
        # Pattern: "Fix X in Y" → Y is component
        pattern1 = re.findall(r"in\s+([A-Z][a-zA-Z0-9_\.]+)", intent)
        components.extend(pattern1)
        
        # Pattern: Known component types
        if "schema" in intent.lower():
            components.append("*Schema")  # Wildcard
        if "handler" in intent.lower():
            components.append("*Handler")
        if "test" in intent.lower():
            components.append("*Test")
        if "util" in intent.lower() or "helper" in intent.lower():
            components.append("*Util")
        
        return list(set(components))
    
    async def _get_actual_components(self, step_traces: list[StepTrace]) -> list[dict]:
        """Get all components actually touched during execution."""
        all_components = []
        
        for step_trace in step_traces:
            for tool_call in step_trace.tool_calls:
                all_components.extend(tool_call.component_changes)
        
        # Deduplicate
        seen = set()
        unique = []
        for comp in all_components:
            key = (comp["file"], comp["component"])
            if key not in seen:
                seen.add(key)
                unique.append(comp)
        
        return unique
    
    async def _align_components_to_tasks(
        self, actual_components: list[dict]
    ) -> dict:
        """Align actual components to expected tasks."""
        
        alignment = {}
        
        for task in self.activity.get("tasks", []):
            task_id = task["step_id"]
            
            # Extract expected components from task description
            expected = self._parse_task_for_components(task)
            
            # Find which actual components match
            matched = [
                c for c in actual_components
                if self._component_matches_expectation(c["component"], expected)
            ]
            
            alignment[task_id] = {
                "expected": expected,
                "matched": [c["component"] for c in matched],
                "alignment_score": len(matched) / len(expected) if expected else 1.0,
                "components": matched
            }
        
        return alignment
    
    def _parse_task_for_components(self, task: dict) -> list[str]:
        """Extract expected components from task."""
        text = f"{task.get('description', '')} {task.get('prompt', {}).get('template', '')}"
        
        components = []
        
        # Common patterns
        if "schema" in text.lower():
            components.append("*Schema")
        if "handler" in text.lower():
            components.append("*Handler")
        if "test" in text.lower():
            components.append("*Test")
        
        # Parse variable references
        vars_mentioned = re.findall(r"{{(\w+)}}", text)
        for var in vars_mentioned:
            if var in ["component", "componentName", "function", "class", "method"]:
                components.append(f"<{var}>")  # Placeholder for variable
        
        return components
    
    def _component_matches_expectation(self, actual: str, expected_list: list[str]) -> bool:
        """Check if actual component matches expected pattern."""
        for expected in expected_list:
            if expected.startswith("*"):
                # Wildcard: *Schema matches UserSchema, PostSchema, etc.
                suffix = expected[1:]
                if actual.endswith(suffix):
                    return True
            elif expected.startswith("<"):
                # Variable placeholder - matches anything
                return True
            elif actual == expected:
                # Exact match
                return True
        
        return False
    
    def _find_component_deviations(
        self, actual_components: list[dict], task_alignment: dict
    ) -> list[dict]:
        """Find unexpected component modifications."""
        
        # Get all expected components from tasks
        all_expected = set()
        for task_data in task_alignment.values():
            all_expected.update(task_data["matched"])
        
        # Find actual components not in any task
        deviations = []
        for comp in actual_components:
            if comp["component"] not in all_expected:
                deviations.append({
                    "component": comp["component"],
                    "file": comp["file"],
                    "type": comp["type"],
                    "unexpected": True,
                    "reason": "Not in any task's expected components",
                    "action": comp["action"]
                })
        
        return deviations
```

### Phase 3: Unified Backend Schema (metabob-rpc-api)

#### File: `server/models/execution_trace.py`

```python
"""
Unified execution trace model - NO FRAGMENTATION.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ToolCallTrace(BaseModel):
    """Single tool call within a step."""
    call_id: str
    tool: str
    args: dict
    result: Optional[str] = None
    error: Optional[str] = None
    success: bool
    duration_ms: int
    
    before_state: dict
    after_state: dict
    file_changes: list[str]
    component_changes: list[dict]
    decision_extracted: dict


class StepTrace(BaseModel):
    """Single step within an activity."""
    step_id: str
    step_index: int
    started_at: datetime
    ended_at: datetime
    duration_ms: int
    success: bool
    output: str
    cost: float
    tokens: int
    
    tool_calls: list[ToolCallTrace]
    tool_sequence: list[str]
    phases: list[str]
    component_changes: list[dict]
    decisions_extracted: list[dict]


class ComponentMapping(BaseModel):
    """Component-level mapping of execution to intent."""
    intent: str
    expected_components: list[str]
    actual_components: list[dict]
    accuracy: float
    missed: list[str]
    extra: list[dict]
    task_alignment: dict
    deviations: list[dict]


class ToolPatternAnalysis(BaseModel):
    """Analysis of tool usage patterns."""
    sequence: list[str]
    phases: list[str]
    pattern_type: str
    effectiveness: dict
    tool_usage: dict  # Per-tool statistics


class ValidationResult(BaseModel):
    """Validation execution result."""
    ran: bool
    rules_applied: list[str]
    results: dict
    overall_passed: bool
    duration_ms: int


class ExecutionTrace(BaseModel):
    """
    UNIFIED execution trace - ALL data in one record.
    
    No fragmentation, no joins, fast queries.
    """
    
    # Identity
    execution_id: str
    activity_id: str
    variant_id: str
    selection_id: str
    session_id: str
    org_id: str
    project_id: str
    
    # Timing
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_ms: int = 0
    
    # Outcome
    success: bool = False
    output: str = ""
    error: Optional[str] = None
    
    # Costs
    total_cost: float = 0.0
    total_tokens: int = 0
    cost_breakdown: dict = Field(default_factory=dict)
    
    # Steps (EMBEDDED - no separate table)
    steps: list[StepTrace] = Field(default_factory=list)
    
    # Component mapping (EMBEDDED)
    component_mapping: ComponentMapping
    
    # Tool patterns (EMBEDDED)
    tool_patterns: ToolPatternAnalysis
    
    # Validation (EMBEDDED)
    validation: ValidationResult
    
    # Context usage (EMBEDDED)
    context_usage: dict = Field(default_factory=dict)
    
    # Learning data (DERIVED, EMBEDDED)
    learning_data: dict = Field(default_factory=dict)
    
    class Config:
        json_schema_extra = {
            "example": {
                "execution_id": "exec_123",
                "activity_id": "fix-bug",
                "steps": [
                    {
                        "step_id": "diagnose",
                        "tool_calls": [
                            {
                                "tool": "read",
                                "component_changes": [
                                    {"file": "src/tool.ts", "component": "Tool.execute"}
                                ]
                            }
                        ]
                    }
                ],
                "component_mapping": {
                    "accuracy": 0.92,
                    "task_alignment": {...}
                }
            }
        }
```

#### File: `server/routes/execution_traces.py`

```python
"""
API endpoints for execution traces.
"""

from fastapi import APIRouter, HTTPException
from server.models.execution_trace import ExecutionTrace
from server.services.database import get_db

router = APIRouter(prefix="/execution-traces", tags=["execution-traces"])


@router.post("/tool-call")
async def record_tool_call(trace_data: dict):
    """Receive tool call trace in real-time."""
    # Store or buffer for later aggregation
    execution_id = trace_data["execution_id"]
    # ... store in Redis or buffer
    return {"recorded": True}


@router.post("/step")
async def record_step(trace_data: dict):
    """Receive complete step trace."""
    # Update execution record with step data
    execution_id = trace_data["execution_id"]
    # ... update execution_trace in DB
    return {"recorded": True}


@router.post("/complete")
async def record_complete_execution(trace: ExecutionTrace):
    """Receive complete execution trace (single unified record)."""
    
    db = await get_db()
    
    # Store complete trace in unified table
    result = await db.query("""
        CREATE execution_trace CONTENT $trace
    """, {"trace": trace.dict()})
    
    # Trigger learning updates asynchronously
    asyncio.create_task(update_learning_from_trace(trace))
    
    return {"execution_id": trace.execution_id, "stored": True}


@router.get("/{execution_id}")
async def get_execution_trace(execution_id: str):
    """Get complete execution trace (single query, no joins)."""
    
    db = await get_db()
    
    result = await db.query("""
        SELECT * FROM execution_trace WHERE execution_id = $id
    """, {"id": execution_id})
    
    if not result:
        raise HTTPException(404, "Execution not found")
    
    return result[0]


@router.get("/activity/{activity_id}/analytics")
async def get_activity_analytics(activity_id: str):
    """Get analytics for activity (from unified schema)."""
    
    db = await get_db()
    
    # Single query gets all data
    analytics = await db.query("""
        SELECT
            COUNT() as executions,
            AVG(total_cost) as avg_cost,
            AVG(duration_ms) as avg_duration,
            AVG(component_mapping.accuracy) as avg_component_accuracy,
            AVG(tool_patterns.effectiveness.tool_success_rate) as avg_tool_success,
            ARRAY_AGG(tool_patterns.sequence) as common_sequences
        FROM execution_trace
        WHERE activity_id = $id AND success = true
        GROUP ALL
    """, {"id": activity_id})
    
    return analytics[0]
```

### Phase 4: Validation Registry (metabob-rpc-api)

#### File: `server/services/validation_registry.py`

```python
"""
Validation registry - extracts and reuses validation from successful executions.
"""

import logging
from server.models.validation_rule import ValidationRule
from server.services.database import get_db

logger = logging.getLogger(__name__)


class ValidationRegistry:
    """Central registry for reusable validation rules."""
    
    async def extract_from_execution(
        self, execution_trace: ExecutionTrace
    ) -> Optional[ValidationRule]:
        """
        Extract validation from successful execution.
        
        Key: If it worked once, reuse it for similar activities.
        """
        
        if not execution_trace.success:
            return None
        
        if not execution_trace.validation or not execution_trace.validation.ran:
            return None
        
        validation = execution_trace.validation
        
        # Build reusable rule
        rule = ValidationRule(
            rule_id=f"rule_{execution_trace.activity_id}_{int(time.time())}",
            name=f"Validation from {execution_trace.activity_id}",
            category=execution_trace.activity.get("category", "general"),
            
            # Checks that passed
            checks=[
                {
                    "type": "command",
                    "command": check_name,
                    "expected_outcome": "success",
                    "timeout_ms": result["duration_ms"] * 2
                }
                for check_name, result in validation.results.items()
                if result.get("passed")
            ],
            
            # Metadata
            extracted_from=execution_trace.execution_id,
            extracted_at=datetime.now(),
            success_count=1,
            failure_count=0,
            
            # Applicability rules
            applicable_to={
                "categories": [execution_trace.activity.get("category")],
                "components": [
                    c["component"] 
                    for c in execution_trace.component_mapping.actual_components
                ],
                "file_patterns": [
                    c["file"]
                    for c in execution_trace.component_mapping.actual_components
                ]
            }
        )
        
        # Save to database
        db = await get_db()
        await db.query("CREATE validation_rule CONTENT $rule", {"rule": rule.dict()})
        
        logger.info(f"Extracted validation rule: {rule.rule_id}")
        
        return rule
    
    async def find_applicable_rules(
        self, activity: dict, components: list[str]
    ) -> list[ValidationRule]:
        """Find validation rules applicable to this execution."""
        
        db = await get_db()
        
        # Query for matching rules
        rules = await db.query("""
            SELECT * FROM validation_rule
            WHERE 
                category = $category
                AND (
                    $components ALLINSIDE applicable_to.components
                    OR applicable_to.components CONTAINSANY $components
                )
                AND (success_count / (success_count + failure_count)) > 0.8
            ORDER BY success_count DESC
            LIMIT 10
        """, {
            "category": activity.get("category"),
            "components": components
        })
        
        return [ValidationRule(**rule) for rule in rules]
    
    async def apply_rules(
        self, execution_id: str, rules: list[ValidationRule]
    ) -> ValidationResult:
        """Apply validation rules to execution."""
        
        results = {}
        overall_passed = True
        total_duration = 0
        
        for rule in rules:
            for check in rule.checks:
                # Run check (typecheck, tests, linter, etc.)
                result = await self._run_validation_check(check)
                
                results[check["command"]] = {
                    "passed": result.passed,
                    "duration_ms": result.duration_ms,
                    "output": result.output[:500],
                    "rule_id": rule.rule_id
                }
                
                total_duration += result.duration_ms
                
                if not result.passed:
                    overall_passed = False
                
                # Update rule stats
                await self._update_rule_stats(rule.rule_id, result.passed)
        
        return ValidationResult(
            ran=True,
            rules_applied=[r.rule_id for r in rules],
            results=results,
            overall_passed=overall_passed,
            duration_ms=total_duration
        )
    
    async def _run_validation_check(self, check: dict) -> ValidationCheckResult:
        """Run a single validation check."""
        if check["type"] == "command":
            # Run shell command
            result = await run_shell_command(
                check["command"],
                timeout_ms=check.get("timeout_ms", 30000)
            )
            return ValidationCheckResult(
                passed=(result.exit_code == 0),
                duration_ms=result.duration_ms,
                output=result.output
            )
        
        # Other check types...
        return ValidationCheckResult(passed=False, duration_ms=0, output="")
    
    async def _update_rule_stats(self, rule_id: str, success: bool):
        """Update rule statistics after usage."""
        db = await get_db()
        
        if success:
            await db.query("""
                UPDATE validation_rule:$id SET
                    success_count += 1,
                    last_used = $now
            """, {"id": rule_id, "now": datetime.now()})
        else:
            await db.query("""
                UPDATE validation_rule:$id SET
                    failure_count += 1,
                    last_failed = $now
            """, {"id": rule_id, "now": datetime.now()})
```

## Summary: Complete System

### What Changes

**metabob-opencode** (Minimal changes):
- Present activities TO agent (not agent discovers)
- Execution happens in instrumented environment
- Just collect results

**metabob-cli** (Major additions):
- ExecutionTracer captures everything
- CPGComponentMapper links files→components→tasks
- Instrumented executor wraps all tools
- Real-time trace sending to backend

**metabob-rpc-api** (Schema redesign):
- Unified ExecutionTrace table (no fragmentation)
- ValidationRegistry (extract and reuse)
- ToolPatternLearner (learn from data)
- Component-aware analytics

### What We Get

✅ **Complete recording** - Every tool call, state change, decision  
✅ **Component-level understanding** - Not just files, but which components  
✅ **Task alignment** - Did execution match intent at component level?  
✅ **Reusable validation** - Extract once, apply everywhere  
✅ **Tool pattern learning** - Which tools work, how to use them  
✅ **Unified storage** - Single query for everything  
✅ **No agent involvement** - System records automatically  

### Implementation Order

1. **ExecutionTracer** (metabob-cli) - Foundation for all recording
2. **CPGComponentMapper** (metabob-cli) - Understand what was modified
3. **Unified Schema** (metabob-rpc-api) - Store everything together
4. **ValidationRegistry** (metabob-rpc-api) - Reusable validation
5. **ToolPatternLearner** (metabob-rpc-api) - Learn from data

This creates a **self-improving execution environment** that learns from every execution and gets better over time, without any agent involvement in recording.
