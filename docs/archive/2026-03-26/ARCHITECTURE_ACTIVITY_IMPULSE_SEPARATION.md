# Architecture: Activity and Impulse Management Separation

**Date:** 2026-03-04  
**Status:** ✅ IMPLEMENTED  
**Environment:** Single-node Kubernetes cluster (local development)

## Overview

This document establishes the architectural boundaries between activity/impulse management systems and metabob-opencode, ensuring proper separation of concerns and preparing for distributed, idempotent execution in networked devbob containers.

## Core Principles

### 1. **Separation of Concerns**

- **metabob-opencode**: Execution orchestrator, context manager, LLM interface
- **metabob-cli (MCP)**: Activity specification storage, template management, impulse tracking
- **metabob-rpc-api**: Centralized backend for learning, metrics, persistence

```
┌─────────────────────┐
│  metabob-opencode   │  ← Executes activities, manages context
│   (Activity Mode)   │
└──────────┬──────────┘
           │ MCP Protocol
           ↓
┌─────────────────────┐
│   metabob-cli MCP   │  ← Manages templates, provides tools
│     (stdio mode)    │
└──────────┬──────────┘
           │ HTTP + Bearer Auth
           ↓
┌─────────────────────┐
│  metabob-rpc-api    │  ← Stores templates, tracks metrics
│ (api.metabob.local) │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│     SurrealDB       │  ← Persistent storage
│  (db.metabob.local) │
└─────────────────────┘
```

### 2. **No Hardcoded Templates**

**Enforced Constraint**: Activity templates MUST NOT be stored as loose JSON files in arbitrary locations.

**Rationale**:
- Templates scattered across `.metabob/activities/` directories create inconsistency
- Local files bypass learning loop and quality tracking
- Distributed execution requires centralized template source

**Implementation**:
- Removed all legacy `*.json` files from `.metabob/activities/` directories (197 files archived)
- Disabled local file writes in `MetabobCLI.registerActivityTemplate()` (line 803-813)
- Templates registered via MCP → RPC API → SurrealDB only

### 3. **Idempotency Learning Path**

**Goal**: Activity execution becomes idempotent w.r.t. a particular set of input impulses.

**Learning Stages**:

1. **Stage 1 (Current): Get AN answer**
   - Activity executes with LLM calls and randomness
   - Track inputs (impulses) and outputs (changes, metrics)
   - Record deviations and required interventions

2. **Stage 2 (Next): Get the CORRECT answer**
   - Analyze execution patterns across runs
   - Identify which impulses drive deterministic vs. non-deterministic behavior
   - Refine templates based on success patterns

3. **Stage 3 (Future): Get RELIABLY correct answers**
   - Remove LLM calls where patterns are deterministic
   - Cache deterministic transformations
   - Reduce execution time and cost by 80%+

**Tracking Mechanism**:
```typescript
// Activity execution captures:
{
  execution_id: string
  impulses_loaded: string[]        // Input context
  impulses_created: string[]       // Output artifacts
  component_changes: object[]      // File modifications
  tool_calls: object[]             // LLM interactions
  deviations: object[]             // Trailblazing / recovery
  cost: number
  duration_ms: number
}
```

## Configuration

### Root Project (`metabob-devbob/.opencode/opencode.json`)

```json
{
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {
        "METABOB_API_KEY": "local-dev-key",
        "METABOB_API_URL": "http://api.metabob.local"
      },
      "enabled": true
    }
  },
  "metabob": {
    "cli_path": "metabob-cli",
    "base_url": "http://api.metabob.local",
    "api_key": "local-dev-key",
    "auto_inject": true,
    "template_registration": {
      "auto_register": false,
      "default_category": "feature"
    },
    "activity_learning": {
      "enabled": true,
      "min_confidence": 0.7
    }
  }
}
```

### OpenCode Repo (`repos/metabob-opencode/.opencode/opencode.json`)

