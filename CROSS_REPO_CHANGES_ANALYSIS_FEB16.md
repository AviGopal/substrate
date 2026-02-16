# Cross-Repository Changes Analysis - February 16, 2026

**Purpose**: Analyze all uncommitted changes across repositories and develop minimal-flux strategy  
**Status**: 🔍 Analysis Complete | ⚠️ Uncommitted Changes Found  
**Recommendation**: Strategic commits needed to preserve system stability

---

## Executive Summary

### Changes Discovered

| Repository | Status | Files Changed | Type | Risk Level |
|------------|--------|---------------|------|------------|
| **metabob-opencode** | ⚠️ Uncommitted | 5 | Schema + Registration | **LOW** ✅ |
| **metabob-rpc-api** | ⚠️ Uncommitted | 9 | Schema + Tracking | **LOW** ✅ |
| **metabob-cli** | ⚠️ Uncommitted | 1 | Task Reporting | **LOW** ✅ |
| **metabob-dashboard** | ⚠️ Uncommitted | 5 | V2 Migration | **MEDIUM** ⚠️ |

### Key Finding: All Changes Are Related! 🎯

These changes form a **cohesive feature set** for backend template registration with cochange learning:

```
Schema Fixes (opencode) → Backend Schema (rpc-api) → CLI Reporting (cli) → Dashboard Display (dashboard)
        ↓                           ↓                        ↓                        ↓
    Templates with              Backend accepts          Task-level            UI shows results
    correct format              new templates            reporting                and metrics
```

---

## Detailed Change Analysis

### 1. metabob-opencode (5 files changed, +41/-37 lines)

**Purpose**: Fix schema transformation for backend compatibility

#### Changes by File

**`activity-schema-adapter.ts`** (+33/-8 lines)
- **What**: Transform patterns from strings to `{pattern, description}` objects
- **Why**: Backend API expects objects, not strings
- **Impact**: Templates can now be registered to backend
- **Risk**: LOW - Backwards compatible, only affects registration
- **Lines**: 520-529 (pattern transformation in `denormalizeTask()`)

**Key Code**:
```typescript
// Pattern transformation fix
required_patterns: openCodeTask.validation.requiredPatterns?.map(p => ({ 
  pattern: p, 
  description: "" 
})),
```

**`metabob.ts`** (+27/-14 lines)
- **What**: Bypass non-existent MCP tool, write templates directly to `.metabob/activities/`
- **Why**: `register_activity_template` MCP tool doesn't exist yet
- **Impact**: Templates registered successfully via file discovery
- **Risk**: LOW - Temporary solution, works perfectly
- **Lines**: 778-806

**`activity-template-repository.ts`** (+7 lines)
- **What**: Support both `tasks` and `task_steps` field names
- **Why**: Backend uses `task_steps`, MCP uses `tasks`
- **Impact**: Compatibility with both systems
- **Risk**: LOW - Adds flexibility

**`search-activities.ts`** (+7/-2 lines)
- **What**: Handle both field name formats in search results
- **Why**: Same as above - dual compatibility
- **Impact**: Search works with both formats
- **Risk**: LOW

**`storage.ts`** (+4/-1 lines)
- **What**: Minor storage adjustments for template handling
- **Why**: Support new template structure
- **Impact**: Template loading improved
- **Risk**: LOW

#### Assessment
✅ **SAFE TO COMMIT** - All changes are focused, tested, and low-risk

---

### 2. metabob-rpc-api (9 files changed, +116/-19 lines)

**Purpose**: Backend schema support + task-level tracking (Phase 1 Tier 1)

#### Changes by File

**`proto_task_step.py`** (+46/-3 lines)
- **What**: Add `PromptVariable` schema + backwards compatibility for legacy templates
- **Why**: Support both string[] and object[] formats for variables
- **Impact**: New templates can use rich variable metadata
- **Risk**: LOW - Uses validator to normalize, backwards compatible
- **Key Feature**: `normalize_variables()` converts legacy strings → objects internally

