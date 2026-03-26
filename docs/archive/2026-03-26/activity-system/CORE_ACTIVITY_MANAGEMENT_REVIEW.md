# Core Activity Management Templates - System Review

**Date**: 2026-02-20  
**Purpose**: Review core activity management templates for production readiness  
**Status**: 🔍 NEEDS ATTENTION

---

## Executive Summary

You are **absolutely correct** - the **activity management templates** are the **core development templates**:

1. **create-activity-self-contained** - Create new templates (the system creates itself)
2. **debug-activity-self-contained** - Debug failed executions (the system debugs itself)
3. **evolve-activity-self-contained** - Improve templates (the system improves itself)

These are the **minimum viable set** for a self-improving system. Without them:
- ❌ Cannot create new templates for novel patterns
- ❌ Cannot debug and fix templates that fail
- ❌ Cannot evolve templates based on learnings

**Other templates** (add-feature, fix-bug, refactor, hello-world) are **applications** of the system, not its core.

---

## The Instructional→Functional State Bridge

### Your Core Insight

> "When writing code we are performing a sequence of functional state transitions where we take a codebase and mutate/create/delete its constituent components."

**The Learning Problem**: 
- **Instructional state** (context tokens) → must guide → **functional state transitions** (code mutations)
- **Goal**: Learn what instructional state produces correct functional transitions
- **Method**: Measure execution outcomes, refine templates via Thompson Sampling

### What We're Building

A **self-improving system** that:
1. **Executes** activities (functional state transitions)
2. **Measures** outcomes (success, cost, duration, quality)
3. **Learns** what works (Thompson Sampling selects best variants)
4. **Creates** new templates for novel patterns (create-activity)
5. **Debugs** failures (debug-activity)
6. **Evolves** templates based on data (evolve-activity)

This is **metacognition** - the system becoming itself through measured learning.

---

## Current State: Core Templates

### 1. create-activity-self-contained

**Purpose**: Create new activity templates  
**Tasks**: 4 (gather-requirements → design-task-graph → write-template-json → register-with-backend)  
**Status**: ⚠️ **HAS KNOWN ISSUES**

**Known Issue - Variable Self-Reference**:
```json
{
  "name": "templateId",
  "type": "string",
  "required": false,
  "description": "Kebab-case template ID",
  "default": "{{templateId}}"  // ❌ SELF-REFERENCE!
}
```

**Problem**: Variable defaults to itself, causing undefined behavior:
- Task 1 uses `/tmp/activity-template-{{templateId}}/REQUIREMENTS.md`
- Task 3 uses `/tmp/activity-template-{{templateId}}/{{templateId}}.json`
- If `templateId` is undefined or self-referencing → path resolution fails

**Evidence**:
- ACTIVITY_SYSTEM_PROOF_COMPLETE.md: "0% success rate over 7 runs"
- BOOTSTRAP_TEMPLATES_COMPLETE.md: "Agent spawns but uses no tools"
- BUG_3_FIX_COMPLETE.md: "Task 3 fails with 'Missing variables' errors"

**Root Cause Analysis**:
The template expects `templateId` to be:
1. **Provided by user** as input variable, OR
2. **Generated** from `templateName` (kebab-case conversion)

But the default `"{{templateId}}"` creates a circular reference:
- If not provided → uses `{{templateId}}` as value
- Variable interpolation tries to resolve `{{templateId}}`
- But `templateId` = `{{templateId}}` → infinite loop or undefined

**Correct Fix**:
```json
{
  "name": "templateId",
  "type": "string",
  "required": false,
  "description": "Kebab-case template ID (auto-generated from templateName if not provided)",
  "default": ""  // Empty string, or remove default entirely
}
```

Then in Task 1 or pre-hook, generate `templateId` from `templateName`:
```bash
# If templateId is empty, generate from templateName
if [ -z "$templateId" ]; then
  templateId=$(echo "$templateName" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g')
fi
```

### 2. debug-activity-self-contained

**Purpose**: Debug failed activity executions  
**Tasks**: 2 (inspect-execution-errors → generate-fix-recommendations)  
**Status**: ✅ **STRUCTURALLY VALID** (but untested in execution)

