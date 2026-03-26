# Activity Lifecycle Dynamic Creation Boredom Evolution - Implementation Trace

**Specification**: activity-lifecycle-dynamic-creation-boredom-evolution  
**Trace Date**: 2026-03-08  
**Status**: PARTIALLY IMPLEMENTED - Critical gaps in lifecycle integration

## Executive Summary

The activity lifecycle system has **foundational components in place** but lacks **integration logic** to connect:
1. Dynamic creation trigger when no existing activity matches
2. Automatic storage of all created activities for pattern learning
3. Pattern extraction and boredom activity generation
4. Activity evolution (split/merge/debug) based on execution patterns
5. Multi-tenant org/project scoping enforcement

**Current State**: Phase 1 typing complete (commit f8f7162), boredom infrastructure exists but not integrated into lifecycle flow.

**Desired State**: Complete autonomous lifecycle from search → dynamic creation → execution → learning → evolution → boredom improvement.

---

## Component-by-Component Analysis

### 1. Dynamic Activity Creation (create_activity_goal_seeking)

**File**: `repos/metabob-opencode/packages/opencode/src/tool/create-activity-goal-seeking.ts`

**Current Behavior**:
- ✅ Tool exists and is functional
- ✅ Accepts goal description, decomposes into task DAG
- ✅ Registers template to backend via TemplateRepository.save()
- ✅ Supports impulse injection and composition of existing activities

**Desired Behavior**:
- ❌ Should be triggered automatically when search finds no matching template
- ❌ Should be invoked by recommendation system as fallback strategy

**Gap**: No trigger logic in search/recommendation flow. The tool exists but is never called automatically.

**Trace Evidence**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:39` - metabob_search_activities returns empty list if no match, but doesn't trigger creation
- No code path from "template not found" → "create_activity_goal_seeking"

---

### 2. Activity Storage for Learning

**Files**:
- `repos/metabob-rpc-api/server/routes/activity.py:1082` - POST /content endpoint
- `repos/metabob-rpc-api/server/db/operations/activity_content.py` - insert_activity_content
- `repos/metabob-opencode/packages/opencode/src/tool/create-activity-goal-seeking.ts:170` - TemplateRepository.save()

**Current Behavior**:
- ✅ POST /v2/activities/content endpoint exists to store activity execution context
- ✅ Stores template_definition, variable_bindings, reason, initial_state
- ✅ create_activity_goal_seeking calls TemplateRepository.save(template, ["metabob"])

**Desired Behavior**:
- ❌ All dynamically created activities should be auto-stored
- ❌ Execution metadata should include pattern extraction results
- ❌ Storage should be scoped by (api_key, project_id) for multi-tenant isolation

**Gap**: POST /content endpoint exists but is not called after dynamic creation. No automatic persistence hook.

**Trace Evidence**:
- `repos/metabob-opencode/packages/opencode/src/tool/create-activity-goal-seeking.ts:170` - saves to backend but doesn't POST execution context
- No code path from "template created" → "store activity content"

---

### 3. Pattern Extraction Service

**File**: `repos/metabob-rpc-api/server/services/pattern_extraction_service.py`

**Current Behavior**:
- ✅ Comprehensive pattern extraction logic exists
- ✅ Extracts file_paths, components_modified, common_patterns, complexity_indicators
- ✅ Used in learning_loop routes for impulse mapping analysis

**Desired Behavior**:
- ❌ Should run periodically on all stored activities
- ❌ Should identify common tasks across multiple activities
- ❌ Should detect split/merge candidates
- ❌ Results should feed boredom activity generator

**Gap**: Pattern extraction is only used for impulse analysis, not for template evolution or boredom activity generation.

**Trace Evidence**:
- `repos/metabob-rpc-api/server/routes/learning_loop.py:1076` - extract_patterns called in impulse-mappings endpoint
- No periodic job or cron to run pattern extraction on all activities
- No code to detect split/merge candidates based on patterns

---

### 4. Boredom Activity System

**Files**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:565` - metabob_fetch_boredom_activities MCP tool
- `repos/metabob-rpc-api/server/routes/learning_loop.py:575` - GET /boredom-activities endpoint
- `repos/metabob-rpc-api/server/db/operations/template_metrics.py:292` - get_boredom_candidates

**Current Behavior**:
- ✅ MCP tool metabob_fetch_boredom_activities exists and callable
- ✅ Backend GET /api/v1/learning-loop/boredom-activities endpoint functional
- ✅ Queries templates with low improvement_gradient
- ✅ Returns prioritized list sorted by improvement need

**Desired Behavior**:
- ❌ Should include split/merge recommendations (not just "improve-template")
- ❌ Should include debug-failures activities with specific error patterns
- ❌ Should be called periodically by vessels/agents during idle time
- ❌ Results should trigger evolution workflow (split, merge, debug)

**Gap**: Boredom activities only return "improve-template" type. No split/merge logic. No automated scheduling.

**Trace Evidence**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:608` - only creates "improve-template" activities
- No code for activity_type: "split-oversized", "merge-similar", "debug-failures"
- No cron/scheduler to call metabob_fetch_boredom_activities periodically

---

### 5. Activity Evolution (Split/Merge/Debug)

**Files**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:2062` - derive_variant function
- `repos/metabob-cli/src/metabob_cli/mcp/tools.py:4467` - derive_variant_tool

**Current Behavior**:
- ✅ derive_variant function exists to create evolved templates
- ✅ Tracks evolution_type (derived, optimized, merged) and evolution_note
- ✅ Persists variants to backend

