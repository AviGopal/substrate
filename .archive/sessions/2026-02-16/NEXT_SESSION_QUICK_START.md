# Next Session: Quick Start Guide

**Resume From**: SESSION_RESUME_FEB15_PART2.md  
**Focus**: Local template execution testing

## Session Goals

1. ⚡ **Test enhanced template execution** (Priority 1)
2. 📊 **Measure token reduction** (Priority 1)  
3. 📚 **Document findings** (Priority 2)

## Where We Left Off

✅ **Completed**:
- Fixed 3 CLI bugs (task_steps, auth, validation)
- Discovered backend doesn't persist context_requirements
- Validated local execution strategy
- 3 enhanced templates ready: fix-bug, add-endpoint, create-activity

🟡 **Blocked** (not urgent):
- Backend registration of enhanced templates (backend limitation)

🟢 **Ready to Test**:
- Enhanced templates in `repos/metabob-opencode/packages/opencode/templates/built-in/`
- All have correct schema (contextRequirements + impulse_refs)

## First Steps

### 1. Verify Enhanced Templates
```bash
# Check files exist
ls -lh repos/metabob-opencode/packages/opencode/templates/built-in/*-enhanced.json

# Validate JSON
for f in repos/metabob-opencode/packages/opencode/templates/built-in/*-enhanced.json; do
  echo "Validating $f..."
  jq empty "$f" && echo "  ✓ Valid JSON"
done

# Count impulses
jq '{contextRequirements: (.contextRequirements | length), total_impulse_refs: ([.tasks[].impulse_refs | length] | add)}' \
  repos/metabob-opencode/packages/opencode/templates/built-in/fix-bug-complete-enhanced.json
```

### 2. Test Local Execution

**Option A: Direct Activity Execution** (if supported)
```bash
# Read the activity tool to see if it supports file paths
search_activities({ query: "test" })

# If activity tool supports file paths:
activity({
  templateFile: "repos/metabob-opencode/packages/opencode/templates/built-in/fix-bug-complete-enhanced.json",
  variables: {
    bug_description: "Test bug for impulse system validation",
    error_message: "Sample error message"
  },
  reason: "Test enhanced template with impulse system"
})
```

**Option B: Register Locally Then Execute**
```bash
# If backend doesn't persist but allows execution:
cd repos/metabob-cli
python3 -m metabob_cli register-template \
  ../metabob-opencode/packages/opencode/templates/built-in/fix-bug-complete-enhanced.json \
  --base-url http://localhost:8080

# Then execute by ID (if backend returns ID):
activity({
  activityId: "<returned-id>",
  variables: { ... },
  reason: "Test execution"
})
```

**Option C: Copy to Backend Built-in Templates** (if backend has local template directory)
```bash
# Find backend template directory
find repos/metabob-backend -name "*.json" -path "*/templates/*" | head -5

# Copy enhanced templates
cp repos/metabob-opencode/packages/opencode/templates/built-in/*-enhanced.json \
   <backend-template-dir>/
```

### 3. Trace Impulse Loading

**Watch for these log messages**:
- `[Memory Agent] Loading impulse: <key>` - contextRequirements being processed
- `[Activity Manager] Injecting impulse: <impulse_id>` - impulse_refs being resolved
- `[Impulse] Cache hit: <key>` or `Cache miss: <key>` - Cache performance

**Enable debug logging** (if available):
```bash
export OPENCODE_LOG_LEVEL=DEBUG
export METABOB_LOG_LEVEL=DEBUG
```

### 4. Measure Token Usage

**Before Enhanced (baseline)**:
```bash
# Execute original fix-bug-complete template
# Note token count from execution logs
```

**After Enhanced**:
```bash
# Execute fix-bug-complete-enhanced template
# Compare token count
# Expected: 40-60% reduction due to impulse caching
```

**Track**:
- Total tokens per execution
- Tokens per task
- Cache hit rate
- Impulse load time

## Key Questions to Answer

1. **Does the Memory Agent recognize `contextRequirements`?**
   - Are impulses created before activity starts?
   - What types of impulses are created (toolOutput, file, bashOutput)?

2. **Does the Activity Manager inject `impulse_refs`?**
   - Are impulses available in task context?
   - Is the injection automatic or manual?

3. **What's the actual token reduction?**
   - Baseline vs enhanced execution
   - Per-task vs total
   - Cache effectiveness

4. **Are there any runtime errors?**
   - Schema validation issues
   - Missing impulse types
   - Injection failures

## Expected Outcomes

### Success Case ✅
- Memory Agent creates 7 impulses from contextRequirements
- Activity Manager injects impulses into each task via impulse_refs
- Token usage reduced by 40-60%
- All tasks execute without errors
- Impulse cache shows high hit rate (80%+)

### Partial Success ⚠️
- Impulses created but not injected → Need Activity Manager update
- Impulses injected but token usage same → Cache not working
- Some impulse types fail → Need impulse loader fixes

### Failure Case ❌
- contextRequirements ignored → Need Memory Agent update
- impulse_refs not recognized → Need schema update
- Runtime errors → Debug and fix issues

## Fallback Plan

If local execution isn't supported yet:

1. **Check OpenCode source code**
   - Find where templates are loaded
   - Verify contextRequirements parsing
   - Check impulse_refs handling

2. **File issues if needed**
   - Document missing features
   - Provide schema examples
   - Propose implementation approach

3. **Continue with remaining work**
   - Enhance remaining 17 templates
   - Document patterns
   - Prepare for backend integration

## Files to Reference

- `IMPULSE_SYSTEM_ARCHITECTURE.md` - Schema reference
- `SESSION_RESUME_FEB15_PART2.md` - Full session summary
- `CLI_REGISTRATION_FIX_REPORT.md` - CLI bugs and fixes
- `ACTIVITY_SYSTEM_WORKING.md` - Activity system status

## Success Criteria

By end of next session:

- [ ] At least 1 enhanced template executed successfully
- [ ] Impulse loading traced and verified
- [ ] Token reduction measured and documented
- [ ] Runtime issues identified (if any)
- [ ] Clear path forward defined

---

**Estimated Time**: 1-2 hours  
**Complexity**: Medium (depends on OpenCode support)  
**Blockers**: None (all tooling functional)  
**Risk**: Low (worst case: document missing features)
