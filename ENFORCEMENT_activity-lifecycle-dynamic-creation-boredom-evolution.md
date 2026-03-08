# Activity Lifecycle Specification Enforcement Summary

**Specification**: activity-lifecycle-dynamic-creation-boredom-evolution
**Date**: 2026-03-08
**Status**: PARTIAL - Critical security gaps closed, lifecycle triggers added

## Changes Applied

### 1. GAP-9: Boredom Scoping (CRITICAL - Security Fix) ✅

**Files Changed**:
- `repos/metabob-rpc-api/server/db/operations/template_metrics.py:286`
- `repos/metabob-rpc-api/server/routes/learning_loop.py:575`

**Changes Made**:
1. Added `org_id` and `project_id` parameters to `get_boredom_candidates()` function
2. Added SQL WHERE clause filtering: `scope IS NULL OR scope='global' OR (scope='org' AND org_id=$org_id) OR (scope='project' AND project_id=$project_id)`
3. Added `SESSION_TOKEN` authentication to `get_boredom_activities` endpoint
4. Extracts `org_id` from JWT token using `get_current_user()` dependency
5. Passes `org_id` and `project_id` to `get_boredom_candidates()` for filtering

**Reason**: Prevents cross-organization data leakage. Before this fix, any user could see boredom candidates from all organizations. Now, users only see candidates matching their org/project scope or global templates.

**Impact**: 
- **Security**: HIGH - Closes multi-tenant isolation vulnerability
- **Backward Compatibility**: MEDIUM - Optional auth in DEBUG mode preserves development workflow
- **Blast Radius**: Low - Only affects `/api/v1/learning-loop/boredom-activities` endpoint

---

### 2. GAP-1: Dynamic Creation Trigger (CRITICAL) ✅

