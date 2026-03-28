# Local Development Architecture - Complete Guide

**Last Updated**: February 15, 2026  
**Status**: ✅ System Operational with Known Limitations

---

## Executive Summary

We have a **multi-component development environment** for building and using the activity system. The environment consists of:

1. **Backend Services** (metabob-rpc-api) - Template storage, execution tracking, learning
2. **CLI Tool** (metabob-cli) - MCP bridge, orchestration, activity manager
3. **OpenCode** (metabob-opencode) - Execution engine, agent sessions, step execution
4. **Dashboard** (metabob-dashboard) - UI for analysis results (local + cloud modes)

**Current State**: 
- ✅ Discovery & Search: 100% working
- ✅ Simple Execution: 100% working (2-task templates)
- ⚠️ Task Tracking: 0% working (no per-task metrics stored)
- ❌ Complex Execution: 0% working (8+ task templates fail silently)

---

## Component Overview

### 1. metabob-rpc-api (Backend/Storage)

**Location**: `repos/metabob-rpc-api/`  
**Language**: Python (FastAPI + SurrealDB)  
**Port**: 8080

**Responsibilities**:
- Store activity templates (proto format)
- Variant management (Thompson Sampling selection)
- Execution recording and learning
- Template retrieval APIs
- Historical data storage

**Key Files**:
- `server/routes/v2_activities.py` - Activity API endpoints
- `server/proto/activity.proto` - Template schema definition
- `sql/` - Database initialization scripts

