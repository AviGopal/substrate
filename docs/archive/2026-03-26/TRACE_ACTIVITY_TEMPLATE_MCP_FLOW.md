# Trace: Activity Template Flow via MCP Backend

**Status:** ✅ ARCHITECTURE COMPLIANT - FULLY IMPLEMENTED  
**Date:** 2026-03-04  
**Impulse ID:** `trace-Activity Template Flow via MCP Backend`

## Executive Summary

The Activity Template Flow via MCP Backend specification is **FULLY IMPLEMENTED** and **ARCHITECTURE COMPLIANT**. All components properly enforce the MCP backend communication path with zero direct file system access to `.metabob/activities/*.json`.

### Key Findings

- ✅ **MCP Backend Flow:** Activity agent → TemplateServiceClient → MetabobCLI → MCP → metabob-cli → RPC API → SurrealDB
- ✅ **No Direct File Access:** All local file reads/writes to `.metabob/activities/` removed (lines 803-813 in metabob.ts)
- ✅ **Agent Separation:** Activity agent focuses on template selection, Memory agent manages impulse state
- ✅ **Bootstrap Fallback:** Controlled fallback for cold-start with `evolve-activity` and `manage-session-memory`
- ✅ **Thompson Sampling:** RPC API enables continuous learning via Beta distribution variant selection
- ✅ **Storage Architecture:** SurrealDB primary + Redis cache (TTL) for performance and durability

## Architecture Components

### 1. TemplateLoader (OpenCode)
**File:** `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`

**Behavior:** 
- Attempts MCP backend load first via `TemplateServiceClient`
- Falls back to embedded bootstrap templates if backend unavailable
- Returns `source='metabob'` for backend, `source='local'` for bootstrap
- `strictBackend` mode enforces backend-only for non-bootstrap templates

**Status:** ✅ COMPLIANT - No direct file access

### 2. TemplateServiceClient (OpenCode)
**File:** `repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts`

**Behavior:**
- Abstraction layer over MetabobCLI MCP tools
- Provides typed methods matching TemplateService proto spec
- `searchTemplates()` → `MetabobCLI.searchActivities()`
- `getTemplate()` → `MetabobCLI.getActivity()`
- `registerTemplate()` → `MetabobCLI.registerActivityTemplate()` (30s timeout)

**Status:** ✅ COMPLIANT - Proper MCP delegation

### 3. MetabobCLI (OpenCode)
**File:** `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

**Behavior:**
- MCP tool wrapper
- `searchActivities()` calls `'search_activities'` MCP tool
- `getActivity()` calls `'activity'` MCP tool
- `registerActivityTemplate()` calls `'metabob_register_activity_template'` MCP tool
- **NO LOCAL FILE WRITES** (removed at lines 803-813)

**Status:** ✅ COMPLIANT - MCP-only communication

### 4. Activity Agent (OpenCode)
**File:** `repos/metabob-opencode/packages/opencode/src/agent/agent.ts` (Lines 113-160)

**Behavior:**
- Has `search_activities` tool enabled (line 123)
- Uses templates for complex workflows, direct execution for simple tasks
- Full tool access: read/write/bash/task delegation
- **Does NOT have impulse tools** (impulse_create=false, impulse_load=false)

**Status:** ✅ COMPLIANT - Focused on template selection and execution

### 5. Memory Agent (OpenCode)
**File:** `repos/metabob-opencode/packages/opencode/src/agent/agent.ts` (Lines 375-450)

**Behavior:**
- Manages impulse lifecycle (impulse_create, impulse_load, impulse_list, etc.)
- Infers variables for activity execution requests
- When user types `%activity-name`, loads session impulses and calls `activity()` tool
- **Does NOT have search_activities** (Activity agent responsibility)

**Status:** ✅ COMPLIANT - Focused on impulse state and variable inference

### 6. RPC API Activity Router (Backend)
**File:** `repos/metabob-rpc-api/server/routes/activity.py`

**Endpoints:**
- `GET /v2/activities/templates` - List with Thompson Sampling (lines 72-131)
- `GET /v2/activities/templates/{id}` - Get specific template (lines 134-172)
- `POST /v2/activities/templates` - Create template or auto-variant (lines 175-272)
- `POST /v2/activities/executions` - Record execution for learning (lines 318-359)
- `POST /v2/activities/templates/{id}/metrics` - Update metrics from OpenCode (lines 413-544)

**Status:** ✅ COMPLIANT - Provides backend API

### 7. RPC API Activity Actions (Backend)
**File:** `repos/metabob-rpc-api/server/actions/activity.py`

**Storage Architecture:**
- **Write Path:** Client → SurrealDB (primary) → Redis cache (TTL)
- **Read Path:** Client → Redis (cache hit) OR SurrealDB (miss) → populate Redis
- **Thompson Sampling:** Beta(alpha, beta) distribution for variant selection

**Status:** ✅ COMPLIANT - SurrealDB primary + Redis cache

## Data Flow Diagram

```
┌──────────────────┐
│ Activity Agent   │  Calls search_activities() tool
└────────┬─────────┘
         │
         v
