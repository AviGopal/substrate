# Analysis API Extraction - Design Document

**Status:** Draft
**Created:** 2026-03-23
**Last Updated:** 2026-03-23

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Agents (Claude/Cursor)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ MCP Protocol
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      metabob-mcp                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ MCP Tools (7 tools)                                       │   │
│  │ - get_priority_issues                                     │   │
│  │ - search_codebase_issues                                  │   │
│  │ - annotate_component                                      │   │
│  │ - suggest_related_changes                                 │   │
│  │ - analyze_change_impact                                   │   │
│  │ - mark_problem_complete                                   │   │
│  │ - generate_implementation_spec                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/JSON
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  metabob-analysis-api                            │
│  ┌────────────────────┐  ┌─────────────────────────────────┐   │
│  │  HTTP Layer (Hono) │  │   Backend Services               │   │
│  │  - Routes          │  │   - CPGService                   │   │
│  │  - Middleware      │  │   - EmbeddingService             │   │
│  │  - Error handling  │  │   - OnlineLearningService        │   │
│  └────────────────────┘  │   - AnnotationService            │   │
│                           └─────────────────────────────────┘   │
│                                    │                             │
│                                    ▼                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              cpg-inference-ts (library)                   │   │
│  │  - CoChangePredictor                                      │   │
│  │  - GraphQueryEngine                                       │   │
│  │  - ONNXEmbeddingModel                                     │   │
│  │  - FAISSIndex                                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
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
└──────────────────────┘              │ - impact_relations   │
                                      │ - design_patterns    │
                                      │                      │
                                      │ Shared namespace:    │
                                      │   activity_system    │
                                      └──────────────────────┘
```

---

## MiniBob Library Integration

### Why Integration Matters

Analysis operations should be **measured activities**, not ad-hoc service methods. By using `@metabob/minibob` library, we gain:

1. **Thompson Sampling:** Learn which analysis strategies work best
2. **Automatic Trace Capture:** Every analysis recorded with input/output state
3. **Composition Tracking:** Which analysis tools used together successfully
4. **Ribosome Pattern:** Successful improvisation → reusable templates
5. **Unified Context:** Impulses work same way as activity system

### Architecture Overview

```typescript
// metabob-analysis-api imports MiniBob library (NOT reverse)
import { ActivityExecutor, ImpulseResolver } from '@metabob/minibob';

// Activities stored in activities/ directory
metabob-analysis-api/
├── activities/
│   ├── build-cpg.json              // Measured CPG building
│   ├── find-problems.json          // Measured problem detection
│   ├── analyze-impact.json         // Measured impact analysis
│   ├── suggest-cochanges.json      // Measured co-change prediction
│   └── generate-spec.json          // Measured spec generation
└── src/
    ├── services/
    │   ├── analysis-executor.ts    // Wraps ActivityExecutor
    │   └── cpg-tools.ts            // Activity tools for CPG operations
    └── routes/
        └── analysis.ts             // HTTP → Activity execution