**File Changed**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:83-110`

**Change Made**:
When `metabob_search_activities` finds no templates and user provided a query, return special response:
```python
{
  "status": "no_match",
  "suggestion": {
    "action": "create_activity_goal_seeking",
    "recommended_variables": {
      "goalDescription": query,
      "templateName": f"Custom: {query[:50]}",
      "category": category or "feature"
    },
    "message": "No existing activity templates found for '{query}'. Consider using create_activity_goal_seeking to generate a custom template."
  }
}
```

**Reason**: Enables automatic dynamic creation workflow. When no existing templates match user requirements, the system now suggests (and could automatically trigger) `create_activity_goal_seeking` to generate a custom template.

**Impact**:
- **Lifecycle Integration**: CRITICAL - Connects search phase to creation phase
- **User Experience**: HIGH - Provides clear path forward when no templates match
- **Backward Compatibility**: FULL - Old clients simply ignore the `suggestion` field
- **Blast Radius**: Low - Only affects `metabob_search_activities` response format

---

## Gaps Remaining (Not Enforced in This Pass)

### GAP-2: Activity Storage Hook (CRITICAL)
**Status**: PARTIALLY ADDRESSED
**Current**: `TemplateRepository.save()` already registers templates to backend via MCP
**Missing**: POST to `/content` endpoint to store execution context for pattern learning
**Recommendation**: Add storage hook in create-activity-goal-seeking after template creation completes, OR accept that template registration is sufficient for learning

### GAP-3: Pattern Extraction Scheduler (CRITICAL)
**Status**: NOT IMPLEMENTED
**Current**: `pattern_extraction_service.py` exists but not called periodically
**Missing**: Cron job or background task to run `extract_patterns()` on all stored activities
**Recommendation**: Create `server/jobs/pattern_extraction_job.py` with APScheduler or Celery

### GAP-4: Split/Merge Detection (HIGH)
**Status**: NOT IMPLEMENTED
**Current**: Pattern extraction only analyzes individual activities
**Missing**: Logic to detect split candidates (>7 tasks) and merge candidates (similar patterns)
**Recommendation**: Add `server/services/evolution_analyzer.py` with detection algorithms

### GAP-5: Boredom Activity Types (HIGH)
**Status**: NOT IMPLEMENTED
**Current**: Only returns "improve-template" activity type
**Missing**: "split-oversized", "merge-similar", "debug-failures" activity types
**Recommendation**: Extend `get_boredom_candidates()` to generate all activity types

### GAP-6: Evolution Logic (HIGH)
**Status**: NOT IMPLEMENTED
**Current**: `derive_variant` exists but no split/merge/debug actions
**Missing**: Implementation of split/merge/debug transformation logic
**Recommendation**: Create `repos/metabob-cli/src/metabob_cli/mcp/evolution_actions.py`

### GAP-7: Replay Comparison (MEDIUM)
**Status**: NOT IMPLEMENTED
**Current**: `activity_replay` tool exists but doesn't compare outputs
**Missing**: Field-by-field comparison of validator results
**Recommendation**: Add comparison logic to `activity-replay.ts`

### GAP-8: Auto-Promotion (MEDIUM)
**Status**: NOT IMPLEMENTED
**Current**: No promotion logic based on replay results
**Missing**: Automatic promotion of evolved variants when metrics improve
**Recommendation**: Add promotion logic after replay comparison

### GAP-10: Periodic Scheduling (CRITICAL)
**Status**: NOT IMPLEMENTED
**Current**: No scheduler for pattern extraction or boredom generation
**Missing**: Cron/APScheduler jobs to run background tasks
**Recommendation**: Add `server/jobs/scheduler.py` with periodic tasks

---

## Ripple Effects and Propagation

### 1. GAP-9 Boredom Scoping
**Entry Points**: All callers of `get_boredom_activities` endpoint
- `metabob-cli`: `metabob_fetch_boredom_activities` MCP tool already provides session context
- Future: Any vessel/agent calling this endpoint will need to pass Bearer token

**Data Transformations**:
- `get_boredom_candidates()` now filters by `org_id` and `project_id`
- SQL query updated to enforce multi-tenant isolation
- No downstream impacts - consumers receive filtered results

**Validation Propagation**:
- Template scope validation now enforced at boredom query time
- Consistent with existing `list_templates` endpoint scoping logic
- No schema changes required

### 2. GAP-1 Dynamic Creation Trigger
**Entry Points**: All callers of `metabob_search_activities` MCP tool
- OpenCode vessels already handle tool responses dynamically
- New `suggestion` field provides actionable next step

**Data Transformations**:
- Response format extended with `suggestion` object (backward compatible)
- Existing clients ignore unknown fields (no breaking change)
- Future: Could auto-trigger `create_activity_goal_seeking` based on suggestion

**Validation Propagation**:
- No validation changes required
- Suggestion is informational, not enforced

---

## Testing Requirements

### Unit Tests Needed
1. **test_boredom_scoping_org_isolation** - Verify org-scoped templates only visible to same org
2. **test_boredom_scoping_project_isolation** - Verify project-scoped templates only visible to same project
3. **test_boredom_scoping_global_visible** - Verify global templates visible to all users
4. **test_dynamic_creation_trigger** - Verify suggestion returned when no templates found
5. **test_dynamic_creation_no_suggestion_when_templates_exist** - Verify normal flow unchanged

### Integration Tests Needed
1. **test_boredom_activities_e2e_with_auth** - Full flow from token to filtered candidates
2. **test_search_to_creation_flow** - Search → no match → create_activity_goal_seeking

---

## Architecture Compliance

### Layered Architecture
✅ **Maintained**: Changes respect existing architectural boundaries
- MCP layer (metabob-cli) calls RPC API (metabob-rpc-api)
- No direct database access from MCP layer
- Authentication handled via JWT in API layer

### Multi-Tenant Isolation
✅ **Enforced**: GAP-9 fix ensures tenant isolation at database query level
- SQL WHERE clause filters by org_id and project_id
- Consistent with existing template query filtering
- Prevents cross-tenant data leakage

### Backward Compatibility
✅ **Preserved**: Changes are backward compatible
- Optional authentication in DEBUG mode
- Additive response fields (suggestion object)
- Default parameter values for new function parameters

---

## Performance Considerations

### GAP-9 Boredom Scoping
- **SQL Query Impact**: Additional WHERE clauses on indexed columns (minimal overhead)
- **JWT Decoding**: One-time decode per request (negligible)
- **Cache Implications**: Existing cache keys may need org_id/project_id suffix

### GAP-1 Dynamic Creation Trigger
- **Minimal Overhead**: Only adds suggestion object when templates.length == 0
- **No Additional API Calls**: Pure logic, no network overhead

---

## Deployment Checklist

### Before Deployment
- [ ] Run unit tests for boredom scoping
- [ ] Run integration tests with authentication enabled
- [ ] Verify JWT_SECRET_KEY is set to strong value in production
- [ ] Update metabob-cli to latest version with GAP-1 fix

### After Deployment
- [ ] Monitor `/api/v1/learning-loop/boredom-activities` for auth errors
- [ ] Verify metabob_search_activities returns suggestions correctly
- [ ] Check logs for GAP-1 trigger logging: "No templates found for query '{query}', suggesting dynamic creation"

---

## Next Steps (Priority Order)

1. **GAP-3**: Implement pattern extraction scheduler (CRITICAL)
2. **GAP-10**: Add periodic scheduling infrastructure (CRITICAL)
3. **GAP-4**: Implement split/merge detection (HIGH)
4. **GAP-5**: Add split/merge/debug boredom activity types (HIGH)
5. **GAP-6**: Implement evolution actions (HIGH)
6. **GAP-7**: Add replay comparison logic (MEDIUM)
7. **GAP-8**: Implement auto-promotion (MEDIUM)
8. **GAP-2**: Verify activity storage hook (review if additional work needed)
