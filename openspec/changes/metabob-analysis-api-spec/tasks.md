# metabob-analysis-api Implementation Tasks

These tasks align with and support the metabob-mcp vessel spec milestones.

---

## Milestone 1: Fix Critical Stubs (Week 1)

### Task 1.1: Implement Annotation Persistence

**Status:** STUB at `annotations.ts:64`

**Current Code:**
```typescript
// Line 63-64: TODO comment - actual INSERT commented out
// TODO: Store in SurrealDB
// await surrealDB.query('INSERT INTO component_annotations', annotation);
```

**Implementation:**
- [ ] **File:** `repos/metabob-analysis-api/src/routes/annotations.ts`
- [ ] Uncomment/implement INSERT at line 64
- [ ] Extract `created_by` from `c.get('auth').id` instead of hardcoded `'system'`
- [ ] Add RELATE clause if `link_to_problem_id` provided:
  ```sql
  RELATE $annotation->annotates->$problem_id
  ```
- [ ] Add component validation against CPG (optional, with fallback if CPG empty)
- [ ] Return the persisted annotation with database ID

**Test:**
```bash
curl -X POST http://api.metabob.local/v2/analysis/annotations \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Session-ID: test-session" \
  -H "Content-Type: application/json" \
  -d '{"component_id":"test::func","content":"Test note","type":"implementation_note"}'

# Verify in SurrealDB:
surreal sql --conn http://surql.metabob.local:8000 --ns activity-system --db learning_loop
> SELECT * FROM annotations WHERE content = 'Test note';
```

**Commit:** `fix(annotations): implement database persistence`

---

### Task 1.2: Fix Spec Response Type Mismatch

**Problem:** metabob-mcp expects `steps[]` but backend returns `implementation_order[]`

**Files:**
- [ ] `repos/metabob-analysis-api/src/routes/specs.ts`
- [ ] `repos/metabob-analysis-api/src/models/types.ts`

**Implementation:**
- [ ] Add `ImplementationStep` type:
  ```typescript
  interface ImplementationStep {
    step_number: number;
    component_id: string;
    action: 'create' | 'modify' | 'test';
    description: string;
    dependencies: string[];
  }
  ```
- [ ] Transform `implementation_order` to `steps[]` in response
- [ ] Add `spec_id` with `crypto.randomUUID()`
- [ ] Add `overview` field (summary of goal analysis)
- [ ] Add `estimated_effort` calculation (based on components)
- [ ] Add `risks` array extraction from patterns

**Test:**
```bash
curl -X POST http://api.metabob.local/v2/analysis/specs/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Session-ID: test-session" \
  -H "Content-Type: application/json" \
  -d '{"goal":"Add user authentication"}'

# Verify response has:
# - spec_id
# - steps[] (not implementation_order)
# - overview
# - estimated_effort
```

**Commit:** `fix(specs): align response types between backend and tool`

---

### Task 1.3: Add Problem Creation Endpoint

**Problem:** `analysis_problems` table is empty because there's no INSERT path

**Files:**
- [ ] `repos/metabob-analysis-api/src/routes/problems.ts`
- [ ] `repos/metabob-analysis-api/src/models/schemas.ts`

**Implementation:**
- [ ] Add POST `/` route to problems.ts
- [ ] Input schema:
  ```typescript
  {
    file_path: string;        // Required
    line_number?: number;     // Optional
    severity: Severity;       // Required
    category: ProblemCategory; // Required
    title: string;            // Required
    description?: string;     // Optional
    metadata?: object;        // Optional
  }
  ```
- [ ] Auto-populate from auth context:
  - `org_id` from `$auth.org_id`
  - `project_id` from request or first available
- [ ] Auto-populate defaults:
  - `status` = 'open'
  - `detected_at` = now()
  - `created_at` = now()
- [ ] Return created problem with ID

**Test:**
```bash
curl -X POST http://api.metabob.local/v2/analysis/problems \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_path":"src/auth.ts",
    "line_number":42,
    "severity":"HIGH",
    "category":"security",
    "title":"SQL injection vulnerability",
    "description":"User input not sanitized"
  }'

# Verify in GET /v2/analysis/problems
curl http://api.metabob.local/v2/analysis/problems \
  -H "Authorization: Bearer $TOKEN"
# Should return the created problem
```

**Commit:** `feat(problems): add problem creation endpoint`

---

## Milestone 2: CPG Auto-Indexing (Week 2)

### Task 2.1: Complete File Indexing Endpoint

**Current State:** POST `/v2/analysis/index` exists but may be incomplete

**Files:**
- [ ] `repos/metabob-analysis-api/src/routes/indexing.ts`

