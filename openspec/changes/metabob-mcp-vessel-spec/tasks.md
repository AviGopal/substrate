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
- [x] **File:** `repos/metabob-analysis-api/src/services/cpg-service.ts`
- [x] Track file hashes in memory per session (SHA-256, 16-char prefix)
- [x] On `addFilesProgressive()`, compare hashes to detect changes
- [x] Only re-index changed files
- [x] **File:** `repos/metabob-analysis-api/src/routes/indexing.ts`
- [x] Add `progressive` parameter to IndexFilesRequestSchema
- [x] Route to `cpgService.addFilesProgressive()` when enabled
- [x] Return detailed sync statistics (changed/unchanged/skipped)
- [ ] **Test:** Edit file, re-index, verify only changed file processed

**Commit:** `feat(indexing): progressive sync on file change`

---

## Milestone 3: Real Embeddings
**Target:** Week 3 | **State After:** Semantic search uses real ML

### Task 3.1: Integrate ONNX Model
- [x] **File:** `repos/metabob-analysis-api/src/services/embedding-service.ts`
- [x] Replace `mockEmbedding()` with real ONNX inference via `ONNXEmbeddingModel`
- [x] Import embedding generator from `cpg-inference-ts`
- [x] Call `embeddingModel.infer(features)` with text-to-features conversion
- [x] Cache embeddings in Redis with 24h TTL (existing caching preserved)
- [x] Add lazy initialization with error handling for ONNX runtime
- [ ] **Test:** Same text produces same embedding (not random)

**Commit:** `feat(embeddings): integrate ONNX model for real embeddings`

### Task 3.2: Implement Real Semantic Search
- [x] **File:** `repos/metabob-analysis-api/src/services/embedding-service.ts`
- [x] Replace `searchSimilar()` mock with real cosine similarity via ONNX model
- [x] Query indexed components and compute embedding similarity
- [x] Return top-K with similarity scores
- [x] **File:** `repos/metabob-analysis-api/src/routes/search.ts`
- [x] Use co-change predictions for semantic enhancement
- [x] Combine lexical matching with embedding similarity scores
- [x] Add `embedding_similarity` field to search results
- [ ] **Test:** Search "authentication" returns auth-related code

**Commit:** `feat(search): implement real semantic search with embeddings`

### Task 3.3: Hybrid Scoring with Real Embeddings
- [x] **File:** `repos/metabob-analysis-api/src/routes/cochange.ts`
- [x] CPG predictions already use real embeddings via CoChangePredictor → ONNXEmbeddingModel
- [x] Combines with historical patterns: `embedding_weight * similarity + frequency_weight * historical`
- [x] Both `embedding_similarity` and `historical_frequency` in response
- [ ] **Test:** Suggestions show both `embedding_similarity` and `historical_frequency`

**Commit:** `feat(cochange): hybrid scoring with real embeddings`

---

## Milestone 4: Learning Loop Integration
**Target:** Week 4 | **State After:** Tool usage improves future suggestions

### Task 4.1: Report Tool Usage to Learning Backend
- [x] **File:** `repos/metabob-mcp/src/api-client.ts`
- [x] Add `reportCochange(sessionId, changedFiles, suggestedFiles)` method
- [x] Add `reportToolUsage(sessionId, toolName, input, outputSummary)` method
- [x] Call `/v2/analysis/learning/cochange` and `/v2/analysis/learning/tool-usage`
- [x] **File:** `repos/metabob-mcp/src/tools/suggest-related-changes.ts`
- [x] After handler returns, call `apiClient.reportCochange()` and `reportToolUsage()`
- [x] Non-blocking (fire and forget with error logging)
- [ ] **Test:** Tool call creates `cochange_patterns` entry

**Commit:** `feat(mcp): report tool usage to learning backend`

### Task 4.2: Track Predictions for Feedback
- [x] **File:** `repos/metabob-mcp/src/api-client.ts`
- [x] Add `trackPrediction(sessionId, tool, predictedFiles)` method
- [x] Add `recordActualChangesAndSubmitFeedback(sessionId, actualFiles)` method
- [x] Compare predicted vs actual, calculate accuracy
- [x] Add `submitFeedback()` to send to `/v2/analysis/learning/feedback`
- [x] **File:** `repos/metabob-mcp/src/tools/mark-problem-complete.ts`
- [x] After marking complete, call `apiClient.recordActualChangesAndSubmitFeedback()`
- [x] Report tool usage (non-blocking)
- [ ] **Test:** Feedback updates pattern confidence

**Commit:** `feat(mcp): track predictions and send feedback`

