# MCP Tools → Analysis API Mapping

**Purpose:** Define how each MCP tool maps to backend API endpoints and what data/services are required.

---

## Mapping Table

| MCP Tool | API Endpoint(s) | HTTP Method | CPG Required | SurrealDB Tables | Redis Cache |
|----------|----------------|-------------|--------------|-----------------|-------------|
| get_priority_issues | `/v2/analysis/problems/priority` | GET | Yes (impact scores) | analysis_problems, code_components | Yes (rankings) |
| search_codebase_issues | `/v2/analysis/problems/search` | POST | No | analysis_problems, component_annotations | Yes (embeddings) |
| annotate_component | `/v2/analysis/components/:id/annotate` | POST | Yes (verify component exists) | component_annotations, code_components | No |
| suggest_related_changes | `/v2/analysis/cochange/suggest` | POST | Yes (embeddings) | cochange_patterns | Yes (FAISS index) |
| analyze_change_impact | `/v2/analysis/impact/analyze` | POST | Yes (traversal) | code_components, impact_relations | Yes (cached results) |
| mark_problem_complete | `/v2/analysis/problems/:id/resolve` | POST | Yes (for annotation) | analysis_problems, component_annotations | No |
| generate_implementation_spec | `/v2/analysis/specs/generate` | POST | Yes (full graph) | code_components, component_annotations, design_patterns | Yes (spec cache) |

---

## Detailed API Specifications

### 1. GET /v2/analysis/problems/priority

**Supports MCP Tool:** `get_priority_issues`

**Request:**
```typescript
Query Parameters:
  limit?: number (default: 5)
  severity?: string[] (comma-separated: "HIGH,MEDIUM")
  category?: string[] (comma-separated: "bug,security")
  scope?: "session" | "project" | "org" (default: "session")

Headers:
  Authorization: Bearer <session_token>
```

**Response:**
```typescript
{
  issues: Array<{
    problem_id: string;
    file_path: string;
    category: string;
    severity: string;
    summary: string;
    impact_score: number;
    affected_components: number;
    priority_rank: number;
  }>;
  total_issues: number;
}
```

**Backend Logic:**
1. Extract session_id/project_id/org_id from auth token
2. Query SurrealDB `analysis_problems` filtered by scope
3. For each problem, call CPG library to compute impact_score:
   ```typescript
   const cpg = await getCPGForSession(session_id);
   const componentId = problem.component_id;
   const impact = await cpg.getImpactSet([componentId], maxDepth: 3);
   const impactScore = computeScore(impact, problem.severity);
   ```
4. Rank problems: `priority = severity_weight * impact_score`
5. Cache rankings in Redis (TTL: 5 minutes)
6. Return top N problems

**Required Services:**
- CPG library (impact analysis)
- SurrealDB query engine
- Redis cache

---

### 2. POST /v2/analysis/problems/search

**Supports MCP Tool:** `search_codebase_issues`

**Request:**
```typescript
{
  query: string;
  similarity_threshold?: number (default: 0.7);
  limit?: number (default: 10);
  scope?: "session" | "project" | "org" (default: "project");
  filters?: {
    severity?: string[];
    category?: string[];
    file_pattern?: string;
  };
}

Headers:
  Authorization: Bearer <session_token>
```

**Response:**
```typescript
{
  issues: Array<{
    problem_id: string;
    file_path: string;
    category: string;
    severity: string;
    summary: string;
    description: string;
    similarity_score: number;
    annotations?: Array<{
      component_id: string;
      content: string;
      created_at: string;
    }>;
  }>;
  query_embedding: number[];
}
```

**Backend Logic:**
1. Generate embedding for query:
   ```typescript
   const embedding = await onnxModel.generateEmbedding(query);
   ```
2. Search FAISS index for similar problem embeddings
3. Retrieve problem IDs from Redis cache
4. Query SurrealDB for full problem details:
   ```sql
   SELECT *,
     (SELECT * FROM component_annotations WHERE component_id = $parent.component_id)
     AS annotations
   FROM analysis_problems
   WHERE id IN $problem_ids
   AND scope MATCHES $scope_filter
   ```
5. Filter by file_pattern if provided (glob match)
6. Sort by similarity_score DESC
7. Store query → results mapping for online learning
8. Return top N results