```

### Implementation Example

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
    // Execute build-cpg.json activity
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
        inputSchema: { ... },
        handler: async (params) => {
          const parser = new TypeScriptParser();
          return parser.parseFile(params.filePath, params.content);
        }
      },
      {
        name: 'cpg_query',
        description: 'Query CPG with graph traversal',
        inputSchema: { ... },
        handler: async (params) => {
          const cpg = await this.loadCPG(params.sessionId);
          return cpg.query(params.pattern);
        }
      },
      {
        name: 'embedding_similarity',
        description: 'Find similar components via embeddings',
        inputSchema: { ... },
        handler: async (params) => {
          const embedding = await this.generateEmbedding(params.text);
          return this.faissIndex.search(embedding, params.k);
        }
      }
    ];
  }
}

// src/routes/analysis.ts
export function registerAnalysisRoutes(app: Hono) {
  app.post('/v2/analysis/priority', async (c) => {
    const { limit, severity, scope } = await c.req.json();
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

### Benefits in Practice

**Automatic Learning:**
```typescript
// After 10 executions, Thompson Sampling learns:
// - build-cpg-v1: 85% success, 450ms avg, $0.02 cost
// - build-cpg-v2: 92% success, 380ms avg, $0.018 cost
// → v2 selected more often
```

**Composition Tracking:**
```typescript
// Backend records: "build-cpg → find-problems → analyze-impact"
// If this sequence succeeds, recommend it for similar goals
```

**Trace-Based Debugging:**
```typescript
// If analysis fails, trace shows:
// - Which CPG queries ran
// - What components were found
// - Where traversal stopped
// → Create variant with better queries
```

**Reference:** See [repos/minibob/src/activity.ts](../../repos/minibob/src/activity.ts) for ActivityExecutor implementation.

---

## Execution Modes Supported

Analysis activities support all execution modes from the improvisation spectrum:

### 1. Template-Driven Execution
**Use Case:** Common analysis tasks with proven approaches

```typescript
// Predefined workflow
const result = await executor.execute({
  templateId: 'find-problems',  // Uses build-cpg.json template
  variables: { sessionId, severity: ['HIGH'] }
});
```

### 2. Goal-Seeking Workflow
**Use Case:** User provides intent, backend recommends approach

```typescript
// POST /v2/activities/recommend
{
  "goalDescription": "Find security issues in authentication flow",
  "impulseRefs": [
    "activityMetrics:find-problems",
    "activityMetrics:analyze-impact"
  ]
}

// Backend returns: "Use find-problems template + analyze-impact"
```

### 3. Search-First Optimization
**Use Case:** Reuse cached CPG if fresh, rebuild if stale

```typescript
async buildCPG(sessionId: string, files: string[]): Promise<CPG> {
  // Check cache first
  const cached = await redis.get(`cpg:${sessionId}`);
  if (cached && isFresh(cached)) {
    return deserialize(cached);  // Skip expensive rebuild
  }

  // Execute build activity
  return executor.execute({ templateId: 'build-cpg', variables: { sessionId, files } });
}
```

### 4. Pure Improvisation
**Use Case:** Novel analysis not covered by templates

```typescript
// No template for "find GraphQL N+1 query issues"
// LLM explores CPG step-by-step:
// 1. Parse GraphQL resolvers (cpg_parse_file)
// 2. Find resolver → database query edges (cpg_query)
// 3. Detect N+1 pattern (custom analysis)
// 4. Success → trace captured → ribosome extracts template
```

**Reference:** See [openspec/meta/improvisation-spectrum.md](../../meta/improvisation-spectrum.md) for framework.

---

## Component Designs

### 1. metabob-mcp (MCP Server)

**Technology:** TypeScript + Bun + @modelcontextprotocol/sdk
**Size:** ~1,000-2,000 LOC
**Deployment:** Sidecar container alongside metabob-analysis-api

#### Directory Structure
```
repos/metabob-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── tools/
│   │   ├── index.ts          # Tool registry
│   │   ├── get-priority-issues.ts
│   │   ├── search-codebase.ts
│   │   ├── annotate-component.ts
│   │   ├── suggest-changes.ts
│   │   ├── analyze-impact.ts
│   │   ├── mark-complete.ts
│   │   └── generate-spec.ts
│   ├── api-client.ts        # HTTP client for metabob-analysis-api
│   ├── session-manager.ts   # Session context management
│   └── types.ts             # Shared type definitions
├── tests/
│   └── integration/
│       └── tool-flow.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

#### Key Classes

