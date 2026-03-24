# metabob-mcp - Implementation Tasks

**Status:** Draft
**Created:** 2026-03-23
**Last Updated:** 2026-03-23

---

## Overview

This document outlines the implementation tasks for the MCP server that exposes Metabob analysis capabilities to AI agents (Claude, Cursor, etc.).

**Total Tasks:** 10
**Estimated Timeline:** ~5 days (31 hours)
**Dependencies:** Requires `metabob-analysis-api` to be complete

---

## Task Organization

Tasks are ordered by dependency and grouped by component. Each task includes:
- **ID:** Unique identifier (MCP-X)
- **Depends On:** Prerequisites (by task ID or external)
- **Estimate:** Rough time estimate
- **Acceptance Criteria:** How to verify completion

---

## Phase 5: MCP Server Implementation

### MCP-1: Project Setup and Dependencies
**Depends On:** External: metabob-analysis-api complete
**Estimate:** 2 hours

**Description:**
Set up TypeScript/Bun project with MCP SDK and required dependencies.

**Acceptance Criteria:**
- [ ] `repos/metabob-mcp/` directory created with standard structure
- [ ] `package.json` includes required dependencies:
  - `@modelcontextprotocol/sdk` (MCP server framework)
  - `zod` (schema validation)
  - Development dependencies (Bun, TypeScript, testing)
- [ ] `tsconfig.json` configured with strict mode
- [ ] `src/index.ts` with basic MCP server initialization
- [ ] `bun run start` launches MCP server without errors
- [ ] MCP initialization successful (logs "MCP server ready")
- [ ] `bun test` runs without errors (even with no tests)
- [ ] `bun run typecheck` passes

**Directory Structure:**
```
repos/metabob-mcp/
├── src/
│   ├── index.ts           # MCP server entry point
│   ├── tools/             # MCP tool implementations
│   ├── api-client.ts      # HTTP client for analysis API
│   └── session-manager.ts # Session context management
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
└── README.md
```

---

### MCP-2: API Client Implementation
**Depends On:** MCP-1
**Estimate:** 4 hours

**Description:**
HTTP client for communicating with metabob-analysis-api with error handling and retry logic.

**Acceptance Criteria:**
- [ ] `src/api-client.ts` created with `AnalysisAPIClient` class
- [ ] `post<T>(endpoint, body)`: HTTP POST with JSON serialization
- [ ] `get<T>(endpoint, params)`: HTTP GET with query parameter encoding
- [ ] `put<T>(endpoint, body)`: HTTP PUT for update operations
- [ ] Error handling: Transform API errors to MCP-compatible error format
- [ ] Timeout configuration: 30s default, configurable per-request
- [ ] Retry logic: 3 attempts with exponential backoff (100ms, 200ms, 400ms)
- [ ] Unit tests with mocked fetch responses
- [ ] Environment variable: `ANALYSIS_API_URL` (default: `http://metabob-analysis-api:8080`)

**Error Transformation Examples:**
```typescript
interface MCPError {
  code: string;           // MCP error code
  message: string;        // Human-readable message
  details?: unknown;      // Additional context
  suggestion?: string;    // How to fix the error
}

// Mapping examples:
// API "SESSION_NOT_FOUND" → MCP "SESSION_EXPIRED"
// API "COMPONENT_NOT_FOUND" → MCP "COMPONENT_NOT_FOUND" + suggestion
// API "RATE_LIMIT_EXCEEDED" → MCP "RATE_LIMIT_EXCEEDED" + retry_after
// API network timeout → MCP "API_TIMEOUT" + suggestion to retry
```

**Key Methods:**
```typescript
class AnalysisAPIClient {
  async post<T>(endpoint: string, body: unknown): Promise<T>;
  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T>;
  async put<T>(endpoint: string, body: unknown): Promise<T>;

  // Error transformation
  private handleError(error: unknown): MCPError;

  // Retry with exponential backoff
  private async retry<T>(fn: () => Promise<T>, attempts: number): Promise<T>;
}
```

---

### MCP-3: Session Manager
**Depends On:** MCP-1
**Estimate:** 3 hours

**Description:**
Manage MCP session context, scope resolution, and usage tracking.

**Acceptance Criteria:**
- [ ] `src/session-manager.ts` created with `SessionManager` class
- [ ] `getSession(sessionId)`: Retrieve or create session context (lazy initialization)
- [ ] `resolveScope(sessionId, scope)`: Map scope ("session", "project", "org") to IDs
- [ ] `trackUsage(sessionId, tool, latency, success)`: Record tool call metrics
- [ ] `cleanupExpiredSessions()`: Remove sessions idle for >1 hour
- [ ] Session caching: In-memory Map with automatic expiry
- [ ] Thread-safe: Handle concurrent access properly
- [ ] Unit tests for session lifecycle