**What It Does NOT Do**:
- ❌ Orchestration (that's CLI)
- ❌ Execution (that's OpenCode)
- ❌ Step delivery (that's CLI)

**Docker Image**: `metabobapp/metabob-rpc-api:0.16.12`

---

### 2. metabob-cli (MCP Bridge + Orchestrator)

**Location**: `repos/metabob-cli/`  
**Language**: Python  
**MCP Port**: 8082 (stdio transport for OpenCode integration)

**Responsibilities**:
- **MCP Server**: Exposes 30+ tools to OpenCode (Metabob tools, activity tools)
- **Activity Orchestration**: Decides WHICH step to deliver next
- **Execution State Management**: Tracks current_step_index, step_results
- **Trailblazing**: Generates fix steps when validation fails
- **Field Name Mapping**: Converts proto snake_case → TypeScript camelCase

**Key Files**:
- `src/metabob_cli/mcp/tools.py` - MCP tool definitions
- `src/metabob_cli/mcp/activity_manager.py` - Orchestration logic, ActivityExecution state
- `src/metabob_cli/mcp/server.py` - MCP server implementation

**Orchestration Tools**:
- `start_activity_execution` - Create execution state in CLI
- `get_next_step` - Return current step to execute (incremental delivery)
- `report_step_result` - Record metrics, advance current_step_index
- `enter_trailblazing` - Generate fix steps dynamically
- `get_execution_state` - Check execution status

**What It Does NOT Do**:
- ❌ Execute LLM sessions (that's OpenCode)
- ❌ Run tool calls (that's OpenCode)
- ❌ Store templates (that's backend)
- ❌ Select variants (that's backend via Thompson Sampling)

**Installation**: `uv sync --all-extras` (uses uv package manager)

---

### 3. metabob-opencode (Execution Engine)

**Location**: `repos/metabob-opencode/`  
**Language**: TypeScript  
**ACP Port**: 3000 (Agent Client Protocol for multi-agent delegation)

**Responsibilities**:
- **Activity Execution**: Orchestrates multi-step activity workflows
- **Step Execution**: Runs LLM sessions for given steps
- **Tool Execution**: Executes bash, edit, read, write, etc.
- **Impulse Management**: Loads and manages context (impulses)
- **Agent Sessions**: Manages conversation history and state
- **Prompt Interpolation**: Fills in variables in step prompts

**Key Files**:
- `packages/opencode/src/tool/activity.ts` - Activity tool (native executor, NOT MCP stub)
- `packages/opencode/src/session/prompts-runner.ts::executeActivity()` - Execution orchestration
- `packages/opencode/src/session/enhanced-activity-integration.ts::EnhancedActivityExecutor` - Main executor
- `packages/opencode/src/util/metabob.ts` - MCP client calls

**Activity Execution Flow**:
1. Load template via MCP (`search_activities`, `get_activity`)
2. Build impulse space (template impulses + parent context)
3. Start execution via MCP (`start_activity_execution`)
4. Loop: `get_next_step` → execute → `report_step_result`
5. Complete when no more steps

**What It Does NOT Do**:
- ❌ Decide step order (that's CLI orchestration)
- ❌ Store execution history (that's backend)
- ❌ Select variants (that's backend)

**Package Manager**: Bun

---

### 4. metabob-dashboard (UI)

**Location**: `repos/metabob-dashboard/`  
**Language**: React (TypeScript)  
**Ports**: 
- Local mode: 3002 (UI), 8082 (API from MCP server)
- Cloud mode: 3000 (dev server) or deployed via Nginx

**Deployment Modes**:

#### Cloud Mode (Production)
- **Build**: `REACT_APP_DEPLOYMENT_MODE=cloud bun run build`
- **Features**: Multi-tenant, auth, project management, persistent history
- **Backend**: metabob-rpc-api (SurrealDB storage)
- **Used For**: https://dashboard.metabob.com

#### Local Mode (MCP Server)
- **Build**: `REACT_APP_DEPLOYMENT_MODE=local bun run build`
- **Features**: Single-user, no auth, current session only
- **Backend**: MCP Dashboard API (in-memory state cache)
- **Used For**: `metabob-cli mcp --enable-dashboard`

**What It Does**:
- Display analysis results
- Show code quality issues
- Visualize metrics and trends
- (Cloud only) Project management, authentication

**What It Does NOT Do**:
- ❌ Code analysis (that's backend)
- ❌ Activity execution (that's OpenCode)

---

### 5. Supporting Components

#### metabob-proto
**Location**: `repos/metabob-proto/`  
**Purpose**: Protocol buffer definitions (shared schemas)

#### cpg-inference
**Location**: `repos/cpg-inference/`  
**Purpose**: Code Property Graph analysis (dependency tracking, impact analysis)

---

## Data Flow: Activity Template Execution

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER REQUEST (OpenCode)                                      │
└─────────────────────────────────────────────────────────────────┘
User: "Create a REST endpoint"
activity({
  activityId: "other-97e440b7",  // add-rest-endpoint-v1
  variables: { endpoint: "/api/users" },
  reason: "Add user endpoint"
})

┌─────────────────────────────────────────────────────────────────┐
│ 2. TEMPLATE DISCOVERY (OpenCode → CLI → Backend)                │
└─────────────────────────────────────────────────────────────────┘
OpenCode calls MCP tool: search_activities({ category: "feature" })
  ↓
CLI (metabob-cli) receives request
  ↓
CLI calls Backend API: GET /v2/activities/templates?category=feature
  ↓
Backend queries SurrealDB: SELECT * FROM activity_templates WHERE...
  ↓
Backend returns: 20 templates (proto format, snake_case)
  ↓
CLI maps field names: snake_case → camelCase
  variant_id → id
  variant_name → name
  task_steps → tasks
  impulse_refs → impulseReferences
  ↓
OpenCode receives: TypeScript-friendly format

┌─────────────────────────────────────────────────────────────────┐
│ 3. EXECUTION START (OpenCode → CLI → Backend)                   │
└─────────────────────────────────────────────────────────────────┘
OpenCode calls MCP: start_activity_execution(activity_id, variables, session_id)
  ↓
CLI creates ActivityExecution state:
  {
    execution_id: "exec_abc123",
    activity_id: "other-97e440b7",
    variant_id: "v1",
    variables: { endpoint: "/api/users" },
    current_step_index: 0,
    step_results: [],
    state: "running"
  }
  ↓
CLI calls Backend: POST /v2/activities/record/start
  ↓
Backend records execution in SurrealDB
  ↓
Returns: { status: "success", execution_id: "exec_abc123" }

┌─────────────────────────────────────────────────────────────────┐
│ 4. STEP EXECUTION LOOP (OpenCode ↔ CLI)                         │
└─────────────────────────────────────────────────────────────────┘
For each task in template:
  
  ┌─ OpenCode → CLI: get_next_step(execution_id)
  │    ↓
  │  CLI checks: current_step_index < total_tasks?
  │    ↓
  │  CLI returns ONE step (incremental delivery):
  │    {
  │      status: "success",
  │      current_step: {
  │        id: "design-endpoint",
  │        description: "Design endpoint structure",
  │        prompt: {
  │          template: "Design REST endpoint for {{endpoint}}",
  │          variables: ["endpoint"]
  │        },
  │        impulse_refs: ["rest-best-practices"],
  │        allowed_tools: ["read", "write", "bash"]
  │      },
  │      complete: false
  │    }
  │
  ├─ OpenCode: Load impulses
  │    ↓
  │  Load rest-best-practices impulse from impulse space
  │  Build context with variables: endpoint="/api/users"
  │
  ├─ OpenCode: Execute step
  │    ↓
  │  Interpolate prompt: "Design REST endpoint for /api/users"
  │  Start LLM session with allowed tools
  │  Agent designs endpoint structure
  │  Collect metrics: cost, tokens, duration
  │    ↓
  │  Result: {
  │    success: true,
  │    output: "Designed GET /api/users endpoint...",
  │    cost: 0.002,
  │    tokens: 800,
  │    duration_ms: 5000
  │  }
  │
  ├─ OpenCode → CLI: report_step_result(execution_id, step_id, result)
  │    ↓
  │  CLI updates state:
  │    current_step_index++
  │    step_results.append(result)
  │    ↓
  │  CLI calls Backend: POST /v2/activities/record/step
  │    ↓
  │  Backend stores step result (⚠️ ISSUE: not persisting to tasks array)
  │
  └─ Continue to next step...

┌─────────────────────────────────────────────────────────────────┐
│ 5. EXECUTION COMPLETION (CLI → Backend)                         │
└─────────────────────────────────────────────────────────────────┘
All steps complete
  ↓
CLI calls Backend: POST /v2/activities/record/complete
  {
    execution_id: "exec_abc123",
    success: true,
    duration_ms: 35100,
    cost: 0.0085,
    tokens: 3400,
    outcome: "completed_successfully"
  }
  ↓
Backend finalizes execution record
Backend updates learning data (Thompson Sampling alpha/beta)
  ↓
Returns: { status: "success" }
```

---

## Component Dependencies & Data Sources

### What Each Component Needs

**metabob-rpc-api** (Backend):
```yaml
Inputs:
  - Template definitions (SQL inserts or API calls)
  - Execution start/step/complete events (from CLI)
  - Configuration: SurrealDB connection, Redis connection

Data Sources:
  - SurrealDB: Templates, executions, variants, learning data
  - Redis: Job queue, caching

Outputs:
  - Template list (GET /v2/activities/templates)
  - Single template (GET /v2/activities/templates/{id})
  - Execution records (POST /v2/activities/record/*)
```

**metabob-cli** (MCP Bridge + Orchestrator):
```yaml
Inputs:
  - MCP tool calls from OpenCode (stdio transport)
  - Backend API responses (HTTP)
  - Configuration: .metabob-config.json

Data Sources:
  - Backend API: Template retrieval
  - Local state: ActivityExecution objects (in-memory)
  - File system: .metabob/state (session token)

Outputs:
  - MCP tool responses to OpenCode (stdio)
  - Backend API calls (HTTP)
  - Current step to execute (one at a time)
```

**metabob-opencode** (Executor):
```yaml
Inputs:
  - User commands (activity tool calls)
  - MCP tool responses from CLI (stdio)
  - Impulse space (loaded context)
  - Configuration: .opencode/opencode.json

Data Sources:
  - CLI via MCP: Templates, steps, execution state
  - File system: Impulses, code files
  - LLM APIs: Anthropic, OpenAI

Outputs:
  - MCP tool calls to CLI (stdio)
  - Step results (success, cost, tokens, output)
  - Modified code files (via tool calls)
```

**metabob-dashboard** (UI):
```yaml
Inputs:
  - Analysis results from backend (cloud mode) or MCP API (local mode)
  - User interactions

Data Sources:
  - Cloud mode: metabob-rpc-api (SurrealDB)
  - Local mode: MCP Dashboard API (in-memory cache)

Outputs:
  - Visualizations, metrics, issue lists
```

---

## Local Development Setup

### Prerequisites

```bash
# Required
- Docker & Docker Compose
- Python 3.10+ with uv package manager
- Bun (for OpenCode and Dashboard)
- Git with submodules support

# Optional but Recommended
- Anthropic API key (for LLM execution)
- Redis (or use Docker)
- SurrealDB (or use Docker)
```

### Quick Start (All Components)

```bash
# 1. Clone the meta-repo
cd /home/avi/documents/work/exp-repo/metabob-devbob

# 2. Start backend services (stable profile)
docker-compose --profile stable up -d
# Starts: redis, surreal, metabob-rpc-api-server, celery-worker

# 3. Verify backend health
curl http://localhost:8080/health
# Should return: {"status":"ok"}

# 4. Check available templates
curl http://localhost:8080/v2/activities/templates | jq

# 5. OpenCode is already running locally
# Check MCP connection
cd repos/metabob-opencode
bun run packages/opencode/src/cli.ts
# In OpenCode: test_metabob_mcp

# 6. Test activity execution
# In OpenCode Activity Mode:
search_activities({})
# Should return 20 templates

activity({
  activityId: "demo-315bfaf1",  // 2-task demo
  variables: { message: "Hello!" },
  reason: "Test execution"
})
# Should complete in ~35 seconds
```

### Component-by-Component Setup

#### Backend (metabob-rpc-api)

```bash
cd repos/metabob-rpc-api

# Install dependencies
pip install pip-tools
pip-sync requirements-dev.txt
pip install -e .

# Configure environment
cp .env.example .env
# Edit .env: Set SURREAL_URL, REDIS_URI, API keys

# Start services via Docker
docker-compose up -d
# Or use host services:
# Redis: redis-server --port 6379
# SurrealDB: surreal start --bind 0.0.0.0:8000 --user root --pass root file:data/db

# Start API server (local development)
start_server --config .env --port 8080
```

#### CLI (metabob-cli)

```bash
cd repos/metabob-cli

# Install dependencies (uses uv)
make setup
# Or: uv sync --all-extras

# Run tests
make test

# Start MCP server (stdio mode for OpenCode integration)
metabob-cli mcp --transport stdio

# Or: Start with dashboard enabled
metabob-cli mcp --enable-dashboard --dashboard-port 3002
```

#### OpenCode (metabob-opencode)

```bash
cd repos/metabob-opencode

# Install dependencies
bun install

# Configure MCP connection
# Edit .opencode/opencode.json:
{
  "mcp": {
    "metabob": {
      "command": "metabob-cli",
      "args": ["mcp", "--transport", "stdio"]
    }
  }
}

# Start OpenCode
bun run packages/opencode/src/cli.ts

# Test MCP connection
# In OpenCode: test_metabob_mcp
# In Activity Mode: search_activities({})
```

#### Dashboard (metabob-dashboard)

**Cloud Mode** (development):
```bash
cd repos/metabob-dashboard

# Install dependencies
bun install

# Start development server
REACT_APP_DEPLOYMENT_MODE=cloud bun run start
# Or: bun run start:cloud

# Visit: http://localhost:3000
```

**Local Mode** (bundled with CLI):
```bash
cd repos/metabob-cli

# Start MCP server with dashboard
metabob-cli mcp --enable-dashboard --dashboard-port 3002

# Visit: http://localhost:3002
```

---

## Activity Template Development

### Creating New Templates

**Option 1: Use activity-create Template** (Recommended)
```javascript
// In OpenCode Activity Mode
activity({
  activityId: "infrastructure-4ef1508c",  // activity-create-v2
  variables: {
    template_name: "my-new-template",
    template_description: "Does something useful",
    category: "feature"
  },
  reason: "Create new activity template"
})
```

**Option 2: Manual SQL Insert**
```sql
-- repos/metabob-rpc-api/sql/insert_activity_template.surql
INSERT INTO activity_templates {
  template_id: "my-new-template",
  variant_id: "my-new-template-v1",
  variant_name: "My New Template v1",
  category: "feature",
  task_steps: [
    {
      id: "step-1",
      description: "Do something",
      prompt: {
        template: "Do {{action}} on {{target}}",
        variables: ["action", "target"]
      },
      impulse_refs: ["context-impulse"],
      allowed_tools: ["read", "write", "bash"]
    }
  ],
  impulse_refs: ["context-impulse"],
  required_variables: ["action", "target"],
  optional_variables: []
};
```

**Option 3: API Endpoint** (Not Yet Implemented)
```bash
# TODO: POST /v2/activities/templates/create
curl -X POST http://localhost:8080/v2/activities/templates/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @my-template.json
```

### Testing Templates

```javascript
// In OpenCode Activity Mode

// 1. Search for your template
search_activities({ query: "my-new-template" })

// 2. Execute it
activity({
  activityId: "your-template-id",
  variables: { action: "test", target: "file.js" },
  reason: "Test new template"
})

// 3. Check backend for execution record
// curl http://localhost:8080/v2/activities/executions?template_id=your-template-id
```

---

## Debugging Guide

### Backend Issues

**Problem**: Templates not appearing in search
```bash
# Check backend is running
curl http://localhost:8080/health

# Check SurrealDB connection
docker logs api-server-dev | grep -i surreal

# Query database directly
surreal sql --conn ws://localhost:8000 --user root --pass root \
  --ns metabob --db metabob \
  --pretty
> SELECT * FROM activity_templates;
```

**Problem**: Execution not recorded
```bash
# Check execution endpoint
curl -X POST http://localhost:8080/v2/activities/record/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"template_id":"demo-315bfaf1","variant_id":"v1","variables":{}}'

# Check logs
docker logs api-server-dev | tail -50
```

### CLI/MCP Issues

**Problem**: MCP connection not working
```bash
# Test MCP server directly
cd repos/metabob-cli
metabob-cli mcp --transport stdio

# Check logs
tail -f .metabob/logs/mcp.log

# Verify tools are registered
# In OpenCode: test_metabob_mcp
```

**Problem**: Activity orchestration failing
```python
# Test ActivityManager directly
cd repos/metabob-cli
python3 -c "
import asyncio
from metabob_cli.mcp.activity_manager import get_activity_manager
from metabob_cli.core.file_state import FileStateManager
from pathlib import Path

async def test():
    state_mgr = FileStateManager(state_file=Path('.metabob/state'))
    await state_mgr.reload_state_async(force=True)
    token = state_mgr.get_session_token()
    
    manager = get_activity_manager('http://localhost:8080', token)
    templates = await manager.search_activities()
    print(f'Found {len(templates)} templates')

asyncio.run(test())
"
```

### OpenCode Issues

**Problem**: Activity execution failing silently
```bash
# Enable debug logging
cd repos/metabob-opencode
DEBUG=* bun run packages/opencode/src/cli.ts

# Check execution state
# In OpenCode:
# Look for errors in console output
# Check .opencode/sessions/ for session logs
```

**Problem**: Complex templates (8+ tasks) fail in 0.0s
```javascript
// Known issue - see ACTIVITY_SYSTEM_OPERATIONAL_FEB15.md
// Potential causes:
// 1. Metabob tool unavailability in subagent context
// 2. Workspace isolation failures
// 3. Multi-subagent coordination issues
// 4. Resource constraints (memory/tokens)

// Workaround: Use simple 2-4 task templates only
// Test complexity threshold:
activity({
  activityId: "other-97e440b7",  // 6 tasks
  variables: {...},
  reason: "Find complexity threshold"
})
```

---

## Known Issues & Limitations

### ⚠️ Task-Level Tracking Not Working

**Symptom**: Executions succeed but `tasks: []` array remains empty in backend  
**Impact**: No per-task metrics, no learning data, incomplete execution records  
**Status**: Bug confirmed, needs investigation  
**Workaround**: None - execution-level tracking works but task-level does not

### ❌ Complex Template Immediate Failure

**Symptom**: 8-task templates fail in 0.0s with no error message  
**Impact**: Cannot use Metabob-powered workflows (main value proposition)  
**Status**: Critical bug, root cause investigation needed  
**Workaround**: Use simple 2-task templates only until fixed

### ⚠️ MCP Stub Tool Confusion

**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py` lines 103-108  
**Issue**: Hardcoded stub that reports success without actually executing  
**Impact**: Confusion about which executor is being used  
**Recommendation**: Remove stub or complete implementation  
**Note**: OpenCode has native activity executor that works independently

### ❌ Template Creation Not Persisting

**Issue**: activity-create generates JSON but doesn't commit to backend  
**Workaround**: Manual SQL insert or file import  
**Fix Needed**: Add API endpoint and wire up template creation

### ❌ Schema Not Embedded in Templates

**Issue**: activity-create reads schema from filesystem instead of impulses  
**Impact**: Templates can't be truly self-contained  
**Fix Needed**: Embed schema as impulse in activity-create template

---

## Architecture Principles

### Separation of Concerns

| Component | Role | Analogy |
|-----------|------|---------|
| **metabob-rpc-api** | Library | Stores templates, remembers outcomes |
| **metabob-cli** | Choreographer | Decides which step comes next |
| **metabob-opencode** | Dancer | Executes the given step |

### Incremental Step Delivery ✅

- OpenCode **never sees the full template**
- CLI returns **one step at a time**
- Agent can't "skip ahead" or see future steps
- Enables control, security, and dynamic adaptation

### Orchestrator-Executor Split ✅

- **CLI = Policy** (what to do next)
- **OpenCode = Mechanism** (how to execute it)
- Clear separation of concerns
- Enables delegation to different executors (containers, remote agents)

### State Split ✅

- **CLI memory**: In-flight execution state (current_step_index, step_results)
- **Backend storage**: Historical data (templates, execution records)
- Both needed for full system operation
- CLI state is ephemeral, backend state is persistent

---

## Success Metrics

### Current Status (Feb 15, 2026)

**Discovery & Search**: 🟢 100% Working
- search_activities returns 20 templates
- Field name mapping works correctly
- MCP integration functional after restart

**Simple Execution**: 🟢 100% Working
- 2-task templates execute successfully
- Demo template completed in 35.1s
- Step-by-step execution works
- Metrics collection works (cost, tokens, duration)

**Task Tracking**: 🟡 0% Working
- Execution records created
- But tasks array remains empty
- No per-task metrics stored
- Learning data incomplete

**Complex Execution**: 🔴 0% Working
- 8+ task templates fail in 0.0s
- No error messages provided
- Silent failure requires debugging
- Blocks Metabob-powered workflows

### Target Metrics

- ✅ Discovery: 100% (ACHIEVED)
- ✅ Simple Execution: 100% (ACHIEVED)
- ⚠️ Task Tracking: 0% (NEEDS FIX)
- ❌ Complex Execution: 0% (CRITICAL)
- ❌ Template Creation: 0% (HIGH PRIORITY)
- ❌ Variant System: 0% (FUTURE)

---

## Next Steps

### Immediate (Fix Blockers)

1. **Debug complex template failures**
   - Enable detailed logging in OpenCode activity executor
   - Test 6-task template to find complexity threshold
   - Check Metabob tool availability in subagent context
   - Verify workspace isolation for multi-step execution

2. **Fix task-level tracking**
   - Investigate why tasks array not persisting
   - Ensure step results recorded properly in backend
   - Verify API endpoint receives step data

### Short-term (Enable Features)

3. **Create template registration API**
   - POST /v2/activities/templates/create endpoint
   - Validate proto format
   - Generate variant_id
   - Return created template

4. **Wire up template creation in activity-create**
   - Call registration API from step 4
   - Verify template appears in search
   - Test end-to-end template creation

### Medium-term (Self-Improvement)

5. **Implement trailblazing detection**
   - Detect when agent deviates from template
   - Record deviation as potential variant
   - Generate variant creation proposals

6. **Build variant selection algorithm**
   - Context similarity matching
   - Success rate comparison
   - Thompson Sampling already implemented in backend

7. **Create debugging tools**
   - activity-debug template
   - activity-update template
   - Execution trace visualization

---

## References

### Key Documentation Files

- `ACTIVITY_SYSTEM_OPERATIONAL_FEB15.md` - Current status, execution test results
- `ACTIVITY_SYSTEM_QUICK_START.md` - Basic usage guide
- `ARCHITECTURE_QUICK_REFERENCE.md` - Component roles and responsibilities
- `ACTIVITY_SYSTEM_DATA_FLOW.md` - Detailed data flow mapping
- `repos/metabob-cli/README.md` - CLI tool documentation
- `repos/metabob-dashboard/DEPLOYMENT_MODES.md` - Dashboard architecture

### Useful Commands

```bash
# Backend health check
curl http://localhost:8080/health

# List all templates
curl http://localhost:8080/v2/activities/templates | jq

# Check Docker services
docker-compose --profile stable ps

# View backend logs
docker logs api-server-dev -f

# Test MCP connection
# In OpenCode: test_metabob_mcp

# Search activities
# In OpenCode: search_activities({})

# Execute simple template
# In OpenCode: activity({ activityId: "demo-315bfaf1", variables: {message: "test"}, reason: "test" })
```

---

**Last Updated**: February 15, 2026 14:15 UTC  
**Maintained By**: Activity System Development Team
