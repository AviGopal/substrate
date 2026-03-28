# Analysis API Extraction Exploration

**Date:** 2026-03-23
**Purpose:** Map extraction of analysis capabilities from Python metabob-rpc-api to TypeScript metabob-analysis-api + metabob-mcp

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Analysis Capabilities to Extract](#2-analysis-capabilities-to-extract)
3. [Proposed New Architecture](#3-proposed-new-architecture)
4. [Data Model and SurrealDB Schemas](#4-data-model-and-surrealdb-schemas)
5. [Integration Points](#5-integration-points)
6. [Migration Strategy](#6-migration-strategy)
7. [Open Questions and Decisions Needed](#7-open-questions-and-decisions-needed)
8. [Comparison with Activity System Extraction](#8-comparison-with-activity-system-extraction)

---

## 1. Current Architecture Analysis

### Complete Dataflow: MCP Client → metabob-cli → metabob-rpc-api

```
┌─────────────────────────────────────────────────────────────────┐
│ CURRENT ANALYSIS DATAFLOW (Python)                              │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────────┐         ┌────────────────────┐
│   Claude     │  MCP    │  metabob-cli     │  HTTP   │  metabob-rpc-api   │
│   Agent      │────────▶│  (Python MCP)    │────────▶│  (FastAPI)         │
│              │         │                  │         │                    │
└──────────────┘         └──────────────────┘         └────────────────────┘
                                  │                              │
                                  │                              │
                                  ▼                              ▼
                         ┌─────────────────┐          ┌──────────────────┐
                         │  Analysis       │          │    Celery        │
                         │  Engine         │          │    Workers       │
                         │  - CPG Manager  │          │  - 3 parallel    │
                         │  - File State   │          │    analysis      │
                         │  - Session Mgr  │          │    types         │
                         └─────────────────┘          └──────────────────┘
                                  │                              │
                                  │                              │
                                  ▼                              ▼
                         ┌─────────────────────────────────────────────┐
                         │         Redis (Session Storage)             │
                         │  - sessions:{session_id}                    │
                         │  - sessions:{session_id}.files              │
                         │  - sessions:{session_id}.problems           │
                         │  - job_result:{job_id}                      │
                         │  - contribution_job_result:{job_id}         │
                         │  - maintainability_job_result:{job_id}      │
                         └─────────────────────────────────────────────┘
```

### Analysis Endpoints in metabob-rpc-api

**File:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api/server/routes/analysis.py`

| Endpoint | Method | Purpose | Dataflow |
|----------|--------|---------|----------|
| `/submit` | POST | Submit single/multiple files for analysis (v1) | Files → Redis → Celery (3 parallel jobs) → Results |
| `/v2/submit` | POST | Submit all session files + project_id (v2) | Files → Redis → project_id link → Celery → Results |
| `/analysis` | GET | Fetch analysis results by job_id or latest | Job ID → Celery result lookup → Combined results |
| `/ws/job` | WebSocket | Real-time job progress updates | Job ID subscription → Polling → Broadcast |

**Three Parallel Analysis Types** (Celery task group):

1. **Main Analysis** (`run_analysis` task)
   - Problem detection (bugs, anti-patterns, security)
   - Redis key: `job_result:{job_id}`
   - Progress tracking: `{current}/{total}` files

2. **Contribution Analysis** (`extract_contribution_rules` → `run_opengrep_analysis`)
   - OpenGrep/Semgrep rules extraction
   - Custom contributing file rules
   - Redis key: `contribution_job_result:{job_id}`
   - Progress tracking: `{step}/{total_steps}`

3. **Maintainability Analysis** (`detect_maintainability`)
   - Dead code detection
   - Complexity metrics
   - Redis key: `maintainability_job_result:{job_id}`
   - Progress tracking: `{current}/{total}` files

**Combined Result Flow:**

```python
# From server/actions/analysis.py:analyze()

group_job: GroupResult = group(
    run_analysis.s(...),                           # Job 0: Main
    extract_contribution_rules.s(...) |            # Job 1a: Contribution extraction
        run_opengrep_analysis.s(...),              # Job 1b: Contribution scan
    detect_maintainability.s(...)                  # Job 2: Maintainability
)

# Results combined and returned as single AnalysisResponse
combined_results = main_results + contribution_results + maintainability_results
```

### Data Structures

**Session Model** (stored in Redis):
```python
# Redis key: sessions:{session_id}
{
    "session_id": str,           # UUID
    "org_id": str | None,        # Organization ID
    "project_id": str | None,    # Project ID (linked in v2)
    "api_key": str | None,       # API key used
    "latest_job_id": str,        # Latest main job
    "latest_contribution_job_id": str,
    "latest_maintainability_job_id": str,
    "latest_results": str,       # JSON serialized results
    "latest_contribution_results": str,
    "latest_maintainability_results": str
}
```

**File Storage** (Redis hash):
```python
# Redis key: sessions:{session_id}.files
{
    "path/to/file.py": bytes,   # File content
    "$latest": str               # Name of last uploaded file
}
```

**Problems Storage** (Redis hash):
```python
# Redis key: sessions:{session_id}.problems
{
    "{problem_id}": str,         # JSON serialized AnalysisResult
    "$latest": str               # JSON array of problem_id order
}
```

**AnalysisResult Model:**
```python
@dataclass
class AnalysisResult:
    id: str                      # Problem ID
    path: str                    # File path
    category: str                # Problem category
    startLine: int
    endLine: int
    summary: str                 # Short description
    description: str             # Detailed explanation
    severity: str                # HIGH, MEDIUM, LOW
    discarded: bool              # User dismissed
    endorsed: bool               # User confirmed
```

**Job Status Flow:**

```
PENDING → STARTED → PROGRESS (N%) → SUCCESS/FAILURE

Job states (Celery):
- PENDING: Not yet started
- STARTED/RECEIVED: Job picked up by worker
- PROGRESS: Custom state with progress metadata
- SUCCESS: Completed successfully
- FAILURE: Error occurred
- RETRY: Being retried
- REVOKED: Cancelled

Translated states (API):
- pending, running, complete, failed
```

### Storage Patterns

**Redis Key Patterns:**

```python
# From tasks/utils/db.py

def session_info_location(session_id: str) -> bytes:
    return f"sessions.{session_id}".encode()

def session_files_location(session_id: str) -> bytes:
    return f"sessions.{session_id}.files".encode()

def session_problems_location(session_id: str) -> bytes:
    return f"sessions.{session_id}.problems".encode()
```

**Why this pattern?**
- Flat Redis structure (no nested keys)
- Session ID = primary index
- Problems can be updated individually (feedback)
- Job results cached in session hash
- File content stored separately for efficient access

### WebSocket Implementation

**File:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api/server/routes/websocket.py`

**ConnectionManager pattern:**

```python
class ConnectionManager:
    active_connections: dict[str, set[WebSocket]]     # session_id → WebSockets
    job_subscriptions: dict[str, set[str]]            # job_id → session_ids
    session_subscriptions: dict[str, set[str]]        # session_id → job_ids
    last_updates: dict[str, datetime]                 # job_id → last_update_time
    poll_interval: float = 1.0                        # 1 second polling

    async def subscribe_to_job(session_id, job_id):
        # Subscribe session to job updates

    async def broadcast_job_update(job_id, message):
        # Push to all subscribed sessions

    async def _poll_jobs(celery: Celery):
        # Background task polling all subscribed jobs
        while True:
            for job_id in job_subscriptions.keys():
                results = _fetch_combined_job_results(job_id, celery)
                await broadcast_job_update(job_id, results)
            await asyncio.sleep(poll_interval)
```

**WebSocket message format:**

```json
{
  "action": "subscribe",
  "job_id": "uuid-here"
}

{
  "type": "job_update",
  "job_id": "uuid-here",
  "status": "running",
  "progress": 45,
  "results": []
}
```

### Integration with metabob-cli

**File:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src/metabob_cli/core/analysis_engine.py`

**AnalysisEngine responsibilities:**

1. **Session Management**
   - Create/resume sessions via `/session` endpoint
   - Store session token in state file
   - Keepalive pings to prevent expiration

2. **File Watching**
   - Monitor project files for changes
   - Submit changed files to `/v2/submit`
   - Progressive sync: only upload modified files

3. **Batch Processing**
   - Batch files into groups (default: 10 files)
   - Upload via multipart/form-data
   - Track submission state in FileStateManager

4. **Job Monitoring**
   - Poll `/analysis?job={job_id}` for status
   - WebSocket subscription for real-time updates
   - Cache completed results

5. **CPG Manager** (Code Property Graph)
   - Build dependency graphs
   - Impact analysis (which files affect others)
   - Co-change patterns
   - Stored in session-scoped SQLite DB

**MCP Tools** (provided by metabob-cli):

From `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src/metabob_cli/mcp/tools.py`:

```python
@mcp.tool()
async def search_codebase_issues(
    query: str,              # Search term
    severity: str = "all",   # Filter by severity
    file_path: str = None    # Filter by file
) -> str:
    """Search analysis results for problems matching criteria"""

@mcp.tool()
async def get_priority_issues(
    limit: int = 10
) -> str:
    """Get highest priority issues based on severity and impact"""

@mcp.tool()
async def mark_problem_complete(
    problem_id: str
) -> str:
    """Mark a problem as resolved (sets discarded=true)"""

@mcp.tool()
async def annotate_component(
    component_id: str,
    annotation: str
) -> str:
    """Add annotation to a code component"""

@mcp.tool()
async def get_impact_analysis(
    file_path: str
) -> str:
    """Get impact analysis for a file (what depends on it)"""

@mcp.tool()
async def get_cochange_suggestions(
    file_path: str
) -> str:
    """Get files that frequently change together with this file"""
```

---

## 2. Analysis Capabilities to Extract

### Core Analysis Features

1. **Progressive Codebase ↔ Problem Sync**
   - Upload files incrementally as they change
   - Maintain session state across uploads
   - Track file hashes to detect changes
   - Batch file submissions for efficiency

2. **Component Decomposition**
   - Parse code into components (classes, functions, modules)
   - Build dependency graph between components
   - Store component metadata (LOC, complexity, dependencies)
   - Enable component-level annotations

3. **Annotations System**
   - Add notes/comments to components
   - Track who added annotation (user/api_key)
   - Search annotations by content/component
   - Version annotations over time

4. **Impact Analysis**
   - Query: "What files depend on X?"
   - Query: "What breaks if I change X?"
   - Use CPG (Code Property Graph) to trace dependencies
   - Return impact score and affected files

5. **Problem Identification**
   - Detect bugs, security issues, anti-patterns
   - Categorize problems (bug, security, performance, style)
   - Severity scoring (HIGH, MEDIUM, LOW)
   - Line-level problem location

6. **Co-Change Prediction**
   - Historical analysis: which files change together?
   - Confidence scoring based on frequency
   - Suggest "you changed X, should you also update Y?"
   - Learn patterns from git history

7. **Dead Code Detection**
   - Find unused functions, classes, imports
   - Analyze call graphs for unreachable code
   - Confidence scoring (definitely unused vs. possibly)
   - Consider dynamic imports and reflection

8. **Pattern Quality Assessment**
   - Detect design pattern usage (Factory, Singleton, etc.)
   - Assess pattern implementation quality
   - Suggest improvements or refactoring
   - Track pattern evolution over time

### Advanced Features (Future)

- **Semantic Code Search**: Query code by meaning, not just text
- **Automated Refactoring Suggestions**: Specific code transformations
- **Test Coverage Gaps**: Areas needing tests based on complexity
- **Performance Hotspot Detection**: Potential performance issues
- **Dependency Vulnerability Scanning**: CVE/security scanning

---

## 3. Proposed New Architecture

### metabob-analysis-api (TypeScript/Bun Backend)

**Purpose:** Analysis engine backend with SurrealDB persistence, following the same pattern as metabob-activity-api.

**Technology Stack:**
- **Runtime:** Bun (TypeScript)
- **Web Framework:** Hono (like metabob-activity-api)
- **Database:** SurrealDB 3.x (persistent storage)
- **Cache:** Redis (session data, job status)
- **Task Queue:** Decision needed (see Open Questions)
- **WebSocket:** Bun native WebSocket support

**Directory Structure:**

```
repos/metabob-analysis-api/
├── src/
│   ├── index.ts                    # Main server entry point
│   ├── config.ts                   # Configuration loader
│   ├── db/
│   │   ├── surreal.ts              # SurrealDB client
│   │   └── redis.ts                # Redis client
│   ├── models/
│   │   └── schemas.ts              # Zod schemas for validation
│   ├── routes/
│   │   ├── session.ts              # Session management
│   │   ├── analysis.ts             # Analysis submission/results
│   │   ├── problems.ts             # Problem CRUD operations
│   │   ├── components.ts           # Component annotations
│   │   ├── impact.ts               # Impact analysis
│   │   ├── cochange.ts             # Co-change patterns
│   │   └── deadcode.ts             # Dead code detection
│   ├── middleware/
│   │   └── auth.ts                 # API key validation
│   ├── services/
│   │   ├── analysis-engine.ts      # Analysis orchestration
│   │   ├── cpg-builder.ts          # Code Property Graph
│   │   ├── pattern-detector.ts     # Design pattern analysis
│   │   └── cochange-learner.ts     # Git history analysis
│   ├── websocket/
│   │   └── broadcaster.ts          # WebSocket message broadcasting
│   └── utils/
│       └── logger.ts               # Structured logging
├── sql/
│   ├── 001-init-schemas.surql      # SurrealDB schema migrations
│   ├── 002-analysis-jobs.surql
│   ├── 003-components.surql
│   └── 004-patterns.surql
├── Dockerfile
├── package.json
├── bun.lock
└── tsconfig.json
```

**Endpoints** (maintaining CLI compatibility):

```typescript
// Session Management
POST   /v2/sessions                          // Create session
GET    /v2/sessions/:session_id              // Get session info
DELETE /v2/sessions/:session_id              // Delete session

// Analysis Submission
POST   /v2/analysis/submit                   // Upload files and trigger analysis
POST   /v2/analysis/v2/submit                // v2: project-scoped submission

// Analysis Results
GET    /v2/analysis/results/:job_id          // Get analysis results
GET    /v2/analysis/jobs/:job_id/status      // Get job status
GET    /v2/analysis/jobs/:job_id             // Alias for results

// WebSocket
WebSocket /v2/analysis/ws                    // Real-time progress updates

// Problem Management
GET    /v2/analysis/problems                 // List problems (with filters)
GET    /v2/analysis/problems/:problem_id     // Get problem details
POST   /v2/analysis/problems/:problem_id/resolve  // Mark resolved
POST   /v2/analysis/problems/:problem_id/endorse  // Endorse problem
DELETE /v2/analysis/problems/:problem_id     // Delete problem

// Component Management
GET    /v2/analysis/components               // List components
GET    /v2/analysis/components/:component_id // Get component
POST   /v2/analysis/components/:component_id/annotate  // Add annotation

// Impact Analysis
GET    /v2/analysis/impact/:file_path        // Get impact analysis
POST   /v2/analysis/impact/query             // Custom impact query

// Co-Change Patterns
GET    /v2/analysis/cochange/:file_path      // Get co-change suggestions
GET    /v2/analysis/cochange/patterns        // List all patterns

// Dead Code Detection
GET    /v2/analysis/deadcode                 // Get all dead code
GET    /v2/analysis/deadcode/:file_path      // Get for specific file

// Health
GET    /health                               // Health check
```

**Request/Response Examples:**

```typescript
// POST /v2/analysis/submit
{
  "session_id": "uuid",
  "files": [
    { "path": "src/main.ts", "content": "..." },
    { "path": "src/utils.ts", "content": "..." }
  ],
  "project_id": "my-project",
  "options": {
    "enable_contribution_analysis": true,
    "enable_maintainability": true,
    "contributing_rules": "..."  // Optional custom rules
  }
}

// Response
{
  "job_id": "job-uuid",
  "status": "pending",
  "results": null
}

// GET /v2/analysis/results/:job_id
{
  "job_id": "job-uuid",
  "status": "complete",
  "progress": 100,
  "results": [
    {
      "id": "problem-1",
      "path": "src/main.ts",
      "category": "bug",
      "severity": "HIGH",
      "startLine": 42,
      "endLine": 45,
      "summary": "Potential null pointer dereference",
      "description": "Variable 'user' may be null...",
      "discarded": false,
      "endorsed": false
    }
  ],
  "metadata": {
    "total_files": 2,
    "total_problems": 1,
    "duration_ms": 3500,
    "analysis_types": ["main", "contribution", "maintainability"]
  }
}

// WebSocket message (job update)
{
  "type": "job_update",
  "job_id": "job-uuid",
  "status": "running",
  "progress": 45,
  "current_file": "src/main.ts",
  "results": []  // Partial results available
}
```

### metabob-mcp (TypeScript/Bun MCP Server)

**Purpose:** TypeScript MCP server replacing Python metabob-cli MCP, providing same tool surface area.

**Why separate from metabob-analysis-api?**
- MCP server runs as subprocess (stdio transport)
- Analysis API is HTTP service (deployed to cluster)
- Separation allows independent scaling
- MCP server is stateless (calls API)

**Directory Structure:**

```
repos/metabob-mcp/
├── src/
│   ├── index.ts                    # MCP server entry point
│   ├── tools/
│   │   ├── search-issues.ts        # search_codebase_issues
│   │   ├── priority-issues.ts      # get_priority_issues
│   │   ├── mark-complete.ts        # mark_problem_complete
│   │   ├── annotate.ts             # annotate_component
│   │   ├── impact-analysis.ts      # get_impact_analysis
│   │   └── cochange.ts             # get_cochange_suggestions
│   ├── client/
│   │   └── analysis-api.ts         # HTTP client for metabob-analysis-api
│   ├── config.ts                   # Configuration
│   └── types.ts                    # TypeScript types
├── package.json
├── bun.lock
└── tsconfig.json
```

**MCP Tools** (matching Python CLI tools):

```typescript
import { FastMCP } from "@modelcontextprotocol/sdk/server/fastmcp.js";

const mcp = new FastMCP("Metabob Analysis Assistant");

// Tool 1: Search codebase issues
mcp.tool({
  name: "search_codebase_issues",
  description: "Search analysis results for problems matching criteria",
  parameters: {
    query: { type: "string", description: "Search term" },
    severity: { type: "string", enum: ["all", "HIGH", "MEDIUM", "LOW"] },
    file_path: { type: "string", optional: true }
  }
}, async ({ query, severity, file_path }) => {
  const response = await analysisClient.get('/v2/analysis/problems', {
    params: { query, severity, file_path }
  });
  return JSON.stringify(response.data);
});

// Tool 2: Get priority issues
mcp.tool({
  name: "get_priority_issues",
  description: "Get highest priority issues based on severity and impact",
  parameters: {
    limit: { type: "number", default: 10 }
  }
}, async ({ limit }) => {
  const response = await analysisClient.get('/v2/analysis/problems', {
    params: { sort: "priority", limit }
  });
  return JSON.stringify(response.data);
});

// Tool 3: Mark problem complete
mcp.tool({
  name: "mark_problem_complete",
  description: "Mark a problem as resolved",
  parameters: {
    problem_id: { type: "string" }
  }
}, async ({ problem_id }) => {
  await analysisClient.post(`/v2/analysis/problems/${problem_id}/resolve`);
  return "Problem marked as resolved";
});

// Tool 4: Annotate component
mcp.tool({
  name: "annotate_component",
  description: "Add annotation to a code component",
  parameters: {
    component_id: { type: "string" },
    annotation: { type: "string" }
  }
}, async ({ component_id, annotation }) => {
  await analysisClient.post(`/v2/analysis/components/${component_id}/annotate`, {
    annotation
  });
  return "Annotation added successfully";
});

// Tool 5: Impact analysis
mcp.tool({
  name: "get_impact_analysis",
  description: "Get impact analysis for a file",
  parameters: {
    file_path: { type: "string" }
  }
}, async ({ file_path }) => {
  const response = await analysisClient.get(`/v2/analysis/impact/${encodeURIComponent(file_path)}`);
  return JSON.stringify(response.data);
});

// Tool 6: Co-change suggestions
mcp.tool({
  name: "get_cochange_suggestions",
  description: "Get files that frequently change together",
  parameters: {
    file_path: { type: "string" }
  }
}, async ({ file_path }) => {
  const response = await analysisClient.get(`/v2/analysis/cochange/${encodeURIComponent(file_path)}`);
  return JSON.stringify(response.data);
});
```

**Benefits of TypeScript MCP:**

1. **Simplified Deployment:** No Python runtime needed
2. **Type Safety:** End-to-end TypeScript types
3. **Faster Startup:** Bun starts faster than Python
4. **Shared Code:** Can share types with metabob-analysis-api
5. **Easier Maintenance:** One language for entire stack

---

## 4. Data Model and SurrealDB Schemas

### Schema Design Philosophy

Following patterns from `repos/metabob-activity-api/src/models/schemas.ts`:

- **Hierarchical organization:** `org_id` → `project_id` → `session_id`
- **Flexible JSON fields:** Use `Record<string, any>` for extensibility
- **Timestamp tracking:** `created_at`, `updated_at` on all entities
- **Nullable foreign keys:** Allow orphaned data (soft deletes)
- **Graph relationships:** Use SurrealDB's graph features for dependencies

### Core Schemas

```typescript
// From repos/metabob-analysis-api/src/models/schemas.ts

import { z } from 'zod';

// =============================================================================
// Session Management
// =============================================================================

export const AnalysisSessionSchema = z.object({
  session_id: z.string(),
  org_id: z.string().nullable(),
  project_id: z.string().nullable(),
  api_key: z.string().nullable(),
  created_at: z.string(),  // ISO timestamp
  updated_at: z.string(),
  last_activity: z.string(),
  metadata: z.record(z.any()).optional(),  // Extensible metadata
});

export type AnalysisSession = z.infer<typeof AnalysisSessionSchema>;

// =============================================================================
// Analysis Jobs
// =============================================================================

export const AnalysisJobSchema = z.object({
  job_id: z.string(),
  session_id: z.string(),
  project_id: z.string().nullable(),
  status: z.enum(['pending', 'running', 'complete', 'failed']),
  progress: z.number().min(0).max(100),  // Percentage

  // Job configuration
  analysis_types: z.array(z.enum(['main', 'contribution', 'maintainability'])),
  file_count: z.number(),

  // Results tracking
  total_problems: z.number().default(0),
  problems_by_severity: z.record(z.number()).optional(),  // { HIGH: 5, MEDIUM: 10 }

  // Timing
  created_at: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  duration_ms: z.number().nullable(),

  // Error tracking
  error_message: z.string().nullable(),
  error_type: z.string().nullable(),

  metadata: z.record(z.any()).optional(),
});

export type AnalysisJob = z.infer<typeof AnalysisJobSchema>;

// =============================================================================
// Problems (Analysis Results)
// =============================================================================

export const AnalysisProblemSchema = z.object({
  problem_id: z.string(),
  session_id: z.string(),
  job_id: z.string(),
  project_id: z.string().nullable(),

  // Problem location
  file_path: z.string(),
  start_line: z.number(),
  end_line: z.number(),

  // Problem details
  category: z.string(),  // bug, security, performance, style
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  summary: z.string(),
  description: z.string(),

  // Problem source
  analysis_type: z.enum(['main', 'contribution', 'maintainability']),
  detector_name: z.string().optional(),  // Which detector found it

  // User feedback
  discarded: z.boolean().default(false),
  endorsed: z.boolean().default(false),
  user_notes: z.string().nullable(),

  // Timestamps
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable(),

  metadata: z.record(z.any()).optional(),
});

export type AnalysisProblem = z.infer<typeof AnalysisProblemSchema>;

// =============================================================================
// Code Components
// =============================================================================

export const CodeComponentSchema = z.object({
  component_id: z.string(),
  session_id: z.string(),
  project_id: z.string().nullable(),

  // Component location
  file_path: z.string(),
  start_line: z.number(),
  end_line: z.number(),

  // Component metadata
  component_type: z.enum(['class', 'function', 'method', 'module', 'variable']),
  name: z.string(),
  qualified_name: z.string().optional(),  // Full path (e.g., mymodule.MyClass.method)

  // Metrics
  loc: z.number().optional(),  // Lines of code
  complexity: z.number().optional(),  // Cyclomatic complexity

  // Dependencies (stored as graph edges in SurrealDB)
  // depends_on: string[]  // Handled by graph relations

  created_at: z.string(),
  updated_at: z.string(),

  metadata: z.record(z.any()).optional(),
});

export type CodeComponent = z.infer<typeof CodeComponentSchema>;

// =============================================================================
// Component Annotations
// =============================================================================

export const ComponentAnnotationSchema = z.object({
  annotation_id: z.string(),
  component_id: z.string(),
  session_id: z.string(),

  // Annotation content
  content: z.string(),
  author: z.string().nullable(),  // User ID or "system"

  created_at: z.string(),
  updated_at: z.string(),

  metadata: z.record(z.any()).optional(),
});

export type ComponentAnnotation = z.infer<typeof ComponentAnnotationSchema>;

// =============================================================================
// Co-Change Patterns
// =============================================================================

export const CoChangePatternSchema = z.object({
  pattern_id: z.string(),
  project_id: z.string(),

  // File pair
  file_a: z.string(),
  file_b: z.string(),

  // Pattern metrics
  frequency: z.number(),  // How many times changed together
  confidence: z.number().min(0).max(1),  // Confidence score (0-1)

  // Last observed
  last_occurrence: z.string(),

  created_at: z.string(),
  updated_at: z.string(),

  metadata: z.record(z.any()).optional(),
});

export type CoChangePattern = z.infer<typeof CoChangePatternSchema>;

// =============================================================================
// Dead Code Detection
// =============================================================================

export const DeadCodeSchema = z.object({
  dead_code_id: z.string(),
  session_id: z.string(),
  component_id: z.string(),

  // Dead code details
  reason: z.enum(['unused', 'unreachable', 'redundant']),
  confidence: z.enum(['definite', 'likely', 'possible']),

  created_at: z.string(),
  updated_at: z.string(),

  metadata: z.record(z.any()).optional(),
});

export type DeadCode = z.infer<typeof DeadCodeSchema>;

// =============================================================================
// Impact Analysis (Graph-based)
// =============================================================================

export const ImpactRelationSchema = z.object({
  from_component: z.string(),  // Component ID
  to_component: z.string(),    // Component ID
  relation_type: z.enum(['imports', 'calls', 'extends', 'implements']),
  strength: z.number().min(0).max(1).optional(),  // How strong the dependency

  created_at: z.string(),
  metadata: z.record(z.any()).optional(),
});

export type ImpactRelation = z.infer<typeof ImpactRelationSchema>;
```

### SurrealDB Schema Migrations

**File:** `repos/metabob-analysis-api/sql/001-init-schemas.surql`

```sql
-- =============================================================================
-- Analysis System Schema - SurrealDB 3.x
-- =============================================================================

-- Sessions table
DEFINE TABLE analysis_sessions SCHEMAFULL;
DEFINE FIELD session_id ON analysis_sessions TYPE string ASSERT $value != NONE;
DEFINE FIELD org_id ON analysis_sessions TYPE option<string>;
DEFINE FIELD project_id ON analysis_sessions TYPE option<string>;
DEFINE FIELD api_key ON analysis_sessions TYPE option<string>;
DEFINE FIELD created_at ON analysis_sessions TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON analysis_sessions TYPE datetime DEFAULT time::now();
DEFINE FIELD last_activity ON analysis_sessions TYPE datetime DEFAULT time::now();
DEFINE FIELD metadata ON analysis_sessions TYPE option<object>;

DEFINE INDEX session_id_idx ON analysis_sessions FIELDS session_id UNIQUE;
DEFINE INDEX project_id_idx ON analysis_sessions FIELDS project_id;

-- Analysis jobs table
DEFINE TABLE analysis_jobs SCHEMAFULL;
DEFINE FIELD job_id ON analysis_jobs TYPE string ASSERT $value != NONE;
DEFINE FIELD session_id ON analysis_jobs TYPE string;
DEFINE FIELD project_id ON analysis_jobs TYPE option<string>;
DEFINE FIELD status ON analysis_jobs TYPE string ASSERT $value IN ['pending', 'running', 'complete', 'failed'];
DEFINE FIELD progress ON analysis_jobs TYPE number DEFAULT 0;
DEFINE FIELD analysis_types ON analysis_jobs TYPE array;
DEFINE FIELD file_count ON analysis_jobs TYPE number DEFAULT 0;
DEFINE FIELD total_problems ON analysis_jobs TYPE number DEFAULT 0;
DEFINE FIELD problems_by_severity ON analysis_jobs TYPE option<object>;
DEFINE FIELD created_at ON analysis_jobs TYPE datetime DEFAULT time::now();
DEFINE FIELD started_at ON analysis_jobs TYPE option<datetime>;
DEFINE FIELD completed_at ON analysis_jobs TYPE option<datetime>;
DEFINE FIELD duration_ms ON analysis_jobs TYPE option<number>;
DEFINE FIELD error_message ON analysis_jobs TYPE option<string>;
DEFINE FIELD error_type ON analysis_jobs TYPE option<string>;
DEFINE FIELD metadata ON analysis_jobs TYPE option<object>;

DEFINE INDEX job_id_idx ON analysis_jobs FIELDS job_id UNIQUE;
DEFINE INDEX session_id_idx ON analysis_jobs FIELDS session_id;
DEFINE INDEX status_idx ON analysis_jobs FIELDS status;

-- Problems table
DEFINE TABLE analysis_problems SCHEMAFULL;
DEFINE FIELD problem_id ON analysis_problems TYPE string ASSERT $value != NONE;
DEFINE FIELD session_id ON analysis_problems TYPE string;
DEFINE FIELD job_id ON analysis_problems TYPE string;
DEFINE FIELD project_id ON analysis_problems TYPE option<string>;
DEFINE FIELD file_path ON analysis_problems TYPE string;
DEFINE FIELD start_line ON analysis_problems TYPE number;
DEFINE FIELD end_line ON analysis_problems TYPE number;
DEFINE FIELD category ON analysis_problems TYPE string;
DEFINE FIELD severity ON analysis_problems TYPE string ASSERT $value IN ['HIGH', 'MEDIUM', 'LOW'];
DEFINE FIELD summary ON analysis_problems TYPE string;
DEFINE FIELD description ON analysis_problems TYPE string;
DEFINE FIELD analysis_type ON analysis_problems TYPE string;
DEFINE FIELD detector_name ON analysis_problems TYPE option<string>;
DEFINE FIELD discarded ON analysis_problems TYPE bool DEFAULT false;
DEFINE FIELD endorsed ON analysis_problems TYPE bool DEFAULT false;
DEFINE FIELD user_notes ON analysis_problems TYPE option<string>;
DEFINE FIELD created_at ON analysis_problems TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON analysis_problems TYPE datetime DEFAULT time::now();
DEFINE FIELD resolved_at ON analysis_problems TYPE option<datetime>;
DEFINE FIELD metadata ON analysis_problems TYPE option<object>;

DEFINE INDEX problem_id_idx ON analysis_problems FIELDS problem_id UNIQUE;
DEFINE INDEX session_id_idx ON analysis_problems FIELDS session_id;
DEFINE INDEX job_id_idx ON analysis_problems FIELDS job_id;
DEFINE INDEX severity_idx ON analysis_problems FIELDS severity;
DEFINE INDEX file_path_idx ON analysis_problems FIELDS file_path;

-- Code components table
DEFINE TABLE code_components SCHEMAFULL;
DEFINE FIELD component_id ON code_components TYPE string ASSERT $value != NONE;
DEFINE FIELD session_id ON code_components TYPE string;
DEFINE FIELD project_id ON code_components TYPE option<string>;
DEFINE FIELD file_path ON code_components TYPE string;
DEFINE FIELD start_line ON code_components TYPE number;
DEFINE FIELD end_line ON code_components TYPE number;
DEFINE FIELD component_type ON code_components TYPE string;
DEFINE FIELD name ON code_components TYPE string;
DEFINE FIELD qualified_name ON code_components TYPE option<string>;
DEFINE FIELD loc ON code_components TYPE option<number>;
DEFINE FIELD complexity ON code_components TYPE option<number>;
DEFINE FIELD created_at ON code_components TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON code_components TYPE datetime DEFAULT time::now();
DEFINE FIELD metadata ON code_components TYPE option<object>;

DEFINE INDEX component_id_idx ON code_components FIELDS component_id UNIQUE;
DEFINE INDEX session_id_idx ON code_components FIELDS session_id;
DEFINE INDEX file_path_idx ON code_components FIELDS file_path;

-- Component annotations table
DEFINE TABLE component_annotations SCHEMAFULL;
DEFINE FIELD annotation_id ON component_annotations TYPE string ASSERT $value != NONE;
DEFINE FIELD component_id ON component_annotations TYPE string;
DEFINE FIELD session_id ON component_annotations TYPE string;
DEFINE FIELD content ON component_annotations TYPE string;
DEFINE FIELD author ON component_annotations TYPE option<string>;
DEFINE FIELD created_at ON component_annotations TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON component_annotations TYPE datetime DEFAULT time::now();
DEFINE FIELD metadata ON component_annotations TYPE option<object>;

DEFINE INDEX annotation_id_idx ON component_annotations FIELDS annotation_id UNIQUE;
DEFINE INDEX component_id_idx ON component_annotations FIELDS component_id;

-- Co-change patterns table
DEFINE TABLE cochange_patterns SCHEMAFULL;
DEFINE FIELD pattern_id ON cochange_patterns TYPE string ASSERT $value != NONE;
DEFINE FIELD project_id ON cochange_patterns TYPE string;
DEFINE FIELD file_a ON cochange_patterns TYPE string;
DEFINE FIELD file_b ON cochange_patterns TYPE string;
DEFINE FIELD frequency ON cochange_patterns TYPE number DEFAULT 1;
DEFINE FIELD confidence ON cochange_patterns TYPE number DEFAULT 0;
DEFINE FIELD last_occurrence ON cochange_patterns TYPE datetime DEFAULT time::now();
DEFINE FIELD created_at ON cochange_patterns TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON cochange_patterns TYPE datetime DEFAULT time::now();
DEFINE FIELD metadata ON cochange_patterns TYPE option<object>;

DEFINE INDEX pattern_id_idx ON cochange_patterns FIELDS pattern_id UNIQUE;
DEFINE INDEX project_id_idx ON cochange_patterns FIELDS project_id;
DEFINE INDEX file_pair_idx ON cochange_patterns FIELDS file_a, file_b;

-- Dead code table
DEFINE TABLE dead_code SCHEMAFULL;
DEFINE FIELD dead_code_id ON dead_code TYPE string ASSERT $value != NONE;
DEFINE FIELD session_id ON dead_code TYPE string;
DEFINE FIELD component_id ON dead_code TYPE string;
DEFINE FIELD reason ON dead_code TYPE string ASSERT $value IN ['unused', 'unreachable', 'redundant'];
DEFINE FIELD confidence ON dead_code TYPE string ASSERT $value IN ['definite', 'likely', 'possible'];
DEFINE FIELD created_at ON dead_code TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON dead_code TYPE datetime DEFAULT time::now();
DEFINE FIELD metadata ON dead_code TYPE option<object>;

DEFINE INDEX dead_code_id_idx ON dead_code FIELDS dead_code_id UNIQUE;
DEFINE INDEX session_id_idx ON dead_code FIELDS session_id;

-- Impact relations (graph edges)
DEFINE TABLE impact_relations TYPE RELATION FROM code_components TO code_components SCHEMAFULL;
DEFINE FIELD relation_type ON impact_relations TYPE string;
DEFINE FIELD strength ON impact_relations TYPE option<number>;
DEFINE FIELD created_at ON impact_relations TYPE datetime DEFAULT time::now();
DEFINE FIELD metadata ON impact_relations TYPE option<object>;
```

### Graph Queries (SurrealDB)

**Impact Analysis Example:**

```sql
-- Find all components that depend on a given component
SELECT
  ->impact_relations->code_components.* AS dependents
FROM
  code_components
WHERE
  component_id = $component_id
```

**Reverse Impact:**

```sql
-- Find all components this component depends on
SELECT
  <-impact_relations<-code_components.* AS dependencies
FROM
  code_components
WHERE
  component_id = $component_id
```

**Transitive Dependencies:**

```sql
-- Find all transitive dependencies (depth 3)
SELECT
  ->impact_relations->code_components->impact_relations->code_components->impact_relations->code_components.* AS transitive_deps
FROM
  code_components
WHERE
  component_id = $component_id
```

---

## 5. Integration Points

### CLI Integration: metabob-mcp ↔ metabob-analysis-api

```
┌──────────────┐         ┌──────────────────┐         ┌────────────────────┐
│   Claude     │  MCP    │  metabob-mcp     │  HTTP   │ metabob-analysis-  │
│   Agent      │────────▶│  (TypeScript)    │────────▶│  api (TypeScript)  │
│              │         │                  │         │                    │
└──────────────┘         └──────────────────┘         └────────────────────┘
                                  │                              │
                                  │                              │
                                  ▼                              ▼
                         ┌─────────────────┐          ┌──────────────────┐
                         │  Local State    │          │   SurrealDB      │
                         │  - Session ID   │          │   - Sessions     │
                         │  - API key      │          │   - Jobs         │
                         │  - Config       │          │   - Problems     │
                         └─────────────────┘          │   - Components   │
                                                      └──────────────────┘
```

**Session Management Flow:**

```typescript
// metabob-mcp: Create/resume session

// 1. Check local state for existing session
const stateFile = path.join(process.cwd(), '.metabob', 'state.json');
let sessionId = await readSessionId(stateFile);

if (!sessionId) {
  // 2. Create new session via API
  const response = await analysisClient.post('/v2/sessions', {
    org_id: config.orgId,
    project_id: config.projectId,
    api_key: config.apiKey
  });
  sessionId = response.data.session_id;

  // 3. Save to local state
  await writeSessionId(stateFile, sessionId);
}

// 4. Use session for all subsequent requests
analysisClient.defaults.headers['X-Session-ID'] = sessionId;
```

**File Upload Flow:**

```typescript
// metabob-mcp: Submit files for analysis

const files = await collectFiles(workspaceRoot);

const formData = new FormData();
files.forEach(file => {
  formData.append('files', file.content, file.path);
});
formData.append('project_id', projectId);

const response = await analysisClient.post('/v2/analysis/submit', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

const jobId = response.data.job_id;

// Subscribe to WebSocket for real-time updates
const ws = new WebSocket(`ws://api.metabob.local/v2/analysis/ws`);
ws.on('open', () => {
  ws.send(JSON.stringify({ action: 'subscribe', job_id: jobId }));
});
ws.on('message', (data) => {
  const update = JSON.parse(data);
  console.log(`Job ${update.job_id}: ${update.status} (${update.progress}%)`);
});
```

**Job Monitoring:**

```typescript
// Poll job status (fallback if WebSocket unavailable)
async function pollJob(jobId: string): Promise<AnalysisJob> {
  while (true) {
    const response = await analysisClient.get(`/v2/analysis/jobs/${jobId}/status`);
    const job = response.data;

    if (job.status === 'complete' || job.status === 'failed') {
      return job;
    }

    await sleep(1000);  // Poll every 1 second
  }
}
```

### Activity API Integration: Shared Data Model

**Scenario:** Analysis results used as impulses for activity execution.

```typescript
// Create impulse from analysis problem
const problem = await analysisClient.get(`/v2/analysis/problems/${problemId}`);

await activityClient.post('/v2/impulses', {
  impulse_id: `problem-${problemId}`,
  project_id: projectId,
  impulse_data: {
    id: `problem-${problemId}`,
    type: 'analysisProblem',
    pointer: {
      type: 'analysisProblem',
      problem_id: problemId,
      session_id: problem.session_id
    },
    budget: 2000,
    priority: problem.severity === 'HIGH' ? 'high' : 'medium',
    metadata: {
      file_path: problem.file_path,
      category: problem.category,
      severity: problem.severity
    }
  }
});

// Impulse resolver in activity API
async function resolveAnalysisProblem(pointer: ImpulsePointer): Promise<string> {
  const response = await fetch(
    `${config.analysisApiUrl}/v2/analysis/problems/${pointer.problem_id}`
  );
  const problem = await response.json();

  return `
## Analysis Problem: ${problem.summary}

**File:** ${problem.file_path} (lines ${problem.start_line}-${problem.end_line})
**Severity:** ${problem.severity}
**Category:** ${problem.category}

${problem.description}
  `.trim();
}
```

**Shared Session/Org/Project Hierarchy:**

Both APIs use the same hierarchy:
- `org_id` → organization level
- `project_id` → project level (links analysis ↔ activities)
- `session_id` → ephemeral analysis session

```typescript
// Activity execution can reference analysis session
await activityClient.post('/v2/activities/executions', {
  template_id: 'fix-analysis-problem',
  org_id: orgId,
  project_id: projectId,
  impulses: [
    `analysis-session:${sessionId}`,  // All problems from session
    `analysis-problem:${problemId}`   // Specific problem
  ]
});
```

### Deployment Integration: Helmfile

**New release in `helm/activity-system-minimal.yaml.gotmpl`:**

```yaml
# ===========================================================================
# METABOB ANALYSIS API - Analysis engine backend
# ===========================================================================
- name: metabob-analysis-api
  chart: ./charts/metabob-analysis-api
  namespace: activity-system
  labels:
    component: api
    tier: application
  values:
    - replicaCount: 2
      image:
        repository: metabob-analysis-api
        pullPolicy: Always
        tag: "latest"
      service:
        type: ClusterIP
        port: 8081
        targetPort: 8081
        name: http
      config:
        port: 8081
        host: "0.0.0.0"
        surrealdb:
          url: "http://surrealdb.activity-system.svc.cluster.local:8000"
          namespace: "activity-system"
          database: "analysis_db"
          username: {{ env "SURREALDB_USERNAME" | default "root" }}
          password: {{ env "SURREALDB_PASSWORD" | default "surrealdb-local-dev-123" }}
        redis:
          url: "redis://redis-valkey.activity-system.svc.cluster.local:6379"
          sessionTtl: 86400
        logLevel: "info"
      resources:
        limits:
          cpu: 1000m
          memory: 1Gi
        requests:
          cpu: 250m
          memory: 512Mi
  needs:
    - activity-system/redis
    - activity-system/surrealdb
```

**Service endpoints:**

- **metabob-activity-api:** `http://metabob-activity-api.activity-system.svc.cluster.local:8080`
- **metabob-analysis-api:** `http://metabob-analysis-api.activity-system.svc.cluster.local:8081`

**Istio Gateway updates:**

Add route for analysis API:

```yaml
# helm/charts/istio-gateway/values.yaml

virtualServices:
  - name: metabob-analysis-api
    match:
      - uri:
          prefix: "/v2/analysis"
    route:
      - destination:
          host: metabob-analysis-api.activity-system.svc.cluster.local
          port:
            number: 8081
```

Access via: `http://api.minibob.local/v2/analysis/*`

---

## 6. Migration Strategy

### Phase 1: Parallel Deployment (Week 1-2)

**Goal:** Deploy metabob-analysis-api alongside metabob-rpc-api without breaking existing clients.

**Steps:**

1. **Build metabob-analysis-api:**
   ```bash
   cd repos/metabob-analysis-api
   docker build -t metabob-analysis-api:latest .
   ```

2. **Deploy to cluster:**
   ```bash
   cd helm
   helmfile -f activity-system-minimal.yaml.gotmpl sync
   ```

3. **Verify health:**
   ```bash
   curl http://api.minibob.local/v2/analysis/health
   ```

4. **Test basic endpoints:**
   ```bash
   # Create session
   curl -X POST http://api.minibob.local/v2/analysis/sessions

   # Submit files (mock test)
   curl -X POST http://api.minibob.local/v2/analysis/submit \
     -F "files=@test.py"
   ```

5. **Python CLI continues using metabob-rpc-api:**
   - No code changes to metabob-cli
   - Business as usual for existing users

**Metrics to track:**
- API latency (p50, p95, p99)
- Error rates
- Memory usage
- Database query performance

### Phase 2: TypeScript MCP Deployment (Week 3-4)

**Goal:** Deploy metabob-mcp as alternative to Python CLI MCP.

**Steps:**

1. **Build metabob-mcp:**
   ```bash
   cd repos/metabob-mcp
   bun install
   bun build src/index.ts --target bun --outfile dist/index.js
   ```

2. **Test locally:**
   ```bash
   # Run MCP server
   bun run src/index.ts

   # Test MCP tools
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | bun run src/index.ts
   ```

3. **Deploy alongside Python CLI:**
   - Users can choose which MCP to use
   - Configuration flag: `mcp_backend: typescript` or `python`

4. **Feature parity testing:**
   - Verify all tools work identically
   - Compare response formats
   - Test error handling

**Migration path for users:**

```json
// .metabob-config.json
{
  "mcp_backend": "typescript",  // or "python" (default)
  "analysis_api_url": "http://api.minibob.local/v2/analysis"
}
```

### Phase 3: Progressive Routing (Week 5-6)

**Goal:** Route requests to new API based on feature flags.

**Options:**

**Option A: Client-side routing** (recommended for testing)
```typescript
// metabob-mcp config
const API_URL = config.useNewAnalysisApi
  ? 'http://api.minibob.local/v2/analysis'
  : 'http://api.minibob.local/analysis';
```

**Option B: Server-side routing** (Istio/Nginx)
```yaml
# Istio VirtualService with header-based routing
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: analysis-routing
spec:
  hosts:
    - api.minibob.local
  http:
    - match:
        - headers:
            X-Use-New-Analysis-Api:
              exact: "true"
      route:
        - destination:
            host: metabob-analysis-api
    - route:
        - destination:
            host: metabob-rpc-api
```

**Gradual rollout:**
- Week 5: 10% of traffic to new API (canary)
- Week 6: 50% of traffic to new API
- Monitor error rates, latency, user feedback

### Phase 4: Full Cutover (Week 7-8)

**Goal:** Migrate all traffic to metabob-analysis-api, deprecate Python RPC analysis endpoints.

**Steps:**

1. **Announce deprecation:**
   - Email users
   - Update docs
   - Add deprecation warnings to old endpoints

2. **Switch default:**
   ```json
   // .metabob-config.json (new default)
   {
     "mcp_backend": "typescript",
     "analysis_api_url": "http://api.minibob.local/v2/analysis"
   }
   ```

3. **Monitor migration:**
   - Track usage of old vs. new endpoints
   - Identify holdouts and assist

4. **Deprecate metabob-rpc-api analysis endpoints:**
   - Return HTTP 410 Gone with migration instructions
   - Keep endpoints alive for 30 days with warnings

5. **Remove Python analysis code:**
   - Delete `server/routes/analysis.py`
   - Delete `tasks/jobs/analysis.py`, `contribution_analysis.py`, `maintainability.py`
   - Keep only non-analysis features (if any)

**Rollback plan:**
- Keep metabob-rpc-api running for 90 days
- Feature flag to switch back if issues found
- Database backups before migration

---

## 7. Open Questions and Decisions Needed

### 1. Task Queue: Celery Bridge, BullMQ, or Hybrid?

**Problem:** Python uses Celery for background task processing (3 parallel analysis jobs). How to handle in TypeScript?

**Option A: Celery Bridge (Python subprocess)**
```typescript
// Call Python Celery tasks from TypeScript
import { spawn } from 'child_process';

async function runAnalysis(files: File[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('celery', ['-A', 'tasks', 'call', 'tasks.jobs.analysis.run_analysis', '--args', JSON.stringify(files)]);
    // ... handle stdout/stderr
  });
}
```
- **Pros:** Reuse existing Python analysis code, minimal rewrite
- **Cons:** Complex deployment, subprocess overhead, language mixing

**Option B: BullMQ Native (TypeScript)**
```typescript
// Use BullMQ (Redis-backed job queue for Node/Bun)
import { Queue, Worker } from 'bullmq';

const analysisQueue = new Queue('analysis', { connection: redisClient });

// Enqueue job
await analysisQueue.add('run-analysis', { files, sessionId });

// Worker
const worker = new Worker('analysis', async (job) => {
  const results = await analyzeFiles(job.data.files);
  return results;
}, { connection: redisClient });
```
- **Pros:** Native TypeScript, simpler deployment, better type safety
- **Cons:** Requires rewriting analysis logic in TypeScript

**Option C: Hybrid (TypeScript orchestration, Python workers)**
```typescript
// TypeScript API enqueues to BullMQ
await analysisQueue.add('run-analysis', { files, sessionId });

// Python workers consume BullMQ jobs
# python/worker.py
from bullmq import Worker

def process_analysis(job):
    # Existing Python analysis code
    pass

worker = Worker("analysis", process_analysis, connection=redis_opts)
```
- **Pros:** Incremental migration, reuse Python code, TypeScript API
- **Cons:** Still requires Python runtime, complex architecture

**Recommendation:** Start with **Option C (Hybrid)** for quick MVP, migrate to **Option B (BullMQ Native)** long-term.

### 2. Analysis Engines: Rewrite in TypeScript, Call Python, or Microservice?

**Problem:** Core analysis logic is in Python (bug detection, pattern matching, etc.). How to migrate?

**Option A: Rewrite in TypeScript**
- Use TypeScript AST parsers (e.g., `ts-morph`, `@babel/parser`)
- Reimplement pattern detectors
- **Pros:** Single language, better performance
- **Cons:** Large effort, potential bugs from rewrite

**Option B: Call Python as Subprocess**
```typescript
async function detectBugs(code: string): Promise<Problem[]> {
  const result = await exec(`python -m analysis.detect_bugs`, { input: code });
  return JSON.parse(result.stdout);
}
```
- **Pros:** Reuse existing code, fast MVP
- **Cons:** Subprocess overhead, error handling complexity

**Option C: Python Microservice**
```typescript
// Python service: http://analysis-engine:5000
async function detectBugs(code: string): Promise<Problem[]> {
  const response = await fetch('http://analysis-engine:5000/detect-bugs', {
    method: 'POST',
    body: JSON.stringify({ code })
  });
  return await response.json();
}
```
- **Pros:** Language-agnostic, scalable, testable
- **Cons:** Network latency, more services to deploy

**Recommendation:** **Option C (Microservice)** for analysis engines, **Option A (TypeScript rewrite)** for simpler logic (e.g., component extraction).

### 3. Storage: Full SurrealDB, Hybrid Redis+SurrealDB, or Just Redis?

**Problem:** Python uses Redis for ephemeral session data. Should we keep Redis or migrate to SurrealDB?

**Option A: Full SurrealDB (persistent everything)**
- Store sessions, files, problems in SurrealDB
- No Redis needed
- **Pros:** Single database, full query power, persistence
- **Cons:** Slower for ephemeral data, higher memory usage

**Option B: Hybrid Redis+SurrealDB (current pattern)**
- Redis: Session state, job status, file content (ephemeral)
- SurrealDB: Problems, components, patterns (persistent)
- **Pros:** Fast ephemeral access, persistent history
- **Cons:** Two databases, sync complexity

**Option C: Just Redis (no SurrealDB)**
- Store everything in Redis
- **Pros:** Fast, simple
- **Cons:** No persistence (data lost on restart), limited querying

**Recommendation:** **Option B (Hybrid)** - matches metabob-activity-api pattern, best of both worlds.

### 4. WebSocket: Bun Native, Separate Service, or Server-Sent Events?

**Problem:** Real-time job updates need push mechanism.

**Option A: Bun Native WebSocket**
```typescript
Bun.serve({
  fetch(req, server) {
    if (server.upgrade(req)) return;
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws) { /* ... */ },
    message(ws, message) { /* ... */ },
    close(ws) { /* ... */ }
  }
});
```
- **Pros:** Built into Bun, no extra dependencies
- **Cons:** Harder to scale (sticky sessions needed)

**Option B: Separate WebSocket Service**
- Dedicated service for WebSocket connections
- Communicates with API via Redis pubsub
- **Pros:** Scales independently, sticky sessions not needed
- **Cons:** More complexity, extra service

**Option C: Server-Sent Events (SSE)**
```typescript
app.get('/v2/analysis/jobs/:jobId/stream', async (c) => {
  return c.stream(async (stream) => {
    while (job.status !== 'complete') {
      const update = await getJobStatus(jobId);
      await stream.write(`data: ${JSON.stringify(update)}\n\n`);
      await sleep(1000);
    }
  });
});
```
- **Pros:** Simple, HTTP-based, works through proxies
- **Cons:** One-way only, higher overhead

**Recommendation:** **Option A (Bun Native)** for MVP, **Option B (Separate Service)** if scaling issues arise.

### 5. Progressive Sync: Push-Based (File Watcher) or Pull-Based (Polling)?

**Problem:** How to detect file changes and trigger re-analysis?

**Option A: Push-Based (File Watcher)**
```typescript
// Watch for file changes
import { watch } from 'fs/promises';

const watcher = watch(workspaceRoot, { recursive: true });
for await (const event of watcher) {
  if (event.eventType === 'change') {
    await submitFile(event.filename);
  }
}
```
- **Pros:** Real-time updates, efficient
- **Cons:** Can miss changes if watcher crashes, OS-specific quirks

**Option B: Pull-Based (Polling)**
```typescript
// Poll file hashes every N seconds
setInterval(async () => {
  const changedFiles = await detectChangedFiles(workspaceRoot);
  if (changedFiles.length > 0) {
    await submitFiles(changedFiles);
  }
}, 5000);
```
- **Pros:** Reliable, simple, catches missed changes
- **Cons:** Higher CPU usage, delayed updates

**Option C: Hybrid (Watcher + Periodic Reconciliation)**
- File watcher for real-time changes
- Periodic full scan (every 5 min) to catch missed changes
- **Pros:** Best of both worlds
- **Cons:** More complex

**Recommendation:** **Option C (Hybrid)** - same as current Python CLI behavior.

### 6. Analysis Engine Implementation: Python Workers vs. TypeScript Workers?

**Related to Decision #2, but specifically about worker architecture.**

**Celery vs. BullMQ Performance:**

| Feature | Celery (Python) | BullMQ (TypeScript) |
|---------|----------------|---------------------|
| Language | Python | TypeScript/JavaScript |
| Performance | ~1000 jobs/sec | ~5000 jobs/sec |
| Monitoring | Flower (web UI) | Bull Board (web UI) |
| Reliability | Very mature | Mature (used by many) |
| Learning curve | High | Low (if familiar with Node) |

**Recommendation:** If keeping Python analysis engines, use **Celery**. If rewriting in TypeScript, use **BullMQ**.

### Summary of Recommendations

| Decision | Recommendation | Justification |
|----------|---------------|---------------|
| Task Queue | Hybrid (TypeScript + Celery workers) | Incremental migration, reuse Python code |
| Analysis Engines | Microservice (Python) → TypeScript | Start with microservice, migrate gradually |
| Storage | Hybrid (Redis + SurrealDB) | Matches activity-api pattern, best performance |
| WebSocket | Bun Native | Simple, built-in, sufficient for MVP |
| Progressive Sync | Hybrid (Watcher + Polling) | Matches current CLI behavior |
| Overall Strategy | Incremental migration over 8 weeks | Lower risk, continuous delivery |

---

## 8. Comparison with Activity System Extraction

### Successful Pattern from metabob-rpc-api → metabob-activity-api

```
┌─────────────────────────────────────────────────────────────────┐
│ ACTIVITY SYSTEM EXTRACTION (Completed)                          │
└─────────────────────────────────────────────────────────────────┘

BEFORE:
metabob-rpc-api (Python FastAPI)
├── server/routes/activities.py         # Activity endpoints
├── server/routes/templates.py          # Template CRUD
├── server/routes/executions.py         # Execution tracking
└── server/db/postgresql.py             # PostgreSQL storage

AFTER:
metabob-activity-api (TypeScript Bun)
├── src/routes/activities.ts            # Activity endpoints
├── src/routes/impulses.ts              # Impulse management
├── src/routes/goal-paths.ts            # Goal processing
└── src/db/surreal.ts                   # SurrealDB storage

MiniBob (TypeScript Bun)
├── src/activity.ts                     # Activity execution
├── src/impulse.ts                      # Impulse loading
├── src/goal-processor.ts               # Goal recommendations
└── Delegates to activity-api for:      # Backend delegation
    - Template selection (Thompson Sampling)
    - Execution trace storage
    - Impulse resolution
    - Metrics aggregation
```

### Applying Same Pattern to Analysis System

```
┌─────────────────────────────────────────────────────────────────┐
│ ANALYSIS SYSTEM EXTRACTION (Proposed)                           │
└─────────────────────────────────────────────────────────────────┘

BEFORE:
metabob-rpc-api (Python FastAPI)
├── server/routes/analysis.py           # Analysis endpoints
├── server/actions/analysis.py          # Analysis orchestration
├── tasks/jobs/analysis.py              # Main analysis worker
├── tasks/jobs/contribution_analysis.py # Contribution worker
├── tasks/jobs/maintainability.py       # Maintainability worker
└── server/routes/websocket.py          # WebSocket progress

metabob-cli (Python MCP)
├── src/metabob_cli/mcp/tools.py        # MCP tools
├── src/metabob_cli/core/analysis_engine.py  # Analysis engine
├── src/metabob_cli/core/cpg_manager.py      # CPG builder
└── Calls metabob-rpc-api for analysis

AFTER:
metabob-analysis-api (TypeScript Bun)
├── src/routes/analysis.ts              # Analysis endpoints
├── src/routes/problems.ts              # Problem CRUD
├── src/routes/components.ts            # Component annotations
├── src/routes/impact.ts                # Impact analysis
├── src/services/analysis-engine.ts     # Analysis orchestration
└── src/db/surreal.ts                   # SurrealDB storage

metabob-mcp (TypeScript Bun)
├── src/tools/search-issues.ts          # MCP tools
├── src/tools/impact-analysis.ts        # Impact tool
├── src/tools/cochange.ts               # Co-change tool
└── Delegates to analysis-api for:      # Backend delegation
    - File analysis (main, contribution, maintainability)
    - Problem storage/retrieval
    - Component extraction
    - Impact calculation
```

### Key Parallels

| Aspect | Activity System | Analysis System |
|--------|----------------|-----------------|
| **Language Migration** | Python → TypeScript | Python → TypeScript |
| **Web Framework** | FastAPI → Hono | FastAPI → Hono |
| **Runtime** | Python → Bun | Python → Bun |
| **Database** | PostgreSQL → SurrealDB | Redis → Redis+SurrealDB |
| **Client** | minibob (TypeScript) | metabob-mcp (TypeScript) |
| **Pattern** | Backend delegates to API | MCP delegates to API |
| **Deployment** | Kubernetes + Helmfile | Kubernetes + Helmfile |
| **Success Metric** | Dashboard shows activity | Dashboard shows analysis |

### Architecture Diagrams

**Before (Python RPC API):**

```
┌──────────────────────────────────────────────────────────────────────┐
│                       metabob-rpc-api (Python)                       │
│  ┌────────────────────┐  ┌────────────────────┐  ┌───────────────┐  │
│  │  Activity Routes   │  │  Analysis Routes   │  │  Auth Routes  │  │
│  │  /activities       │  │  /submit           │  │  /session     │  │
│  │  /templates        │  │  /v2/submit        │  │               │  │
│  │  /executions       │  │  /analysis         │  │               │  │
│  └────────────────────┘  └────────────────────┘  └───────────────┘  │
│           │                       │                       │          │
│           ▼                       ▼                       ▼          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    PostgreSQL / Redis                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │  Celery Workers    │
                    │  - Analysis        │
                    │  - Contribution    │
                    │  - Maintainability │
                    └────────────────────┘
```

**After (Extracted TypeScript APIs):**

```
┌───────────────────────┐              ┌───────────────────────┐
│  metabob-activity-api │              │ metabob-analysis-api  │
│     (TypeScript)      │              │     (TypeScript)      │
│  ┌─────────────────┐  │              │  ┌─────────────────┐  │
│  │ Activity Routes │  │              │  │ Analysis Routes │  │
│  │ Impulse Routes  │  │              │  │ Problem Routes  │  │
│  │ Goal Routes     │  │              │  │ Component Routes│  │
│  └─────────────────┘  │              │  └─────────────────┘  │
│         │             │              │         │             │
│         ▼             │              │         ▼             │
│  ┌─────────────────┐  │              │  ┌─────────────────┐  │
│  │   SurrealDB     │  │              │  │  Redis+Surreal  │  │
│  │   learning_loop │  │              │  │   analysis_db   │  │
│  └─────────────────┘  │              │  └─────────────────┘  │
└───────────────────────┘              └───────────────────────┘
         ▲                                       ▲
         │                                       │
         │                                       │
┌────────┴────────┐                    ┌────────┴────────┐
│    MiniBob      │                    │  metabob-mcp    │
│  (TypeScript)   │                    │  (TypeScript)   │
│  - Activities   │                    │  - MCP Tools    │
│  - Impulses     │                    │  - File Watch   │
│  - Goals        │                    │  - CPG Builder  │
└─────────────────┘                    └─────────────────┘
```

### Success Criteria (from Activity System)

**What worked well:**

1. ✅ **Clean API boundaries:** Clear separation between storage (backend) and execution (vessel)
2. ✅ **Type safety:** End-to-end TypeScript types prevent runtime errors
3. ✅ **Performance:** Bun faster than Python for HTTP serving
4. ✅ **Deployment:** Helmfile pattern works well for multi-service deployments
5. ✅ **Observability:** Dashboard shows real-time system state
6. ✅ **Iteration speed:** TypeScript enables faster development

**What to improve:**

1. ⚠️ **Migration complexity:** Gradual migration caused temporary API duplication
2. ⚠️ **Documentation:** Need better migration guides for users
3. ⚠️ **Testing:** Integration tests crucial during migration
4. ⚠️ **Error handling:** Consistent error responses across old/new APIs

**Applying lessons to analysis system:**

- **Do:** Start with parallel deployment, gradual traffic shift
- **Do:** Maintain API compatibility during migration
- **Do:** Add comprehensive integration tests
- **Do:** Document migration path clearly
- **Don't:** Big-bang cutover (too risky)
- **Don't:** Diverge from existing API contracts
- **Don't:** Skip performance testing

---

## Conclusion

This exploration document provides a comprehensive map for extracting analysis capabilities from Python metabob-rpc-api to TypeScript metabob-analysis-api + metabob-mcp.

**Key Takeaways:**

1. **Architecture is clear:** Follow the same successful pattern as metabob-activity-api extraction
2. **Data model is defined:** SurrealDB schemas ready for sessions, jobs, problems, components, patterns
3. **Migration strategy is incremental:** 8-week phased rollout minimizes risk
4. **Open questions identified:** Task queue, analysis engines, storage strategy need decisions
5. **Integration points mapped:** Clear dataflows between MCP ↔ analysis-api ↔ activity-api

**Next Steps:**

1. **Decision meeting:** Resolve open questions (task queue, storage, analysis engines)
2. **Prototype:** Build minimal metabob-analysis-api with one endpoint
3. **Test integration:** Verify metabob-mcp can call analysis-api
4. **Deploy parallel:** Run both APIs side-by-side
5. **Migrate traffic:** Gradual rollout over 8 weeks
6. **Deprecate old:** Remove Python analysis code

**Timeline Estimate:**

- **Week 1-2:** Decisions + Initial build (metabob-analysis-api MVP)
- **Week 3-4:** MCP implementation + Testing
- **Week 5-6:** Parallel deployment + Canary rollout
- **Week 7-8:** Full cutover + Deprecation
- **Week 9+:** Cleanup + Documentation

**Resource Requirements:**

- 1-2 engineers full-time
- Access to Kubernetes cluster
- SurrealDB 3.x instance
- Redis instance
- Testing infrastructure

---

**Document Version:** 1.0
**Last Updated:** 2026-03-23
**Authors:** Claude Code Analysis
**Status:** Ready for Team Review
