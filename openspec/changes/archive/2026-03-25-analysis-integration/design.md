# Analysis Integration Design

## Design Decisions

### D1: CPG is Session-Scoped, Not Persistent

**Decision**: The Code Property Graph (CPG) is built per-session and lives in memory.

**Rationale**:
- CPG building is fast enough (<5s for typical codebases)
- Session isolation prevents cross-tenant data leakage
- Avoids complex invalidation logic when files change
- Memory cost is acceptable (~50MB for 1000 components)

**Trade-off**: Must re-index on new session. Acceptable because:
- Agents typically work within single sessions
- Index endpoint is idempotent
- Could add optional persistence later

### D2: Analysis Results Stored Separately, Exposed via Impulses

**Decision**: Analysis results (problems, patterns) stored in dedicated SurrealDB tables, accessible via new impulse pointer types.

**Rationale**:
- Structured tables enable efficient queries (severity filtering, metrics)
- Impulse system handles LLM context formatting
- Separation allows independent scaling
- RBAC applies at both layers

**Alternatives Considered**:
- Store everything as impulses: Rejected (poor query performance)
- Store in activity tables: Rejected (unclear ownership)

### D3: Impulse Proxy Pattern

**Decision**: metabob-activity-api proxies analysis impulse resolution to metabob-analysis-api.

**Rationale**:
- MiniBob already talks to activity-api for impulses
- Avoids adding new dependency to MiniBob
- Centralizes impulse resolution logic
- Allows caching at activity-api layer

**Implementation**:
```typescript
// In activity-api impulse resolver
case 'analysisResult':
  const result = await fetch(`${ANALYSIS_API}/v2/analysis/problems/${pointer.resultId}`)
  return formatAsMarkdown(await result.json())
```

### D4: Asynchronous Learning Feedback

**Decision**: Execution traces trigger learning events asynchronously, non-blocking.

**Rationale**:
- Synchronous would block activity execution
- Thompson Sampling works with eventual consistency
- Allows batching for efficiency
- Failures don't affect core functionality

**Implementation**:
```typescript
// In activity-api after storing trace
if (execution.filesModified.length > 1) {
  fetch(`${ANALYSIS_API}/v2/analysis/learning/cochange`, {
    method: 'POST',
    body: JSON.stringify({ changed_files: execution.filesModified })
  }).catch(() => {}) // Fire and forget
}
```

### D5: MCP Tool for Indexing

**Decision**: Add `index_codebase` MCP tool rather than auto-indexing.

**Rationale**:
- Agent controls when indexing happens
- Can specify patterns (e.g., only TypeScript)
- Transparent about what's being indexed
- Follows "activities do everything" principle

**Alternative Considered**:
- Auto-index on first analysis query: Rejected (slow, opaque)
- Background indexing daemon: Rejected (complexity, resource waste)

---

## Architecture

### Component Interactions

```
                                  ┌─────────────────────┐
                                  │       Agent         │
                                  │   (Claude/Cursor)   │
                                  └──────────┬──────────┘
                                             │
                           ┌─────────────────┼─────────────────┐
                           │                 │                 │
                           ▼                 ▼                 ▼
              ┌────────────────┐   ┌─────────────────┐   ┌─────────────┐
              │  metabob-mcp   │   │    minibob      │   │  dashboard  │
              │                │   │                 │   │             │
              │ index_codebase │   │ Goal processor  │   │ Issues view │
              │ get_priority   │   │ Activity exec   │   │ Metrics     │
              │ search_code    │   │ Impulse mgmt    │   │ Patterns    │
              │ analyze_impact │   │                 │   │             │
              └───────┬────────┘   └────────┬────────┘   └──────┬──────┘
                      │                     │                   │
                      │                     │                   │
          ┌───────────┴─────────────────────┴───────────────────┴──────────┐
          │                                                                 │
          │                    HTTP/REST + WebSocket                        │
          │                                                                 │
          └───────────┬─────────────────────┬───────────────────┬──────────┘
                      │                     │                   │
                      ▼                     ▼                   ▼
          ┌────────────────────────────────────────────────────────────────┐
          │                                                                │
          │  ┌─────────────────────┐       ┌─────────────────────────┐   │
          │  │ metabob-analysis-api│◄─────▶│ metabob-activity-api    │   │
          │  │                     │       │                         │   │
          │  │ POST /index         │       │ POST /impulses/resolve  │   │
          │  │ GET  /status        │       │ (proxies to analysis)   │   │
          │  │ GET  /priority      │       │                         │   │
          │  │ POST /search        │       │ POST /execution-traces  │   │
          │  │ POST /cochange      │       │ (triggers learning)     │   │
          │  │ POST /impact        │       │                         │   │
          │  │ POST /learning/*    │       │                         │   │
          │  └──────────┬──────────┘       └────────────┬────────────┘   │
          │             │                               │                │
          │             │                               │                │
          │  ┌──────────▼──────────┐       ┌────────────▼────────────┐   │
          │  │  cpg-inference-ts   │       │      SurrealDB          │   │
          │  │  (in-memory)        │       │  activity_* tables      │   │
          │  │                     │       │  analysis_* tables      │   │
          │  │  - GraphBuilder     │       │                         │   │
          │  │  - CoChangePredictor│       │                         │   │
          │  │  - FAISSIndex       │       │                         │   │
          │  └─────────────────────┘       └─────────────────────────┘   │
          │                                                                │
          └────────────────────────────────────────────────────────────────┘
```