**Required Services:**
- ONNX embedding model
- FAISS vector index (Redis)
- SurrealDB with graph queries
- Online learning queue

---

### 3. POST /v2/analysis/components/:component_id/annotate

**Supports MCP Tool:** `annotate_component`

**Request:**
```typescript
{
  annotation: string;
  annotation_type: "design_decision" | "resolved_challenge" | "implementation_note" | "warning";
  related_problem_id?: string;
  tags?: string[];
}

Headers:
  Authorization: Bearer <session_token>
```

**Response:**
```typescript
{
  annotation_id: string;
  component_id: string;
  content: string;
  annotation_type: string;
  created_at: string;
  created_by: string;
  related_problem_id?: string;
  tags: string[];
}
```

**Backend Logic:**
1. Verify component_id exists in CPG:
   ```typescript
   const cpg = await getCPGForSession(session_id);
   const componentExists = await cpg.hasComponent(component_id);
   if (!componentExists) throw new ComponentNotFoundError();
   ```
2. Insert annotation into SurrealDB:
   ```sql
   CREATE component_annotations CONTENT {
     component_id: $component_id,
     content: $annotation,
     annotation_type: $type,
     created_at: time::now(),
     created_by: $session_id,
     related_problem_id: $problem_id,
     tags: $tags
   };
   ```
3. If related_problem_id provided, create bidirectional link:
   ```sql
   RELATE analysis_problems:$problem_id->documented_by->component_annotations:$annotation_id;
   ```
4. Update component metadata:
   ```sql
   UPDATE code_components:$component_id SET last_annotated_at = time::now();
   ```
5. Trigger re-embedding for semantic search (async)
6. Return created annotation

**Required Services:**
- CPG library (component verification)
- SurrealDB (storage, graph relations)
- Embedding pipeline (async)

---

### 4. POST /v2/analysis/cochange/suggest

**Supports MCP Tool:** `suggest_related_changes`

**Request:**
```typescript
{
  changed_files: string[];
  diff?: string;
  max_suggestions?: number (default: 10);
  confidence_threshold?: number (default: 0.6);
}

Headers:
  Authorization: Bearer <session_token>
```

**Response:**
```typescript
{
  suggestions: Array<{
    file_path: string;
    confidence: number;
    reason: string;
    cochange_frequency: number;
    embedding_similarity: number;
    affected_components: string[];
  }>;
  model_version: string;
}
```

**Backend Logic:**
1. Load project-specific co-change model from Redis:
   ```typescript
   const modelVersion = await redis.get(`cochange:model:${project_id}`);
   const faissIndex = await loadFAISSIndex(project_id);
   ```
2. Generate embeddings for changed_files:
   ```typescript
   const cpg = await getCPGForSession(session_id);
   const embeddings = await Promise.all(
     changed_files.map(f => cpg.getFileEmbedding(f))
   );
   ```
3. Query FAISS index for similar files:
   ```typescript
   const similarFiles = await faissIndex.search(embeddings, k: 50);
   ```
4. Load historical co-change patterns from SurrealDB:
   ```sql
   SELECT file_pairs, frequency, last_cochange_at
   FROM cochange_patterns
   WHERE project_id = $project_id
   AND file_pairs CONTAINSANY $changed_files
   ORDER BY frequency DESC;
   ```
5. Compute hybrid scores:
   ```typescript
   const score = 0.6 * embeddingSimilarity + 0.4 * normalizedFrequency;
   ```
6. Filter by confidence_threshold
7. Get affected components from CPG for each suggested file
8. **Online learning side effect:**
   ```typescript
   await redis.lpush(`cochange:events:${project_id}`, JSON.stringify({
     changed_files,
     timestamp: Date.now(),
     session_id
   }));
   ```
9. Return top N suggestions

**Required Services:**
- CPG library (embeddings, component lookup)
- FAISS index (per-project)
- SurrealDB (historical patterns)
- Redis (model cache, online learning queue)
- Background worker (model updates)

---

### 5. POST /v2/analysis/impact/analyze

**Supports MCP Tool:** `analyze_change_impact`

