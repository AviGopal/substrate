# Interface Implementation Guide
## Building metabob-analysis-api & metabob-mcp with @metabob/cpg-inference

**Created:** 2026-03-24
**Status:** Implementation Guide
**Purpose:** Step-by-step guide to implement the contracts defined in ANALYSIS_API_MCP_CONTRACTS.md

---

## Quick Start: What to Build First

### Priority 1: Shared Type Library (1-2 hours)

Create a shared types package that both projects can import:

**File:** `repos/metabob-analysis-api/src/models/types.ts`

```typescript
/**
 * Shared types for analysis operations
 * These types extend @metabob/cpg-inference types for domain-specific use cases
 */

import type { CPGNode, CoChangePrediction } from '@metabob/cpg-inference';

// Re-export CPG types for convenience
export type { CPGNode, CPGEdge, NodeType, EdgeType, CoChangePrediction } from '@metabob/cpg-inference';

/**
 * Severity levels for detected problems
 */
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

/**
 * Problem categories
 */
export type ProblemCategory = 'security' | 'performance' | 'maintainability' | 'correctness';

/**
 * Problem status
 */
export type ProblemStatus = 'open' | 'in_progress' | 'resolved' | 'ignored';

/**
 * Analysis problem detected in code
 */
export interface AnalysisProblem {
  id: string;
  session_id: string;
  component_id: string;         // CPGNode.id
  severity: Severity;
  category: ProblemCategory;
  message: string;
  impact_score: number;
  status: ProblemStatus;
  created_at: string;
  updated_at: string;

  // Resolution metadata
  resolution_summary?: string;
  fixed_in_commit?: string;
  resolved_at?: string;
}

/**
 * Component annotation types
 */
export type AnnotationType = 'design_decision' | 'implementation_note' | 'bug_context' | 'todo';

/**
 * Component annotation
 */
export interface ComponentAnnotation {
  id: string;
  component_id: string;
  text: string;
  type: AnnotationType;
  session_id: string;
  created_by: string;
  created_at: string;
  linked_problem_id?: string;
}

/**
 * Co-change pattern
 */
export interface CochangePattern {
  id: string;
  project_id: string;
  file_a: string;
  file_b: string;
  frequency: number;
  confidence: number;
  total_commits: number;
  last_seen: string;
}

/**
 * Risk levels for impact analysis
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Impacted component
 */
export interface ImpactedComponent {
  component_id: string;
  component_name: string;
  file_path: string;
  depth: number;
  risk: RiskLevel;
  reason: string;
  annotations?: ComponentAnnotation[];
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysisResult {
  changed_components: string[];
  direct_dependencies: ImpactedComponent[];
  indirect_dependencies: ImpactedComponent[];
  affected_tests: ImpactedComponent[];
  risk_level: RiskLevel;
}

/**
 * Co-change suggestion
 */
export interface CochangeSuggestion {
  file_path: string;
  confidence: number;
  reason: 'historical_pattern' | 'semantic_similarity' | 'hybrid';
  affected_components: string[];
  historical_frequency?: number;
  embedding_similarity?: number;
}

/**
 * Data flow edge types
 */
export type DataFlowType = 'data' | 'control';

/**
 * Data flow edge
 */
export interface DataFlowEdge {
  from: string;
  to: string;
  type: DataFlowType;
  description: string;
}

/**
 * Design pattern
 */
export interface DesignPattern {
  name: string;
  instances: string[];
  confidence: number;
}

/**
 * Implementation spec
 */
export interface ImplementationSpec {
  goal: string;
  relevant_components: CPGNode[];
  data_flow: DataFlowEdge[];
  implementation_order: string[];
  detected_patterns: DesignPattern[];
  diagram: string;
  estimated_complexity: 'low' | 'medium' | 'high';
}
```

### Priority 2: Zod Validation Schemas (1-2 hours)

**File:** `repos/metabob-analysis-api/src/models/schemas.ts`