### Data Flow: Index → Analyze → Act → Learn

```
1. INDEX (Agent → Analysis API → CPG)
   ┌─────────────────────────────────────────────────────────────────────┐
   │                                                                     │
   │  Agent calls:  index_codebase(patterns: ["**/*.ts"])               │
   │       │                                                             │
   │       ▼                                                             │
   │  MCP tool reads files, calls:                                      │
   │       POST /v2/analysis/index { files: { path: content } }         │
   │       │                                                             │
   │       ▼                                                             │
   │  Analysis API:                                                      │
   │       cpgService.addFiles(sessionId, files)                        │
   │       │                                                             │
   │       ▼                                                             │
   │  cpg-inference-ts:                                                 │
   │       - Parse each file with tree-sitter                           │
   │       - Extract nodes (functions, classes, etc.)                   │
   │       - Build edges (calls, imports, contains)                     │
   │       - Generate embeddings via GCN                                │
   │       - Index embeddings in FAISS                                  │
   │                                                                     │
   └─────────────────────────────────────────────────────────────────────┘

2. ANALYZE (Agent → Analysis API → CPG + DB)
   ┌─────────────────────────────────────────────────────────────────────┐
   │                                                                     │
   │  Agent calls:  get_priority_issues(limit: 5)                       │
   │       │                                                             │
   │       ▼                                                             │
   │  MCP tool calls:                                                   │
   │       GET /v2/analysis/priority?limit=5                            │
   │       │                                                             │
   │       ▼                                                             │
   │  Analysis API:                                                      │
   │       1. Query CPG for complexity hotspots                         │
   │       2. Query analysis_problems table                             │
   │       3. Rank by severity + impact_score                           │
   │       4. Return top N issues                                       │
   │                                                                     │
   └─────────────────────────────────────────────────────────────────────┘

3. ACT (MiniBob → Activity API → Analysis API)
   ┌─────────────────────────────────────────────────────────────────────┐
   │                                                                     │
   │  MiniBob goal: "Fix security issues in auth module"                │
   │       │                                                             │
   │       ▼                                                             │
   │  Goal processor loads impulse:                                     │
   │       { type: "analysisResult", resultId: "prob_123" }             │
   │       │                                                             │
   │       ▼                                                             │
   │  Activity API resolves (proxies to analysis):                      │
   │       GET /v2/analysis/problems/prob_123                           │
   │       │                                                             │
   │       ▼                                                             │
   │  Impulse content formatted as markdown:                            │
   │       "## Security Issue\n**Severity**: CRITICAL\n..."             │
   │       │                                                             │
   │       ▼                                                             │
   │  Activity executes with problem context                            │
   │  LLM generates fix with full understanding of issue                │
   │                                                                     │
   └─────────────────────────────────────────────────────────────────────┘

4. LEARN (Activity API → Analysis API → DB)
   ┌─────────────────────────────────────────────────────────────────────┐
   │                                                                     │
   │  Activity completes, trace stored:                                 │
   │       { filesModified: ["src/auth.ts", "src/session.ts"] }         │
   │       │                                                             │
   │       ▼                                                             │
   │  Activity API forwards (async):                                    │
   │       POST /v2/analysis/learning/cochange                          │
   │       { changed_files: ["src/auth.ts", "src/session.ts"] }         │
   │       │                                                             │
   │       ▼                                                             │
   │  Analysis API updates:                                             │
   │       cochange_patterns table                                      │
   │       auth.ts ↔ session.ts: frequency++                           │
   │       │                                                             │
   │       ▼                                                             │
   │  Next co-change query benefits from learned pattern                │
   │                                                                     │
   └─────────────────────────────────────────────────────────────────────┘
```

