# Test Plan: Validate Impulse Loading Fix

## Goal
Validate that commit `7465be33` correctly loads impulses and maps them to template variables.

## Background
Previous session found activities with `loaded: false` and zero sessions spawned. Investigation revealed:
- My fix (lines 603-694 in `tool/activity.ts`) loads impulses and maps to variables
- Fix only runs if `template.contextRequirements.length > 0`
- Bootstrap templates like `create-activity-template` have NO contextRequirements
- Therefore fix never executed in previous tests

## Solution
Test with a template that HAS contextRequirements: `fix-bug-with-metabob`

## Test Template: fix-bug-with-metabob
Location: `repos/metabob-opencode/packages/opencode/templates/opencode-dev/fix-bug-with-metabob.json`

Context requirements:
- `bugDescription` (required, 500-1500 tokens)
- `errorContext` (required, 1000-2500 tokens)
- `affectedFiles` (optional, 2000-5000 tokens)

## Test Procedure

### 1. Register Template (if needed)
```typescript
register_activity_template({
  file_path: "repos/metabob-opencode/packages/opencode/templates/opencode-dev/fix-bug-with-metabob.json",
  register_with_metabob: true
})
```

### 2. Execute Activity
```typescript
activity({
  templateId: "fix-bug-with-metabob",
  variables: {
    // User-provided variables (not context requirements)
  },
  reason: "Test impulse loading fix: validate that bugDescription, errorContext impulses are loaded and mapped to template variables"
})
```

### 3. Examine Activity Storage
After execution (or during), check:
```bash
docker exec devbob-backend-agent cat /app/.local/share/opencode/storage/activity/<activity-id>.json
```

Expected fields:
- ✅ `impulses` object with keys: `bugDescription`, `errorContext`, `affectedFiles`
- ✅ Each impulse has `loaded: true`
- ✅ Each impulse has `content` field (not empty)
- ✅ `executionEvidence.sessionsSpawned` length > 0
- ✅ Status: `executing` or `done`

## Success Criteria

### Before Fix (old bug)
- ❌ `impulses[key].loaded = false`
- ❌ `impulses[key].content` missing or empty
- ❌ `executionEvidence.sessionsSpawned` = []
- ❌ No sessions spawned
- ❌ Template tasks fail due to missing variables

### After Fix (expected)
- ✅ `impulses[key].loaded = true`
- ✅ `impulses[key].content` populated
- ✅ `executionEvidence.sessionsSpawned` length > 0
- ✅ Sessions spawned for tasks
- ✅ Template tasks receive variables

## Alternative Test (if fix-bug-with-metabob too complex)

Use `add-tool` template:
```json
"contextRequirements": [
  {
    "key": "existingTools",
    "hint": "Context about existing tools to maintain consistency",
    "impulseTypes": ["file", "component"],
    "required": false,
    "budgetRange": [2000, 5000]
  }
]
```

Simpler with only one optional requirement.

## Logs to Check

In activity execution, look for:
1. "gathering context for activity" (line 579)
2. "context gathered successfully" (line 598)
3. "mapping context requirements to template variables" (line 608)
4. "processing context requirement" (line 620) - for each requirement
5. "loading impulse for context variable" (line 630) - for each impulse
6. "impulse loaded" (line 638) - confirms loading succeeded
7. "created context variable" (line 659) - confirms mapping
8. "context variables created" (line 686) - final summary

## Next Steps

1. Start devbob container
2. Register fix-bug-with-metabob template
3. Execute activity with reason explaining this is a test
4. Monitor logs during execution
5. Examine activity storage after execution
6. Compare against success criteria

## Files to Monitor
- Activity storage: `~/.local/share/opencode/storage/activity/<id>.json`
- Logs: `docker logs devbob-backend-agent` (or stdout if running interactively)
