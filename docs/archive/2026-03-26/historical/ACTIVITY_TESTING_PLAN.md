# Activity Testing Plan: Bootstrap Templates

## Objective

Test and improve the bootstrap activity templates in `metabob-proto/activities/bootstrap/` to ensure they work correctly and can properly seed the SurrealDB database for metabob-rpc-api.

## Context

**Where we are**: Just completed Phase 1 testing of session memory system
- ✅ Fixed critical bug (missing tools in manage-session-memory template)
- ✅ Verified architecture is sound
- ✅ All components integrated correctly

**What's next**: Test the bootstrap activity templates that initialize the database

**Why this matters**:
- These templates seed SurrealDB with initial activity variants
- They're used by `init-db.py` script for database initialization
- They're the foundation for the activity recommendation system
- If they're broken, the whole system fails to start

## Bootstrap Templates Overview

### Templates in `repos/metabob-proto/activities/bootstrap/`

1. **hello-world-minimal.json** (1.4 KB)
   - Simplest possible template
   - Single task, minimal configuration
   - Good for testing basic execution

2. **manage-session-memory.json** (9.8 KB) ✅ FIXED
   - 5 tasks, memory management workflow
   - **Status**: Fixed in previous session
   - Tools verified correct

3. **debug-activity-self-contained.json** (4.7 KB)
   - Debug workflow for activity execution issues
   - Meta-template for fixing other templates

4. **create-activity-self-contained.json** (18.4 KB)
   - Creates new activity templates
   - 4 tasks, complex workflow
   - **Status**: Fixed Bug #3 (variable interpolation in code blocks)

5. **add-feature-complete.json** (12.0 KB)
   - Feature implementation workflow
   - Tests, commits, quality checks

6. **fix-bug-complete.json** (10.3 KB)
   - Bug fixing workflow
   - Diagnosis, fix, test, commit

7. **refactor-with-tests.json** (11.3 KB)
   - Refactoring workflow
   - Safety checks, tests, incremental changes

8. **evolve-activity-self-contained.json** (37.1 KB) **LARGEST**
   - Template evolution and improvement workflow
   - 5 tasks, comprehensive analysis

## Testing Strategy

### Phase 1: Static Validation ✅ (Current Session)

**Goal**: Verify templates are structurally valid before execution

**Tests**:
1. ✅ JSON syntax validation
2. ✅ Schema compliance (ActivityTemplate.Schema)
3. ✅ Tool references verification (all tools exist)
4. ✅ Variable consistency (declared vs used)
5. ✅ No circular dependencies
6. ✅ Context requirements are resolvable

**Expected time**: 30-60 minutes

### Phase 2: Dry-Run Execution (Next)

**Goal**: Attempt execution without actually modifying files/database

**Tests**:
1. Template loading
2. Variable merging
3. Prompt interpolation
4. Agent availability
5. Tool permission checks
6. Task dependency resolution

**Expected time**: 1-2 hours

### Phase 3: Live Execution (After Dry-Run)

**Goal**: Execute templates with real agents and verify outputs

**Tests**:
1. hello-world-minimal (simplest)
2. debug-activity-self-contained (meta-debugging)
3. Small subset of others

**Expected time**: 2-4 hours

### Phase 4: Database Integration (Final)

**Goal**: Verify templates seed database correctly

**Tests**:
1. Run init-db.py
2. Verify activity_variants table populated
3. Check variant_id, task_steps, etc.
4. Validate relationships

**Expected time**: 1-2 hours

## Phase 1: Static Validation (NOW)

### Test 1: JSON Syntax Validation

**Command**:
```bash
for file in repos/metabob-proto/activities/bootstrap/*.json; do
  python3 -c "import json; json.load(open('$file'))" && echo "✅ $file" || echo "❌ $file"
done
```

**Expected**: All files parse correctly

---

### Test 2: Schema Compliance

**Check**:
- All required fields present (name, version, description, category, tasks)
- Field types match schema
- Tasks have required fields (id, subagent, description, prompt)
- Prompt has template, maxTokens, compressionStrategy, variables

**Script**: Create validation script using ActivityTemplate.Schema

---

### Test 3: Tool References Verification

**Check** (similar to what we did for manage-session-memory):
- Extract all tool references from prompts
- Verify each tool exists in tool directory
- Check agent has access to tool

**Known issues**:
- ✅ manage-session-memory: Fixed (memory_context_view → memory_outline)
- ❓ Others: Unknown

---

### Test 4: Variable Consistency

**Check**:
- All `{{variable}}` in prompts are declared in variables array
- All variables have proper type, description
- Required variables marked correctly
- Default values are valid