**Request:**
```typescript
{
  changed_files: string[];
  diff?: string;
  max_depth?: number (default: 3);
  analysis_type?: "forward" | "backward" | "both" (default: "both");
}

Headers:
  Authorization: Bearer <session_token>
```

**Response:**
```typescript
{
  impact_analysis: {
    direct_dependencies: Array<{
      file_path: string;
      component_id: string;
      relationship: "calls" | "imports" | "inherits" | "data_flow";
      risk_level: "HIGH" | "MEDIUM" | "LOW";
    }>;
    indirect_dependencies: Array<{
      file_path: string;
      component_id: string;
      path_from_change: string[];
      depth: number;
      risk_level: "HIGH" | "MEDIUM" | "LOW";
    }>;
    affected_tests: Array<{
      file_path: string;
      test_name: string;
      coverage_type: "unit" | "integration" | "e2e";
    }>;
  };
  total_affected_components: number;
  review_required: string[];
}
```

**Backend Logic:**
1. Parse diff (if provided) to extract modified components:
   ```typescript
   const modifiedComponents = diff
     ? parseDiffForComponents(diff)
     : await cpg.getComponentsInFiles(changed_files);
   ```
2. Traverse CPG based on analysis_type:
   ```typescript
   const cpg = await getCPGForSession(session_id);

   const forward = analysis_type !== "backward"
     ? await cpg.getImpactSet(modifiedComponents, max_depth)
     : [];

   const backward = analysis_type !== "forward"
     ? await cpg.getReverseImpactSet(modifiedComponents, max_depth)
     : [];
   ```
3. Compute risk levels:
   ```typescript
   const riskLevel = computeRisk({
     depth,
     componentCriticality: getTestCoverage(componentId),
     hasAnnotations: await hasAnnotations(componentId)
   });
   ```
4. Identify affected tests (components in test files):
   ```typescript
   const tests = backward.filter(c => c.file_path.includes('test'));
   ```
5. Exclude already-changed files from review list:
   ```typescript
   const reviewRequired = [...forward, ...backward]
     .map(c => c.file_path)
     .filter(f => !changed_files.includes(f));
   ```
6. Cache result in Redis (key: hash of changed_files + params):
   ```typescript
   await redis.setex(cacheKey, 300, JSON.stringify(result));
   ```
7. Store impact event for analytics:
   ```sql
   CREATE impact_analysis_event CONTENT {
     session_id: $session_id,
     changed_files: $changed_files,
     total_affected: $count,
     analyzed_at: time::now()
   };
   ```
8. Return impact analysis

**Required Services:**
- CPG library (graph traversal, component lookup)
- Diff parser
- SurrealDB (annotations, test coverage data)
- Redis (caching)

---

### 6. POST /v2/analysis/problems/:problem_id/resolve

**Supports MCP Tool:** `mark_problem_complete`

**Request:**
```typescript
{
  resolution_summary: string;
  fixed_in_commit?: string;
  created_annotation?: boolean (default: true);
}

Headers:
  Authorization: Bearer <session_token>
```

**Response:**
```typescript
{
  problem_id: string;
  status: "resolved";
  resolved_at: string;
  resolution_summary: string;
  annotation_created?: {
    annotation_id: string;
    component_id: string;
    content: string;
  };
}
```

**Backend Logic:**
1. Fetch problem from SurrealDB:
   ```sql
   SELECT * FROM analysis_problems WHERE id = $problem_id;
   ```
2. Update problem status:
   ```sql
   UPDATE analysis_problems:$problem_id SET {
     status: "resolved",
     resolved_at: time::now(),
     resolution_summary: $summary,
     fixed_in_commit: $commit
   };
   ```
3. If created_annotation = true:
   a. Generate annotation content:
   ```typescript
   const annotationContent = `
   **Resolved Issue:** ${problem.summary}
   **Fix:** ${resolution_summary}
   **Severity:** ${problem.severity}
   ${fixed_in_commit ? `**Fixed in:** ${fixed_in_commit}` : ''}
   `;
   ```
   b. Extract component_id from problem
   c. Create annotation (call POST /v2/analysis/components/:id/annotate internally)
   d. Link problem ↔ annotation:
   ```sql
   RELATE analysis_problems:$problem_id->resolved_by->component_annotations:$annotation_id;
   ```
