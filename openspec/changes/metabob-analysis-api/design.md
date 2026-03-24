# metabob-analysis-api - Design Document

**Status:** Draft
**Created:** 2026-03-23
**Last Updated:** 2026-03-23

---

## Overview

HTTP backend service providing code analysis, CPG management, embedding-based search, and online learning capabilities. Built on MiniBob's activity substrate to leverage Thompson Sampling, trace capture, and composition tracking.

**Technology Stack:**
- TypeScript + Bun + Hono (HTTP framework)
- SurrealDB 3.x (persistent storage)
- Redis/Valkey (ephemeral cache)
- cpg-inference-ts (NPM library dependency)
- @metabob/minibob (activity execution)

**Size:** ~3,000-5,000 LOC
**Deployment:** StatefulSet (for CPG cache locality)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  metabob-analysis-api                        │
│                                                              │
│  ┌────────────────────┐  ┌──────────────────────────────┐  │
│  │  HTTP Layer (Hono) │  │   MiniBob Integration         │  │
│  │  - Routes          │  │   - ActivityExecutor          │  │
│  │  - Middleware      │  │   - Activity templates        │  │
│  │  - Error handling  │  │   - CPG tools registration    │  │
│  └─────────┬──────────┘  └──────────────┬───────────────┘  │
│            │                            │                   │
│            └────────────┬───────────────┘                   │
│                         │                                   │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │              Backend Services                        │   │
│  │  - CPGService (CPG lifecycle, caching)               │   │
│  │  - EmbeddingService (ONNX + FAISS)                   │   │
│  │  - OnlineLearningService (pattern tracking)          │   │
│  │  - AnnotationService (component annotations)         │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │       cpg-inference-ts (library)                      │   │
│  │  - CoChangePredictor                                  │   │
│  │  - GraphQueryEngine                                   │   │
│  │  - ONNXEmbeddingModel                                 │   │
│  │  - FAISSIndex                                         │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
┌──────────────────────┐              ┌──────────────────────┐
│   Redis/Valkey       │              │   SurrealDB 3.x      │
│   (Ephemeral)        │              │   (Persistent)       │
│                      │              │                      │
│ - CPG cache          │              │ - analysis_problems  │
│ - FAISS index        │              │ - code_components    │
│ - Session state      │              │ - annotations        │
│ - Model weights      │              │ - cochange_patterns  │
│                      │              │ - impact_relations   │
│                      │              │                      │
│                      │              │ Shared namespace:    │
│                      │              │   activity_system    │
└──────────────────────┘              └──────────────────────┘
```

---

## Directory Structure

```
repos/metabob-analysis-api/
├── src/
│   ├── index.ts              # Server entry point (Hono app)
│   ├── routes/
│   │   ├── priority.ts       # GET /v2/analysis/priority
│   │   ├── search.ts         # POST /v2/analysis/search
│   │   ├── annotations.ts    # POST /v2/analysis/annotations
│   │   ├── cochange.ts       # POST /v2/analysis/cochange/*
│   │   ├── impact.ts         # POST /v2/analysis/impact
│   │   ├── problems.ts       # PUT /v2/analysis/problems/:id
│   │   └── specs.ts          # POST /v2/analysis/specs/generate
│   ├── services/
│   │   ├── analysis-executor.ts    # Wraps ActivityExecutor
│   │   ├── cpg-service.ts          # CPG lifecycle management
│   │   ├── embedding-service.ts    # ONNX embedding operations
│   │   ├── learning-service.ts     # Online learning coordination
│   │   ├── annotation-service.ts   # Annotation CRUD
│   │   └── pattern-service.ts      # Design pattern detection
│   ├── activities/
│   │   ├── build-cpg.json          # Measured CPG building
│   │   ├── find-problems.json      # Measured problem detection
│   │   ├── analyze-impact.json     # Measured impact analysis
│   │   ├── suggest-cochanges.json  # Measured co-change prediction
│   │   └── generate-spec.json      # Measured spec generation
│   ├── tools/
│   │   └── cpg-tools.ts            # Activity tools for CPG operations
│   ├── db/
│   │   ├── surreal.ts        # SurrealDB client
│   │   ├── redis.ts          # Redis client
│   │   └── migrations/       # Schema migrations
│   ├── middleware/
│   │   ├── auth.ts           # Session validation
│   │   ├── scope.ts          # Org/project/session resolution
│   │   └── rate-limit.ts     # Rate limiting
│   ├── models/
│   │   ├── schemas.ts        # SurrealDB table definitions
│   │   └── types.ts          # TypeScript types
│   └── utils/
│       ├── logger.ts
│       └── metrics.ts
├── tests/
│   ├── unit/
│   └── integration/
├── sql/
│   ├── 001-initial-schema.surql
│   ├── 002-indexes.surql
│   └── 003-analysis-tables.surql
├── package.json
├── tsconfig.json
└── README.md
```

---

## MiniBob Library Integration

### Why Integration Matters

Analysis operations are **measured activities**, not ad-hoc service methods. Using `@metabob/minibob` library provides:

1. **Thompson Sampling:** Learn which analysis strategies work best
2. **Automatic Trace Capture:** Every analysis recorded with input/output state
3. **Composition Tracking:** Which analysis tools used together successfully
4. **Ribosome Pattern:** Successful improvisation → reusable templates
5. **Unified Context:** Impulses work same way as activity system

### Implementation Pattern

```typescript
// src/services/analysis-executor.ts
import { ActivityExecutor } from '@metabob/minibob';

