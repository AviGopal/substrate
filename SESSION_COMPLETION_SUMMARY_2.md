# Session Completion Summary - ACP TCP Transport Fix

## Date: 2026-03-10

## Major Accomplishments ✅

### 1. Root Cause Identified
**Problem**: ACP `/acp/stream` endpoint failed with "Unable to connect. Is the computer able to access the url?"

**Root Cause Found**: 
- `ACP.init({ sdk })` was calling `sdk.config.get()` to fetch default model
- This created a self-referential HTTP call during initialization
- The SDK client couldn't connect back to the same server handling the request

### 2. Core Fix Implemented
**Solution**: Pass `defaultModel` directly to `ACP.init()` to avoid HTTP self-call

**Changes Made**:
- Modified `ACP.init()` in `src/acp/agent.ts` to accept optional `defaultModel` parameter
- Updated `/acp/stream` handler in `src/server/server.ts` to:
  - Load config directly using `Config.get()`
  - Parse model information before ACP initialization
  - Pass `defaultModel` to `ACP.init({ sdk, defaultModel })`
- Created `test-acp-tcp-transport.ts` for standalone validation

**Commit**: d7f4bcf3 - "fix: Pass defaultModel directly to ACP.init to avoid self-call during initialization"

### 3. Build System Fixed
**Problem**: Build failing with `@ai-sdk/anthropic@2.2.10` not found

**Solution**: Updated dependency version from 2.2.10 → 3.0.60 (latest available)

**Result**: Build succeeded, produced all platform binaries

### 4. DevBob Deployment Updated
- Rebuilt `devbob:latest` image with fixes
- Tagged as `devbob:local-fixed`
- Deployed to K8s cluster (pod: `devbob-6d5f99c7cc-g6kr8`)
- Verified image contains ACP fix

### 5. Progress on TCP Transport
**Before**: HTTP 500 - "Unable to connect. Is the computer able to access the url?"
**After**: HTTP 200 - Connection established, initialization started

**Current Status**: New issue discovered - "ReadableStream is locked"

## Test Results

### Standalone Test (`test-acp-tcp-transport.ts`)
```
✓ HTTP connection successful (200 OK)
✓ ACP endpoint accessible
✓ Config loaded successfully (anthropic/claude-sonnet-4-5)
✓ ACP stream initializing logged
❌ ReadableStream locked error during protocol handling
```

### DevBob Logs
```
INFO  ACP stream initializing
      host=devbob.metabob.svc.cluster.local:8080
      defaultModel={"providerID":"anthropic","modelID":"claude-sonnet-4-5"}
ERROR ReadableStream is locked ACP stream error
ERROR The connection was closed. failed
```

## Remaining Issues

### Issue: ReadableStream Locked
**Symptom**: After successful initialization log, stream becomes locked
**Likely Cause**: Hono's `stream()` helper or async timing with `ndJsonStream()`
**Next Steps**: 
1. Investigate stream handling in Hono streaming response
2. Check if `requestBody` is being consumed before `acpInput` creation
3. Consider alternative stream piping approach

## Files Modified

### repos/metabob-opencode
- `packages/opencode/src/acp/agent.ts` - Added defaultModel parameter
- `packages/opencode/src/server/server.ts` - Load config directly, pass to ACP.init
- `packages/opencode/package.json` - Updated @ai-sdk/anthropic to 3.0.60
- `packages/opencode/test-acp-tcp-transport.ts` - Created test script

### Main Repo
- `helm/charts/devbob.values.yaml` - Fixed metabobApiUrl port (from previous session)

## Docker Images
- **devbob:latest** - SHA 583e059c5292 (825MB)
- **devbob:local-fixed** - SHA 583e059c5292 (same as latest)

## Progress Tracker

| Todo | Status | Notes |
|------|--------|-------|
| 1. Create ACP test | ✅ Complete | test-acp-tcp-transport.ts |
| 2. Investigate error | ✅ Complete | Found self-call issue |
| 3. Fix initialization | ✅ Complete | Pass defaultModel directly |
| 4. Fix build | ✅ Complete | Updated anthropic SDK version |
| 5. Debug stream lock | 🔄 In Progress | New blocker discovered |
| 6. End-to-end test | ⏳ Pending | Blocked on #5 |
| 7. Validate composition | ⏳ Pending | Blocked on #5 |

## Key Insights

1. **Self-calls Work**: Testing confirmed DevBob CAN make HTTP calls to itself (localhost:8080/config works fine)

2. **The Real Issue**: Not the network call itself, but the TIMING - SDK initialization happens during request handling

3. **Fix Strategy**: Bypass HTTP calls during initialization by passing data directly

4. **Progress**: We've fixed the PRIMARY blocker (self-call initialization) and discovered a SECONDARY blocker (stream locking)

## Next Session Should Start With

```bash
# Check current state
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob

# Review stream handling in server.ts
# Focus on lines 2053-2110 (stream() usage with ACP)

# Consider alternatives:
# 1. Use raw response.body instead of Hono's stream() helper
# 2. Check if requestBody is consumed before we try to read it
# 3. Look at how other ACP servers handle streaming
```

## Estimated Completion
- **Stream lock fix**: 1-2 hours
- **End-to-end validation**: 30 minutes after fix
- **Total remaining**: ~2-3 hours to complete full TCP transport validation

## Success Criteria Met So Far
- ✅ Identified root cause
- ✅ Implemented core fix
- ✅ Built and deployed fix
- ✅ Connection established (HTTP 200)
- ⏳ Protocol handshake (blocked on stream issue)
- ⏳ End-to-end delegation
- ⏳ Hierarchical composition validation
