# metabob-mcp Vessel Implementation Tasks

## Milestone 1: Fix Critical Stubs
**Target:** Week 1 | **State After:** Annotations persist, specs work, problems creatable

### Task 1.1: Implement Annotation Persistence
- [x] **File:** `repos/metabob-analysis-api/src/routes/annotations.ts`
- [x] Uncomment/implement INSERT at line 64
- [x] Add RELATE clause for bidirectional problem linking (line 60)
- [x] Extract `created_by` from `$auth.id` instead of hardcoded `'system'`
- [x] Add component validation against CPG (optional, with fallback)
- [ ] **Test:** Create annotation via API, verify in SurrealDB

**Commit:** `fix(annotations): implement database persistence`

### Task 1.2: Fix Spec Response Types
- [x] **File:** `repos/metabob-analysis-api/src/routes/specs.ts`
- [x] Change `implementation_order: string[]` to `steps: ImplementationStep[]`
- [x] Generate `spec_id` with `crypto::random::uuid()`
- [x] Add `overview` field (summary of goal analysis)
- [x] Add `estimated_effort` calculation
- [x] Add `risks` array extraction
- [x] **File:** `repos/metabob-mcp/src/tools/generate-implementation-spec.ts`
- [x] Update `formatAsText` to handle new structure
- [ ] **Test:** Tool returns formatted steps, not raw component IDs

**Commit:** `fix(specs): align response types between backend and tool`

### Task 1.3: Add Problem Creation Endpoint
- [x] **File:** `repos/metabob-analysis-api/src/routes/problems.ts`
- [x] Add POST `/` route for problem creation
- [x] Input schema: `{ component_id, severity, category, message, impact_score? }`
- [x] Auto-populate `org_id` from `$auth.org_id`
- [x] Auto-populate `session_id`, `created_at`, `status='open'`
- [x] Return created problem with ID
- [ ] **Test:** POST creates problem, GET returns it

**Commit:** `feat(problems): add problem creation endpoint`

---

## Milestone 2: CPG Auto-Indexing
**Target:** Week 2 | **State After:** CPG has real data after workspace init

### Task 2.1: Implement File Indexing Endpoint
- [x] **File:** `repos/metabob-analysis-api/src/routes/indexing.ts`
- [x] Complete POST `/v2/analysis/index` implementation
- [x] Accept JSON body: `{ files: Record<string, string> }` (filename → content)
- [x] Call `cpgService.addFiles(sessionId, files)`
- [x] Return: `{ indexed: number, components: number, status: string }`
- [x] Add GET `/v2/analysis/status` for indexing progress
- [ ] **Test:** POST files, verify CPG status shows components

**Commit:** `feat(indexing): implement file indexing endpoint`

### Task 2.2: Add Workspace Initialization Tool
- [x] **File:** `repos/metabob-mcp/src/tools/init-workspace.ts` (new)
- [x] Input: `{ root_path?: string, patterns?: string[] }`
- [x] Default patterns: `["**/*.ts", "**/*.tsx", "**/*.js"]`
- [x] Exclude: `node_modules`, `.git`, `dist`
- [x] Read file contents, call `/v2/analysis/index`
- [x] Report progress and final component count
- [x] Register in `TOOL_REGISTRY`
- [ ] **Test:** Tool indexes workspace, subsequent CPG queries work

**Commit:** `feat(mcp): add workspace initialization tool`

### Task 2.3: Progressive Sync on File Change
- [ ] **File:** `repos/metabob-analysis-api/src/services/cpg-service.ts`
- [ ] Track file hashes in `progressive_sync_state` table
- [ ] On `addFiles()`, compare hashes to detect changes
- [ ] Only re-index changed files
- [ ] **File:** `repos/metabob-analysis-api/sql/schemas/022-annotations.surql`
- [ ] Verify `progressive_sync_state` schema is complete
- [ ] **Test:** Edit file, re-index, verify only changed file processed

**Commit:** `feat(indexing): progressive sync on file change`

---

## Milestone 3: Real Embeddings
**Target:** Week 3 | **State After:** Semantic search uses real ML

### Task 3.1: Integrate ONNX Model
- [ ] **File:** `repos/metabob-analysis-api/src/services/embedding-service.ts`
- [ ] Replace `mockEmbedding()` with real ONNX inference
- [ ] Import embedding generator from `cpg-inference-ts`
- [ ] Call `predictor.generateEmbedding(text)` or equivalent
- [ ] Cache embeddings in Redis with 24h TTL
- [ ] Add error handling for ONNX runtime failures
- [ ] **Test:** Same text produces same embedding (not random)