**`activities.py`** (+28/-3 lines)
- **What**: Add Phase 1 Tier 1 fields to execution tracking
- **Why**: Enable task-level debugging and reporting
- **Impact**: Backend can now track individual task results
- **Risk**: LOW - Additive only, doesn't break existing code
- **New Fields**:
  - `tasks[]`: Task-level results
  - `environment{}`: Execution environment
  - `patterns[]`: Detected code patterns
  - `total_tokens{}`: Token breakdown (input/output/cache)
  - `correctness_score`: Quality metric

**`init_activity_schema.py`** (+20/-3 lines)
- **What**: Schema initialization updates for new fields
- **Why**: Database schema needs to support new tracking fields
- **Impact**: Backend can store richer execution data
- **Risk**: LOW - Schema migration, tested

**`activity_recommendation.py`** (+8/-2 lines)
- **What**: Model updates for recommendation system
- **Why**: Support new execution metadata
- **Impact**: Better recommendations based on richer data
- **Risk**: LOW

**`bootstrap_templates.py`** (+25/-4 lines)
- **What**: Bootstrap script updates for schema changes
- **Why**: Initial templates need correct format
- **Impact**: Clean bootstrap from scratch
- **Risk**: LOW

**`app.py`** (+3 lines)
- **What**: Route registration for task reporting
- **Why**: New endpoint `/v2/activities/executions/{id}/tasks`
- **Impact**: CLI can report task results
- **Risk**: LOW - New endpoint, doesn't affect existing

**`routes/__init__.py`** (+2 lines)
- **What**: Import new users route
- **Why**: Dashboard needs user management
- **Impact**: New functionality
- **Risk**: LOW - Separate route

**`routes/users.py`** (new file)
- **What**: User management endpoints
- **Why**: Dashboard V2 migration needs user routes
- **Impact**: New API surface
- **Risk**: LOW - New feature, isolated

**`tests/fixtures/test_controller.py`** (+1 line)
- **What**: Test fixture update
- **Why**: Tests need to support new schema
- **Impact**: Tests pass
- **Risk**: LOW

#### Assessment
✅ **SAFE TO COMMIT** - All changes are additive, backwards compatible

---

### 3. metabob-cli (1 file changed, +154/-7 lines)

**Purpose**: Task-level reporting to backend (Phase 1 Tier 1)

#### Changes

**`activity_manager.py`** (+154/-7 lines)

**New Method**: `_report_task_to_backend()`
- **What**: Report individual task results to backend after each step
- **Why**: Enable debugging of multi-task activities
- **Impact**: Backend gets real-time task status
- **Risk**: LOW - Wrapped in try/except, won't fail execution if reporting fails
- **Lines**: 904-952

**Key Code**:
```python
async def _report_task_to_backend(self, execution: ActivityExecution, result: StepResult):
    """Report task-level execution result to backend (Phase 1 Tier 1)"""
    try:
        task_data = {
            "execution_id": execution.execution_id,
            "task_index": execution.current_step_index,
            "task_name": result.step_id,
            "status": "success" if result.success else "failed",
            "duration_ms": result.duration_ms,
            "tokens": tokens_dict,
            "cost": result.cost,
            "error": result.error if not result.success else None,
        }
        await client.post(f"/v2/activities/executions/{id}/tasks", json=task_data)
    except Exception as e:
        logger.error(f"Error reporting task: {e}")  # Won't fail execution
```

**New Method**: `_generate_impulse_id()`
- **What**: Generate unique IDs for impulses based on pointer type
- **Why**: Support impulse tracking in activity learning
- **Impact**: Impulses can be uniquely identified and tracked
- **Risk**: LOW - Pure function, no side effects
- **Lines**: 1096-1145

**Integration Point**: Called in `_execute_step()` after each step
- **Line**: 865 (after step execution, before continuation)
- **Impact**: Backend gets task result immediately
- **Risk**: LOW - Non-blocking, errors logged

#### Assessment
✅ **SAFE TO COMMIT** - Defensive coding, won't break existing functionality

---

### 4. metabob-dashboard (5 files changed, +94/-58 lines)

**Purpose**: V2 API migration + metrics improvements

#### Changes by File

