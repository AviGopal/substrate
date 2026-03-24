# metabob-analysis-api - Implementation Tasks

**Status:** Draft
**Created:** 2026-03-23
**Last Updated:** 2026-03-23
**Repo:** `repos/metabob-analysis-api`

---

## Overview

This document defines implementation tasks for the metabob-analysis-api backend service. Tasks are organized by dependency order and focus on building the HTTP API layer that orchestrates analysis operations using `cpg-inference-ts` and `@metabob/minibob`.

**Total Tasks:** ~25
**Estimated Timeline:** 2 weeks (Week 3-4)

---

## Task Organization

Each task includes:
- **ID:** Unique identifier (API-N)
- **Depends On:** Prerequisites (by task ID or external dependency)
- **Estimate:** Rough time estimate
- **Acceptance Criteria:** How to verify completion

**External Dependencies:**
- `cpg-inference-ts`: MUST be completed before starting (see `cpg-inference-ts/tasks.md`)
- `@metabob/minibob`: Already available as library dependency

---

## Phase 2: Analysis API Foundation (Week 3, Days 1-2)

### API-1: Project Setup
**Depends On:** cpg-inference-ts (complete)
**Estimate:** 2 hours

**Description:**
Set up TypeScript/Bun/Hono project with all dependencies.

**Acceptance Criteria:**
- [ ] `repos/metabob-analysis-api/` directory exists with structure:
  ```
  repos/metabob-analysis-api/
  ├── src/
  │   ├── index.ts
  │   ├── db/
  │   ├── models/
  │   ├── routes/
  │   ├── services/
  │   └── middleware/
  ├── tests/
  ├── sql/
  ├── package.json
  ├── tsconfig.json
  ├── Dockerfile
  └── README.md
  ```
- [ ] `package.json` includes dependencies:
  - `hono` (HTTP framework)
  - `@hono/node-server` (Bun support)
  - `@metabob/minibob` (activity execution)
  - `cpg-inference-ts` (local path: `../cpg-inference-ts`)
  - `@surrealdb/driver` (database client)
  - `redis` or `ioredis` (cache client)
- [ ] `tsconfig.json` configured with strict mode
- [ ] `src/index.ts` with basic Hono app
- [ ] `bun run start` launches server on port 8080
- [ ] Health check endpoint: `GET /health` returns `{ status: "ok" }`

**Commands:**
```bash
cd repos/metabob-analysis-api
bun install
bun run start

# Verify
curl http://localhost:8080/health
```

---

### API-2: Database Clients
**Depends On:** API-1
**Estimate:** 4 hours

**Description:**
Set up SurrealDB and Redis clients with connection pooling and retry logic.

**Acceptance Criteria:**
- [ ] `src/db/surreal.ts` exports `SurrealDBClient` class
  - Connection string from environment: `SURREALDB_URL`
  - Namespace/database from environment
  - Connection retry logic (max 5 attempts, exponential backoff)
  - Health check method: `ping()` returns boolean
  - Query wrapper: `query<T>(sql, vars)` with error handling
- [ ] `src/db/redis.ts` exports `RedisClient` class
  - Connection string from environment: `REDIS_URL`
  - Connection retry logic
  - Health check method: `ping()` returns boolean
  - Common operations: `get`, `set`, `setex`, `del`, `scan`
- [ ] Both clients initialized in `src/index.ts`
- [ ] Graceful shutdown on SIGTERM (close connections)
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

**Validation:**
```bash
# Test database connections
bun test src/db/

# Check logs for successful connection
bun run start 2>&1 | grep "Database connected"
```

---

### API-3: Middleware Stack
**Depends On:** API-2
**Estimate:** 4 hours

**Description:**
Implement authentication, scope resolution, rate limiting, and error handling middleware.

**Acceptance Criteria:**
- [ ] `src/middleware/auth.ts`: Validate session tokens
  - Extract `session_id` from headers or query params
  - Validate against SurrealDB sessions table
  - Attach session context to request
