# Analysis API ↔ MCP Contracts

**Created:** 2026-03-24
**Status:** Living Document
**Purpose:** Define interfaces and contracts between metabob-analysis-api and metabob-mcp using @metabob/cpg-inference

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Agent (Claude, Cursor)                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ MCP Protocol
                                │ (JSON-RPC over stdio)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        metabob-mcp                               │
│  TypeScript/Bun MCP Server                                       │
│  - Tool discovery and registration                               │
│  - Request validation (Zod schemas)                              │
│  - Session management (in-memory cache)                          │
│  - API client wrapper (retry, timeout, errors)                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP/JSON
                                │ (Hono client → Hono server)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   metabob-analysis-api                           │
│  TypeScript/Bun/Hono HTTP Backend                                │
│  - REST endpoints (v2 API)                                       │
│  - SurrealDB persistence                                         │
│  - Redis caching                                                 │
│  - MiniBob activity integration                                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Library Import
                                │ (direct TypeScript import)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  @metabob/cpg-inference                          │
│  TypeScript/Bun Library (NOT published to npm)                   │
│  workspace:* dependency in package.json                          │
│                                                                  │
│  - CoChangePredictor (main API)                                  │
│  - CodePropertyGraph (graph structure)                           │
│  - ONNXEmbeddingModel (GCN inference)                            │
│  - FAISSIndex (vector search via USearch)                        │
│  - SourceParser (tree-sitter parsing)                            │
│  - GraphBuilder (CPG construction)                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Shared TypeScript Types

### Package Structure

Both `metabob-analysis-api` and `metabob-mcp` will import types from `@metabob/cpg-inference`:

```typescript
// package.json dependencies
{
  "dependencies": {
    "@metabob/cpg-inference": "workspace:*"  // Local workspace reference
  }
}
```

### Core CPG Types (from @metabob/cpg-inference)

```typescript
import type {
  CPGNode,
  CPGEdge,
  NodeType,
  EdgeType,
  CoChangePrediction,
  AddFileResult,
  PredictorConfig,
} from '@metabob/cpg-inference';

// CPGNode structure
interface CPGNode {
  id: string;                   // Format: "filePath::type::name::startLine"
  type: NodeType;               // 'file' | 'class' | 'function' | 'method' | 'statement' | 'expression'
  name: string;
  startLine: number;            // 1-indexed
  endLine: number;
  sourceText?: string;
  language?: string;            // 'typescript' | 'javascript' | 'python'

  parentId?: string;
  childrenIds: string[];

  complexity?: number;
  linesOfCode?: number;
  numParams?: number;
  depth?: number;
}

// CoChangePrediction result
interface CoChangePrediction {
  componentId: string;          // CPGNode.id
  similarityScore: number;      // 0.0 to 1.0 (cosine similarity)
  filePath: string;
  componentName: string;
  componentType: string;        // NodeType
  startLine: number;
}
```

### Analysis API Domain Types

These types extend or wrap CPG types for analysis operations:

