# Trace Analysis: ACP Network Transport Implementation

**Specification**: acp-network-transport-implementation  
**Date**: 2026-03-09  
**Status**: ✅ TRACED - Ready for Implementation

---

## Executive Summary

### Recurring Blocker (3+ Attempts)
DevBob activity execution validation blocked by "TCP transport not implemented" error.

**Root Cause**: ACP delegation only supports `docker://` stdio transport. TCP/HTTP transport (`tcp://host:port`) is stubbed but not implemented.

### Architectural Readiness: 80%

✅ Transport abstraction complete  
✅ Factory supports tcp:// parsing  
✅ HTTP server infrastructure exists  
❌ HTTP ACP endpoint missing  
❌ TCPTransport client missing  

---

## Critical Gaps

### 1. TCPTransport.connect() - CRITICAL
**File**: `tcp-transport.ts:36`  
**Gap**: Stub throws error  
**Need**: HTTP fetch() → wrap streams as stdin/stdout

### 2. POST /acp/stream - CRITICAL
**File**: `server.ts:2070`  
**Gap**: No ACP protocol HTTP route  
**Need**: Stream request/response to AgentSideConnection

### 3. ACP Server Port - MINOR
**File**: `acp.ts:39`  
**Gap**: Default port 0 (random)  
**Need**: Default port 3000, document usage

---

## Implementation Path (MVP)

**Step 1**: Add POST /acp/stream endpoint (2h)  
**Step 2**: Update ACP default port to 3000 (30m)  
**Step 3**: Implement TCPTransport.connect() (2h)  
**Step 4**: Test with Kubernetes port-forward (1-2h)  

**Total**: 4-6 hours

---

## References

- **Impulse**: `impulses/trace-acp-network-transport-implementation.json`
- **Validation Harness**: `tests/validation-harnesses/acp-local-network-discovery-harness.ts`
- **Related Commits**: `50c413a`, `692b5e2`
