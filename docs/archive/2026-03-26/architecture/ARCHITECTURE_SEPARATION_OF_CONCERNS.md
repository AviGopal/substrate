# Architecture: Separation of Concerns Analysis

## Current System Components

### 1. metabob-rpc-api (Backend Service)
**Location**: `repos/metabob-rpc-api`  
**Language**: Python (FastAPI)  
**Port**: 8080

### 2. metabob-cli (Client Library + MCP Server)
**Location**: `repos/metabob-cli`  
**Language**: Python  
**Interfaces**: CLI, MCP Protocol

### 3. metabob-opencode (AI Agent Platform)
**Location**: `repos/metabob-opencode`  
**Language**: TypeScript (Bun)  
**Port**: 8080 (server mode)

## Scope Analysis

Let me examine each component's responsibilities...

## Ideal Separation of Concerns

### 🏢 metabob-rpc-api (Backend/State/Persistence Layer)

**Primary Responsibility**: Centralized state management and business logic

**Should Own**:
- ✅ Activity template storage (Redis)
- ✅ Thompson Sampling metrics and learning
- ✅ Code analysis results storage
- ✅ User sessions and authentication
- ✅ Project/repository tracking
- ✅ Metrics aggregation and reporting
- ✅ WebSocket notifications
- ✅ File analysis coordination
- ✅ Feedback/learning data collection

**Should NOT**:
- ❌ Code analysis execution (delegate to analysis workers)
- ❌ MCP protocol implementation
- ❌ Agent orchestration
- ❌ Activity execution (delegate to clients)
- ❌ UI rendering

**API Surface**:
```
/v2/activities/*          - Activity template CRUD, metrics
/v2/analysis/*            - Code analysis submission, results
/v2/sessions/*            - Session management
/v2/repositories/*        - Repository tracking
/v2/metrics/*             - Metrics aggregation
/v2/github/*              - GitHub integration
/health                   - Health checks
```

**Dependencies**:
- Redis (state)
- SurrealDB (analytics)
- Analysis workers (async)

---

### 🔧 metabob-cli (Client Library + Analysis Tools)

**Primary Responsibility**: Code quality tooling and MCP interface

**Should Own**:
- ✅ Local file analysis coordination
- ✅ Code problem detection (via backend)
- ✅ MCP server implementation (expose Metabob to MCP clients)
- ✅ Activity template registration (to backend)
- ✅ CPG (Code Property Graph) building
- ✅ Local caching and performance optimization
- ✅ CLI commands for developers