```typescript
/**
 * Zod schemas for request validation
 */

import { z } from 'zod';

/**
 * Severity enum schema
 */
export const SeveritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);

/**
 * Problem category schema
 */
export const ProblemCategorySchema = z.enum(['security', 'performance', 'maintainability', 'correctness']);

/**
 * Annotation type schema
 */
export const AnnotationTypeSchema = z.enum(['design_decision', 'implementation_note', 'bug_context', 'todo']);

/**
 * GET /v2/analysis/priority - Query params
 */
export const GetPriorityIssuesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(10),
  severity: z.array(SeveritySchema).optional(),
  category: z.array(ProblemCategorySchema).optional(),
  scope: z.enum(['session', 'project', 'org']).default('session'),
});

/**
 * POST /v2/analysis/search - Request body
 */
export const SearchCodebaseRequestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().default(10),
  filters: z.object({
    severity: z.array(SeveritySchema).optional(),
    category: z.array(ProblemCategorySchema).optional(),
    file_pattern: z.string().optional(),
    scope: z.enum(['session', 'project', 'org']).default('session'),
  }).optional(),
});

/**
 * POST /v2/analysis/annotations - Request body
 */
export const CreateAnnotationRequestSchema = z.object({
  component_id: z.string().min(1),
  content: z.string().min(1),
  type: AnnotationTypeSchema,
  tags: z.array(z.string()).optional(),
  link_to_problem_id: z.string().optional(),
});

/**
 * POST /v2/analysis/cochange/suggest - Request body
 */
export const SuggestCochangesRequestSchema = z.object({
  changed_files: z.array(z.string().min(1)),
  limit: z.number().int().positive().default(5),
  confidence_threshold: z.number().min(0).max(1).default(0.3),
  config: z.object({
    embedding_weight: z.number().min(0).max(1).default(0.6),
    frequency_weight: z.number().min(0).max(1).default(0.4),
  }).optional(),
});

/**
 * POST /v2/analysis/impact - Request body
 */
export const AnalyzeImpactRequestSchema = z.object({
  changed_files: z.array(z.string()).optional(),
  diff: z.string().optional(),
  direction: z.enum(['forward', 'backward', 'both']).default('both'),
  max_depth: z.number().int().positive().default(5),
  include_tests: z.boolean().default(true),
}).refine(data => data.changed_files || data.diff, {
  message: 'Either changed_files or diff must be provided',
});

/**
 * PUT /v2/analysis/problems/:id/complete - Request body
 */
export const MarkProblemCompleteRequestSchema = z.object({
  resolution_summary: z.string().min(1),
  fixed_in_commit: z.string().optional(),
  auto_annotate: z.boolean().default(true),
});

/**
 * POST /v2/analysis/specs/generate - Request body
 */
export const GenerateSpecRequestSchema = z.object({
  goal: z.string().min(1),
  entry_points: z.array(z.string()).optional(),
  context: z.string().optional(),
});
```

### Priority 3: CPG Service Wrapper (2-3 hours)

**File:** `repos/metabob-analysis-api/src/services/cpg-service.ts`

