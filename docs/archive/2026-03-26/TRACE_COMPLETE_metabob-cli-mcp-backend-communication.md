# Trace Complete: metabob-cli-mcp-backend-communication

**Status**: ✅ COMPLETE  
**Activity**: trace-data-flow-single-feature  
**Duration**: 1398.7 seconds (~23 minutes)  
**Cost**: $2.34  
**Date**: 2026-03-03

---

## Executive Summary

### Root Cause Identified

**Silent configuration failure at `callMCPTool` (metabob.ts:265-271)**

When `mcp.metabob` is missing from `opencode.json`, `callMCPTool` returns `undefined` instead of throwing an exception. This causes:

1. ❌ **No HTTP traffic** to rpc-api backend
2. ❌ **Silent fallback** to bootstrap templates  
3. ❌ **No user notification** that backend communication failed
4. ❌ **Missing org-specific** learned templates

### Impact

**BLOCKING SEVERITY**: Entire learning loop, distributed execution, and template library sync **completely non-functional** due to this single silent failure.

---

## Data Flow Analysis

### Complete Flow (10 Components)

```
LLM Tool Call
  ↓
SearchActivitiesTool (Entry)
  ↓
TemplateRepository (Facade)
  ↓
TemplateLoader (Backend Selection)
  ↓
TemplateServiceClient (Metabob Proxy)
  ↓
MetabobCLI (MCP Wrapper)
  ↓
callMCPTool (MCP Client) ⚠️ BREAKS HERE
  ↓
MCP Client (JSON-RPC)
  ↓
search_activities_tool (Python MCP Handler)
  ↓
ActivityManager (HTTP Client)
  ↓
Backend API (FastAPI)
  ↓
Redis (Storage)
```

### Failure Point

**Component**: `callMCPTool` (repos/metabob-opencode/packages/opencode/src/util/metabob.ts:265-271)

**Code**:
```typescript
const metabobClient = clients["metabob"]
if (!metabobClient) {
  log.debug("metabob mcp client not available")
  return undefined  // ❌ SILENT FAILURE - BLOCKS ALL HTTP TRAFFIC
}
```

**Why This Breaks Everything**:
- Returns `undefined` instead of throwing
- Caller (TemplateLoader) interprets as "no results from backend"
- Falls back to bootstrap templates silently
- User never knows backend is unreachable

---

## Components Analyzed (7 Critical)

### 1. SearchActivitiesTool (Entry Point)
**File**: repos/metabob-opencode/packages/opencode/src/tool/search-activities.ts:27  
**Current**: Silently falls back to bootstrap templates  
**Desired**: Should notify user when backend communication fails  
**Gap**: No error indication to user

### 2. callMCPTool (Configuration Boundary) ⚠️ BLOCKING
**File**: repos/metabob-opencode/packages/opencode/src/util/metabob.ts:265-271  
**Current**: Returns undefined when mcp.metabob client not found  
**Desired**: Should throw MCPClientNotFoundError with clear message  
**Gap**: **ROOT CAUSE** - Prevents all HTTP traffic to backend

### 3. TemplateLoader (Fallback Chain)
**File**: repos/metabob-opencode/packages/opencode/src/server/template-loader.ts  
**Current**: Catches undefined and falls back to bootstrap  
**Desired**: Should distinguish config errors from network errors  
**Gap**: No error propagation about missing configuration

### 4. TemplateServiceClient (N+1 Query)
**File**: repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts:190-202  
**Current**: Makes N+1 HTTP calls (1 search + 20 getActivity)  
**Desired**: Should use batch API or include_full parameter  
**Gap**: 2-5 second latency vs 200-500ms

### 5. search_activities_tool (Process Boundary)
**File**: repos/metabob-cli/src/metabob_cli/mcp/tools.py:3512  
**Current**: Reads config, calls ActivityManager  
**Desired**: Should validate base_url and test connectivity  
**Gap**: No validation that base_url is reachable

### 6. ActivityManager (HTTP Client)
**File**: repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:164  
**Current**: Returns [] on 401 (silent auth failure)  
**Desired**: Should throw AuthenticationError on 401  
**Gap**: User doesn't know auth failed, sees only global templates

### 7. list_activity_templates (Exit Point)
**File**: repos/metabob-rpc-api/server/routes/activity.py:72  
**Current**: O(N) Redis SCAN + GET, no indexes  
**Desired**: Should use SurrealDB with indexes  
**Gap**: Performance degrades with scale

