# Activity Debugging Session Findings

**Date**: 2026-02-20  
**Duration**: ~2 hours  
**Status**: Key insights discovered, ready for next phase

---

## Executive Summary

**Good News** ✅:
1. Activity system is working in devbob container
2. Activity tool can be invoked and creates activities
3. My impulse→variable fix is deployed (commit `7465be33`)
4. Template discovery and search working correctly

**Key Finding** 🔍:
- Previous failed activity (`act_mlu7mnhl`) was created **BEFORE my fix**
- Shows exactly the bug I fixed: `loaded: false`, no content
- Need to test **AFTER** fix deployment to validate

**Challenge** ⚠️:
- Activity execution requires **complete variable sets**
- Missing variables cause agent to request them (extends execution time)
- Need proper variable mapping for each template

---

## Detailed Findings

### 1. Activity Storage Analysis

**Old Failed Activity** (`act_mlu7mnhl_ad1a2dd44851b782.json`):
- **Status**: `failed`
- **Template**: `debug-failing-feature`  
- **Created**: Feb 19, before my fix
- **Impulses**: 10 created, **ALL `loaded: false`**
- **Content**: All empty
- **Sessions Spawned**: 0 (the bug!)
- **Duration**: null

**Impulse Breakdown**:
```json
{
  "bugDescription-file-0": {"loaded": false, "hasContent": false},
  "bugDescription-memo-1": {"loaded": false, "hasContent": false},
  "relevantFiles-file-0": {"loaded": false, "hasContent": false},
  ...
}
```

**This proves**:
- Context gathering worked (impulses created)
- But loading failed (stayed `loaded: false`)
- Variables never populated (no content)
- Tasks never executed (no sessions)

### 2. DevBob Container Activity

**Recent Activity** (`act_mlugk4m3_97bee7bcf7ccc359.json`):
- **Status**: `executing` (in progress when we checked)
- **Template**: `create-activity-template`
- **Created**: Feb 20 05:37 (today, during our test)
- **Type**: Old legacy activity system (directory-based)
- **Not relevant**: This is the old system, we need new template-based

**Variables Provided**:
```json
{
  "templateName": "Debug Calculator Bug",
  "templateDescription": "Debug the buggy calculator...",
  "category": "bugfix",
  "templateId": "debug-calc-bug",
  "purpose": "This template automates..." // Added by agent!
}
```

**Key Insight**: Agent detected missing `purpose` variable and added it automatically. This extended execution time beyond our 60s timeout.

### 3. Template Variable Requirements

**create-activity-template requires**:
1. `templateName` (string)
2. `templateDescription` (string)
3. `category` (enum: feature|bugfix|refactor|tool|infrastructure)
4. `purpose` (string) - **We missed this!**

**What happened**:
1. We called activity with 3 variables + templateId
2. Agent recognized missing `purpose`
3. Agent generated purpose from context
4. Execution continued but exceeded our timeout
5. Activity may have completed after timeout

### 4. Activity Tool Behavior

**Confirmed Working** ✅:
- `search_activities` tool works
- Activity tool invoked successfully  
- Variables passed to sub-activity
- Activity creation successful

**Execution Flow**:
```
User Prompt
  ↓
Agent interprets "use activity tool"
  ↓
Agent calls activity({ templateId, variables, reason })
  ↓
Activity tool creates activity record
  ↓
Activity tool starts execution (async)
  ↓
[If variables incomplete, agent may infer/request]
  ↓
Execution continues...
```

### 5. My Fix Status

**Fix Deployed** ✅:
- Commit `7465be33` in codebase
- Changes in `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
- Lines 598-706: Load impulses and map to variables

**Not Yet Validated** ⏳:
- Need to run an activity **with contextRequirements**
- Need to check that impulses load (`loaded: true`)
- Need to verify variables populated
- Need to confirm tasks execute

**Why Not Validated**:
- Old failed activity was pre-fix
- New activity used legacy system (no context requirements)
- Haven't tested template with contextRequirements yet

---

## Root Cause Analysis

### Why Previous Activity Failed

**Activity**: `act_mlu7mnhl` (debug-failing-feature)
**When**: Feb 19 (before fix deployed)
**Template**: Has `contextRequirements` (5 requirements)

**Execution Flow**:
1. ✅ Activity created
2. ✅ Session Memory Agent gathered context
3. ✅ 10 impulses created with metadata
4. ❌ **Impulses never loaded** (bug!)
5. ❌ **Variables never populated** (bugDescription empty)
6. ❌ **Task prompts had empty variables**
7. ❌ **Tasks failed to execute** (no sessions spawned)
8. ❌ **Activity marked failed**

**This is exactly what my fix addresses!**

### Why Recent Test Timed Out

**Activity**: `act_mlugk4m3` (create-activity-template)
**When**: Feb 20 05:37 (today, our test)
**Template**: No context requirements

**Execution Flow**:
1. ✅ Activity tool invoked
2. ✅ Activity created
3. ⚠️ **Agent detected missing `purpose` variable**
4. ⚠️ **Agent generated purpose** (takes time)
5. ⚠️ **Execution extended beyond 60s timeout**
6. ❓ **May have completed after timeout**

**Not a bug**: This is expected behavior when variables incomplete.

---

## Next Steps (Prioritized)

### Phase 1: Validate My Fix (HIGH PRIORITY)

**Objective**: Prove impulse→variable mapping works

**Test Case**: Run activity with contextRequirements

**Steps**:
1. Use a template with `contextRequirements` (e.g., one that analyzes code)
2. Execute with complete variable set
3. Check activity storage for:
   - `impulses[*].loaded: true`
   - `impulses[*].content` populated
   - `executionEvidence.sessionsSpawned.length > 0`
4. Verify tasks execute

**Command Template**:
```bash
docker exec devbob-clean bash -c '
timeout 600 opencode run "Use activity tool to run [template-with-context] with all required variables. Reason: Validating impulse loading fix."
'
```

**Success Criteria**:
- Activity completes (status: "done")
- Impulses loaded
- Sessions spawned
- No "no agent sessions spawned" error

### Phase 2: Test Template Creation (MEDIUM PRIORITY)

**Objective**: Create a new template using create-activity-template

**Steps**:
1. Provide ALL required variables (including `purpose`)
2. Use longer timeout (10+ minutes for complex templates)
3. Verify template JSON created
4. Verify template registered
5. Test executing the new template

**Command**:
```bash
docker exec devbob-clean bash -c '
cd /workspace
timeout 600 opencode run "Use activity tool to run create-activity-template with:
- templateName: Simple Calculator Test
- templateDescription: Test calculator functions with edge cases
- category: feature
- purpose: This template validates calculator operations including division by zero and negative exponents

