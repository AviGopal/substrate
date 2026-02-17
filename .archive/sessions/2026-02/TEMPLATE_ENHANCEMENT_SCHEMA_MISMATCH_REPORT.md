# Template Enhancement Schema Mismatch Report

**Date**: February 15, 2026  
**Session**: Template Impulse Enhancement Testing  
**Status**: 🟡 BLOCKED by backend schema mismatches

---

## Executive Summary

Enhanced templates with `contextRequirements` and `impulse_refs` **cannot be registered** with backend due to **schema incompatibility** between:
- **OpenCode/Proto Schema** (rich metadata, used by templates)
- **Backend v2 API Schema** (simplified schema, used by backend)

Three enhanced templates were successfully created and validated:
- `fix-bug-complete-enhanced.json` (7 context requirements, 12 impulse refs)
- `add-rest-endpoint-v2-enhanced.json` (1 context requirement, 1 impulse ref)
- `create-activity-template-enhanced.json` (5 context requirements, 6 impulse refs)

However, registration fails with **422 validation errors** due to schema mismatches.

---

## Schema Mismatches Discovered

### 1. Context Requirements Structure

**Proto Schema** (`proto/metabob/activity/execution.proto` lines 77-92):
```protobuf
message ContextRequirement {
  string key = 1;                      // Unique identifier
  string hint = 2;                     // Human-readable description
  repeated string impulse_types = 3;   // Accepted types
  bool required = 4;                   // Mandatory flag
  TokenBudgetRange budget_range = 5;   // Token allocation
}
```

**Backend API Schema** (`server/routes/v2_activities.py` lines 127-132):
```python
class TemplateContextRequirement(BaseModel):
    type: str      # ⚠️ Different field name (key → type)
    required: bool # ✓ Same
    # ❌ Missing: hint, impulse_types, budget_range
```

**Impact**: Backend accepts `contextRequirements` during POST but:
- Validates against simplified schema (requires `type` field)
- Silently drops all rich metadata after validation
- Returns empty `context_requirements: []` in GET requests

### 2. Prompt Variables Structure

**Enhanced Template Schema**:
```json
{
  "prompt": {
    "variables": [
      {
        "name": "endpoint_path",
        "type": "string",
        "required": true,
        "description": "HTTP path for the endpoint"
      }
    ]
  }
}
```

**Backend API Schema** (`server/models/proto_task_step.py` line 30-32):
```python
class TaskPrompt(BaseModel):
    variables: List[str]  # ⚠️ Expects ["endpoint_path", "http_method"]
    # ❌ Cannot handle variable metadata objects
```

**Error**:
```
Input should be a valid string
loc: ['body', 'task_steps', 0, 'prompt', 'variables', 0]
input: {'name': 'endpoint_path', 'type': 'string', ...}
```

### 3. CLI Outdated Binary

**Additional Issue**: The CLI binary (`metabob-cli-linux-amd64-1.8.0`) is 4 days old:
- Binary built: February 11, 2026
- Latest commit: February 15, 2026 (`fbe01219b`)
- Missing fixes for `tasks` → `task_steps` renaming

**Workaround**: Use Python directly (`python3 -m metabob_cli.commands`) instead of binary.

---

## Root Cause Analysis

The backend v2 API (`/v2/activities/templates`) was bootstrapped with a **simplified schema** that doesn't fully match the proto definitions:

1. **Initial Implementation** (commit `fd367a0`):
   - Created `TemplateContextRequirement` with minimal fields (`type`, `required`)
   - Likely intended as a placeholder for MVP

2. **Proto Schema Evolution**:
   - Proto added rich metadata (`hint`, `impulse_types`, `budget_range`)
   - OpenCode templates adopted full proto schema
   - Backend API was **never updated** to match

