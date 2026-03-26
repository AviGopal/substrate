# Learning Loop Activity Templates - Execution Guide

**Created**: 2026-02-21  
**Status**: Ready to Execute  
**Purpose**: Guide for executing Learning Loop Phase 2+ using activity templates

---

## Available Templates

We have **11 activity templates** ready for Learning Loop implementation:

### Phase 1: Backend (COMPLETE ✅)
1. ✅ `design-surrealdb-schema-learning-loop` - Schema design (DONE - Session 2)
2. ✅ `implement-surrealdb-client-rpc-api` - Client + CRUD ops (DONE - Session 3)
3. ✅ `implement-learning-loop-api-endpoints` - API endpoints (DONE manually - Session 4)

### Phase 2: MCP Integration (READY TO EXECUTE)
4. 🎯 `update-mcp-post-activity-result-tool` - **NEXT: Update POST tool**
5. 🎯 `update-mcp-fetch-boredom-activities-tool` - **NEXT: Update GET tool**
6. 🎯 `update-mcp-learning-loop-tools` - **ALTERNATIVE: Combined Phase 2**

### Phase 3: OpenCode Client (READY TO EXECUTE)
7. 📋 `implement-boredom-execution-opencode` - Autonomous execution
8. 📋 `examine-learning-loop-configuration` - Config validation

### Phase 5: Testing & Validation (READY TO EXECUTE)
9. 📋 `test-learning-loop-end-to-end` - E2E testing
10. 📋 `test-boredom-system-in-docker` - Docker validation
11. 📋 `validate-surrealdb-container` - SurrealDB setup validation

---

## Recommended Execution Order

### Option A: Sequential Phase 2 (More Granular)

Execute Phase 2 in two steps for better control and testing:

#### Step 1: Update POST Tool (30-45 min)
```bash
activity({
  templateId: "update-mcp-post-activity-result-tool",
  variables: {},
  reason: "Phase 2.1 - Update metabob_post_activity_result to proxy to Learning Loop API for execution tracking"
})
```

**What it does**:
- Analyzes current `metabob_post_activity_result` implementation
- Updates MCP tool to POST to `/api/v1/learning-loop/executions`
- Uses httpx pattern from existing learning_tools.py
- Maps parameters to ExecutionRequest schema
- Updates documentation and tests
- Commits changes

**Expected Output**:
- Modified: `repos/metabob-cli/src/metabob_cli/mcp/learning_tools.py` (or new file)
- Modified: `repos/metabob-opencode/packages/opencode/src/tool/post-activity-result.ts` (docs)
- Modified: Tests updated
- Commit: "feat(mcp): Update post_activity_result to use Learning Loop API"

#### Step 2: Update GET Tool (30-45 min)
```bash
activity({
  templateId: "update-mcp-fetch-boredom-activities-tool",
  variables: {},
  reason: "Phase 2.2 - Update metabob_fetch_boredom_activities to proxy to Learning Loop API for improvement candidates"
})
```

**What it does**:
- Analyzes current `metabob_fetch_boredom_activities` implementation
- Updates MCP tool to GET from `/api/v1/learning-loop/boredom-activities`
- Maps query parameters (threshold, exclude_hours, limit)
- Handles API response parsing
- Updates documentation and tests
- Commits changes

**Expected Output**:
- Modified: `repos/metabob-cli/src/metabob_cli/mcp/learning_tools.py`
- Modified: `repos/metabob-opencode/packages/opencode/src/tool/fetch-boredom-activities.ts` (docs)
- Modified: Tests updated
- Commit: "feat(mcp): Update fetch_boredom_activities to use Learning Loop API"

### Option B: Combined Phase 2 (Faster, All-in-One)

Execute both updates in a single activity:

```bash
activity({
  templateId: "update-mcp-learning-loop-tools",
  variables: {
    api_base_url: "http://localhost:8080",
    api_timeout: 30,
    api_retry_attempts: 3,
    api_retry_delay: 1.0,
    enable_fallback: true
  },
  reason: "Phase 2 - Update both MCP tools (post_activity_result and fetch_boredom_activities) to proxy to Learning Loop API"
})
```

**What it does**:
- Creates unified API client infrastructure
- Updates BOTH MCP tools to use HTTP proxy
- Implements retry logic and error handling
- Updates all documentation and tests
- Single commit for entire Phase 2

**Expected Output**:
- New: `repos/metabob-cli/src/metabob_cli/mcp/api_client.py` (HTTP client)
- Modified: Both MCP tools
- Modified: All related tests and docs
- Commit: "feat(mcp): Update learning loop tools to use backend API"

**Recommendation**: Use **Option B** for speed, **Option A** for control/debugging

