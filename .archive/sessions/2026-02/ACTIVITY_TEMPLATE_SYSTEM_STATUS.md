# Activity Template System - Current Status Report

**Date**: 2026-02-16  
**Purpose**: Document architecture violations, current state, and path to self-sustaining system  
**Priority**: CRITICAL - Blocking cold-start reliability

---

## Executive Summary

### Critical Discovery
**metabob-opencode has built-in templates - THIS IS AN ARCHITECTURAL VIOLATION**

The correct architecture is:
1. **metabob-rpc-api** (backend) - Single source of truth for templates (SurrealDB)
2. **metabob-cli** - Provides MCP tools to access backend templates
3. **metabob-opencode** - Consumes templates via metabob-cli MCP, NO local templates

### Current Status: 🔴 PARTIALLY BROKEN

- ✅ Backend API running (localhost:8080)
- ✅ SurrealDB operational with 20 templates
- ✅ Bootstrap script functional (4/16 templates uploaded successfully)
- ⚠️  **metabob-opencode has 6 built-in templates** (should be 0)
- ⚠️  Template name field is null in backend responses (proto conversion bug)
- ❌ 12 bootstrap templates failed with 500 errors
- ❓ metabob-cli MCP search_activities integration untested

---

## Architecture Violations Identified

### 1. Built-in Templates in metabob-opencode

**Location**: `repos/metabob-opencode/packages/opencode/templates/built-in/`

**Files** (SHOULD NOT EXIST):
```
create-activity-template.json
add-rest-endpoint-v2.json
fix-bug-complete.json
fix-bug-complete-enhanced.json
add-rest-endpoint-v2-enhanced.json
create-activity-template-enhanced.json
```

**Impact**:
- Creates dual source of truth (local files + backend)
- Prevents true cold-start capability
- Templates can diverge between environments
- Breaks the metabob-cli → metabob-rpc-api → opencode flow

**Fix Required**: Remove all built-in templates from metabob-opencode

---

