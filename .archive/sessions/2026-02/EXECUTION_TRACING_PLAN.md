# Execution Tracing Plan: Shrink-Fit Analysis

**Date**: February 12, 2026  
**Goal**: Trace execution chains through devbob containers to identify and remove alternative code paths  
**Method**: Observational tracing with structured logging and flow analysis

---

## Overview

We need to **shrink-fit** the implementation by:
1. Observing how execution flows through containers
2. Identifying which code paths are actually used
3. Removing unused/alternative implementations
4. Consolidating to single execution paths

---

## Architecture: Current Container Setup

### Running Containers
```
┌─────────────────────────────────────────────────────┐
│ Backend Services (Shared)                           │
├─────────────────────────────────────────────────────┤
│ api-server-dev   │ metabob-rpc-api:0.16.12  │ :8080│
│ metabob-surreal  │ surrealdb:latest         │ :8000│
│ metabob-redis    │ redis:7-alpine           │ :6379│
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Agent Containers (On-Demand)                        │
├─────────────────────────────────────────────────────┤
│ devbob-opencode  │ devbob:latest │ ACP:3004 MCP:8084│ ⚠️ Exited
│ devbob-rpc-api   │ devbob:latest │ ACP:3001 MCP:8081│ Not running
│ devbob-dashboard │ devbob:latest │ ACP:3002 MCP:8082│ Not running
│ devbob-cli       │ devbob:latest │ ACP:3003 MCP:8083│ Not running
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Host (Our Current Environment)                      │
├─────────────────────────────────────────────────────┤
│ • metabob-cli (Python): MCP server                  │
│ • metabob-proto: Schema definitions                 │
│ • OpenCode CLI: User interface                      │
└─────────────────────────────────────────────────────┘
```

### Key Observation
**We're currently running OUTSIDE containers** - using host-based metabob-cli MCP server. The devbob containers are for isolated agent execution but aren't running.

---

## Execution Flow: Activity System

### Current Proven Flow (From Our Testing)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. USER REQUEST                                              │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. OpenCode (Host Process)                                   │
│    • Receives user request                                   │
│    • Calls activity tool                                     │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. metabob-cli MCP Server (Host Process)                     │
│    repos/metabob-cli/src/metabob_cli/mcp/                   │
│    │                                                          │
│    ├─> tools.py::activity_tool()                            │
│    │   └─> Call activity_manager                            │
│    │                                                          │
│    └─> activity_manager.py::ActivityManager                 │
│        ├─> start_execution()                                │
│        │   └─> GET /v2/activities/templates/{id}           │
│        │       └─> api-server-dev:8080                      │
│        │                                                      │
│        ├─> get_next_step()                                  │
│        │   └─> Return step from cached template            │
│        │                                                      │
│        ├─> report_step_result()                             │
│        │   └─> Store in-memory (step_results list)         │
│        │                                                      │
│        └─> _check_completion()                              │
│            └─> POST /v2/activities/record/complete         │
│                └─> api-server-dev:8080                      │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. metabob-rpc-api Backend (api-server-dev Container)       │
│    repos/metabob-rpc-api/server/                            │
│    │                                                          │
│    ├─> routes/v2_activities.py                              │
│    │   ├─> GET /v2/activities/templates/{id}               │
│    │   │   └─> actions/activity_variants.py::get_variant() │
│    │   │       └─> SurrealDB query                         │
│    │   │                                                      │
│    │   └─> POST /v2/activities/record/complete             │
│    │       └─> actions/activities.py::record_execution()   │
│    │           └─> SurrealDB insert                        │
│    │                                                          │
│    └─> SurrealDB (metabob-surreal Container)               │
│        └─> Tables: activity_variants, activity_executions  │
└──────────────────────────────────────────────────────────────┘
```

### Alternative/Unused Paths (To Be Removed)

```
❌ POST /v2/activities/record/start
   • Disabled in CLI (commit 97e700d)
   • Was creating duplicate templates
   • Backend code exists but unused

❌ POST /v2/activities/record/step  
   • Endpoint exists in backend
   • CLI never calls it (reports steps in bulk at end)
   • Alternative to bulk recording

❌ Old V1 Activity Routes
   • repos/metabob-rpc-api/server/routes/activities.py
   • Proto-based routes exist: routes/proto_activities.py
   • V2 routes are canonical: routes/v2_activities.py

