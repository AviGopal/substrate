# Trace Analysis: ACP Bidirectional Streaming Protocol Handler

**Date**: 2026-03-10  
**Specification**: ACP Bidirectional Streaming Protocol Handler  
**Status**: 🔴 BLOCKED - ReadableStream locking issue identified  
**Trace Impulse ID**: `trace-acp-bidirectional-streaming-protocol-handler`

---

## Executive Summary

The `/acp/stream` endpoint successfully establishes HTTP 200 connection and initializes ACP agent, but fails during protocol handshake with "ReadableStream is locked" error. Root cause identified: **double reader acquisition** on `acpInput` stream.

### Quick Fix
**Delete lines 2114-2116** in `repos/metabob-opencode/packages/opencode/src/server/server.ts`

**Estimated time**: 30-40 minutes (code fix + build + test)

---

## Specification vs Reality

| Requirement | Current State | Status |
|------------|--------------|--------|
| Accept streaming request body without locking | ✅ Works - requestBody readable | ✅ PASS |
| Create acpInput ReadableStream from request body | ✅ Works - stream created correctly | ✅ PASS |
| Create acpOutput WritableStream to response | ✅ Works - Hono stream() integration | ✅ PASS |
| Pass streams to ndJsonStream and AgentSideConnection | ✅ Works - proper setup | ✅ PASS |
| Process initialize request | ❌ Fails before reaching this | ❌ BLOCKED |
| Handle subsequent prompt requests | ❌ Fails before reaching this | ❌ BLOCKED |
| Maintain connection until client closes | ❌ Fails before reaching this | ❌ BLOCKED |
| No 'ReadableStream is locked' errors | ❌ ERROR at line 2115 | ❌ FAIL |

---

## Component Analysis

### 1. ✅ Transport Layer (tcp-transport.ts)
**Status**: Working correctly

```typescript
// tcp-transport.ts:35-89
async connect() {
  const { readable: requestBody, writable: stdin } = new TransformStream<Uint8Array>()
  
  const response = await fetch(`http://${this.host}:${this.port}/acp/stream`, {
    method: "POST",
    body: requestBody,
    duplex: "half",
  })
  
  return { stdin, stdout: response.body }
}
```

**Current Behavior**: Creates bidirectional stream, achieves HTTP 200  
**Desired Behavior**: Same (no changes needed)  
**Gap**: None

---

### 2. ❌ Server Endpoint Handler (server.ts)
**Status**: Stream locking bug

**Location**: `repos/metabob-opencode/packages/opencode/src/server/server.ts:2046-2122`

**Problem Code** (lines 2114-2116):
```typescript
// Keep connection alive until client closes
await new Promise<void>((resolve, reject) => {
  acpInput.getReader().closed.then(resolve).catch(reject)  // ← ERROR: Stream already locked
})
```

**Why It Fails**:
1. Line 2106: `ndJsonStream(acpOutput, acpInput)` acquires reader on `acpInput` ← **FIRST LOCK**
2. Line 2115: `acpInput.getReader()` tries to acquire reader again ← **SECOND LOCK = ERROR**

ReadableStream spec: **Only ONE reader allowed at a time**

**Current Behavior**: Attempts explicit lifecycle tracking via `getReader()`, conflicts with `ndJsonStream`'s internal reader  
**Desired Behavior**: Let `AgentSideConnection` and Hono `stream()` helper manage lifecycle automatically  
**Gap**: Remove lines 2114-2116

---

### 3. ✅ Reference Implementation (acp.ts CLI)
**Status**: Correct pattern (shows how it should work)

```typescript
// acp.ts:52-80
const stream = ndJsonStream(input, output)
const agent = await ACP.init({ sdk })

new AgentSideConnection((conn) => {
  return agent.create(conn, { sdk })
}, stream)