## Correct Architecture Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    metabob-proto Repository                       │
│  Source of Truth: Template Definitions                           │
│  Location: repos/metabob-proto/activities/bootstrap/*.json       │
│  Count: 16 bootstrap templates                                   │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ bootstrap_templates.py
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│              metabob-rpc-api Backend (Port 8080)                  │
│  Storage: SurrealDB (localhost:8000)                             │
│  API: /v2/activities/templates                                   │
│  Current State: 20 templates (names are null - BUG)              │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ HTTP API calls
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│                 metabob-cli MCP Server                            │
│  Role: Provide MCP tools to query backend                        │
│  Tools: search_activities, get_template, register_template       │
│  Transport: stdio (for claude-code) or SSE (for Cursor)          │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ MCP protocol
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│            metabob-opencode Activity Mode Agent                   │
│  Role: Execute activities by discovering templates via MCP        │
│  Tool Calls: search_activities({ category: "feature" })          │
│  NO LOCAL TEMPLATES - Query backend only                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Bootstrap Status

### Bootstrap Script Location
`repos/metabob-rpc-api/scripts/bootstrap_templates.py`

### Templates in metabob-proto (16 total)

**✅ Successfully Uploaded (4)**:
1. `activity-create-v2` - Create new activity templates
2. `add-rest-endpoint-v1` - Add REST endpoint
3. `fix-security-bug-v1` - Fix security vulnerability
4. `safe-refactor-v1` - Safe refactoring with tests

**❌ Failed to Upload (12)** - Status 500 "Failed to create template":
1. code-analysis-v1
2. bug-fix-v1
3. feature-impl-v1
4. refactor-v1
5. activity-create-v1
6. activity-debug-v1
7. activity-evolve-v1
8. boredom-task-processor-v1
9. jiggle-documentation-v1
10. create-activity-template-v3
11. create-activity-template-v3-compat
12. security-audit-complete

### Root Cause Analysis

**Why did 12 fail?**
- Likely: Proto schema mismatch between old format and new ActivityTemplate proto
- Evidence: The 4 that succeeded are marked "Already proto format (enriching with defaults)"
- Evidence: Template names are null in API responses (conversion bug)

**Authentication Working**:
```bash
# Bootstrap session created successfully
export METABOB_API_KEY='c2Vzc2lvbnM6YjZmODBkY2MtYjQ3NC00MjU0LThiZTgtZDNmNmU3Y2QzYWQ2OmJvb3RzdHJhcC1vcmc6Ym9vdHN0cmFwLXVzZXI='
```

---

## Critical Bugs Identified

### Bug 1: Template Name Field is Null

**Evidence**:
```json
{
  "id": "feature-34f1db5a",
  "variant_id": "feature-34f1db5a",
  "activity_id": "feature",
  "name": null,  // ❌ SHOULD BE "Test Schema Enhanced"
  "category": null  // ❌ SHOULD BE "feature"
}
```

**Impact**: 
- search_activities will return templates with no names
- Agents cannot distinguish between templates
- User experience broken

**Location**: Likely in proto → JSON conversion
- `repos/metabob-rpc-api/server/models/proto_adapter.py`
- `repos/metabob-rpc-api/server/routes/v2_activities.py`

### Bug 2: Bootstrap Conversion Failing for 75% of Templates

**Symptoms**:
- 12/16 templates fail with HTTP 500
- Error message: "Failed to create template"
- Only proto-format templates succeed

**Root Cause**: 
Template conversion logic in `bootstrap_templates.py` doesn't properly transform old format to ActivityTemplate proto schema.

---

## Testing Required

### 1. Test metabob-cli MCP Integration

**Command**:
```bash
cd repos/metabob-cli
metabob-cli mcp --transport stdio --agent claude-code
```

**MCP Tools to Test**:
- `search_activities({ category: "feature" })` - Should return 4+ templates
- `activity({ activityId: "add-rest-endpoint-v1", variables: {...} })` - Execute template
- `register_activity_template({ file_path: "template.json" })` - Upload new template

**Expected Behavior**:
- MCP server connects to backend at localhost:8080
- Uses bootstrap session token for auth
- Returns templates with proper names and categories
- Execution creates activity instance and tracks outcome

### 2. Test Activity Execution End-to-End

**Flow**:
1. Agent calls `search_activities()` via MCP
2. Agent selects template (e.g., `add-rest-endpoint-v1`)
3. Agent calls `activity()` tool with variables
4. Activity executes, delegates to subagents
5. Outcome recorded to backend
6. Template metrics updated

**Success Criteria**:
- ✅ Template discovered via search
- ✅ Activity instance created
- ✅ Tasks execute successfully
- ✅ Outcome recorded with cochange accuracy
- ✅ Template metrics reflect execution

---

## Required Fixes (Priority Order)

### 🔴 CRITICAL - Blocking all activity usage

#### 1. Fix Template Name/Category Null Bug
**Location**: `repos/metabob-rpc-api/server/models/proto_adapter.py` or `v2_activities.py`
**Issue**: Proto → JSON conversion drops `variant_name` and uses wrong field names
**Fix**: Map `variant_name` → `name`, `activity_id` category extraction
**Test**: `GET /v2/activities/templates` returns proper names

#### 2. Fix Bootstrap Conversion for Remaining 12 Templates
**Location**: `repos/metabob-rpc-api/scripts/bootstrap_templates.py`
**Issue**: Old-format templates not properly converted to proto schema
**Fix**: Implement proper schema transformation or update source templates
**Test**: All 16 templates bootstrap without 500 errors

#### 3. Remove Built-in Templates from metabob-opencode
**Location**: `repos/metabob-opencode/packages/opencode/templates/built-in/`
**Issue**: Dual source of truth, violates architecture
**Fix**: Delete directory, update TemplateRepository to use metabob-cli MCP only
**Test**: `opencode` works with templates only from backend

### 🟡 HIGH - Required for self-sustaining system

#### 4. Validate metabob-cli MCP search_activities
**Action**: Start MCP server, test with opencode
**Test**: Activity Mode can discover and execute templates

#### 5. Validate Activity Outcome Recording
**Action**: Execute an activity, verify outcome in backend
**Test**: `/v2/activities/{id}/outcomes` returns recorded data

#### 6. Test create-activity-template Activity
**Action**: Use `activity-create-v2` to create a new template
**Test**: New template appears in backend, discoverable via search

### 🟢 MEDIUM - Future improvements

#### 7. Implement improve-activity-template Activity
**Purpose**: Use recorded outcomes to generate better template variants
**Requires**: Outcome recording working, template evolution API

#### 8. Enable Cross-Project Learning
**Purpose**: Generalize templates into recipes (per ACTIVITY_LEARNING_SYSTEM.md)
**Status**: Not implemented, future phase

---

## Self-Sustaining System Requirements

For the system to be self-sustaining in a cold-start environment:

### Must Have:
1. ✅ Backend running with SurrealDB
2. ✅ Bootstrap script populates initial templates
3. ❌ **All templates stored in backend** (currently: some in opencode)
4. ❌ **Template discovery via MCP works** (untested)
5. ❌ **Activity execution works** (untested end-to-end)
6. ❌ **Outcome recording works** (infrastructure exists, untested)
7. ❌ **create-activity-template works** (allows creating new templates)

### Cold Start Bootstrap Sequence:
```bash
# 1. Start backend services
docker compose up -d

# 2. Bootstrap templates from metabob-proto
cd repos/metabob-rpc-api
export METABOB_API_KEY='<bootstrap_token>'
python scripts/bootstrap_templates.py

# 3. Start metabob-cli MCP server
cd repos/metabob-cli
metabob-cli mcp --transport stdio --agent claude-code

# 4. Start opencode with MCP integration
cd repos/metabob-opencode
opencode <command>

# 5. Agent uses search_activities to discover templates
# 6. Agent executes activities via activity() tool
# 7. Agent creates new templates via create-activity-template
```

---

## Next Steps

### Immediate Actions (Today)

1. **Fix template name bug** (1-2 hours)
   - Investigate proto_adapter.py conversion
   - Fix field mapping
   - Test GET /v2/activities/templates

2. **Fix bootstrap script** (2-3 hours)
   - Debug why 12 templates fail
   - Update conversion logic or source templates
   - Re-run bootstrap until all 16 succeed

3. **Remove built-in templates** (30 minutes)
   - Delete `repos/metabob-opencode/packages/opencode/templates/built-in/`
   - Update TemplateLoader to use MCP only
   - Test that search still works

### Short Term (This Week)

4. **Test MCP integration** (2-3 hours)
   - Start metabob-cli MCP server
   - Call search_activities from opencode
   - Verify templates returned correctly

5. **Test activity execution** (3-4 hours)
   - Execute add-rest-endpoint-v1 template
   - Verify all tasks complete
   - Check outcome recorded in backend

6. **Validate create-activity-template** (2-3 hours)
   - Run activity-create-v2 to make new template
   - Verify new template in backend
   - Execute new template to test it works

### Medium Term (Next Week)

7. **Create improve-activity-template activity** (1-2 days)
   - Design template that analyzes outcomes
   - Generates variant with improvements
   - Registers variant with genealogy

8. **Document correct workflows** (1 day)
   - Update ARCHITECTURE.md
   - Create ACTIVITY_TEMPLATE_GUIDE.md
   - Update developer documentation

---

## Success Metrics

### Phase 1: Basic Functionality
- [ ] All 16 templates bootstrap successfully
- [ ] Template names appear correctly in API
- [ ] metabob-opencode has 0 built-in templates
- [ ] search_activities returns correct results

### Phase 2: Self-Sustaining
- [ ] Activity execution works end-to-end
- [ ] Outcomes recorded to backend
- [ ] create-activity-template creates new templates
- [ ] New templates discoverable via search

### Phase 3: Learning Loop
- [ ] improve-activity-template generates variants
- [ ] Variants have proper genealogy tracking
- [ ] Cochange accuracy improves over time
- [ ] Template metrics guide recommendations

---

## Questions for Clarification

1. **Template Format**: Should all templates in metabob-proto be converted to full proto format?
2. **Backward Compatibility**: Do we need to support old-format templates or can we require proto?
3. **Local Cache**: Should opencode cache templates locally (with TTL) or always query backend?
4. **MCP Transport**: For cold-start, which transport should we prioritize (stdio vs SSE)?
5. **Bootstrap Frequency**: Should bootstrap be idempotent (re-running updates existing templates)?

---

## References

- **Architecture Doc**: `repos/metabob-rpc-api/docs/activities/ACTIVITY_LEARNING_SYSTEM.md`
- **Cochange Guide**: `COCHANGE_IMPULSE_ACTIVITY_LEARNING_GUIDE.md` (in context)
- **Proto Definitions**: `repos/metabob-proto/activities/bootstrap/*.json`
- **Template Repository**: `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`
- **Bootstrap Script**: `repos/metabob-rpc-api/scripts/bootstrap_templates.py`

---

**Document Status**: DRAFT - Findings from investigation session 2026-02-16
**Next Update**: After fixing critical bugs and testing MCP integration