```json
{
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {
        "METABOB_API_KEY": "mb_devbob_test_simple_2026_v2",
        "METABOB_API_URL": "http://api.metabob.local"
      },
      "enabled": true
    }
  },
  "metabob": {
    "cli_path": "metabob-cli",
    "base_url": "http://api.metabob.local",
    "api_key": "mb_devbob_test_simple_2026_v2",
    "auto_inject": true,
    "template_registration": {
      "auto_register": false,
      "default_category": "feature"
    }
  }
}
```

**Key Settings**:
- `auto_inject: true` - Enables MCP auto-configuration (was missing before)
- `auto_register: false` - Templates registered explicitly, not on every save
- `METABOB_API_URL` env var - Ensures metabob-cli connects to correct RPC API

## Data Flow

### Template Registration Flow

```
Developer creates template
         ↓
TemplateLibrary.save()
         ↓
MetabobCLI.registerActivityTemplate()
         ↓
MCP tool: metabob_register_activity_template
         ↓
ActivityManager._post_template()
         ↓
POST http://api.metabob.local/v2/activities/templates
    Headers: Authorization: Bearer {session_token}
         ↓
RPC API validates & stores
         ↓
SurrealDB: activity_template_variant table
```

**No local JSON files are written** (architectural constraint enforced in code).

### Template Retrieval Flow

```
Activity execution starts
         ↓
search_activities({ category })
         ↓
MCP tool: metabob_search_activities
         ↓
ActivityManager.list_templates()
         ↓
GET http://api.metabob.local/v2/activities/templates?category=feature
    Headers: Authorization: Bearer {session_token}
         ↓
RPC API queries SurrealDB
         ↓
Returns templates with metrics (success rate, avg cost, duration)
```

### Execution Tracking Flow (Idempotency Learning)

```
Activity starts
         ↓
Capture input impulses: [impulse_id1, impulse_id2, ...]
         ↓
Execute tasks (with LLM calls)
         ↓
Track deviations (trailblazing, recovery)
         ↓
Capture output impulses: [created_impulse1, ...]
         ↓
Record execution:
  - execution_id
  - impulses_loaded
  - impulses_created
  - tool_calls (LLM interactions)
  - component_changes (file modifications)
  - cost, duration, success
         ↓
POST http://api.metabob.local/v2/activities/executions
         ↓
Backend analyzes patterns:
  - Which impulses predict success?
  - Which steps are deterministic?
  - Where can LLM calls be eliminated?
```

**Learning Loop**: Over time, analyze execution history to identify deterministic transformations and build cached execution paths.

## Architectural Boundaries

### What metabob-opencode DOES

✅ Execute activity templates  
✅ Manage session context (impulses, working memory)  
✅ Interface with LLM for task execution  
✅ Track file changes and tool usage  
✅ Report execution results to backend  

### What metabob-opencode DOES NOT DO

❌ Store activity templates locally (except cache)  
❌ Implement template storage logic  
❌ Manage template versioning  
❌ Calculate learning metrics  
❌ Decide which templates to use (Thompson Sampling in backend)  

### What metabob-cli MCP DOES

✅ Provide MCP tools for template management  
✅ Proxy template requests to RPC API  
✅ Manage session tokens (authentication)  
✅ Maintain optimistic cache for performance  

### What metabob-cli MCP DOES NOT DO

❌ Execute activity tasks (that's opencode's job)  
❌ Store templates permanently (that's RPC API's job)  
❌ Make learning decisions (that's backend's job)  

### What metabob-rpc-api DOES

✅ Store activity templates in SurrealDB  
✅ Track execution metrics (success rate, cost, duration)  
✅ Implement Thompson Sampling for template selection  
✅ Provide learning loop analytics  
✅ Manage template versioning and variants  

## Validation

### Connectivity Test

```bash
# Test RPC API health
curl -s http://api.metabob.local/ | jq .
# Expected: {"status":"ok","timestamp":"...","version":"0.16.4"}

# Test authenticated template list
curl -s -H "Authorization: Bearer mb_devbob_test_simple_2026_v2" \
  http://api.metabob.local/v2/activities/templates | jq .
# Expected: {"templates":[...]}
```

