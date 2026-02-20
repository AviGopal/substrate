# Quick Fix Guide: create-activity-self-contained Template

## Problem
Template fails immediately (0% success rate) due to Handlebars filter in variable default.

## Root Cause
```json
{
  "name": "templateId",
  "default": "{{templateName | kebabCase}}"  // ❌ NOT SUPPORTED
}
```

OpenCode's `interpolatePrompt()` does NOT support Handlebars filters.

## Quick Fix (Choose One)

### Option 1: Simple Static Default (Fastest)
```bash
# Edit template
docker exec devbob-clean sh -c '
cd /root/.local/share/opencode/storage/activity-template/
cat create-activity-self-contained.json | jq "
  .tasks[0].prompt.variables |= map(
    if .name == \"templateId\" 
    then .default = \"new-template\" 
    else . end
  )
" > create-activity-self-contained-fixed.json

mv create-activity-self-contained-fixed.json create-activity-self-contained.json
'
```

### Option 2: Make Required (User Provides)
```bash
docker exec devbob-clean sh -c '
cd /root/.local/share/opencode/storage/activity-template/
cat create-activity-self-contained.json | jq "
  .tasks[0].prompt.variables |= map(
    if .name == \"templateId\" 
    then .required = true | del(.default)
    else . end
  )
" > create-activity-self-contained-fixed.json

mv create-activity-self-contained-fixed.json create-activity-self-contained.json
'
```

### Option 3: Remove Variable (Use Static Path)
```bash
# Remove templateId variable entirely
# Update prompt to use static path: /tmp/activity-template-output/
docker exec devbob-clean sh -c '
cd /root/.local/share/opencode/storage/activity-template/
cat create-activity-self-contained.json | jq "
  .tasks[0].prompt.variables |= map(select(.name != \"templateId\")) |
  .tasks[0].prompt.template |= gsub(\"{{templateId}}\"; \"output\")
" > create-activity-self-contained-fixed.json

mv create-activity-self-contained-fixed.json create-activity-self-contained.json
'
```

## Verify Fix
```bash
docker exec devbob-clean cat /root/.local/share/opencode/storage/activity-template/create-activity-self-contained.json | jq '.tasks[0].prompt.variables[] | select(.name == "templateId")'
```

Should return either:
- Static default: `"default": "new-template"`
- Required: `"required": true` (no default)
- Or: Nothing (variable removed)

## Test Execution
```bash
docker exec devbob-clean bash -c '
timeout 180 opencode run "Use activity tool to run create-activity-self-contained with:
- templateName: Test Template
- templateDescription: Testing the fix
- category: feature
- templateId: test-template

Reason: Validating fix for Handlebars filter issue"
'
```

## Expected Result
- Activity record created: `/root/.local/share/opencode/storage/activity/act_*.json` ✅
- No "Missing variables" error ✅
- Tasks execute ✅

## Permanent Fix (Upstream)
1. Fix template in metabob-proto repository
2. Reseed all environments
3. Add validation to prevent filter syntax in defaults

See ROOT_CAUSE_ANALYSIS.md for full details.
