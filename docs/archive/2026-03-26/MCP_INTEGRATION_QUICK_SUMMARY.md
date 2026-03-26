# MCP Integration Test - Quick Summary

**Date:** 2026-03-24
**Status:** ⚠️ PARTIAL SUCCESS (5/9 endpoints working)

---

## Test Results at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                     Test Results Summary                    │
├─────────────────────────────────────────────────────────────┤
│  ✅ API Deployment               │ PASS                     │
│  ✅ API Health Check              │ PASS (18ms)              │
│  ✅ Priority Issues               │ PASS (4ms)               │
│  ✅ Search Codebase               │ PASS (465ms)             │
│  ❌ Create Annotation             │ FAIL (400 schema)        │
│  ✅ Co-change Suggestions         │ PASS (3ms)               │
│  ⚠️ Impact Analysis               │ PARTIAL (test issue)     │
│  ❌ Mark Problem Complete         │ FAIL (404 not mounted)   │
│  ❌ Generate Implementation Spec  │ FAIL (404 not impl)      │
│  ✅ Performance Test              │ PASS (avg 2ms)           │
│  ❌ MCP Server stdio              │ FAIL (timeout)           │
├─────────────────────────────────────────────────────────────┤
│  Total: 5 Pass, 3 Fail, 1 Partial, 1 Blocked               │
└─────────────────────────────────────────────────────────────┘
```

---

## What Works ✅

1. **API Deployment in Kubernetes**
   - Pod running: `metabob-analysis-api-5bc897686b-ljmcl`
   - 0 restarts, healthy for 36+ minutes
   - Accessible internally and via Istio Gateway

2. **Priority Issues Endpoint**
   - Returns mock security/performance issues
   - Response time: 4ms
   - Proper session scoping

3. **Search Endpoint**
   - Semantic search working
   - Response time: 465ms (expected for embeddings)
   - Returns similarity scores

4. **Co-change Suggestions**
   - Returns files that should be changed together
   - Hybrid scoring (embedding + frequency)
   - Response time: 3ms

5. **Performance**
   - Average: 2ms for 10 requests
   - Minimum: 2ms
   - Maximum: 4ms
   - Well below 5s threshold

---

## What Doesn't Work ❌

### Critical Issue: MCP Server stdio Communication
**Impact:** Blocks AI agent integration completely

```
AI Agent → (stdio) → MCP Server → (timeout 30s) → No response
```

**Status:** Server starts, registers tools, but doesn't respond to JSON-RPC

**Needs:** Deep investigation of @modelcontextprotocol/sdk

---

### Missing Routes (404 Errors)

1. **Mark Problem Complete**
   ```
   PUT /v2/analysis/problems/:id/complete
   ```
   - Route defined in `routes/problems.ts`
   - NOT mounted in `index.ts`
   - **Fix:** Add `app.route('/v2/analysis/problems', problemsRoutes);`

2. **Generate Implementation Spec**
   ```
   POST /v2/analysis/implementation-spec
   ```
   - Not implemented yet
   - **Fix:** Either implement or remove from MCP registry

---

### Schema Mismatch (400 Error)

**Annotations Endpoint**
```
API expects: { "content": "..." }
MCP sends:   { "text": "..." }
```

**Fix Options:**
- Option 1: Change API schema to accept "text"
- Option 2: Change MCP client to send "content"

---

## Architecture Overview

```
┌──────────────────────┐
│   AI Agent           │  (Claude Desktop, Cursor)
└──────────┬───────────┘
           │
           │ JSON-RPC stdio ⚠️ TIMEOUT
           │
┌──────────▼───────────┐
│   metabob-mcp        │  (Local MCP Server)
│   - 7 tools          │
│   - Rate limit       │
│   - Circuit breaker  │
└──────────┬───────────┘
           │
           │ HTTP/JSON ✅ WORKING
           │