**Implementation:**
- [ ] Accept JSON body: `{ files: Record<string, string> }` (filename → content)
- [ ] Validate file count (max 1000 files per request)
- [ ] Validate total content size (max 50MB)
- [ ] Call `cpgService.addFiles(sessionId, files)`
- [ ] Track progress in session metadata
- [ ] Return:
  ```typescript
  {
    indexed: number;           // Files processed
    components: number;        // Components discovered
    status: 'complete' | 'partial';
    duration_ms: number;
    errors?: string[];         // Any failed files
  }
  ```

**Test:**
```bash
# Index a simple file
curl -X POST http://api.metabob.local/v2/analysis/index \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Session-ID: test-session" \
  -H "Content-Type: application/json" \
  -d '{"files":{"src/auth.ts":"export function login() { return true; }"}}'

# Verify status
curl http://api.metabob.local/v2/analysis/index/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Session-ID: test-session"
# Should show components_count > 0
```

**Commit:** `feat(indexing): complete file indexing endpoint`

---

### Task 2.2: Track Progressive Sync State

**Problem:** File hashes not tracked for incremental re-indexing

**Files:**
- [ ] `repos/metabob-analysis-api/src/services/cpg-service.ts`
- [ ] `repos/metabob-analysis-api/sql/schemas/022-annotations.surql` (verify schema)

**Implementation:**
- [ ] On `addFiles()`, compute SHA-256 hash for each file
- [ ] Store in `progressive_sync_state` table:
  ```sql
  CREATE progressive_sync_state SET
    org_id = $auth.org_id,
    project_id = $project_id,
    file_path = $file_path,
    file_hash = $hash,
    sync_status = 'completed',
    last_synced_at = time::now();
  ```
- [ ] On subsequent `addFiles()`:
  - Compare hashes with stored values
  - Only re-index files with changed hashes
  - Return `{indexed, skipped}` counts
- [ ] Add `GET /v2/analysis/sync/status` endpoint:
  ```typescript
  {
    total_files: number;
    synced_files: number;
    pending_files: number;
    last_full_sync: string;
  }
  ```

**Test:**
```bash
# Index file
curl -X POST http://api.metabob.local/v2/analysis/index \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Session-ID: test-session" \
  -H "Content-Type: application/json" \
  -d '{"files":{"src/auth.ts":"v1 content"}}'

# Re-index same file (should skip)
curl -X POST http://api.metabob.local/v2/analysis/index \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Session-ID: test-session" \
  -H "Content-Type: application/json" \
  -d '{"files":{"src/auth.ts":"v1 content"}}'
# Should return indexed: 0, skipped: 1

# Re-index changed file (should process)
curl -X POST http://api.metabob.local/v2/analysis/index \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Session-ID: test-session" \
  -H "Content-Type: application/json" \
  -d '{"files":{"src/auth.ts":"v2 content changed"}}'
# Should return indexed: 1, skipped: 0
```

**Commit:** `feat(indexing): track progressive sync state`

---

## Milestone 3: Real Embeddings (Week 3)

### Task 3.1: Replace Mock Embeddings with ONNX

**Current Code (stub):**
```typescript
// embedding-service.ts:66-67
function mockEmbedding(text: string): number[] {
  // PRNG based on text hash - NOT real embeddings
  const seed = hashString(text);
  return Array(384).fill(0).map((_, i) => prng(seed + i));
}
```

**Files:**
- [ ] `repos/metabob-analysis-api/src/services/embedding-service.ts`

**Implementation:**
- [ ] Import embedding generator from `cpg-inference-ts`:
  ```typescript
  import { EmbeddingGenerator } from '@metabob/cpg-inference';
  ```
- [ ] Initialize ONNX runtime in service constructor
- [ ] Replace `mockEmbedding()` with:
  ```typescript
  async generateEmbedding(text: string): Promise<number[]> {
    const cached = await this.redis.get(`emb:${hash(text)}`);
    if (cached) return JSON.parse(cached);

    const embedding = await this.generator.embed(text);
    await this.redis.setex(`emb:${hash(text)}`, 86400, JSON.stringify(embedding));
    return embedding;
  }
  ```
- [ ] Add error handling for ONNX runtime failures (fallback to zero vector with warning)
- [ ] Add embedding dimension validation (should be 384 for all-MiniLM-L6-v2)

**Test:**
```typescript
// Same text should produce same embedding
const emb1 = await service.generateEmbedding("hello world");
const emb2 = await service.generateEmbedding("hello world");
assert.deepEqual(emb1, emb2);

// Different text should produce different embedding
const emb3 = await service.generateEmbedding("goodbye world");
assert.notDeepEqual(emb1, emb3);

// Embedding should be 384 dimensions
assert.equal(emb1.length, 384);
```

**Commit:** `feat(embeddings): integrate ONNX model for real embeddings`

---

### Task 3.2: Implement Real Semantic Search

**Current State:** `search.ts` falls back to substring matching when embeddings unavailable

