# Activity Execution Metrics Storage - Component Annotations

## Overview

This document provides comprehensive annotations for the critical components in the activity execution metrics storage flow. These annotations focus on the **WHY** behind each component's design, not just the **WHAT** (which is visible in the code).

**Note**: Components are not yet indexed in CPG, so annotations are documented here for future reference when `metabob_annotate_component` becomes available.

---

## Critical Components Annotated: 5

### 1. Entry Point: Activity.complete()
### 2. Business Logic: TemplateMetricsClient.reportExecution()
### 3. Integration Point: MCP Protocol Boundary
### 4. Backend Handler: metabob_post_activity_result (should be metabob_report_execution)
### 5. Exit Point: activity_templates.update_metrics()

---

## Component 1: Activity.complete() [Entry Point]

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`  
**Lines**: 585-640  
**Component Type**: Function (namespace method)

### Annotation

```
Activity.complete() handles the completion phase in activity execution metrics storage flow.

Data transformation: 
  Activity.Info (with nested stats) → ActivityExecutionData (flat structure)
  
  Input: activity.stats = {
    tokens: { input, output, reasoning, cache: {read, write} },
    cost: { total, perPrompt[] },
    duration: number (calculated as completedAt - startedAt)
  }
  
  Output: ActivityExecutionData = {
    activity_id, template_id, success, duration, cost,
    tokens: { input, output, cache: number }  // Cache flattened
  }

Business logic: 
  - Mark activity as complete (status = "done")
  - Calculate total duration (completedAt - startedAt)
  - Extract and normalize metrics for reporting
  - Report metrics to backend (non-blocking)
  - Save activity state to storage
  - Publish completion event

Design decision: 
  WHY cache tokens are flattened:
    - Backend expects single cache number, not split read/write
    - Original design tracked cache separately for debugging
    - Simplified for metrics aggregation
    - Defensive: handles both object {read, write} and number types
  
  WHY reporting is non-blocking (.catch(() => {})):
    - Metrics reporting should not fail activity completion
    - Activity success/failure is more important than metrics
    - Graceful degradation: system works even if metrics backend is down
    - User experience not interrupted by metrics failures
  
  WHY we extract cost.total instead of perPrompt:
    - Backend only needs aggregate cost for averaging
    - Storing per-prompt breakdown would require complex schema
    - Template metrics are about average performance, not per-execution detail
    - Simplifies backend storage (single number vs array)

Constraints:
  - Must be called AFTER activity execution finishes
  - Requires activity.templateId to exist (otherwise metrics not reported)
  - Duration calculation assumes startedAt was set correctly
  - Cache token type guard handles legacy data (object or number)
  - Silent failure if MCP backend unavailable (graceful degradation)

Integration points:
  - Calls TemplateMetricsClient.reportExecution() (MCP gateway)
  - Calls Storage.write() to persist activity state
  - Publishes Bus.publish(Event.Completed) for subscribers
  
Why this exists:
  Activity completion is the natural trigger point for metrics reporting.
  This is when we have final, accurate metrics (cost, duration, tokens).
  Reporting here ensures metrics are captured for every completed activity.
```

---

## Component 2: TemplateMetricsClient.reportExecution() [Business Logic Gateway]

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`  
**Lines**: 83-122  
**Component Type**: Namespace function (async)

### Annotation