---

## Phase 3: OpenCode Client Implementation

After Phase 2 completes, implement autonomous execution:

```bash
activity({
  templateId: "implement-boredom-execution-opencode",
  variables: {
    executeMethod: "update_existing"  # or "add_new"
  },
  reason: "Phase 3.1 - Implement autonomous execution of boredom activities in BoredomManager"
})
```

**What it does**:
- Updates `BoredomManager.ts` to execute improvement activities
- Integrates with `fetch_boredom_activities` tool
- Implements execution workflow (fetch → execute → report)
- Adds error handling and logging
- Tests autonomous execution flow

**Expected Output**:
- Modified: `packages/opencode/src/boredom/BoredomManager.ts`
- New/Modified: Tests
- Commit: "feat(boredom): Implement autonomous activity execution"

---

## Phase 5: Testing & Validation

### End-to-End Testing

```bash
activity({
  templateId: "test-learning-loop-end-to-end",
  variables: {
    testScenarios: "all"  # or "basic", "stress", "failure"
  },
  reason: "Phase 5 - End-to-end testing of complete Learning Loop system"
})
```

**What it does**:
- Tests complete flow: execution → API → SurrealDB → metrics → boredom detection
- Validates data persistence and retrieval
- Tests error scenarios and graceful degradation
- Verifies metrics calculations (incremental aggregation)
- Validates Thompson sampling parameters

**Test Scenarios**:
1. **Basic**: Single successful execution, fetch metrics, boredom detection
2. **Stress**: Multiple concurrent executions, metric updates
3. **Failure**: Error handling, retry logic, graceful degradation

### Docker Validation

```bash
activity({
  templateId: "test-boredom-system-in-docker",
  variables: {},
  reason: "Validate Learning Loop in Docker environment"
})
```

**What it does**:
- Sets up test Docker environment
- Runs Learning Loop in isolated container
- Validates API endpoints
- Tests persistence across restarts

### SurrealDB Setup

```bash
activity({
  templateId: "validate-surrealdb-container",
  variables: {},
  reason: "Set up and validate SurrealDB for Learning Loop"
})
```

**What it does**:
- Starts SurrealDB container
- Applies schema migrations
- Validates table structure
- Tests basic CRUD operations
- Verifies indexes

---

## Quick Start: Execute Phase 2 Now

**Recommended**: Use the combined template for fastest results.