```typescript
// src/models/types.ts (metabob-analysis-api)

import type { CPGNode, CoChangePrediction } from '@metabob/cpg-inference';

/**
 * Analysis problem detected in code
 * Stored in: SurrealDB::analysis_problems
 */
export interface AnalysisProblem {
  id: string;                   // SurrealDB record ID
  session_id: string;
  component_id: string;         // CPGNode.id
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;             // 'security' | 'performance' | 'maintainability' | 'correctness'
  message: string;
  impact_score: number;         // 0.0 to 1.0
  status: 'open' | 'in_progress' | 'resolved' | 'ignored';
  created_at: string;           // ISO 8601
  updated_at: string;

  // Resolution metadata (when status = 'resolved')
  resolution_summary?: string;
  fixed_in_commit?: string;
  resolved_at?: string;
}

/**
 * Component annotation (design decision, implementation note)
 * Stored in: SurrealDB::component_annotations
 */
export interface ComponentAnnotation {
  id: string;                   // SurrealDB record ID
  component_id: string;         // CPGNode.id
  text: string;
  type: 'design_decision' | 'implementation_note' | 'bug_context' | 'todo';
  session_id: string;
  created_by: string;           // User ID or agent ID
  created_at: string;

  // Optional link to a problem
  linked_problem_id?: string;
}

/**
 * Co-change pattern learned from history
 * Stored in: SurrealDB::cochange_patterns
 */
export interface CochangePattern {
  id: string;
  project_id: string;
  file_a: string;
  file_b: string;
  frequency: number;            // Number of times seen together
  confidence: number;           // 0.0 to 1.0 (Bayesian posterior)
  total_commits: number;
  last_seen: string;            // ISO 8601
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysisResult {
  changed_components: string[]; // CPGNode.id[]
  direct_dependencies: ImpactedComponent[];
  indirect_dependencies: ImpactedComponent[];
  affected_tests: ImpactedComponent[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

export interface ImpactedComponent {
  component_id: string;         // CPGNode.id
  component_name: string;
  file_path: string;
  depth: number;                // Distance from changed component
  risk: 'low' | 'medium' | 'high';
  reason: string;               // Why this component is impacted
  annotations?: ComponentAnnotation[];
}

/**
 * Implementation spec generation result
 */
export interface ImplementationSpec {
  goal: string;                 // User's goal description
  relevant_components: CPGNode[];
  data_flow: DataFlowEdge[];
  implementation_order: string[]; // CPGNode.id[] (topological sort)
  detected_patterns: DesignPattern[];
  diagram: string;              // Mermaid syntax
  estimated_complexity: 'low' | 'medium' | 'high';
}

export interface DataFlowEdge {
  from: string;                 // CPGNode.id
  to: string;
  type: 'data' | 'control';
  description: string;
}

export interface DesignPattern {
  name: string;                 // 'singleton' | 'factory' | 'observer' | etc.
  instances: string[];          // CPGNode.id[] (components implementing pattern)
  confidence: number;           // 0.0 to 1.0
}
```

### MCP Tool Types

These types define the MCP tool interface schemas:

```typescript
// src/tools/types.ts (metabob-mcp)

import type { AnalysisProblem, ComponentAnnotation, CochangePattern } from 'metabob-analysis-api-types';

/**
 * Tool: get_priority_issues
 */
export interface GetPriorityIssuesInput {
  limit?: number;               // Default: 10
  severity?: ('CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO')[];
  category?: string[];
  scope?: 'session' | 'project' | 'org';
}

export interface GetPriorityIssuesOutput {
  issues: AnalysisProblem[];
  total_issues: number;
  query_time_ms: number;
}

/**
 * Tool: search_codebase
 */
export interface SearchCodebaseInput {
  query: string;                // Natural language query
  limit?: number;
  filters?: {
    severity?: string[];
    category?: string[];
    file_pattern?: string;      // Glob pattern
    scope?: 'session' | 'project' | 'org';
  };
}

export interface SearchCodebaseOutput {
  results: SearchResult[];
  query_time_ms: number;
}

export interface SearchResult extends AnalysisProblem {
  similarity_score: number;     // 0.0 to 1.0
  match_reason: string;         // Why this result matched
}

/**
 * Tool: annotate_component
 */
export interface AnnotateComponentInput {
  component_id: string;         // CPGNode.id
  content: string;
  type: 'design_decision' | 'implementation_note' | 'bug_context' | 'todo';
  tags?: string[];
  link_to_problem_id?: string;
}

export interface AnnotateComponentOutput {
  annotation_id: string;
  annotation: ComponentAnnotation;
}

/**
 * Tool: suggest_related_changes
 */
export interface SuggestRelatedChangesInput {
  changed_files: string[];      // File paths
  limit?: number;
  confidence_threshold?: number; // Default: 0.3
  config?: {
    embedding_weight?: number;  // Default: 0.6
    frequency_weight?: number;  // Default: 0.4
  };
}

export interface SuggestRelatedChangesOutput {
  suggestions: CochangeSuggestion[];
  model_version: string;
  query_time_ms: number;
}

export interface CochangeSuggestion {
  file_path: string;
  confidence: number;           // 0.0 to 1.0
  reason: string;               // 'historical_pattern' | 'semantic_similarity' | 'hybrid'
  affected_components: string[]; // CPGNode.id[]
  historical_frequency?: number;
  embedding_similarity?: number;
}

/**
 * Tool: analyze_change_impact
 */
export interface AnalyzeChangeImpactInput {
  changed_files?: string[];
  diff?: string;                // Git diff output
  direction?: 'forward' | 'backward' | 'both';  // Default: 'both'
  max_depth?: number;           // Default: 5
  include_tests?: boolean;      // Default: true
}

export interface AnalyzeChangeImpactOutput {
  analysis: ImpactAnalysisResult;
  query_time_ms: number;
}

/**
 * Tool: mark_problem_complete
 */
export interface MarkProblemCompleteInput {
  problem_id: string;           // AnalysisProblem.id
  resolution_summary: string;
  fixed_in_commit?: string;
  auto_annotate?: boolean;      // Default: true
}

export interface MarkProblemCompleteOutput {
  problem: AnalysisProblem;
  annotation?: ComponentAnnotation; // If auto_annotate = true
}

/**
 * Tool: generate_implementation_spec
 */
export interface GenerateImplementationSpecInput {
  goal: string;                 // User's goal description
  entry_points?: string[];      // CPGNode.id[] or file paths
  context?: string;             // Additional context
}

export interface GenerateImplementationSpecOutput {
  spec: ImplementationSpec;
  query_time_ms: number;
}
```

