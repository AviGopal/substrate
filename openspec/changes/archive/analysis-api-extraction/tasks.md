# Analysis API Extraction - Implementation Tasks

**Status:** Draft
**Created:** 2026-03-23
**Last Updated:** 2026-03-23

---

## Task Organization

Tasks are organized by component and dependency order. Each task includes:
- **ID:** Unique identifier
- **Component:** Which codebase the task belongs to
- **Depends On:** Prerequisites (by task ID)
- **Estimate:** Rough time estimate
- **Acceptance Criteria:** How to verify completion

---

## Phase 0: Prerequisites (Before Week 1)

### PREREQ-1: SurrealDB Schema Creation
**Component:** Infrastructure
**Depends On:** None
**Estimate:** 2 hours

**Description:**
Create SurrealDB schema files in `openspec/changes/analysis-api-extraction/sql/` and apply to dev cluster.

**Acceptance Criteria:**
- [ ] `001-initial-schema.surql` created with all tables defined
- [ ] `002-indexes.surql` created with performance indexes
- [ ] `003-relations.surql` created with graph relationships
- [ ] Schema applied to SurrealDB in `activity-system` namespace
- [ ] Verify tables exist: `INFO FOR DB learning_loop;`
- [ ] Verify namespace shared with metabob-activity-api

**Commands:**
```bash
# Apply schema
surreal sql --endpoint http://surrealdb.activity-system.svc.cluster.local:8000 \
  --namespace activity_system --database learning_loop \
  --username root --password $SURREAL_PASS \
  < sql/001-initial-schema.surql
```

---

### PREREQ-2: Redis Verification
**Component:** Infrastructure
**Depends On:** None
**Estimate:** 30 minutes

**Description:**
Verify Redis/Valkey cluster is accessible and supports required data structures.

**Acceptance Criteria:**
- [ ] Redis accessible from `activity-system` namespace
- [ ] Can store and retrieve JSON blobs
- [ ] Can set TTL on keys
- [ ] Can scan keys with pattern matching
- [ ] Latency <2ms for GET/SET operations

**Commands:**
```bash
# Test Redis connectivity
kubectl run redis-test --rm -it --restart=Never \
  --namespace activity-system \
  --image=redis:7-alpine \
  -- redis-cli -h redis-valkey.activity-system.svc.cluster.local ping
```

---

### PREREQ-3: Repository Setup
**Component:** All
**Depends On:** None
**Estimate:** 1 hour

**Description:**
Create repository structure for new components.

**Acceptance Criteria:**
- [ ] `repos/metabob-analysis-api/` directory created
- [ ] `repos/metabob-mcp/` directory created
- [ ] `repos/cpg-inference-ts/` directory created
- [ ] Each has `package.json` with Bun configuration
- [ ] Each has `tsconfig.json` with strict settings
- [ ] Each has `.gitignore` configured
- [ ] Each has `README.md` with placeholder content

**Directory Structure:**
```
repos/
├── metabob-analysis-api/
│   ├── src/
│   ├── tests/
│   ├── sql/
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── metabob-mcp/
│   ├── src/
│   ├── tests/
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
└── cpg-inference-ts/
    ├── src/
    ├── tests/
    ├── benchmarks/
    ├── package.json
    ├── tsconfig.json
    └── README.md
```

---

## Phase 1: CPG Library Translation (Week 1-2)

### CPG-1: Project Structure and Dependencies
**Component:** cpg-inference-ts
**Depends On:** PREREQ-3
**Estimate:** 2 hours

**Description:**
Set up TypeScript project with all dependencies.

**Acceptance Criteria:**
- [ ] `package.json` includes all dependencies:
  - `@tree-sitter/node`
  - `onnxruntime-node`
  - `faiss-node`
  - `better-sqlite3`
  - Development dependencies (Bun, TypeScript, etc.)
- [ ] `tsconfig.json` configured with strict mode
- [ ] `bun test` runs without errors (even with no tests)
- [ ] `bun run typecheck` passes

---

### CPG-2: Core Type Definitions
**Component:** cpg-inference-ts
**Depends On:** CPG-1
**Estimate:** 3 hours

**Description:**
Translate Python type hints to TypeScript interfaces.

**Acceptance Criteria:**
- [ ] `src/types.ts` created with all interfaces:
  - `InferenceConfig`
  - `Component`, `Edge`
  - `AddFileResult`, `UpdateFileResult`, `DeleteFileResult`
  - `ImpactAnalysis`, `ImpactNode`, `SimilarityNode`
  - `CochangePrediction`
  - `QueryResult`, `GraphStats`
- [ ] All interfaces properly documented with JSDoc
- [ ] Type safety enforced (no `any` types)

**Reference:** `openspec/changes/analysis-api-extraction/specs/cpg-library/spec.md`

---

### CPG-3: CodePropertyGraph Class
**Component:** cpg-inference-ts
**Depends On:** CPG-2
**Estimate:** 8 hours

**Description:**
Translate `cpg_inference/graph.py` to TypeScript using adjacency lists instead of NetworkX.

**Acceptance Criteria:**
- [ ] `src/graph/cpg.ts` created with `CodePropertyGraph` class
- [ ] Node operations: `addNode`, `removeNode`, `getNode`, `hasNode`
- [ ] Edge operations: `addEdge`, `removeEdge`, `getEdges`
- [ ] Traversal: `traverse(startIds, direction, maxDepth, filter)`
- [ ] Serialization: `toJSON()`, `fromJSON()`
- [ ] Unit tests cover all operations
- [ ] Performance: 1M nodes, 5M edges supported

**Test Example:**
```typescript
test('traverse finds all dependencies up to maxDepth', () => {
  const cpg = new CodePropertyGraph();
  cpg.addNode({ id: 'a', type: 'function', name: 'foo', startLine: 1, endLine: 10 });
  cpg.addNode({ id: 'b', type: 'function', name: 'bar', startLine: 20, endLine: 30 });
  cpg.addEdge('a', 'b', 'calls', {});

  const result = cpg.traverse(['a'], 'forward', 2);
  expect(result.nodes).toContainEqual(expect.objectContaining({ id: 'b' }));
});
```

---

### CPG-4: GraphQueryEngine Class
**Component:** cpg-inference-ts
**Depends On:** CPG-3
**Estimate:** 6 hours

**Description:**
Implement graph query methods for common analysis patterns.

**Acceptance Criteria:**
- [ ] `src/graph/query-engine.ts` created with `GraphQueryEngine` class
- [ ] Traversal methods: `findCallers`, `findCallees`, `findDependencies`, `findDependents`
- [ ] Search methods: `findPath`, `getNeighborhood`, `findNodesByName`, `findComponentsAtLine`
- [ ] Analysis methods: `getImpactSet`, `getReverseImpactSet`, `getStats`
- [ ] Existence checks: `hasComponent`, `getComponent`, `getComponentsInFiles`
- [ ] Unit tests for each method
- [ ] Performance: <15ms for impact set at depth 3 (1000 nodes)

---