❌ OpenCode Activity Tool (Alternative Implementation?)
   • repos/metabob-opencode/packages/opencode/src/tools/activity/
   • Unclear if this duplicates metabob-cli functionality
   • Need to trace if used or dead code

❌ Devbob Container Execution Paths
   • Containers exist but not running in our tests
   • ACP delegation paths unused
   • May be for multi-agent workflows only
```

---

## Tracing Methodology

### Phase 1: Structured Logging (2 hours)

**Goal**: Add trace IDs and structured logging to track execution flow

**1.1 Add Execution Trace IDs**

File: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

```python
import uuid
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

# Add to start_execution()
async def start_execution(...):
    trace_id = str(uuid.uuid4())[:8]
    
    logger.info(json.dumps({
        "trace_id": trace_id,
        "event": "execution_start",
        "activity_id": activity_id,
        "session_id": session_id,
        "timestamp": datetime.utcnow().isoformat()
    }))
    
    # Store trace_id in execution
    execution = ActivityExecution(
        execution_id=f"exec_{trace_id}",
        trace_id=trace_id,  # NEW
        ...
    )
```

**1.2 Add HTTP Request Tracing**

File: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

```python
# Wrap HTTP client with logging
async def _get_client(self):
    if self._client is None or self._client.is_closed:
        headers = {
            "Content-Type": "application/json",
            "X-Trace-ID": self.current_trace_id,  # NEW
        }
        # ... existing code
```

**1.3 Backend Request Logging**

File: `repos/metabob-rpc-api/server/routes/v2_activities.py`

```python
@router.get("/templates/{template_id}")
async def get_template(
    template_id: str,
    request: Request  # Add this
):
    trace_id = request.headers.get("X-Trace-ID", "unknown")
    
    logger.info(json.dumps({
        "trace_id": trace_id,
        "event": "backend_template_fetch",
        "template_id": template_id,
        "timestamp": datetime.utcnow().isoformat()
    }))
```

**1.4 Execution Recording Trace**

File: `repos/metabob-rpc-api/server/routes/v2_activities.py`

```python
@router.post("/record/complete")
async def record_completion(
    ...
    request: Request
):
    trace_id = request.headers.get("X-Trace-ID", "unknown")
    
    logger.info(json.dumps({
        "trace_id": trace_id,
        "event": "backend_record_complete",
        "execution_id": execution_id,
        "success": success,
        "timestamp": datetime.utcnow().isoformat()
    }))
