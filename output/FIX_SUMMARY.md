# Fix Summary: create-activity-self-contained Template

## Problem
Template variable `templateId` has default value `"{{templateName | kebabCase}}"` which uses Handlebars filter syntax that OpenCode doesn't support, causing all executions to fail before creating storage records.

## Quick Fix (Choose One)

### Option A: Make Required (Recommended)
```bash
docker exec devbob-clean sh -c '
cd /root/.local/share/opencode/storage/activity-template/
cat create-activity-self-contained.json | jq ".task_steps[0].prompt.variables |= map(if .name == \"templateId\" then .required = true | del(.default) else . end)" > tmp.json && mv tmp.json create-activity-self-contained.json
'
```

### Option B: Static Default
```bash
docker exec devbob-clean sh -c '
cd /root/.local/share/opencode/storage/activity-template/
cat create-activity-self-contained.json | jq ".task_steps[0].prompt.variables |= map(if .name == \"templateId\" then .default = \"new-activity-template\" else . end)" > tmp.json && mv tmp.json create-activity-self-contained.json
'
```

### Option C: Remove Variable
```bash
docker exec devbob-clean sh -c '
cd /root/.local/share/opencode/storage/activity-template/
cat create-activity-self-contained.json | jq ".task_steps[0].prompt.variables |= map(select(.name != \"templateId\")) | .task_steps[].prompt.template |= gsub(\"{{templateId}}\"; \"output\")" > tmp.json && mv tmp.json create-activity-self-contained.json
'
```

## Test After Fix
```bash
docker exec devbob-clean bash -c '
timeout 180 opencode run "Use activity tool to execute create-activity-self-contained with:
- templateName: Test Template
- templateDescription: Testing fix
- category: feature
- templateId: test-template

Reason: Validating Handlebars filter fix"
'
```

## Verify Success
```bash
# Check activity was created
docker exec devbob-clean ls -lt /root/.local/share/opencode/storage/activity/ | head -3

# Check no errors
docker exec devbob-clean cat /root/.local/share/opencode/log/dev.log | grep -i "missing variables" | tail -5
```

## Long-term Solution
Add filter support to `interpolatePrompt()` in `activity-template.ts` - see FIXES.md for implementation details.

## Related Files
- **ROOT_CAUSE_ANALYSIS.md** - Detailed investigation (500+ lines)
- **FIXES.md** - Comprehensive fix guide with all options
- **EXECUTION_DETAILS.md** - Original failure analysis

## Success Criteria
- ✅ Activity record created in storage
- ✅ Agent sessions spawned
- ✅ No "Missing variables" errors
- ✅ Template execution succeeds