### CPG-5: Tree-sitter Parser Registry
**Component:** cpg-inference-ts
**Depends On:** CPG-2
**Estimate:** 8 hours

**Description:**
Implement parser registry with tree-sitter language support.

**Acceptance Criteria:**
- [ ] `src/parsers/registry.ts` created with `ParserRegistry` class
- [ ] Language detection: `detectLanguage(filePath)`
- [ ] Parser registration: `registerParser(language, parser)`
- [ ] File parsing: `parseFile(filePath, content)` returns `ParseResult`
- [ ] TypeScript parser: `src/parsers/typescript-parser.ts` (extracts functions, classes, imports)
- [ ] JavaScript parser: `src/parsers/javascript-parser.ts`
- [ ] Python parser: `src/parsers/python-parser.ts`
- [ ] Unit tests with fixture code samples
- [ ] Performance: <50ms for 1000 LOC file

**Reference Python:** `repos/cpg-inference/cpg_inference/parsers/`

---

### CPG-6: ONNX Embedding Model
**Component:** cpg-inference-ts
**Depends On:** CPG-2
**Estimate:** 6 hours

**Description:**
Wrap ONNX runtime for code embedding generation.

**Acceptance Criteria:**
- [ ] `src/embeddings/onnx-model.ts` created with `ONNXEmbeddingModel` class
- [ ] Load bundled model: `src/embeddings/models/default.onnx` (copy from Python repo)
- [ ] Single embedding: `generateEmbedding(code)` returns `number[]` (32-dim)
- [ ] Batch embeddings: `generateBatchEmbeddings(codes)` returns `number[][]`
- [ ] Model info: `getEmbeddingDim()`, `getModelVersion()`
- [ ] Unit tests with known code samples
- [ ] Performance: <10ms per embedding

**Commands:**
```bash
# Copy ONNX model from Python repo
cp repos/cpg-inference/models/default.onnx repos/cpg-inference-ts/src/embeddings/models/
```

---

### CPG-7: FAISS Index Wrapper
**Component:** cpg-inference-ts
**Depends On:** CPG-2
**Estimate:** 6 hours

**Description:**
Wrap faiss-node for vector similarity search.

**Acceptance Criteria:**
- [ ] `src/embeddings/faiss-index.ts` created with `FAISSIndex` class
- [ ] Index operations: `add(id, embedding)`, `addBatch(items)`, `remove(id)`
- [ ] Search: `search(queryEmbedding, k)` returns `SearchResult[]`
- [ ] Persistence: `save(path)`, `load(path)`
- [ ] Stats: `size()`, `getDimension()`
- [ ] Unit tests with synthetic embeddings
- [ ] Performance: <5ms for search in 10K index

**Test Example:**
```typescript
test('search returns top-k similar embeddings', async () => {
  const index = new FAISSIndex(32);
  await index.add('a', [0.1, 0.2, ...]);
  await index.add('b', [0.15, 0.25, ...]);

  const results = await index.search([0.12, 0.22, ...], 1);
  expect(results[0].id).toBe('a');
  expect(results[0].similarity).toBeGreaterThan(0.9);
});
```

---

### CPG-8: CoChangePredictor Class (File Operations)
**Component:** cpg-inference-ts
**Depends On:** CPG-3, CPG-5, CPG-6, CPG-7
**Estimate:** 10 hours

**Description:**
Main predictor class with progressive file operations.

**Acceptance Criteria:**
- [ ] `src/predictor.ts` created with `CoChangePredictor` class
- [ ] Constructor: accepts `InferenceConfig`, optional `projectRoot`
- [ ] `addFile(filePath, content)`: Parse → Add to CPG → Generate embeddings
- [ ] `updateFile(filePath, content)`: Diff components → Update CPG → Update embeddings
- [ ] `deleteFile(filePath)`: Remove components → Update CPG → Remove embeddings
- [ ] `getCPG()`: Returns underlying `CodePropertyGraph`
- [ ] `queryGraph()`: Returns `GraphQueryEngine`
- [ ] `getStats()`: Returns `CPGStats`
- [ ] Unit tests with multi-file scenarios
- [ ] Performance: <100ms for updateFile (1000 LOC)

**Critical Algorithm:**
```typescript
async updateFile(filePath: string, content: string): Promise<UpdateFileResult> {
  // 1. Parse new file
  const parseResult = await this.parser.parseFile(filePath, content);

  // 2. Find existing components
  const existing = this.cpg.getComponentsByFile(filePath);

  // 3. Compute diff (added, removed, modified)
  const diff = this.computeComponentDiff(existing, parseResult.components);

  // 4. Update graph
  for (const comp of diff.removed) this.cpg.removeNode(comp.id);
  for (const comp of diff.added) this.cpg.addNode(comp);
  for (const comp of diff.modified) this.cpg.updateNode(comp);

  // 5. Re-link edges
  await this.relinkEdges(filePath, parseResult.edges);

  // 6. Update embeddings (async)
  await this.updateEmbeddings(diff.added.concat(diff.modified));

  return { filePath, ...diff, duration: elapsed };
}
```

---

### CPG-9: CoChangePredictor Class (Analysis Methods)
**Component:** cpg-inference-ts
**Depends On:** CPG-8
**Estimate:** 8 hours

**Description:**
Implement analysis methods on CoChangePredictor.

**Acceptance Criteria:**
- [ ] `analyzeChangeImpact(componentIds, maxDepth)`: Traverse CPG forward/backward + embedding similarity
- [ ] `predictCochanges(changedFiles, files, topK)`: Generate embeddings → FAISS search → Score
- [ ] `getFileEmbedding(filePath)`: Aggregate component embeddings
- [ ] `getComponentEmbedding(componentId)`: Lookup or generate embedding
- [ ] `searchSimilar(embedding, topK)`: FAISS search wrapper
- [ ] Unit tests with known co-change patterns
- [ ] Performance: <40ms for predictCochanges

**Test Example:**
```typescript
test('analyzeChangeImpact finds forward and backward dependencies', async () => {
  const predictor = new CoChangePredictor(config);
  await predictor.addFile('a.ts', 'import { foo } from "./b";\nfoo();');
  await predictor.addFile('b.ts', 'export function foo() {}');

  const impact = await predictor.analyzeChangeImpact(['a.ts::main'], 2);
  expect(impact.graphForward).toContainEqual(
    expect.objectContaining({ componentId: 'b.ts::foo' })
  );
});
```

---

### CPG-10: Storage Backends (SQLite and Redis)
**Component:** cpg-inference-ts
**Depends On:** CPG-2
**Estimate:** 6 hours

**Description:**
Implement optional storage backends for component persistence.

**Acceptance Criteria:**
- [ ] `src/storage/interface.ts` defines `Storage` interface
- [ ] `src/storage/sqlite-storage.ts` implements `SQLiteStorage` using better-sqlite3
- [ ] `src/storage/redis-storage.ts` implements `RedisStorage`
- [ ] `src/storage/memory-storage.ts` implements in-memory storage (for testing)
- [ ] All implement: `saveComponent`, `getComponent`, `deleteComponent`, `listComponents`
- [ ] Batch operations: `saveBatch`, `deleteBatch`
- [ ] Edge operations: `saveEdge`, `getEdges`, `deleteEdges`
- [ ] Unit tests for each backend

