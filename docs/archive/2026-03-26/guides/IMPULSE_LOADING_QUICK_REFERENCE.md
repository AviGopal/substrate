# Impulse Loading - Quick Reference

## ✅ Status: FULLY WORKING

Commit `7465be33` successfully implements impulse loading and variable mapping.

## How It Works

### 1. Template Definition
Template defines `contextRequirements`:
```json
{
  "contextRequirements": [
    {
      "key": "bugDescription",
      "hint": "Detailed bug description: symptoms, errors, reproduction",
      "impulseTypes": ["memo"],
      "required": true,
      "budgetRange": [500, 1500]
    }
  ]
}
```

### 2. Activity Execution
When activity tool executes (lines 578-706 in `tool/activity.ts`):

```typescript
// Step 1: Check if template has contextRequirements
if (template.contextRequirements && template.contextRequirements.length > 0) {
  
  // Step 2: Call memory agent to gather context
  const impulses = await SessionMemoryAgent.gatherContext({
    requirements: template.contextRequirements,
    reason: params.reason,
    recentMessages: recentMessages
  })
  
  // Step 3: Store impulses in activity
  activity.impulses = impulses
  await Activity.save(activity)
  
  // Step 4: Load impulses (THE FIX - lines 603-694)
  for (const requirement of template.contextRequirements) {
    const requirementImpulses = Object.values(activity.impulses)
      .filter(imp => imp.metadata?.requirement === requirement.key)
    
    // Load each impulse
    for (const impulse of requirementImpulses) {
      if (!impulse.loaded) {
        const loaded = await ImpulseResolver.load(impulse)
        activity.impulses[impulse.id] = loaded
      }
    }
    
    // Step 5: Map to template variable
    const contents = requirementImpulses
      .filter(imp => imp.loaded && imp.content)
      .map(imp => imp.content)
      .join('\n\n')
    
    contextVariables[requirement.key] = contents
  }
  
  // Step 6: Merge with user variables
  params.variables = { ...params.variables, ...contextVariables }
}
```

### 3. Task Execution
Tasks can now use variables in prompts:
```
Fix this bug:

## Description
{{bugDescription}}

## Error Context
{{errorContext}}
```

## Key Components

### SessionMemoryAgent (`session/memory-agent.ts`)
- **gatherContext()** (lines 391-562): Creates impulses from requirements
- Calls LLM to analyze activity reason and recent messages
- Extracts files, components, bash commands, memos
- Creates impulse objects with metadata

### ImpulseResolver (`session/impulse-resolver.ts`)
- **load()**: Loads content for impulse based on pointer type
- Handles: file, memo, bashOutput, component, custom, activityOutput
- Returns impulse with `loaded: true` and `content` populated

### Activity Tool (`tool/activity.ts`)
- **Lines 603-694**: THE FIX - Variable mapping
- Loads impulses if not already loaded
- Aggregates content from multiple impulses per requirement
- Creates template variables from impulse content
- Merges with user-provided variables

## Impulse Types

### 1. Memo
```typescript
{
  type: "memo",
  pointer: { type: "memo", content: "Text content here" },
  loaded: false // Will be set to true after loading
}
```
**Used for:** Descriptions, notes extracted from activity reason

### 2. File
```typescript
{
  type: "file",
  pointer: { type: "file", path: "src/auth.ts" },
  loaded: false
}
```
**Used for:** Source files, config files, documentation

### 3. Bash Output
```typescript
{
  type: "bashOutput",
  pointer: { type: "bashOutput", command: "npm test" },
  loaded: false
}
```
**Used for:** Test results, git logs, dependency lists

### 4. Component
```typescript
{
  type: "component",
  pointer: { type: "component", file: "src/auth.ts", name: "login" },
  loaded: false
}
```
**Used for:** Specific functions, classes, methods

## Configuration

### Enable in opencode.json
```json
{
  "sessionMemory": {
    "enabled": true,
    "analysis": {
      "model": "claude-sonnet-4-20250514",
      "provider": "anthropic"
    }
  }
}
```

**Note:** Use `claude-sonnet-4-20250514` for now. Haiku 4 model ID needs verification.

## Templates with Context Requirements

These templates now work automatically:
- `fix-bug-with-metabob` - 4 requirements (bugDescription, errorContext, affectedFiles, reproductionSteps)
- `add-rest-endpoint` - API design context
- `add-tool` - Existing tools context
- `create-subagent` - Agent patterns context
- `add-config-option` - Config structure context
- `add-input-validation` - Validation patterns context
- `rename-tool` - Tool references context

## Testing

Run the full impulse flow test:
```bash
docker exec devbob-clean bun run test-full-impulse-flow.ts
```

Expected results:
- ✅ 15-16 impulses created
- ✅ 90%+ impulses loaded successfully
- ✅ All required context variables created
- ✅ Template variables ready with content

## Debugging

### Check Activity Storage
```bash
docker exec devbob-clean cat ~/.local/share/opencode/storage/activity/<activity-id>.json | jq '.impulses'
```

Look for:
- `loaded: true` - Impulse was loaded successfully
- `content` field populated
- `tokenCount` > 0
- `metadata.requirement` matches contextRequirement.key

### Check Logs
```bash
docker exec devbob-clean tail -f /var/log/opencode.log
```

Key log messages:
- "gatherContext() starting" - Memory agent begins
- "impulses created for requirement" - Per-requirement summary  
- "gatherContext() completed" - Total impulses created
- "loading impulse for context variable" - Loading each impulse
- "impulse loaded" - Successful load with token count
- "context variables created" - Final variable count

## Common Issues

### Issue: "Required context not found"
**Cause:** Memory agent LLM didn't extract the required context  
**Fix:** Improve activity reason text, add more details

### Issue: Impulse loaded=false
**Cause:** ImpulseResolver.load() didn't run  
**Fix:** Check if contextRequirements exists in template

### Issue: Empty content after loading
**Cause:** File doesn't exist or bash command failed  
**Fix:** Expected behavior, template tasks handle gracefully

### Issue: Model not found
**Cause:** Container has outdated provider registry  
**Fix:** Use `claude-sonnet-4-20250514` instead of Haiku 4

## Performance

**Typical timings:**
- Context gathering (LLM call): 2-5 seconds
- Impulse loading (15 impulses): 10-15 seconds  
- Total overhead: 12-20 seconds per activity

**Costs:**
- Memory agent analysis: ~1,000-2,000 tokens (input)
- LLM response: ~500-1,000 tokens (output)
- Cost per activity: $0.001 - $0.005 (Sonnet)

## Success Metrics

From test run (February 20, 2026):
- ✅ 16 impulses created in 5 seconds
- ✅ 15/16 loaded successfully (93.75%)
- ✅ 4/4 template variables created
- ✅ 2,881 total tokens in variables
- ✅ All required requirements fulfilled

## Documentation

- **Implementation:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` (lines 603-694)
- **Full test report:** `IMPULSE_LOADING_SUCCESS.md`
- **Session notes:** `SESSION_RESUME_SUMMARY.md`
