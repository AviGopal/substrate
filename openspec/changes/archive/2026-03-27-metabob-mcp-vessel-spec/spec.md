# metabob-mcp Vessel Specification

> **Aligned with**: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`

## Executive Summary

metabob-mcp is designed to be a **bridge vessel** that translates traditional software development workflows into the activity/impulse/vessel paradigm. The current implementation has well-architected shells but lacks data pipelines to populate them.

This spec defines the work needed to make metabob-mcp provide real value as a vessel.

---

## Foundation Alignment

### Key Principles Applied

| Principle | Application in this Vessel |
|-----------|---------------------------|
| **Resolvers live where data lives** | CPG lives in vessel memory (session-scoped), not backend |
| **Backend is trace store** | Analysis-api stores execution traces + learns patterns |
| **LLMs are tools, not controllers** | Tools use LLM as one resolver among many |
| **Record everything** | Every tool execution creates an execution trace |
| **Activities constrain search** | Tools map to activities in the activity registry |

### Critical Boundaries

```
metabob-mcp (VESSEL)                    metabob-analysis-api (BACKEND)
═══════════════════                     ════════════════════════════════
CPG in session memory                   ❌ CPG (NOT stored in backend)
Embedding generation (local)            ❌ Embeddings (NOT generated in backend)
File access (resolver)                  ✓ Execution traces (stored)
Code analysis (transient)               ✓ Learned patterns (stored)
Tool execution                          ✓ Thompson Sampling (computed)
                                        ✓ Impulse relevance (computed)