---

### CPG-11: Integration Tests
**Component:** cpg-inference-ts
**Depends On:** CPG-9, CPG-10
**Estimate:** 6 hours

**Description:**
End-to-end tests with realistic codebases.

**Acceptance Criteria:**
- [ ] `tests/integration/` directory created
- [ ] Test fixtures: Sample TypeScript, JavaScript, Python codebases
- [ ] Test: Parse entire codebase → Build CPG → Query
- [ ] Test: Progressive updates (add/update/delete files)
- [ ] Test: Impact analysis across multiple files
- [ ] Test: Co-change prediction accuracy (with known co-changes)
- [ ] Test: Serialization and deserialization (save/load CPG)
- [ ] All tests pass with >80% coverage

**Test Example:**
```typescript
test('full codebase analysis workflow', async () => {
  const predictor = new CoChangePredictor(config);

  // Load sample codebase (10 files)
  for (const [path, content] of sampleCodebase) {
    await predictor.addFile(path, content);
  }

  // Verify CPG built correctly
  const stats = predictor.getStats();
  expect(stats.totalFiles).toBe(10);
  expect(stats.totalComponents).toBeGreaterThan(50);

  // Test impact analysis
  const impact = await predictor.analyzeChangeImpact(['src/main.ts::main'], 3);
  expect(impact.graphForward.length).toBeGreaterThan(5);
});
```

---

### CPG-12: Performance Benchmarks
**Component:** cpg-inference-ts
**Depends On:** CPG-11
**Estimate:** 4 hours

**Description:**
Benchmark against Python baseline to ensure parity.

**Acceptance Criteria:**
- [ ] `benchmarks/performance.test.ts` created
- [ ] Benchmark: Parse file (1000 LOC) - Target: <50ms
- [ ] Benchmark: Update file (CPG merge) - Target: <100ms
- [ ] Benchmark: Impact analysis (depth 3) - Target: <15ms
- [ ] Benchmark: Embedding generation - Target: <10ms
- [ ] Benchmark: FAISS search (10K index) - Target: <5ms
- [ ] Benchmark: Predict co-changes - Target: <40ms
- [ ] Results table comparing TypeScript vs Python
- [ ] All benchmarks meet or exceed targets

**Benchmark Output Format:**
```
CPG Library Performance Benchmarks
====================================
Operation                     | TypeScript | Python  | Target  | Status
------------------------------|------------|---------|---------|--------
Parse file (1000 LOC)         | 42ms       | 48ms    | <50ms   | ✅ PASS
Update file (CPG merge)       | 87ms       | 95ms    | <100ms  | ✅ PASS
Impact analysis (depth 3)     | 12ms       | 11ms    | <15ms   | ✅ PASS
Embedding generation          | 8ms        | 6ms     | <10ms   | ✅ PASS
FAISS search (10K index)      | 3ms        | 2ms     | <5ms    | ✅ PASS
Predict co-changes            | 35ms       | 32ms    | <40ms   | ✅ PASS
```

---

### CPG-13: Documentation and Examples
**Component:** cpg-inference-ts
**Depends On:** CPG-12
**Estimate:** 3 hours

**Description:**
Complete README and API documentation.

**Acceptance Criteria:**
- [ ] `README.md` includes:
  - Installation instructions
  - Quick start example
  - API reference
  - Performance characteristics
  - Migration guide from Python
- [ ] JSDoc comments on all public methods
- [ ] `examples/` directory with:
  - Basic usage example
  - Progressive file updates example
  - Impact analysis example
  - Co-change prediction example

---

## Phase 2: Analysis API Foundation (Week 3)

### API-1: Project Setup
**Component:** metabob-analysis-api
**Depends On:** PREREQ-3
**Estimate:** 2 hours

**Description:**
Set up TypeScript/Bun/Hono project.

**Acceptance Criteria:**
- [ ] `package.json` includes dependencies:
  - `hono` (HTTP framework)
  - `@hono/node-server` (Bun support)
  - SurrealDB client
  - Redis client
  - cpg-inference-ts (local path dependency)
- [ ] `tsconfig.json` configured
- [ ] `src/index.ts` with basic Hono app
- [ ] `bun run start` launches server on port 8080
- [ ] Health check endpoint: `GET /health` returns 200

---

### API-2: Database Clients
**Component:** metabob-analysis-api
**Depends On:** API-1, PREREQ-1, PREREQ-2
**Estimate:** 4 hours

**Description:**
Set up SurrealDB and Redis clients with connection pooling.

**Acceptance Criteria:**
- [ ] `src/db/surreal.ts` exports `SurrealDBClient` class
- [ ] `src/db/redis.ts` exports `RedisClient` class
- [ ] Environment variables for connection strings
- [ ] Connection retry logic (max 5 attempts)
- [ ] Health check methods: `surreal.ping()`, `redis.ping()`
- [ ] Graceful shutdown on SIGTERM
- [ ] Unit tests with mocked connections

**Environment Variables:**
```bash
SURREALDB_URL=http://surrealdb.activity-system.svc.cluster.local:8000
SURREALDB_NAMESPACE=activity_system
SURREALDB_DATABASE=learning_loop
SURREALDB_USERNAME=root
SURREALDB_PASSWORD=***
REDIS_URL=redis://redis-valkey.activity-system.svc.cluster.local:6379
```

---

### API-3: Middleware Stack
**Component:** metabob-analysis-api
**Depends On:** API-2
**Estimate:** 4 hours

**Description:**
Implement authentication, scope resolution, and rate limiting middleware.

**Acceptance Criteria:**
- [ ] `src/middleware/auth.ts`: Validate session tokens
- [ ] `src/middleware/scope.ts`: Resolve session → project → org
- [ ] `src/middleware/rate-limit.ts`: Redis-based rate limiting (60 req/min per session)
- [ ] `src/middleware/error-handler.ts`: Catch and format errors
- [ ] `src/middleware/logger.ts`: Structured JSON logging
- [ ] All middleware registered in `src/index.ts`
- [ ] Unit tests for each middleware

**Middleware Chain:**
```typescript
app.use('*', logger());
app.use('*', errorHandler());
app.use('/v2/*', auth());
app.use('/v2/*', scope());
app.use('/v2/*', rateLimit());
```

---

### API-4: Shared Models and Types
**Component:** metabob-analysis-api
**Depends On:** API-1
**Estimate:** 3 hours

**Description:**
Define TypeScript types and SurrealDB schemas.

**Acceptance Criteria:**
- [ ] `src/models/types.ts` with all TypeScript interfaces
- [ ] `src/models/schemas.ts` with SurrealDB table definitions
- [ ] Types match OpenSpec data schema specification
- [ ] Zod validators for request/response payloads
- [ ] Export all types for use across codebase