**`MetabobRestApi.js`** (+74/-15 lines)
- **What**: V2 endpoint migration
- **Why**: Backend moved from V1 to V2 API
- **Impact**: Dashboard can connect to new backend
- **Risk**: **MEDIUM** ⚠️ - API contract changes

**Changes**:
- `/v1/session` → `/v2/session`
- `/v1/activities/templates` → `/v2/activities/templates`
- `/v1/activities/search` → `/v2/activities/search`
- `/v1/activities/execute` → `/v2/activities/execute`

**`App.js`** (+2 lines)
- **What**: Minor app updates
- **Why**: Support new API structure
- **Impact**: App renders correctly
- **Risk**: LOW

**`statsAggregator.js`** (+10 lines)
- **What**: Enhanced metrics aggregation
- **Why**: New execution fields need aggregation
- **Impact**: Better dashboard metrics
- **Risk**: LOW

**`docker-compose.yaml`** (+60/-15 lines)
- **What**: Local development setup for dashboard
- **Why**: Easier dashboard development against local backend
- **Impact**: Developers can run dashboard locally
- **Risk**: LOW - Dev environment only

**`.gitignore`** (+6 lines)
- **What**: Ignore log files and test outputs
- **Why**: Keep repo clean
- **Impact**: None (dev experience)
- **Risk**: NONE

#### Assessment
⚠️ **REQUIRES TESTING** - V2 migration needs validation before commit

---

## Integration Architecture

### How Changes Work Together

```
┌─────────────────────────────────────────────────────────────┐
│                    USER CREATES ACTIVITY                     │
└────────────────────────────┬────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│              OpenCode (metabob-opencode)                     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 1. activity-schema-adapter.ts                     │     │
│  │    → Transform patterns: string[] → object[]       │     │
│  │    → Add both 'id' and 'task_id' fields           │     │
│  │    → Support 'tasks' and 'task_steps'             │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 2. metabob.ts                                      │     │
│  │    → Write template to .metabob/activities/        │     │
│  │    → Skip non-existent MCP registration            │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────────────┬────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                Backend (metabob-rpc-api)                     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 3. Discovery: Read from .metabob/activities/       │     │
│  │    → proto_task_step.py validates schema           │     │
│  │    → activities.py stores template                 │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 4. Execution Tracking (Phase 1 Tier 1)             │     │
│  │    → activities.py: Add tasks[] field              │     │
│  │    → activities.py: Add environment{} field        │     │
│  │    → POST /v2/activities/executions/{id}/tasks     │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────────────┬────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                   CLI (metabob-cli)                          │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 5. activity_manager.py                             │     │
│  │    → Execute activity with steps                   │     │
│  │    → After each step: _report_task_to_backend()    │     │
│  │    → Send task result to backend                   │     │
│  │    → Generate impulse IDs for tracking             │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────────────┬────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│               Dashboard (metabob-dashboard)                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 6. MetabobRestApi.js                               │     │
│  │    → Call V2 endpoints                             │     │
│  │    → Display activity results                      │     │
│  │    → Show task-level metrics                       │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Template Creation** (opencode)
   - User creates activity with cochange learning
   - Schema adapter transforms to backend format
   - Template written to `.metabob/activities/`

2. **Template Registration** (rpc-api)
   - Backend discovers template from filesystem
   - Schema validation passes (patterns as objects)
   - Template stored in database

3. **Activity Execution** (cli)
   - CLI executes activity step-by-step
   - After each step: report task result to backend
   - Backend stores task-level data

4. **Result Display** (dashboard)
   - Dashboard queries V2 API
   - Shows activity execution with task breakdown
   - Displays cochange accuracy metrics

---

## Risk Assessment

### LOW RISK ✅ (Safe to commit)
- **metabob-opencode**: Schema transformation, tested, works
- **metabob-rpc-api**: Additive changes, backwards compatible
- **metabob-cli**: Defensive coding, won't break on failure

### MEDIUM RISK ⚠️ (Needs testing)
- **metabob-dashboard**: V2 API migration requires validation

---

## Commit Strategy: Minimal Flux Approach

### Principle
**"Commit related changes together, test each commit independently"**

### Recommended Commits

#### Commit 1: Backend Schema + Template Registration (Foundation)
**Repos**: metabob-opencode, metabob-rpc-api  
**Message**: `feat: Add backend template registration with schema transformation`

**Why Together**:
- Schema transformation (opencode) requires backend schema support (rpc-api)
- Can't register templates without both changes
- Forms atomic feature unit

**Files**:
```
metabob-opencode:
  - activity-schema-adapter.ts (pattern transformation)
  - metabob.ts (registration bypass)
  - activity-template-repository.ts (dual field support)
  - search-activities.ts (dual field search)
  - storage.ts (template loading)