Reason: Creating a test activity to validate calculator functionality."
'
```

### Phase 3: Test Activity Composition (MEDIUM PRIORITY)

**Objective**: Validate activity A can call activity B

**Steps**:
1. Create simple stub activity
2. Create orchestrator that calls stub
3. Verify variable passing
4. Check results flow

### Phase 4: Measure Performance (LOW PRIORITY)

**Objective**: Document execution metrics

**Metrics to Track**:
- Duration (seconds)
- Token usage (input/output/cache)
- Cost (dollars)
- Success rate
- Session count

---

## Questions Answered

### Q1: Does activity tool work in devbob?
**A**: ✅ Yes, confirmed working. Creates activities and starts execution.

### Q2: Does context gathering work?
**A**: ✅ Yes, Session Memory Agent creates impulses with correct metadata.

### Q3: Are impulses loaded in old failed activity?
**A**: ❌ No, all show `loaded: false`. This was the bug I fixed.

### Q4: Has my fix been validated?
**A**: ⏳ Not yet. Need to test activity with contextRequirements post-fix.

### Q5: Why did recent test timeout?
**A**: Agent detected missing variable and took time to generate it. Likely completed after 60s timeout.

---

## Key Insights

1. **Two Activity Systems**: Legacy (directory-based) vs. New (template-based with contextRequirements)

2. **Variable Completeness Matters**: Incomplete variables cause agent to infer/request, extending execution time

3. **My Fix Addresses Real Bug**: Old activity shows exact symptoms (impulses not loaded, no sessions spawned)

4. **Validation Gap**: Haven't tested a contextRequirements template with my fix yet

5. **Timeout Strategy**: Need 5-10 minute timeouts for complex activities

---

## Recommended Test Sequence

### Test 1: Simple Activity (No Context)
**Template**: Any simple template without contextRequirements  
**Purpose**: Baseline functionality  
**Expected Duration**: 1-2 minutes  
**Success**: Activity completes

### Test 2: Activity with Context Requirements
**Template**: debug-failing-feature or similar  
**Purpose**: Validate impulse→variable mapping fix  
**Expected Duration**: 3-5 minutes  
**Success**: Impulses loaded, variables populated, tasks execute

### Test 3: Template Creation
**Template**: create-activity-template  
**Purpose**: Test meta-activity (creates other templates)  
**Expected Duration**: 5-10 minutes  
**Success**: New template JSON created and registered

### Test 4: Activity Composition
**Template**: Custom orchestrator  
**Purpose**: Validate A calls B pattern  
**Expected Duration**: 2-4 minutes  
**Success**: Both activities complete, results flow

---

## Files to Monitor

### Activity Storage
```bash
docker exec devbob-clean ls -lah ~/.local/share/opencode/storage/activity/
```

### Latest Activity
```bash
docker exec devbob-clean sh -c "ls -t ~/.local/share/opencode/storage/activity/*.json | head -1"
```

### Activity Details (Copy to Host)
```bash
docker cp devbob-clean:/root/.local/share/opencode/storage/activity/act_<id>.json ./activity-<id>.json
cat activity-<id>.json | jq '.impulses | to_entries[] | {id: .key, loaded: .value.loaded, hasContent: (.value.content != null)}'
```

### Logs
```bash
docker logs devbob-clean 2>&1 | tail -100
docker exec devbob-clean cat ~/.local/share/opencode/log/dev.log | tail -200
```

---

## Success Criteria for "Fix Validated"

- [ ] Activity with contextRequirements completes successfully
- [ ] All impulses show `loaded: true`
- [ ] Impulse content populated (not empty/null)
- [ ] Template variables received impulse content
- [ ] Tasks executed (sessionsSpawned > 0)
- [ ] Activity status: "done" (not "failed")
- [ ] Correctness verdict: "correct" or "suspicious" (not "incorrect")

---

## Timeline

- **Investigation**: 2 hours (completed)
- **Next**: Validation phase (1-2 hours estimated)
- **Goal**: Prove fix works end-to-end

---

**Status**: Investigation complete, validation ready  
**Blocker**: None  
**Next Action**: Run Test 2 (activity with context requirements)