**Reference:** `openspec/changes/analysis-api-extraction/specs/data-schemas/spec.md`

---

## Phase 3: Core Tools Implementation (Week 4)

### API-5: CPGService
**Component:** metabob-analysis-api
**Depends On:** API-4, CPG-13
**Estimate:** 8 hours

**Description:**
Service layer for CPG lifecycle management.

**Acceptance Criteria:**
- [ ] `src/services/cpg-service.ts` created with `CPGService` class
- [ ] `getCPGForSession(sessionId)`: Load from cache or rebuild from DB
- [ ] `updateCPG(sessionId, files)`: Progressive file updates
- [ ] `analyzeImpact(sessionId, componentIds, maxDepth)`: Delegate to cpg-inference-ts
- [ ] Redis caching with 1-hour TTL
- [ ] Cache invalidation on file updates
- [ ] Unit tests with mocked CPG

**Cache Strategy:**
```typescript
async getCPGForSession(sessionId: string): Promise<CoChangePredictor> {
  // 1. Check Redis cache
  const cacheKey = `cpg:${sessionId}`;
  const cached = await this.redis.get(cacheKey);
  if (cached) {
    return this.deserializeCPG(cached);
  }

  // 2. Load from SurrealDB
  const components = await this.db.query(
    'SELECT * FROM code_components WHERE session_id = $session',
    { session: sessionId }
  );

  // 3. Rebuild CPG
  const cpg = await this.buildCPG(components);

  // 4. Cache for 1 hour
  await this.redis.setex(cacheKey, 3600, this.serializeCPG(cpg));

  return cpg;
}
```

---

### API-6: EmbeddingService
**Component:** metabob-analysis-api
**Depends On:** API-4, CPG-13
**Estimate:** 6 hours

**Description:**
Service layer for embedding generation and similarity search.

**Acceptance Criteria:**
- [ ] `src/services/embedding-service.ts` created with `EmbeddingService` class
- [ ] `generateEmbedding(text)`: Generate or retrieve from cache
- [ ] `searchSimilar(embedding, k, filters)`: FAISS search with filtering
- [ ] `indexComponent(componentId, embedding)`: Add to FAISS + persist to DB
- [ ] Redis caching for embeddings (24-hour TTL)
- [ ] Unit tests with mocked ONNX model

---

### API-7: GET /v2/analysis/priority (get_priority_issues)
**Component:** metabob-analysis-api
**Depends On:** API-5, API-6
**Estimate:** 6 hours

**Description:**
Implement priority issues endpoint.

**Acceptance Criteria:**
- [ ] `src/routes/priority.ts` created
- [ ] `GET /v2/analysis/priority` endpoint
- [ ] Query params: `limit`, `severity[]`, `category[]`, `scope`
- [ ] SurrealDB query with filters and impact score ranking
- [ ] Response matches OpenSpec schema
- [ ] Integration test with seed data
- [ ] Performance: <100ms P50

**Reference:** `openspec/changes/analysis-api-extraction/specs/mcp-tools/examples.md` (Example 1)

---

### API-8: POST /v2/analysis/search (search_codebase_issues)
**Component:** metabob-analysis-api
**Depends On:** API-6
**Estimate:** 8 hours

**Description:**
Implement semantic search endpoint.

**Acceptance Criteria:**
- [ ] `src/routes/search.ts` created
- [ ] `POST /v2/analysis/search` endpoint
- [ ] Generate embedding for query text
- [ ] FAISS similarity search
- [ ] Filter by scope, severity, category, file_pattern
- [ ] Join with component_annotations if available
- [ ] Response includes similarity scores
- [ ] Integration test with known queries
- [ ] Performance: <200ms P50

**Reference:** `openspec/changes/analysis-api-extraction/specs/mcp-tools/examples.md` (Example 2)

---

### API-9: AnnotationService
**Component:** metabob-analysis-api
**Depends On:** API-4
**Estimate:** 4 hours

**Description:**
Service layer for component annotations.

**Acceptance Criteria:**
- [ ] `src/services/annotation-service.ts` created with `AnnotationService` class
- [ ] `createAnnotation(componentId, content, type, tags)`: Insert into DB
- [ ] `getAnnotations(componentId)`: Retrieve all annotations for component
- [ ] `linkToProblem(annotationId, problemId)`: Create bidirectional link
- [ ] `updateComponentMetadata(componentId)`: Set last_annotated_at
- [ ] Trigger embedding update (async)
- [ ] Unit tests

---

### API-10: POST /v2/analysis/annotations (annotate_component)
**Component:** metabob-analysis-api
**Depends On:** API-9
**Estimate:** 4 hours

**Description:**
Implement component annotation endpoint.

**Acceptance Criteria:**
- [ ] `src/routes/annotations.ts` created
- [ ] `POST /v2/analysis/annotations` endpoint
- [ ] Validate component exists in CPG
- [ ] Insert annotation via AnnotationService
- [ ] Link to problem if provided
- [ ] Response includes annotation_id
- [ ] Integration test
- [ ] Performance: <50ms P50

**Reference:** `openspec/changes/analysis-api-extraction/specs/mcp-tools/examples.md` (Example 3)

---

### API-11: PUT /v2/analysis/problems/:id/complete (mark_problem_complete)
**Component:** metabob-analysis-api
**Depends On:** API-9
**Estimate:** 4 hours

**Description:**
Implement mark problem complete endpoint with auto-annotation.

**Acceptance Criteria:**
- [ ] `src/routes/problems.ts` created
- [ ] `PUT /v2/analysis/problems/:id/complete` endpoint
- [ ] Update problem status to "resolved"
- [ ] Store resolution_summary and fixed_in_commit
- [ ] Auto-create annotation if requested (default: true)
- [ ] Link problem ↔ annotation
- [ ] Response includes annotation details
- [ ] Integration test
- [ ] Performance: <100ms P50

**Reference:** `openspec/changes/analysis-api-extraction/specs/mcp-tools/examples.md` (Example 6)

---

### API-12: Integration Tests for Core Tools
**Component:** metabob-analysis-api
**Depends On:** API-7, API-8, API-10, API-11
**Estimate:** 4 hours

**Description:**
End-to-end tests for implemented endpoints.

**Acceptance Criteria:**
- [ ] `tests/integration/core-tools.test.ts` created
- [ ] Test: Get priority issues with filters
- [ ] Test: Search with semantic query
- [ ] Test: Create annotation and verify in DB
- [ ] Test: Mark problem complete and verify annotation created
- [ ] All tests pass
- [ ] Coverage >80% for routes and services

---

## Phase 4: Advanced Tools Implementation (Week 5-6)

### API-13: OnlineLearningService
**Component:** metabob-analysis-api
**Depends On:** API-4
**Estimate:** 8 hours

**Description:**
Service layer for online learning and pattern recognition.