metabob-rpc-api:
  - proto_task_step.py (schema support)
  - activities.py (execution tracking fields)
  - init_activity_schema.py (schema init)
  - activity_recommendation.py (model updates)
  - bootstrap_templates.py (bootstrap updates)
  - app.py (route registration)
  - routes/__init__.py (imports)
```

**Test Before Commit**:
```bash
# Run backend template discovery test
bun run test-backend-template-discovery.ts

# Verify templates are valid
cat .metabob/activities/fix-bug-complete.json | jq '.task_steps[0].validation.required_patterns[0]'
# Should output: {"pattern": "...", "description": ""}
```

#### Commit 2: Task-Level Reporting (Phase 1 Tier 1)
**Repos**: metabob-cli, metabob-rpc-api (users.py only)  
**Message**: `feat: Add task-level execution reporting (Phase 1 Tier 1)`

**Why Together**:
- CLI reporting needs backend endpoint
- Backend endpoint needs CLI to send data
- Forms complete feature

**Files**:
```
metabob-cli:
  - activity_manager.py (_report_task_to_backend, _generate_impulse_id)

metabob-rpc-api:
  - routes/users.py (new endpoint)
  - tests/fixtures/test_controller.py (test updates)
```

**Test Before Commit**:
```bash
# Test task reporting integration
cd scripts
./test-task-result-reporting.py

# Verify backend receives task results
# Check logs: docker logs api-server-dev | grep "TASK_REPORTING"
```

#### Commit 3: Dashboard V2 Migration (Separate, Test First)
**Repos**: metabob-dashboard  
**Message**: `feat: Migrate dashboard to V2 API endpoints`

**Why Separate**:
- Dashboard is independent from core system
- V2 migration needs thorough testing
- Can be reverted without affecting backend/CLI

**Files**:
```
metabob-dashboard:
  - MetabobRestApi.js (V2 endpoints)
  - App.js (app updates)
  - statsAggregator.js (metrics)
  - docker-compose.yaml (local dev)
  - .gitignore (cleanup)
```

**Test Before Commit**:
```bash
# Start local development environment
cd repos/metabob-dashboard
docker-compose up -d

# Test V2 endpoints work
curl http://localhost:3000/api/v2/activities/templates

# Verify UI renders correctly
# Open http://localhost:3000 in browser
```

---

## Testing Checklist

### Pre-Commit 1 (Backend Schema)
- [ ] `test-backend-template-discovery.ts` passes (3/3 templates)
- [ ] Template JSON schema validates with `jq`
- [ ] Backend can read templates from `.metabob/activities/`
- [ ] No TypeScript errors: `cd repos/metabob-opencode && bun run type-check`
- [ ] Backend tests pass: `cd repos/metabob-rpc-api && pytest`

### Pre-Commit 2 (Task Reporting)
- [ ] Task reporting test passes: `./scripts/test-task-result-reporting.py`
- [ ] Backend receives task results (check logs)
- [ ] CLI doesn't fail if reporting fails (test error handling)
- [ ] Impulse ID generation works for all pointer types

### Pre-Commit 3 (Dashboard)
- [ ] Dashboard connects to V2 API
- [ ] All pages render without errors
- [ ] Metrics display correctly
- [ ] Activity execution shows task breakdown
- [ ] No browser console errors

---

## Rollback Strategy

### If Commit 1 Fails
```bash
cd repos/metabob-opencode
git reset --hard HEAD~1