- [ ] `src/middleware/scope.ts`: Resolve session → project → org hierarchy
  - Query SurrealDB for relationships
  - Attach `orgId`, `projectId`, `sessionId` to request context
- [ ] `src/middleware/rate-limit.ts`: Redis-based rate limiting
  - 60 requests/minute per session_id
  - Return 429 with `Retry-After` header
- [ ] `src/middleware/error-handler.ts`: Catch and format errors
  - Transform exceptions to consistent JSON format
  - Log errors with structured logging
- [ ] `src/middleware/logger.ts`: Structured JSON logging
  - Request/response logging
  - Duration tracking
  - Log levels: DEBUG, INFO, WARN, ERROR
- [ ] All middleware registered in `src/index.ts`
- [ ] Unit tests for each middleware

**Middleware Chain:**
```typescript
app.use('*', logger());
app.use('*', errorHandler());
app.use('/v2/analysis/*', auth());
app.use('/v2/analysis/*', scope());
app.use('/v2/analysis/*', rateLimit());
```

**Error Response Format:**
```typescript
{
  error: {
    code: "SESSION_NOT_FOUND",
    message: "Session token is invalid or expired",
    details?: { ... },
    suggestion?: "Please re-authenticate"
  }
}
```

---

### API-4: Shared Models and Types
**Depends On:** API-1
**Estimate:** 3 hours

**Description:**
Define TypeScript types and Zod validators for all API requests/responses.

**Acceptance Criteria:**
- [ ] `src/models/types.ts` with TypeScript interfaces:
  - `PriorityIssue`, `SearchResult`, `Annotation`, `CochangeSuggestion`
  - `ImpactAnalysis`, `ImplementationSpec`, `Problem`
  - Match OpenSpec data schema specification
- [ ] `src/models/schemas.ts` with Zod validators:
  - Request schemas: `GetPriorityIssuesRequest`, `SearchRequest`, etc.
  - Response schemas: `GetPriorityIssuesResponse`, `SearchResponse`, etc.
  - Validation helpers: `validateRequest<T>(schema, data)`
- [ ] Export all types and schemas for use across codebase
- [ ] JSDoc comments on all interfaces

**Example:**
```typescript
// types.ts
export interface PriorityIssue {
  problem_id: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  component_id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  description: string;
  impact_score: number;
  priority_rank: number;
}

// schemas.ts
import { z } from 'zod';

export const GetPriorityIssuesRequestSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
  severity: z.array(z.enum(['HIGH', 'MEDIUM', 'LOW'])).optional(),
  category: z.array(z.string()).optional(),
  scope: z.enum(['session', 'project', 'org']).default('session')
});
```

---

## Phase 3: Core Tools Implementation (Week 3, Days 3-5)

### API-5: CPGService
**Depends On:** API-4, cpg-inference-ts (complete)
**Estimate:** 8 hours

**Description:**
Service layer for CPG lifecycle management with Redis caching.

**Acceptance Criteria:**
- [ ] `src/services/cpg-service.ts` created with `CPGService` class
- [ ] `getCPGForSession(sessionId)`: Load from cache or rebuild from DB
  - Check Redis cache first (key: `cpg:${sessionId}`)
  - If miss, query SurrealDB for components
  - Rebuild CPG using `cpg-inference-ts`
  - Cache serialized CPG with 1-hour TTL
- [ ] `updateCPG(sessionId, files)`: Progressive file updates
  - Load existing CPG
  - Call `cpg.updateFile(path, content)` for each changed file
  - Invalidate cache
  - Return update summary
- [ ] `analyzeImpact(sessionId, componentIds, maxDepth)`: Delegate to cpg-inference-ts
  - Load CPG for session
  - Call `cpg.analyzeChangeImpact(componentIds, maxDepth)`
  - Return impact analysis with forward/backward dependencies
- [ ] Cache invalidation on file updates
- [ ] Unit tests with mocked CPG and Redis