---

## New Impulse Pointer Types

### analysisResult

Loads a single problem/issue from the analysis system.

```typescript
{
  type: "analysisResult",
  resultId: string,           // Problem ID (e.g., "prob_123")
  format?: "full" | "summary" // Default: "full"
}

// Resolves to markdown:
// ## Security Issue: SQL Injection
// **Severity**: CRITICAL
// **Category**: security
// **Component**: src/auth.ts::function::login::15
// **Impact Score**: 0.95
//
// ### Description
// User input is concatenated directly into SQL query...
//
// ### Suggested Fix
// Use parameterized queries...
```

### cochangeSuggestions

Loads co-change suggestions for components being modified.

```typescript
{
  type: "cochangeSuggestions",
  componentIds: string[],     // Components being changed
  limit?: number              // Default: 5
}

// Resolves to markdown:
// ## Co-Change Suggestions
// When modifying these components, you should also consider:
//
// | Component | Confidence | Reason |
// |-----------|------------|--------|
// | src/session.ts::function::create | 0.85 | Often changed together |
// | src/db.ts::function::query | 0.72 | Dependency relationship |
```

### impactAnalysis

Loads impact analysis for file changes.

```typescript
{
  type: "impactAnalysis",
  changedFiles: string[],     // Files being modified
  maxDepth?: number           // Default: 2
}

// Resolves to markdown:
// ## Impact Analysis
// **Risk Level**: MEDIUM
//
// ### Direct Dependencies (Depth 1)
// - src/session.ts - imports from src/auth.ts
// - src/api/routes.ts - calls login()
//
// ### Indirect Dependencies (Depth 2)
// - src/middleware/auth.ts - uses session
//
// ### Affected Tests
// - tests/auth.spec.ts
// - tests/session.spec.ts
```

### codebaseSearch

Loads semantic search results from the codebase.

```typescript
{
  type: "codebaseSearch",
  query: string,              // Natural language query
  filters?: {
    severity?: string[],
    category?: string[]
  },
  limit?: number              // Default: 10
}

// Resolves to markdown:
// ## Search Results: "authentication vulnerabilities"
//
// ### Results (5 matches)
//
// 1. **src/auth.ts::function::login::15** (score: 0.92)
//    SQL injection vulnerability in login function
//
// 2. **src/session.ts::function::validate::45** (score: 0.78)
//    Missing session expiration check
```

---

## Database Schema Additions

### analysis_problems (existing, needs population)

```sql
DEFINE TABLE analysis_problems SCHEMAFULL;
DEFINE FIELD problem_id ON analysis_problems TYPE record<analysis_problems>;
DEFINE FIELD org_id ON analysis_problems TYPE record<organizations>;
DEFINE FIELD project_id ON analysis_problems TYPE record<projects>;
DEFINE FIELD component_id ON analysis_problems TYPE string;
DEFINE FIELD severity ON analysis_problems TYPE string ASSERT $value IN ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
DEFINE FIELD category ON analysis_problems TYPE string;
DEFINE FIELD message ON analysis_problems TYPE string;
DEFINE FIELD impact_score ON analysis_problems TYPE float;
DEFINE FIELD status ON analysis_problems TYPE string DEFAULT 'open';
DEFINE FIELD detected_at ON analysis_problems TYPE datetime DEFAULT time::now();
DEFINE FIELD resolved_at ON analysis_problems TYPE option<datetime>;
```

### cochange_patterns (existing, needs population)