┌──────────▼───────────┐
│ metabob-analysis-api │  (Kubernetes Pod)
│ - 5/9 endpoints ✅   │
│ - 3/9 endpoints ❌   │
│ - 1/9 partial ⚠️     │
└──────────────────────┘
```

---

## Priority Actions

### 🔴 Critical (Blocking Production)

1. **Fix MCP Server stdio Communication**
   - Time: 1-2 days
   - Without this, AI agents cannot use tools

### 🟡 High (Should Fix Soon)

2. **Mount Problems Route**
   - Time: 1 hour
   - One-line fix in index.ts

3. **Implement or Remove Generate Spec**
   - Time: 2-3 days (if implementing)
   - Or 10 minutes (if removing from registry)

### 🟢 Medium (Can Wait)

4. **Fix Annotation Schema**
   - Time: 2 hours
   - Align field names between MCP and API

5. **Update Test Expectations**
   - Time: 1 hour
   - Fix impact analysis test schema

---

## Quick Start: Run Tests Locally

### 1. Setup Port Forward
```bash
kubectl port-forward -n activity-system svc/metabob-analysis-api 8081:8080 &
```

### 2. Run Direct API Tests
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run test-mcp-live-api.ts
```

### 3. Test Individual Endpoints
```bash
# Health check
curl http://localhost:8081/health

# Priority issues
curl -H "X-Session-ID: test" \
  http://localhost:8081/v2/analysis/priority?limit=5

# Search
curl -X POST -H "X-Session-ID: test" \
  -H "Content-Type: application/json" \
  -d '{"query":"security","limit":5}' \
  http://localhost:8081/v2/analysis/search
```

---

## Kubernetes Status

```bash
# Check pod status
kubectl get pods -n activity-system -l app.kubernetes.io/name=metabob-analysis-api

# View logs
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-analysis-api -f

# Check service
kubectl get svc -n activity-system metabob-analysis-api
```

**Current Status:**
- Pod: Running (1/1 Ready)
- Service: ClusterIP 10.96.221.174:8080
- External: api.metabob.local (Istio)

---

## Performance Metrics

```
Endpoint                     Response Time
────────────────────────────────────────────
GET  /health                 18ms
GET  /v2/analysis/priority   2-4ms
POST /v2/analysis/search     462-465ms  (semantic search)
POST /v2/analysis/cochange   3ms
POST /v2/analysis/impact     3ms
```

**Observations:**
- Mock data endpoints: <5ms (excellent)
- Semantic search: ~460ms (expected for embeddings)
- No performance issues detected

---

## Files Created

1. **MCP_INTEGRATION_TEST_REPORT.md**
   - Comprehensive test report with all details
   - Root cause analysis for each failure
   - Recommendations and timelines

2. **test-mcp-live-api.ts**
   - Direct API testing script (bypasses MCP)
   - Tests all 9 endpoints
   - Results: 5 pass, 3 fail, 1 partial

3. **test-mcp-integration.ts**
   - Full MCP + API integration test
   - Tests MCP tools calling API
   - Status: Blocked by stdio timeout

4. **test-mcp-simple.sh**
   - Simple bash-based MCP test
   - Status: Hangs on tools/list

---

## Next Steps

1. **Immediate:** Investigate MCP SDK stdio transport
   - Add extensive debug logging
   - Test with MCP inspector tool
   - Consider HTTP mode as fallback

2. **Short-term:** Fix missing routes
   - Mount problems route
   - Implement or remove spec generation

3. **Medium-term:** Fix schema issues
   - Align annotation field names
   - Update test expectations

4. **Long-term:** Add CI/CD tests
   - Run integration tests on every deployment
   - Add Kubernetes health probes
   - Implement observability

---

## Conclusion

**Good News:**
- API is deployed successfully in Kubernetes
- 5 out of 9 endpoints work perfectly
- Performance is excellent (2-4ms)
- No stability issues (0 restarts)

**Bad News:**
- MCP server stdio communication completely broken
- 3 endpoints have issues (2 missing, 1 schema)
- AI agents cannot use the tools yet

**Timeline to Production:**
- Critical fixes: 1-2 days
- High priority fixes: 1 day
- Medium priority fixes: 1 day
- **Total: 3-4 days**

---

**For detailed analysis, see:** `MCP_INTEGRATION_TEST_REPORT.md`
**Test scripts:** `test-mcp-live-api.ts`, `test-mcp-integration.ts`