**Desired Behavior**:
- ❌ Should be triggered by boredom activities
- ❌ Should have logic to split oversized activities (e.g., >7 tasks)
- ❌ Should have logic to merge similar activities (detected by pattern extraction)
- ❌ Should have logic to debug failing patterns

**Gap**: No split/merge/debug implementation. derive_variant exists but only for manual trailblazing fixes.

**Trace Evidence**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:1931` - evolution_note used for trailblaze fixes, not autonomous evolution
- No code to split activity into smaller sub-activities
- No code to merge similar activities
- No code to auto-debug failure patterns

---

### 6. Replay Validation System

**Files**:
- `repos/metabob-opencode/packages/opencode/src/tool/activity-replay.ts` - ActivityReplayTool
- `repos/metabob-rpc-api/server/routes/activity.py:1087` - POST /content for replay context

**Current Behavior**:
- ✅ activity_replay tool exists and functional
- ✅ Loads original activity, determines starting task, creates replay activity
- ✅ Inherits impulses from original activity
- ✅ Executes remaining tasks and tracks metrics

**Desired Behavior**:
- ❌ Should enable evolution comparison: run original template vs evolved variant
- ❌ Should compare validator results field-by-field
- ❌ Should measure success rate delta
- ❌ Should auto-promote evolved variant if metrics improve

**Gap**: Replay exists for debugging, not for evolution validation. No comparison logic.

**Trace Evidence**:
- `repos/metabob-opencode/packages/opencode/src/tool/activity-replay.ts:148` - runs template but doesn't compare outputs
- No code to compare original vs replay outputs
- No auto-promotion logic based on replay results

---

### 7. Multi-Tenant Scoping

**Files**:
- `repos/metabob-rpc-api/server/routes/activity.py:67` - ActivityCreateRequest with api_key
- `repos/metabob-rpc-api/server/routes/impulse.py:88` - ImpulseCreateRequest with api_key, project_id
- `repos/metabob-rpc-api/server/actions/activity.py:260` - list_templates with org_id, project_id filtering

**Current Behavior**:
- ✅ Template queries filter by scope (global, org, project)
- ✅ Org-scoped templates only visible to users in that org
- ✅ Project-scoped templates only visible to users in that project
- ✅ Impulse endpoints enforce (api_key, project_id) scoping

**Desired Behavior**:
- ✅ Already enforced for template listing
- ❌ Needs verification for boredom activities (should be scoped)
- ❌ Needs verification for pattern extraction (should not leak cross-org data)

**Gap**: Scoping enforcement exists for templates but needs audit for boredom and pattern extraction flows.

**Trace Evidence**:
- `repos/metabob-rpc-api/server/actions/activity.py:260` - multi-tenant filtering in list_templates
- `repos/metabob-rpc-api/server/routes/learning_loop.py:575` - get_boredom_activities does NOT enforce org/project scoping (BUG!)

---

## Critical Gaps Summary

| Gap ID | Component | Description | Impact | Priority |
|--------|-----------|-------------|--------|----------|
| GAP-1 | Dynamic Creation Trigger | No automatic trigger when search finds no template | Users must manually call create_activity_goal_seeking | **CRITICAL** |
| GAP-2 | Activity Storage Hook | No POST /content after dynamic creation | Created activities not stored for learning | **CRITICAL** |
| GAP-3 | Pattern Extraction Scheduler | No periodic job to run pattern extraction | Pattern learning never happens | **CRITICAL** |
| GAP-4 | Split/Merge Detection | No logic to detect oversized or duplicate activities | Boredom activities incomplete | **HIGH** |
| GAP-5 | Boredom Activity Types | Only "improve-template", missing split/merge/debug | Evolution workflow blocked | **HIGH** |
| GAP-6 | Evolution Logic | No implementation of split/merge/debug actions | Boredom activities can't be executed | **HIGH** |
| GAP-7 | Replay Comparison | No output comparison for evolved variants | Can't validate if evolution helped | **MEDIUM** |
| GAP-8 | Auto-Promotion | No logic to promote evolved variants | Manual intervention required | **MEDIUM** |
| GAP-9 | Boredom Scoping | get_boredom_activities doesn't filter by org/project | Cross-org data leakage risk | **HIGH** |
| GAP-10 | Periodic Scheduling | No cron/scheduler for pattern extraction or boredom generation | System never runs autonomously | **CRITICAL** |

---

## Implementation Roadmap (5 Phases)

### Phase 1: Connect Dynamic Creation (Week 1)
- Add fallback logic in metabob_search_activities
- Add storage hook in create_activity_goal_seeking

### Phase 2: Pattern Extraction Pipeline (Week 2)
- Create pattern extraction cron job
- Add split/merge detection logic

### Phase 3: Boredom Activity Types (Week 3)
- Extend get_boredom_activities to include split/merge/debug
- Add org/project scoping to boredom activities

### Phase 4: Evolution Execution (Week 4)
- Implement split/merge/debug actions

### Phase 5: Replay Validation (Week 5)
- Add output comparison logic
- Implement auto-promotion based on metrics

**Estimated Total**: 4-5 weeks

---

## Conclusion

The activity lifecycle system has **strong foundational components** but lacks **12+ critical integration points** to enable the autonomous lifecycle.

**Key blockers**:
1. No trigger for dynamic creation when search fails (GAP-1)
2. No storage of created activities for learning (GAP-2)
3. No periodic pattern extraction (GAP-3)
4. No split/merge/debug logic (GAP-4, GAP-5, GAP-6)
5. No multi-tenant scoping in boredom API (GAP-9)

**Risk**: Without these integrations, the system cannot learn from executions or autonomously improve templates.