**Session Context Structure:**
```typescript
interface SessionContext {
  sessionId: string;
  projectId?: string;      // Resolved from API
  orgId?: string;          // Resolved from API
  createdAt: Date;
  lastAccessedAt: Date;
  usageStats: {
    toolCalls: number;
    totalLatency: number;
    errors: number;
  };
}
```

**Scope Resolution:**
```typescript
// scope: "session" → Use sessionId only
// scope: "project" → Resolve sessionId → projectId
// scope: "org" → Resolve sessionId → projectId → orgId
async resolveScope(sessionId: string, scope: 'session' | 'project' | 'org'): Promise<{
  sessionId: string;
  projectId?: string;
  orgId?: string;
}>;
```

---

### MCP-4: Core Tool Implementations (Part 1)
**Depends On:** MCP-2, MCP-3
**Estimate:** 8 hours

**Description:**
Implement first 4 MCP tools with validation and error handling.

**Acceptance Criteria:**
- [ ] `src/tools/get-priority-issues.ts` created
  - Maps to: `GET /v2/analysis/priority`
  - Params: `limit`, `severity[]`, `category[]`, `scope`
  - Returns: List of prioritized issues
- [ ] `src/tools/search-codebase.ts` created
  - Maps to: `POST /v2/analysis/search`
  - Params: `query`, `limit`, `scope`, `file_pattern`, `severity[]`
  - Returns: Semantic search results
- [ ] `src/tools/annotate-component.ts` created
  - Maps to: `POST /v2/analysis/annotations`
  - Params: `component_id`, `content`, `type`, `tags[]`, `problem_id?`
  - Returns: Created annotation
- [ ] `src/tools/mark-problem-complete.ts` created
  - Maps to: `PUT /v2/analysis/problems/:id/complete`
  - Params: `problem_id`, `resolution_summary`, `fixed_in_commit`, `create_annotation`
  - Returns: Updated problem + auto-annotation
- [ ] Each tool includes:
  - Zod schema for parameter validation
  - Error handling with helpful messages
  - Session context injection
  - Response transformation to MCP format
- [ ] `src/tools/index.ts` exports tool registry
- [ ] Unit tests for each tool (mocked API client)

**Tool Structure Template:**
```typescript
// src/tools/get-priority-issues.ts
import { z } from 'zod';
import type { AnalysisAPIClient } from '../api-client';
import type { SessionManager } from '../session-manager';

// Input validation schema
export const GetPriorityIssuesSchema = z.object({
  limit: z.number().int().positive().max(100).default(10),
  severity: z.array(z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])).optional(),
  category: z.array(z.string()).optional(),
  scope: z.enum(['session', 'project', 'org']).default('session'),
});

export type GetPriorityIssuesParams = z.infer<typeof GetPriorityIssuesSchema>;

export interface GetPriorityIssuesResult {
  issues: Array<{
    problem_id: string;
    component_id: string;
    severity: string;
    category: string;
    description: string;
    priority_rank: number;
    impact_score: number;
  }>;
  total_count: number;
}

export async function getPriorityIssues(
  params: GetPriorityIssuesParams,
  context: {
    sessionId: string;
    apiClient: AnalysisAPIClient;
    sessionManager: SessionManager;
  }
): Promise<GetPriorityIssuesResult> {
  // 1. Resolve scope
  const scope = await context.sessionManager.resolveScope(context.sessionId, params.scope);

  // 2. Call API
  const response = await context.apiClient.get('/v2/analysis/priority', {
    ...params,
    session_id: scope.sessionId,
    project_id: scope.projectId,
    org_id: scope.orgId,
  });

  // 3. Track usage
  await context.sessionManager.trackUsage(context.sessionId, 'get_priority_issues', Date.now(), true);

  // 4. Transform response
  return transformToMCPFormat(response);
}
```

**Tool Registry:**
```typescript
// src/tools/index.ts
export const TOOL_REGISTRY = {
  get_priority_issues: {
    name: 'get_priority_issues',
    description: 'Fetch high-priority analysis issues for current codebase',
    schema: GetPriorityIssuesSchema,
    handler: getPriorityIssues,
  },
  // ... other tools
};
```

---

### MCP-5: Advanced Tool Implementations (Part 2)
**Depends On:** MCP-4
**Estimate:** 8 hours