**Acceptance Criteria:**
- [ ] `src/services/learning-service.ts` created with `OnlineLearningService` class
- [ ] `recordCochangeEvent(projectId, event)`: Store co-change event
- [ ] `updatePatternFrequencies(projectId, filePairs)`: Increment counters
- [ ] `updateModels(projectId)`: Recompute confidence scores
- [ ] `getCochangePatterns(projectId, changedFiles)`: Retrieve relevant patterns
- [ ] `recordFeedback(projectId, feedback)`: Store prediction accuracy
- [ ] Bayesian update for confidence scores
- [ ] Unit tests with synthetic events

**Bayesian Update Algorithm:**
```typescript
private computeConfidence(pattern: CochangePattern): number {
  const prior = 0.5; // Neutral prior
  const weight = 0.3; // Weight of observed data
  const observed = pattern.frequency / pattern.total_commits;
  return prior * (1 - weight) + observed * weight;
}
```

---

### API-14: POST /v2/analysis/cochange/suggest (suggest_related_changes)
**Component:** metabob-analysis-api
**Depends On:** API-5, API-6, API-13
**Estimate:** 10 hours

**Description:**
Implement co-change prediction endpoint (hybrid scoring).

**Acceptance Criteria:**
- [ ] `src/routes/cochange.ts` created
- [ ] `POST /v2/analysis/cochange/suggest` endpoint
- [ ] Generate embeddings for changed files
- [ ] FAISS search for similar files
- [ ] Load historical co-change patterns from DB
- [ ] Compute hybrid scores: `0.6 * emb_sim + 0.4 * freq`
- [ ] Filter by confidence threshold
- [ ] Record co-change event for learning
- [ ] Response includes affected components
- [ ] Integration test with known co-changes
- [ ] Performance: <300ms P50

**Hybrid Scoring:**
```typescript
function computeHybridScores(
  similarFiles: SimilarityResult[],
  patterns: CochangePattern[],
  config: { embeddingWeight: number; frequencyWeight: number; threshold: number }
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  for (const file of similarFiles) {
    const pattern = patterns.find(p => p.file_pairs.includes(file.filePath));
    const freqScore = pattern ? pattern.confidence : 0;
    const embScore = file.similarity;

    const hybridScore =
      config.embeddingWeight * embScore +
      config.frequencyWeight * freqScore;

    if (hybridScore >= config.threshold) {
      suggestions.push({
        file_path: file.filePath,
        confidence: hybridScore,
        reason: generateReason(embScore, freqScore, pattern),
        cochange_frequency: pattern?.frequency ?? 0,
        embedding_similarity: embScore,
        affected_components: file.components
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
```

**Reference:** `openspec/changes/analysis-api-extraction/specs/mcp-tools/examples.md` (Example 4)

---

### API-15: POST /v2/analysis/cochange/feedback
**Component:** metabob-analysis-api
**Depends On:** API-13
**Estimate:** 4 hours

**Description:**
Implement feedback endpoint for learning loop.

**Acceptance Criteria:**
- [ ] `POST /v2/analysis/cochange/feedback` endpoint in `src/routes/cochange.ts`
- [ ] Accept predicted files vs actually changed files
- [ ] Compute accuracy: `|predicted ∩ actual| / |predicted ∪ actual|`
- [ ] Store feedback event in DB
- [ ] Trigger immediate model update if accuracy <30%
- [ ] Response: `{ received: true }`
- [ ] Integration test
- [ ] Performance: <100ms P50

---

### API-16: POST /v2/analysis/impact (analyze_change_impact)
**Component:** metabob-analysis-api
**Depends On:** API-5
**Estimate:** 8 hours

**Description:**
Implement change impact analysis endpoint.

**Acceptance Criteria:**
- [ ] `src/routes/impact.ts` created
- [ ] `POST /v2/analysis/impact` endpoint
- [ ] Parse diff or use changed_files to identify modified components
- [ ] Traverse CPG forward (dependencies) and/or backward (dependents)
- [ ] Compute risk levels based on depth, criticality, annotations
- [ ] Identify affected tests
- [ ] Exclude files in changed_files from review list
- [ ] Response includes direct/indirect dependencies
- [ ] Integration test with known dependency chains
- [ ] Performance: <400ms P50

**Risk Level Computation:**
```typescript
function computeRiskLevel(node: ImpactNode, annotations: Annotation[]): RiskLevel {
  let score = 0;

  // Depth penalty
  if (node.depth === 1) score += 3;
  else if (node.depth === 2) score += 2;
  else score += 1;

  // No annotations = higher risk
  if (annotations.length === 0) score += 2;

  // Relationship type
  if (node.relationship === 'data_flow') score += 1;

  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}
```

**Reference:** `openspec/changes/analysis-api-extraction/specs/mcp-tools/examples.md` (Example 5)

---

### API-17: PatternService
**Component:** metabob-analysis-api
**Depends On:** API-4, API-5
**Estimate:** 6 hours

**Description:**
Service layer for design pattern detection.

**Acceptance Criteria:**
- [ ] `src/services/pattern-service.ts` created with `PatternService` class
- [ ] `detectPatterns(sessionId)`: Analyze CPG structure for common patterns
- [ ] Pattern detection: Singleton, Factory, Observer, Middleware Chain, Dependency Injection
- [ ] Store detected patterns in `design_patterns` table
- [ ] `getPatternsByType(patternName)`: Retrieve usage examples
- [ ] Unit tests with known pattern implementations

**Pattern Detection (Middleware Chain Example):**
```typescript
async detectMiddlewareChain(cpg: CodePropertyGraph): Promise<DesignPattern[]> {
  const patterns: DesignPattern[] = [];

  // Find functions that accept (req, res, next) parameters
  const middlewareFunctions = cpg.findNodesByName(/middleware|handler/i);

  for (const fn of middlewareFunctions) {
    const callees = cpg.getEdges(fn.id, 'out').filter(e => e.type === 'calls');

    // Middleware chains call next() or delegate to other middleware
    if (callees.some(c => c.to.includes('next'))) {
      patterns.push({
        pattern_name: 'Middleware Chain',
        component_id: fn.id,
        file_path: fn.filePath,
        metadata: { middlewareName: fn.name, delegates: callees.length }
      });
    }
  }

  return patterns;
}
```

---

### API-18: POST /v2/analysis/specs/generate (generate_implementation_spec)
**Component:** metabob-analysis-api
**Depends On:** API-5, API-17
**Estimate:** 12 hours

**Description:**
Implement specification generation endpoint (most complex tool).

**Acceptance Criteria:**
- [ ] `src/routes/specs.ts` created
- [ ] `POST /v2/analysis/specs/generate` endpoint
- [ ] Parse goal text to extract intent
- [ ] If entry_points provided, start CPG traversal there
- [ ] Otherwise, use semantic search to find relevant components
- [ ] Traverse CPG to understand data flow
- [ ] Load annotations for all involved components
- [ ] Detect design patterns
- [ ] Generate implementation order (topological sort)
- [ ] Produce data flow diagram (Mermaid or ASCII)
- [ ] Response includes components to modify/create
- [ ] Integration test with realistic goal
- [ ] Performance: <1s P50

