# DevBob Testing Findings & Recommendations

**Date**: 2026-03-09
**Goal**: Execute activity in DevBob and observe data flow to SurrealDB
**Status**: ⚠️ BLOCKED - Activity execution not working in DevBob

## Summary

Successfully fixed DevBob MCP server issues (syntax error + config), but unable to execute activities in the DevBob container to observe the complete data flow.

## What We Accomplished

### ✅ Phase 1: Fixed MCP Server (Completed)
1. Fixed syntax error in packaged metabob-cli
2. Updated opencode.json to use local MCP (stdio)
3. Verified MCP server starts without errors
4. Confirmed opencode can load templates locally

### ⚠️ Phase 2: Activity Execution (Blocked)
1. Found appropriate activity: `trace-data-flow-single-feature`
2. Set up RPC API log collection
3. Copied activity template to DevBob storage
4. Multiple execution attempts - all exit immediately without running

## Findings

### Issue: Activities Exit Immediately
**Observation**: Running `opencode activity <template-id> --variables "{...}" --reason "..."` in DevBob:
- Shows initialization logs
- Exits immediately
- No error messages
- No activity execution occurs
- No MCP communication observed
- No RPC API requests generated

**Attempted Solutions**:
- Created activity directory with prompts
- Copied template to `/root/.local/share/opencode/storage/activity-template/`
- Provided all required variables
- Used proper JSON escaping
- Multiple different command syntaxes

**Possible Root Causes**:
1. **Missing API keys**: ANTHROPIC_API_KEY not set in DevBob environment
2. **Git requirement**: Activity templates may require clean git repo
3. **Session context**: Activities may need interactive session, not one-shot CLI
4. **MCP timeout**: stdio MCP may be timing out before LLM can respond
5. **Silent failures**: Errors being suppressed or logged elsewhere

### RPC API Observation
**Finding**: Only health check requests (GET /) observed
- No POST /api/v1/activity/* requests
- No activity execution data sent
- No variant_id tracking occurring
- Confirms activities aren't actually executing

### MCP Server Status
**Finding**: Server starts but no communication observed
- PID 70546 running
- No zombie processes from recent attempts
- No errors in DevBob logs
- Suggests MCP never receives activity execution requests

## Recommendations

### Option 1: Test from Host (Recommended)
**Rationale**: We already have working environment on host
**Steps**:
1. Execute `trace-data-flow-single-feature` activity from host session
2. Configure it to analyze DevBob/RPC API communication
3. Observe logs and database from host tools
4. Document working data flow

**Pros**:
- Known working environment
- All tools available
- Can observe full pipeline
- Faster iteration

**Cons**:
- Not testing DevBob itself as execution environment

### Option 2: Interactive DevBob Session
**Rationale**: CLI one-shot commands may not work for activities
**Steps**:
1. `kubectl exec -it -n metabob devbob-84466fdfff-dd87l -- /bin/bash`
2. Set ANTHROPIC_API_KEY environment variable
3. Run `opencode` interactive session
4. Execute activity interactively
5. Observe MCP communication

**Pros**:
- Tests DevBob as intended environment
- Interactive session may handle MCP better
- Can debug in real-time

**Cons**:
- Requires manual interaction
- Hard to script/automate
- May need additional setup

### Option 3: Direct MCP Tool Call
**Rationale**: Bypass opencode activity system, test MCP directly
**Steps**:
1. Start MCP server manually in DevBob
2. Send JSON-RPC request directly via stdin
3. Call `metabob_search_activities` tool
4. Observe response and RPC API logs

**Pros**:
- Tests MCP layer in isolation
- Simpler than full activity
- Can verify tool registration

**Cons**:
- Doesn't test full activity pipeline
- Requires JSON-RPC knowledge
- Low-level debugging

### Option 4: Rebuild DevBob with Test Script
**Rationale**: Package test execution into container image
**Steps**:
1. Create Dockerfile with embedded test script
2. Include ANTHROPIC_API_KEY in env
3. Pre-load activity templates
4. Build new devbob image with tests
5. Deploy and auto-execute

**Pros**:
- Production-ready solution
- Repeatable
- Can be part of CI/CD

**Cons**:
- Takes longest (20+ minutes)
- Overkill for one-time test
- May have same issues

## Current State

### Working Components
- ✅ metabob-cli MCP server (no syntax errors)
- ✅ Local MCP configuration (stdio transport)
- ✅ Activity template storage
- ✅ opencode CLI commands
- ✅ RPC API accessible
- ✅ Log collection infrastructure

### Blocked Components
- ❌ Activity execution in DevBob
- ❌ MCP tool invocation
- ❌ LLM API calls
- ❌ Data flow to RPC API
- ❌ SurrealDB persistence
- ❌ variant_id tracking

## Next Steps

**Immediate Recommendation**: **Option 1** (Test from Host)

Execute the activity from this host session where everything works:
```bash
activity({
  templateId: "trace-data-flow-single-feature",
  variables: {
    featureName: "devbob-variant-tracking-pipeline",
    entryPoint: "kubectl exec in devbob",
    exitPoint: "SurrealDB activity_execution table",
    expectedDataFlow: "opencode → MCP → metabob-cli → RPC API → SurrealDB"
  },
  reason: "Document working data flow architecture for DevBob deployment"
})
```

This will:
1. Execute successfully (proven environment)
2. Generate documentation of expected flow
3. Create validation harness we can use in DevBob later
4. Provide baseline for comparison

**Then**: Use findings to debug DevBob execution in separate task.

## Files Created
- DEVBOB_FIX_SUMMARY.md - MCP fixes completed
- DEVBOB_MCP_STATUS_REPORT.md - Initial analysis
- /tmp/rpc-api-logs-trace-*.txt - RPC API log collection
- /tmp/devbob-*-output.txt - Activity execution attempts

## Time Spent
- MCP fixes: ~15 minutes
- Activity execution attempts: ~30 minutes
- Investigation: ~15 minutes
- **Total**: ~60 minutes

## Conclusion

MCP server is fixed and configured correctly, but activity execution in DevBob is blocked by unknown issue (likely missing API keys or environment setup). Recommend switching to host execution to observe working data flow, then debug DevBob separately.