**Should NOT**:
- ❌ Activity execution orchestration (that's metabob-opencode)
- ❌ Template storage (backend responsibility)
- ❌ Thompson Sampling logic (backend responsibility)
- ❌ Session management (backend responsibility)
- ❌ Agent implementations (that's metabob-opencode)

**Interfaces**:
```
CLI Commands:
  analyze              - Submit code for analysis
  problems             - List detected issues
  metrics              - Show quality metrics
  register-template    - Register activity templates

MCP Tools (for AI agents):
  metabob_search_codebase_issues
  metabob_mark_problem_complete
  metabob_annotate_component
  metabob_analyze_change_impact
  metabob_list_file_components
  metabob_assess_deletion_safety
  metabob_suggest_related_changes
  metabob_get_priority_issues
  metabob_search_activities       - List available templates
  metabob_get_activity_template   - Get template metadata
```

**Dependencies**:
- metabob-rpc-api (backend)
- Tree-sitter (parsing)
- Redis (optional local cache)

---

### 🤖 metabob-opencode (Agent Platform + Activity Execution)

**Primary Responsibility**: AI agent orchestration and activity execution

**Should Own**:
- ✅ Activity execution engine
- ✅ Agent mode implementations (activity, config, session, tool, test, docs)
- ✅ Session management (conversation state)
- ✅ Impulse system (context management)
- ✅ Memory agent (context selection)
- ✅ Tool orchestration (calling bash, read, write, etc.)
- ✅ Agent-to-agent communication (ACP)
- ✅ Trailblazing (adaptive execution)
- ✅ UI/TUI interfaces
- ✅ MCP client (consuming other MCP servers like metabob-cli)

**Should NOT**:
- ❌ Code analysis implementation (use metabob-cli MCP)
- ❌ Template storage (use backend via metabob-cli)
- ❌ Thompson Sampling (backend responsibility)
- ❌ File watching/analysis coordination (metabob-cli)

**Interfaces**:
```
CLI Commands:
  opencode chat              - Interactive chat mode
  opencode serve             - HTTP/WebSocket server
  opencode acp               - Agent communication protocol server
  opencode activity          - Execute activity templates

Agent Modes:
  - activity: Implementation and execution
  - config: Configuration management
  - session: Session orchestration
  - tool: Tool creation
  - test: Testing workflows
  - docs: Documentation

Tools Available to Agents:
  - bash, read, write, edit, list, glob, grep
  - activity, activity_replay
  - todowrite, todoread
  - impulse tools (via memory agent)
  - MCP tools (metabob_*, playwright_*, etc.)
```

**Dependencies**:
- metabob-cli (via MCP)
- metabob-rpc-api (via metabob-cli MCP)
- Anthropic API (LLM)

---

## Current Architecture Issues

### ❌ Problem 1: metabob-cli has ActivityManager
**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Issue**: metabob-cli shouldn't orchestrate activity execution - that's metabob-opencode's job.

**Current State**:
- ActivityManager handles execution state
- Tracks step results, trailblazing
- Records outcomes to backend

**Should Be**:
- metabob-cli only provides MCP tools to **discover** templates
- metabob-opencode handles all execution logic
- ActivityManager should live in metabob-opencode

**Fix**: Move ActivityManager to metabob-opencode's activity plugin

---

### ❌ Problem 2: Template Storage Confusion
**Current**: Templates stored in 3 places:
1. Backend Redis (metabob-rpc-api)
2. Local storage (metabob-opencode: `~/.local/share/opencode/storage/activity-template/`)
3. metabob-cli local cache (`~/.metabob/activities/`)

**Issue**: No single source of truth, sync problems

**Should Be**:
- **Backend (metabob-rpc-api)**: Single source of truth
- **metabob-opencode**: Cache only, sync from backend via metabob-cli MCP
- **metabob-cli**: No local storage, pure pass-through to backend

---

### ❌ Problem 3: Execution Recording Responsibility
**Current**: metabob-cli records execution outcomes to backend

**Issue**: Execution is metabob-opencode's responsibility, why is metabob-cli doing it?

**Should Be**:
- metabob-opencode tracks execution state
- metabob-opencode posts execution outcomes to backend (via metabob-cli MCP or direct API)
- metabob-cli just provides MCP tools, doesn't manage execution

---

### ✅ Problem 4: MCP Gateway Pattern (Already Correct)
**Current**: metabob-opencode → metabob-cli MCP → metabob-rpc-api

**Status**: ✓ This is correct! No direct backend calls from opencode.

---

## Proposed Refactoring

### Phase 1: Clarify metabob-cli Scope
**Goal**: Make metabob-cli a pure MCP server for code quality tools

**Changes**:
1. Move `ActivityManager` to metabob-opencode
2. Remove activity execution logic from metabob-cli
3. Keep only MCP tools:
   - Code quality: search_issues, mark_complete, annotate, etc.
   - Template discovery: search_activities, get_template_safe
   - Template registration: register_template (to backend)

**Result**: metabob-cli becomes stateless MCP server

---

### Phase 2: Centralize Template Storage
**Goal**: Backend is single source of truth

**Changes**:
1. Remove local template storage from metabob-cli
2. metabob-opencode syncs templates from backend on startup
3. All template mutations go through backend API

**Result**: No sync issues, clear ownership

---

### Phase 3: Move Execution to metabob-opencode
**Goal**: Activity execution owned by agent platform

**Changes**:
1. Move ActivityManager to `metabob-opencode/packages/plugin-activities`
2. metabob-opencode posts execution outcomes directly to backend
3. metabob-cli provides read-only MCP tools only

**Result**: Clean separation: CLI = tools, OpenCode = execution

---

## Ideal Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    metabob-opencode                         │
│              (Agent Platform + Execution)                   │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Activity  │  │    Memory    │  │  Agent Modes    │  │
│  │   Manager   │  │    Agent     │  │  (activity,     │  │
│  │  (Execution)│  │  (Context)   │  │   config, etc.) │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                 │                    │            │
│         │                 │                    │            │
│         └─────────────────┴────────────────────┘            │
│                           │                                 │
│                           │ Uses MCP Tools                  │
│                           ▼                                 │
│                  ┌─────────────────┐                       │
│                  │   MCP Client    │                       │
│                  │  (Tool Caller)  │                       │
│                  └────────┬────────┘                       │
└───────────────────────────┼──────────────────────────────┘
                            │
                            │ MCP Protocol
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      metabob-cli                            │
│               (MCP Server + Code Tools)                     │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Code Quality    │  │  Template        │               │
│  │  MCP Tools       │  │  Discovery       │               │
│  │  - search_issues │  │  - search_acts   │               │
│  │  - annotate      │  │  - get_template  │               │
│  │  - CPG tools     │  │  - register      │               │
│  └────────┬─────────┘  └────────┬─────────┘               │
│           │                      │                          │
│           │                      │                          │
│           └──────────────────────┘                          │
│                     │                                       │
│                     │ HTTP API                              │
│                     ▼                                       │
└─────────────────────────────────────────────────────────────┘
                      │
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  metabob-rpc-api                            │
│            (Backend + State + Persistence)                  │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐             │
│  │  Redis   │  │ SurrealDB│  │  Analysis   │             │
│  │ (State)  │  │(Analytics)│ │  Workers    │             │
│  └──────────┘  └──────────┘  └─────────────┘             │
│                                                             │
│  Routes:                                                    │
│  - /v2/activities/*     (Templates, Metrics)               │
│  - /v2/analysis/*       (Code Analysis)                    │
│  - /v2/sessions/*       (Session State)                    │
│  - /v2/repositories/*   (Repo Tracking)                    │
│  - /v2/metrics/*        (Aggregations)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow Examples

### Example 1: Execute Activity
```
User → metabob-opencode activity tool
  ↓
metabob-opencode ActivityManager starts execution
  ↓
metabob-opencode calls metabob-cli MCP: search_codebase_issues
  ↓
metabob-cli MCP → metabob-rpc-api: GET /v2/analysis/issues
  ↓
metabob-rpc-api → Redis → Response
  ↓
metabob-cli MCP → metabob-opencode
  ↓
metabob-opencode completes task, records outcome
  ↓
metabob-opencode → metabob-rpc-api: POST /v2/activities/executions
  ↓
metabob-rpc-api updates Thompson Sampling in Redis
```

**Separation**: 
- ✓ metabob-opencode = orchestration
- ✓ metabob-cli = tools via MCP
- ✓ metabob-rpc-api = state

---

### Example 2: Code Quality Check
```
Developer → metabob-cli analyze
  ↓
metabob-cli → metabob-rpc-api: POST /v2/analysis/submit
  ↓
metabob-rpc-api → Analysis Workers (async)
  ↓
Analysis complete → Redis
  ↓
metabob-cli polls → metabob-rpc-api: GET /v2/analysis/results
  ↓
metabob-cli displays results to developer
```

**Separation**:
- ✓ metabob-cli = developer interface
- ✓ metabob-rpc-api = coordination
- ✓ Workers = analysis execution

---

## Summary: Who Owns What

| Responsibility | metabob-rpc-api | metabob-cli | metabob-opencode |
|----------------|-----------------|-------------|------------------|
| Template Storage | ✅ Redis | ❌ | 🔄 Cache only |
| Template Registration | ✅ API endpoint | 🔄 CLI + MCP | 🔄 Via MCP |
| Activity Execution | ❌ | ❌ | ✅ ActivityManager |
| Execution Recording | ✅ Receive outcomes | ❌ | ✅ Post outcomes |
| Thompson Sampling | ✅ Learning logic | ❌ | ❌ |
| Code Analysis | ✅ Coordinate | 🔄 Submit via CLI | 🔄 Use via MCP |
| MCP Server | ❌ | ✅ Code tools | ❌ |
| MCP Client | ❌ | ❌ | ✅ Tool consumer |
| Agent Orchestration | ❌ | ❌ | ✅ Agents |
| Session State | ✅ Backend store | ❌ | ✅ Runtime state |

**Legend**:
- ✅ Primary owner
- 🔄 Interface/pass-through
- ❌ Should not own

---

## Action Items

### Immediate (Fix Current Issues)
1. ✅ Document separation of concerns (this doc)
2. 🔄 Audit metabob-cli: identify execution logic to move
3. 🔄 Audit metabob-opencode: ensure no direct backend calls
4. 📝 Create architecture compliance validation activity

### Short Term (Clean Separation)
1. Move ActivityManager from metabob-cli to metabob-opencode
2. Remove local template storage from metabob-cli
3. Make metabob-cli MCP tools stateless (pure API pass-through)
4. Centralize execution recording in metabob-opencode

### Long Term (Ideal Architecture)
1. Extract analysis workers from metabob-rpc-api
2. Make metabob-cli pure MCP server (no CLI commands, only MCP)
3. Implement template sync protocol (backend → opencode cache)
4. Add architecture validation to CI/CD

---

**Conclusion**: The core issue is that metabob-cli has grown beyond its scope. It should be a **stateless MCP server** providing code quality tools, not orchestrating activity execution. That's metabob-opencode's job.