### Task 4.3: Output Quality Signals
- [x] **File:** `repos/metabob-mcp/src/quality-signals.ts` (new)
- [x] Create `formatQualitySignals()` utility
- [x] Create `extractQualitySignals()` to extract from API response
- [x] **File:** `repos/metabob-mcp/src/tools/suggest-related-changes.ts`
- [x] Add cpg_status warning: "CPG not indexed - run init_workspace first"
- [x] Add historical_patterns_found guidance
- [x] **File:** `repos/metabob-mcp/src/tools/search-codebase.ts`
- [x] Add cpg_status and components_searched signals
- [ ] **Test:** Empty CPG shows helpful message

**Commit:** `feat(mcp): output quality signals in tool responses`

---

## Milestone 5: Shared Libraries
**Target:** Week 5 | **State After:** Clean separation, no code duplication

### Task 5.1: Extract @metabob/shared-types
- [x] Create `libs/shared-types/` package structure
- [x] Extract type definitions:
  - `Severity`, `ProblemCategory`, `ProblemStatus`, `RiskLevel`
  - `AnalysisProblem`, `ComponentAnnotation`, `AnnotationType`
  - `ImpactAnalysisResult`, `ImpactedComponent`
  - `CochangeSuggestion`, `CochangePattern`
  - `SessionContext`, `Scope`, `ResolvedScope`
  - `QualitySignals`, `CPGStatus`
- [ ] Update imports in both services (future task)
- [ ] **Test:** Both services build and pass tests

**Commit:** `refactor(types): extract @metabob/shared-types package`

### Task 5.2: Extract @metabob/auth
- [x] Create `libs/auth/` package structure
- [x] Extract rate limiter with pluggable backends (`RateLimiterBackend` interface)
- [x] Extract circuit breaker with factory function
- [x] Create `InMemoryRateLimiterBackend` default implementation
- [x] Create factory functions (`createRateLimiter`, `createCircuitBreaker`)
- [ ] Update both services to use package (future task)
- [ ] **Test:** Equivalent behavior after refactor

**Commit:** `refactor(auth): extract @metabob/auth package`

### Task 5.3: Extract @metabob/validation
- [x] Create `libs/validation/` package structure
- [x] Base schemas: `PaginationSchema`, `SeverityFilterSchema`, `CategoryFilterSchema`
- [x] Additional schemas: `ScopeSchema`, `FilePatternSchema`, `BaseFilterSchema`
- [x] Error formatters: `formatZodError`, `formatZodErrorDetails`, `createValidationError`
- [x] Validation utilities: `safeParse`, `validate`
- [ ] Update tool and route schemas to extend base (future task)
- [ ] **Test:** Validation behavior unchanged

**Commit:** `refactor(validation): extract @metabob/validation package`

---

## Milestone 6: Multi-Tenant Hardening
**Target:** Week 6 | **State After:** Full multi-tenant isolation

### Task 6.1: Add Project-Scoped Filtering
- [x] **File:** `repos/metabob-activity-api/src/middleware/jwtAuth.ts`
- [x] Extract `project_ids` array from JWT claims (already implemented)
- [x] **File:** SQL schemas
- [x] Add PERMISSIONS: `WHERE project_id IN $auth.project_ids` (already in schemas)
- [x] Apply to `activity_execution_traces`, `cochange_patterns` (verified)
- [ ] **Test:** Cross-project queries return empty

**Commit:** `feat(auth): add project-scoped filtering` (pre-existing infrastructure)

### Task 6.2: Implement Public Template Sharing
- [x] **File:** `repos/metabob-activity-api/src/routes/activities.ts`
- [x] Add field: `public: boolean` to activity_registry (already in schema)
- [x] Add GET `/v2/activities/public` endpoint (no auth required)
- [x] Query: `WHERE scope = 'global' AND public = true`
- [x] **File:** SQL schema (already has `public` field and PERMISSIONS)
- [x] Update PERMISSIONS: `FOR select WHERE org_id = $auth.org_id OR public = true`
- [ ] **Test:** Public templates visible without auth

**Commit:** `feat(multi-tenant): add public templates endpoint and documentation`

### Task 6.3: Update Multi-Tenant Documentation
- [x] **File:** `docs/MULTI_TENANT_ARCHITECTURE.md`
- [x] Document scoping hierarchy (global → org → project → session)
- [x] RBAC patterns with code examples
- [x] API key provisioning flow
- [x] Session management
- [x] Learning data isolation constraints
- [ ] **Test:** N/A (documentation)

**Commit:** `feat(multi-tenant): add public templates endpoint and documentation`

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
