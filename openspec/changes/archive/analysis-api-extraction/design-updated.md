# Analysis API Extraction - Design Document (Updated)

**Status:** Draft
**Created:** 2026-03-23
**Last Updated:** 2026-03-23
**Changes:** Corrected metabob-mcp architecture (per-workspace, not centralized)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  Development Workspace A (local)                                 │
│                                                                  │
│  ┌────────────┐         MCP Protocol (stdio)                    │
│  │  MiniBob   │────────────────────┐                            │
│  │  (agent)   │                    │                            │
│  └────────────┘                    ▼                            │
│                           ┌──────────────────┐                  │
│                           │  metabob-mcp     │                  │
│                           │  (local process) │                  │
│                           │                  │                  │
│                           │  • File watcher  │                  │
│                           │  • AST parser    │                  │
│                           │  • CPG builder   │                  │
│                           │  • Embeddings    │                  │
│                           │  • MCP server    │                  │
│                           └────┬────────┬────┘                  │
│                                │        │                       │
│                                │        └──► Local SQLite       │
│                                │            (encrypted, WAL)    │
│                                │            - Workspace state    │
│                                │            - Pending sync       │
│                                │                                │
│                                │ Watches local codebase          │
│                                ▼                                │
│                           Codebase files                         │
│                      (as agent writes changes)                   │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         │ HTTPS (periodic push)
                         │ POST /v2/sync/components
                         │ POST /v2/sync/embeddings
                         │ POST /v2/sync/annotations
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              metabob-analysis-api (cluster backend)              │
│  ┌────────────────────┐  ┌─────────────────────────────────┐   │
│  │  HTTP Layer (Hono) │  │   Backend Services               │   │
│  │  - Auth/Sessions   │  │   - CPGService                   │   │
│  │  - Sync endpoints  │  │   - EmbeddingService             │   │
│  │  - Query endpoints │  │   - OnlineLearningService        │   │
│  │  - Analytics       │  │   - AnnotationService            │   │
│  └────────────────────┘  └─────────────────────────────────┘   │
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
                                               │
                                               │ Query via API
                                               ▼
                                      ┌──────────────────────┐
                                      │ metabob-cloud-       │
                                      │   dashboard          │
                                      │ (visualization)      │
                                      └──────────────────────┘
```

**Key Architectural Points:**

1. **metabob-mcp runs locally** in each development workspace alongside the agent
2. **MCP protocol** connects agent ↔ metabob-mcp via stdio (local communication)
3. **Local SQLite** stores workspace-specific state (encrypted, WAL mode)
4. **File watcher** detects changes as agent writes code
5. **Push-based sync** sends components/embeddings/annotations to analysis-api
6. **Reverse chrono** processing (newest changes first)
7. **Dashboard queries SurrealDB** via analysis-api, never accesses metabob-mcp

---

## Component Designs

### 1. metabob-mcp (Per-Workspace Local Process)

**Technology:** TypeScript + Bun + @modelcontextprotocol/sdk
**Size:** ~1,500-2,500 LOC
**Deployment:** Bundled with agent executor (MiniBob, OpenCode, etc.)

#### Architecture

```
┌──────────────────────────────────────────────────────┐
│              metabob-mcp (local process)             │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │          MCP Server (stdio)                │     │
│  │  Tools:                                    │     │
│  │  - get_priority_issues                     │     │
│  │  - search_codebase_issues                  │     │
│  │  - annotate_component                      │     │
│  │  - suggest_related_changes                 │     │
│  │  - analyze_change_impact                   │     │
│  │  - mark_problem_complete                   │     │
│  │  - generate_implementation_spec            │     │
│  └──────────────────┬─────────────────────────┘     │
│                     │                               │
│                     ▼                               │
│  ┌────────────────────────────────────────────┐     │
│  │       File Watcher (chokidar)              │     │
│  │  - Watch workspace directory               │     │
│  │  - Detect .ts/.js/.py/etc changes          │     │
│  │  - Queue for processing                    │     │
│  └──────────────────┬─────────────────────────┘     │
│                     │                               │
│                     ▼                               │
│  ┌────────────────────────────────────────────┐     │
│  │       Parser & CPG Builder                 │     │
│  │  - tree-sitter parsers                     │     │
│  │  - Extract components                      │     │
│  │  - Build local CPG                         │     │
│  │  - Generate embeddings                     │     │
│  └──────────────────┬─────────────────────────┘     │
│                     │                               │
│                     ▼                               │
│  ┌────────────────────────────────────────────┐     │
│  │       Local State (SQLite)                 │     │
│  │  - Encrypted (sqlcipher)                   │     │
│  │  - WAL mode                                │     │
│  │  - Workspace metadata                      │     │
│  │  - Sync queue                              │     │
│  │  - File hashes                             │     │
│  │  - Pending embeddings                      │     │
│  └──────────────────┬─────────────────────────┘     │
│                     │                               │
│                     ▼                               │
│  ┌────────────────────────────────────────────┐     │
│  │       Sync Client                          │     │
│  │  - Batch components (50-100 per request)   │     │
│  │  - Reverse chrono order (newest first)     │     │
│  │  - Retry with exponential backoff          │     │
│  │  - POST to analysis-api                    │     │
│  └────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