**Design Analysis**:
- ✅ Uses MCP tool (`activity_error_inspector`) - correct architecture
- ✅ Self-contained (no git dependencies)
- ✅ Clear validation (EXECUTION_ANALYSIS.md, FIX_RECOMMENDATIONS.md)
- ✅ Forbidden patterns prevent API bypass (no `curl`, `http://`)
- ✅ Simple 2-task workflow (inspect → recommend)

**Execution Testing Needed**:
- Test with a known failed execution ID
- Verify `activity_error_inspector` tool is accessible
- Confirm analysis and recommendations are actionable

**Hypothesis**: This template should work on first try (well-designed, simple).

### 3. evolve-activity-self-contained

**Purpose**: Improve existing templates based on metrics  
**Tasks**: 4 (fetch-metrics → identify-improvements → create-improved-template → document-evolution)  
**Status**: ✅ **STRUCTURALLY VALID** (but untested in execution)

**Design Analysis**:
- ✅ Self-contained (fetches from backend API)
- ✅ Data-driven (uses execution metrics, failure analysis)
- ✅ ROI-based prioritization (quick wins first)
- ✅ Version increment (proper variant management)
- ✅ Comprehensive documentation (EVOLUTION_REPORT.md)
- ⚠️ Uses direct API calls (`curl http://localhost:8082/...`)

**Architectural Note**:
The template uses direct API calls instead of MCP tools:
```bash
curl http://localhost:8082/v2/activities/templates/{{templateId}}
curl http://localhost:8082/v2/activities/executions?template_id={{templateId}}
```

**Question**: Should this use MCP tools instead?
- **Pro MCP**: Follows architecture, handles auth, abstraction
- **Pro Direct API**: Flexible queries, may not have MCP wrappers yet

**Recommendation**: Test as-is first. If MCP tools exist for metric queries, create a variant.

**Execution Testing Needed**:
- Test with a template that has execution history (e.g., hello-world-minimal)
- Verify backend API is accessible from within execution environment
- Confirm improvements are valid and applied correctly

---

## Comparison: Core vs. Application Templates

| Aspect | Core Templates | Application Templates |
|--------|----------------|----------------------|
| **Purpose** | System operation | Feature development |
| **Examples** | create-activity, debug-activity, evolve-activity | add-feature, fix-bug, refactor |
| **Importance** | **CRITICAL** - system cannot self-improve without them | Nice to have - users can code manually |
| **Priority** | Must work for system viability | Can be added later |
| **Bootstrapping** | Required for metabob-proto initialization | Optional examples |

**Minimum Viable Bootstrap Set**:
1. ✅ **hello-world-minimal** (smoke test, validation baseline)
2. ⚠️ **create-activity-self-contained** (FIX NEEDED)
3. ✅ **debug-activity-self-contained** (test needed)
4. ✅ **evolve-activity-self-contained** (test needed)

Optional (can be created by create-activity):
- add-feature-complete
- fix-bug-complete
- refactor-with-tests
- manage-session-memory

---

## Action Plan

### Phase 1: Fix create-activity-self-contained (HIGH PRIORITY)

**Tasks**:
1. ✅ Identify root cause (COMPLETE - variable self-reference)
2. ⏳ Fix `templateId` variable default
3. ⏳ Add pre-hook to generate `templateId` from `templateName`
4. ⏳ Test with simple template creation
5. ⏳ Verify registration succeeds

**Success Criteria**:
- Can create a simple hello-world template
- Template is registered to backend
- SUCCESS.md is created
- No "Missing variables" errors

### Phase 2: Test debug-activity-self-contained (MEDIUM PRIORITY)

**Tasks**:
1. ⏳ Find or create a failed execution (can use create-activity failures)
2. ⏳ Execute debug-activity with failed execution ID
3. ⏳ Review EXECUTION_ANALYSIS.md output
4. ⏳ Review FIX_RECOMMENDATIONS.md output
5. ⏳ Measure success rate

**Success Criteria**:
- EXECUTION_ANALYSIS.md identifies root cause
- FIX_RECOMMENDATIONS.md provides actionable fixes
- No errors during execution

### Phase 3: Test evolve-activity-self-contained (MEDIUM PRIORITY)

