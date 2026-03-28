# Boredom System Audit & Optimization Plan

**Date**: 2026-03-02  
**Session**: Activity Mode - System Maintenance  
**Priority**: HIGH

## Executive Summary

After examining the boredom activity system and activity templates, several critical issues were identified:

### **Critical Issues Found**

1. **Test Pollution** (HIGH): 60+ test-cochange and test-template entries polluting template registry
2. **Boredom API Endpoint** (HIGH): Returns 401 error from SurrealDB connection  
3. **Template Failures** (HIGH): 2 templates with 0% success rate (2 executions each)
4. **Backend API Authentication** (MEDIUM): SurrealDB RPC authentication failure

### **System Status**

✅ **WORKING**:
- Boredom detection mechanism (idle tracking, timer reset)
- Activity tracking and cancellation
- Session lifecycle hooks
- Template structure and storage
- Local template registry (19 templates)
- Data flow: OpenCode → metabob-cli → RPC API → SurrealDB

❌ **BROKEN**:
- Boredom API endpoint `/api/v1/learning-loop/boredom-activities` (401 Unauthorized)
- Template: `complete-metabob-search-embedding-integration` (0% success, 2 executions)
- Template: `improve-metabob-search-with-embeddings` (0% success, 2 executions)

## Detailed Findings

### 1. Test Pollution (60+ Templates)

**Problem**: Template registry contaminated with test templates from development/testing

**Impact**:
- Noise in search results (60/86 templates are test entries)
- Confusion for users and boredom system
- Wasted storage and query time
- Metrics pollution

**Test Templates Identified**:
- 46 `test-cochange-*` templates (timestamped: 1772244205250-1772244206151)
- 18 `test-template-*` templates (timestamped: 1772244205341-1772244206205)

**Resolution Plan**:
```bash
# Remove from local storage
rm ~/.local/share/opencode/storage/activity-template/test-cochange-*.json
rm ~/.local/share/opencode/storage/activity-template/test-template-*.json

# Remove from SurrealDB (if synced)
curl -X DELETE http://localhost:8080/v2/activities/templates?pattern=test-cochange-*
curl -X DELETE http://localhost:8080/v2/activities/templates?pattern=test-template-*
```

### 2. Boredom API Endpoint Failure

**Problem**: `/api/v1/learning-loop/boredom-activities` returns 401 Unauthorized

**Error**:
```json
{
  "error": "401 Client Error: Unauthorized for url: http://surrealdb:8000/rpc"
}
```

**Root Cause**: RPC API's SurrealDB client authentication failure

**Impact**:
- Boredom system cannot fetch improvement candidates
- Idle sessions will not trigger auto-improvement activities
- Learning loop blocked

**Investigation Needed**:
1. Check SurrealDB credentials in RPC API config
2. Verify RPC API → SurrealDB connection
3. Test `/boredom-activities` endpoint with manual query
4. Review `get_boredom_candidates()` implementation

**File**: `repos/metabob-rpc-api/server/routes/learning_loop.py:349-387`

**Expected Behavior**:
```python
@router.get("/boredom-activities")
async def get_boredom_activities(
    threshold: float = 0.7,
    exclude_hours: int = 24,
    limit: int = 10
) -> List[Dict[str, Any]]:
    # Query template_metrics for low improvement_gradient candidates
    candidates = get_boredom_candidates(
        improvement_threshold=threshold,
        exclude_recent_hours=exclude_hours,
        max_results=limit
    )
    return candidates
```

### 3. Failing Activity Templates

#### Template 1: `complete-metabob-search-embedding-integration`

**Status**: 0% success (2 executions, both failed)

**Description**: "Complete the remaining tasks (2-5) from improve-metabob-search-with-embeddings: design, implement, test, and document semantic search with CPG embeddings"

**Tasks**: 4 tasks  
**Avg Cost**: $0.00  
**Avg Duration**: 6.9s

**Failure Pattern**: Likely fails immediately (6.9s duration suggests early abort)

**Analysis Needed**:
- Review execution logs
- Check task definitions
- Identify validation failures
- Fix preconditions or task logic

#### Template 2: `improve-metabob-search-with-embeddings`

**Status**: 0% success (2 executions, both failed)

**Description**: "Replace keyword-based search in metabob_search_codebase_issues with real semantic search using CPG cochange embeddings. Integrates CoChangePredictor for ML-based similarity."

**Tasks**: 5 tasks  
**Avg Cost**: $0.23  
**Avg Duration**: 288.4s

**Failure Pattern**: Longer duration (288s) suggests mid-execution failure

**Analysis Needed**:
- Which task failed (task 2-5?)
- Error type and message
- CPG/embedding integration issues
- Missing dependencies or setup

### 4. SurrealDB Authentication

**Problem**: RPC API cannot authenticate to SurrealDB RPC endpoint

**Error**: `401 Client Error: Unauthorized for url: http://surrealdb:8000/rpc`

**Expected Credentials**:
- User: `root`
- Password: `changeme` (from Kubernetes secret)
- Namespace: `metabob`
- Database: `devbob`

**Investigation**:
1. Check RPC API environment variables
2. Verify Kubernetes secret `surrealdb-credentials`
3. Test direct SurrealDB SQL endpoint (port 8000)
4. Review SurrealDB client configuration in `server/db/surrealdb_client.py`