**Specification Structure:**
```typescript
interface ImplementationSpec {
  goal: string;
  components_to_modify: Array<{
    component_id: string;
    file_path: string;
    reason: string;
    annotations: string[];
    data_flow: string[];
  }>;
  components_to_create: Array<{
    suggested_name: string;
    file_path: string;
    reason: string;
    similar_components: string[];
  }>;
  design_patterns: Array<{
    pattern_name: string;
    usage_examples: string[];
    recommendation: string;
  }>;
  data_flow_diagram: string;
  implementation_order: string[];
}
```

**Reference:** `openspec/changes/analysis-api-extraction/specs/mcp-tools/examples.md` (Example 7)

---

### API-19: Integration Tests for Advanced Tools
**Component:** metabob-analysis-api
**Depends On:** API-14, API-15, API-16, API-18
**Estimate:** 6 hours

**Description:**
End-to-end tests for advanced endpoints.

**Acceptance Criteria:**
- [ ] `tests/integration/advanced-tools.test.ts` created
- [ ] Test: Suggest co-changes with hybrid scoring
- [ ] Test: Provide feedback and verify learning
- [ ] Test: Analyze change impact with risk levels
- [ ] Test: Generate implementation spec from goal
- [ ] All tests pass
- [ ] Coverage >75% for routes and services

---

## Phase 5: MCP Server Implementation (Week 7)

### MCP-1: Project Setup
**Component:** metabob-mcp
**Depends On:** PREREQ-3
**Estimate:** 2 hours

**Description:**
Set up TypeScript/Bun project with MCP SDK.

**Acceptance Criteria:**
- [ ] `package.json` includes `@modelcontextprotocol/sdk`
- [ ] `tsconfig.json` configured
- [ ] `src/index.ts` with basic MCP server
- [ ] `bun run start` launches MCP server
- [ ] MCP initialization successful

---

### MCP-2: API Client
**Component:** metabob-mcp
**Depends On:** MCP-1
**Estimate:** 4 hours

**Description:**
HTTP client for communicating with metabob-analysis-api.

**Acceptance Criteria:**
- [ ] `src/api-client.ts` created with `AnalysisAPIClient` class
- [ ] `post<T>(endpoint, body)`: HTTP POST with JSON
- [ ] `get<T>(endpoint, params)`: HTTP GET with query params
- [ ] Error handling: Transform API errors to MCP errors
- [ ] Timeout: 30s default, configurable
- [ ] Retry logic: 3 attempts with exponential backoff
- [ ] Unit tests with mocked fetch

**Error Transformation:**
```typescript
async handleError(error: unknown): Promise<MCPError> {
  if (error instanceof APIError) {
    const errorMap: Record<string, MCPError> = {
      'SESSION_NOT_FOUND': {
        code: 'SESSION_EXPIRED',
        message: 'Session token is invalid or expired',
        suggestion: 'Please re-authenticate'
      },
      'COMPONENT_NOT_FOUND': {
        code: 'COMPONENT_NOT_FOUND',
        message: error.message,
        details: error.details,
        suggestion: 'Run search_codebase_issues to find valid component IDs'
      }
      // ... more mappings
    };
    return errorMap[error.code] || defaultError;
  }
  return { code: 'INTERNAL_ERROR', message: 'Unexpected error occurred' };
}
```

---

### MCP-3: Session Manager
**Component:** metabob-mcp
**Depends On:** MCP-1
**Estimate:** 3 hours

**Description:**
Manage MCP session context and scope resolution.

**Acceptance Criteria:**
- [ ] `src/session-manager.ts` created with `SessionManager` class
- [ ] `getSession(sessionId)`: Retrieve or create session context
- [ ] `resolveScope(sessionId, scope)`: Map "session"/"project"/"org" to IDs
- [ ] `trackUsage(sessionId, tool, latency)`: Record tool call metrics
- [ ] Session caching (in-memory, 1-hour expiry)
- [ ] Unit tests

---

### MCP-4: Tool Implementations (Part 1: Core)
**Component:** metabob-mcp
**Depends On:** MCP-2, MCP-3
**Estimate:** 8 hours

**Description:**
Implement first 4 MCP tools.

**Acceptance Criteria:**
- [ ] `src/tools/get-priority-issues.ts`: Map MCP params → API POST /v2/analysis/priority
- [ ] `src/tools/search-codebase.ts`: Map MCP params → API POST /v2/analysis/search
- [ ] `src/tools/annotate-component.ts`: Map MCP params → API POST /v2/analysis/annotations
- [ ] `src/tools/mark-complete.ts`: Map MCP params → API PUT /v2/analysis/problems/:id/complete
- [ ] Each tool handles errors and returns consistent MCP format
- [ ] `src/tools/index.ts` exports tool registry
- [ ] Unit tests for each tool

**Tool Structure:**
```typescript
// src/tools/get-priority-issues.ts
export async function getPriorityIssues(
  params: GetPriorityIssuesParams,
  context: MCPContext
): Promise<GetPriorityIssuesResult> {
  const apiClient = context.apiClient;
  const sessionId = await context.sessionManager.getSession(context.sessionId);

  try {
    const response = await apiClient.post<APIResponse>('/v2/analysis/priority', {
      ...params,
      session_id: sessionId
    });

    return transformToMCPFormat(response);
  } catch (error) {
    throw await apiClient.handleError(error);
  }
}
```

---

### MCP-5: Tool Implementations (Part 2: Advanced)
**Component:** metabob-mcp
**Depends On:** MCP-4
**Estimate:** 8 hours

**Description:**
Implement remaining 3 MCP tools.

**Acceptance Criteria:**
- [ ] `src/tools/suggest-changes.ts`: Map MCP params → API POST /v2/analysis/cochange/suggest
- [ ] `src/tools/analyze-impact.ts`: Map MCP params → API POST /v2/analysis/impact
- [ ] `src/tools/generate-spec.ts`: Map MCP params → API POST /v2/analysis/specs/generate
- [ ] Error handling for large responses (spec generation can be big)
- [ ] Streaming support for generate-spec (if response >100KB)
- [ ] Unit tests

---

### MCP-6: Integration Tests
**Component:** metabob-mcp
**Depends On:** MCP-5
**Estimate:** 6 hours

**Description:**
End-to-end MCP → API → Database flow tests.

**Acceptance Criteria:**
- [ ] `tests/integration/tool-flow.test.ts` created
- [ ] Test: Initialize MCP server → Call all 7 tools → Verify responses
- [ ] Test: Error handling (invalid session, component not found, etc.)
- [ ] Test: Rate limiting (exceed 60 req/min)
- [ ] Test: Session scope resolution
- [ ] All tests pass
- [ ] Coverage >80%

**Test Example:**
```typescript
test('end-to-end: get priority issues', async () => {
  // Setup: Seed database with test data
  const sessionId = await seedTestSession();

  // Execute: Call MCP tool
  const result = await mcpServer.callTool('get_priority_issues', {
    limit: 5,
    severity: ['HIGH'],
    scope: 'session'
  });

  // Verify: Check response format and content
  expect(result.issues).toHaveLength(5);
  expect(result.issues[0].severity).toBe('HIGH');
  expect(result.issues[0].priority_rank).toBe(1);
});
```