---

## Critical Issues (23 Total)

### BLOCKING (3 Issues)

#### Issue #1: Silent Configuration Failure ⚠️⚠️⚠️
- **Location**: metabob.ts:265-271
- **Impact**: Prevents ALL HTTP traffic to backend
- **Fix**: Throw MCPClientNotFoundError instead of returning undefined
- **Priority**: IMMEDIATE

#### Issue #2: Silent Authentication Failure
- **Location**: activity_manager.py:202-244
- **Impact**: User sees only global templates, missing org templates
- **Fix**: Throw AuthenticationError on 401 instead of returning []
- **Priority**: HIGH

#### Issue #3: N+1 Query Problem
- **Location**: template-service-client.ts:190-202
- **Impact**: 2-5 second latency for 20 templates
- **Fix**: Add include_full=true parameter to backend API
- **Priority**: HIGH

### HIGH Priority (5 Issues)
- Missing input validation
- No timeout on JSON-RPC calls
- Hardcoded magic strings
- No retry logic
- Overly broad exception handling

### MEDIUM Priority (11 Issues)
- Technical debt items (connection pooling, rate limiting, etc.)

### LOW Priority (4 Issues)
- Naming conventions, comments, tests, metrics

---

## Expected vs Actual Behavior

### Expected Behavior
- ✅ GET /v2/activities/templates should show in rpc-api logs
- ✅ POST /v2/submit should establish WebSocket connection
- ✅ POST /v2/execution_results should update metrics in SurrealDB
- ✅ Backend API should persist impulses in SurrealDB
- ✅ All requests should use Bearer token authentication

### Actual Behavior
- ❌ NO HTTP requests reach rpc-api from metabob-cli MCP
- ❌ Falls back to bootstrap templates without user notification
- ❌ mcp.metabob section likely missing from opencode.json

---

## Validation Strategy

### Step 1: Check Configuration
```bash
cat ~/.config/opencode/opencode.json | jq '.mcp.metabob'
# Should show: { "type": "local", "command": [...], "enabled": true }
```

### Step 2: Verify MCP Server
```bash
ps aux | grep "metabob_cli.mcp.server"
# Should show running process
```

### Step 3: Monitor Backend Logs
```bash
kubectl logs -f deployment/metabob-rpc-api | grep "GET /v2/activities/templates"
# Should show incoming requests when OpenCode runs
```

### Step 4: Test Backend Directly
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/v2/activities/templates
# Should return templates JSON
```

---

## Recommendations

### Phase 1: Immediate Fixes (1-3 days) 🔴 CRITICAL

1. **Fix callMCPTool silent failure**:
```typescript
const metabobClient = clients["metabob"]
if (!metabobClient) {
  throw new MCPClientNotFoundError(
    'MCP client "metabob" not configured. Add mcp.metabob to opencode.json'
  )
}
```

2. **Add startup validation**:
```typescript
// In Config.state()
if (config.activity?.backend === "metabob" && !config.mcp?.metabob) {
  throw new Error("Activity backend set to metabob but mcp.metabob not configured")
}
```

3. **Fix authentication failures**:
```python
elif response.status_code == 401:
    raise AuthenticationError(
        "Session token missing or invalid. Run 'opencode login'"
    )