**Known issues**:
- ✅ create-activity-self-contained: Fixed (Bug #3 - code block examples)
- ❓ Others: Unknown

---

### Test 5: Circular Dependencies

**Check**:
- Task dependencies form DAG (no cycles)
- Context requirements don't create circular dependency
- Variable defaults don't self-reference (except valid auto-generation)

---

### Test 6: Context Requirements

**Check**:
- All contextRequirements have valid impulseTypes
- Required context is obtainable
- No circular dependency (activity needs context to prepare context)

---

## Expected Issues

Based on previous testing, we may find:

1. **Missing tools** (like we found in manage-session-memory)
   - Quick fix: Replace with existing tools
   - Proper fix: Implement missing tools

2. **Variable mismatches** (like we found in create-activity-self-contained)
   - Quick fix: Add declarations or remove unused variables
   - Proper fix: Ensure template authoring consistency

3. **Invalid schema fields**
   - Quick fix: Update to match current schema
   - Proper fix: Schema migration if needed

4. **Agent tool permissions**
   - Quick fix: Add tools to agent configuration
   - Proper fix: Define tool requirements in template

## Deliverables

### Phase 1 Deliverables

1. **Validation script** (`validate_bootstrap_templates.ts`)
   - Automated checks for all 8 templates
   - Reports issues with specific line numbers
   - Categorizes issues by severity

2. **Validation report** (`BOOTSTRAP_TEMPLATES_VALIDATION.md`)
   - Per-template status
   - Issues found
   - Recommended fixes

3. **Quick fixes** (if needed)
   - Updated templates with corrected tool names
   - Fixed variable declarations
   - Schema compliance fixes

### Phase 2 Deliverables

4. **Dry-run test results** (`BOOTSTRAP_DRY_RUN_RESULTS.md`)
   - Execution success/failure per template
   - Error messages and stack traces
   - Performance metrics (parsing time, etc.)

### Phase 3 Deliverables

5. **Live execution results** (`BOOTSTRAP_LIVE_EXECUTION.md`)
   - Actual execution outputs
   - Agent behavior observations
   - Quality assessment

### Phase 4 Deliverables

6. **Database integration verification** (`DATABASE_SEEDING_VERIFIED.md`)
   - init-db.py execution results
   - Database state verification
   - Variant records inspection

## Success Criteria

### Phase 1: Static Validation

- ✅ All 8 templates pass JSON syntax validation
- ✅ All templates comply with ActivityTemplate.Schema
- ✅ All tool references verified to exist
- ✅ All variables consistent (declared vs used)
- ✅ No circular dependencies found
- ✅ Context requirements are resolvable

**If all pass**: Move to Phase 2
**If issues found**: Fix issues, re-validate

### Phase 2: Dry-Run Execution

- ✅ All templates load successfully
- ✅ Variable merging works correctly
- ✅ Prompt interpolation succeeds
- ✅ Agents and tools available
- ✅ Task dependencies resolve correctly

**If all pass**: Move to Phase 3
**If issues found**: Fix issues, re-test

### Phase 3: Live Execution

- ✅ hello-world-minimal executes successfully
- ✅ debug-activity-self-contained executes successfully
- ✅ At least 2 other templates execute successfully
- ✅ Outputs meet quality standards

**If all pass**: Move to Phase 4
**If issues found**: Debug and fix

### Phase 4: Database Integration

- ✅ init-db.py completes successfully
- ✅ activity_variants table populated with 8 records
- ✅ Variant data is correct (task_steps, genealogy, etc.)
- ✅ Can query and retrieve templates

**If all pass**: Bootstrap templates verified ✅
**If issues found**: Fix database seeding logic

## Timeline

| Phase | Duration | Parallel? |
|-------|----------|-----------|
| Phase 1: Static Validation | 30-60 min | No |
| Phase 2: Dry-Run Execution | 1-2 hours | Partial |
| Phase 3: Live Execution | 2-4 hours | No |
| Phase 4: Database Integration | 1-2 hours | No |
| **Total** | **4-9 hours** | |

**Realistic estimate**: 6-8 hours over 2-3 sessions

## Current Status

- **Phase 1**: 🔄 STARTING NOW
- **Phase 2**: ⏳ Pending Phase 1 completion
- **Phase 3**: ⏳ Pending Phase 2 completion
- **Phase 4**: ⏳ Pending Phase 3 completion

## Next Steps

1. ✅ Create validation script for all 8 templates
2. ✅ Run comprehensive validation
3. ✅ Generate validation report
4. ✅ Fix any issues found
5. ✅ Re-validate until all pass
6. ⏭️ Move to Phase 2

---

**Let's start Phase 1: Static Validation** 🚀