**Cache Strategy Example:**
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
**Depends On:** API-4, cpg-inference-ts (complete)
**Estimate:** 6 hours

**Description:**
Service layer for embedding generation and FAISS similarity search.

**Acceptance Criteria:**
- [ ] `src/services/embedding-service.ts` created with `EmbeddingService` class
- [ ] `generateEmbedding(text)`: Generate or retrieve from cache
  - Check Redis cache (key: `embedding:${hash(text)}`)
  - If miss, use cpg-inference-ts ONNX model
  - Cache with 24-hour TTL
- [ ] `searchSimilar(embedding, k, filters)`: FAISS search with filtering
  - Query FAISS index via cpg-inference-ts
  - Apply post-search filters (severity, category, file_pattern)
  - Return top-k results with similarity scores
- [ ] `indexComponent(componentId, embedding)`: Add to FAISS + persist to DB
  - Update in-memory FAISS index
  - Store in SurrealDB `embeddings` table
  - Async operation (don't block caller)
- [ ] Redis caching for embeddings (24-hour TTL)
- [ ] Unit tests with mocked ONNX model and FAISS

**Performance Target:** <10ms for generateEmbedding (cached), <50ms (uncached)

---

### API-7: GET /v2/analysis/priority (get_priority_issues)
**Depends On:** API-5, API-6
**Estimate:** 6 hours

**Description:**
Implement priority issues endpoint with filtering and ranking.

**Acceptance Criteria:**
- [ ] `src/routes/priority.ts` created
- [ ] `GET /v2/analysis/priority` endpoint
- [ ] Query params: `limit`, `severity[]`, `category[]`, `scope`
- [ ] SurrealDB query with filters:
  - Filter by scope (session/project/org)
  - Filter by severity and category if provided
  - Order by `impact_score DESC, severity DESC`
  - Limit results
- [ ] Response matches OpenSpec schema (see `PriorityIssue` type)
- [ ] Attach to Hono app in `src/index.ts`
- [ ] Integration test with seed data
- [ ] Performance: <100ms P50

**Example Query:**
```typescript
const query = `
  SELECT * FROM analysis_problems
  WHERE session_id = $session
    ${filters.severity ? 'AND severity IN $severity' : ''}
    ${filters.category ? 'AND category IN $category' : ''}
  ORDER BY impact_score DESC, severity DESC
  LIMIT $limit
`;
```

**Validation:**
```bash
curl "http://localhost:8080/v2/analysis/priority?limit=5&severity=HIGH&scope=session"
```

---

### API-8: POST /v2/analysis/search (search_codebase_issues)
**Depends On:** API-6
**Estimate:** 8 hours

**Description:**
Implement semantic search endpoint using embeddings and FAISS.

**Acceptance Criteria:**
- [ ] `src/routes/search.ts` created
- [ ] `POST /v2/analysis/search` endpoint
- [ ] Request body: `{ query, limit, filters: { severity?, category?, file_pattern?, scope } }`
- [ ] Generate embedding for query text via EmbeddingService
- [ ] FAISS similarity search via EmbeddingService
- [ ] Filter results by scope, severity, category, file_pattern
- [ ] Join with `component_annotations` if available
- [ ] Response includes similarity scores
- [ ] Attach to Hono app
- [ ] Integration test with known queries
- [ ] Performance: <200ms P50

**Example:**
```typescript
app.post('/v2/analysis/search', async (c) => {
  const { query, limit, filters } = await c.req.json();

  // Generate embedding
  const embedding = await embeddingService.generateEmbedding(query);

  // Search FAISS
  const results = await embeddingService.searchSimilar(embedding, limit * 2, filters);

  // Enrich with annotations
  const enriched = await enrichWithAnnotations(results);

  return c.json({ results: enriched.slice(0, limit) });
});
```

**Validation:**
```bash
curl -X POST http://localhost:8080/v2/analysis/search \
  -H "Content-Type: application/json" \
  -d '{"query": "memory leak in event handler", "limit": 10}'
```

---

### API-9: AnnotationService
**Depends On:** API-4
**Estimate:** 4 hours

**Description:**
Service layer for component annotations with bidirectional linking.

**Acceptance Criteria:**
- [ ] `src/services/annotation-service.ts` created with `AnnotationService` class
- [ ] `createAnnotation(componentId, content, type, tags)`: Insert into DB
  - Validate component exists
  - Generate annotation ID
  - Insert into `component_annotations` table
  - Update component's `last_annotated_at` timestamp
  - Trigger embedding update (async)
  - Return annotation record
- [ ] `getAnnotations(componentId)`: Retrieve all annotations for component
  - Query by component_id
  - Order by created_at DESC
  - Return array of annotations
- [ ] `linkToProblem(annotationId, problemId)`: Create bidirectional link
  - Update annotation with problem_id
  - Update problem with annotation_id
  - Store in graph relationship table
- [ ] `updateComponentMetadata(componentId)`: Set last_annotated_at
- [ ] Unit tests with mocked database

**Annotation Types:** `solution`, `explanation`, `warning`, `best_practice`, `refactor_note`

---

### API-10: POST /v2/analysis/annotations (annotate_component)
**Depends On:** API-9
**Estimate:** 4 hours

**Description:**
Implement component annotation endpoint.

**Acceptance Criteria:**
- [ ] `src/routes/annotations.ts` created
- [ ] `POST /v2/analysis/annotations` endpoint
- [ ] Request body: `{ component_id, content, type, tags?, link_to_problem_id? }`
- [ ] Validate component exists in CPG (via CPGService)
- [ ] Insert annotation via AnnotationService
- [ ] Link to problem if `link_to_problem_id` provided
- [ ] Response includes `annotation_id` and created record
- [ ] Attach to Hono app
- [ ] Integration test
- [ ] Performance: <50ms P50

**Example:**
```typescript
app.post('/v2/analysis/annotations', async (c) => {
  const data = await c.req.json();

  // Validate component exists
  const cpg = await cpgService.getCPGForSession(data.session_id);
  if (!cpg.hasComponent(data.component_id)) {
    return c.json({ error: "Component not found" }, 404);
  }

  // Create annotation
  const annotation = await annotationService.createAnnotation(
    data.component_id,
    data.content,
    data.type,
    data.tags
  );

  // Link to problem if provided
  if (data.link_to_problem_id) {
    await annotationService.linkToProblem(annotation.id, data.link_to_problem_id);
  }

  return c.json({ annotation_id: annotation.id, annotation });
});
```

**Validation:**
```bash
curl -X POST http://localhost:8080/v2/analysis/annotations \
  -H "Content-Type: application/json" \
  -d '{
    "component_id": "src/main.ts::handleRequest",
    "content": "Fixed race condition by adding mutex",
    "type": "solution",
    "tags": ["concurrency", "bugfix"]
  }'
```

---

### API-11: PUT /v2/analysis/problems/:id/complete (mark_problem_complete)
**Depends On:** API-9
**Estimate:** 4 hours

**Description:**
Implement mark problem complete endpoint with auto-annotation.

**Acceptance Criteria:**
- [ ] `src/routes/problems.ts` created
- [ ] `PUT /v2/analysis/problems/:id/complete` endpoint
- [ ] Request body: `{ resolution_summary, fixed_in_commit?, auto_annotate? }`
- [ ] Update problem status to "resolved"
- [ ] Store `resolution_summary` and `fixed_in_commit`
- [ ] Set `resolved_at` timestamp
- [ ] If `auto_annotate` (default: true), create annotation automatically
  - Content: resolution_summary
  - Type: "solution"
  - Link problem ↔ annotation
- [ ] Response includes problem record + annotation details (if created)
- [ ] Attach to Hono app
- [ ] Integration test
- [ ] Performance: <100ms P50

**Example:**
```typescript
app.put('/v2/analysis/problems/:id/complete', async (c) => {
  const problemId = c.req.param('id');
  const { resolution_summary, fixed_in_commit, auto_annotate = true } = await c.req.json();

  // Update problem
  const problem = await db.query(
    `UPDATE analysis_problems:${problemId} SET
      status = 'resolved',
      resolution_summary = $summary,
      fixed_in_commit = $commit,
      resolved_at = time::now()
    RETURN AFTER`,
    { summary: resolution_summary, commit: fixed_in_commit }
  );

  let annotation = null;
  if (auto_annotate) {
    annotation = await annotationService.createAnnotation(
      problem.component_id,
      resolution_summary,
      'solution',
      ['auto-generated', 'problem-resolution']
    );
    await annotationService.linkToProblem(annotation.id, problemId);
  }

  return c.json({ problem, annotation });
});
```

---

### API-12: Integration Tests for Core Tools
**Depends On:** API-7, API-8, API-10, API-11
**Estimate:** 4 hours

**Description:**
End-to-end tests for implemented core endpoints.

**Acceptance Criteria:**
- [ ] `tests/integration/core-tools.test.ts` created
- [ ] Test: Get priority issues with filters
  - Seed database with test problems
  - Query with various filters
  - Verify results match expectations
  - Verify ordering (impact_score DESC)
- [ ] Test: Search with semantic query
  - Seed with components and embeddings
  - Search for known patterns
  - Verify similarity scores
  - Verify filtering works
- [ ] Test: Create annotation and verify in DB
  - Create annotation via API
  - Query database directly
  - Verify annotation exists and is linked
- [ ] Test: Mark problem complete and verify annotation created
  - Create problem
  - Mark as complete
  - Verify auto-annotation created and linked
- [ ] All tests pass
- [ ] Coverage >80% for routes and services

**Test Setup:**
```typescript
beforeAll(async () => {
  // Start test database
  await startTestSurrealDB();
  await startTestRedis();

  // Seed test data
  await seedTestSession();
  await seedTestComponents();
  await seedTestProblems();
});
```

---

## Phase 4: Advanced Tools Implementation (Week 4)

### API-13: OnlineLearningService
**Depends On:** API-4
**Estimate:** 8 hours

**Description:**
Service layer for online learning and pattern recognition (co-change predictions).

**Acceptance Criteria:**
- [ ] `src/services/learning-service.ts` created with `OnlineLearningService` class
- [ ] `recordCochangeEvent(projectId, event)`: Store co-change event
  - Extract file pairs from event
  - Increment frequency counters in `cochange_patterns` table
  - Store event in `cochange_events` table
  - Return event ID
- [ ] `updatePatternFrequencies(projectId, filePairs)`: Increment counters
  - Upsert pattern records (create if not exists)
  - Increment `frequency` field
  - Increment `total_commits` for project
  - Update `last_seen` timestamp
- [ ] `updateModels(projectId)`: Recompute confidence scores
  - Query all patterns for project
  - Apply Bayesian update: `confidence = prior * (1 - weight) + observed * weight`
  - Store updated confidence scores
- [ ] `getCochangePatterns(projectId, changedFiles)`: Retrieve relevant patterns
  - Query patterns involving any of the changed files
  - Filter by confidence threshold
  - Order by confidence DESC
  - Return patterns with metadata
- [ ] `recordFeedback(projectId, feedback)`: Store prediction accuracy
  - Compare predicted vs actual changes
  - Compute accuracy: `|predicted ∩ actual| / |predicted ∪ actual|`
  - Store feedback event
  - Trigger model update if accuracy <30%
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
**Depends On:** API-5, API-6, API-13
**Estimate:** 10 hours

**Description:**
Implement co-change prediction endpoint with hybrid scoring (embeddings + historical patterns).

**Acceptance Criteria:**
- [ ] `src/routes/cochange.ts` created
- [ ] `POST /v2/analysis/cochange/suggest` endpoint
- [ ] Request body: `{ changed_files, limit, threshold?, config? }`
- [ ] Generate embeddings for changed files via EmbeddingService
- [ ] FAISS search for similar files
- [ ] Load historical co-change patterns from DB via OnlineLearningService
- [ ] Compute hybrid scores: `0.6 * embedding_similarity + 0.4 * pattern_frequency`
- [ ] Filter by confidence threshold (default: 0.3)
- [ ] For each suggestion, load affected components from CPG
- [ ] Record co-change event for learning (async)
- [ ] Response includes suggestions with reasons and affected components
- [ ] Attach to Hono app
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

**Validation:**
```bash
curl -X POST http://localhost:8080/v2/analysis/cochange/suggest \
  -H "Content-Type: application/json" \
  -d '{
    "changed_files": ["src/auth/login.ts", "src/auth/session.ts"],
    "limit": 10,
    "threshold": 0.3
  }'
```

---

### API-15: POST /v2/analysis/cochange/feedback
**Depends On:** API-13
**Estimate:** 4 hours

**Description:**
Implement feedback endpoint for learning loop (close the feedback cycle).

**Acceptance Criteria:**
- [ ] `POST /v2/analysis/cochange/feedback` endpoint in `src/routes/cochange.ts`
- [ ] Request body: `{ predicted_files, actual_files, session_id }`
- [ ] Compute accuracy: `|predicted ∩ actual| / |predicted ∪ actual|` (Jaccard similarity)
- [ ] Store feedback event in DB via OnlineLearningService
- [ ] Trigger immediate model update if accuracy <30%
- [ ] Response: `{ received: true, accuracy, triggered_update }`
- [ ] Attach to Hono app
- [ ] Integration test
- [ ] Performance: <100ms P50

**Example:**
```typescript
app.post('/v2/analysis/cochange/feedback', async (c) => {
  const { predicted_files, actual_files, session_id } = await c.req.json();

  // Compute accuracy
  const predicted = new Set(predicted_files);
  const actual = new Set(actual_files);
  const intersection = new Set([...predicted].filter(f => actual.has(f)));
  const union = new Set([...predicted, ...actual]);
  const accuracy = intersection.size / union.size;

  // Record feedback
  await learningService.recordFeedback(session_id, {
    predicted_files,
    actual_files,
    accuracy,
    timestamp: Date.now()
  });

  // Trigger update if poor performance
  let triggered_update = false;
  if (accuracy < 0.3) {
    await learningService.updateModels(session_id);
    triggered_update = true;
  }

  return c.json({ received: true, accuracy, triggered_update });
});
```

---

### API-16: POST /v2/analysis/impact (analyze_change_impact)
**Depends On:** API-5
**Estimate:** 8 hours

**Description:**
Implement change impact analysis endpoint using CPG traversal.

**Acceptance Criteria:**
- [ ] `src/routes/impact.ts` created
- [ ] `POST /v2/analysis/impact` endpoint
- [ ] Request body: `{ changed_files?, diff?, direction?, max_depth?, include_tests? }`
- [ ] Parse diff OR use changed_files to identify modified components
- [ ] Traverse CPG forward (dependencies) and/or backward (dependents) via CPGService
- [ ] Compute risk levels based on depth, criticality, annotations
  - Depth 1: HIGH priority
  - Depth 2: MEDIUM priority
  - Depth 3+: LOW priority
  - No annotations: +1 risk level
  - Data flow edges: +1 risk level
- [ ] Identify affected tests (components with type "test" or in test directories)
- [ ] Exclude files in `changed_files` from review list (already changed)
- [ ] Response includes direct/indirect dependencies with risk levels
- [ ] Attach to Hono app
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

**Validation:**
```bash
curl -X POST http://localhost:8080/v2/analysis/impact \
  -H "Content-Type: application/json" \
  -d '{
    "changed_files": ["src/auth/login.ts"],
    "direction": "both",
    "max_depth": 3,
    "include_tests": true
  }'
```

---

### API-17: PatternService
**Depends On:** API-4, API-5
**Estimate:** 6 hours

**Description:**
Service layer for design pattern detection from CPG structure.

**Acceptance Criteria:**
- [ ] `src/services/pattern-service.ts` created with `PatternService` class
- [ ] `detectPatterns(sessionId)`: Analyze CPG structure for common patterns
  - Load CPG via CPGService
  - Run pattern detection algorithms
  - Return detected patterns with locations
- [ ] Pattern detection algorithms:
  - **Singleton:** Class with static instance property and private constructor
  - **Factory:** Functions that return new instances (detect `new` keyword)
  - **Observer:** Event emitter/listener patterns (on/emit methods)
  - **Middleware Chain:** Functions that accept (req, res, next) and call next()
  - **Dependency Injection:** Constructor parameters passed to components
- [ ] Store detected patterns in `design_patterns` table
- [ ] `getPatternsByType(patternName)`: Retrieve usage examples
- [ ] Unit tests with known pattern implementations

**Pattern Detection Example (Middleware Chain):**
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
**Depends On:** API-5, API-17
**Estimate:** 12 hours

**Description:**
Implement specification generation endpoint (most complex tool - combines CPG + patterns + annotations).

**Acceptance Criteria:**
- [ ] `src/routes/specs.ts` created
- [ ] `POST /v2/analysis/specs/generate` endpoint
- [ ] Request body: `{ goal, entry_points?, context? }`
- [ ] Parse goal text to extract intent (keywords, component names)
- [ ] If `entry_points` provided, start CPG traversal there
- [ ] Otherwise, use semantic search (EmbeddingService) to find relevant components
- [ ] Traverse CPG to understand data flow (max depth: 5)
- [ ] Load annotations for all involved components
- [ ] Detect design patterns via PatternService
- [ ] Generate implementation order (topological sort of dependencies)
- [ ] Produce data flow diagram (Mermaid syntax)
- [ ] Response includes:
  - `components_to_modify` (existing components with context)
  - `components_to_create` (new components with suggestions)
  - `design_patterns` (patterns to follow)
  - `data_flow_diagram` (Mermaid diagram)
  - `implementation_order` (step-by-step sequence)
- [ ] Attach to Hono app
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
  data_flow_diagram: string; // Mermaid syntax
  implementation_order: string[];
}
```

**Example Goal:** "Add rate limiting to API endpoints"

**Example Response:**
```json
{
  "goal": "Add rate limiting to API endpoints",
  "components_to_modify": [
    {
      "component_id": "src/index.ts::setupMiddleware",
      "file_path": "src/index.ts",
      "reason": "Register rate limit middleware in middleware chain",
      "annotations": ["Middleware chain pattern detected"],
      "data_flow": ["app", "rateLimit"]
    }
  ],
  "components_to_create": [
    {
      "suggested_name": "rateLimiter",
      "file_path": "src/middleware/rate-limit.ts",
      "reason": "Implement rate limiting logic with Redis backend",
      "similar_components": ["src/middleware/auth.ts", "src/middleware/logger.ts"]
    }
  ],
  "design_patterns": [
    {
      "pattern_name": "Middleware Chain",
      "usage_examples": ["src/middleware/auth.ts", "src/middleware/logger.ts"],
      "recommendation": "Follow existing middleware pattern: (c, next) => {...}"
    }
  ],
  "data_flow_diagram": "graph TD\n  A[Request] --> B[rateLimiter]\n  B --> C[app.use]\n  C --> D[Endpoint]",
  "implementation_order": [
    "Create src/middleware/rate-limit.ts",
    "Implement rateLimiter function",
    "Add tests in tests/middleware/rate-limit.test.ts",
    "Register in src/index.ts"
  ]
}
```

**Validation:**
```bash
curl -X POST http://localhost:8080/v2/analysis/specs/generate \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Add rate limiting to API endpoints",
    "context": "Use Redis for tracking request counts"
  }'