export class AnalysisExecutor {
  private executor: ActivityExecutor;

  constructor(config: AnalysisConfig) {
    this.executor = new ActivityExecutor({
      templatesDir: './activities',
      tools: this.registerCPGTools(),
      traceStorage: config.traceStorage,
      impulseResolver: config.impulseResolver
    });
  }

  async buildCPG(sessionId: string, files: string[]): Promise<CPGResult> {
    // Execute build-cpg.json activity (measured, traced, learned from)
    const result = await this.executor.execute({
      templateId: 'build-cpg',
      variables: { sessionId, files },
      impulses: [
        { type: 'file', paths: files, budget: 50000 },
        { type: 'activityMetrics', templateId: 'build-cpg', budget: 2000 }
      ]
    });

    return result.output;
  }

  async findProblems(sessionId: string, scope: string[]): Promise<Problem[]> {
    // Execute find-problems.json activity
    const result = await this.executor.execute({
      templateId: 'find-problems',
      variables: { sessionId, scope },
      impulses: [
        { type: 'activityExecutionTrace', id: `build-cpg-${sessionId}` },
        { type: 'activityMetrics', templateId: 'find-problems' }
      ]
    });

    return result.output.problems;
  }

  private registerCPGTools(): Tool[] {
    return [
      {
        name: 'cpg_parse_file',
        description: 'Parse source file into CPG nodes',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['filePath', 'content']
        },
        handler: async (params) => {
          const parser = new TypeScriptParser();
          return parser.parseFile(params.filePath, params.content);
        }
      },
      {
        name: 'cpg_query',
        description: 'Query CPG with graph traversal',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            pattern: { type: 'object' }
          },
          required: ['sessionId', 'pattern']
        },
        handler: async (params) => {
          const cpg = await this.loadCPG(params.sessionId);
          return cpg.query(params.pattern);
        }
      },
      {
        name: 'embedding_similarity',
        description: 'Find similar components via embeddings',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            k: { type: 'number' }
          },
          required: ['text', 'k']
        },
        handler: async (params) => {
          const embedding = await this.generateEmbedding(params.text);
          return this.faissIndex.search(embedding, params.k);
        }
      }
    ];
  }
}
```

### Activity Template Example

```json
// activities/build-cpg.json
{
  "id": "build-cpg-v1",
  "name": "Build Code Property Graph",
  "category": "analysis",
  "tasks": [
    {
      "id": "parse-files",
      "description": "Parse source files into CPG nodes",
      "prompt": {
        "template": "Parse the following files into CPG components:\n{{files}}\n\nUse cpg_parse_file tool for each file.",
        "variables": [
          { "name": "files", "type": "string[]", "description": "Files to parse" }
        ]
      },
      "validation": {
        "requiredTools": ["cpg_parse_file"],
        "minimumNodes": 1
      }
    },
    {
      "id": "link-edges",
      "description": "Create CPG edges (calls, imports, data flow)",
      "prompt": {
        "template": "Analyze parsed components and create edges:\n- Function calls\n- Imports\n- Data flow\n\nUse cpg_link_edges tool.",
        "variables": []
      },
      "validation": {
        "requiredTools": ["cpg_link_edges"]
      }
    },
    {
      "id": "cache-result",
      "description": "Cache CPG for session",
      "prompt": {
        "template": "Store CPG in Redis with key cpg:{{sessionId}}",
        "variables": [
          { "name": "sessionId", "type": "string" }
        ]
      }
    }
  ]
}
```

---

## Key Services

### 1. CPGService

```typescript
export class CPGService {
  private predictor: CoChangePredictor;
  private cache: Map<string, CodePropertyGraph>;
  private redis: RedisClient;

