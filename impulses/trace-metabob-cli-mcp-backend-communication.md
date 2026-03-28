# Trace Analysis: metabob-cli-mcp-backend-communication

## Executive Summary

**Root Cause Identified**: Silent configuration failure at callMCPTool (metabob.ts:265-271)

When mcp.metabob is missing from opencode.json, callMCPTool returns undefined instead of throwing an exception. This causes:
1. No HTTP traffic to rpc-api backend
2. Silent fallback to bootstrap templates
3. User has no indication that backend communication failed

## Components Involved

[
  {
    "file": "repos/metabob-opencode/packages/opencode/src/tool/search-activities.ts",
    "component": "SearchActivitiesTool",
    "currentBehavior": "Silently falls back to bootstrap templates when backend unavailable",
    "desiredBehavior": "Should notify user when backend communication fails",
    "gap": "No error indication to user when fallback occurs"
  },
  {
    "file": "repos/metabob-opencode/packages/opencode/src/util/metabob.ts",
    "component": "callMCPTool",
    "currentBehavior": "Returns undefined when mcp.metabob client not found (line 265-271)",
    "desiredBehavior": "Should throw MCPClientNotFoundError with clear message",
    "gap": "BLOCKING: This is the root cause - prevents all HTTP traffic to backend"
  },
  {
    "file": "repos/metabob-opencode/packages/opencode/src/server/template-loader.ts",
    "component": "TemplateLoader",
    "currentBehavior": "Catches undefined from MetabobCLI and falls back to bootstrap",
    "desiredBehavior": "Should distinguish config errors from network errors",
    "gap": "No error propagation to user about missing configuration"
  },
  {
    "file": "repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts",
    "component": "TemplateServiceClient",
    "currentBehavior": "Makes N+1 HTTP calls (1 search + 20 getActivity calls)",
    "desiredBehavior": "Should use batch API or include_full parameter",
    "gap": "Performance: 2-5 seconds for 20 templates vs 200-500ms"
  },
  {
    "file": "repos/metabob-cli/src/metabob_cli/mcp/tools.py",
    "component": "search_activities_tool",
    "currentBehavior": "Reads config, extracts base_url and session_token, calls ActivityManager",
    "desiredBehavior": "Should validate base_url format and test connectivity",
    "gap": "No validation that base_url is reachable"
  },
  {
    "file": "repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py",
    "component": "ActivityManager.search_activities",
    "currentBehavior": "Returns [] on 401 (silent auth failure, line 202-244)",
    "desiredBehavior": "Should throw AuthenticationError on 401",
    "gap": "User doesn't know auth failed, sees only global templates"
  },
  {
    "file": "repos/metabob-rpc-api/server/routes/activity.py",
    "component": "list_activity_templates",
    "currentBehavior": "O(N) Redis SCAN + GET pattern, no indexes",
    "desiredBehavior": "Should use SurrealDB with indexes for O(1) queries",
    "gap": "Performance degrades with scale (>1000 templates)"
  }
]

## Data Flow

LLM → SearchActivitiesTool → TemplateRepository → TemplateLoader → TemplateServiceClient → MetabobCLI → callMCPTool → [BREAKS HERE if mcp.metabob missing] → MCP Client → JSON-RPC → search_activities_tool → ActivityManager → HTTP GET → Backend API → Redis

### Where Communication Breaks
- **Entry Point**: LLM calls search_activities tool
- **Failure Point**: callMCPTool returns undefined when mcp.metabob client not found (line 265-271)
- **Fallback**: TemplateLoader falls back to bootstrap templates
- **User Impact**: Appears to work but missing org-specific learned templates

## Critical Issues


### BLOCKING: Silent configuration failure
- **Location**: metabob.ts:265-271
- **Impact**: Prevents all HTTP traffic to backend
- **Fix**: Throw MCPClientNotFoundError instead of returning undefined


### HIGH: Silent authentication failure
- **Location**: activity_manager.py:202-244
- **Impact**: User sees only global templates, missing org templates
- **Fix**: Throw AuthenticationError on 401 instead of returning []