4. **Online learning side effect:**
   ```typescript
   await redis.lpush(`problem:resolutions:${project_id}`, JSON.stringify({
     problem_id,
     category: problem.category,
     severity: problem.severity,
     resolution_summary,
     resolved_at: Date.now()
   }));
   ```
5. Return result with annotation_created details

**Required Services:**
- SurrealDB (problem updates, annotation creation, graph relations)
- Redis (online learning queue)

---

### 7. POST /v2/analysis/specs/generate

**Supports MCP Tool:** `generate_implementation_spec`

**Request:**
```typescript
{
  goal: string;
  entry_points?: string[];
  max_depth?: number (default: 5);
  include_patterns?: boolean (default: true);
}

Headers:
  Authorization: Bearer <session_token>
```

**Response:**
```typescript
{
  specification: {
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
  };
  confidence: number;
}
```

**Backend Logic:**
1. Parse goal to extract intent (LLM or keyword extraction)
2. If entry_points provided, start there. Otherwise, semantic search:
   ```typescript
   const goalEmbedding = await onnxModel.generateEmbedding(goal);
   const relevantComponents = await faissIndex.search(goalEmbedding, k: 20);
   ```
3. Load CPG and traverse from entry points:
   ```typescript
   const cpg = await getCPGForSession(session_id);
   const subgraph = await cpg.getNeighborhood(entry_points, max_depth);
   ```
4. Load annotations for all components in subgraph:
   ```sql
   SELECT component_id, content, annotation_type
   FROM component_annotations
   WHERE component_id IN $component_ids;
   ```
5. Analyze data flow:
   ```typescript
   const dataFlow = await cpg.traceDataFlow(entry_points);
   ```
6. If include_patterns = true, detect design patterns:
   ```typescript
   const patterns = await detectDesignPatterns(cpg, subgraph);
   ```
7. Find similar components for new component suggestions:
   ```typescript
   const similarExisting = await faissIndex.search(
     componentEmbedding,
     k: 5
   );
   ```
8. Generate implementation order (topological sort of dependencies)
9. Generate data flow diagram (ASCII or Mermaid)
10. Compute confidence based on annotation coverage:
    ```typescript
    const confidence = annotatedComponents / totalComponents;
    ```
11. Cache generated spec:
    ```typescript
    await redis.setex(`spec:${hash(goal)}`, 3600, JSON.stringify(spec));
    ```
12. Return specification

**Required Services:**
- CPG library (full graph analysis, pattern detection)
- ONNX embedding model
- FAISS index
- SurrealDB (annotations, design patterns)
- Redis (spec cache)
- LLM/NLP for goal parsing (optional)

---

## Shared Backend Services

### CPG Service
```typescript
class CPGService {
  async getCPGForSession(session_id: string): Promise<CoChangePredictor>;
  async updateCPG(session_id: string, files: File[]): Promise<void>;
  async computeImpactScore(component_id: string, severity: string): Promise<number>;
}
```

### Embedding Service
```typescript
class EmbeddingService {
  async generateEmbedding(text: string): Promise<number[]>;
  async searchSimilar(embedding: number[], k: number): Promise<string[]>;
  async updateIndex(component_id: string, embedding: number[]): Promise<void>;
}
```

### Online Learning Service
```typescript
class OnlineLearningService {
  async recordCochangeEvent(project_id: string, event: CochangeEvent): Promise<void>;
  async recordSearchQuery(query: string, clickedResults: string[]): Promise<void>;
  async recordProblemResolution(problem_id: string, resolution: Resolution): Promise<void>;
  async updateModels(project_id: string): Promise<void>; // Background worker
}
```

### Auth Service
```typescript
class AuthService {
  async validateSessionToken(token: string): Promise<SessionContext>;
  async extractScope(session_id: string): Promise<{ org_id, project_id, session_id }>;
}
```

---

## Next Steps

With this mapping defined, we can now specify:
1. **CPG Library API** - What methods cpg-inference-ts must provide
2. **SurrealDB Schemas** - Exact table definitions and relations
3. **Redis Data Structures** - Cache keys, FAISS indexes, queues
4. **Background Workers** - Online learning, model updates, re-embedding

Should we continue "backwards" to define the CPG library interface, or "turn around" and work forward from data schemas?
