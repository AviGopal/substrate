# Trace Analysis: ACP Network Transport Implementation

**Specification**: acp-network-transport-implementation
**Date**: 2026-03-09
**Status**: ✅ TRACED - Ready for Implementation

---

## Executive Summary

### Recurring Blocker (3+ Attempts)
**Problem**: DevBob activity execution validation blocked by "TCP transport not implemented" error

**Impact**:
- Cannot delegate to Kubernetes DevBob pods
- Hierarchical composition testing blocked
- Variant ID tracking validation blocked
- Network-based agent coordination unavailable

**Root Cause**: ACP delegation only supports `docker://` stdio transport (subprocess with stdio pipes). TCP/HTTP transport (`tcp://host:port`) is stubbed but not implemented.

### Architectural Readiness: 80%

**What's Done**:
- ✅ Transport abstraction complete (`Transport` interface)
- ✅ Transport factory with `tcp://` parsing
- ✅ HTTP server infrastructure exists (`Server.listen()`)
- ✅ ACP protocol implementation (stdio-based)

**What's Missing**:
- ❌ HTTP ACP endpoint (`POST /acp/stream`)
- ❌ TCPTransport client implementation
- ❌ Stream adapter (HTTP ↔ stdio)

---

## Current State vs Desired State

### Current: Docker stdio Only

```
Host: acp_delegate(target: "docker://container")
  ↓
DockerTransport.connect()
  ↓
spawn("docker exec -i container opencode acp")
  ↓
stdio pipes (stdin/stdout)
  ↓
ndJsonStream
  ↓
ACP Protocol
```

**Limitation**: Requires local Docker daemon, container access

### Desired: TCP/HTTP Transport

```
Host: acp_delegate(target: "tcp://host:port")
  ↓
TCPTransport.connect()
  ↓
fetch("http://host:port/acp/stream", { body: ndjson })
  ↓
HTTP request/response streams
  ↓
ndJsonStream
  ↓
ACP Protocol
```

**Benefit**: Works with Kubernetes, remote Docker, bare metal, VMs

---

## Component Analysis

### 1. TCPTransport Client (CRITICAL GAP)

**File**: `repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts:36`

**Current**:
```typescript
async connect(): Promise<{stdin, stdout}> {
  throw new Error("TCP transport not yet implemented. Phase 2 required.")
}
```

**Required**:
```typescript
async connect(): Promise<{stdin, stdout}> {
  const response = await fetch(`http://${this.host}:${this.port}/acp/stream`, {
    method: "POST",
    body: /* writable stream for sending ndjson */,
    headers: { "Content-Type": "application/x-ndjson" }
  })
  
  return {
    stdin: /* writable stream → request body */,
    stdout: /* readable stream ← response body */
  }
}
```

**Challenge**: Map HTTP request/response to stdio-like streams for `ndJsonStream`

---

### 2. ACP HTTP Endpoint (CRITICAL GAP)

**File**: `repos/metabob-opencode/packages/opencode/src/server/server.ts:2070`

**Current**: Server has REST API routes (`/session`, `/config`, etc.) but NO ACP protocol route

**Required**: Add streaming POST endpoint
```typescript
.post('/acp/stream', async (c) => {
  // 1. Get request body as readable stream (client sends ndjson)
  const inputStream = c.req.body
  
  // 2. Create response as writable stream (server sends ndjson)
  return stream(c, async (outputStream) => {
    // 3. Create ACP connection using HTTP streams
    const connection = new AgentSideConnection(
      (conn) => agent.create(conn),
      ndJsonStream(outputStream, inputStream)
    )
    
    // 4. Keep connection alive until client closes
  })
})
```

---

### 3. ACP Command Server Mode (MINOR GAP)

**File**: `repos/metabob-opencode/packages/opencode/src/cli/cmd/acp.ts:39`

**Current**: 
- Default `--port 0` (random port)
- Only starts HTTP server for SDK API (not used for ACP protocol)
- Primary mode: stdio (for `docker exec`)

**Required**:
- Change default `--port 3000` (well-known port)
- HTTP server must serve ACP protocol endpoint
- Document: use `opencode acp --port 3000` in Kubernetes pods

---

## Data Flow

### Successful TCP Delegation Flow

```
1. Host Agent
   ↓ acp_delegate({ target: "tcp://devbob-pod:3000", prompt: "..." })
   ↓