---

## Phase 6: Deployment (Week 8)

### DEPLOY-1: Docker Images
**Component:** All
**Depends On:** API-19, MCP-6
**Estimate:** 4 hours

**Description:**
Create Dockerfiles for all components.

**Acceptance Criteria:**
- [ ] `repos/metabob-analysis-api/Dockerfile` created (multi-stage build)
- [ ] `repos/metabob-mcp/Dockerfile` created (lightweight)
- [ ] Images build successfully with Bun base image
- [ ] Images tagged: `metabob-analysis-api:latest`, `metabob-mcp:latest`
- [ ] Images <500MB each
- [ ] Health checks defined in Dockerfiles

**Dockerfile Example (Analysis API):**
```dockerfile
FROM oven/bun:1 as build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun build src/index.ts --target bun --outdir dist

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD bun run healthcheck || exit 1
CMD ["bun", "run", "dist/index.js"]
```

---

### DEPLOY-2: Helm Charts
**Component:** Infrastructure
**Depends On:** DEPLOY-1
**Estimate:** 8 hours

**Description:**
Create Helm chart for analysis system deployment.

**Acceptance Criteria:**
- [ ] `helm/charts/analysis-system/` directory created
- [ ] `Chart.yaml` with dependencies
- [ ] `values.yaml` with all configuration options
- [ ] StatefulSet template for metabob-analysis-api (3 replicas)
- [ ] Deployment template for metabob-mcp (3 replicas)
- [ ] Service templates (ClusterIP)
- [ ] ConfigMap templates for environment variables
- [ ] Secret templates for API keys
- [ ] PVC templates for FAISS indexes (10GB)
- [ ] `helm lint` passes
- [ ] `helm template` renders correctly

**Values Structure:**
```yaml
# values.yaml
analysisApi:
  image:
    repository: metabob-analysis-api
    tag: latest
  replicas: 3
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 2000m
      memory: 4Gi
  storage:
    size: 10Gi

mcp:
  image:
    repository: metabob-mcp
    tag: latest
  replicas: 3
  resources:
    requests:
      cpu: 250m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi

surrealdb:
  enabled: false  # Reuse existing
redis:
  enabled: false  # Reuse existing

ingress:
  enabled: true
  hosts:
    - host: analysis.minibob.local
      paths:
        - /v2/analysis
```

---

### DEPLOY-3: Helmfile Configuration
**Component:** Infrastructure
**Depends On:** DEPLOY-2
**Estimate:** 4 hours

**Description:**
Add analysis-system to helmfile deployment.

**Acceptance Criteria:**
- [ ] `helm/helmfile-analysis-system.yaml` created
- [ ] Depends on: SurrealDB, Redis/Valkey
- [ ] Environment-specific values in `environments/`
- [ ] Secrets management via environment variables
- [ ] `helmfile lint` passes
- [ ] `helmfile diff` shows expected changes

**Helmfile Structure:**
```yaml
# helmfile-analysis-system.yaml
releases:
  - name: analysis-system
    namespace: activity-system
    chart: ./charts/analysis-system
    values:
      - environments/{{ .Environment.Name }}/analysis-system.values.yaml
    needs:
      - activity-system/surrealdb
      - activity-system/valkey
    hooks:
      - events: ["presync"]
        command: "bash"
        args: ["./scripts/check-dependencies.sh"]
```

---

### DEPLOY-4: Istio Gateway Configuration
**Component:** Infrastructure
**Depends On:** DEPLOY-2
**Estimate:** 3 hours

**Description:**
Configure Istio for external access.

**Acceptance Criteria:**
- [ ] Gateway resource: `analysis-gateway` on port 80
- [ ] VirtualService: `analysis.minibob.local` → metabob-analysis-api:8080
- [ ] DestinationRule: Circuit breaking, retries
- [ ] AuthorizationPolicy: JWT validation (if enabled)
- [ ] Test external access: `curl http://analysis.minibob.local/health`

**VirtualService Example:**
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: analysis-api
  namespace: activity-system
spec:
  hosts:
  - "analysis.minibob.local"
  gateways:
  - analysis-gateway
  http:
  - match:
    - uri:
        prefix: "/v2/analysis"
    route:
    - destination:
        host: metabob-analysis-api
        port:
          number: 8080
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
```

---

### DEPLOY-5: Deployment Script
**Component:** Infrastructure
**Depends On:** DEPLOY-3, DEPLOY-4
**Estimate:** 3 hours

**Description:**
Create automated deployment script.

**Acceptance Criteria:**
- [ ] `helm/deploy-analysis-system.sh` script created
- [ ] Checks: Docker images built, dependencies ready
- [ ] Builds images if needed
- [ ] Applies helmfile sync
- [ ] Waits for rollout completion
- [ ] Runs health checks
- [ ] Prints access URLs
- [ ] Script is idempotent (safe to run multiple times)

**Script Outline:**
```bash
#!/bin/bash
set -euo pipefail

echo "=== Analysis System Deployment ==="

# 1. Check prerequisites
echo "Checking prerequisites..."
kubectl cluster-info || { echo "Kubernetes not accessible"; exit 1; }
helm version || { echo "Helm not installed"; exit 1; }

# 2. Build Docker images
echo "Building Docker images..."
cd repos/metabob-analysis-api && docker build -t metabob-analysis-api:latest .
cd ../metabob-mcp && docker build -t metabob-mcp:latest .

# 3. Deploy via helmfile
echo "Deploying via helmfile..."
cd ../../helm
helmfile -f helmfile-analysis-system.yaml sync

# 4. Wait for rollout
echo "Waiting for rollout..."
kubectl rollout status statefulset/metabob-analysis-api -n activity-system --timeout=300s
kubectl rollout status deployment/metabob-mcp -n activity-system --timeout=300s

# 5. Health checks
echo "Running health checks..."
curl -f http://analysis.minibob.local/health || { echo "Health check failed"; exit 1; }

echo "=== Deployment Complete ==="
echo "API: http://analysis.minibob.local/v2/analysis"
```

---

### DEPLOY-6: Integration Tests in Cluster
**Component:** Infrastructure
**Depends On:** DEPLOY-5
**Estimate:** 4 hours

**Description:**
Run integration tests against deployed services.

**Acceptance Criteria:**
- [ ] `tests/cluster/` directory created
- [ ] Test script: `test-deployed-analysis-system.sh`
- [ ] Test: Health check endpoint
- [ ] Test: Create session → Get priority issues
- [ ] Test: Annotate component → Verify in DB
- [ ] Test: Suggest co-changes → Check response format
- [ ] All tests pass
- [ ] Script exits with code 0 on success

**Test Script Example:**
```bash
#!/bin/bash
API_URL="http://analysis.minibob.local"