```typescript
// src/index.ts
class AnalysisMCPServer {
  private tools: Map<string, MCPTool>;
  private apiClient: AnalysisAPIClient;
  private sessionManager: SessionManager;

  async handleToolCall(tool: string, params: unknown): Promise<unknown>;
  async initialize(): Promise<void>;
  async shutdown(): Promise<void>;
}

// src/api-client.ts
class AnalysisAPIClient {
  private baseURL: string;
  private timeout: number;

  async post<T>(endpoint: string, body: unknown): Promise<T>;
  async get<T>(endpoint: string, params?: URLSearchParams): Promise<T>;
  async handleError(error: unknown): Promise<MCPError>;
}

// src/session-manager.ts
class SessionManager {
  private sessions: Map<string, SessionContext>;

  async getSession(sessionId: string): Promise<SessionContext>;
  async resolveScope(sessionId: string, scope: string): Promise<ScopeContext>;
  async trackUsage(sessionId: string, tool: string, latency: number): Promise<void>;
}
```

#### Error Handling Strategy

```typescript
// Consistent error format for all tools
interface MCPError {
  code: string;           // e.g., "COMPONENT_NOT_FOUND"
  message: string;        // Human-readable explanation
  details?: object;       // Additional context
  suggestion?: string;    // Actionable next step
}

// Error transformation from API to MCP
function transformAPIError(apiError: APIError): MCPError {
  const errorMap: Record<string, MCPError> = {
    'SESSION_NOT_FOUND': {
      code: 'SESSION_EXPIRED',
      message: 'Session token is invalid or expired',
      suggestion: 'Please re-authenticate'
    },
    // ... more mappings
  };
  return errorMap[apiError.code] || defaultError;
}
```

---

### 2. metabob-analysis-api (Backend Orchestration)

**Technology:** TypeScript + Bun + Hono + SurrealDB + Redis
**Size:** ~3,000-5,000 LOC
**Deployment:** StatefulSet (for CPG cache locality)

#### Directory Structure
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
│   │   ├── cpg-service.ts         # CPG lifecycle management
│   │   ├── embedding-service.ts   # ONNX embedding operations
│   │   ├── learning-service.ts    # Online learning coordination
│   │   ├── annotation-service.ts  # Annotation CRUD
│   │   └── pattern-service.ts     # Design pattern detection
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
│   └── 003-relations.surql
├── package.json
├── tsconfig.json
└── README.md
```

#### Key Services

```typescript
// src/services/cpg-service.ts
class CPGService {
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

  async analyzeImpact(sessionId: string, componentIds: string[], maxDepth: number): Promise<ImpactAnalysis> {
    const cpg = await this.getCPGForSession(sessionId);
    return cpg.analyzeChangeImpact(componentIds, maxDepth);
  }
}

// src/services/embedding-service.ts
class EmbeddingService {
  private model: ONNXEmbeddingModel;
  private faissIndex: FAISSIndex;
  private redis: RedisClient;