### Prerequisites
- ✅ Phase 1 complete (backend API ready)
- ✅ Git clean (no uncommitted changes)
- ✅ RPC API accessible (default: http://localhost:8080)

### Execution Command

```typescript
activity({
  templateId: "update-mcp-learning-loop-tools",
  variables: {
    api_base_url: "http://localhost:8080",
    api_timeout: 30,
    api_retry_attempts: 3,
    api_retry_delay: 1.0,
    enable_fallback: true
  },
  reason: "Phase 2 complete implementation - update MCP tools to proxy to Learning Loop backend API"
})
```

### Expected Duration
- **Best case**: 45-60 minutes
- **Typical**: 60-90 minutes (includes testing)
- **With issues**: 90-120 minutes (debugging, retries)

### Expected Cost
- **Estimated**: $1.50 - $3.00
- **Based on**: Previous Phase 1.3 template execution ($4.06 for 4 templates)

### Success Criteria
- ✅ Both MCP tools updated to use HTTP proxy
- ✅ Tests passing
- ✅ Documentation updated
- ✅ Changes committed
- ✅ No regression in tool interfaces

---

## Template Details Reference

### 1. update-mcp-post-activity-result-tool

**Purpose**: Update POST execution results tool  
**Category**: feature  
**Tasks**: 4 (analyze, implement, update docs, update tests)  
**Duration**: 30-45 min  
**Files Modified**:
- `repos/metabob-cli/src/metabob_cli/mcp/learning_tools.py`
- `repos/metabob-opencode/packages/opencode/src/tool/post-activity-result.ts`
- Test files

**Key Changes**:
- Replace in-memory storage with HTTP POST
- Map to ExecutionRequest schema
- Handle errors gracefully
- Update documentation

### 2. update-mcp-fetch-boredom-activities-tool

**Purpose**: Update GET boredom activities tool  
**Category**: feature  
**Tasks**: 4 (analyze, implement, update docs, update tests)  
**Duration**: 30-45 min  
**Files Modified**:
- `repos/metabob-cli/src/metabob_cli/mcp/learning_tools.py`
- `repos/metabob-opencode/packages/opencode/src/tool/fetch-boredom-activities.ts`
- Test files

**Key Changes**:
- Replace in-memory read with HTTP GET
- Map query parameters
- Parse API response
- Update documentation

### 3. update-mcp-learning-loop-tools (COMBINED)

**Purpose**: Update both tools + create API client  
**Category**: feature  
**Tasks**: 5 (create client, update POST tool, update GET tool, update docs, test all)  
**Duration**: 60-90 min  
**Files Modified/Created**:
- **New**: `repos/metabob-cli/src/metabob_cli/mcp/api_client.py`
- Modified: Both MCP tools
- Modified: All related tests and docs

**Variables**:
- `api_base_url`: RPC API URL (default: http://localhost:8080)
- `api_timeout`: Request timeout in seconds (default: 30)
- `api_retry_attempts`: Retry count (default: 3)
- `api_retry_delay`: Initial retry delay (default: 1.0s)
- `enable_fallback`: Graceful degradation (default: true)

**Key Features**:
- Unified API client with retry logic
- Exponential backoff (1s, 2s, 4s)
- Graceful degradation on API unavailable
- Comprehensive error handling
- Detailed logging

### 4. implement-boredom-execution-opencode

**Purpose**: Autonomous activity execution  
**Category**: feature  
**Tasks**: 5 (design, implement, integrate, test, document)  
**Duration**: 90-120 min  
**Files Modified**:
- `packages/opencode/src/boredom/BoredomManager.ts`
- Related tests

**Variables**:
- `executeMethod`: "update_existing" or "add_new"

**Key Features**:
- Fetch boredom activities from API
- Execute improvement activities
- Report results back to API
- Error handling and retry
- Activity scheduling

### 5. test-learning-loop-end-to-end

**Purpose**: Complete system testing  
**Category**: infrastructure  
**Tasks**: 6 (setup, basic tests, stress tests, failure tests, validate, report)  
**Duration**: 60-90 min  
**Files Created**:
- Test suite files
- Test report

**Variables**:
- `testScenarios`: "all", "basic", "stress", or "failure"

**Test Coverage**:
- Execution recording → API → DB
- Metrics aggregation correctness
- Boredom detection accuracy
- Error scenarios
- Performance under load

---

## Troubleshooting

### Activity Execution Fails

**Problem**: Git working tree has uncommitted changes

**Solution**:
```bash
git status
git add <files>
git commit -m "description"
# Then retry activity
```

### Template Not Found

**Problem**: Template ID incorrect or not registered

**Solution**:
```bash
# Search for correct template ID
search_activities({ category: "feature", verbose: true })

# Use exact template ID from search results
```

### API Connection Errors During Execution

**Problem**: RPC API not running or wrong URL

**Solution**:
1. Check RPC API is running: `curl http://localhost:8080/health`
2. Update `api_base_url` variable to correct URL
3. Ensure firewall allows connection

### Template Execution Takes Too Long

**Problem**: Activity stuck or taking >2 hours

**Solution**:
1. Check activity logs for progress
2. If truly stuck, cancel and retry
3. Consider using granular templates (Option A) instead of combined

---

## Next Steps After Phase 2

Once Phase 2 completes:

1. **Test MCP Integration** (manual):
   ```bash
   # Start RPC API
   cd repos/metabob-rpc-api && python -m server.app
   
   # Test POST tool
   # (via opencode session - execute an activity and verify metrics recorded)
   
   # Test GET tool  
   # (via opencode session - fetch boredom activities)
   ```

2. **Execute Phase 3** (autonomous execution):
   ```bash
   activity({
     templateId: "implement-boredom-execution-opencode",
     variables: { executeMethod: "update_existing" },
     reason: "Phase 3.1 - Enable autonomous activity improvement"
   })
   ```

3. **Execute Phase 5** (testing):
   ```bash
   activity({
     templateId: "test-learning-loop-end-to-end",
     variables: { testScenarios: "all" },
     reason: "Phase 5 - Comprehensive E2E testing"
   })
   ```

4. **Production Readiness**:
   - Add authentication to API endpoints
   - Set up SurrealDB in production
   - Configure monitoring and alerts
   - Document deployment process

---

## Summary

**Current State**: Phase 1 complete, Phase 2 ready to execute

**Recommended Action**: Execute `update-mcp-learning-loop-tools` template

**Expected Outcome**: 
- MCP tools proxy to backend API
- Activity execution data persists in SurrealDB
- Boredom detection works with real data
- Phase 2 complete in 60-90 minutes

**Total Remaining Work**:
- Phase 2: 1-2 hours (MCP integration)
- Phase 3: 1-2 hours (autonomous execution)
- Phase 5: 1-2 hours (testing)
- **Total**: 3-6 hours to complete Learning Loop

**Templates Available**: 11 templates covering all remaining phases

**Ready to Execute**: Just run the activity command above! 🚀