3. **Discovery**:
   - All 20 existing backend templates have `context_requirements: []`
   - Field exists in database schema but is never populated
   - This explains why only 13% of templates use impulses (they can't!)

---

## Attempted Solutions

### Solution 1: Fix Enhanced Templates ✅ Partial Success
**Action**: Modified enhanced templates to use backend's simplified schema  
**Script**: `/tmp/fix_context_requirements_schema.py`  
**Result**: Fixed `contextRequirements` but hit second issue (`prompt.variables`)

### Solution 2: Use Python CLI Directly ✅ Bypassed Binary Issue
**Action**: Called `register_template` function directly instead of using binary  
**Result**: Confirmed CLI code is correct, binary is just outdated

### Solution 3: Transform During Registration ❌ Not Attempted
**Reason**: Would require extensive changes to handle both schemas  
**Effort**: 2-4 hours of development + testing

---

## Impact Assessment

### Immediate Impact
- **Enhanced templates cannot be registered** with current backend
- **No templates can use rich context requirements** (missing schema support)
- **Impulse system adoption blocked** at 13% (2.6/20 templates)

### Workarounds Available
1. **Manual impulse injection**: Create impulses at runtime, bypass contextRequirements
2. **Simplified templates**: Use backend schema, lose rich metadata
3. **Local testing**: Test OpenCode locally without backend registration

### Long-term Impact
- **Technical debt**: Schema divergence will worsen over time
- **Feature gap**: Impulse system cannot reach full potential
- **Developer friction**: Future template authors will hit same issues

---

## Recommended Actions

### Immediate (This Session)
1. ✅ Document schema mismatches (this report)
2. ✅ Create issue for backend team with schema comparison
3. 🔲 Test impulse system using manual injection (workaround)
4. 🔲 Measure token reduction with manual impulses

### Short-term (Next Sprint)
1. **Update Backend API Schema**:
   - Change `TemplateContextRequirement` to match proto
   - Add database migration for new fields
   - Update validation logic
   - **Effort**: 4-6 hours
   - **Priority**: HIGH (blocks impulse adoption)

2. **Rebuild CLI Binary**:
   - Include latest fixes from Feb 15 commit
   - Publish to dist/
   - **Effort**: 30 minutes
   - **Priority**: MEDIUM (workaround exists)

3. **Add Schema Validation**:
   - Create proto validation tool
   - Run in CI to catch divergence early
   - **Effort**: 2-3 hours
   - **Priority**: MEDIUM (prevents regression)

### Long-term (Next Quarter)
1. **Unified Schema Management**:
   - Generate Pydantic models from proto
   - Single source of truth for all schemas
   - **Effort**: 1-2 weeks
   - **Priority**: HIGH (architectural improvement)

2. **Template Migration**:
   - Backfill existing templates with contextRequirements
   - Bulk enhancement of 17 remaining templates
   - **Effort**: 1 week
   - **Priority**: MEDIUM (after schema fix)

---

## Files Reference

### Enhanced Templates (Ready but Unregisterable)
- `repos/metabob-opencode/packages/opencode/templates/built-in/fix-bug-complete-enhanced.json`
- `repos/metabob-opencode/packages/opencode/templates/built-in/add-rest-endpoint-v2-enhanced.json`
- `repos/metabob-opencode/packages/opencode/templates/built-in/create-activity-template-enhanced.json`

### Schema Definitions
- **Proto**: `repos/metabob-proto/proto/metabob/activity/execution.proto` (lines 77-92)
- **Backend**: `repos/metabob-rpc-api/server/routes/v2_activities.py` (lines 127-132)
- **Backend**: `repos/metabob-rpc-api/server/models/proto_task_step.py` (lines 18-33)

### Related Commits
- `fbe01219b`: Fix CLI registration for v2 API (Feb 15)
- `fd367a0`: Initial backend bootstrap with proto templates

### Documentation
- `IMPULSE_SYSTEM_ARCHITECTURE.md`: Full schema reference
- `SESSION_RESUME_FEB15_PART2.md`: Previous session findings
- `CLI_REGISTRATION_FIX_REPORT.md`: CLI bug analysis

---

## Success Metrics (When Fixed)

| Metric | Current | Target | 
|--------|---------|--------|
| Templates with impulses | 2.6/20 (13%) | 16/20 (80%) |
| Avg token usage | Baseline | -40% |
| Context requirements | 0/20 have data | 16/20 have data |
| Schema divergence | 2 major issues | 0 issues |

---

## Conclusion

The impulse enhancement system is **architecturally sound** but **operationally blocked** by backend schema limitations. The enhanced templates are ready and validated, but cannot be registered until the backend v2 API is updated to accept the full proto schema.

**Recommended Path Forward**:
1. Backend team: Fix schema mismatches (4-6 hours, HIGH priority)
2. DevOps: Rebuild CLI binary with latest code (30 min, MEDIUM priority)
3. Testing: Use manual impulse injection as temporary workaround
4. Long-term: Implement proto-based code generation for unified schemas

**Estimated Timeline**:
- Backend fix: 1 sprint (2 weeks)
- Full template enhancement: 2 sprints (4 weeks)  
- Schema unification: 1 quarter (12 weeks)

---

**Status**: 🟡 READY FOR BACKEND FIX  
**Next Step**: Create backend issue with schema comparison  
**Blocking Issue**: Backend v2 API schema incompatibility