  async generateEmbedding(text: string): Promise<number[]> {
    // Check cache
    const cacheKey = `emb:${hashText(text)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Generate fresh embedding
    const embedding = await this.model.generateEmbedding(text);
    await this.redis.setex(cacheKey, 86400, JSON.stringify(embedding));
    return embedding;
  }

  async searchSimilar(embedding: number[], k: number, filters?: SearchFilters): Promise<SimilarityResult[]> {
    // Search FAISS index
    const results = await this.faissIndex.search(embedding, k * 2); // Over-fetch for filtering

    // Apply filters (file patterns, severity, etc.)
    const filtered = this.applyFilters(results, filters);
    return filtered.slice(0, k);
  }

  async indexComponent(componentId: string, embedding: number[]): Promise<void> {
    await this.faissIndex.add(componentId, embedding);
    // Persist to SurrealDB
    await this.saveEmbeddingToDB(componentId, embedding);
  }
}

// src/services/learning-service.ts
class OnlineLearningService {
  private db: SurrealDBClient;
  private redis: RedisClient;

  async recordCochangeEvent(projectId: string, event: CochangeEvent): Promise<void> {
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

#### Route Implementations

```typescript
// src/routes/cochange.ts
export function registerCochangeRoutes(app: Hono) {
  // POST /v2/analysis/cochange/suggest
  app.post('/v2/analysis/cochange/suggest', async (c) => {
    const { changed_files, max_suggestions, confidence_threshold } = await c.req.json();
    const sessionId = c.get('sessionId');
    const projectId = await resolveProjectId(sessionId);

    // 1. Generate embeddings for changed files
    const embeddingService = c.get('embeddingService');
    const embeddings = await Promise.all(
      changed_files.map(file => embeddingService.generateEmbedding(file))
    );

    // 2. Search for similar files
    const avgEmbedding = averageEmbeddings(embeddings);
    const similarFiles = await embeddingService.searchSimilar(avgEmbedding, max_suggestions * 2);

    // 3. Load historical co-change patterns
    const learningService = c.get('learningService');
    const patterns = await learningService.getCochangePatterns(projectId, changed_files);

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

    return c.json({ suggestions, model_version: `cochange-v2.3-${projectId}` });
  });

  // POST /v2/analysis/cochange/feedback
  app.post('/v2/analysis/cochange/feedback', async (c) => {
    const { changed_files, actually_changed } = await c.req.json();
    const projectId = c.get('projectId');

    // Record which suggestions were actually used
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

---

### 3. cpg-inference-ts (Code Property Graph Library)

**Technology:** TypeScript + tree-sitter + ONNX + FAISS
**Size:** ~4,000-6,000 LOC
**Type:** NPM library (not deployed standalone)

#### Directory Structure
```
repos/cpg-inference-ts/
├── src/
│   ├── index.ts                    # Public API exports
│   ├── predictor.ts                # CoChangePredictor class
│   ├── graph/
│   │   ├── cpg.ts                  # CodePropertyGraph class
│   │   ├── query-engine.ts         # GraphQueryEngine class
│   │   ├── traversal.ts            # Graph traversal algorithms
│   │   └── types.ts                # Component, Edge types
│   ├── parsers/
│   │   ├── registry.ts             # ParserRegistry
│   │   ├── typescript-parser.ts
│   │   ├── javascript-parser.ts
│   │   ├── python-parser.ts
│   │   ├── java-parser.ts
│   │   └── cpp-parser.ts
│   ├── embeddings/
│   │   ├── onnx-model.ts           # ONNXEmbeddingModel class
│   │   ├── faiss-index.ts          # FAISSIndex wrapper
│   │   └── models/
│   │       └── default.onnx        # Bundled 69KB GCN model
│   ├── storage/
│   │   ├── interface.ts            # Storage interface
│   │   ├── sqlite-storage.ts       # SQLiteStorage implementation
│   │   ├── redis-storage.ts        # RedisStorage implementation
│   │   └── memory-storage.ts       # In-memory (testing)
│   └── utils/
│       ├── logger.ts
│       └── model-info.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/                   # Sample codebases for testing
├── benchmarks/
│   └── performance.test.ts         # Performance benchmarks vs Python
├── package.json
├── tsconfig.json
└── README.md
```

#### Translation Strategy

**Python → TypeScript Mapping:**

| Python Component | TypeScript Component | Notes |
|------------------|---------------------|-------|
| `cpg_inference/predictor.py` | `src/predictor.ts` | Main class |
| `cpg_inference/graph.py` | `src/graph/cpg.ts` | Graph structure |
| `cpg_inference/parsers/*.py` | `src/parsers/*.ts` | Tree-sitter based |
| `cpg_inference/embeddings.py` | `src/embeddings/onnx-model.ts` | ONNX runtime |
| `cpg_inference/faiss_index.py` | `src/embeddings/faiss-index.ts` | FAISS bindings |
| `networkx` graphs | Native adjacency lists | Simpler, faster |
| `numpy` arrays | TypedArrays | Float32Array, etc. |

**Key Translation Decisions:**

1. **Graph Storage:** Replace NetworkX with custom adjacency list implementation (faster for our use case)
2. **Vector Storage:** Use Float32Array instead of numpy arrays (native TypeScript)
3. **Async Operations:** All I/O operations return Promises (tree-sitter, ONNX, FAISS)
4. **Error Handling:** Use custom error classes (CPGError, ParseError, etc.)
5. **Performance:** Target parity with Python baseline (see spec for targets)

#### Critical Algorithms

**Progressive File Update:**
```typescript
async updateFile(filePath: string, content: string): Promise<UpdateFileResult> {
  // 1. Parse new file
  const parseResult = await this.parser.parseFile(filePath, content);

  // 2. Find existing components for this file
  const existingComponents = this.cpg.getComponentsByFile(filePath);

  // 3. Compute diff
  const { added, removed, modified } = this.computeComponentDiff(
    existingComponents,
    parseResult.components
  );

  // 4. Update graph
  for (const component of removed) {
    this.cpg.removeNode(component.id);
  }
  for (const component of added) {
    this.cpg.addNode(component);
  }
  for (const component of modified) {
    this.cpg.updateNode(component);
  }

  // 5. Re-link edges
  await this.relinkEdges(filePath, parseResult.edges);

  // 6. Update embeddings
  await this.updateEmbeddings(added.concat(modified));

  return { filePath, added, removed, modified, duration: performance.now() - start };
}
```

**Impact Analysis (CPG Traversal):**
```typescript
async analyzeChangeImpact(componentIds: string[], maxDepth: number): Promise<ImpactAnalysis> {
  // Forward traversal (dependencies)
  const graphForward = await this.cpg.traverse(
    componentIds,
    'forward',
    maxDepth,
    (node, edge) => edge.type !== 'contains' // Skip structural edges
  );

  // Backward traversal (dependents)
  const graphBackward = await this.cpg.traverse(
    componentIds,
    'backward',
    maxDepth,
    (node, edge) => edge.type !== 'contains'
  );

  // Embedding similarity
  const embeddings = await Promise.all(
    componentIds.map(id => this.getComponentEmbedding(id))
  );
  const avgEmbedding = this.averageEmbeddings(embeddings);
  const similar = await this.faissIndex.search(avgEmbedding, 20);

  // Filter out components already in graph traversal
  const allGraphIds = new Set([
    ...graphForward.map(n => n.componentId),
    ...graphBackward.map(n => n.componentId)
  ]);
  const embeddingSimilar = similar.filter(s => !allGraphIds.has(s.id));

  return { graphForward, graphBackward, embeddingSimilar };
}
```

---

## Data Flow Diagrams

### 1. Get Priority Issues Flow

```
AI Agent
   │
   │ MCP: get_priority_issues({ limit: 5, severity: ["HIGH"] })
   ▼
MCP Server
   │
   │ HTTP POST /v2/analysis/priority
   │ Body: { limit: 5, severity: ["HIGH"], session_id: "..." }
   ▼
Analysis API
   │
   │ 1. Resolve session → project → org
   │ 2. Query SurrealDB: analysis_problems filtered by severity
   │ 3. Load CPG impact scores from cache/DB
   │ 4. Compute rank: severity_weight * impact_score
   │ 5. Sort and limit results
   ▼
SurrealDB
   │
   │ SELECT * FROM analysis_problems
   │ WHERE session_id = $session AND severity IN $severities
   │ ORDER BY (severity_weight * impact_score) DESC
   │ LIMIT $limit
   ▼
Analysis API
   │
   │ Format response with component counts
   ▼
MCP Server
   │
   │ Transform to MCP format
   ▼
AI Agent
```

### 2. Suggest Related Changes Flow

```
AI Agent (editing files)
   │
   │ MCP: suggest_related_changes({ changed_files: ["auth/login.ts"] })
   ▼
MCP Server
   │
   │ HTTP POST /v2/analysis/cochange/suggest
   ▼
Analysis API
   │
   │ 1. Load CPG for session
   │ 2. Extract components from changed files
   │ 3. Generate embeddings for components
   │ 4. FAISS search for similar components
   │ 5. Load historical co-change patterns
   │ 6. Compute hybrid scores
   │ 7. Record co-change event
   ▼
┌────────────────┬─────────────────┬──────────────────┐
│                │                 │                  │
▼                ▼                 ▼                  ▼
Redis          FAISS            CPG               SurrealDB
(FAISS index)  (similarity)     (components)      (patterns)
   │                │                 │                  │
   └────────────────┴─────────────────┴──────────────────┘
                              │
                              ▼
                      Hybrid Score Computation
                      (0.6 * emb_sim + 0.4 * freq)
                              │
                              ▼
                      Filtered Suggestions
                              │
                              ▼
                         MCP Server
                              │
                              ▼
                          AI Agent
```

### 3. Annotate Component Flow

```
AI Agent (completed task)
   │
   │ MCP: annotate_component({
   │   component_id: "auth/login.ts::login",
   │   annotation: "Design decision: Use bcrypt for password hashing",
   │   annotation_type: "design_decision"
   │ })
   ▼
MCP Server
   │
   │ HTTP POST /v2/analysis/annotations
   ▼
Analysis API
   │
   │ 1. Validate component exists in CPG
   │ 2. Insert into component_annotations table
   │ 3. Link to code_components table
   │ 4. Update component metadata (last_annotated_at)
   │ 5. Trigger embedding update
   ▼
SurrealDB
   │
   │ BEGIN TRANSACTION;
   │ INSERT INTO component_annotations { ... };
   │ RELATE code_components:$id -> documented_by -> component_annotations:$anno_id;
   │ UPDATE code_components SET last_annotated_at = time::now() WHERE id = $id;
   │ COMMIT;
   ▼
Embedding Service (async)
   │
   │ 1. Generate embedding for annotation text
   │ 2. Update component embedding (weighted average)
   │ 3. Update FAISS index
   ▼
Redis (FAISS cache invalidation)
```

---

## Storage Strategy

### Hybrid Redis + SurrealDB

**Redis (Ephemeral - 1-24 hour TTL):**
- CPG cache (serialized graphs)
- FAISS indexes (in-memory for fast search)
- Session state
- Model weights (per-project co-change models)
- Rate limit counters

**SurrealDB (Persistent):**
- analysis_problems (all detected issues)
- code_components (all parsed components)
- component_annotations (design decisions, notes)
- cochange_patterns (historical co-change frequencies)
- impact_relations (denormalized CPG edges for fast queries)
- execution history (for audit/learning)

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

## Deployment Architecture

### Kubernetes Resources

**Namespace:** `activity-system` (shared with metabob-activity-api)

**Components:**

1. **metabob-analysis-api** - StatefulSet (3 replicas)
   - Headless service for sticky CPG cache
   - PVC for FAISS indexes (10GB per pod)
   - Resource limits: 2 CPU, 4GB RAM

2. **metabob-mcp** - Deployment (3 replicas)
   - Sidecar container with analysis-api
   - No persistent storage needed
   - Resource limits: 0.5 CPU, 512MB RAM

3. **SurrealDB** - Existing StatefulSet (reused)
   - Namespace: `activity-system`
   - Database: `learning_loop`

4. **Redis/Valkey** - Existing Deployment (reused)
   - No persistence (cache only)

### Helm Chart Structure

```
helm/charts/analysis-system/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── analysis-api/
│   │   ├── statefulset.yaml
│   │   ├── service.yaml
│   │   ├── pvc.yaml
│   │   └── configmap.yaml
│   ├── mcp/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   ├── gateway/
│   │   ├── gateway.yaml
│   │   └── virtualservice.yaml
│   └── secrets/
│       └── api-keys.yaml
```

### Service Mesh (Istio)

```yaml
# VirtualService for external access
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: analysis-api
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
```

---

## Testing Strategy

### Unit Tests

```typescript
// Example: CPG progressive update test
test('updateFile should correctly diff components', async () => {
  const predictor = new CoChangePredictor(config);

  // Initial add
  await predictor.addFile('test.ts', 'function foo() {}');
  expect(predictor.getCPG().getNode('test.ts::foo')).toBeTruthy();

  // Update (add new function)
  await predictor.updateFile('test.ts', 'function foo() {}\nfunction bar() {}');
  expect(predictor.getCPG().getNode('test.ts::bar')).toBeTruthy();

  // Update (remove function)
  await predictor.updateFile('test.ts', 'function bar() {}');
  expect(predictor.getCPG().getNode('test.ts::foo')).toBeNull();
});
```

### Integration Tests

```typescript
// Example: End-to-end MCP flow test
test('get_priority_issues returns ranked results', async () => {
  // Setup: Create session with test data
  const sessionId = await createTestSession();
  await seedAnalysisProblems(sessionId, [
    { severity: 'HIGH', impact_score: 87 },
    { severity: 'MEDIUM', impact_score: 45 }
  ]);

  // Execute tool
  const result = await mcpClient.callTool('get_priority_issues', {
    limit: 5,
    severity: ['HIGH'],
    scope: 'session'
  });

  // Verify
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0].severity).toBe('HIGH');
  expect(result.issues[0].priority_rank).toBe(1);
});
```

### Performance Benchmarks

```typescript
// Example: CPG traversal benchmark
benchmark('Impact analysis at depth 3', async () => {
  const predictor = await loadLargeCodebase(); // 10K components

  const start = performance.now();
  const impact = await predictor.analyzeChangeImpact(['src/core.ts::main'], 3);
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(15); // Target: <15ms
  expect(impact.graphForward.length).toBeGreaterThan(0);
});
```

---

## Security Considerations

### Authentication
- Session tokens validated on every request
- Tokens stored in secure HTTP-only cookies (when browser-based)
- MCP session context mapped to internal session_id

### Authorization
- Scope checks: session → project → org hierarchy
- Users can only access data within their scope
- Cross-session data leakage prevented by WHERE clauses

### Input Validation
- File paths sanitized (prevent directory traversal)
- Component IDs validated against regex pattern
- Embeddings normalized before FAISS insertion
- SQL injection prevented by parameterized queries

### Rate Limiting
- Per-session limits: 60 req/min for expensive operations
- Global limits: 10K req/min across all sessions
- Redis-based distributed rate limiting

### Data Privacy
- No PII stored in embeddings
- Code content encrypted at rest (SurrealDB)
- Annotations can be marked private (not shared across org)

---

## Monitoring and Observability

### Metrics (Prometheus)

```typescript
// Analysis API metrics
- analysis_api_requests_total{route, method, status}
- analysis_api_request_duration_seconds{route}
- cpg_cache_hit_rate{session_id}
- embedding_generation_duration_seconds
- faiss_search_duration_seconds
- online_learning_updates_total{project_id}

// MCP Server metrics
- mcp_tool_calls_total{tool, status}
- mcp_tool_duration_seconds{tool}
- mcp_errors_total{tool, error_code}
```

### Logs (JSON structured)

```json
{
  "timestamp": "2026-03-23T17:00:00Z",
  "level": "info",
  "component": "cpg-service",
  "session_id": "session_abc123",
  "operation": "updateCPG",
  "files_updated": 3,
  "duration_ms": 250,
  "components_added": 12,
  "components_removed": 5
}
```

### Tracing (OpenTelemetry)

```
Span: MCP Tool Call (get_priority_issues)
  └─ Span: API Request (POST /v2/analysis/priority)
      ├─ Span: SurrealDB Query (analysis_problems)
      ├─ Span: CPG Impact Computation
      │   └─ Span: Redis Cache Lookup
      └─ Span: Response Serialization
```

---

## Migration Plan

### Phase 0: Prerequisites
- SurrealDB schema created
- Redis cluster verified
- Helm charts structured

### Phase 1: CPG Library (Week 1-2)
- Translate core classes from Python
- Tree-sitter parser integration
- ONNX model loading and embedding generation
- Unit tests achieving >80% coverage

### Phase 2: Analysis API Foundation (Week 3)
- Hono server setup
- SurrealDB connection
- Redis connection
- Health check endpoint
- Session middleware

### Phase 3: Core Tools (Week 4)
- Implement get_priority_issues
- Implement search_codebase_issues
- Implement annotate_component
- Integration tests

### Phase 4: Advanced Tools (Week 5-6)
- Implement suggest_related_changes
- Implement analyze_change_impact
- Implement mark_problem_complete
- Implement generate_implementation_spec
- Online learning service

### Phase 5: MCP Server (Week 7)
- MCP SDK integration
- Tool registration
- Error handling
- End-to-end tests

### Phase 6: Deployment (Week 8)
- Helm charts
- Kubernetes deployment
- Istio configuration
- Smoke tests in dev cluster

### Phase 7: Validation (Ongoing)
- Performance benchmarking
- Load testing
- Monitoring dashboard
- Documentation

---

## Open Design Questions

1. **CPG Cache Locality:** Should we use StatefulSet with sticky sessions for CPG cache, or accept cache misses with Deployment?
   - **Recommendation:** StatefulSet for predictable performance

2. **FAISS Index Persistence:** Store in PVC or rebuild on startup?
   - **Recommendation:** PVC with periodic snapshots to SurrealDB

3. **Embedding Model Updates:** How to handle ONNX model updates without downtime?
   - **Recommendation:** Blue-green deployment with model version in API

4. **Cross-Project Learning:** Should co-change patterns share across projects in same org?
   - **Recommendation:** Opt-in per project, default isolated

5. **Real-time vs Polling:** Dashboard updates via WebSocket or HTTP polling?
   - **Recommendation:** Start with polling (simpler), add WS later

---

## Performance Targets

| Operation | Target P50 | Target P99 | Notes |
|-----------|-----------|-----------|-------|
| Parse file (1000 LOC) | <50ms | <100ms | Tree-sitter |
| Update CPG (1 file) | <100ms | <200ms | Progressive diff |
| Impact analysis (depth 3) | <15ms | <50ms | Graph traversal |
| Embedding generation | <10ms | <30ms | ONNX inference |
| FAISS search (10K index) | <5ms | <15ms | Approximate NN |
| Co-change prediction | <40ms | <100ms | Hybrid scoring |
| Get priority issues | <100ms | <300ms | DB query + sort |
| Search codebase | <200ms | <500ms | Embedding + FAISS |
| Annotate component | <50ms | <150ms | DB insert |
| Suggest related changes | <300ms | <800ms | Full pipeline |
| Analyze change impact | <400ms | <1s | CPG + embeddings |
| Generate implementation spec | <1s | <3s | Complex analysis |

---

## Success Metrics

**Phase 1 Success (Foundation):**
- ✅ CPG library translates 100% of Python functionality
- ✅ All unit tests pass
- ✅ Performance benchmarks meet targets

**Phase 2 Success (Core Tools):**
- ✅ 3 core MCP tools functional (priority, search, annotate)
- ✅ Integration tests pass
- ✅ API deployed to dev cluster

**Phase 3 Success (Advanced Tools):**
- ✅ All 7 MCP tools functional
- ✅ Online learning records events
- ✅ Co-change predictions improve over 10 commits

**Phase 4 Success (Production Ready):**
- ✅ Performance targets met in load tests
- ✅ Monitoring dashboards operational
- ✅ MiniBob successfully uses analysis tools
- ✅ Zero data loss after pod restarts (SurrealDB validation)

---

## References

- OpenSpec Specifications: `openspec/changes/analysis-api-extraction/specs/`
- Python Source: `repos/metabob-rpc-api/`
- CPG Python Source: `repos/cpg-inference/`
- Activity API Reference: `repos/metabob-activity-api/`
- Deployment Reference: `helm/activity-system-minimal.yaml.gotmpl`