```

---

### API-19: Integration Tests for Advanced Tools
**Depends On:** API-14, API-15, API-16, API-18
**Estimate:** 6 hours

**Description:**
End-to-end tests for advanced analysis endpoints.

**Acceptance Criteria:**
- [ ] `tests/integration/advanced-tools.test.ts` created
- [ ] Test: Suggest co-changes with hybrid scoring
  - Seed database with historical co-change patterns
  - Seed embeddings for test files
  - Request suggestions for changed files
  - Verify hybrid scores computed correctly
  - Verify reasons include both embedding and frequency data
- [ ] Test: Provide feedback and verify learning
  - Make prediction
  - Provide feedback with actual changes
  - Verify accuracy computed correctly
  - Verify patterns updated if accuracy low
  - Make new prediction and verify improvement
- [ ] Test: Analyze change impact with risk levels
  - Create CPG with known dependency chain
  - Request impact analysis
  - Verify all dependencies found
  - Verify risk levels assigned correctly
  - Verify tests identified
- [ ] Test: Generate implementation spec from goal
  - Seed CPG with realistic codebase
  - Add annotations and patterns
  - Request spec generation with goal
  - Verify components identified correctly
  - Verify implementation order is valid
  - Verify data flow diagram generated
- [ ] All tests pass
- [ ] Coverage >75% for routes and services

**Test Example:**
```typescript
test('suggest co-changes learns from feedback', async () => {
  // 1. Initial prediction (low accuracy expected)
  const prediction1 = await api.post('/v2/analysis/cochange/suggest', {
    changed_files: ['src/auth.ts']
  });

  // 2. Provide feedback
  await api.post('/v2/analysis/cochange/feedback', {
    predicted_files: prediction1.suggestions.map(s => s.file_path),
    actual_files: ['src/auth.ts', 'src/session.ts', 'tests/auth.test.ts']
  });

  // 3. Simulate learning (update patterns)
  await learningService.updateModels(sessionId);

  // 4. New prediction (should improve)
  const prediction2 = await api.post('/v2/analysis/cochange/suggest', {
    changed_files: ['src/auth.ts']
  });

  // Verify learning improved predictions
  expect(prediction2.suggestions).toContainEqual(
    expect.objectContaining({ file_path: 'src/session.ts' })
  );
});
```

---

## Summary

**Total Tasks:** 19 (API-1 through API-19)
**Estimated Timeline:** 2 weeks

**Breakdown:**
- **Phase 2 (Foundation):** 4 tasks, ~13 hours (Week 3, Days 1-2)
- **Phase 3 (Core Tools):** 8 tasks, ~38 hours (Week 3, Days 3-5)
- **Phase 4 (Advanced Tools):** 7 tasks, ~54 hours (Week 4, Days 1-5)

**Critical Path:**
API-1 → API-2 → API-3 → API-4 → API-5 → API-14 → API-19

**Parallelization Opportunities:**
- API-7, API-8, API-10, API-11 can run in parallel after API-6
- API-13, API-17 can run in parallel after API-5
- Documentation can happen concurrently with testing

**Dependencies on Other Repos:**
- **Blocked by:** `cpg-inference-ts` (MUST complete CPG-1 through CPG-13)
- **Blocks:** `metabob-mcp` (needs all 7 endpoints operational)

**Performance Targets:**
- GET /v2/analysis/priority: <100ms P50
- POST /v2/analysis/search: <200ms P50
- POST /v2/analysis/cochange/suggest: <300ms P50
- POST /v2/analysis/impact: <400ms P50
- POST /v2/analysis/specs/generate: <1s P50

**Validation:**
```bash
# After all tasks complete, run full integration test suite
cd repos/metabob-analysis-api
bun test tests/integration/

# Start server and verify all endpoints
bun run start
curl http://localhost:8080/health  # Should return 200
```