```
TemplateMetricsClient.reportExecution() handles the MCP gateway layer in activity execution metrics storage flow.

Data transformation:
  ActivityExecutionData → MCP Tool Arguments (same structure, protocol boundary)
  
  Input: ActivityExecutionData = {
    activity_id, template_id, success, duration, cost, tokens
  }
  
  Output: MCP protocol message = {
    tool: "metabob_report_execution",
    arguments: {...same data...}
  }

Business logic:
  - Gateway between OpenCode core and MCP backend
  - Provides clean abstraction over MCP protocol details
  - Handles MCP client availability checking
  - Parses MCP responses (JSON from text content)
  - Graceful degradation on failure (returns undefined)

Design decision:
  WHY this is a separate client module:
    - Separation of concerns: activity logic doesn't know about MCP
    - Testability: can mock MCP calls without activity module
    - Reusability: other components can use same client
    - Protocol isolation: MCP protocol changes isolated here
  
  WHY it returns Promise<void> instead of success/failure:
    - Metrics reporting is best-effort, not transactional
    - Caller doesn't need to know if it succeeded
    - Failures are logged internally for debugging
    - Non-blocking design (fire-and-forget with logging)
  
  WHY MCP client is fetched dynamically:
    - MCP clients may not be initialized at module load time
    - Allows for lazy initialization of backend connections
    - Handles backend unavailability gracefully
    - Supports multiple MCP backends (metabob, others)
  
  WHY errors are caught and logged (not thrown):
    - Metrics reporting is not critical path
    - Activity completion should succeed even if metrics fail
    - Error details preserved in logs for debugging
    - Prevents cascading failures in activity lifecycle

Constraints:
  - Requires Metabob MCP client to be configured in opencode.json
  - MCP server must be running and accessible
  - Tool name must match backend exactly (currently broken!)
  - JSON response parsing assumes backend returns valid JSON
  - 30 second timeout on MCP calls (default)

Integration points:
  - Calls MCP.clients() to get Metabob client
  - Calls metabobClient.callTool() with protocol arguments
  - Parses CallToolResultSchema from MCP SDK
  
Critical issue:
  Tool name "metabob_report_execution" does not exist on backend!
  Backend provides "metabob_post_activity_result" instead.
  This causes 100% failure rate, but silent due to graceful degradation.

Why this exists:
  Abstracts MCP protocol complexity from business logic.
  Provides single entry point for all metrics reporting to backend.
  Enables graceful degradation when backend unavailable.
  Centralizes error handling and logging for MCP failures.
```

---

## Component 3: MCP Protocol Boundary [Integration Point]

**Location**: Between frontend (TypeScript) and backend (Python)  
**Protocol**: Model Context Protocol (MCP)  
**Transport**: HTTP/SSE/stdio (configurable)

### Annotation

```
MCP Protocol Boundary handles the cross-language, cross-process integration in activity execution metrics storage flow.

Data transformation:
  TypeScript object → JSON → MCP protocol message → JSON → Python dict
  
  Frontend sends:
  {
    tool: "metabob_report_execution",  // ⚠️ Tool name string
    arguments: {
      activity_id: string,
      template_id: string,
      success: boolean,
      duration: number,
      cost: number,
      tokens: {input, output, cache}
    }
  }
  
  Backend receives:
  {
    "name": "metabob_report_execution",  // ⚠️ Must match exactly
    "arguments": {...}
  }

Business logic:
  - Language boundary: TypeScript (frontend) ↔ Python (backend)
  - Process boundary: OpenCode ↔ Metabob CLI
  - Repository boundary: metabob-opencode ↔ metabob-cli
  - Network boundary: Local IPC or HTTP (depending on transport)

Design decision:
  WHY use MCP protocol instead of REST API:
    - Standardized protocol for LLM tool calling
    - Language-agnostic (works with TypeScript, Python, etc.)
    - Built-in support in OpenCode architecture
    - Tool discovery (listTools) and invocation (callTool)
    - Transport flexibility (stdio, SSE, HTTP)
  
  WHY tool names are strings (not type-safe):
    - MCP protocol design (tools discovered at runtime)
    - Allows backend to add tools without frontend recompilation
    - Flexibility for dynamic tool loading
    - Trade-off: Type safety sacrificed for flexibility
  
  WHY JSON serialization (not binary):
    - Human-readable for debugging
    - Widely supported across languages
    - Schema-less (flexible but brittle)
    - Easy to log and inspect
  
  WHY graceful degradation on failure:
    - Backend may not always be available
    - Metrics are nice-to-have, not required for functionality
    - User experience unaffected by metrics failures
    - Local metrics still work (frontend storage)

Constraints:
  - Tool names must match exactly (case-sensitive string comparison)
  - JSON schema must align (no runtime validation)
  - No versioning (breaking changes break silently)
  - No type safety across boundary (runtime errors only)
  - Timeout enforcement (30 seconds default)
  - Network latency (if using HTTP transport)

Critical issues:
  1. Tool name mismatch: "metabob_report_execution" ≠ "metabob_post_activity_result"
  2. Schema mismatch: flat vs nested structure
  3. No contract testing (changes break at runtime)
  4. No schema validation (invalid data accepted)

Why this exists:
  Enables polyglot architecture (TypeScript + Python).
  Decouples frontend from backend deployment.
  Allows independent scaling and versioning.
  Provides standard interface for tool calling.
  
Design trade-offs:
  ✅ Flexibility (add tools without recompilation)
  ✅ Language independence (TypeScript ↔ Python)
  ✅ Process isolation (crash independence)
  ❌ Type safety (runtime errors only)
  ❌ Versioning (no compatibility checks)
  ❌ Performance (serialization overhead)
```