# Test 1: Health check
echo "Test 1: Health check"
curl -f "$API_URL/health" || exit 1

# Test 2: Get priority issues
echo "Test 2: Get priority issues"
RESULT=$(curl -s "$API_URL/v2/analysis/priority?limit=5" | jq '.issues | length')
[[ "$RESULT" -gt 0 ]] || { echo "No issues returned"; exit 1; }

# Test 3: MCP tool call (via test client)
echo "Test 3: MCP tool call"
# ... MCP client test code ...

echo "All tests passed!"
```

---

## Phase 7: Documentation and Validation (Ongoing)

### DOC-1: API Documentation
**Component:** metabob-analysis-api
**Depends On:** API-19
**Estimate:** 4 hours

**Description:**
Create OpenAPI/Swagger documentation.

**Acceptance Criteria:**
- [ ] `docs/openapi.yaml` created with all endpoints
- [ ] Swagger UI accessible at `/docs`
- [ ] Request/response schemas documented
- [ ] Example requests for each endpoint
- [ ] Error codes documented

---

### DOC-2: MCP Tool Documentation
**Component:** metabob-mcp
**Depends On:** MCP-6
**Estimate:** 3 hours

**Description:**
Create MCP tool usage guide.

**Acceptance Criteria:**
- [ ] `README.md` with tool descriptions
- [ ] Usage examples for each tool
- [ ] Error handling guide
- [ ] Configuration options
- [ ] Integration with Claude/Cursor instructions

---

### DOC-3: Deployment Guide
**Component:** Infrastructure
**Depends On:** DEPLOY-6
**Estimate:** 4 hours

**Description:**
Create comprehensive deployment documentation.

**Acceptance Criteria:**
- [ ] `DEPLOYMENT.md` with step-by-step instructions
- [ ] Prerequisites listed
- [ ] Environment variable reference
- [ ] Troubleshooting guide
- [ ] Rollback procedures
- [ ] Monitoring and alerting setup

---

### DOC-4: Migration Guide
**Component:** All
**Depends On:** API-19
**Estimate:** 3 hours

**Description:**
Document migration from Python RPC API.

**Acceptance Criteria:**
- [ ] `MIGRATION.md` created
- [ ] API endpoint mapping (Python → TypeScript)
- [ ] Breaking changes documented
- [ ] Data migration strategy (if needed)
- [ ] Deprecation timeline

---

### VALID-1: Performance Benchmarking
**Component:** All
**Depends On:** DEPLOY-6
**Estimate:** 6 hours

**Description:**
Run performance benchmarks and validate targets.

**Acceptance Criteria:**
- [ ] Load testing script: `benchmarks/load-test.sh`
- [ ] Test all 7 MCP tools under load (100 concurrent requests)
- [ ] Measure P50/P99 latencies
- [ ] Verify all targets met (see design.md performance targets)
- [ ] Generate report: `benchmarks/report.md`

**Load Test Example:**
```bash
# Using k6 for load testing
k6 run --vus 100 --duration 60s benchmarks/get-priority-issues.js
k6 run --vus 50 --duration 60s benchmarks/suggest-changes.js
```

---

### VALID-2: Data Persistence Validation
**Component:** Infrastructure
**Depends On:** DEPLOY-6
**Estimate:** 3 hours

**Description:**
Verify data survives pod restarts.

**Acceptance Criteria:**
- [ ] Test script: `tests/persistence/validate-survivability.sh`
- [ ] Test: Create session → Add analysis problems → Restart pod → Verify data exists
- [ ] Test: Build CPG → Restart pod → Verify CPG rebuilt from DB
- [ ] Test: Create annotations → Restart pod → Verify annotations persisted
- [ ] All tests pass

**Test Script:**
```bash
#!/bin/bash

# 1. Seed data
SESSION_ID=$(curl -s "$API_URL/v2/sessions" -X POST | jq -r '.session_id')
curl -s "$API_URL/v2/analysis/annotations" -X POST -d "{\"component_id\":\"test\", ...}"

# 2. Restart pod
kubectl delete pod -n activity-system -l app=metabob-analysis-api --force --grace-period=0
kubectl wait --for=condition=ready pod -n activity-system -l app=metabob-analysis-api --timeout=60s

# 3. Verify data
RESULT=$(curl -s "$API_URL/v2/analysis/priority?session_id=$SESSION_ID" | jq '.issues | length')
[[ "$RESULT" -gt 0 ]] || { echo "Data lost after restart!"; exit 1; }

echo "Data persistence validated!"
```

---

### VALID-3: Online Learning Validation
**Component:** metabob-analysis-api
**Depends On:** API-19
**Estimate:** 6 hours

**Description:**
Verify online learning improves predictions over time.

**Acceptance Criteria:**
- [ ] Test script: `tests/learning/validate-improvement.sh`
- [ ] Simulate 20 commits with known co-change patterns
- [ ] Track prediction accuracy over time
- [ ] Verify accuracy improves (baseline <50% → final >70%)
- [ ] Test feedback loop (provide corrections → accuracy improves)
- [ ] Generate learning curve chart

**Test Scenario:**
```typescript
// 1. Initial state (no learning)
const baseline = await measurePredictionAccuracy(commits[0:5]);
expect(baseline).toBeLessThan(0.5); // Random baseline

// 2. Simulate 10 commits (learning)
for (const commit of commits.slice(5, 15)) {
  await simulateCommit(commit);
  await provideFeedback(commit.actual_changes);
}

// 3. Final state (learned)
const final = await measurePredictionAccuracy(commits[15:20]);
expect(final).toBeGreaterThan(0.7); // Learned patterns
```

---

## Summary

**Total Tasks:** 65
**Estimated Timeline:** 8 weeks

**Breakdown by Phase:**
- Phase 0: Prerequisites (3 tasks, ~4 hours)
- Phase 1: CPG Library (13 tasks, ~80 hours)
- Phase 2: API Foundation (4 tasks, ~13 hours)
- Phase 3: Core Tools (8 tasks, ~38 hours)
- Phase 4: Advanced Tools (7 tasks, ~54 hours)
- Phase 5: MCP Server (6 tasks, ~31 hours)
- Phase 6: Deployment (6 tasks, ~26 hours)
- Phase 7: Documentation/Validation (9 tasks, ~29 hours)

**Critical Path:**
1. PREREQ-1 → CPG-1 → CPG-2 → CPG-3 → CPG-8 → CPG-9 → API-5 → API-14 → MCP-5 → DEPLOY-5 → VALID-3

**Parallelization Opportunities:**
- CPG-4 (GraphQueryEngine) and CPG-5 (Parsers) can run in parallel after CPG-3
- API-7, API-8, API-10, API-11 (Core Tools) can run in parallel after API-6
- DOC-1, DOC-2, DOC-3 can run in parallel after implementation complete

**Risk Mitigation:**
- Early benchmarking (CPG-12) catches performance issues before integration
- Integration tests after each phase prevent cascade failures
- Docker builds (DEPLOY-1) happen before Helm charts to validate build process