**Files:**
- [ ] `repos/metabob-analysis-api/src/services/embedding-service.ts`
- [ ] `repos/metabob-analysis-api/src/routes/search.ts`

**Implementation:**
- [ ] Add FAISS or usearch index to embedding service:
  ```typescript
  private index: FaissIndex;
  private idToComponent: Map<number, string>;

  async addToIndex(componentId: string, embedding: number[]): Promise<void> {
    const idx = this.index.add(embedding);
    this.idToComponent.set(idx, componentId);
  }

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const queryEmb = await this.generateEmbedding(query);
    const results = this.index.search(queryEmb, limit);
    return results.map(r => ({
      component_id: this.idToComponent.get(r.id),
      similarity: r.distance
    }));
  }
  ```
- [ ] Index components during CPG indexing
- [ ] Update `search.ts` to use real embedding search:
  ```typescript
  const results = await embeddingService.search(body.query, body.limit);
  ```
- [ ] Return results with similarity scores

**Test:**
```bash
# Index some files first
curl -X POST http://api.metabob.local/v2/analysis/index \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Session-ID: test-session" \
  -H "Content-Type: application/json" \
  -d '{"files":{
    "src/auth.ts":"export function login(user, password) { validateCredentials(user, password); }",
    "src/user.ts":"export function getUser(id) { return database.query(id); }",
    "src/payment.ts":"export function processPayment(amount) { return stripe.charge(amount); }"
  }}'

# Search for auth-related code
curl -X POST http://api.metabob.local/v2/analysis/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Session-ID: test-session" \
  -H "Content-Type: application/json" \
  -d '{"query":"authentication and credentials"}'

# Should return auth.ts with highest similarity
```

**Commit:** `feat(search): implement real semantic search with embeddings`

---

### Task 3.3: Add Hybrid Scoring to Co-change

**Current State:** `cochange.ts` combines CPG predictions with historical patterns but using mock embeddings

**Files:**
- [ ] `repos/metabob-analysis-api/src/routes/cochange.ts`

**Implementation:**
- [ ] Verify CPG predictions use real embeddings from Task 3.1
- [ ] Document the hybrid scoring formula:
  ```
  final_score = (embedding_weight * embedding_similarity) +
                (frequency_weight * historical_frequency)

  Default weights: embedding=0.6, frequency=0.4
  ```
- [ ] Return both scores in response for transparency:
  ```typescript
  {
    suggestions: [
      {
        file: "src/utils.ts",
        score: 0.85,
        embedding_similarity: 0.92,
        historical_frequency: 0.75,
        reason: "High semantic similarity + 3 historical co-changes"
      }
    ]
  }
  ```
- [ ] Allow weight override in request body

**Test:**
```bash
curl -X POST http://api.metabob.local/v2/analysis/cochange/suggest \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Session-ID: test-session" \
  -H "Content-Type: application/json" \
  -d '{
    "changed_files":["src/auth.ts"],
    "config":{"embedding_weight":0.6,"frequency_weight":0.4}
  }'

# Response should include both signals:
# "embedding_similarity": 0.XX
# "historical_frequency": 0.XX
```

**Commit:** `feat(cochange): hybrid scoring with real embeddings`

---

## Milestone 4: Learning Loop Enhancement (Week 4)

### Task 4.1: Improve Pattern Recording

**Files:**
- [ ] `repos/metabob-analysis-api/src/services/learning-service.ts`

**Implementation:**
- [ ] Add `session_id` to cochange_events for session attribution
- [ ] Add `tool_invocation_id` to track which tool call triggered the event
- [ ] Record negative signals (files changed together that were NOT suggested):
  ```typescript
  async recordMissedSuggestion(
    projectId: string,
    suggestedFiles: string[],
    actualFiles: string[]
  ): Promise<void> {
    const missed = actualFiles.filter(f => !suggestedFiles.includes(f));
    // Record for future pattern improvement
  }
  ```

**Commit:** `feat(learning): improve pattern recording with session attribution`

---

### Task 4.2: Add Prediction Tracking Table

**Files:**
- [ ] `repos/metabob-analysis-api/sql/schemas/023-predictions.surql` (new)
- [ ] `repos/metabob-analysis-api/src/services/learning-service.ts`