2. Transport Factory
   ↓ parseTarget("tcp://devbob-pod:3000") → {type: "tcp", host: "devbob-pod", port: 3000}
   ↓
3. TCPTransport.connect()
   ↓ fetch("http://devbob-pod:3000/acp/stream", { method: "POST", body: ... })
   ↓
4. HTTP Request → Server
   ↓ POST /acp/stream
   ↓ Hono route handler
   ↓
5. AgentSideConnection (Server)
   ↓ ndJsonStream(response body, request body)
   ↓ ACP.Agent.create(connection)
   ↓
6. ACP Protocol Messages (bidirectional)
   ↓ initialize() → session/new → session/prompt
   ↓
7. Remote Agent Execution
   ↓ Tool calls, file reads, etc.
   ↓
8. Response Stream
   ↓ Agent messages → ndjson → HTTP response
   ↓
9. Host Receives Response
   ↓ TCPTransport stdout stream
   ↓ ClientSideConnection parses messages
   ↓
10. Return to User
    Final response from acp_delegate
```

---

## Critical Risks

### 1. HTTP Stream Compatibility (HIGH)
**Risk**: `ndJsonStream` expects Bun/Web Streams API. HTTP request/response bodies must be correctly wrapped.

**Mitigation**: 
- Test with simple echo protocol first
- Verify Bun's `request.body` and `stream()` API compatibility
- Add integration test: send ACP initialize, expect protocol response

---

### 2. HTTP Request Timeout (HIGH)
**Risk**: Long-running ACP sessions may exceed default HTTP timeout (typically 30-120s)

**Mitigation**:
- Phase 1 (MVP): Accept timeout limitation (sufficient for validation)
- Phase 2: Upgrade to WebSocket for long-lived connections
- Set explicit timeout in fetch options

---

### 3. Connection Cleanup (MEDIUM)
**Risk**: HTTP connection lifecycle differs from subprocess (no `kill()` method)

**Mitigation**:
- Implement `TCPTransport.close()` with `AbortController`
- Abort fetch request on cleanup
- Test cleanup with simulated connection drop

---

### 4. Server Discoverability (MEDIUM)
**Risk**: Need to know pod IP/port for `tcp://host:port` target

**Mitigation**:
- Use `kubectl port-forward` for local testing
- Use Kubernetes Service DNS for production (e.g., `tcp://devbob-service:3000`)
- Document deployment pattern in DevBob helm chart

---

## Implementation Path (Minimal Viable)

### Step 1: Add HTTP ACP Endpoint (2 hours)
**File**: `repos/metabob-opencode/packages/opencode/src/server/server.ts`

**Task**: Add `POST /acp/stream` route

**Validation**: 
```bash
curl -X POST http://localhost:3000/acp/stream \
  -H "Content-Type: application/x-ndjson" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{...},"id":1}'
```

**Success**: Returns ACP handshake response in ndjson format

---

### Step 2: Update ACP Server Default Port (30 minutes)
**File**: `repos/metabob-opencode/packages/opencode/src/cli/cmd/acp.ts`

**Changes**:
- Default `--port 3000` (instead of 0)
- Start HTTP server even without stdio client

**Validation**:
```bash
opencode acp --port 3000
# In another terminal:
curl http://localhost:3000/doc  # Returns OpenAPI spec
```

---

### Step 3: Implement TCPTransport.connect() (2 hours)
**File**: `repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts`

**Task**: Use `fetch()` to POST ndjson, wrap streams as stdin/stdout