```typescript
/**
 * CPG Service - Wrapper around @metabob/cpg-inference
 * Manages CPG lifecycle, caching, and session-scoped predictors
 */

import { CoChangePredictor } from '@metabob/cpg-inference';
import type { CPGNode, CoChangePrediction } from '@metabob/cpg-inference';
import type { ImpactAnalysisResult, ImpactedComponent } from '../models/types.js';

export interface CPGServiceConfig {
  embeddingDim?: number;
  topK?: number;
  minSimilarity?: number;
}

export class CPGService {
  private predictors: Map<string, CoChangePredictor>;
  private config: Required<CPGServiceConfig>;

  constructor(config: CPGServiceConfig = {}) {
    this.predictors = new Map();
    this.config = {
      embeddingDim: config.embeddingDim ?? 32,
      topK: config.topK ?? 10,
      minSimilarity: config.minSimilarity ?? 0.3,
    };
  }

  /**
   * Get or create predictor for session
   */
  async getPredictorForSession(sessionId: string): Promise<CoChangePredictor> {
    // Check cache
    if (this.predictors.has(sessionId)) {
      return this.predictors.get(sessionId)!;
    }

    // Create new predictor
    const predictor = new CoChangePredictor({
      embeddingDim: this.config.embeddingDim,
      topK: this.config.topK,
      minSimilarity: this.config.minSimilarity,
    });

    await predictor.initialize();

    // Cache for session
    this.predictors.set(sessionId, predictor);

    return predictor;
  }

  /**
   * Add files to session CPG
   */
  async addFiles(sessionId: string, files: Record<string, string>): Promise<void> {
    const predictor = await this.getPredictorForSession(sessionId);
    await predictor.addFiles(files);
  }

  /**
   * Predict co-changes for components
   */
  async predictCochanges(
    sessionId: string,
    componentIds: string[],
    k?: number
  ): Promise<CoChangePrediction[]> {
    const predictor = await this.getPredictorForSession(sessionId);
    return predictor.predictCochanges(componentIds, k);
  }

  /**
   * Analyze change impact via graph traversal
   */
  async analyzeImpact(
    sessionId: string,
    componentIds: string[],
    maxDepth: number
  ): Promise<ImpactAnalysisResult> {
    const predictor = await this.getPredictorForSession(sessionId);
    const cpg = predictor.getCPG();

    const directDeps = new Set<string>();
    const indirectDeps = new Set<string>();

    // Traverse graph to find dependencies
    for (const componentId of componentIds) {
      const paths = cpg.traverse(componentId, {
        maxDepth,
        edgeTypes: ['CALLS', 'DEPENDS'],
      });

      for (const path of paths) {
        if (path.length === 1) {
          directDeps.add(path.nodes[path.nodes.length - 1]);
        } else if (path.length > 1) {
          indirectDeps.add(path.nodes[path.nodes.length - 1]);
        }
      }
    }

    // Convert to impacted components
    const toImpactedComponent = (nodeId: string, depth: number): ImpactedComponent => {
      const node = cpg.getNode(nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} not found in CPG`);
      }

      return {
        component_id: nodeId,
        component_name: node.name,
        file_path: (node as any).filePath || '',
        depth,
        risk: this.computeRisk(depth, node),
        reason: this.computeReason(depth),
        annotations: [],
      };
    };

    return {
      changed_components: componentIds,
      direct_dependencies: Array.from(directDeps).map(id => toImpactedComponent(id, 1)),
      indirect_dependencies: Array.from(indirectDeps).map(id => toImpactedComponent(id, 2)),
      affected_tests: [],
      risk_level: this.computeOverallRisk(directDeps.size, indirectDeps.size),
    };
  }

  /**
   * Get component by ID
   */
  async getComponent(sessionId: string, componentId: string): Promise<CPGNode | null> {
    const predictor = await this.getPredictorForSession(sessionId);
    return predictor.getComponent(componentId);
  }

  /**
   * Clear session cache
   */
  clearSession(sessionId: string): void {
    this.predictors.delete(sessionId);
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.predictors.clear();
  }

  private computeRisk(depth: number, node: CPGNode): 'low' | 'medium' | 'high' {
    if (depth === 1) return 'high';
    if (depth === 2) return 'medium';
    return 'low';
  }

  private computeReason(depth: number): string {
    if (depth === 1) return 'Direct dependency - called by changed component';
    if (depth === 2) return 'Indirect dependency - affected via dependency chain';
    return 'Distant dependency - may be affected';
  }

  private computeOverallRisk(directCount: number, indirectCount: number): 'low' | 'medium' | 'high' | 'critical' {
    if (directCount > 10) return 'critical';
    if (directCount > 5 || indirectCount > 20) return 'high';
    if (directCount > 2 || indirectCount > 10) return 'medium';
    return 'low';
  }
}
```

### Priority 4: First HTTP Endpoint (1-2 hours)

**File:** `repos/metabob-analysis-api/src/routes/priority.ts`

```typescript
/**
 * Priority Issues Endpoint
 * GET /v2/analysis/priority
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { GetPriorityIssuesQuerySchema } from '../models/schemas.js';
import type { AnalysisProblem } from '../models/types.js';

const app = new Hono();

/**
 * GET /v2/analysis/priority
 * Fetch high-priority problems for current codebase
 */