**Commit:** `feat(embeddings): integrate ONNX model for real embeddings`

### Task 3.2: Implement Real Semantic Search
- [ ] **File:** `repos/metabob-analysis-api/src/services/embedding-service.ts`
- [ ] Replace `searchSimilar()` mock with FAISS/usearch query
- [ ] Index embeddings on component indexing
- [ ] Query by cosine distance
- [ ] Return top-K with similarity scores
- [ ] **File:** `repos/metabob-analysis-api/src/routes/search.ts`
- [ ] Use real `embeddingService.searchSimilar()` instead of CPG name matching
- [ ] **Test:** Search "authentication" returns auth-related code

**Commit:** `feat(search): implement real semantic search with embeddings`

### Task 3.3: Hybrid Scoring with Real Embeddings
- [ ] **File:** `repos/metabob-analysis-api/src/routes/cochange.ts`
- [ ] Verify CPG predictions use real embeddings (from Task 3.1)
- [ ] Combine with historical patterns: `0.6 * embedding + 0.4 * frequency`
- [ ] Ensure both sources contribute to final score
- [ ] **Test:** Suggestions show both `embedding_similarity` and `historical_frequency`

**Commit:** `feat(cochange): hybrid scoring with real embeddings`

---

## Milestone 4: Learning Loop Integration
**Target:** Week 4 | **State After:** Tool usage improves future suggestions