#### Directory Structure

```
repos/metabob-mcp/
├── src/
│   ├── index.ts              # Entry point (starts MCP server + watcher)
│   ├── mcp/
│   │   ├── server.ts         # MCP server implementation
│   │   ├── tools/
│   │   │   ├── index.ts      # Tool registry
│   │   │   ├── get-priority-issues.ts
│   │   │   ├── search-codebase.ts
│   │   │   ├── annotate-component.ts
│   │   │   ├── suggest-changes.ts
│   │   │   ├── analyze-impact.ts
│   │   │   ├── mark-complete.ts
│   │   │   └── generate-spec.ts
│   │   └── types.ts          # MCP types
│   ├── watcher/
│   │   ├── file-watcher.ts   # Chokidar-based file watching
│   │   ├── parser.ts         # Tree-sitter integration
│   │   ├── cpg-builder.ts    # Local CPG construction
│   │   └── queue.ts          # Processing queue
│   ├── storage/
│   │   ├── sqlite.ts         # SQLite client (sqlcipher)
│   │   ├── schema.ts         # Local DB schema
│   │   └── migrations.ts     # Schema versioning
│   ├── sync/
│   │   ├── client.ts         # HTTP client for analysis-api
│   │   ├── batcher.ts        # Batch updates
│   │   └── retry.ts          # Retry logic
│   └── types.ts              # Shared type definitions
├── tests/
│   └── integration/
│       └── workspace-sync.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

#### Key Classes

```typescript
// src/index.ts
class WorkspaceMCP {
  private mcpServer: MCPServer;
  private fileWatcher: FileWatcher;
  private syncClient: SyncClient;
  private sqlite: SQLiteStorage;

  async start(): Promise<void> {
    // 1. Initialize local SQLite
    await this.sqlite.init();

    // 2. Start MCP server (stdio)
    await this.mcpServer.listen();

    // 3. Start file watcher
    await this.fileWatcher.watch(process.env.WORKSPACE_PATH);

    // 4. Start sync loop (every 30s)
    setInterval(() => this.sync(), 30_000);
  }

  private async sync(): Promise<void> {
    const pending = await this.sqlite.getPendingSync();
    if (pending.length === 0) return;

    // Batch and push to analysis-api
    await this.syncClient.push(pending);
    await this.sqlite.markSynced(pending.map(p => p.id));
  }
}

// src/watcher/file-watcher.ts
class FileWatcher {
  private watcher: FSWatcher;
  private parser: TreeSitterParser;
  private queue: ProcessingQueue;