// NOTE: NO explicit getReader() call
// Connection managed by stdin/stdout events
```

**Key Insight**: CLI command does NOT call `getReader()` for lifecycle tracking

**Current Behavior**: Relies on stdin/stdout events and AgentSideConnection for lifecycle  
**Desired Behavior**: Same (this is the correct pattern)  
**Gap**: Server should follow this pattern

---

### 4. ✅ Client-Side Protocol (acp-delegate.ts)
**Status**: Working correctly

**Current Behavior**: Creates transport, establishes connection, ready to send ACP messages  
**Desired Behavior**: Same (no changes needed)  
**Gap**: None - client side is ready once server is fixed

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ WORKING: HTTP Connection Establishment                      │
├─────────────────────────────────────────────────────────────┤
│ Client: TCPTransport.connect()                              │
│   ↓ TransformStream(writable=stdin, readable=requestBody)   │
│   ↓ fetch POST /acp/stream                                  │
│   ↓                                                          │
│ Server: receive c.req.raw.body                              │
│   ↓ Hono stream(c, async (outputStream) => {...})          │
│   ↓ Create acpOutput (WritableStream to HTTP response)     │
│   ↓ Create acpInput (ReadableStream from request body)     │
│   ✓ HTTP 200 achieved                                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ WORKING: ACP Initialization                                  │
├─────────────────────────────────────────────────────────────┤
│ Server: ndJsonStream(acpOutput, acpInput)                   │
│   ↓ Acquires reader on acpInput ← FIRST LOCK (OK)          │
│   ↓                                                          │
│ Server: ACP.init({ sdk, defaultModel })                     │
│   ✓ Initializes without HTTP self-call (fixed d7f4bcf3)    │
│   ✓ Config loaded successfully                              │
│   ✓ "ACP stream initializing" logged                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ BLOCKED: Stream Locking                                      │
├─────────────────────────────────────────────────────────────┤
│ Server: new AgentSideConnection(...)                        │
│   ↓ Ready to process ACP messages                           │
│   ↓                                                          │
│ Server: acpInput.getReader().closed                         │
│   ❌ ERROR: ReadableStream is locked                        │
│   ❌ acpInput already has reader from ndJsonStream          │
│   ❌ Cannot acquire second reader                           │
│   ❌ Connection fails before protocol handshake             │
└─────────────────────────────────────────────────────────────┘
```

---

## Root Cause Deep Dive

### ReadableStream Single-Reader Constraint

Per Web Streams API spec:
> A ReadableStream can have at most one active reader at a time. Once a reader is acquired via `getReader()`, the stream is **locked** until that reader is released.

### Timeline of Events

1. **Line 2053**: Hono's `stream(c, async (outputStream) => {...})` begins
2. **Line 2089-2103**: Create `acpInput` ReadableStream
   - Internal `start()` calls `requestBody.getReader()` ✅ (locks requestBody, not acpInput)
3. **Line 2106**: `ndJsonStream(acpOutput, acpInput)`
   - ndJsonStream internally calls `acpInput.getReader()` ✅ (first lock on acpInput)
4. **Line 2109**: `new AgentSideConnection(...)` created successfully
5. **Line 2115**: `acpInput.getReader().closed`
   - Attempts second `getReader()` on acpInput ❌ (ERROR: already locked by ndJsonStream)

### Why Previous Fix Didn't Catch This

The previous fix (commit d7f4bcf3) solved the **primary blocker** (self-call initialization), which got us to HTTP 200. The stream locking issue is a **secondary blocker** that only manifests after successful initialization.

---

## Solution

### Recommended: Remove Explicit Lifecycle Tracking

**File**: `repos/metabob-opencode/packages/opencode/src/server/server.ts`  
**Lines to delete**: 2114-2116

**Before**:
```typescript
new AgentSideConnection((conn) => {
  return agent.create(conn, { sdk })
}, acpStream)

// Keep connection alive until client closes
await new Promise<void>((resolve, reject) => {
  acpInput.getReader().closed.then(resolve).catch(reject)
})
```

**After**:
```typescript
new AgentSideConnection((conn) => {
  return agent.create(conn, { sdk })
}, acpStream)

// Connection stays alive via Hono stream() helper
// Closes when client closes HTTP connection
```

### Why This Works

1. **AgentSideConnection** manages ACP protocol lifecycle internally
2. **Hono's `stream()` helper** manages HTTP connection lifecycle
3. **Client-side TransformStream** signals closure when client disconnects
4. **No explicit tracking needed** - framework and protocol layers handle it
5. **Matches working pattern** in `acp.ts` CLI command

### Alternative Approaches (Rejected)

**Option 2: Track requestBody instead of acpInput**
- ❌ More complex, requires refactoring
- ❌ Still unnecessary given Hono lifecycle management

**Option 3: Pass requestBody directly to ndJsonStream**
- ❌ Requires changing stream creation logic
- ❌ Unnecessary complexity

---

## Validation Plan

### Test Script
`repos/metabob-opencode/packages/opencode/test-acp-tcp-transport.ts`

### Expected Results After Fix

```
🧪 Testing ACP TCP Transport to DevBob

🎯 Test: TCP transport to DevBob /acp/stream
   Target: http://localhost:8080/acp/stream
   Task: Simple echo test

   → Starting HTTP POST request...
   → Waiting for response...
   ✓ Response status: 200 OK

📋 Step 1: Initialize ACP connection
   ✓ Initialized: opencode v1.0.64

📋 Step 2: Create new session
   ✓ Session created: ses_abc123

📋 Step 3: Send prompt
   ✓ Prompt sent

✅ Test Results:
   Response text: ACP TCP transport is working!
   Tools called: (none)
   Has error: false

🎉 SUCCESS: ACP TCP transport is working!
```