  async getCPGForSession(sessionId: string): Promise<CoChangePredictor> {
    // Check Redis cache first
    const cached = await this.redis.get(`cpg:${sessionId}`);
    if (cached) return this.deserializeCPG(cached);

    // Load from SurrealDB
    const components = await this.loadComponentsFromDB(sessionId);
    const cpg = await this.buildCPG(components);

    // Cache for 1 hour
    await this.redis.setex(`cpg:${sessionId}`, 3600, this.serializeCPG(cpg));
    return cpg;
  }

  async updateCPG(sessionId: string, files: File[]): Promise<void> {
    const cpg = await this.getCPGForSession(sessionId);
    for (const file of files) {
      await cpg.updateFile(file.path, file.content);
    }
    // Invalidate cache
    await this.redis.del(`cpg:${sessionId}`);
  }

  async analyzeImpact(
    sessionId: string,
    componentIds: string[],
    maxDepth: number
  ): Promise<ImpactAnalysis> {
    const cpg = await this.getCPGForSession(sessionId);
    return cpg.analyzeChangeImpact(componentIds, maxDepth);
  }
}
```

### 2. EmbeddingService

```typescript
export class EmbeddingService {
  private model: ONNXEmbeddingModel;
  private faissIndex: FAISSIndex;
  private redis: RedisClient;