**Description:**
Implement remaining 3 MCP tools (most complex).

**Acceptance Criteria:**
- [ ] `src/tools/suggest-related-changes.ts` created
  - Maps to: `POST /v2/analysis/cochange/suggest`
  - Params: `changed_files[]`, `files[]`, `top_k`, `threshold`
  - Returns: Co-change predictions with hybrid scores
- [ ] `src/tools/analyze-change-impact.ts` created
  - Maps to: `POST /v2/analysis/impact`
  - Params: `changed_files[]`, `diff?`, `max_depth`, `direction`
  - Returns: Impact analysis with risk levels
- [ ] `src/tools/generate-implementation-spec.ts` created
  - Maps to: `POST /v2/analysis/specs/generate`
  - Params: `goal`, `entry_points?`, `context?`
  - Returns: Implementation specification
- [ ] Error handling for large responses (spec generation can exceed 100KB)
- [ ] Streaming support for `generate-implementation-spec` (optional)
- [ ] Response truncation with warning if payload too large
- [ ] Unit tests for each tool

**Large Response Handling:**
```typescript
// If response exceeds 100KB, truncate and add warning
function handleLargeResponse(data: unknown): {
  data: unknown;
  truncated: boolean;
  warning?: string;
} {
  const json = JSON.stringify(data);
  const MAX_SIZE = 100 * 1024; // 100KB

  if (json.length <= MAX_SIZE) {
    return { data, truncated: false };
  }

  return {
    data: JSON.parse(json.slice(0, MAX_SIZE)),
    truncated: true,
    warning: `Response truncated (${json.length} bytes → ${MAX_SIZE} bytes). Use more specific parameters.`,
  };
}
```

---

### MCP-6: MCP Server Integration
**Depends On:** MCP-5
**Estimate:** 3 hours

**Description:**
Wire up all tools to MCP server with proper lifecycle management.

**Acceptance Criteria:**
- [ ] `src/index.ts` registers all 7 tools with MCP server
- [ ] Tool discovery works (MCP client can list tools)
- [ ] Tool execution routes to correct handler
- [ ] Server lifecycle hooks:
  - `onStart`: Initialize API client, session manager
  - `onStop`: Cleanup sessions, close connections
  - `onError`: Log errors, send notifications
- [ ] Graceful shutdown on SIGTERM/SIGINT
- [ ] Health check endpoint (non-MCP, for Kubernetes)
- [ ] Structured logging (JSON format)
- [ ] Environment variable configuration:
  - `ANALYSIS_API_URL`
  - `LOG_LEVEL` (DEBUG, INFO, WARN, ERROR)
  - `SESSION_TIMEOUT_MS` (default: 3600000)
  - `MAX_CONCURRENT_REQUESTS` (default: 100)

**Server Initialization:**
```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server';
import { TOOL_REGISTRY } from './tools';
import { AnalysisAPIClient } from './api-client';
import { SessionManager } from './session-manager';

const apiClient = new AnalysisAPIClient({
  baseUrl: process.env.ANALYSIS_API_URL || 'http://metabob-analysis-api:8080',
  timeout: 30000,
  retryAttempts: 3,
});

const sessionManager = new SessionManager({
  timeoutMs: Number(process.env.SESSION_TIMEOUT_MS) || 3600000,
});

const server = new Server({
  name: 'metabob-analysis',
  version: '1.0.0',
});

// Register all tools
for (const [name, tool] of Object.entries(TOOL_REGISTRY)) {
  server.registerTool({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.schema,
    handler: async (params) => {
      const validated = tool.schema.parse(params);
      return tool.handler(validated, {
        sessionId: params.sessionId,
        apiClient,
        sessionManager,
      });
    },
  });
}

// Start server
await server.listen();
```

---

### MCP-7: Error Handling and Rate Limiting
**Depends On:** MCP-6
**Estimate:** 2 hours

**Description:**
Implement comprehensive error handling and rate limiting.

**Acceptance Criteria:**
- [ ] Global error handler catches all exceptions
- [ ] Error responses include:
  - MCP-standard error codes
  - Human-readable messages
  - Actionable suggestions
  - Request ID for debugging
- [ ] Rate limiting:
  - Per-session: 60 requests/minute
  - Per-tool: Configurable limits
  - Graceful degradation (429 Too Many Requests)
- [ ] Circuit breaker for API failures (open after 5 consecutive errors)
- [ ] Error logging with context (session ID, tool name, params)
- [ ] Unit tests for error scenarios