---

## Layer 2: HTTP API Contracts

### Base URL & Authentication

```
Base URL: http://metabob-analysis-api.activity-system.svc.cluster.local:8080
External: http://api.minibob.local (via Istio gateway)

Headers:
  X-Session-ID: <session-id>     # Required for all requests
  Authorization: Bearer <token>  # Optional (future)
  Content-Type: application/json
```

### Endpoint Specifications

#### 1. GET /v2/analysis/priority

**Purpose:** Get priority issues filtered by severity/category

**Request:**
```http
GET /v2/analysis/priority?limit=10&severity[]=CRITICAL&severity[]=HIGH&scope=session
X-Session-ID: sess_abc123
```

**Query Parameters:**
- `limit`: integer (default: 10)
- `severity[]`: array of strings (CRITICAL, HIGH, MEDIUM, LOW, INFO)
- `category[]`: array of strings
- `scope`: string (session, project, org)

**Response (200 OK):**
```json
{
  "issues": [
    {
      "id": "problem:abc123",
      "session_id": "sess_abc123",
      "component_id": "src/auth.ts::function::login::15",
      "severity": "CRITICAL",
      "category": "security",
      "message": "Potential SQL injection vulnerability",
      "impact_score": 0.95,
      "status": "open",
      "created_at": "2026-03-24T12:00:00Z",
      "updated_at": "2026-03-24T12:00:00Z"
    }
  ],
  "total_issues": 42,
  "query_time_ms": 85
}
```

**Error Codes:**
- 400: Invalid query parameters
- 401: Missing or invalid session ID
- 500: Database error

---

#### 2. POST /v2/analysis/search

**Purpose:** Semantic search for code issues

**Request:**
```http
POST /v2/analysis/search
X-Session-ID: sess_abc123
Content-Type: application/json

{
  "query": "find authentication bugs",
  "limit": 5,
  "filters": {
    "severity": ["CRITICAL", "HIGH"],
    "category": ["security"],
    "file_pattern": "src/**/*.ts",
    "scope": "session"
  }
}
```

**Response (200 OK):**
```json
{
  "results": [
    {
      "id": "problem:abc123",
      "session_id": "sess_abc123",
      "component_id": "src/auth.ts::function::login::15",
      "severity": "CRITICAL",
      "category": "security",
      "message": "Potential SQL injection vulnerability",
      "impact_score": 0.95,
      "status": "open",
      "created_at": "2026-03-24T12:00:00Z",
      "updated_at": "2026-03-24T12:00:00Z",
      "similarity_score": 0.87,
      "match_reason": "Keywords: authentication, SQL, vulnerability"
    }
  ],
  "query_time_ms": 145
}
```

---

#### 3. POST /v2/analysis/annotations

**Purpose:** Create component annotation

**Request:**
```http
POST /v2/analysis/annotations
X-Session-ID: sess_abc123
Content-Type: application/json

{
  "component_id": "src/auth.ts::function::login::15",
  "content": "This function needs input validation before database query",
  "type": "implementation_note",
  "tags": ["security", "todo"],
  "link_to_problem_id": "problem:abc123"
}
```

**Response (201 Created):**
```json
{
  "annotation_id": "annotation:xyz789",
  "annotation": {
    "id": "annotation:xyz789",
    "component_id": "src/auth.ts::function::login::15",
    "text": "This function needs input validation before database query",
    "type": "implementation_note",
    "session_id": "sess_abc123",
    "created_by": "user:alice",
    "created_at": "2026-03-24T12:30:00Z",
    "linked_problem_id": "problem:abc123"
  }
}
```