### MCP Connectivity Test

```bash
# From within opencode session
cd repos/metabob-opencode
opencode
> test_metabob_mcp()
# Expected: Status: ✅ CONNECTED
```

### Template Flow Test

```bash
# Register a template via MCP
cd repos/metabob-opencode
opencode
> # Create a simple activity template
> # Call register_activity_template()
> # Verify it appears in search_activities()
```

## Migration Path to Distributed Execution

### Current State (Single Host)

- All repos in `repos/*` on single machine
- metabob-cli MCP runs on host
- RPC API in Kubernetes cluster
- SurrealDB persistent in cluster

### Future State (Distributed Devbob Containers)

Each devbob container:
- Runs metabob-opencode (isolated execution)
- Connects to shared RPC API via service mesh
- Templates served from centralized backend
- Execution results tracked for learning

**Idempotency Requirement**: Given impulses `[I1, I2, I3]`, activity execution in ANY container produces same result (file changes, artifacts).

**Learning Process**:
1. Track all executions: `(impulses_in, execution_trace, artifacts_out)`
2. Identify patterns: "impulses X always lead to transformation Y"
3. Cache deterministic paths: Skip LLM, apply transformation directly
4. Measure improvement: 10x faster, 90% cheaper for learned patterns

## Implementation Status

- [x] Configure MCP connection (auto_inject: true)
- [x] Remove legacy local template JSON files (197 files archived)
- [x] Enforce "no local writes" constraint in code
- [x] Verify RPC API connectivity (api.metabob.local)
- [x] Validate MCP → RPC API flow
- [ ] Implement execution tracking (impulses_loaded, impulses_created)
- [ ] Add deviation capture (trailblazing events)
- [ ] Build learning analytics dashboard
- [ ] Implement cached execution paths

## Next Steps

### Immediate (Phase 1)

1. **Validate End-to-End Flow**
   - Create test template via CLI
   - Register via MCP
   - Retrieve in activity execution
   - Verify storage in SurrealDB

2. **Add Execution Tracking**
   - Capture impulses_loaded at activity start
   - Track impulses_created during execution
   - Record tool_calls (LLM interactions)
   - Store execution metadata in RPC API

### Short-term (Phase 2)

3. **Implement Learning Analytics**
   - Query execution history by template_id
   - Calculate success rates by impulse patterns
   - Identify deterministic vs. non-deterministic steps
   - Visualize cost/time trends

4. **Test in Distributed Environment**
   - Deploy devbob containers (3+ instances)
   - Execute same activity in different containers
   - Verify consistent results (idempotency)
   - Measure deviation rates

### Long-term (Phase 3)

5. **Build Cached Execution Paths**
   - Identify high-confidence deterministic transformations
   - Implement cache lookup: `(impulses) → (transformations)`
   - Skip LLM calls for cached patterns
   - Measure 10x speedup, 90% cost reduction

6. **Enable Self-Evolution**
   - Activities learn from execution history
   - Templates auto-improve based on metrics
   - New templates generated for novel patterns
   - System becomes increasingly autonomous

## References

- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` - Template registration enforcement (line 803-813)
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` - ActivityManager implementation
- `repos/metabob-rpc-api/server/routes/activity.py` - RPC API endpoints
- `.archive/legacy-local-templates-20260304/` - Archived legacy template files

## Glossary

- **Impulse**: Reusable context unit (file, analysis, pattern, memo)
- **Activity Template**: Multi-step workflow specification
- **Idempotency**: Same inputs → Same outputs (deterministic execution)
- **Learning Loop**: Track executions → Analyze patterns → Optimize templates
- **Trailblazing**: AI-generated recovery steps when validation fails
- **Thompson Sampling**: Bandit algorithm for template selection (exploration vs. exploitation)