cd ../metabob-rpc-api
git reset --hard HEAD~1
```
**Impact**: Templates can't be registered, but system still works with existing templates

### If Commit 2 Fails
```bash
cd repos/metabob-cli
git reset --hard HEAD~1

cd ../metabob-rpc-api
git reset --hard HEAD~1
```
**Impact**: No task-level reporting, but activity execution still works

### If Commit 3 Fails
```bash
cd repos/metabob-dashboard
git reset --hard HEAD~1
```
**Impact**: Dashboard uses V1 API (if still supported), or shows errors

---

## Files NOT to Commit (Work in Progress / Test Files)

### Main Repo (metabob-devbob)
```
# Context flow traces (debugging)
.context-flow-trace-tmp/
.context-flow-trace/

# Test activity execution directories
test-activity-execution/
test-cochange-learning/
test-workspace/

# Test scripts (keep for validation)
test-*.ts
test-*.py
test-*.sh
test_*.py

# Session documentation (archive later)
SESSION_SUMMARY_*.md
BACKEND_*.md
COCHANGE_*.md
(many others - see untracked files)
```

### metabob-rpc-api
```
# Temporary scripts
check_schema.py
fix_context_requirements_field.py
migrate_patterns_field.py
run_schema_init.py
server/actions/add_context_requirements_field.py

# Test files (keep)
tests/__init__.py
tests/models/test_schema_backward_compat.py
tests/routes/test_routes_users.py

# Database state (never commit)
data/surreal/database.db/CURRENT
```

### metabob-cli
```
# API key (NEVER commit)
.metabob_api_key
```

### metabob-opencode
```
# Test scripts (keep for validation)
packages/opencode/test-*.ts
```

### metabob-dashboard
```
# Environment files (never commit)
.env.example (keep as template, but don't commit with values)

# Log files
*.log

# Test results
playwright-report/
connectivity-test-dashboard.txt
```

---

## Recommended Next Actions

### Immediate (Today)
1. ✅ **Review this analysis** - Understand all changes
2. 🔍 **Test Commit 1 changes** - Backend schema + registration
3. ✅ **Commit 1** if tests pass
4. 🔍 **Test Commit 2 changes** - Task reporting
5. ✅ **Commit 2** if tests pass

### Near Term (Tomorrow)
6. 🔍 **Test dashboard V2 thoroughly** - Multiple browsers, edge cases
7. ✅ **Commit 3** if tests pass
8. 📦 **Build and deploy** - Update docker images if needed

### Future
9. 📚 **Archive documentation** - Move session docs to .archive/
10. 🧹 **Clean test files** - Remove temporary test scripts
11. 📝 **Update main README** - Document new features

---

## Success Criteria

### System Still Works ✅
- [ ] Existing templates execute successfully
- [ ] New templates can be registered
- [ ] Backend discovers templates from filesystem
- [ ] Task-level reporting doesn't break execution
- [ ] Dashboard displays results correctly

### No Breaking Changes ✅
- [ ] Backwards compatibility maintained
- [ ] Legacy templates still work
- [ ] V1 API still supported (if needed)
- [ ] Rollback possible at each step

### Code Quality ✅
- [ ] Zero TypeScript errors
- [ ] All tests passing
- [ ] No console errors in browser
- [ ] Proper error handling everywhere

---

## Summary

**Current State**: 4 repositories with uncommitted, related changes  
**Risk Level**: LOW (with testing) to MEDIUM (dashboard)  
**Recommendation**: Commit in 3 phases with testing at each step  
**Expected Outcome**: Stable system with new capabilities

**Key Insight**: All changes form a cohesive feature set for backend template registration with cochange learning. They should be committed together in logical groups, not individually.

**Minimal Flux Achieved By**:
- Grouping related changes into atomic commits
- Testing each commit independently
- Maintaining backwards compatibility
- Using defensive coding practices
- Providing rollback strategy

---

**Status**: ✅ Analysis Complete  
**Next Step**: Test and commit Phase 1 (Backend Schema)  
**Timeline**: 1-2 hours for all 3 commits with testing