**Implementation:**
- [ ] Create new schema:
  ```sql
  DEFINE TABLE prediction_tracking SCHEMAFULL;
  DEFINE FIELD org_id ON prediction_tracking TYPE record<organizations> ASSERT $value != NONE;
  DEFINE FIELD project_id ON prediction_tracking TYPE record<projects> ASSERT $value != NONE;
  DEFINE FIELD session_id ON prediction_tracking TYPE string;
  DEFINE FIELD tool ON prediction_tracking TYPE string;  -- "suggest_related_changes", etc.
  DEFINE FIELD predicted_files ON prediction_tracking TYPE array<string>;
  DEFINE FIELD actual_files ON prediction_tracking TYPE option<array<string>>;
  DEFINE FIELD accuracy ON prediction_tracking TYPE option<float>;
  DEFINE FIELD predicted_at ON prediction_tracking TYPE datetime DEFAULT time::now();
  DEFINE FIELD resolved_at ON prediction_tracking TYPE option<datetime>;

  DEFINE INDEX idx_org_project ON prediction_tracking COLUMNS org_id, project_id;
  DEFINE INDEX idx_session ON prediction_tracking COLUMNS session_id;
  ```
- [ ] Add `trackPrediction()` method to learning service
- [ ] Add `resolvePrediction()` method to calculate accuracy

**Commit:** `feat(learning): add prediction tracking table`

---

## Milestone 5: Code Consolidation (Week 5)

### Task 5.1: Extract Shared Types

**Files:**
- [ ] Create `libs/shared-types/package.json`
- [ ] Create `libs/shared-types/src/index.ts`

**Types to Extract:**

From `metabob-analysis-api/src/models/types.ts`:
- `AnalysisProblem`, `Severity`, `ProblemCategory`, `ProblemStatus`
- `ComponentAnnotation`, `AnnotationType`
- `ImpactAnalysisResult`, `ImpactedComponent`, `RiskLevel`
- `CochangeSuggestion`, `CochangePattern`
- `ImplementationSpec`, `ImplementationStep`

From `metabob-mcp/src/session-manager.ts`:
- `SessionContext`, `Scope`, `ResolvedScope`

**Implementation:**
- [ ] Create package structure
- [ ] Move types
- [ ] Update imports in both services
- [ ] Verify builds pass

**Commit:** `refactor(types): extract @metabob/shared-types package`

---

## Milestone 6: Multi-Tenant Hardening (Week 6)

### Task 6.1: Add Project-Scoped Filtering

**Files:**
- [ ] `repos/metabob-analysis-api/src/middleware/scope.ts`
- [ ] `repos/metabob-analysis-api/sql/schemas/*.surql`

**Implementation:**
- [ ] Extract `project_ids` array from JWT claims
- [ ] Add PERMISSIONS to all analysis tables:
  ```sql
  WHERE project_id IN $auth.project_ids
  ```
- [ ] Verify cross-project isolation

**Test:**
```bash
# Create two projects
PROJECT_A_TOKEN=$(create_project_token "project-a")
PROJECT_B_TOKEN=$(create_project_token "project-b")

# Create problem in project A
curl -X POST http://api.metabob.local/v2/analysis/problems \
  -H "Authorization: Bearer $PROJECT_A_TOKEN" \
  -d '{"file_path":"a.ts","severity":"HIGH","category":"security","title":"Test"}'

# Query from project B (should return empty)
curl http://api.metabob.local/v2/analysis/problems \
  -H "Authorization: Bearer $PROJECT_B_TOKEN"
# Expected: {"problems":[],"total":0}
```

**Commit:** `feat(auth): add project-scoped filtering`

---

## Verification Checklist

### After Milestone 1:
```bash
# Annotations persist
curl -X POST .../annotations -d '{"component_id":"x","content":"test","type":"todo"}'
surreal sql "SELECT * FROM annotations" # Should have the annotation

# Specs return correct type
curl -X POST .../specs/generate -d '{"goal":"test"}'
# Response should have "steps" array, not "implementation_order"

# Problems can be created
curl -X POST .../problems -d '{"file_path":"x.ts","severity":"HIGH",...}'
curl GET .../problems # Should include the created problem
```

### After Milestone 2:
```bash
# Indexing creates components
curl -X POST .../index -d '{"files":{"a.ts":"code"}}'
curl GET .../index/status # components_count > 0

# Progressive sync skips unchanged
curl -X POST .../index -d '{"files":{"a.ts":"code"}}' # indexed: 0, skipped: 1
```

### After Milestone 3:
```bash
# Embeddings are consistent
emb1 = embed("test")
emb2 = embed("test")
assert emb1 == emb2

# Search is semantic
search("authentication") # Returns auth-related code, not just "auth" substring

# Co-change shows both signals
suggest(["auth.ts"]) # Returns embedding_similarity AND historical_frequency
```

---

## Dependencies

```
Task 2.1 (indexing) ← Task 3.1 (embeddings) ← Task 3.2 (search)
                   ← Task 3.3 (hybrid scoring)

Task 1.3 (problem creation) ← Task 1.1 (annotations) (for linking)

Task 3.1 (embeddings) ← Task 4.2 (prediction tracking)

Task 5.1 (shared types) ← Task 5.2 (shared auth) ← Task 5.3 (shared validation)
```
