# Validation Harness: metabob-session-tracking

## Overview

This validation harness tests the implementation of **Specification 2: Session Lifecycle Tracking** from `METABOB_INTEGRATION_SPECIFICATIONS.md`.

## What It Tests

### Core Requirements

1. **Session Start Tracking**
   - `Session.createNext()` calls `MetabobTracking.recordSessionStart()`
   - MCP tool `metabob_record_session_start` is invoked
   - Payload includes: sessionId, agentType, timestamp, workingDirectory, git context

2. **Session Close Tracking**
   - `Session.close()` aggregates stats via `SessionStats.getSessionStats()`
   - MCP tool `metabob_record_session_complete` is invoked
   - Payload includes: sessionId, timestamp, summary (prompts, tokens, cost, tools), outcome

3. **Error Resilience**
   - Session creation succeeds even if MCP tracking fails
   - Session close succeeds even if MCP tracking fails
   - Tracking errors are logged but don't propagate

4. **Agent Type Logic**
   - Defaults to "general" when no `activityId` provided
   - Uses `activityId` when provided

## Test Cases

| # | Test Case | Input | Expected Output |
|---|-----------|-------|-----------------|
| 1 | Session start tracking | Create session with activityId | metabob_record_session_start called with correct payload |
| 2 | Session close tracking | Close session | metabob_record_session_complete called with stats |
| 3 | Agent type default | Create session without activityId | agentType = "general" |
| 4 | Agent type from activityId | Create session with activityId | agentType = activityId |
| 5 | Start tracking failure resilience | Create session, mock MCP failure | Session created successfully |
| 6 | Close tracking failure resilience | Close session, mock MCP failure | Session closed successfully |

## Running the Validation

### Quick Run

```bash
bun tests/validation-harnesses/run-metabob-session-tracking-validation.ts
```

### Direct Harness Execution

```bash
bun tests/validation-harnesses/metabob-session-tracking-harness.ts
```

### Expected Output

```
🧪 Running validation harness: metabob-session-tracking

📊 Validation Results:
   Total Tests: 6
   ✅ Passed: 6
   ❌ Failed: 0
   Success Rate: 100.0%

📋 Test Details:

✅ Session.createNext() triggers metabob_record_session_start
✅ Session.close() triggers metabob_record_session_complete with stats
✅ Agent type defaults to 'general' when no activityId provided
✅ Agent type uses activityId when provided
✅ Session creation succeeds even if MCP tracking fails
✅ Session.close() succeeds even if MCP tracking fails
```

## Implementation Details

### Mocking Strategy

The harness mocks `MCP.clients()` to return a `MockMCPClient` that:
- Captures all `callTool()` invocations
- Records tool names and arguments
- Allows inspection of tracking calls
- Can simulate MCP failures for error resilience testing

### Validation Approach

1. **Mock Setup**: Replace `MCP.clients()` with mock client
2. **Action**: Create/close sessions using real Session API
3. **Capture**: Intercept MCP tracking calls
4. **Verify**: Check payloads match expected structure
5. **Error Testing**: Mock MCP failures and verify session lifecycle continues
6. **Cleanup**: Remove test sessions from storage

### Key Files

- **Harness**: `tests/validation-harnesses/metabob-session-tracking-harness.ts`
- **Runner**: `tests/validation-harnesses/run-metabob-session-tracking-validation.ts`
- **Test Cases**: `VALIDATION_METABOB_SESSION_TRACKING.json`
- **Trace**: `TRACE_METABOB_SESSION_TRACKING.json`
- **Enforcement**: `ENFORCEMENT_METABOB_SESSION_TRACKING.json`

## Dependencies

### Source Files Under Test

- `repos/metabob-opencode/packages/opencode/src/session/index.ts`
  - `Session.createNext()` - Session creation with start tracking
  - `Session.close()` - Session closure with complete tracking

- `repos/metabob-opencode/packages/opencode/src/session/metabob-tracking.ts`
  - `MetabobTracking.recordSessionStart()` - Start tracking wrapper
  - `MetabobTracking.recordSessionComplete()` - Complete tracking wrapper

- `repos/metabob-opencode/packages/opencode/src/session/stats.ts`
  - `SessionStats.getSessionStats()` - Stats aggregation

- `repos/metabob-opencode/packages/opencode/src/mcp/index.ts`
  - `MCP.clients()` - MCP client registry (mocked)

### Runtime Requirements

- Bun runtime (`bun:test` framework)
- OpenCode project initialized (Instance.project)
- Storage backend available

## Success Criteria

All 6 tests must pass:

- ✅ Session start tracking triggered
- ✅ Session close tracking triggered
- ✅ Payloads structurally correct
- ✅ Agent type logic correct
- ✅ Error resilience verified

## Integration Status

### ✅ Implemented

- Session.createNext() tracking integration
- Session.close() tracking integration
- MetabobTracking MCP wrapper
- SessionStats aggregation
- Error handling and fire-and-forget pattern

### ⏳ Pending

- CLI integration (call Session.close() on exit)
- Server integration (call Session.close() on cleanup)
- Activity cleanup integration (call Session.close() in cleanupActivitySession)
- Files modified tracking (integrate with Snapshot)

## Related Documentation

- Specification: `METABOB_INTEGRATION_SPECIFICATIONS.md` (Specification 2)
- Trace Analysis: `TRACE_METABOB_SESSION_TRACKING.json`
- Enforcement Report: `ENFORCEMENT_METABOB_SESSION_TRACKING.json`
- Test Results: `test-results/metabob-session-tracking-validation-results.json` (after run)

## Troubleshooting

### Tests Fail: "MCP client not available"

**Cause**: Mock not properly injected

**Fix**: Ensure `MCP.clients = async () => ({ metabob: mockClient })` executes before session creation

### Tests Fail: "Session not created"

**Cause**: Storage or Instance initialization issue

**Fix**: Verify OpenCode project is initialized and storage backend is accessible

### Tests Timeout

**Cause**: Async tracking calls not completing

**Fix**: Increase `setTimeout` delays in test cases (currently 100ms)

### Mock Calls Not Captured

**Cause**: Tracking is fire-and-forget, may complete after test ends

**Fix**: Add adequate wait time after session operations before checking mock calls

## Future Enhancements

1. Add test for git context extraction (branch, commit)
2. Validate stats aggregation accuracy (tokens, cost, prompts)
3. Test tool name extraction from message parts
4. Validate filesModified count once Snapshot integration added
5. Test concurrent session tracking (multiple sessions in parallel)
6. Test session cleanup tracking (Session.remove() should trigger close?)

## Contact

For questions or issues with this validation harness, refer to:
- Trace analysis: `TRACE_METABOB_SESSION_TRACKING.json`
- Enforcement report: `ENFORCEMENT_METABOB_SESSION_TRACKING.json`