**Error Codes:**
- 404: Component not found in CPG
- 400: Invalid annotation type or content

---

#### 4. POST /v2/analysis/cochange/suggest

**Purpose:** Suggest related files that should be changed together

**Request:**
```http
POST /v2/analysis/cochange/suggest
X-Session-ID: sess_abc123
Content-Type: application/json

{
  "changed_files": ["src/auth/login.ts"],
  "limit": 5,
  "confidence_threshold": 0.5,
  "config": {
    "embedding_weight": 0.6,
    "frequency_weight": 0.4
  }
}
```

**Response (200 OK):**
```json
{
  "suggestions": [
    {
      "file_path": "src/auth/session.ts",
      "confidence": 0.82,
      "reason": "hybrid",
      "affected_components": [
        "src/auth/session.ts::function::createSession::10",
        "src/auth/session.ts::function::validateSession::25"
      ],
      "historical_frequency": 8,
      "embedding_similarity": 0.91
    }
  ],
  "model_version": "cochange-v2.3-proj_abc",
  "query_time_ms": 220
}
```

---

#### 5. POST /v2/analysis/impact

**Purpose:** Analyze change impact via CPG traversal

**Request:**
```http
POST /v2/analysis/impact
X-Session-ID: sess_abc123
Content-Type: application/json

{
  "changed_files": ["src/auth/login.ts"],
  "direction": "both",
  "max_depth": 5,
  "include_tests": true
}
```

**Response (200 OK):**
```json
{
  "analysis": {
    "changed_components": [
      "src/auth/login.ts::function::login::15"
    ],
    "direct_dependencies": [
      {
        "component_id": "src/auth/session.ts::function::createSession::10",
        "component_name": "createSession",
        "file_path": "src/auth/session.ts",
        "depth": 1,
        "risk": "high",
        "reason": "Called by changed component",
        "annotations": []
      }
    ],
    "indirect_dependencies": [],
    "affected_tests": [
      {
        "component_id": "tests/auth/login.test.ts::function::testLoginFlow::5",
        "component_name": "testLoginFlow",
        "file_path": "tests/auth/login.test.ts",
        "depth": 2,
        "risk": "medium",
        "reason": "Tests changed component",
        "annotations": []
      }
    ],
    "risk_level": "high"
  },
  "query_time_ms": 350
}
```

---

#### 6. PUT /v2/analysis/problems/:id/complete

**Purpose:** Mark problem as resolved

**Request:**
```http
PUT /v2/analysis/problems/problem:abc123/complete
X-Session-ID: sess_abc123
Content-Type: application/json

{
  "resolution_summary": "Added input validation using zod schema",
  "fixed_in_commit": "a1b2c3d4",
  "auto_annotate": true
}
```

**Response (200 OK):**
```json
{
  "problem": {
    "id": "problem:abc123",
    "status": "resolved",
    "resolved_at": "2026-03-24T13:00:00Z",
    "resolution_summary": "Added input validation using zod schema",
    "fixed_in_commit": "a1b2c3d4"
  },
  "annotation": {
    "id": "annotation:auto123",
    "component_id": "src/auth/login.ts::function::login::15",
    "text": "RESOLVED: Added input validation using zod schema (commit: a1b2c3d4)",
    "type": "bug_context",
    "linked_problem_id": "problem:abc123"
  }
}
```

---

#### 7. POST /v2/analysis/specs/generate

**Purpose:** Generate implementation spec from goal

**Request:**
```http
POST /v2/analysis/specs/generate
X-Session-ID: sess_abc123
Content-Type: application/json

{
  "goal": "Add rate limiting to the login endpoint",
  "entry_points": ["src/auth/login.ts"],
  "context": "Need to prevent brute force attacks"
}
```

**Response (200 OK):**
```json
{
  "spec": {
    "goal": "Add rate limiting to the login endpoint",
    "relevant_components": [
      {
        "id": "src/auth/login.ts::function::login::15",
        "type": "function",
        "name": "login",
        "startLine": 15,
        "endLine": 30
      }
    ],
    "data_flow": [
      {
        "from": "src/middleware/rate-limit.ts::function::checkRateLimit::5",
        "to": "src/auth/login.ts::function::login::15",
        "type": "control",
        "description": "Rate limiter should run before login"
      }
    ],
    "implementation_order": [
      "src/middleware/rate-limit.ts::function::checkRateLimit::5",
      "src/routes/auth.ts::function::setupAuthRoutes::10"
    ],
    "detected_patterns": [
      {
        "name": "middleware",
        "instances": [
          "src/middleware/auth.ts::function::authenticate::10"
        ],
        "confidence": 0.9
      }
    ],
    "diagram": "graph TD\n  A[Request] --> B[Rate Limiter]\n  B --> C[Login Handler]",
    "estimated_complexity": "medium"
  },
  "query_time_ms": 800
}
```