```

### Phase 2: Run Traced Execution (1 hour)

**2.1 Enable JSON Logging**

File: `repos/metabob-cli/setup.cfg` or logging config

```ini
[logging]
format = {"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}
```

**2.2 Run Traced Activity Execution**

```bash
# Terminal 1: Backend logs with trace filtering
docker logs api-server-dev -f 2>&1 | grep -E "trace_id|execution"

# Terminal 2: Execute activity with tracing
cd /home/avi/documents/work/exp-repo/metabob-devbob
python3 << 'PYEOF'
import asyncio
import logging
from metabob_cli.core.file_state import FileStateManager
from metabob_cli.mcp.activity_manager import get_activity_manager

# Enable debug logging
logging.basicConfig(level=logging.INFO, format='%(message)s')

async def trace_execution():
    state_mgr = FileStateManager(".metabob/state")
    token = state_mgr.get_session_token()
    mgr = get_activity_manager('http://localhost:8080', token)
    
    # Execute proof template
    result = await mgr.start_execution(
        activity_id="infrastructure-51aee5c8",
        variables={"name": "Trace Test"},
        session_id="trace-session"
    )
    
    print(f"Execution started: {result['execution_id']}")
    
    # Get step
    step = await mgr.get_next_step(result['execution_id'])
    print(f"Step fetched: {step['current_step']['step_id']}")
    
    # Report
    await mgr.report_step_result(
        execution_id=result['execution_id'],
        step_id=step['current_step']['step_id'],
        success=True,
        output="Traced output",
        cost=0.01,
        tokens=50
    )
    
    print("Step completed")
    
    # Check completion
    completion = await mgr.get_next_step(result['execution_id'])
    print(f"Completion: {completion}")

asyncio.run(trace_execution())
PYEOF
```

**2.3 Collect Execution Trace**

```bash
# Collect all trace logs
./devbob logs | grep "trace_id" > execution_trace.jsonl

# Analyze trace
python3 << 'PYEOF'
import json
from collections import defaultdict

trace_events = defaultdict(list)

with open("execution_trace.jsonl") as f:
    for line in f:
        try:
            event = json.loads(line)
            trace_id = event.get("trace_id")
            if trace_id:
                trace_events[trace_id].append(event)
        except:
            continue

# Print execution flow for each trace
for trace_id, events in trace_events.items():
    print(f"\n=== Trace: {trace_id} ===")
    for event in sorted(events, key=lambda e: e['timestamp']):
        print(f"  {event['event']:30} {event.get('activity_id', 'N/A')}")
PYEOF
```

### Phase 3: Code Path Analysis (2 hours)

**3.1 Identify Endpoints Called**

```bash
# Extract all HTTP endpoints hit during execution
cat execution_trace.jsonl | jq -r 'select(.event | contains("backend")) | .event' | sort -u

# Expected output:
# backend_template_fetch
# backend_record_complete

# NOT expected (unused):
# backend_record_start
# backend_record_step
```

**3.2 Find Unused Code**

```bash
# Search for endpoints that exist but were never called
cd repos/metabob-rpc-api
rg "POST.*record/start" server/routes/v2_activities.py -A 10

# Check if called
rg "record/start" repos/metabob-cli --type py

# If no results → Mark for removal
```

**3.3 Identify Alternative Implementations**

```bash
# Find activity-related files
find . -name "*activity*" -type f | grep -E "\.(py|ts)$" | sort

# Compare implementations:
# repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py (CLI-based)
# repos/metabob-opencode/packages/opencode/src/tools/activity/* (OpenCode-based)

# Check which is used
cat execution_trace.jsonl | jq -r '.source' | sort -u
```

### Phase 4: Container Execution Tracing (3 hours)

**4.1 Fix devbob-opencode Container**

```bash
# Check what config it needs
docker run --rm devbob:latest cat /workspace/.metabob/config.json.example

# Create config in container workspace
# Or mount from host
```

**4.2 Trace Container-Based Execution**

```bash
# Start devbob-opencode container
./devbob start devbob-opencode

# Execute activity through container ACP
curl -X POST http://localhost:3004/execute \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Execute activity infrastructure-51aee5c8 with name=Container Test",
    "timeout": 300
  }'

# Collect container logs
docker logs devbob-opencode -f > container_trace.log
```

**4.3 Compare Host vs Container Execution**

```
┌─────────────────────────────────────────────────────┐
│ Host Execution (Current)                            │
├─────────────────────────────────────────────────────┤
│ OpenCode → metabob-cli (MCP) → Backend             │
│                                                      │
│ Pros: Direct, debuggable, fast                      │
│ Cons: Single process, no isolation                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Container Execution (Alternative)                   │
├─────────────────────────────────────────────────────┤
│ Host → ACP → devbob-opencode (container)           │
│             └─> OpenCode → metabob-cli → Backend   │
│                                                      │
│ Pros: Isolation, parallel agents, sandboxing        │
│ Cons: Complex, harder to debug, overhead            │
└─────────────────────────────────────────────────────┘
```

**Question**: Do we need both? Or consolidate?

---

## Shrink-Fit Decision Matrix

### Code Removal Candidates

| Component | Status | Usage | Decision |
|-----------|--------|-------|----------|
| `/v2/activities/record/start` | ❌ Disabled | Never called | **REMOVE** |
| `/v2/activities/record/step` | ✅ Exists | Never called | **REMOVE** or **IMPLEMENT** |
| Old V1 activity routes | ⚠️ Exists | Unknown | **AUDIT** then remove |
| Proto activity routes | ⚠️ Exists | Unknown | **AUDIT** usage |
| devbob container agents | ⚠️ Exited | Not running | **FIX** or **REMOVE** |
| OpenCode activity tool | ❓ Unknown | Not traced | **AUDIT** if duplicate |

### Alternative Path Resolution

**Path 1: Step Recording**
- Current: Bulk recording at end (`/record/complete`)
- Alternative: Real-time per-step (`/record/step`)
- **Decision**: Keep bulk, remove real-time? Or vice versa?

**Path 2: Activity Manager**
- Current: metabob-cli ActivityManager (Python)
- Alternative: OpenCode ActivityTool (TypeScript)
- **Decision**: Are they duplicates or complementary?

**Path 3: Execution Environment**
- Current: Host process (direct)
- Alternative: Container delegation (ACP)
- **Decision**: Support both or choose one?

---

## Shrink-Fit Execution Plan

### Step 1: Trace Current Flow (3 hours)
1. Add trace IDs to all components
2. Run traced execution
3. Collect and analyze logs
4. Document actual execution path

### Step 2: Identify Dead Code (2 hours)
1. Find endpoints defined but never called
2. Find files in repos but never imported
3. Find alternative implementations
4. Mark candidates for removal

### Step 3: Validate Removal (2 hours)
1. Check each candidate for dependencies
2. Search for references across all repos
3. Verify no hidden usages
4. Confirm safe to delete

### Step 4: Remove Dead Code (3 hours)
1. Remove unused endpoints
2. Remove unused files
3. Remove alternative implementations
4. Update documentation

### Step 5: Test Shrunk System (2 hours)
1. Run all existing tests
2. Execute proof activities
3. Verify no regressions
4. Update assessment docs

**Total Time**: 12 hours

---

## Expected Outcomes

### Before Shrink-Fit
```
Code Paths: 5-10 alternative implementations
Endpoints: 15+ (many unused)
Files: 200+ (includes dead code)
Clarity: Low (multiple ways to do same thing)
```

### After Shrink-Fit
```
Code Paths: 1 canonical implementation per feature
Endpoints: 8-10 (all actively used)
Files: 150 (dead code removed)
Clarity: High (single clear path)
```

### Specific Removals Expected

1. **Backend**: Remove `/record/start`, `/record/step` (or implement properly)
2. **Backend**: Remove V1 activity routes if unused
3. **CLI**: Remove alternative activity managers if duplicates exist
4. **OpenCode**: Consolidate activity tools or clarify roles
5. **Containers**: Fix or remove devbob agent containers

---

## Tracing Tools & Scripts

### Quick Trace Script

```bash
#!/bin/bash
# trace_execution.sh - Quick execution tracing

