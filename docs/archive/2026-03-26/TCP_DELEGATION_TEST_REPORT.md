# TCP Delegation Test Report

**Date**: 2026-03-01  
**Test Objective**: Validate TCP-based delegation to devbob pods running independent ACP servers  
**Result**: ❌ **BLOCKED - TCP Transport Not Implemented**

---

## Test Environment

### Kubernetes Cluster Status
```
Namespace: metabob
StatefulSet: devbob (3/3 replicas running)
Pods: devbob-0, devbob-1, devbob-2
Service: devbob-headless (ClusterIP: None)
Ports: 3000 (ACP), 8083 (data-bridge)
```

### Pod Configuration (k8s-devbob-statefulset.yaml:45-55)
```yaml
command:
- /usr/local/bin/entrypoint.sh
args:
- acp
- --port
- "3000"
- --hostname
- 0.0.0.0
- --print-logs
- --log-level
- INFO
```

### ACP Server Status
- ✅ **Server Running**: All 3 pods have ACP servers listening on port 3000
- ✅ **Probes Passing**: TCP liveness/readiness probes succeed (k8s-devbob-statefulset.yaml:116-129)
- ✅ **HTTP Endpoints Working**: Server handles GET /health, GET /config
- ✅ **DNS Resolution**: devbob-headless service configured correctly
- ✅ **Pod DNS Names Available**:
  - devbob-0.devbob-headless.metabob.svc.cluster.local:3000
  - devbob-1.devbob-headless.metabob.svc.cluster.local:3000
  - devbob-2.devbob-headless.metabob.svc.cluster.local:3000

---

## Test Execution

### Test 1: TCP Delegation via Port-Forward

**Setup**:
```bash
kubectl port-forward -n metabob devbob-0 13000:3000
```

**Test Call**:
```typescript
acp_delegate({
  target: "tcp://localhost:13000",
  taskDescription: "Test TCP delegation via port-forward",
  prompt: "Please confirm you received this delegation request...",
  timeout: 60
})
```

**Result**: ❌ **FAILED**

**Error**:
```
TCP transport not yet implemented. tcp://localhost:13000 requires Phase 2 (Network Server). 
Remote ACP server must support HTTP/TCP listener (currently only stdio supported).
```

---

## Root Cause Analysis

### Current Implementation State

**File**: `repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts`

**Status**: **STUB IMPLEMENTATION**

```typescript
/**
 * TCP transport implementation (STUB)
 * 
 * TODO Phase 2: Implement full TCP transport
 * Requires:
 * - Remote ACP server to support HTTP/TCP listener (not just stdio)
 * - stdio-over-http adapter
 * - WebSocket or raw TCP socket handling
 */
export class TCPTransport implements Transport {
  async connect(): Promise<{
    stdin: WritableStream<Uint8Array>
    stdout: ReadableStream<Uint8Array>
  }> {
    throw new Error(
      `TCP transport not yet implemented. ` +
      `tcp://${this.host}:${this.port} requires Phase 2 (Network Server). ` +
      `Remote ACP server must support HTTP/TCP listener (currently only stdio supported).`
    )
  }
}
```

### What's Missing

#### 1. **ACP Server Network Mode**
- **Current**: ACP server only supports stdio-based JSON-RPC (via `docker exec` or SSH)
- **Required**: HTTP/TCP listener that accepts network connections
- **Gap**: The `opencode acp` command needs a `--mode network` flag or similar

#### 2. **stdio-over-HTTP Adapter**
- **Current**: ACP SDK expects `stdin`/`stdout` streams
- **Required**: Bridge between HTTP requests and stdio streams
- **Approaches**:
  - WebSocket connection (bidirectional)
  - Server-Sent Events (SSE) for stdout, POST for stdin
  - HTTP long-polling

#### 3. **TCPTransport Implementation**
- **Current**: Stub that throws error
- **Required**: 
  - HTTP client to connect to remote ACP server
  - Stream adapters to convert HTTP responses to ReadableStream
  - Request handlers to convert WritableStream to HTTP requests

---

## Implementation Roadmap

### Phase 2A: ACP Network Server (Backend - opencode codebase)

**File to modify**: `repos/metabob-opencode/packages/opencode/src/acp/server.ts` (or create new)

**Requirements**:
1. Add HTTP server mode to `opencode acp` command
2. Implement stdio-over-HTTP adapter
3. Support both stdio mode (for docker exec) and network mode (for TCP connections)

**Design Options**:

**Option A: WebSocket-based (Recommended)**
```typescript
// Server side (in pod)
app.ws('/acp', (ws) => {
  const { stdin, stdout } = createStdioPair()
  ws.on('message', (data) => stdin.write(data))
  stdout.on('data', (data) => ws.send(data))
  
  // Run ACP server with stdio streams
  runACPServer(stdin, stdout)
})
```

**Option B: SSE + POST**
```typescript
// Server side (in pod)
app.get('/acp/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  })
  
  stdout.on('data', (data) => {
    res.write(`data: ${data}\n\n`)
  })
})

app.post('/acp/input', (req, res) => {
  stdin.write(req.body)
  res.sendStatus(200)
})
```

**Option C: HTTP Long-Polling**
- Less efficient, but simpler implementation
- Fallback for environments without WebSocket support

### Phase 2B: TCP Transport Client (Frontend - acp-delegate tool)

**File to modify**: `repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts`

**Requirements**:
1. HTTP/WebSocket client to connect to `tcp://host:port`
2. Convert HTTP responses to ReadableStream for stdout
3. Convert WritableStream to HTTP requests for stdin