```

### Phase 2: Reliability Improvements (1 week) 🟡 HIGH

4. Add retry logic with exponential backoff
5. Add connection pooling for HTTP clients
6. Add input validation with Zod schemas
7. Use specific exception types

### Phase 3: Performance Optimization (1-2 weeks) 🟢 MEDIUM

8. Fix N+1 query with batch API (include_full=true)
9. Push filtering to backend (reduce client-side overhead)
10. Add caching (5-60 second TTL)

### Phase 4: Long-term Architecture (Ongoing) 🔵 LOW

11. Migrate Redis → SurrealDB with indexes
12. Add distributed tracing (OpenTelemetry)
13. Add health check endpoints
14. Implement circuit breaker pattern

---

## Generated Documentation

### 1. Full Data Flow Diagram
**File**: docs/data-flows/metabob-cli-mcp-backend-communication-flow.md  
**Size**: 945 lines  
**Contents**:
- Complete 10-component flow (mermaid diagrams)
- Data transformations at each boundary
- Architectural boundaries (4 processes)
- Troubleshooting guide
- Reusable patterns

### 2. Component Annotations
**File**: COMPONENT_ANNOTATIONS_metabob-cli-mcp-backend-communication.md  
**Size**: 855 lines  
**Contents**:
- 5 critical components annotated
- WHY each component exists
- Design decisions with trade-offs
- Critical issues with fixes
- Business context

### 3. Code Quality Analysis
**File**: CODE_QUALITY_ANALYSIS_metabob-cli-mcp-backend-communication.md  
**Size**: 311 lines  
**Contents**:
- 23 issues found (8 HIGH, 11 MEDIUM, 4 LOW)
- Root cause analysis
- Recommended fixes with code examples
- Prioritized action plan

---

## Impulse Created

**ID**: trace-metabob-cli-mcp-backend-communication  
**Type**: memo  
**Budget**: 5000 tokens  
**Location**: impulses/trace-metabob-cli-mcp-backend-communication.json  
**Content**: impulses/trace-metabob-cli-mcp-backend-communication.md

### Impulse Metadata
```json
{
  "specificationName": "metabob-cli-mcp-backend-communication",
  "rootCause": "Silent configuration failure at callMCPTool",
  "dataFlow": "LLM → ... → callMCPTool [BREAKS] → ... → Redis",
  "generatedFiles": [
    "docs/data-flows/metabob-cli-mcp-backend-communication-flow.md",
    "COMPONENT_ANNOTATIONS_metabob-cli-mcp-backend-communication.md",
    "CODE_QUALITY_ANALYSIS_metabob-cli-mcp-backend-communication.md"
  ],
  "criticalIssues": [3 blocking issues listed]
}
```

---

## Downstream Usage

This impulse can be used by:

1. **Enforcement Activities**:
   - trace-enforce-validate-loop
   - Use impulse to guide code mutations
   - Verify fixes with validation harness

2. **Validation Harness**:
   - Create test scenarios from expected behavior
   - Monitor HTTP traffic during test runs
   - Verify mcp.metabob configuration

3. **Documentation Updates**:
   - Link from architecture docs
   - Add to troubleshooting guide
   - Include in onboarding materials

4. **Code Reviews**:
   - Reference when reviewing MCP-related PRs
   - Check for similar silent failure patterns
   - Ensure proper error handling

---

## Traceability

### Activity Execution
- **Template**: trace-data-flow-single-feature
- **Execution Time**: 1398.7 seconds
- **Cost**: $2.3408
- **Tokens**: 731,030 input + 7,576 output

### Tasks Completed
1. ✅ Identify entry points (135.0s, $0.27)
2. ✅ Trace dependencies via CPG (151.7s, $0.26)
3. ✅ Document transformations (346.0s, $0.29)
4. ✅ Identify boundaries (189.8s, $0.37)
5. ✅ Check code quality (208.1s, $0.36)
6. ✅ Annotate components (186.9s, $0.37)
7. ✅ Generate documentation (181.2s, $0.42)

### Files Generated
- docs/data-flows/metabob-cli-mcp-backend-communication-flow.md
- COMPONENT_ANNOTATIONS_metabob-cli-mcp-backend-communication.md
- CODE_QUALITY_ANALYSIS_metabob-cli-mcp-backend-communication.md
- impulses/trace-metabob-cli-mcp-backend-communication.json
- impulses/trace-metabob-cli-mcp-backend-communication.md
- TRACE_COMPLETE_metabob-cli-mcp-backend-communication.md (this file)

**Total**: 2,111 lines of comprehensive documentation

---

## Next Steps

1. **IMMEDIATE**: Fix Issue #1 (callMCPTool silent failure)
2. **IMMEDIATE**: Add startup validation for mcp.metabob
3. **HIGH**: Fix Issue #2 (authentication failures)
4. **HIGH**: Create validation harness (verify HTTP traffic)
5. **MEDIUM**: Run trace-enforce-validate-loop activity
6. **LOW**: Address technical debt items

---

## Summary

✅ **Trace Complete**: Identified root cause of "no HTTP traffic" issue  
✅ **Documentation Generated**: 2,111 lines across 6 files  
✅ **Impulse Created**: Available for downstream tasks  
✅ **Action Plan**: Clear priorities and fixes defined  

**Root Cause**: Silent configuration failure in callMCPTool  
**Impact**: BLOCKING - Entire learning loop non-functional  
**Fix**: Throw exception instead of returning undefined  
**Validation**: Monitor rpc-api logs for HTTP traffic  

---

**Generated**: 2026-03-03 by trace-data-flow-single-feature activity