TRACE_ID="trace-$(date +%s)"

echo "=== Starting Traced Execution: $TRACE_ID ==="

# Start log collection
docker logs api-server-dev -f 2>&1 | grep "$TRACE_ID" > "trace_${TRACE_ID}.log" &
LOG_PID=$!

# Run execution with trace ID
python3 trace_activity.py --trace-id "$TRACE_ID"

# Stop log collection
sleep 2
kill $LOG_PID

# Analyze trace
echo ""
echo "=== Trace Analysis ==="
python3 analyze_trace.py "trace_${TRACE_ID}.log"
```

### Trace Analysis Script

```python
# analyze_trace.py
import sys
import json
from collections import defaultdict

def analyze_trace(log_file):
    events = []
    with open(log_file) as f:
        for line in f:
            try:
                event = json.loads(line)
                events.append(event)
            except:
                continue
    
    # Group by event type
    by_type = defaultdict(int)
    for event in events:
        by_type[event.get('event', 'unknown')] += 1
    
    print("Event Counts:")
    for event_type, count in sorted(by_type.items()):
        print(f"  {event_type:40} {count:>5}")
    
    # Trace execution order
    print("\nExecution Flow:")
    for event in sorted(events, key=lambda e: e.get('timestamp', '')):
        print(f"  {event.get('timestamp', 'N/A'):25} {event.get('event', 'unknown')}")
    
    # Identify unused endpoints
    print("\nUnused Endpoints Analysis:")
    expected = {
        "backend_record_start",
        "backend_record_step",
        "backend_template_fetch",
        "backend_record_complete"
    }
    used = set(by_type.keys())
    unused = expected - used
    
    if unused:
        print("  ⚠️  Expected but NEVER CALLED:")
        for endpoint in unused:
            print(f"     - {endpoint}")
    else:
        print("  ✅ All expected endpoints called")

if __name__ == "__main__":
    analyze_trace(sys.argv[1])
```

---

## Next Steps

1. **Immediate**: Add trace IDs to activity_manager.py
2. **Immediate**: Run traced execution and collect logs
3. **Today**: Analyze traces and document actual flow
4. **Tomorrow**: Create removal plan based on findings
5. **This Week**: Execute shrink-fit and test

---

## Success Criteria

- [ ] Complete execution trace collected with trace IDs
- [ ] All HTTP endpoints documented (called vs unused)
- [ ] Alternative code paths identified
- [ ] Dead code marked for removal (with validation)
- [ ] Shrink-fit plan created with specific removals
- [ ] System still functional after shrink-fit
- [ ] Documentation updated to reflect single canonical path

---

**Status**: Ready to begin Phase 1 (Structured Logging)