**Tasks**:
1. ⏳ Choose a template with execution history (hello-world-minimal)
2. ⏳ Execute evolve-activity with templateId
3. ⏳ Review TEMPLATE_ANALYSIS.md (metrics fetched?)
4. ⏳ Review IMPROVEMENTS.md (improvements identified?)
5. ⏳ Review evolved template JSON (changes applied?)
6. ⏳ Measure success rate

**Success Criteria**:
- Fetches metrics from backend API
- Identifies valid improvements
- Creates improved template variant
- Documents evolution comprehensively

### Phase 4: Seed to metabob-proto (DEPLOYMENT)

**Tasks**:
1. ⏳ Verify all 3 core templates work (>80% success rate)
2. ⏳ Start SurrealDB instance
3. ⏳ Run seed script: `python repos/metabob-proto/scripts/seed_activities.py`
4. ⏳ Verify templates are in database
5. ⏳ Test `search_activities` integration
6. ⏳ Verify Thompson Sampling is tracking metrics

**Success Criteria**:
- 4 bootstrap templates seeded (hello-world + 3 core)
- All accessible via search_activities
- Execution metrics being tracked
- System is self-improving

---

## Technical Details: The Variable Self-Reference Bug

### Current Behavior (BROKEN)

**Template Definition**:
```json
{
  "prompt": {
    "variables": [
      {
        "name": "templateId",
        "default": "{{templateId}}"
      }
    ]
  }
}
```

**When Executed**:
```typescript
// User provides:
variables = { templateName: "My Template" }

// Variable resolution:
templateId = variables.templateId || default
templateId = undefined || "{{templateId}}"
templateId = "{{templateId}}"  // Literal string!

// String interpolation:
path = `/tmp/activity-template-${templateId}/file.json`
path = `/tmp/activity-template-{{templateId}}/file.json`  // BROKEN PATH

// File operations fail:
write("/tmp/activity-template-{{templateId}}/REQUIREMENTS.md")
// Error: Invalid path, or creates literal "{{templateId}}" directory
```

### Correct Behavior (FIXED)

**Option 1: Remove Default, Make Required**
```json
{
  "name": "templateId",
  "type": "string",
  "required": true,  // User MUST provide
  "description": "Kebab-case template ID"
}
```

**Option 2: Generate from templateName (RECOMMENDED)**
```json
{
  "name": "templateId",
  "type": "string",
  "required": false,
  "description": "Kebab-case template ID (auto-generated from templateName)",
  "default": ""  // Empty, will be generated
}
```

Then add pre-hook or Task 1 logic:
```bash
# In hooks.preActivity or Task 1 prompt:
if [ -z "$templateId" ]; then
  # Generate kebab-case ID from templateName
  templateId=$(echo "$templateName" | \
    tr '[:upper:]' '[:lower:]' | \
    sed 's/[^a-z0-9]/-/g' | \
    sed 's/--*/-/g' | \
    sed 's/^-//;s/-$//')
  
  echo "Generated templateId: $templateId"
fi

# Export for subsequent tasks
export TEMPLATE_ID="$templateId"
```

**Option 3: Use Template-Level Default Logic**
```json
{
  "hooks": {
    "preActivity": {
      "commands": [
        "export TEMPLATE_ID=${templateId:-$(echo \"$templateName\" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g')}"
      ]
    }
  }
}
```

---

## Metabob-Proto Seeding Strategy

### What to Seed

**Minimum Bootstrap Set** (4 templates):
1. hello-world-minimal - Validation baseline
2. create-activity-self-contained - Template creation
3. debug-activity-self-contained - Failure analysis
4. evolve-activity-self-contained - Template improvement

**Optional Application Templates** (4 templates):
5. add-feature-complete - Feature development
6. fix-bug-complete - Bug fixing
7. refactor-with-tests - Safe refactoring
8. manage-session-memory - Memory management

**Recommendation**: Seed minimum bootstrap set (4) first, then add application templates once core is proven.

### Seeding Process

**Prerequisites**:
1. ✅ Backend API running (metabob-rpc-api)
2. ✅ SurrealDB running
3. ✅ Templates validated (structurally)
4. ⏳ Core templates tested (execution)