┌──────────────────┐
│ TemplateLoader   │  list() / search() / load()
└────────┬─────────┘
         │
         v
┌─────────────────────┐
│TemplateServiceClient│  searchTemplates() / getTemplate()
└────────┬────────────┘
         │
         v
┌──────────────────┐
│   MetabobCLI     │  searchActivities() / getActivity()
└────────┬─────────┘
         │
         v
┌──────────────────┐
│   MCP Layer      │  callTool('search_activities', 'activity')
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  metabob-cli     │  MCP Server
│   MCP Server     │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  metabob-rpc-api │  GET /v2/activities/templates
│   FastAPI        │  GET /v2/activities/templates/{id}
└────────┬─────────┘
         │
         v
┌──────────────────┐
│   SurrealDB      │  Primary storage
│   + Redis Cache  │  Performance layer
└──────────────────┘
```

## Validation Checks

| Check | File | Line | Status |
|-------|------|------|--------|
| TemplateLoader returns source='metabob' | template-loader.ts | 132 | ✅ COMPLIANT |
| No direct .metabob/activities/*.json reads | metabob.ts | 803-813 (removed) | ✅ COMPLIANT |
| test_metabob_mcp() reports status='connected' | OpenCode tool | N/A | ✅ TESTABLE |
| Activity agent has search_activities | agent.ts | 123 | ✅ COMPLIANT |
| Memory agent manages impulse state | agent.ts | 375-450 | ✅ COMPLIANT |

## Architecture Principles Enforced

1. **Separation of Concerns:**
   - Activity agent: Template selection and execution orchestration
   - Memory agent: Impulse state management and variable inference

2. **Backend-First:**
   - All template operations flow through MCP → RPC API → SurrealDB
   - No direct file system access (except bootstrap cold-start fallback)

3. **Learning Loop:**
   - Thompson Sampling enables continuous learning
   - Execution results update metrics in SurrealDB
   - Better variants automatically selected over time

4. **Data Durability:**
   - SurrealDB as primary storage (persistent)
   - Redis as cache layer (TTL for performance)

5. **Bootstrap Exception:**
   - `evolve-activity` and `manage-session-memory` can load from embedded source
   - Enables cold-start without MCP server dependency
   - `strictBackend=true` available for production enforcement

## Conclusion

**This specification is FULLY IMPLEMENTED and requires NO CHANGES.**

All components properly enforce the MCP backend communication path. The architecture successfully:
- Eliminates direct file system access to templates
- Provides centralized learning and quality control via RPC API
- Enables distributed, idempotent execution across instances
- Maintains bootstrap fallback for development convenience

**Next Steps:**
- Use this trace for validation harness creation
- Reference for enforcement and compliance checks
- Serve as architectural documentation for future changes

---

**Impulse Location:** `./impulses/trace-Activity Template Flow via MCP Backend.json`  
**Trace Data:** `./trace-activity-template-mcp-flow.json`