## Action Plan

### Phase 1: Cleanup (IMMEDIATE) ⚠️

**Priority**: HIGH  
**Duration**: 10 minutes  
**Risk**: LOW

1. **Delete Test Templates**
   ```bash
   cd ~/.local/share/opencode/storage/activity-template
   rm test-cochange-*.json test-template-*.json
   ```
   - ✅ Removes 60+ test pollution entries
   - ✅ Clean registry for search and boredom system
   - ✅ No data loss (test templates only)

2. **Verify Cleanup**
   ```bash
   search_activities() | grep -c "test-"  # Should be 0
   ```

### Phase 2: Fix Boredom API (HIGH PRIORITY) 🔥

**Priority**: HIGH  
**Duration**: 30-60 minutes  
**Risk**: MEDIUM

1. **Investigate SurrealDB Authentication**
   - Review `repos/metabob-rpc-api/server/db/surrealdb_client.py`
   - Check environment variables for credentials
   - Test direct SQL endpoint access
   - Fix authentication configuration

2. **Test `/boredom-activities` Endpoint**
   ```bash
   curl http://localhost:8080/api/v1/learning-loop/boredom-activities?threshold=0.7&limit=5
   ```
   - Should return list of templates needing improvement
   - Verify `get_boredom_candidates()` logic

3. **Validate Boredom Detection Flow**
   - Test idle detection (5min threshold)
   - Verify MCP call to `metabob_fetch_boredom_activities`
   - Confirm activity selection and execution

### Phase 3: Debug Failing Templates (HIGH PRIORITY) 🐛

**Priority**: HIGH  
**Duration**: 1-2 hours  
**Risk**: MEDIUM

1. **Debug `complete-metabob-search-embedding-integration`**
   - Load activity execution logs
   - Identify failure point
   - Fix preconditions or task logic
   - Re-test execution

2. **Debug `improve-metabob-search-with-embeddings`**
   - Review task sequence (5 tasks)
   - Check CPG/embedding dependencies
   - Identify which task failed (likely task 3-5)
   - Fix integration issues

3. **Use Debugging Activity Template**
   ```bash
   activity(
     templateId: "debug-activity-template-failures",
     variables: {
       templateId: "complete-metabob-search-embedding-integration",
       executionId: "<recent_execution_id>"
     }
   )
   ```

### Phase 4: Optimize Impulse System (MEDIUM PRIORITY) 🎯

**Priority**: MEDIUM  
**Duration**: 1-2 hours  
**Risk**: LOW

1. **Audit Impulse Storage**
   - Check `~/.local/share/opencode/storage/impulse/`
   - Verify SurrealDB `impulse` table
   - Review storage efficiency

2. **Optimize Impulse Resolution**
   - Check lazy loading implementation
   - Verify budget enforcement
   - Test pointer resolution (file, activityOutput, etc.)

3. **Validate Turn-Level Learning**
   - Test `/api/v1/learning-loop/record-turn` endpoint
   - Verify `impulse_mapping_record` storage
   - Check pattern extraction service

### Phase 5: End-to-End Testing (FINAL) ✅

**Priority**: MEDIUM  
**Duration**: 30 minutes  
**Risk**: LOW

1. **Test Boredom System Flow**
   - Create idle session (5+ minutes)
   - Verify boredom activity fetch
   - Confirm activity execution
   - Validate result reporting

2. **Test Template Execution**
   - Execute fixed templates
   - Verify 100% success rate
   - Check metrics reporting

3. **Validate Data Flow**
   - Confirm OpenCode → CLI → RPC → SurrealDB
   - Test template sync
   - Verify metrics storage

## Success Criteria

### Cleanup Phase
- ✅ 0 test templates in registry (currently 60+)
- ✅ Clean search results (only real templates)
- ✅ Local storage: 19 → ~8-10 real templates

### Boredom System
- ✅ `/boredom-activities` endpoint returns candidates (no 401 error)
- ✅ Idle detection triggers fetch
- ✅ Activity execution works end-to-end
- ✅ Results reported to backend

### Template Quality
- ✅ `complete-metabob-search-embedding-integration`: 0% → 100% success
- ✅ `improve-metabob-search-with-embeddings`: 0% → 100% success
- ✅ All templates have >80% success rate

### Data Flow
- ✅ SurrealDB authentication working
- ✅ Template sync operational
- ✅ Metrics reporting functional
- ✅ Impulse system optimized

## Timeline

- **Phase 1 (Cleanup)**: 10 minutes ⏱️
- **Phase 2 (Boredom API)**: 30-60 minutes ⏱️⏱️
- **Phase 3 (Debug Templates)**: 1-2 hours ⏱️⏱️⏱️
- **Phase 4 (Optimize Impulses)**: 1-2 hours ⏱️⏱️⏱️
- **Phase 5 (Testing)**: 30 minutes ⏱️

**Total Estimated Time**: 3-5 hours

## Next Steps

1. Execute Phase 1 (Cleanup) immediately
2. Fix boredom API authentication (Phase 2)
3. Debug failing templates (Phase 3)
4. Optimize impulse system (Phase 4)
5. Comprehensive end-to-end testing (Phase 5)

---

**Note**: This plan addresses the core issues blocking the boredom system and template execution. Follow phases sequentially for best results.