**Validation**:
```typescript
// In test or validation script:
const transport = new TCPTransport("localhost", 3000)
const { stdin, stdout } = await transport.connect()
// Write ACP initialize message
// Read response
// Verify handshake succeeds
```

---

### Step 4: Integration Test with Kubernetes (1-2 hours)
**Setup**:
1. Deploy DevBob pod with `opencode acp --port 3000`
2. Use `kubectl port-forward devbob-pod 8080:3000`
3. From host: `acp_delegate({ target: "tcp://localhost:8080", ... })`

**Success**: Activity executes in remote pod, results return to host

---

### Step 5: Document Pattern (30 minutes)
**Files**: 
- `helm/devbob/values.yaml` (add ACP port config)
- `docs/acp-network-transport.md` (usage guide)

**Content**:
- How to enable HTTP ACP server
- How to construct `tcp://` targets
- Kubernetes service DNS patterns

---

## Minimal Viable Implementation

**Scope** (unblock validation):
- ✅ HTTP POST /acp/stream endpoint (basic streaming)
- ✅ TCPTransport.connect() using fetch() (no retry)
- ✅ Manual port-forward for Kubernetes access

**Deferred** (production hardening):
- ⏸️ WebSocket upgrade for long-lived connections
- ⏸️ Authentication/authorization for ACP endpoint
- ⏸️ Automatic service discovery (mDNS, Kubernetes DNS)
- ⏸️ Connection pooling and keep-alive

**Time Estimate**: 4-6 hours
- 2h server endpoint
- 2h client transport
- 1-2h validation and debugging

---

## Validation Checklist

### Functional Requirements
- [ ] HTTP server starts with `--port` flag
- [ ] POST /acp/stream accepts ndjson body
- [ ] ACP handshake completes over HTTP
- [ ] `tcp://localhost:3000` target connects successfully
- [ ] Remote prompt execution returns response
- [ ] Kubernetes pod delegation works via port-forward
- [ ] Connection cleanup (`close()`) works correctly
- [ ] Error handling for connection failures

### Non-Functional Requirements
- [ ] HTTP latency <100ms overhead vs stdio
- [ ] No memory leaks on connection close
- [ ] Concurrent connections supported (10+ simultaneous)
- [ ] Graceful degradation when server unreachable

---

## Enforcement Constraints

### Compatibility
- Must not break existing `docker://` transport
- Must not break existing REST API endpoints
- `ndJsonStream` must work with HTTP streams

### Reliability
- Connection timeout (default 5min, configurable)
- Retry logic for transient network failures
- Proper cleanup on connection close

### Security
- Optional authentication for ACP HTTP endpoint
- Rate limiting to prevent DoS
- Validate target `host:port` format

---

## References

**Impulse**: `impulses/trace-acp-network-transport-implementation.json`

**Related Files**:
- `repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts` (stub)
- `repos/metabob-opencode/packages/opencode/src/server/server.ts` (HTTP server)
- `repos/metabob-opencode/packages/opencode/src/cli/cmd/acp.ts` (ACP command)
- `repos/metabob-opencode/packages/opencode/src/acp/transports/factory.ts` (factory)
- `repos/metabob-opencode/packages/opencode/src/tool/acp-delegate.ts` (consumer)

**Validation Harness**: `tests/validation-harnesses/acp-local-network-discovery-harness.ts`

**Git History**:
- Commit `50c413a`: "docs: Document ACP delegation limitation"
- Commit `692b5e2`: "feat(acp): Add validation harness and impulses"

---

## Next Steps

1. **Implement**: Follow implementation path steps 1-4
2. **Validate**: Run validation checklist
3. **Document**: Update docs with tcp:// usage patterns
4. **Deploy**: Update DevBob Kubernetes deployment with ACP port
5. **Unblock**: Retry failed validation activities (DevBob execution, hierarchical composition)

---

**Status**: Ready for implementation
**Blocker Resolution**: Implementing TCP transport will unblock 3+ failed validation attempts
**Business Value**: Enables network-based agent coordination, Kubernetes deployment, multi-vessel orchestration