---

## Layer 3: MCP Protocol Mapping

### MCP Request Format

```jsonrpc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_priority_issues",
    "arguments": {
      "limit": 10,
      "severity": ["CRITICAL", "HIGH"]
    }
  }
}
```

### MCP Response Format

```jsonrpc
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 5 priority issues..."
      }
    ]
  }
}
```

### Tool Registration

```typescript
// src/index.ts (metabob-mcp)
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'metabob-mcp',
  version: '0.1.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Register tool
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'get_priority_issues',
        description: 'Fetch high-priority problems for current codebase',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 10 },
            severity: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'],
              },
            },
          },
        },
      },
      // ... 6 more tools
    ],
  };
});
```

---

## Layer 4: CPG Integration Patterns

### Pattern 1: Direct Library Import (Analysis API)

```typescript
// src/services/cpg-service.ts (metabob-analysis-api)
import { CoChangePredictor } from '@metabob/cpg-inference';

export class CPGService {
  private predictor: CoChangePredictor;
  private cache: Map<string, CoChangePredictor>;

  constructor() {
    this.cache = new Map();
  }

  async getCPGForSession(sessionId: string): Promise<CoChangePredictor> {
    // Check cache
    if (this.cache.has(sessionId)) {
      return this.cache.get(sessionId)!;
    }

    // Create new predictor
    const predictor = new CoChangePredictor({
      embeddingDim: 32,
      topK: 10,
      minSimilarity: 0.3,
    });

    await predictor.initialize();

    // Load files from database
    const files = await this.loadSessionFiles(sessionId);
    await predictor.addFiles(files);

    // Cache for session
    this.cache.set(sessionId, predictor);

    return predictor;
  }

  async analyzeImpact(
    sessionId: string,
    componentIds: string[],
    maxDepth: number
  ): Promise<ImpactAnalysisResult> {
    const predictor = await this.getCPGForSession(sessionId);
    const cpg = predictor.getCPG();

    // Traverse graph to find dependencies
    const directDeps = new Set<string>();
    const indirectDeps = new Set<string>();

    for (const componentId of componentIds) {
      const paths = cpg.traverse(componentId, {
        maxDepth,
        edgeTypes: ['CALLS', 'DEPENDS'],
      });

      for (const path of paths) {
        if (path.length === 1) {
          directDeps.add(path.nodes[path.nodes.length - 1]);
        } else {
          indirectDeps.add(path.nodes[path.nodes.length - 1]);
        }
      }
    }

    return {
      changed_components: componentIds,
      direct_dependencies: Array.from(directDeps).map(id =>
        this.toImpactedComponent(cpg.getNode(id)!, 1)
      ),
      indirect_dependencies: Array.from(indirectDeps).map(id =>
        this.toImpactedComponent(cpg.getNode(id)!, 2)
      ),
      affected_tests: [],
      risk_level: this.computeRiskLevel(directDeps.size, indirectDeps.size),
    };
  }
}
```

### Pattern 2: HTTP Proxy (MCP Server)

```typescript
// src/api-client.ts (metabob-mcp)
export class AnalysisAPIClient {
  private baseURL: string;
  private sessionId: string;

  constructor(config: { baseURL: string; sessionId: string }) {
    this.baseURL = config.baseURL;
    this.sessionId = config.sessionId;
  }

  async getPriorityIssues(
    params: GetPriorityIssuesInput
  ): Promise<GetPriorityIssuesOutput> {
    const url = new URL('/v2/analysis/priority', this.baseURL);
    url.searchParams.set('limit', String(params.limit || 10));

    if (params.severity) {
      params.severity.forEach(s => url.searchParams.append('severity[]', s));
    }

    const response = await fetch(url.toString(), {
      headers: {
        'X-Session-ID': this.sessionId,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // ... other methods
}
```

---

## Deployment Configuration

### Package Dependencies