app.get(
  '/',
  zValidator('query', GetPriorityIssuesQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const sessionId = c.req.header('X-Session-ID');

    if (!sessionId) {
      return c.json({ error: 'Missing X-Session-ID header' }, 401);
    }

    const startTime = performance.now();

    // TODO: Query SurrealDB for problems
    // For now, return mock data
    const mockIssues: AnalysisProblem[] = [
      {
        id: 'problem:abc123',
        session_id: sessionId,
        component_id: 'src/auth.ts::function::login::15',
        severity: 'CRITICAL',
        category: 'security',
        message: 'Potential SQL injection vulnerability',
        impact_score: 0.95,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Filter by severity if provided
    const filtered = query.severity
      ? mockIssues.filter(issue => query.severity!.includes(issue.severity))
      : mockIssues;

    // Limit results
    const limited = filtered.slice(0, query.limit);

    const queryTimeMs = performance.now() - startTime;

    return c.json({
      issues: limited,
      total_issues: filtered.length,
      query_time_ms: Math.round(queryTimeMs),
    });
  }
);

export default app;
```

### Priority 5: Main Server Setup (1 hour)

**File:** `repos/metabob-analysis-api/src/index.ts`

```typescript
/**
 * metabob-analysis-api - Main Server
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import priorityRoutes from './routes/priority.js';
import { CPGService } from './services/cpg-service.js';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Initialize CPG service (shared across requests)
const cpgService = new CPGService();

// Make CPG service available to routes
app.use('*', async (c, next) => {
  c.set('cpgService', cpgService);
  await next();
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.route('/v2/analysis/priority', priorityRoutes);

// Start server
const port = parseInt(process.env.PORT || '8080');

console.log(`Starting metabob-analysis-api on port ${port}...`);

export default {
  port,
  fetch: app.fetch,
};
```

### Priority 6: MCP Tool Implementation (2-3 hours)

**File:** `repos/metabob-mcp/src/tools/get-priority-issues.ts`

```typescript
/**
 * MCP Tool: get_priority_issues
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const GetPriorityIssuesTool: Tool = {
  name: 'get_priority_issues',
  description: 'Fetch high-priority problems for current codebase',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return',
        default: 10,
      },
      severity: {
        type: 'array',
        description: 'Filter by severity levels',
        items: {
          type: 'string',
          enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'],
        },
      },
      category: {
        type: 'array',
        description: 'Filter by categories',
        items: {
          type: 'string',
          enum: ['security', 'performance', 'maintainability', 'correctness'],
        },
      },
      scope: {
        type: 'string',
        description: 'Scope of analysis',
        enum: ['session', 'project', 'org'],
        default: 'session',
      },
    },
  },
};

/**
 * Input schema
 */
export const GetPriorityIssuesInputSchema = z.object({
  limit: z.number().int().positive().default(10),
  severity: z.array(z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'])).optional(),
  category: z.array(z.string()).optional(),
  scope: z.enum(['session', 'project', 'org']).default('session'),
});

export type GetPriorityIssuesInput = z.infer<typeof GetPriorityIssuesInputSchema>;

/**
 * Handler
 */
export async function handleGetPriorityIssues(
  input: GetPriorityIssuesInput,
  apiClient: any
): Promise<string> {
  const result = await apiClient.getPriorityIssues(input);

  // Format as text for MCP response
  const output = [
    `Found ${result.issues.length} priority issues (${result.total_issues} total)`,
    '',
    ...result.issues.map((issue: any, i: number) => [
      `${i + 1}. [${issue.severity}] ${issue.message}`,
      `   Component: ${issue.component_id}`,
      `   Category: ${issue.category}`,
      `   Impact: ${(issue.impact_score * 100).toFixed(0)}%`,
      '',
    ].join('\n')),
    `Query time: ${result.query_time_ms}ms`,
  ].join('\n');

  return output;
}
```

**File:** `repos/metabob-mcp/src/api-client.ts`

```typescript
/**
 * Analysis API Client
 * HTTP client for metabob-analysis-api
 */

export interface AnalysisAPIClientConfig {
  baseURL: string;
  sessionId: string;
  timeout?: number;
}

export class AnalysisAPIClient {
  private baseURL: string;
  private sessionId: string;
  private timeout: number;

  constructor(config: AnalysisAPIClientConfig) {
    this.baseURL = config.baseURL;
    this.sessionId = config.sessionId;
    this.timeout = config.timeout ?? 30000;
  }

  async getPriorityIssues(params: {
    limit?: number;
    severity?: string[];
    category?: string[];
    scope?: string;
  }): Promise<any> {
    const url = new URL('/v2/analysis/priority', this.baseURL);
    url.searchParams.set('limit', String(params.limit || 10));

    if (params.severity) {
      params.severity.forEach(s => url.searchParams.append('severity[]', s));
    }
    if (params.category) {
      params.category.forEach(c => url.searchParams.append('category[]', c));
    }
    if (params.scope) {
      url.searchParams.set('scope', params.scope);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'X-Session-ID': this.sessionId,
      },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}
```

**File:** `repos/metabob-mcp/src/index.ts`

```typescript
/**
 * metabob-mcp - MCP Server Entry Point
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GetPriorityIssuesTool, handleGetPriorityIssues, GetPriorityIssuesInputSchema } from './tools/get-priority-issues.js';
import { AnalysisAPIClient } from './api-client.js';

// Configuration
const API_URL = process.env.ANALYSIS_API_URL || 'http://localhost:8080';
const SESSION_ID = process.env.SESSION_ID || 'default-session';

// Create MCP server
const server = new Server(
  {
    name: 'metabob-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Create API client
const apiClient = new AnalysisAPIClient({
  baseURL: API_URL,
  sessionId: SESSION_ID,
});

// Register tools
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      GetPriorityIssuesTool,
      // TODO: Add 6 more tools
    ],
  };
});

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_priority_issues') {
    const input = GetPriorityIssuesInputSchema.parse(args);
    const result = await handleGetPriorityIssues(input, apiClient);
    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('metabob-mcp server started');
```

---

## Testing Your Implementation

### 1. Test CPG Service Directly

```typescript
// test-cpg-service.ts
import { CPGService } from './src/services/cpg-service.js';

const service = new CPGService();

// Add files
await service.addFiles('test-session', {
  'src/auth.ts': `
    export function login(user: string) {
      return authenticate(user);
    }
  `,
  'src/session.ts': `
    export function authenticate(user: string) {
      return createSession(user);
    }
  `,
});

// Predict co-changes
const predictions = await service.predictCochanges(
  'test-session',
  ['src/auth.ts::function::login::2']
);

console.log('Predictions:', predictions);

// Analyze impact
const impact = await service.analyzeImpact(
  'test-session',
  ['src/auth.ts::function::login::2'],
  3
);

console.log('Impact:', impact);
```

Run: `bun run test-cpg-service.ts`

### 2. Test Analysis API Endpoint

```bash
# Start server
cd repos/metabob-analysis-api
bun run src/index.ts

# Test endpoint
curl -H "X-Session-ID: test-session" \
  "http://localhost:8080/v2/analysis/priority?limit=5&severity[]=CRITICAL"
```

### 3. Test MCP Server

```bash
# Start MCP server
cd repos/metabob-mcp
export ANALYSIS_API_URL=http://localhost:8080
export SESSION_ID=test-session
bun run src/index.ts

# Test with MCP inspector (if available)
# Or write a test client:
```

```typescript
// test-mcp-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({
  name: 'test-client',
  version: '0.1.0',
}, {
  capabilities: {},
});

// Connect to MCP server
const transport = new StdioClientTransport({
  command: 'bun',
  args: ['run', 'src/index.ts'],
  cwd: process.cwd(),
});

await client.connect(transport);

// List tools
const tools = await client.listTools();
console.log('Tools:', tools);

// Call tool
const result = await client.callTool({
  name: 'get_priority_issues',
  arguments: {
    limit: 5,
    severity: ['CRITICAL'],
  },
});

console.log('Result:', result);
```

---

## Next Steps

### Week 1: Foundation
- [x] Define shared types
- [x] Create Zod schemas
- [x] Implement CPGService
- [ ] Implement first endpoint (priority issues)
- [ ] Test with CPG library

### Week 2: Core Endpoints
- [ ] Implement search endpoint
- [ ] Implement annotations endpoint
- [ ] Implement co-change suggestions
- [ ] Implement impact analysis
- [ ] Add SurrealDB integration

### Week 3: Advanced Features
- [ ] Implement problem completion
- [ ] Implement spec generation
- [ ] Add online learning service
- [ ] Add pattern detection

### Week 4: MCP Integration
- [ ] Implement all 7 MCP tools
- [ ] Add error handling
- [ ] Add rate limiting
- [ ] Add session management

### Week 5: Testing & Deployment
- [ ] Write integration tests
- [ ] Performance testing
- [ ] Deploy to Kubernetes
- [ ] Test with Claude Desktop

---

## Troubleshooting

### CPG Library Import Issues

If you get import errors:

```bash
# Ensure cpg-inference-ts is built
cd repos/cpg-inference-ts
bun install
bun run build

# Link as workspace dependency
cd repos/metabob-analysis-api
bun install
```

### Type Errors

If TypeScript complains about CPG types:

```typescript
// Add type assertions where needed
const node = cpg.getNode(id) as CPGNode & { filePath: string };
```

### MCP Connection Issues

If MCP server won't connect:

```bash
# Check server logs
export MCP_LOG_LEVEL=debug
bun run src/index.ts

# Test with simple request
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | bun run src/index.ts
```

---

## Reference Files

- **Contract Definition**: `ANALYSIS_API_MCP_CONTRACTS.md`
- **CPG Library**: `repos/cpg-inference-ts/`
- **Analysis API Design**: `openspec/changes/metabob-analysis-api/design.md`
- **MCP Proposal**: `openspec/changes/metabob-mcp/proposal.md`