  async watch(path: string): Promise<void> {
    this.watcher = chokidar.watch(path, {
      ignored: /node_modules|\.git/,
      persistent: true,
      ignoreInitial: false, // Process existing files
    });

    this.watcher
      .on('add', (filePath) => this.onFileChange(filePath, 'add'))
      .on('change', (filePath) => this.onFileChange(filePath, 'change'))
      .on('unlink', (filePath) => this.onFileChange(filePath, 'delete'));
  }

  private async onFileChange(filePath: string, event: 'add' | 'change' | 'delete'): Promise<void> {
    // Queue for processing (debounced)
    await this.queue.add({ filePath, event, timestamp: Date.now() });
  }
}

// src/sync/client.ts
class SyncClient {
  private apiURL: string;
  private apiKey: string;

  async push(items: SyncItem[]): Promise<void> {
    // Reverse chronological order (newest first)
    items.sort((a, b) => b.timestamp - a.timestamp);

    // Batch by type
    const components = items.filter(i => i.type === 'component');
    const embeddings = items.filter(i => i.type === 'embedding');
    const annotations = items.filter(i => i.type === 'annotation');

    // Push to analysis-api
    if (components.length > 0) {
      await this.post('/v2/sync/components', { items: components });
    }
    if (embeddings.length > 0) {
      await this.post('/v2/sync/embeddings', { items: embeddings });
    }
    if (annotations.length > 0) {
      await this.post('/v2/sync/annotations', { items: annotations });
    }
  }