  async generateEmbedding(text: string): Promise<Float32Array> {
    // Check cache
    const cacheKey = `emb:${hashText(text)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Generate fresh embedding
    const embedding = await this.model.generateEmbedding(text);
    await this.redis.setex(cacheKey, 86400, JSON.stringify(embedding));
    return embedding;
  }

  async searchSimilar(
    embedding: Float32Array,
    k: number,
    filters?: SearchFilters
  ): Promise<SimilarityResult[]> {
    // Search FAISS index
    const results = await this.faissIndex.search(embedding, k * 2); // Over-fetch

    // Apply filters (file patterns, severity, etc.)
    const filtered = this.applyFilters(results, filters);
    return filtered.slice(0, k);
  }

  async indexComponent(
    componentId: string,
    embedding: Float32Array
  ): Promise<void> {
    await this.faissIndex.add(componentId, embedding);
    // Persist to SurrealDB
    await this.saveEmbeddingToDB(componentId, embedding);
  }
}
```

### 3. OnlineLearningService

```typescript
export class OnlineLearningService {
  private db: SurrealDBClient;
  private redis: RedisClient;

  async recordCochangeEvent(
    projectId: string,
    event: CochangeEvent
  ): Promise<void> {
    // Store event
    await this.db.query(
      `INSERT INTO cochange_events {
        project_id: $project,
        file_pairs: $pairs,
        timestamp: time::now()
      }`,
      { project: projectId, pairs: event.filePairs }
    );

    // Update pattern frequencies
    await this.updatePatternFrequencies(projectId, event.filePairs);

    // Trigger model update if threshold reached
    const eventCount = await this.getEventCount(projectId);
    if (eventCount % 50 === 0) {
      await this.updateModels(projectId);
    }
  }

  async updateModels(projectId: string): Promise<void> {
    // Recompute confidence scores based on recent events
    const patterns = await this.db.query(
      `SELECT * FROM cochange_patterns WHERE project_id = $project`,
      { project: projectId }
    );

    for (const pattern of patterns) {
      const confidence = this.computeConfidence(pattern);
      await this.db.query(
        `UPDATE cochange_patterns SET confidence = $conf WHERE id = $id`,
        { conf: confidence, id: pattern.id }
      );
    }

    // Invalidate Redis cache for this project
    await this.redis.del(`cochange-model:${projectId}`);
  }

  private computeConfidence(pattern: CochangePattern): number {
    // Bayesian update: prior + observed frequency
    const prior = 0.5;
    const weight = 0.3;
    const observed = pattern.frequency / pattern.total_commits;
    return prior * (1 - weight) + observed * weight;
  }
}
```

---

## Route Implementations

### 1. Priority Issues

```typescript
// src/routes/priority.ts
export function registerPriorityRoutes(app: Hono) {
  app.get('/v2/analysis/priority', async (c) => {
    const { limit, severity, scope } = c.req.query();
    const sessionId = c.get('sessionId');

    const executor = c.get('analysisExecutor');

    // Find problems via activity (measured, traced, learned from)
    const problems = await executor.findProblems(sessionId, scope);

    // Rank and filter
    const ranked = rankBySeverity(problems, severity).slice(0, limit);

    return c.json({ issues: ranked, total_issues: problems.length });
  });
}
```

### 2. Co-change Suggestions

```typescript
// src/routes/cochange.ts
export function registerCochangeRoutes(app: Hono) {
  app.post('/v2/analysis/cochange/suggest', async (c) => {
    const { changed_files, max_suggestions, confidence_threshold } =
      await c.req.json();
    const sessionId = c.get('sessionId');
    const projectId = await resolveProjectId(sessionId);

    // 1. Generate embeddings for changed files
    const embeddingService = c.get('embeddingService');
    const embeddings = await Promise.all(
      changed_files.map(file => embeddingService.generateEmbedding(file))
    );

    // 2. Search for similar files
    const avgEmbedding = averageEmbeddings(embeddings);
    const similarFiles = await embeddingService.searchSimilar(
      avgEmbedding,
      max_suggestions * 2
    );

    // 3. Load historical co-change patterns
    const learningService = c.get('learningService');
    const patterns = await learningService.getCochangePatterns(
      projectId,
      changed_files
    );

    // 4. Compute hybrid scores
    const suggestions = computeHybridScores(similarFiles, patterns, {
      embeddingWeight: 0.6,
      frequencyWeight: 0.4,
      threshold: confidence_threshold
    });

    // 5. Store co-change event for learning
    await learningService.recordCochangeEvent(projectId, {
      filePairs: changed_files,
      timestamp: new Date()
    });

    return c.json({
      suggestions,
      model_version: `cochange-v2.3-${projectId}`
    });
  });

  app.post('/v2/analysis/cochange/feedback', async (c) => {
    const { changed_files, actually_changed } = await c.req.json();
    const projectId = c.get('projectId');

    const learningService = c.get('learningService');
    await learningService.recordFeedback(projectId, {
      predicted: changed_files,
      actual: actually_changed,
      timestamp: new Date()
    });

    // Immediate model update if feedback is negative
    const accuracy = computeAccuracy(changed_files, actually_changed);
    if (accuracy < 0.3) {
      await learningService.updateModels(projectId);
    }

    return c.json({ received: true });
  });
}
```

### 3. Annotations

```typescript
// src/routes/annotations.ts
export function registerAnnotationRoutes(app: Hono) {
  app.post('/v2/analysis/annotations', async (c) => {
    const { component_id, annotation, annotation_type } = await c.req.json();
    const sessionId = c.get('sessionId');

    const annotationService = c.get('annotationService');

    // 1. Validate component exists in CPG
    const cpgService = c.get('cpgService');
    const cpg = await cpgService.getCPGForSession(sessionId);
    const component = cpg.getCPG().getNode(component_id);
    if (!component) {
      return c.json({ error: 'Component not found' }, 404);
    }

    // 2. Create annotation
    const result = await annotationService.create({
      componentId: component_id,
      text: annotation,
      type: annotation_type,
      sessionId
    });

    // 3. Update component embedding (async)
    const embeddingService = c.get('embeddingService');
    await embeddingService.updateComponentEmbedding(component_id, annotation);

    return c.json({ annotation_id: result.id });
  });
}
```

---

## SurrealDB Schema

```surql
-- sql/003-analysis-tables.surql

-- Analysis problems (detected issues)
DEFINE TABLE analysis_problems SCHEMAFULL;
DEFINE FIELD session_id ON analysis_problems TYPE string;
DEFINE FIELD component_id ON analysis_problems TYPE string;
DEFINE FIELD severity ON analysis_problems TYPE string
  ASSERT $value IN ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
DEFINE FIELD category ON analysis_problems TYPE string;
DEFINE FIELD message ON analysis_problems TYPE string;
DEFINE FIELD impact_score ON analysis_problems TYPE number;
DEFINE FIELD status ON analysis_problems TYPE string
  ASSERT $value IN ['open', 'in_progress', 'resolved', 'ignored'];
DEFINE FIELD created_at ON analysis_problems TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON analysis_problems TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_session_severity ON analysis_problems
  FIELDS session_id, severity;

-- Code components (parsed CPG nodes)
DEFINE TABLE code_components SCHEMAFULL;
DEFINE FIELD session_id ON code_components TYPE string;
DEFINE FIELD component_id ON code_components TYPE string;
DEFINE FIELD name ON code_components TYPE string;
DEFINE FIELD type ON code_components TYPE string;
DEFINE FIELD file_path ON code_components TYPE string;
DEFINE FIELD start_line ON code_components TYPE number;
DEFINE FIELD end_line ON code_components TYPE number;
DEFINE FIELD embedding ON code_components TYPE array<float>;
DEFINE FIELD created_at ON code_components TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_session_file ON code_components
  FIELDS session_id, file_path;

-- Component annotations
DEFINE TABLE component_annotations SCHEMAFULL;
DEFINE FIELD component_id ON component_annotations TYPE string;
DEFINE FIELD text ON component_annotations TYPE string;
DEFINE FIELD type ON component_annotations TYPE string
  ASSERT $value IN ['design_decision', 'implementation_note', 'bug_context', 'todo'];
DEFINE FIELD session_id ON component_annotations TYPE string;
DEFINE FIELD created_by ON component_annotations TYPE string;
DEFINE FIELD created_at ON component_annotations TYPE datetime DEFAULT time::now();

-- Co-change patterns
DEFINE TABLE cochange_patterns SCHEMAFULL;
DEFINE FIELD project_id ON cochange_patterns TYPE string;
DEFINE FIELD file_a ON cochange_patterns TYPE string;
DEFINE FIELD file_b ON cochange_patterns TYPE string;
DEFINE FIELD frequency ON cochange_patterns TYPE number;
DEFINE FIELD confidence ON cochange_patterns TYPE number;
DEFINE FIELD total_commits ON cochange_patterns TYPE number;
DEFINE FIELD last_seen ON cochange_patterns TYPE datetime;

DEFINE INDEX idx_project_files ON cochange_patterns
  FIELDS project_id, file_a, file_b;

-- Co-change events (for learning)
DEFINE TABLE cochange_events SCHEMAFULL;
DEFINE FIELD project_id ON cochange_events TYPE string;
DEFINE FIELD file_pairs ON cochange_events TYPE array<string>;
DEFINE FIELD timestamp ON cochange_events TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_project_time ON cochange_events
  FIELDS project_id, timestamp;
```

---

## Storage Strategy

### Hybrid Redis + SurrealDB

**Redis (Ephemeral - 1-24 hour TTL):**
- CPG cache (serialized graphs): `cpg:{sessionId}`
- FAISS indexes (in-memory): `faiss:{sessionId}`
- Session state: `session:{sessionId}`
- Model weights: `cochange-model:{projectId}`
- Embeddings cache: `emb:{hash}`
- Rate limit counters: `ratelimit:{key}`

**SurrealDB (Persistent):**
- `analysis_problems`: All detected issues
- `code_components`: All parsed components
- `component_annotations`: Design decisions, notes
- `cochange_patterns`: Historical co-change frequencies
- `cochange_events`: Learning events
- Execution history: Shared with activity system

**Cache Invalidation Strategy:**

```typescript
// When files change
await redis.del(`cpg:${sessionId}`);
await redis.del(`faiss:${sessionId}`);

// When annotations added
await redis.del(`component-emb:${componentId}`);

// When models updated
await redis.del(`cochange-model:${projectId}`);

// Periodic cleanup (every 6 hours)
await redis.scan(0, 'MATCH', 'cpg:*', 'COUNT', 1000)
  .then(keys => keys.filter(k => age(k) > 24h))
  .then(stale => redis.del(...stale));
```

---

## Data Flow Example: Suggest Related Changes

```
POST /v2/analysis/cochange/suggest
{ changed_files: ["auth/login.ts"] }
        │
        ▼
┌───────────────────────────┐
│  CochangeRoute Handler    │
│  1. Resolve project ID    │
│  2. Generate embeddings   │
│  3. FAISS search          │
│  4. Load patterns         │
│  5. Hybrid scoring        │
│  6. Record event          │
└───────────┬───────────────┘
            │
    ┌───────┴────────┬──────────┬──────────┐
    │                │          │          │
    ▼                ▼          ▼          ▼
┌────────┐  ┌────────────┐  ┌─────┐  ┌──────────┐
│ Redis  │  │ FAISS      │  │ CPG │  │ SurrealDB│
│ (emb)  │  │ (search)   │  │     │  │ (pattern)│
└────────┘  └────────────┘  └─────┘  └──────────┘
    │                │          │          │
    └────────────────┴──────────┴──────────┘
                     │
                     ▼
         Hybrid Score Computation
         (0.6 * emb_sim + 0.4 * freq)
                     │
                     ▼
           Filtered Suggestions
                     │
                     ▼
           Response with metadata
```

---

## Performance Targets

| Operation | Target P50 | Target P99 | Notes |
|-----------|-----------|-----------|-------|
| Get priority issues | <100ms | <300ms | DB query + sort |
| Search codebase | <200ms | <500ms | Embedding + FAISS |
| Annotate component | <50ms | <150ms | DB insert |
| Suggest related changes | <300ms | <800ms | Full pipeline |
| Analyze change impact | <400ms | <1s | CPG + embeddings |
| Generate implementation spec | <1s | <3s | Complex analysis |
| CPG cache hit | <5ms | <15ms | Redis lookup |
| Embedding cache hit | <3ms | <10ms | Redis lookup |

---

## Testing Strategy

### Integration Tests

```typescript
// Example: End-to-end co-change flow
test('suggest_related_changes returns hybrid scored results', async () => {
  // Setup: Create session with test data
  const sessionId = await createTestSession();
  await seedCodeComponents(sessionId, testComponents);
  await seedCochangePatterns(projectId, testPatterns);

  // Execute endpoint
  const response = await fetch('/v2/analysis/cochange/suggest', {
    method: 'POST',
    body: JSON.stringify({
      changed_files: ['auth/login.ts'],
      max_suggestions: 5,
      confidence_threshold: 0.5
    })
  });

  const result = await response.json();

  // Verify
  expect(result.suggestions).toHaveLength(5);
  expect(result.suggestions[0].score).toBeGreaterThan(0.5);
  expect(result.model_version).toContain(projectId);
});

// Example: Learning loop validation
test('online learning updates patterns after feedback', async () => {
  const projectId = 'test-project';
  const learningService = new OnlineLearningService(db, redis);

  // Initial state
  const initialPattern = await getPattern(projectId, 'a.ts', 'b.ts');
  expect(initialPattern.confidence).toBe(0.5);

  // Record positive co-change events
  for (let i = 0; i < 10; i++) {
    await learningService.recordCochangeEvent(projectId, {
      filePairs: ['a.ts', 'b.ts'],
      timestamp: new Date()
    });
  }

  // Verify pattern updated
  const updatedPattern = await getPattern(projectId, 'a.ts', 'b.ts');
  expect(updatedPattern.confidence).toBeGreaterThan(0.5);
  expect(updatedPattern.frequency).toBe(10);
});
```

---

## Validation Criteria

**Phase 1 Success (Foundation):**
- ✅ Hono server running
- ✅ SurrealDB connection working
- ✅ Redis connection working
- ✅ Health check endpoint functional
- ✅ Session middleware working

**Phase 2 Success (Core Routes):**
- ✅ Priority issues endpoint working
- ✅ Search endpoint working
- ✅ Annotations endpoint working
- ✅ CPG caching functional
- ✅ Integration tests passing

**Phase 3 Success (Advanced Features):**
- ✅ Co-change suggestions working
- ✅ Impact analysis working
- ✅ Online learning recording events
- ✅ Thompson Sampling integration
- ✅ All performance targets met

**Phase 4 Success (Production Ready):**
- ✅ Load tests pass (1000 req/min)
- ✅ Monitoring dashboards operational
- ✅ Deployed to dev cluster
- ✅ Zero data loss after pod restarts
- ✅ metabob-mcp integration verified

---

## Dependencies

```json
{
  "dependencies": {
    "@hono/hono": "^4.0.0",
    "@metabob/minibob": "workspace:*",
    "cpg-inference-ts": "workspace:*",
    "surrealdb.js": "^1.0.0",
    "ioredis": "^5.3.0",
    "pino": "^8.17.0",
    "prom-client": "^15.1.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "vitest": "^1.2.0"
  }
}
```

---

## References

- CPG Library: `repos/cpg-inference-ts/`
- MiniBob Library: `repos/minibob/`
- Activity API Reference: `repos/metabob-activity-api/`
- Deployment: `helm/charts/analysis-system/`
- Used by: `repos/metabob-mcp/`