### Task 4.1: Report Tool Usage to Learning Backend
- [ ] **File:** `repos/metabob-mcp/src/api-client.ts`
- [ ] Add `reportCochange(sessionId, changedFiles)` method
- [ ] Call `/v2/analysis/learning/cochange` endpoint
- [ ] **File:** `repos/metabob-mcp/src/tools/suggest-related-changes.ts`
- [ ] After handler returns, call `apiClient.reportCochange()`
- [ ] Non-blocking (don't wait for response)
- [ ] **Test:** Tool call creates `cochange_patterns` entry

**Commit:** `feat(mcp): report tool usage to learning backend`

### Task 4.2: Track Predictions for Feedback
- [ ] **File:** `repos/metabob-mcp/src/session-manager.ts`
- [ ] Add `trackPrediction(sessionId, { tool, predicted_files, timestamp })`
- [ ] Add `recordActualChanges(sessionId, actual_files)`
- [ ] Compare predicted vs actual, calculate accuracy
- [ ] **File:** `repos/metabob-mcp/src/tools/mark-problem-complete.ts`
- [ ] After marking complete, call `sessionManager.recordActualChanges()`
- [ ] Send feedback to `/v2/analysis/learning/feedback`
- [ ] **Test:** Feedback updates pattern confidence

**Commit:** `feat(mcp): track predictions and send feedback`

### Task 4.3: Output Quality Signals
- [ ] **File:** `repos/metabob-mcp/src/tools/*.ts` (all formatters)
- [ ] Check `cpg_status` in response
- [ ] If `'empty'`, add warning: "CPG not indexed - run init_workspace first"
- [ ] Show `components_analyzed` count
- [ ] Show `historical_patterns_found` for cochange tool
- [ ] Add guidance when data quality is low
- [ ] **Test:** Empty CPG shows helpful message

**Commit:** `feat(mcp): output quality signals in tool responses`

---

## Milestone 5: Shared Libraries
**Target:** Week 5 | **State After:** Clean separation, no code duplication

### Task 5.1: Extract @metabob/shared-types
- [ ] Create `libs/shared-types/` package structure
- [ ] Move from `metabob-analysis-api/src/models/types.ts`:
  - `AnalysisProblem`, `Severity`, `ProblemCategory`, `ProblemStatus`
  - `ComponentAnnotation`, `AnnotationType`
  - `ImpactAnalysisResult`, `ImpactedComponent`, `RiskLevel`
  - `CochangeSuggestion`, `CochangePattern`
- [ ] Move from `metabob-mcp/src/session-manager.ts`:
  - `SessionContext`, `Scope`, `ResolvedScope`
- [ ] Update imports in both services
- [ ] **Test:** Both services build and pass tests

**Commit:** `refactor(types): extract @metabob/shared-types package`

### Task 5.2: Extract @metabob/auth
- [ ] Create `libs/auth/` package structure
- [ ] Move rate limiter with pluggable backends
- [ ] Move circuit breaker
- [ ] Move token refresh logic
- [ ] Create factory functions
- [ ] Update both services to use package
- [ ] **Test:** Equivalent behavior after refactor

**Commit:** `refactor(auth): extract @metabob/auth package`

### Task 5.3: Extract @metabob/validation
- [ ] Create `libs/validation/` package structure
- [ ] Base schemas: `PaginationSchema`, `SeverityFilterSchema`, `CategoryFilterSchema`
- [ ] Error formatters for Zod errors
- [ ] Update tool and route schemas to extend base
- [ ] **Test:** Validation behavior unchanged

**Commit:** `refactor(validation): extract @metabob/validation package`

---

## Milestone 6: Multi-Tenant Hardening
**Target:** Week 6 | **State After:** Full multi-tenant isolation

### Task 6.1: Add Project-Scoped Filtering
- [ ] **File:** `repos/metabob-activity-api/src/middleware/auth.ts`
- [ ] Extract `project_ids` array from JWT claims
- [ ] **File:** SQL schemas
- [ ] Add PERMISSIONS: `WHERE project_id IN $auth.project_ids`
- [ ] Apply to `activity_execution_traces`, `cochange_patterns`
- [ ] **Test:** Cross-project queries return empty

**Commit:** `feat(auth): add project-scoped filtering`

### Task 6.2: Implement Public Template Sharing
- [ ] **File:** `repos/metabob-activity-api/src/routes/activities.ts`
- [ ] Add field: `public: boolean` to activity_registry
- [ ] Add GET `/v2/activities/public` endpoint (no auth required)
- [ ] Query: `WHERE scope = 'global' AND public = true`
- [ ] **File:** SQL schema
- [ ] Update PERMISSIONS: `FOR select WHERE org_id = $auth.org_id OR public = true`
- [ ] **Test:** Public templates visible without auth

**Commit:** `feat(public): implement public template sharing`

### Task 6.3: Update Multi-Tenant Documentation
- [ ] **File:** `docs/MULTI_TENANT_ARCHITECTURE.md`
- [ ] Document scoping hierarchy (global → org → project → session)
- [ ] RBAC patterns with code examples
- [ ] API key provisioning flow
- [ ] Session management
- [ ] Learning data isolation constraints
- [ ] **Test:** N/A (documentation)

**Commit:** `docs: update multi-tenant architecture guide`

---

## Verification Checklist

### After Milestone 1:
```bash
# Create annotation
curl -X POST http://api.metabob.local/v2/analysis/annotations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"component_id":"test::func::foo::1","content":"Test note","type":"todo"}'
# Verify in DB: SELECT * FROM annotations

# Generate spec
curl -X POST http://api.metabob.local/v2/analysis/specs/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"goal":"Add user auth"}'
# Verify: Response has "steps" array, not "implementation_order"
```

### After Milestone 2:
```bash
# Index files
curl -X POST http://api.metabob.local/v2/analysis/index \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"files":{"src/auth.ts":"function login() {}"}}'

# Check status
curl http://api.metabob.local/v2/analysis/status \
  -H "Authorization: Bearer $TOKEN"
# Verify: components_count > 0

# Analyze impact
curl -X POST http://api.metabob.local/v2/analysis/impact \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"changed_files":["src/auth.ts"]}'
# Verify: Returns edges, not empty
```

### After Milestone 3:
```bash
# Search semantically
curl -X POST http://api.metabob.local/v2/analysis/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"authentication security"}'
# Verify: Returns auth-related code with similarity scores

# Co-change with embeddings
curl -X POST http://api.metabob.local/v2/analysis/cochange/suggest \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"changed_files":["src/auth.ts"]}'
# Verify: embedding_similarity field is populated
```

### After Milestone 4:
```bash
# Check learning patterns
curl http://api.metabob.local/v2/analysis/learning/patterns \
  -H "Authorization: Bearer $TOKEN"
# Verify: Patterns exist from tool usage

# Check metrics
curl http://api.metabob.local/v2/analysis/learning/metrics \
  -H "Authorization: Bearer $TOKEN"
# Verify: total_events > 0
```

### After Milestone 6:
```bash
# Try cross-org access (should fail silently)
curl http://api.metabob.local/v2/activities/templates \
  -H "Authorization: Bearer $OTHER_ORG_TOKEN"
# Verify: Returns only other org's templates (or empty)

# Public templates without auth
curl http://api.metabob.local/v2/activities/public
# Verify: Returns global public templates
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| ONNX runtime issues | Test on target platforms, provide fallback |
| Breaking API changes | Version endpoints, deprecation warnings |
| Memory pressure from CPG | Implement LRU eviction, serialize large graphs |
| Cross-org data leaks | SurrealDB PERMISSIONS, not app-level filtering |
| Token refresh failures | Exponential backoff, clear error messages |