**Error Handler:**
```typescript
class MCPErrorHandler {
  handle(error: unknown, context: ErrorContext): MCPError {
    // Transform known error types
    if (error instanceof APIError) {
      return this.transformAPIError(error);
    }

    if (error instanceof ZodError) {
      return {
        code: 'INVALID_PARAMS',
        message: 'Invalid tool parameters',
        details: error.errors,
        suggestion: 'Check parameter types and constraints',
      };
    }

    // Log unexpected errors
    logger.error('Unexpected error', { error, context });

    return {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: { requestId: context.requestId },
      suggestion: 'Contact support with request ID',
    };
  }
}
```

**Rate Limiter:**
```typescript
class RateLimiter {
  private requests = new Map<string, number[]>();

  async checkLimit(sessionId: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const key = sessionId;
    const timestamps = this.requests.get(key) || [];

    // Remove old timestamps
    const recent = timestamps.filter(t => now - t < windowMs);

    if (recent.length >= limit) {
      return false; // Rate limit exceeded
    }

    recent.push(now);
    this.requests.set(key, recent);
    return true;
  }
}
```

---

### MCP-8: Integration Tests
**Depends On:** MCP-7
**Estimate:** 6 hours

**Description:**
End-to-end tests for MCP server → API → Database flow.

**Acceptance Criteria:**
- [ ] `tests/integration/mcp-e2e.test.ts` created
- [ ] Test setup: Mock API server with fixture data
- [ ] Test: Initialize MCP server → List tools → Verify 7 tools registered
- [ ] Test: Call `get_priority_issues` → Verify response format
- [ ] Test: Call `search_codebase` → Verify semantic search results
- [ ] Test: Call `annotate_component` → Verify annotation created
- [ ] Test: Call `suggest_related_changes` → Verify co-change predictions
- [ ] Test: Call `analyze_change_impact` → Verify impact analysis
- [ ] Test: Call `generate_implementation_spec` → Verify spec structure
- [ ] Test: Call `mark_problem_complete` → Verify problem updated
- [ ] Test: Error handling (invalid session, component not found, rate limit)
- [ ] Test: Session scope resolution (session/project/org)
- [ ] Test: Rate limiting (exceed 60 req/min)
- [ ] All tests pass
- [ ] Coverage >80% for all source files

**Integration Test Example:**
```typescript
import { MCPClient } from '@modelcontextprotocol/sdk/client';
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

describe('MCP E2E Tests', () => {
  let client: MCPClient;
  let mockApiServer: MockServer;

  beforeAll(async () => {
    // Start mock API server with fixture data
    mockApiServer = await startMockAPI();

    // Connect MCP client to server
    client = new MCPClient({
      serverUrl: 'stdio://bun run src/index.ts',
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
    await mockApiServer.stop();
  });

  test('list tools returns all 7 tools', async () => {
    const tools = await client.listTools();
    expect(tools).toHaveLength(7);
    expect(tools.map(t => t.name)).toEqual([
      'get_priority_issues',
      'search_codebase_issues',
      'annotate_component',
      'suggest_related_changes',
      'analyze_change_impact',
      'mark_problem_complete',
      'generate_implementation_spec',
    ]);
  });

  test('get_priority_issues returns prioritized issues', async () => {
    const result = await client.callTool('get_priority_issues', {
      limit: 5,
      severity: ['HIGH'],
      scope: 'session',
    });

    expect(result.issues).toHaveLength(5);
    expect(result.issues[0].severity).toBe('HIGH');
    expect(result.issues[0].priority_rank).toBe(1);
  });

  test('rate limiting works', async () => {
    // Make 61 requests rapidly
    const promises = Array(61).fill(null).map(() =>
      client.callTool('get_priority_issues', { limit: 1 })
    );

    const results = await Promise.allSettled(promises);
    const rateLimitErrors = results.filter(r =>
      r.status === 'rejected' && r.reason.code === 'RATE_LIMIT_EXCEEDED'
    );

    expect(rateLimitErrors.length).toBeGreaterThan(0);
  });

  test('error handling for invalid component', async () => {
    await expect(
      client.callTool('annotate_component', {
        component_id: 'nonexistent',
        content: 'test',
        type: 'documentation',
      })
    ).rejects.toMatchObject({
      code: 'COMPONENT_NOT_FOUND',
      suggestion: expect.stringContaining('search_codebase_issues'),
    });
  });
});
```

---

### MCP-9: Documentation
**Depends On:** MCP-8
**Estimate:** 3 hours

**Description:**
Complete README and usage documentation.