```sql
DEFINE TABLE cochange_patterns SCHEMAFULL;
DEFINE FIELD pattern_id ON cochange_patterns TYPE record<cochange_patterns>;
DEFINE FIELD org_id ON cochange_patterns TYPE record<organizations>;
DEFINE FIELD project_id ON cochange_patterns TYPE record<projects>;
DEFINE FIELD file_a ON cochange_patterns TYPE string;
DEFINE FIELD file_b ON cochange_patterns TYPE string;
DEFINE FIELD cochange_count ON cochange_patterns TYPE int DEFAULT 0;
DEFINE FIELD confidence ON cochange_patterns TYPE float DEFAULT 0.0;
DEFINE FIELD last_cochanged_at ON cochange_patterns TYPE datetime;
```

---

## Error Handling

### CPG Not Indexed

When analysis queries arrive for unindexed session:

```json
{
  "error": "CPG_NOT_INDEXED",
  "message": "Codebase not indexed. Call index_codebase first.",
  "hint": "Use the index_codebase tool to index source files before analysis."
}
```

### Impulse Resolution Failure

When analysis API is unavailable:

```json
{
  "error": "ANALYSIS_UNAVAILABLE",
  "message": "Could not resolve analysis impulse",
  "fallback": "Continuing without analysis context"
}
```

Activity execution should continue with degraded context rather than failing.

### Learning Feedback Failure

Learning events are fire-and-forget. Failures are logged but don't affect execution:

```typescript
fetch(learningEndpoint, { ... })
  .catch(err => console.warn('Learning feedback failed:', err.message))
```

---

## Security Considerations

### RBAC Enforcement

All analysis tables have PERMISSIONS clauses:

```sql
PERMISSIONS
  FOR select WHERE org_id = $auth.org_id
  FOR create WHERE org_id = $auth.org_id
  FOR update WHERE org_id = $auth.org_id AND ($auth.role = 'admin' OR ...)
  FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin'
```

### Session Isolation

CPG is session-scoped to prevent cross-tenant data leakage:

```typescript
// Each session gets its own predictor
private predictors: Map<string, CoChangePredictor>

// Session ID comes from authenticated request
const sessionId = c.req.header('X-Session-ID')
const predictor = await this.getPredictorForSession(sessionId)
```

### Input Validation

All file content is validated before indexing:

```typescript
// Max file size
if (content.length > 1_000_000) throw new Error('File too large')

// Allowed extensions only
const ext = path.extname(filePath)
if (!ALLOWED_EXTENSIONS.includes(ext)) throw new Error('Invalid file type')
```

---

## Performance Considerations

### CPG Indexing

- **Target**: <5 seconds for 1000 files
- **Current**: ~3-5 seconds (tree-sitter + FAISS)
- **Memory**: ~50MB for 1000 components

### Impulse Resolution

- **Target**: <100ms per impulse
- **Caching**: Redis with 1hr TTL for common queries
- **Batch**: Multiple impulses resolved in parallel

### Learning Feedback

- **Target**: <10ms impact on execution
- **Strategy**: Async/non-blocking
- **Batching**: Could aggregate events for bulk insert

---

## Future Extensions

### Persistent CPG (P2)

Store CPG snapshots in SurrealDB per commit hash:

```sql
DEFINE TABLE cpg_snapshots;
DEFINE FIELD project_id ON cpg_snapshots TYPE record<projects>;
DEFINE FIELD commit_hash ON cpg_snapshots TYPE string;
DEFINE FIELD cpg_data ON cpg_snapshots TYPE object;  // Serialized graph
DEFINE FIELD created_at ON cpg_snapshots TYPE datetime;
```

### Incremental Indexing (P2)

Track file hashes to only re-index changed files:

```typescript
async indexIncremental(sessionId: string, files: Record<string, string>) {
  const existing = this.fileHashes.get(sessionId) || {};
  for (const [path, content] of Object.entries(files)) {
    const hash = crypto.hash(content);
    if (existing[path] !== hash) {
      await this.predictor.addFile(path, content);
      existing[path] = hash;
    }
  }
}
```

### Cross-Project Patterns (P3)

Learn patterns across projects to bootstrap new codebases:

```sql
SELECT file_a, file_b, SUM(cochange_count) as total
FROM cochange_patterns
WHERE org_id = $auth.org_id
GROUP BY file_a, file_b
ORDER BY total DESC
LIMIT 100
```