---

## Component 4: metabob_post_activity_result() [Backend Handler - BROKEN NAME]

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`  
**Lines**: 241-292  
**Component Type**: MCP Tool Handler (async function)

### Annotation

```
metabob_post_activity_result() handles MCP tool request processing in activity execution metrics storage flow.

⚠️ CRITICAL ISSUE: This tool is named incorrectly!
   Frontend calls: "metabob_report_execution"
   Backend provides: "metabob_post_activity_result"
   Result: 100% failure rate (tool not found)

Data transformation:
  MCP tool arguments → Template ID extraction → update_metrics() call
  
  Input (expected but not received due to name mismatch):
  {
    "activity_id": "add-rest-endpoint-1735678901234",
    "result": {
      "success": true,
      "duration": 5000,
      "cost": 0.05,
      "tokens": {...}
    }
  }
  
  Process:
  1. Extract template_id from activity_id using rsplit("-", 1)
     "add-rest-endpoint-1735678901234" → "add-rest-endpoint"
  
  2. Call activity_templates.update_metrics(template_id, result)
  
  Output: 
  {
    "status": "success",
    "activity_id": "...",
    "timestamp": "2024-01-01T00:00:00Z"
  }

Business logic:
  - Receives execution results from frontend via MCP
  - Extracts template ID from activity ID (reverse engineering)
  - Delegates to update_metrics() for persistence
  - Returns success/error status to frontend

Design decision:
  WHY extract template_id from activity_id:
    - Activity IDs follow pattern: {template_id}-{timestamp}
    - Avoids storing template_id separately in activity data
    - Works even if frontend forgets to send template_id
    - Defensive: fallback if no hyphen (use full activity_id)
  
  WHY use async handler:
    - Non-blocking I/O for file operations
    - Allows concurrent handling of multiple requests
    - MCP protocol supports async tools
    - Python asyncio integration
  
  WHY return status object (not just success boolean):
    - Provides timestamp for debugging
    - Can include additional metadata
    - Consistent response format
    - Allows frontend to log success/error details
  
  WHY catch all exceptions:
    - Prevents MCP tool handler crashes
    - Errors returned as status: "error"
    - Allows frontend to retry if needed
    - Logs errors for backend debugging

Constraints:
  - Template ID extraction assumes format: {template_id}-{timestamp}
  - Breaks if template name contains timestamp-like suffix
  - Requires template file to exist before first update
  - No input validation (accepts any dict as result)
  - No type checking (Python dict vs TypedDict)