**Implementation Sketch (WebSocket)**:
```typescript
export class TCPTransport implements Transport {
  async connect(): Promise<{
    stdin: WritableStream<Uint8Array>
    stdout: ReadableStream<Uint8Array>
  }> {
    const ws = new WebSocket(`ws://${this.host}:${this.port}/acp`)
    
    const stdin = new WritableStream({
      write(chunk) {
        ws.send(chunk)
      }
    })
    
    const stdout = new ReadableStream({
      start(controller) {
        ws.on('message', (data) => {
          controller.enqueue(new Uint8Array(data))
        })
        ws.on('close', () => controller.close())
      }
    })
    
    return { stdin, stdout }
  }
}
```

---

## Workaround: Docker Transport (Current State)

### What Works Today

**Transport**: `docker://container-name` (via `docker exec -i`)

**File**: `repos/metabob-opencode/packages/opencode/src/acp/transports/docker-transport.ts`

**How it works**:
```typescript
export class DockerTransport implements Transport {
  async connect(): Promise<{ stdin, stdout }> {
    const proc = spawn([
      "docker", "exec", "-i", 
      this.containerName,
      "opencode", "acp", "--directory", this.directory
    ])
    
    return {
      stdin: proc.stdin,
      stdout: proc.stdout
    }
  }
}
```

### Kubernetes Equivalent: kubectl exec

**Problem**: Requires kubectl access from the calling agent

**Alternative Test** (if kubectl is available in calling context):
```typescript
acp_delegate({
  target: "docker://devbob-0", // Uses docker transport
  taskDescription: "Test via kubectl exec shim",
  prompt: "Confirm delegation...",
  timeout: 60
})
```

**Implementation needed**: Create a `KubernetesTransport` that uses `kubectl exec -i`:
```typescript
export class KubernetesTransport implements Transport {
  async connect() {
    const proc = spawn([
      "kubectl", "exec", "-i", "-n", this.namespace, this.podName,
      "-c", this.containerName,
      "--", "opencode", "acp", "--directory", this.directory
    ])
    
    return {
      stdin: proc.stdin,
      stdout: proc.stdout
    }
  }
}
```

---

## Recommendations

### Short Term (Unblock Testing)

**Option 1: Implement KubernetesTransport**
- Time: ~2-4 hours
- Complexity: Low (copy DockerTransport pattern)
- Target format: `k8s://namespace/pod/container`
- Pros: Unblocks testing immediately
- Cons: Requires kubectl in calling environment

**Option 2: Test with Docker Transport (Local)**
- Time: ~30 minutes
- Run devbob containers locally with docker-compose
- Use existing `docker://devbob-0` transport
- Pros: No code changes needed
- Cons: Doesn't validate k8s deployment

### Medium Term (Production-Ready)

**Implement Phase 2: Network Server**
- Time: ~1-2 days
- Priority: **HIGH** (required for multi-instance coordination)
- Deliverables:
  1. ACP network server with WebSocket support
  2. TCPTransport client implementation
  3. Integration tests with k8s pods
  4. Documentation and examples

**Benefits**:
- ✅ True distributed delegation (no kubectl/docker dependency)
- ✅ Parallel execution across multiple pods
- ✅ Cross-cluster delegation (future)
- ✅ Web-based ACP clients (future)

---

## Test Results Summary

| Test | Status | Reason |
|------|--------|--------|
| TCP delegation to devbob-0 | ❌ BLOCKED | TCP transport not implemented |
| TCP delegation to devbob-1 | ⏸️  SKIPPED | Prerequisite failed |
| Parallel delegation to all 3 pods | ⏸️  SKIPPED | Prerequisite failed |
| Port-forward connectivity | ✅ SUCCESS | ACP server reachable via HTTP |
| Pod DNS resolution | ✅ SUCCESS | Headless service configured correctly |
| ACP server startup | ✅ SUCCESS | All pods running ACP servers on port 3000 |

---

## Next Steps

1. **Decision Required**: Choose short-term approach
   - [ ] Implement KubernetesTransport for immediate unblocking
   - [ ] Wait for Phase 2 TCP transport implementation
   - [ ] Use local docker-compose for testing

2. **Phase 2 Implementation** (if approved):
   - [ ] Design ACP network server architecture
   - [ ] Implement WebSocket-based stdio adapter
   - [ ] Implement TCPTransport client
   - [ ] Add integration tests
   - [ ] Update documentation

3. **Testing Plan** (once transport available):
   - [ ] Single pod delegation (devbob-0)
   - [ ] Multi-pod validation (devbob-1, devbob-2)
   - [ ] Parallel execution test (all 3 pods)
   - [ ] Impulse sharing validation
   - [ ] Work distribution scenario

---

## References

- **ACP Documentation**: `docs/ACP_COMMUNICATION_GUIDELINES.md`
- **Transport Factory**: `repos/metabob-opencode/packages/opencode/src/acp/transports/factory.ts`
- **TCP Transport Stub**: `repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts`
- **Docker Transport** (working reference): `repos/metabob-opencode/packages/opencode/src/acp/transports/docker-transport.ts`
- **StatefulSet Config**: `k8s-devbob-statefulset.yaml`