**metabob-analysis-api/package.json:**
```json
{
  "name": "metabob-analysis-api",
  "dependencies": {
    "@metabob/cpg-inference": "workspace:*",
    "@metabob/minibob": "workspace:*",
    "hono": "^4.0.0",
    "surrealdb.js": "^1.0.0",
    "ioredis": "^5.3.0"
  }
}
```

**metabob-mcp/package.json:**
```json
{
  "name": "metabob-mcp",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  }
}
```

### Environment Variables

**metabob-analysis-api:**
```bash
ANALYSIS_API_URL=http://metabob-analysis-api:8080
SURREALDB_URL=http://surrealdb:8000
REDIS_URL=redis://redis-valkey:6379
PORT=8080
```

**metabob-mcp:**
```bash
ANALYSIS_API_URL=http://metabob-analysis-api:8080
MCP_LOG_LEVEL=info
```

---

## Testing Strategy

### Contract Tests (Analysis API)

```typescript
// tests/contracts/api-endpoints.test.ts
describe('API Contract Tests', () => {
  test('GET /v2/analysis/priority matches contract', async () => {
    const response = await fetch('/v2/analysis/priority?limit=5', {
      headers: { 'X-Session-ID': 'test-session' },
    });

    const data = await response.json();

    // Validate against Zod schema
    const PriorityResponseSchema = z.object({
      issues: z.array(AnalysisProblemSchema),
      total_issues: z.number(),
      query_time_ms: z.number(),
    });

    expect(() => PriorityResponseSchema.parse(data)).not.toThrow();
  });
});
```

### Integration Tests (MCP ↔ Analysis API)

```typescript
// tests/integration/mcp-to-api.test.ts
describe('MCP to Analysis API Integration', () => {
  let mcpClient: MCPClient;
  let apiServer: AnalysisAPIServer;

  beforeAll(async () => {
    // Start analysis API server
    apiServer = await startTestAPIServer();

    // Start MCP server
    mcpClient = await startTestMCPServer({
      analysisAPIURL: apiServer.url,
    });
  });

  test('get_priority_issues tool returns valid data', async () => {
    const result = await mcpClient.callTool('get_priority_issues', {
      limit: 5,
      severity: ['CRITICAL'],
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const data = JSON.parse(result.content[0].text);
    expect(data.issues).toBeDefined();
    expect(Array.isArray(data.issues)).toBe(true);
  });
});
```

---

## Performance Targets

| Operation | Target P50 | Target P99 | Notes |
|-----------|-----------|-----------|-------|
| MCP tool call overhead | <50ms | <150ms | Validation + HTTP roundtrip |
| API endpoint latency | See Layer 2 specs | - | From analysis-api design doc |
| CPG initialization | <500ms | <1s | Load predictor + files |
| Full pipeline (MCP → API → CPG) | <1s | <3s | Entire tool execution |

---

## Error Handling

### Error Code Mapping

| API Status | MCP Error Code | Description |
|-----------|---------------|-------------|
| 400 | INVALID_PARAMS | Invalid request parameters |
| 401 | UNAUTHORIZED | Missing or invalid session ID |
| 404 | NOT_FOUND | Component or resource not found |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Database or CPG error |
| 503 | SERVICE_UNAVAILABLE | Analysis API unavailable |

### MCP Error Response Format

```jsonrpc
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "apiError": {
        "status": 400,
        "message": "Component not found in CPG",
        "component_id": "invalid-id"
      }
    }
  }
}
```

---

## Migration Path

### Phase 1: Type Definitions (Week 1)

1. Create shared types in `@metabob/cpg-inference`
2. Export from package index
3. Add workspace dependencies

### Phase 2: Analysis API Implementation (Week 2-3)

1. Implement CPGService using CoChangePredictor
2. Create HTTP endpoints matching contracts
3. Add Zod validation schemas
4. Write contract tests

### Phase 3: MCP Server Implementation (Week 4)

1. Implement API client wrapper
2. Register 7 MCP tools
3. Map MCP requests → API calls
4. Add error translation layer
5. Write integration tests

### Phase 4: End-to-End Testing (Week 5)

1. Deploy to local Kubernetes
2. Test with Claude Desktop
3. Measure performance
4. Document examples

---

## References

- **CPG Library**: `repos/cpg-inference-ts/`
- **Analysis API Design**: `openspec/changes/metabob-analysis-api/design.md`
- **MCP Proposal**: `openspec/changes/metabob-mcp/proposal.md`
- **MCP Specification**: https://modelcontextprotocol.io/
- **MiniBob Integration**: `repos/minibob/`