### Validation Steps

1. **Apply fix**: Delete lines 2114-2116 from server.ts
2. **Build**: `cd repos/metabob-opencode && bun run build`
3. **Rebuild image**: `docker build -f docker/devbob.Dockerfile -t devbob:stream-fix .`
4. **Deploy**: `helmfile -e local -l app=devbob apply`
5. **Test**: `bun test-acp-tcp-transport.ts`
6. **Verify logs**: No "ReadableStream is locked" errors
7. **Validate delegation**: Use `acp_delegate` tool for end-to-end test

---

## Impact Assessment

### Risk: 🟢 LOW
- Change is **removal** of problematic code (safe)
- Matches **proven pattern** from CLI command
- Framework (Hono) **already handles** connection lifecycle
- No downstream dependencies affected

### Benefits: 🟢 HIGH
- ✅ Unblocks ACP TCP transport entirely
- ✅ Enables hierarchical activity composition validation
- ✅ Completes Phase 1 of ACP network transport spec
- ✅ Validates devbob-to-devbob delegation for activity decomposition

### Estimated Effort: 30-40 minutes
- Code fix: 5 minutes
- Build & deploy: 10-15 minutes
- Testing & validation: 15-20 minutes

---

## Success Criteria

| Criterion | Before Fix | After Fix |
|-----------|-----------|-----------|
| HTTP 200 connection | ✅ Working | ✅ Working |
| ACP initialization | ✅ Working | ✅ Working |
| No ReadableStream errors | ❌ FAIL | ✅ PASS |
| Initialize message succeeds | ❌ Blocked | ✅ PASS |
| Session creation succeeds | ❌ Blocked | ✅ PASS |
| Prompt execution succeeds | ❌ Blocked | ✅ PASS |
| Response received | ❌ Blocked | ✅ PASS |
| End-to-end TCP delegation | ❌ Blocked | ✅ PASS |

---

## Related Files & Context

### Documentation
- `SESSION_COMPLETION_SUMMARY_2.md` - Previous session results
- `ACP_TCP_BLOCKER_ANALYSIS.md` - Initial blocker analysis
- This file - Complete trace analysis

### Source Files
- `repos/metabob-opencode/packages/opencode/src/server/server.ts:2046-2122` - **FIX HERE**
- `repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts` - ✅ Working
- `repos/metabob-opencode/packages/opencode/src/acp/agent.ts` - ✅ Fixed (d7f4bcf3)
- `repos/metabob-opencode/packages/opencode/src/cli/cmd/acp.ts` - ✅ Reference pattern
- `repos/metabob-opencode/packages/opencode/src/tool/acp-delegate.ts` - ✅ Client side

### Test Files
- `repos/metabob-opencode/packages/opencode/test-acp-tcp-transport.ts` - Validation test
- `tests/validation-harnesses/acp-network-transport-implementation-harness.ts` - Integration test

### Commits
- `d7f4bcf3` - "fix: Pass defaultModel directly to ACP.init" (primary blocker resolved)
- Pending - "fix: Remove explicit getReader() in /acp/stream endpoint" (secondary blocker)

---

## Impulse Created

**ID**: `trace-acp-bidirectional-streaming-protocol-handler`  
**Type**: `templateDefinition`  
**Budget**: 5000 tokens  
**Content**: Complete trace analysis (this document)

This impulse can be used by downstream validation and enforcement tasks to:
1. Understand the exact issue and fix
2. Validate the fix is applied correctly
3. Ensure all test criteria pass
4. Document the resolution in the specification

---

## Next Steps

1. **Immediate**: Apply the fix (delete 3 lines)
2. **Build & Deploy**: Rebuild and deploy DevBob with fix
3. **Validate**: Run test-acp-tcp-transport.ts to verify success
4. **Test Delegation**: Use acp_delegate tool for end-to-end validation
5. **Update Docs**: Mark ACP TCP transport as fully functional
6. **Hierarchical Test**: Validate parent → child activity delegation via TCP

---

## Conclusion

The ACP TCP transport implementation is **99% complete**. Only a simple 3-line removal stands between current state (blocked on stream locking) and full functionality. The fix is **low-risk, high-confidence** because:

1. Root cause precisely identified
2. Solution matches proven pattern (acp.ts CLI)
3. Framework already handles lifecycle
4. No functional code lost (only removing unnecessary tracking)
5. All other components working correctly

**Recommendation**: Apply fix immediately to unblock hierarchical composition validation.