```

**Why this matters:**

> "The backend is NOT a universal resolver. It is: A Trace Store + Pattern Learner"

CPG analysis and embeddings require access to code. The code lives in the vessel's environment. Therefore these resolvers belong in the vessel, not the backend.

---

## Current State Assessment

### What Works (Keep As-Is)

| Component | Location | Status |
|-----------|----------|--------|
| MCP Server Infrastructure | `metabob-mcp/src/index.ts` | ✅ Production-ready |
| Rate Limiting | `metabob-mcp/src/rate-limiter.ts` | ✅ Working |
| Circuit Breaker | `metabob-mcp/src/circuit-breaker.ts` | ✅ Working |
| API Client with Auth | `metabob-mcp/src/api-client.ts` | ✅ Auto-refresh working |
| 7 MCP Tools (structure) | `metabob-mcp/src/tools/*.ts` | ✅ Well-designed |
| CPG Service | `metabob-analysis-api/src/services/cpg-service.ts` | ✅ Functional |
| Learning Service | `metabob-analysis-api/src/services/learning-service.ts` | ✅ Functional |
| Thompson Sampling | `metabob-activity-api/src/routes/activities.ts` | ✅ Working |

### What's Broken or Missing

| Issue | Location | Problem | Impact |
|-------|----------|---------|--------|
| Annotations not persisted | `annotations.ts:64` | TODO comment, no INSERT | Data lost |
| Embedding service is mock | `embedding-service.ts:66` | PRNG instead of ONNX | Fake similarity |
| No problem detection | `analysis_problems` table | No INSERT code | Empty table |
| Type mismatch in spec gen | `specs.ts` vs tool | Different response structure | Tool crashes |
| CPG not auto-indexed | `/v2/analysis/index` | Must call manually | Empty graph |
| cochange_patterns empty | Learning service | No git history extraction | No patterns |
| No feedback loop | `session-manager.ts` | Tracks locally, forgets | No learning |

---

## Value Creation Points

The tools transform data at specific points. Here's where real value is created:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     VALUE CREATION BY TOOL                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  REAL VALUE (algorithms that work if data exists):                      │
│  ├─ ONNX embedding inference (suggest_related_changes)                  │
│  │   └─ predictor.ts:153-217                                           │
│  │   └─ Requires: CPG indexed                                          │
│  │                                                                      │
│  ├─ Graph traversal DFS (analyze_change_impact)                         │
│  │   └─ graph.ts:132-181                                               │
│  │   └─ Requires: CPG indexed with CALLS edges                         │
│  │                                                                      │
│  └─ Database UPDATE (mark_problem_complete)                             │
│      └─ problems.ts:375-389                                            │
│      └─ Requires: Problems to exist                                    │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SYNTHETIC VALUE (heuristics when data missing):                        │
│  ├─ Complexity scoring (get_priority_issues)                            │
│  │   └─ LOC>50, complexity>10, params>5                                │
│  │                                                                      │
│  ├─ String matching (search_codebase)                                   │
│  │   └─ NOT semantic - pure substring                                  │
│  │                                                                      │
│  └─ Pattern detection (generate_implementation_spec)                    │
│      └─ Name contains "factory", "singleton", etc.                     │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  NO VALUE (broken/stub):                                                │
│  ├─ annotate_component → TODO comment, never persists                   │
│  ├─ generate_implementation_spec → Type mismatch                        │
│  ├─ Historical cochange patterns → Table empty                          │
│  └─ analysis_problems → No INSERT code                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Boundaries

### Data Flow Requirements

```
External Inputs (git, filesystem, user actions)
        ↓
metabob-mcp (MCP Protocol Layer)
  ├─ Tool Registry (7 tools with Zod validation)
  ├─ API Client (HTTP with auth, retry, circuit breaker)
  └─ Session Manager (usage tracking)
        ↓ HTTP POST/GET/PUT with X-Session-ID
metabob-analysis-api (Backend)
  ├─ Routes (/v2/analysis/*)
  ├─ CPG Service (in-memory, session-scoped)
  ├─ Learning Service (pattern updates)
  └─ SurrealDB (persistence)
        ↓
Learning Loop (Thompson Sampling, impulse relevance)
```

### RBAC Constraints

| Level | Identifier | Data Isolation |
|-------|------------|----------------|
| Global | `scope='global', public=true` | Visible to all |
| Org | `org_id` from JWT | Per-org isolation |
| Project | `project_id` from JWT | Per-project isolation |
| Session | `session_id` header | Transient (Redis) |

**Key Constraints:**
- Learning data CANNOT share across orgs (SurrealDB PERMISSIONS enforce)
- Global patterns require explicit `public=true` marking
- CPG data is fully isolated per org (code sensitivity)
- Minimal auth: single org + MiniBob instance sufficient for MVP

---

## Bridge Philosophy

metabob-mcp bridges traditional development to the activity/impulse paradigm:

1. **Non-Invasive Observation**: Tools observe without interrupting workflow
2. **Gradual Value Demonstration**: Immediate practical utility before paradigm adoption
3. **Respect for Existing Workflows**: Augments git/IDE, never replaces
4. **Build Trust Through Transparency**: Confidence scores and reasoning shown

### Mapping Traditional Dev → Impulse Paradigm

| Traditional Action | MCP Tool | Impulse Pattern |
|-------------------|----------|-----------------|
| Incomplete changes | `suggest_related_changes` | Co-change context impulse |
| Code review prep | `analyze_change_impact` | Change impact impulse |
| Bug tracking | `mark_problem_complete` | Problem→solution trace |
| Planning features | `generate_implementation_spec` | Goal impulse → activity |
| Finding similar code | `search_codebase` | Query impulse |

---

## Common Patterns to Colocate

### Identified Duplications

| Pattern | metabob-mcp | metabob-analysis-api | Consolidation |
|---------|-------------|----------------------|---------------|
| Rate Limiting | `rate-limiter.ts` (87 LOC) | `middleware/rate-limit.ts` (100+ LOC) | `@metabob/rate-limit` |
| Circuit Breaker | `circuit-breaker.ts` (118 LOC) | Missing | Add to analysis-api |
| Session Context | `session-manager.ts` (120 LOC) | `middleware/scope.ts` (80 LOC) | `@metabob/session-context` |
| Auth Token Refresh | `api-client.ts` (80 LOC) | Missing | `@metabob/auth-token` |
| Error Handling | Custom per tool | `middleware/error-handler.ts` | `@metabob/error-handling` |
| Validation Schemas | Per-tool Zod | Per-route Zod | `@metabob/validation` |

### Proposed Library Structure

```
libs/
├── @metabob/shared-types/      # Core types (AnalysisProblem, etc.)
├── @metabob/rate-limit/        # Pluggable rate limiting
├── @metabob/circuit-breaker/   # Resilience pattern
├── @metabob/auth/              # JWT, token refresh, scope
├── @metabob/validation/        # Shared Zod schemas
├── @metabob/error-handling/    # Protocol adapters
└── @metabob/analysis-service/  # Service interfaces
```

---

## Database Schema Status

### Actively Populated (Real Data)

| Table | Write Path | Read Path |
|-------|------------|-----------|
| `activity_registry` | `activities.ts:414` INSERT | Thompson Sampling |
| `activity_execution_traces` | `execution-traces.ts:479` INSERT | Dashboard, learning |
| `cochange_patterns` | `learning-service.ts:132` UPSERT | `cochange.ts` suggestions |
| `impulse_relevance_metrics` | `activities.ts:2199` UPDATE | Memory agent |
| `tool_usage` | `activities.ts:2523` UPDATE | Pattern analysis |

### Not Populated (Empty)

| Table | Issue | Fix Required |
|-------|-------|--------------|
| `analysis_problems` | No INSERT code | Add problem detection pipeline |
| `code_components` | CPG indexing stub | Implement real indexing |
| `impact_relations` | No write path | Graph persistence |
| `design_patterns` | Pattern service stub | AST-based detection |
| `annotations` | TODO comment | Uncomment INSERT |

---

## Implementation Milestones

### Milestone 1: Fix Critical Stubs (Week 1)

**Goal:** Make existing tools actually persist data

**Commits:**

1. **`fix(annotations): implement database persistence`**
   - Uncomment INSERT in `annotations.ts:64`
   - Add bidirectional RELATE for problem linking
   - Extract user_id from auth context
   - **Files:** `annotations.ts`, `problems.ts`
   - **Tests:** Verify annotation appears in DB after creation

2. **`fix(specs): align response types`**
   - Fix type mismatch between `specs.ts` and tool
   - Ensure `steps[]` array is returned (not `implementation_order`)
   - **Files:** `specs.ts`, `generate-implementation-spec.ts`
   - **Tests:** Tool no longer crashes on real response

3. **`feat(problems): add problem creation endpoint`**
   - Add POST `/v2/analysis/problems/create`
   - Accept severity, category, component_id, message
   - Persist to `analysis_problems` table
   - **Files:** `problems.ts`, new Zod schema
   - **Tests:** Created problems appear in `get_priority_issues`

**Testable State:** Annotations persist, specs work, problems can be created manually.

---

### Milestone 2: CPG Auto-Indexing (Week 2)

**Goal:** CPG has data without manual indexing

**Commits:**

4. **`feat(indexing): implement file indexing endpoint`**
   - Complete POST `/v2/analysis/index` route
   - Accept multipart file uploads or JSON file content
   - Pass to `cpgService.addFiles()`
   - Track indexing progress in session metadata
   - **Files:** `indexing.ts`, `cpg-service.ts`
   - **Tests:** After indexing, `analyze_change_impact` returns edges

5. **`feat(mcp): add workspace initialization tool`**
   - New tool: `initialize_workspace`
   - Scans git root for source files
   - Calls indexing endpoint with file contents
   - Reports indexing status
   - **Files:** New `init-workspace.ts` tool
   - **Tests:** Tool indexes workspace, subsequent queries return CPG data

6. **`feat(indexing): progressive sync on file change`**
   - Track file hashes in `progressive_sync_state`
   - Re-index only changed files
   - Auto-trigger on session start if workspace known
   - **Files:** `cpg-service.ts`, new sync logic
   - **Tests:** Edit file, verify CPG updated

**Testable State:** CPG has real data after workspace init.

---

### Milestone 3: Real Embeddings (Week 3)

**Goal:** Replace mock embeddings with ONNX model

**Commits:**

7. **`feat(embeddings): integrate ONNX model`**
   - Replace `mockEmbedding()` with real ONNX inference
   - Use `cpg-inference-ts` embedding model
   - Cache embeddings in Redis with TTL
   - **Files:** `embedding-service.ts`
   - **Tests:** Embedding vectors are consistent (not random)

8. **`feat(search): implement real semantic search`**
   - Replace `searchSimilar()` mock with FAISS query
   - Index components on indexing
   - Query by embedding distance
   - **Files:** `embedding-service.ts`, `search.ts`
   - **Tests:** Search returns semantically similar code

9. **`feat(cochange): hybrid scoring with real embeddings`**
   - Combine real embeddings with historical patterns
   - Weight: 60% embedding, 40% historical
   - **Files:** `cochange.ts`
   - **Tests:** Suggestions use both signals

**Testable State:** `search_codebase` and `suggest_related_changes` use real ML.

---

### Milestone 4: Learning Loop Integration (Week 4)

**Goal:** Tool usage feeds learning system

**Commits:**

10. **`feat(mcp): report tool usage to learning backend`**
    - After `suggest_related_changes`, call `/v2/analysis/learning/cochange`
    - Report changed_files to build patterns
    - **Files:** `suggest-related-changes.ts`, `api-client.ts`
    - **Tests:** Tool call creates cochange_patterns entry

11. **`feat(mcp): track predictions for feedback`**
    - Store predictions in session manager
    - On `mark_problem_complete`, compare predicted vs actual
    - Send feedback to `/v2/analysis/learning/feedback`
    - **Files:** `session-manager.ts`, `mark-problem-complete.ts`
    - **Tests:** Feedback updates pattern confidence

12. **`feat(mcp): output quality signals`**
    - When CPG not indexed, add warning to output
    - Show data availability (patterns count, CPG status)
    - Provide guidance on improving data quality
    - **Files:** All tool formatters
    - **Tests:** Empty CPG shows helpful message

**Testable State:** Tool usage improves future suggestions.

---

### Milestone 5: Shared Libraries (Week 5)

**Goal:** Extract common patterns to libraries

**Commits:**

13. **`refactor(types): extract @metabob/shared-types`**
    - Move `AnalysisProblem`, `ComponentAnnotation`, etc.
    - Create package in `libs/shared-types`
    - Update imports in both services
    - **Files:** New package, update imports
    - **Tests:** Both services build and pass tests

14. **`refactor(auth): extract @metabob/auth`**
    - Move rate limiter, circuit breaker, token refresh
    - Pluggable backends (memory/Redis)
    - **Files:** New packages, update imports
    - **Tests:** Equivalent behavior after refactor

15. **`refactor(validation): extract @metabob/validation`**
    - Base Zod schemas (pagination, filters)
    - Error formatters
    - **Files:** New package, update tool/route schemas
    - **Tests:** Validation behavior unchanged

**Testable State:** Clean separation, no code duplication.

---

### Milestone 6: Multi-Tenant Hardening (Week 6)

**Goal:** Ensure org isolation is bulletproof

**Commits:**

16. **`feat(auth): add project-scoped filtering`**
    - Extract project_ids from JWT
    - Add PERMISSIONS for project-level isolation
    - **Files:** Schema files, middleware
    - **Tests:** Cross-project queries return empty

17. **`feat(public): implement public template sharing`**
    - Allow marking templates as `public=true`
    - Add `/v2/activities/public` endpoint (no auth)
    - **Files:** `activities.ts`, new route
    - **Tests:** Public templates visible to all orgs

18. **`docs: update multi-tenant architecture guide`**
    - Document scoping hierarchy
    - RBAC patterns and examples
    - API key provisioning flow
    - **Files:** `docs/MULTI_TENANT_ARCHITECTURE.md`

**Testable State:** Full multi-tenant isolation with public template sharing.

---

## Task List Summary

| # | Task | Milestone | Effort | Dependencies |
|---|------|-----------|--------|--------------|
| 1 | Implement annotation persistence | M1 | Trivial | None |
| 2 | Fix spec response types | M1 | Trivial | None |
| 3 | Add problem creation endpoint | M1 | Moderate | None |
| 4 | Implement file indexing endpoint | M2 | Moderate | None |
| 5 | Add workspace initialization tool | M2 | Moderate | Task 4 |
| 6 | Progressive sync on file change | M2 | Moderate | Task 4 |
| 7 | Integrate ONNX model | M3 | Significant | Task 4 |
| 8 | Implement real semantic search | M3 | Moderate | Task 7 |
| 9 | Hybrid scoring with real embeddings | M3 | Moderate | Task 7 |
| 10 | Report tool usage to learning | M4 | Moderate | None |
| 11 | Track predictions for feedback | M4 | Moderate | Task 10 |
| 12 | Output quality signals | M4 | Trivial | None |
| 13 | Extract @metabob/shared-types | M5 | Moderate | None |
| 14 | Extract @metabob/auth | M5 | Moderate | Task 13 |
| 15 | Extract @metabob/validation | M5 | Moderate | Task 13 |
| 16 | Add project-scoped filtering | M6 | Moderate | None |
| 17 | Implement public template sharing | M6 | Moderate | None |
| 18 | Update multi-tenant docs | M6 | Trivial | Tasks 16-17 |

---

## Success Criteria

### Milestone 1 Complete When:
- [ ] Annotations persist to database and can be queried
- [ ] `generate_implementation_spec` returns valid steps array
- [ ] `mark_problem_complete` works on manually created problems

### Milestone 2 Complete When:
- [ ] `initialize_workspace` tool indexes TypeScript files
- [ ] `analyze_change_impact` returns real graph edges
- [ ] Re-indexing only processes changed files

### Milestone 3 Complete When:
- [ ] `search_codebase` returns semantically similar results
- [ ] `suggest_related_changes` uses embedding similarity
- [ ] Embedding cache prevents redundant ONNX calls

### Milestone 4 Complete When:
- [ ] Tool usage creates cochange_patterns entries
- [ ] Pattern confidence improves with usage feedback
- [ ] Output shows data quality warnings when appropriate

### Milestone 5 Complete When:
- [ ] Both services use shared type definitions
- [ ] Rate limiting uses common library
- [ ] No duplicate validation logic

### Milestone 6 Complete When:
- [ ] Cross-org queries return empty (verified by test)
- [ ] Public templates visible without auth
- [ ] Multi-tenant guide is comprehensive

---

## Appendix: Key File Locations

### metabob-mcp
- `src/index.ts` - MCP server entry
- `src/api-client.ts` - HTTP client with auth
- `src/tools/*.ts` - 7 MCP tools
- `src/session-manager.ts` - Usage tracking

### metabob-analysis-api
- `src/routes/*.ts` - API endpoints
- `src/services/cpg-service.ts` - CPG management
- `src/services/learning-service.ts` - Pattern learning
- `src/services/embedding-service.ts` - Mock (needs fix)
- `sql/schemas/*.surql` - Database schemas

### cpg-inference-ts
- `src/predictor.ts` - Co-change prediction
- `src/graph.ts` - Graph traversal
- `src/graph-builder.ts` - AST parsing

---

# Part 2: Vessel Architecture Transformation

> **Addition Date:** 2026-03-27
> **Purpose:** Transform metabob-mcp into a full vessel that provides activities, impulses, and lifecycle hooks

## Vessel Transformation Overview

The existing spec above focuses on fixing data pipelines. This section adds the **vessel layer** that makes MCP tools operate as activities within the impulse-driven architecture.

**Key Insight**: MCP tools ARE activities. Tool inputs ARE impulses. Tool outputs ARE impulses. The "double duty" pattern means:
- External: `run_goal` MCP tool → returns analysis results to IDE
- Internal: `run_goal` activity execution → produces impulses → recorded as traces → enables learning

---

## Consolidated Pattern Analysis

### Patterns to Colocate (from Subagent Analysis)

Based on exploration of MiniBob, metabob-activity-api, and existing metabob-mcp:

#### Pattern A: Activity Execution Wrapper
**Source**: MiniBob's `activity.ts`, `goal-processor.ts`
**Target**: `src/vessel/activity-wrapper.ts`
- Wraps MCP tool calls as activity executions
- Records execution traces automatically
- Handles improvisation fallback

#### Pattern B: Impulse Management Layer
**Source**: MiniBob's `impulse.ts`, `mcp.ts` (storeImpulse, resolveImpulse)
**Target**: `src/vessel/impulse-manager.ts`
- Creates impulses from tool inputs (goals, file paths, analysis results)
- Stores impulses in backend via MCPClient
- Resolves impulses for context injection

#### Pattern C: Session & Lifecycle Tracking
**Source**: MiniBob's `session.ts`, `lifecycle-hooks.ts`
**Target**: `src/vessel/session.ts`
- Tracks IDE session (start/end, tools used, traces)
- Lifecycle hooks: pre-tool, post-tool, session-complete
- Records execution sequences for learning

#### Pattern D: MCP Client Reuse
**Source**: MiniBob's `mcp.ts` (MCPClient class)
**Strategy**: Import from `@metabob/minibob` library
- Reuse MCPClient for backend communication
- Authentication via instance API key
- All trace submission, impulse storage, recommendations

---

## Vessel Architecture Layers

```
┌──────────────────────────────────────────────────────────────┐
│                     MCP Tool Interface                        │
│  (run_goal, get_problems, suggest_fixes, find_similar, ...)  │
└─────────────────────────────┬────────────────────────────────┘
                              │ Tool calls become activities
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Vessel Core Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │ ActivityWrapper │  │ ImpulseManager  │  │SessionManager│  │
│  │ (wraps tools)   │  │ (context mgmt)  │  │ (lifecycle)  │  │
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘  │
│           └──────────────┬─────┴──────────────────┘          │
│                          ▼                                    │
│              ┌───────────────────────┐                       │
│              │   MCPClient (shared)  │                       │
│              │   from @metabob/minibob│                      │
│              └───────────┬───────────┘                       │
└──────────────────────────┼───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                  metabob-activity-api                         │
│  (traces, impulses, Thompson Sampling, pattern learning)     │
└──────────────────────────────────────────────────────────────┘
```

---

## Tool → Activity → Impulse Mapping

| MCP Tool | Input Impulse Shape | Output Impulse Shape | Activity Category |
|----------|---------------------|---------------------|-------------------|
| `run_goal` | `goal` | `trace`, `analysis` | feature/bugfix/refactor |
| `get_priority_issues` | `source_code`, `file_path` | `problem_list` | analysis |
| `suggest_related_changes` | `source_code`, `file_path` | `cochange_suggestion` | analysis |
| `analyze_change_impact` | `source_code`, `file_path` | `impact_graph` | analysis |
| `search_codebase` | `query`, `context` | `search_results` | exploration |
| `generate_implementation_spec` | `requirement`, `context` | `spec` | planning |
| `annotate_component` | `component`, `annotation` | `annotation` | documentation |
| `mark_problem_complete` | `problem_id` | `resolution` | bugfix |

---

## Data Flow: Tool Call → Activity → Impulses

```
1. IDE calls MCP tool (e.g., run_goal)
   ↓
2. Tool handler creates input impulse(s)
   - shape: "goal" with user's intent
   - shape: "source_code" with file context
   ↓
3. ActivityWrapper wraps as activity execution
   - template_id: "mcp-tool/run_goal"
   - variables: { goal, workspace_path, ... }
   ↓
4. Execute tool logic (existing implementation)
   ↓
5. Create output impulse(s) from results
   - shape: "trace" with execution details
   - shape: "analysis" with findings
   ↓
6. Store trace in backend
   - MCPClient.storeExecutionTrace()
   - Enables Thompson Sampling for future recommendations
   ↓
7. Return result to IDE
```

---

## Session Lifecycle

```
Session Start (IDE connects)
├── Create session record
├── Load relevant impulses from backend
│   └── Recent traces, patterns, user preferences
├── Register lifecycle hooks
│   └── pre-tool, post-tool, error handlers
│
Tool Execution (repeated)
├── pre-tool hook: Create input impulses
├── Execute tool
├── post-tool hook: Create output impulses, store trace
│
Session End (IDE disconnects)
├── Record execution sequence
├── Persist session statistics
└── Archive low-priority impulses
```

---

## Vessel Implementation Components

### Reuse from @metabob/minibob (Import)

| Component | Module | Purpose |
|-----------|--------|---------|
| `MCPClient` | mcp.ts | Backend communication |
| `createImpulse` | impulse.ts | Create impulse objects |
| `formatImpulsesForContext` | impulse.ts | Format for LLM context |
| `LifecycleHooks` | lifecycle-hooks.ts | Hook registration/execution |
| `ActivityExecution` type | types.ts | Execution trace structure |
| `Impulse` type | types.ts | Impulse structure |

### New Components for metabob-mcp (Create)

| Component | File | Responsibility |
|-----------|------|----------------|
| `VesselCore` | src/vessel/core.ts | Initialize vessel, manage lifecycle |
| `ActivityWrapper` | src/vessel/activity-wrapper.ts | Wrap tool calls as activities |
| `ImpulseManager` | src/vessel/impulse-manager.ts | Create/resolve impulses |
| `SessionManager` | src/vessel/session.ts | Track IDE sessions (enhanced) |
| `ToolActivityRegistry` | src/vessel/registry.ts | Map tools to activity templates |

### Modified Existing Files

| File | Modification |
|------|--------------|
| `src/tools/*.ts` | Add activity wrapper calls |
| `src/index.ts` | Initialize vessel on startup |
| `src/types.ts` | Add vessel-related types |

---

## Vessel Commit Milestones

### Milestone V1: Foundation (Testable State)
**Commit**: `feat(metabob-mcp): add vessel foundation with MCPClient integration`

**Tasks**:
1. Add `@metabob/minibob` dependency to package.json
2. Create `src/vessel/core.ts` - VesselCore initialization
3. Create `src/vessel/types.ts` - Vessel-specific types
4. Create `src/vessel/index.ts` - Barrel exports
5. Modify `src/index.ts` - Initialize vessel on server start
6. Add authentication via instance API key

**Test**: Server starts, authenticates with backend, registers as vessel

**Estimated LOC**: ~200 new lines

---

### Milestone V2: Impulse Management (Testable State)
**Commit**: `feat(metabob-mcp): add impulse management for tool inputs/outputs`

**Tasks**:
1. Create `src/vessel/impulse-manager.ts`
   - `createToolInputImpulse(tool, params)`
   - `createToolOutputImpulse(tool, result)`
   - `resolveImpulse(pointer)`
2. Create `src/vessel/shapes.ts` - Shape definitions for MCP tools
3. Add impulse creation to one handler (e.g., `run_goal`)

**Test**: `run_goal` creates input/output impulses, visible in backend

**Estimated LOC**: ~250 new lines

---

### Milestone V3: Activity Wrapper (Testable State)
**Commit**: `feat(metabob-mcp): wrap tool calls as activity executions`

**Tasks**:
1. Create `src/vessel/activity-wrapper.ts`
   - `wrapToolCall(tool, params, handler)`
   - `recordExecution(execution)`
2. Create `src/vessel/registry.ts` - Tool → Activity mapping
3. Wrap `run_goal` handler with activity tracking
4. Store execution traces to backend

**Test**: `run_goal` execution appears in activity-dashboard

**Estimated LOC**: ~300 new lines

---

### Milestone V4: Session Tracking (Testable State)
**Commit**: `feat(metabob-mcp): add session lifecycle management`

**Tasks**:
1. Enhance `src/vessel/session.ts`
   - `createSession()`
   - `recordToolExecution()`
   - `completeSession()`
2. Add session ID to all tool executions
3. Record execution sequences on session end

**Test**: Session creates, tools execute within session, sequence recorded

**Estimated LOC**: ~200 new lines

---

### Milestone V5: Lifecycle Hooks (Testable State)
**Commit**: `feat(metabob-mcp): add lifecycle hooks for tool execution`

**Tasks**:
1. Import `LifecycleHooks` from @metabob/minibob
2. Register hooks in VesselCore
3. Call `onBeforePrompt` before tool execution
4. Call `onAfterPrompt` after tool execution
5. Call `onActivityComplete` for successful tools

**Test**: Hooks fire, can observe in logs, metrics captured

**Estimated LOC**: ~150 new lines

---

### Milestone V6: Full Integration (All Tools)
**Commit**: `feat(metabob-mcp): integrate all MCP tools with vessel system`

**Tasks**:
1. Wrap all tool handlers with activity wrapper
2. Define shapes for each tool's input/output
3. Add tool-specific activity templates
4. Enable Thompson Sampling recommendations

**Test**: All tools create traces, recommendations work

**Estimated LOC**: ~400 new lines (mostly boilerplate per tool)

---

### Milestone V7: Learning Integration (Complete)
**Commit**: `feat(metabob-mcp): enable learning from tool executions`

**Tasks**:
1. Record impulse relevance for tool contexts
2. Record tool usage patterns
3. Record composition (tool → tool sequences)
4. Test recommendation improvements

**Test**: Repeated tool use improves recommendations

**Estimated LOC**: ~200 new lines

---

## Reorganized Master Task List

Combining the original milestones (M1-M6) with vessel milestones (V1-V7):

### Phase 1: Critical Fixes (Must Complete First)
| ID | Task | Milestone | Effort | Dependencies |
|----|------|-----------|--------|--------------|
| 1 | Implement annotation persistence | M1 | Trivial | None |
| 2 | Fix spec response types | M1 | Trivial | None |
| 3 | Add problem creation endpoint | M1 | Moderate | None |

### Phase 2: Vessel Foundation (Enables Learning)
| ID | Task | Milestone | Effort | Dependencies |
|----|------|-----------|--------|--------------|
| 4 | Add @metabob/minibob dependency | V1 | Trivial | None |
| 5 | Create VesselCore initialization | V1 | Moderate | Task 4 |
| 6 | Add vessel authentication | V1 | Moderate | Task 5 |
| 7 | Create ImpulseManager | V2 | Moderate | Task 5 |
| 8 | Define tool impulse shapes | V2 | Moderate | Task 7 |
| 9 | Create ActivityWrapper | V3 | Moderate | Task 7 |
| 10 | Create ToolActivityRegistry | V3 | Moderate | Task 9 |

### Phase 3: CPG & Data Pipeline (Parallel Track)
| ID | Task | Milestone | Effort | Dependencies |
|----|------|-----------|--------|--------------|
| 11 | Implement file indexing endpoint | M2 | Moderate | None |
| 12 | Add workspace initialization tool | M2 | Moderate | Task 11 |
| 13 | Progressive sync on file change | M2 | Moderate | Task 11 |
| 14 | Integrate ONNX model | M3 | Significant | Task 11 |
| 15 | Implement real semantic search | M3 | Moderate | Task 14 |

### Phase 4: Full Vessel Integration
| ID | Task | Milestone | Effort | Dependencies |
|----|------|-----------|--------|--------------|
| 16 | Enhance session lifecycle | V4 | Moderate | Task 9 |
| 17 | Add lifecycle hooks | V5 | Moderate | Task 16 |
| 18 | Wrap all tools with activity | V6 | Moderate | Task 17 |
| 19 | Enable Thompson Sampling | V6 | Moderate | Task 18 |
| 20 | Record impulse relevance | V7 | Moderate | Task 19 |
| 21 | Record tool usage patterns | V7 | Moderate | Task 19 |

### Phase 5: Learning Loop & Polish
| ID | Task | Milestone | Effort | Dependencies |
|----|------|-----------|--------|--------------|
| 22 | Report tool usage to learning | M4 | Moderate | Task 21 |
| 23 | Track predictions for feedback | M4 | Moderate | Task 22 |
| 24 | Output quality signals | M4 | Trivial | None |
| 25 | Extract @metabob/shared-types | M5 | Moderate | None |
| 26 | Extract @metabob/auth | M5 | Moderate | Task 25 |
| 27 | Add project-scoped filtering | M6 | Moderate | None |
| 28 | Implement public template sharing | M6 | Moderate | None |

---

## Success Criteria (Vessel Layer)

### Milestone V1 Complete When:
- [ ] metabob-mcp starts and authenticates with metabob-activity-api
- [ ] Vessel registration appears in activity-dashboard
- [ ] MCPClient from minibob library is properly initialized

### Milestone V2 Complete When:
- [ ] `run_goal` creates input impulse with shape="goal"
- [ ] `run_goal` creates output impulse with shape="trace"
- [ ] Impulses visible in backend via /v2/impulses endpoint

### Milestone V3 Complete When:
- [ ] `run_goal` execution appears in activity_execution_traces table
- [ ] Execution visible in activity-dashboard
- [ ] template_id is "mcp-tool/run_goal"

### Milestone V4 Complete When:
- [ ] Sessions have unique IDs persisted across tool calls
- [ ] Execution sequences recorded on session end
- [ ] Session statistics visible in backend

### Milestone V5 Complete When:
- [ ] onBeforePrompt fires before tool execution
- [ ] onAfterPrompt fires after tool execution
- [ ] Hook errors are non-blocking (tool still completes)

### Milestone V6 Complete When:
- [ ] All 8 MCP tools create execution traces
- [ ] All tools have defined input/output shapes
- [ ] Thompson Sampling can recommend tools for goals

### Milestone V7 Complete When:
- [ ] Impulse relevance scores update with tool usage
- [ ] Tool usage patterns recorded in tool_usage table
- [ ] Repeated tool use shows improved recommendations

---

## Risk Mitigation

### Risk 1: Circular Dependencies
**Mitigation**: Import MCPClient directly from minibob, don't import MiniBob wholesale

### Risk 2: Performance Overhead
**Mitigation**: Async trace recording, don't block tool responses

### Risk 3: Backend Unavailability
**Mitigation**: Graceful degradation - tools work without vessel features

### Risk 4: Type Mismatches
**Mitigation**: Share types via @metabob/minibob package exports

### Risk 5: Breaking Existing Tools
**Mitigation**: Activity wrapper is additive, no changes to tool logic

---

## Total Estimates

| Metric | Value |
|--------|-------|
| New lines of code (vessel) | ~1,700 LOC |
| New lines of code (fixes) | ~1,500 LOC |
| Reused from MiniBob | ~3,500+ LOC |
| Files created | ~15 files |
| Files modified | ~15 files |
| Commit milestones | 13 total (6 original + 7 vessel) |
| Test coverage | Each milestone testable |
