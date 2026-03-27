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