**Acceptance Criteria:**
- [ ] `README.md` includes:
  - Overview of MCP server purpose
  - Installation instructions
  - Configuration (environment variables)
  - Tool reference (all 7 tools with examples)
  - Error codes and troubleshooting
  - Integration with Claude Desktop/Cursor
- [ ] Tool examples for each of the 7 tools
- [ ] Error handling guide
- [ ] Performance characteristics (latency targets)
- [ ] `CLAUDE.md` usage instructions for AI agents
- [ ] JSDoc comments on all public APIs

**README Structure:**
```markdown
# metabob-mcp

MCP server exposing Metabob analysis capabilities to AI agents.

## Installation

```bash
bun install
bun run build
```

## Configuration

Environment variables:
- `ANALYSIS_API_URL`: Backend API URL (default: http://metabob-analysis-api:8080)
- `LOG_LEVEL`: Logging level (DEBUG, INFO, WARN, ERROR)
- `SESSION_TIMEOUT_MS`: Session expiry (default: 3600000)

## Tools

### 1. get_priority_issues
Fetch high-priority analysis issues for current codebase.

**Parameters:**
- `limit` (number): Max issues to return (default: 10, max: 100)
- `severity` (string[]): Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)
- `category` (string[]): Filter by category (optional)
- `scope` (string): Analysis scope (session, project, org)

**Example:**
```json
{
  "limit": 5,
  "severity": ["HIGH", "CRITICAL"],
  "scope": "project"
}
```

**Response:**
```json
{
  "issues": [
    {
      "problem_id": "prob_123",
      "component_id": "comp_456",
      "severity": "HIGH",
      "category": "security",
      "description": "SQL injection vulnerability",
      "priority_rank": 1,
      "impact_score": 0.95
    }
  ],
  "total_count": 5
}
```

[... similar for all 7 tools ...]
```

---

### MCP-10: Deployment Integration
**Depends On:** MCP-9
**Estimate:** 2 hours

**Description:**
Prepare for deployment alongside metabob-analysis-api.

**Acceptance Criteria:**
- [ ] `Dockerfile` created (multi-stage build)
- [ ] Docker image builds successfully
- [ ] Image size <200MB
- [ ] Health check endpoint works in container
- [ ] Documentation updated with deployment steps
- [ ] Helm chart values documented (if applicable)
- [ ] Test deployment to local Kubernetes

**Dockerfile:**
```dockerfile
FROM oven/bun:1 as build
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build
COPY . .
RUN bun build src/index.ts --target bun --outdir dist

# Production image
FROM oven/bun:1-slim
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

# Health check (non-MCP endpoint for k8s probes)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD bun run healthcheck || exit 1

# Run MCP server
CMD ["bun", "run", "dist/index.js"]
```

**Health Check Script:**
```typescript
// healthcheck.ts
import { AnalysisAPIClient } from './api-client';

const client = new AnalysisAPIClient();

try {
  await client.get('/health');
  console.log('OK');
  process.exit(0);
} catch (error) {
  console.error('FAIL', error);
  process.exit(1);
}
```

---

## Summary

**Total Tasks:** 10
**Estimated Timeline:** ~31 hours (~5 days)

**Breakdown:**
- Setup and Infrastructure: 3 tasks (~9 hours)
  - MCP-1: Project setup (2h)
  - MCP-2: API client (4h)
  - MCP-3: Session manager (3h)
- Tool Implementation: 2 tasks (~16 hours)
  - MCP-4: Core tools (8h)
  - MCP-5: Advanced tools (8h)
- Integration and Quality: 5 tasks (~6 hours)
  - MCP-6: Server integration (3h)
  - MCP-7: Error handling (2h)
  - MCP-8: Integration tests (6h)
  - MCP-9: Documentation (3h)
  - MCP-10: Deployment (2h)

**Critical Path:**
MCP-1 → MCP-2 → MCP-4 → MCP-5 → MCP-6 → MCP-7 → MCP-8 → MCP-10

**Parallelization:**
- MCP-2 and MCP-3 can run in parallel after MCP-1
- MCP-9 can start as soon as MCP-6 is complete (parallel with MCP-7, MCP-8)

**Dependencies:**
- **External Blocker:** metabob-analysis-api must be complete and deployed
- **Required:** All 7 API endpoints must be working (see metabob-analysis-api tasks)

**Testing Strategy:**
1. Unit tests: Each tool handler tested independently (mocked API)
2. Integration tests: E2E flow with mock API server
3. Manual tests: Against real API in development cluster

**Success Metrics:**
- All 7 tools registered and discoverable
- Tool call latency: API latency + <50ms overhead
- Error rate: <1% for valid requests
- Test coverage: >80% for all source files
