# Validation Checklist: create-activity-self-contained Fix

## Pre-Fix Validation

- [ ] **Confirmed Root Cause**: Read ROOT_CAUSE_ANALYSIS.md
- [ ] **Identified Issue**: Variable `templateId` has default `"{{templateName | kebabCase}}"`
- [ ] **Backup Plan**: Know how to restore if fix fails
- [ ] **Fix Option Selected**: A (Required) / B (Static) / C (Remove) / Code Fix

## Fix Application

### Option A: Make Required
- [ ] Backup created: `create-activity-self-contained.json.backup.*`
- [ ] Template modified: `templateId.required = true`
- [ ] Default value removed: `del(.default)`
- [ ] Description updated

### Option B: Static Default
- [ ] Backup created: `create-activity-self-contained.json.backup.*`
- [ ] Template modified: `templateId.default = "new-activity-template"`
- [ ] No filter syntax present

### Option C: Remove Variable
- [ ] Backup created: `create-activity-self-contained.json.backup.*`
- [ ] Variable removed from array
- [ ] Prompt template updated: `{{templateId}}` → `"output"`
- [ ] Validation paths updated

### Code Fix
- [ ] `interpolatePrompt()` enhanced with filter support
- [ ] Filters implemented: `kebabCase`, `camelCase`, `snakeCase`, etc.
- [ ] Unit tests added and passing
- [ ] Documentation updated

## Post-Fix Validation

### Step 1: Verify Template Structure
```bash
docker exec devbob-clean cat /root/.local/share/opencode/storage/activity-template/create-activity-self-contained.json | jq '.task_steps[0].prompt.variables[] | select(.name == "templateId")'
```

**Expected (Option A)**:
- [ ] `"required": true` present
- [ ] `"default"` key absent
- [ ] No pipe (`|`) character in JSON

**Expected (Option B)**:
- [ ] `"default": "new-activity-template"` present
- [ ] No pipe (`|`) character in default value

**Expected (Option C)**:
- [ ] No output (variable removed)
- [ ] Prompt template uses `"output"` instead of `{{templateId}}`

### Step 2: Test Execution
```bash
docker exec devbob-clean bash -c 'timeout 180 opencode run "Use activity tool..."'
```

**During Execution**:
- [ ] No "Missing variables" error in logs
- [ ] Activity ID generated (e.g., `act_xyz...`)
- [ ] Execution continues past variable interpolation

**After Execution**:
- [ ] Activity record exists: `ls /root/.local/share/opencode/storage/activity/act_*.json`
- [ ] File timestamp is recent (within last 5 minutes)
- [ ] File size > 100 bytes (not empty)

### Step 3: Verify Activity Record Contents
```bash
docker exec devbob-clean sh -c 'cat $(ls -t /root/.local/share/opencode/storage/activity/act_*.json | head -1) | jq "{id, status, sessions: .sessions | length, tasks: .tasks | length}"'
```

**Expected**:
- [ ] `id` matches expected pattern: `act_[hash]_[hash]`
- [ ] `status` is `"setup"`, `"in_progress"`, or `"completed"`
- [ ] `sessions` count > 0 (agent spawned)
- [ ] `tasks` count > 0 (task execution began)

### Step 4: Verify Agent Sessions Spawned
```bash
docker exec devbob-clean sh -c 'cat $(ls -t /root/.local/share/opencode/storage/activity/act_*.json | head -1) | jq ".sessions"'
```

**Expected**:
- [ ] Array with at least one session object
- [ ] Session has `sessionId` field
- [ ] Session has `status` field
- [ ] Session has `messages` array

### Step 5: Verify Output Files Created
```bash
docker exec devbob-clean ls -la /tmp/activity-template-*/
```

**Expected (depends on execution success)**:
- [ ] Directory exists
- [ ] Contains `REQUIREMENTS.md` (from first task)
- [ ] File is not empty
- [ ] File contains expected sections

### Step 6: Check Logs for Errors
```bash
docker exec devbob-clean cat /root/.local/share/opencode/log/dev.log | grep -i "error\|fail\|missing" | tail -20
```

**Expected**:
- [ ] No "Missing variables in template: {{templateName | kebabCase}}"
- [ ] No "interpolation failed" errors
- [ ] No "activity creation aborted" errors

## Success Metrics

### Immediate (Fix Applied)
- [ ] Template syntax valid (no Handlebars filters in unsupported locations)
- [ ] No interpolation errors during variable merging
- [ ] Activity record created and persisted to storage

### Short-term (First Execution)
- [ ] Execution reaches task execution phase (status: "in_progress")
- [ ] Agent sessions spawn successfully
- [ ] First task runs without variable interpolation errors

### Long-term (Multiple Executions)
- [ ] Success rate > 80% for next 5 executions
- [ ] No recurrence of "Missing variables" error with this template
- [ ] Template usable by users without documentation changes

## Rollback Plan

**If fix fails or causes new issues**:

### Option A Rollback
```bash
docker exec devbob-clean sh -c '
cd /root/.local/share/opencode/storage/activity-template/
BACKUP=$(ls -t create-activity-self-contained.json.backup.* | head -1)
cp "$BACKUP" create-activity-self-contained.json
echo "Restored from $BACKUP"
'
```

### Option B Rollback
```bash
# Same as Option A
```

### Option C Rollback
```bash
# Same as Option A
```

### Code Fix Rollback
```bash
cd repos/metabob-opencode
git revert [commit-hash]
# Rebuild and redeploy
```

## Known Issues After Fix

### Option A Known Issues
- [ ] Users must now provide `templateId` (was auto-generated before)
- [ ] Existing workflows may need updates to include `templateId` variable
- [ ] Error message if `templateId` not provided: "Missing required variable"

### Option B Known Issues
- [ ] Generic default value ("new-activity-template") may conflict if multiple executions run simultaneously
- [ ] Users should override default but may forget

### Option C Known Issues
- [ ] All executions use same directory (`/tmp/activity-template-output/`)
- [ ] Concurrent executions may conflict (file overwrites)
- [ ] Less flexible than parameterized paths

### Code Fix Known Issues
- [ ] Adds complexity to interpolation engine
- [ ] Must maintain filter implementations
- [ ] Filter behavior may differ from actual Handlebars

## Documentation Updates Needed

- [ ] Update template usage guide with `templateId` requirement (Option A)
- [ ] Document available filters (Code Fix)
- [ ] Add example of correct template variable usage
- [ ] Update troubleshooting guide with this failure mode
- [ ] Add to release notes for next OpenCode version

## Prevention Checklist

- [ ] Add template validation function (prevents similar issues)
- [ ] Add pre-commit hook to metabob-proto repository
- [ ] Scan all templates for similar patterns
- [ ] Update template authoring guidelines
- [ ] Add unit tests for interpolation edge cases

## Sign-off

**Fix Applied By**: _______________  
**Date**: _______________  
**Fix Option**: A / B / C / Code  
**Validation Complete**: [ ] Yes  
**Issues Found**: [ ] None / [ ] See notes below  
**Rollback Required**: [ ] No / [ ] Yes (reason: _______________)  

**Notes**:
```
[Additional observations, issues, or recommendations]
```

---

**Status**: Ready for validation  
**Time Required**: 10-15 minutes  
**Risk Level**: Low (easy rollback available)