Critical issues:
  1. Tool name mismatch (frontend can't find this tool)
  2. Schema expects nested "result" but frontend sends flat
  3. No input validation (negative values accepted)
  4. No file locking (concurrent updates can race)
  5. Token metrics ignored (not passed to update_metrics)

Why this exists:
  Backend entry point for metrics reporting via MCP.
  Translates MCP protocol to domain logic (update_metrics).
  Provides error handling boundary for backend failures.
  Returns structured responses to frontend.
  
Required fix:
  Rename to "metabob_report_execution" to match frontend.
  Adjust schema to accept flat structure (no nested "result").
```

---

## Component 5: activity_templates.update_metrics() [Exit Point - Database Write]

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py`  
**Lines**: 239-300  
**Component Type**: Function (module-level)

### Annotation

```
activity_templates.update_metrics() handles the final persistence layer in activity execution metrics storage flow.

Data transformation:
  Execution result → Incremental average update → JSON file write
  
  Input:
  {
    "success": true,
    "duration": 5000,  // milliseconds
    "cost": 0.05,      // USD
    "tokens": {...}    // ⚠️ Currently ignored!
  }
  
  Process:
  1. Load template JSON from disk
  2. Extract current metrics (execution_count, success_count, averages)
  3. Update counts (execution_count++, success_count++ if success)
  4. Calculate new averages using incremental formula
  5. Write updated JSON back to disk
  
  Output: Updated JSON file in ~/.metabob/activities/{template_id}.json
  {
    "estimated_metrics": {
      "execution_count": 11,
      "success_count": 9,
      "success_rate": 0.818,
      "avg_duration_ms": 5100,
      "avg_cost": 0.052
      // ⚠️ NO TOKEN METRICS
    },
    "updated_at": "2024-01-01T00:00:00Z"
  }

Business logic:
  - Persistence layer for template execution metrics
  - Incremental averaging (O(1) space, no history storage)
  - Success rate calculation
  - Timestamp tracking (updated_at)
  - Graceful degradation (logs errors, doesn't raise)

Design decision:
  WHY use incremental averaging:
    - Memory efficient: O(1) space vs O(n) for full history
    - Performance: O(1) computation vs O(n) for recalculation
    - Formula: new_avg = old_avg + (new_value - old_avg) / (count + 1)
    - Mathematically equivalent to full average
    - Prevents overflow from old_avg * count for large counts
  
  WHY store in JSON files (not database):
    - Simple deployment (no database setup)
    - Human-readable (easy to inspect/debug)
    - File-based backup (cp/rsync)
    - No query needs (templates accessed by ID only)
    - Lightweight (templates don't change frequently)
  
  WHY non-fatal error handling:
    - Metrics updates should not crash backend
    - Logged for debugging but not raised
    - Allows system to continue even if one template fails
    - Graceful degradation principle
  
  WHY store averages (not full history):
    - Templates executed many times (100s, 1000s)
    - Only need aggregate statistics (avg, success rate)
    - Full history would require database
    - Use case is "what's the typical cost/duration?"
    - Not "show me all executions" (that's in activity storage)

Constraints:
  - Template file must exist (logs warning and returns if not)
  - No file locking (concurrent updates can corrupt)
  - No atomic write (crash during write = corruption)
  - Duration converted to int (precision loss)
  - Token metrics completely ignored (not stored)
  - No backup before overwrite (destructive)
  - No validation of input values (negative values accepted)

Critical issues:
  1. No concurrency control (race condition on concurrent updates)
  2. Token metrics ignored (important data lost)
  3. Duration truncated to int (precision loss)
  4. No input validation (negative values corrupt averages)
  5. No atomic write (corruption possible on crash)
  6. No file locking (last write wins, earlier update lost)

Why this exists:
  Final persistence layer for template metrics.
  Tracks template performance over time (avg cost, duration, success rate).
  Enables template recommendation ("this template costs $X on average").
  Supports template promotion decisions (high success rate → promote).
  Provides data for template analytics and optimization.
  
Design trade-offs:
  ✅ Simple (no database required)
  ✅ Memory efficient (incremental averaging)
  ✅ Performance (O(1) updates)
  ✅ Human-readable (JSON files)
  ❌ No history (only averages)
  ❌ No concurrency control (race conditions possible)
  ❌ No atomicity (corruption on crash)
  ❌ Limited queryability (file-based)
  
Required fixes:
  1. Add file locking (fcntl.flock)
  2. Add token metrics storage
  3. Keep duration as float (don't truncate)
  4. Add input validation
  5. Use atomic writes (temp file + rename)
```

---

## Summary of Annotations

### Components Documented: 5

1. **Activity.complete()** - Entry point
   - Triggers metrics reporting on activity completion
   - Flattens cache tokens, extracts cost.total
   - Non-blocking MCP call with graceful degradation

2. **TemplateMetricsClient.reportExecution()** - Business logic gateway
   - Abstracts MCP protocol from activity logic
   - Handles client availability and response parsing
   - Returns void (fire-and-forget with logging)

3. **MCP Protocol Boundary** - Integration point
   - Cross-language (TypeScript ↔ Python) integration
   - Tool name string coupling (brittle)
   - No type safety or contract validation

4. **metabob_post_activity_result()** - Backend handler (BROKEN)
   - MCP tool handler (wrong name!)
   - Extracts template ID from activity ID
   - Delegates to update_metrics()

5. **activity_templates.update_metrics()** - Exit point (database write)
   - Final persistence to JSON files
   - Incremental averaging (O(1) space)
   - Token metrics ignored (critical issue)

---

## Key Design Decisions Documented

### 1. Graceful Degradation
**Why**: Metrics reporting should not fail activity completion  
**Trade-off**: Silent failures, poor observability

### 2. Incremental Averaging
**Why**: Memory efficient (O(1) space) for many executions  
**Trade-off**: No history, only aggregates

### 3. MCP Protocol
**Why**: Language-agnostic, flexible, standard for LLM tools  
**Trade-off**: No type safety, runtime errors only

### 4. JSON File Storage
**Why**: Simple, human-readable, no database setup  
**Trade-off**: No concurrency control, no atomicity

### 5. Non-Blocking Reporting
**Why**: Activity success more important than metrics  
**Trade-off**: Metrics can be lost silently

---

## Critical Issues Highlighted in Annotations

### Blocking
1. **Tool name mismatch**: Frontend calls wrong tool name (100% failure rate)
2. **Schema mismatch**: Flat vs nested structure (backend can't parse)

### High Priority
3. **Token metrics ignored**: Backend doesn't store token data
4. **No concurrency control**: Race conditions on concurrent updates
5. **Silent failures**: No logging in .catch(() => {})

### Medium Priority
6. **Precision loss**: Duration truncated to int
7. **No input validation**: Negative values accepted
8. **No atomic writes**: Corruption possible on crash

---

## Business Context Documented

### Purpose
Track template performance over time to:
- Estimate execution cost for budgeting
- Calculate average duration for scheduling
- Measure success rate for reliability
- Support template recommendation ("use this template, it's reliable and cheap")
- Enable template promotion decisions (high success rate → promote to production)

### Constraints
- Metrics are best-effort (not transactional)
- Activity completion more important than metrics
- Backend may be unavailable (graceful degradation)
- No full history (only aggregates for efficiency)

### Success Criteria
- Every completed activity has metrics recorded
- Averages are mathematically correct
- Backend storage is consistent and durable
- System works even if backend is down

---

## Integration Points Documented

1. **Activity → MetricsClient**: Direct function call
2. **MetricsClient → MCP**: Protocol boundary (TypeScript → JSON)
3. **MCP → Backend Handler**: Network/IPC boundary
4. **Backend Handler → update_metrics**: Direct function call
5. **update_metrics → File System**: I/O boundary (JSON write)

---

## Future Work Identified

Based on annotations, these improvements are recommended:

1. **Fix tool name** (blocking)
2. **Add input validation** at boundaries (defense in depth)
3. **Add file locking** in backend (prevent corruption)
4. **Add token metrics** to backend storage
5. **Add error logging** in frontend .catch()
6. **Add monitoring** for MCP failures
7. **Add contract tests** for MCP boundary
8. **Add schema versioning** for future evolution

---

## Metabob Integration Note

**Status**: Components not yet indexed in CPG  
**Action Required**: When CPG indexes these files, use `metabob_annotate_component` to persist these annotations in the Metabob knowledge graph.

**Commands to run after indexing**:
```bash
# Component 1: Entry point
metabob_annotate_component \
  --file="repos/metabob-opencode/packages/opencode/src/session/activity.ts" \
  --component="Activity.complete" \
  --reason="[Use annotation from this document]"

# Component 2: Business logic gateway
metabob_annotate_component \
  --file="repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts" \
  --component="TemplateMetricsClient.reportExecution" \
  --reason="[Use annotation from this document]"

# Component 5: Exit point
metabob_annotate_component \
  --file="repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py" \
  --component="update_metrics" \
  --reason="[Use annotation from this document]"
```

This ensures future developers understand the **WHY** behind each component's design! 🚀