### HIGH: N+1 query problem
- **Location**: template-service-client.ts:190-202
- **Impact**: 2-5 second latency for 20 templates
- **Fix**: Add include_full=true parameter to backend API


## Expected vs Actual Behavior

### Expected Behavior
- activityTemplateQuery: GET /v2/activities/templates should show in rpc-api logs
- activitySubmission: POST /v2/submit should establish WebSocket connection
- learningLoopUpdate: POST /v2/execution_results should update metrics in SurrealDB
- impulseStorage: Backend API should persist impulses in SurrealDB
- authentication: All requests should use Bearer token from session

### Actual Behavior  
- noHttpTraffic: NO HTTP requests reach rpc-api from metabob-cli MCP
- silentFallback: Falls back to bootstrap templates without user notification
- missingConfig: mcp.metabob section likely missing from opencode.json

## Validation Strategy

- **step1**: Check mcp.metabob exists in opencode.json
- **step2**: Verify MCP server process running
- **step3**: Monitor rpc-api logs for HTTP GET /v2/activities/templates
- **step4**: Test with: curl -H 'Authorization: Bearer TOKEN' http://localhost:8080/v2/activities/templates

## Detailed Analysis Files

### 1. Full Data Flow Documentation
Location: docs/data-flows/metabob-cli-mcp-backend-communication-flow.md

Contains:
- Complete 10-component flow diagram (mermaid)
- Data transformations at each boundary
- Architectural boundaries (4 processes)
- Troubleshooting guide
- Reusable patterns extracted

Key findings:
- 10 components from LLM to Redis
- 4 process boundaries (TypeScript → Python → Backend → Redis)
- 8 data transformations
- N+1 query problem causes 21 HTTP requests per search

### 2. Component Annotations
Location: COMPONENT_ANNOTATIONS_metabob-cli-mcp-backend-communication.md

Annotated 5 critical components:
1. SearchActivitiesTool (Entry) - Token optimization, silent fallback
2. callMCPTool (Config Boundary) - ROOT CAUSE of no HTTP traffic
3. search_activities_tool (Process Boundary) - Config extraction, JSON-RPC
4. ActivityManager.search_activities (Service Integration) - HTTP client, proto mapping
5. list_activity_templates (Exit) - Redis queries, multi-tenant isolation

### 3. Code Quality Analysis
Location: CODE_QUALITY_ANALYSIS_metabob-cli-mcp-backend-communication.md

Found 23 issues:
- 8 HIGH priority (blocking or critical)
- 11 MEDIUM priority (technical debt)
- 4 LOW priority (maintainability)

Top 3 blocking issues:
1. Silent configuration failure (callMCPTool) - BLOCKS HTTP traffic
2. Silent authentication failure (ActivityManager) - Missing org templates
3. N+1 query problem (TemplateServiceClient) - 2-5 second latency

## Recommendations

### Immediate Fixes (1-3 days)
1. **Fix callMCPTool**: Throw MCPClientNotFoundError instead of returning undefined
2. **Add startup validation**: Check mcp.metabob exists in opencode.json
3. **Fix auth failures**: Throw AuthenticationError on 401 instead of returning []

### Short-term Improvements (1 week)
4. Add retry logic with exponential backoff
5. Add connection pooling for HTTP clients
6. Add input validation with Zod schemas
7. Use specific exception types (not catch-all)

### Long-term Architecture (1-2 weeks)
8. Fix N+1 query with batch API (include_full=true parameter)
9. Migrate Redis to SurrealDB with indexes (O(1) queries)
10. Add distributed tracing (OpenTelemetry)
11. Add health check endpoints
12. Add circuit breaker pattern

## Traceability

**Generated By**: trace-data-flow-single-feature activity template
**Execution Time**: 1398.7 seconds
**Cost**: $2.34
**Tokens**: 731,030 input + 7,576 output

**Files Generated**:
- docs/data-flows/metabob-cli-mcp-backend-communication-flow.md (945 lines)
- COMPONENT_ANNOTATIONS_metabob-cli-mcp-backend-communication.md (855 lines)
- CODE_QUALITY_ANALYSIS_metabob-cli-mcp-backend-communication.md (311 lines)

**Total Documentation**: 2,111 lines covering complete data flow