  private async post(endpoint: string, body: unknown): Promise<void> {
    const response = await fetch(`${this.apiURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }
  }
}
```

#### Local SQLite Schema

```sql
-- Workspace metadata
CREATE TABLE workspace_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- File tracking
CREATE TABLE files (
  file_path TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  last_modified INTEGER NOT NULL,
  last_synced INTEGER,
  status TEXT CHECK(status IN ('pending', 'synced', 'error'))
);

-- Component sync queue
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT CHECK(type IN ('component', 'embedding', 'annotation')),
  payload TEXT NOT NULL,  -- JSON
  timestamp INTEGER NOT NULL,
  synced INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0
);

CREATE INDEX idx_sync_queue_pending ON sync_queue(synced, timestamp DESC);
```

---

### 2. metabob-analysis-api (Centralized Backend)

**Technology:** TypeScript + Bun + Hono + SurrealDB + Redis
**Size:** ~3,000-5,000 LOC
**Deployment:** StatefulSet in Kubernetes (activity-system namespace)

#### New Sync Endpoints

```typescript
// src/routes/sync.ts

/**
 * Receive component updates from workspace metabob-mcp instances
 */
app.post('/v2/sync/components', async (c) => {
  const { items } = await c.req.json();
  const sessionId = c.get('sessionId'); // From JWT
  const projectId = await resolveProjectId(sessionId);

  // Validate and insert components
  const inserted = [];
  for (const item of items) {
    const component = await db.query(
      `INSERT INTO code_components {
        component_id: $id,
        project_id: $project,
        session_id: $session,
        file_path: $file,
        component_type: $type,
        name: $name,
        start_line: $start,
        end_line: $end,
        created_at: time::now()
      }`,
      {
        id: item.component_id,
        project: projectId,
        session: sessionId,
        file: item.file_path,
        type: item.component_type,
        name: item.name,
        start: item.start_line,
        end: item.end_line,
      }
    );
    inserted.push(inserted);
  }

  // Update project sync_status
  await db.query(
    `UPDATE projects SET sync_status = {
      files_indexed: sync_status.files_indexed + $count,
      components_found: sync_status.components_found + $count,
      last_sync_at: time::now()
    } WHERE project_id = $project`,
    { count: items.length, project: projectId }
  );

  return c.json({ received: items.length, inserted: inserted.length });
});

/**
 * Receive embedding updates from workspace metabob-mcp instances
 */
app.post('/v2/sync/embeddings', async (c) => {
  const { items } = await c.req.json();
  const projectId = c.get('projectId');

  // Store embeddings and update FAISS index
  const embeddingService = c.get('embeddingService');
  for (const item of items) {
    await embeddingService.indexComponent(item.component_id, item.embedding);
  }

  // Update project sync_status
  await db.query(
    `UPDATE projects SET sync_status.embeddings_generated = sync_status.embeddings_generated + $count
     WHERE project_id = $project`,
    { count: items.length, project: projectId }
  );

  return c.json({ received: items.length });
});

/**
 * Receive annotation updates from workspace metabob-mcp instances
 */
app.post('/v2/sync/annotations', async (c) => {
  const { items } = await c.req.json();
  const sessionId = c.get('sessionId');
  const username = c.get('username'); // From JWT

  // Insert annotations
  for (const item of items) {
    await db.query(
      `INSERT INTO component_annotations {
        annotation_id: $id,
        component_id: $component,
        session_id: $session,
        content: $content,
        annotation_type: $type,
        created_by: $user,
        tags: $tags,
        created_at: time::now()
      }`,
      {
        id: crypto.randomUUID(),
        component: item.component_id,
        session: sessionId,
        content: item.content,
        type: item.annotation_type,
        user: username,
        tags: item.tags || [],
      }
    );
  }

  return c.json({ received: items.length });
});
```

#### Updated Directory Structure

```
repos/metabob-analysis-api/
├── src/
│   ├── index.ts              # Server entry point (Hono app)
│   ├── routes/
│   │   ├── sync.ts           # NEW: Sync endpoints for workspace push
│   │   ├── query.ts          # Query endpoints for dashboard/tools
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

---

### 3. cpg-inference-ts (Code Property Graph Library)

**Technology:** TypeScript + tree-sitter + ONNX + FAISS
**Size:** ~4,000-6,000 LOC
**Type:** NPM library (not deployed standalone)

**No changes to library architecture** - used by both metabob-mcp (locally) and metabob-analysis-api (centralized).

---

## Data Flow Diagrams

### 1. Workspace Sync Flow (New Primary Flow)

```
┌──────────────────────────────────────────────────────────┐
│  Developer writes code                                   │
│  (via MiniBob, manual edits, etc.)                       │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ▼
           ┌────────────────────────┐
           │  metabob-mcp           │
           │  (local file watcher)  │
           └────────┬───────────────┘
                    │
                    │ 1. Detect file change
                    │ 2. Parse with tree-sitter
                    │ 3. Extract components
                    │ 4. Generate embeddings
                    │ 5. Store in local SQLite
                    │ 6. Queue for sync
                    ▼
           ┌────────────────────────┐
           │  Sync Loop (30s)       │
           │  Batch pending items   │
           └────────┬───────────────┘
                    │
                    │ POST /v2/sync/components
                    │ POST /v2/sync/embeddings
                    │ POST /v2/sync/annotations
                    │ (Reverse chrono order)
                    ▼
         ┌──────────────────────────┐
         │  metabob-analysis-api    │
         │  (cluster backend)       │
         └──────────┬───────────────┘
                    │
                    │ 1. Validate session/project
                    │ 2. Insert into SurrealDB
                    │ 3. Update FAISS index
                    │ 4. Update project sync_status
                    │ 5. Trigger learning updates
                    ▼
         ┌──────────────────────────┐
         │  SurrealDB               │
         │  • code_components       │
         │  • embeddings            │
         │  • annotations           │
         │  • cochange_patterns     │
         └──────────┬───────────────┘
                    │
                    │ Query
                    ▼
         ┌──────────────────────────┐
         │  metabob-cloud-dashboard │
         │  (shows sync progress)   │
         └──────────────────────────┘
```

### 2. MCP Tool Call Flow (Unchanged)

```
AI Agent (Claude/Cursor)
   │
   │ MCP: get_priority_issues({ limit: 5, severity: ["high"] })
   ▼
metabob-mcp (local)
   │
   │ Delegates to analysis-api for data
   │ HTTP GET /v2/analysis/priority
   ▼
metabob-analysis-api
   │
   │ 1. Resolve session → project
   │ 2. Query SurrealDB: analysis_problems
   │ 3. Compute priority ranks
   │ 4. Return results
   ▼
metabob-mcp (local)
   │
   │ Transform to MCP format
   ▼
AI Agent
```

---

## Deployment Architecture

### Kubernetes Resources

**Namespace:** `activity-system` (shared)

**Components:**

1. **metabob-analysis-api** - StatefulSet (3 replicas)
   - Headless service for sticky CPG cache
   - PVC for FAISS indexes (10GB per pod)
   - Resource limits: 2 CPU, 4GB RAM

2. **SurrealDB** - Existing StatefulSet (reused)
   - Namespace: `activity_system`
   - Database: `learning_loop`

3. **Redis/Valkey** - Existing Deployment (reused)
   - No persistence (cache only)

**NOT DEPLOYED TO CLUSTER:**
- metabob-mcp (runs locally with each agent)

### Local Development Setup

```bash
# Start metabob-mcp alongside MiniBob
cd repos/metabob-mcp

# Configure workspace
export WORKSPACE_PATH="$HOME/code/my-project"
export ANALYSIS_API_URL="http://analysis.minibob.local"
export API_KEY="your-api-key"
export SQLITE_PATH="./.metabob/workspace.db"

# Start MCP server + file watcher
bun run start

# In another terminal, start MiniBob with MCP config
cd repos/minibob
MCP_SERVER_PATH=../metabob-mcp/src/index.ts bun run start
```

### MiniBob Integration

```typescript
// repos/minibob/src/mcp.ts

// Configure metabob-mcp as local MCP server
const mcpServers = {
  analysis: {
    command: 'bun',
    args: ['run', '../metabob-mcp/src/index.ts'],
    env: {
      WORKSPACE_PATH: process.cwd(),
      ANALYSIS_API_URL: process.env.ANALYSIS_API_URL,
      API_KEY: process.env.API_KEY,
    }
  }
};
```

---

## Updated Open Design Questions

1. **Sync Frequency:** 30s interval sufficient, or trigger on file save?
   - **Recommendation:** 30s batch sync + immediate on MCP tool calls

2. **Local SQLite Encryption:** Always encrypt or optional?
   - **Recommendation:** Always encrypt (contains code embeddings)

3. **Workspace Discovery:** How does dashboard show which workspaces are active?
   - **Recommendation:** heartbeat mechanism (workspace → analysis-api every 60s)

4. **Multi-Workspace Sync:** Same project across multiple workspaces - conflict resolution?
   - **Recommendation:** Last-write-wins, use file hash for deduplication

5. **Offline Development:** Handle sync failures gracefully?
   - **Recommendation:** Queue grows in SQLite, retry when online

---

## Performance Targets (Updated)

| Operation | Target P50 | Target P99 | Notes |
|-----------|-----------|-----------|-------|
| File change detection | <50ms | <100ms | Chokidar debounced |
| Parse file (1000 LOC) | <50ms | <100ms | Tree-sitter |
| Local CPG update | <100ms | <200ms | SQLite write |
| Batch sync (50 items) | <500ms | <1s | Network + DB insert |
| Workspace startup | <2s | <5s | Load existing state |

---

## References

- OpenSpec Specifications: `openspec/changes/analysis-api-extraction/specs/`
- Python Source: `repos/metabob-rpc-api/`
- CPG Python Source: `repos/cpg-inference/`
- Activity API Reference: `repos/metabob-activity-api/`
- Deployment Reference: `helm/activity-system-minimal.yaml.gotmpl`