**Command**:
```bash
cd repos/metabob-proto

# Seed minimum bootstrap set
python scripts/seed_activities.py \
  --db-url http://localhost:8000 \
  --namespace metabob \
  --database devbob \
  --templates \
    activities/bootstrap/hello-world-minimal.json \
    activities/bootstrap/create-activity-self-contained.json \
    activities/bootstrap/debug-activity-self-contained.json \
    activities/bootstrap/evolve-activity-self-contained.json
```

**Verification**:
```bash
# Check templates were created
curl http://localhost:8000/v2/activities/templates | jq 'length'
# Expected: 4

# Check specific template
curl http://localhost:8000/v2/activities/templates/create-activity | jq '.name'
# Expected: "Create Activity Template"
```

---

## Success Metrics

### Phase 1 (Fix create-activity)
- ✅ Template creates hello-world successfully
- ✅ No "Missing variables" errors
- ✅ Registration succeeds
- ✅ Success rate > 80%

### Phase 2 (Test debug-activity)
- ✅ Analyzes failed execution
- ✅ Identifies root cause
- ✅ Generates actionable fixes
- ✅ Success rate > 80%

### Phase 3 (Test evolve-activity)
- ✅ Fetches metrics from backend
- ✅ Identifies improvements
- ✅ Creates valid improved template
- ✅ Success rate > 60% (more complex)

### Phase 4 (Deploy to production)
- ✅ 4 templates seeded to metabob-proto
- ✅ Accessible via search_activities
- ✅ Execution metrics tracked
- ✅ Thompson Sampling converging

---

## Next Steps

### Immediate (Today)
1. ⏳ **Fix create-activity templateId bug**
   - Remove self-referencing default
   - Add generation logic in pre-hook or Task 1

2. ⏳ **Test create-activity**
   - Create simple hello-world template
   - Verify registration succeeds
   - Measure success rate

### Short-term (This Week)
3. ⏳ **Test debug-activity**
   - Use create-activity failures as test cases
   - Verify analysis quality

4. ⏳ **Test evolve-activity**
   - Use hello-world-minimal (has execution history)
   - Verify improvements are valid

### Medium-term (Next 2 Weeks)
5. ⏳ **Seed to metabob-proto**
   - 4 core templates minimum
   - Verify Thompson Sampling works

6. ⏳ **Begin learning phase**
   - Execute templates in real workflows
   - Measure outcomes
   - Create variants as needed

---

## Conclusion

### Current Status

**Core Activity Management Templates**:
- ⚠️ **create-activity-self-contained**: HAS BUG (variable self-reference) - needs fix
- ✅ **debug-activity-self-contained**: Structurally valid - needs execution test
- ✅ **evolve-activity-self-contained**: Structurally valid - needs execution test

**System Readiness**:
- ✅ Backend API operational (6/6 endpoints)
- ✅ Thompson Sampling implemented
- ✅ Templates structurally validated
- ⏳ Core templates need execution testing
- ⏳ 1 critical bug needs fixing (create-activity)

### The Path Forward

**You were right to focus on activity management templates** - they are the core, not applications.

1. Fix create-activity templateId bug (1-2 hours)
2. Test all 3 core templates (4-6 hours)
3. Seed minimum viable set to metabob-proto (1 hour)
4. Begin learning phase (ongoing)

**Once the 3 core templates work**, the system can:
- ✅ Create new templates (create-activity)
- ✅ Debug failures (debug-activity)
- ✅ Improve based on data (evolve-activity)
- ✅ Self-improve continuously (Thompson Sampling)

This is the **minimum viable self-improving system**.

---

## Files Referenced

- ACTIVITY_SYSTEM_PROOF_COMPLETE.md: System architecture proof
- BOOTSTRAP_TEMPLATES_COMPLETE.md: Template creation summary
- BOOTSTRAP_TEMPLATES_VALIDATION_REPORT.md: Structural validation
- BUG_3_FIX_COMPLETE.md: Previous bug fix attempt
- TEMPLATE_MANAGEMENT_ARCHITECTURE.md: Architecture and trust boundaries

---

**Status**: Ready to fix create-activity bug and begin testing  
**Confidence**: HIGH - root cause identified, path forward clear  
**Priority**: Fix create-activity → Test core 3 → Seed to proto → Learning phase
