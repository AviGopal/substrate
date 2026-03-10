# ACP Kubernetes Service Discovery - Implementation Trace

**Specification**: acp-kubernetes-service-discovery  
**Date**: 2026-03-09  
**Status**: TRACED - Ready for Validation Phase

## Executive Summary

### Current State
- **What works**: TCPTransport with `tcp://localhost:PORT` after manual `kubectl port-forward`
- **Limitation**: Requires host machine access and port-forward setup
- **User experience**: Cumbersome, location-dependent

### Desired State
- **Target format**: `tcp://devbob.metabob.svc.cluster.local:8080`
- **Location independence**: Works from inside cluster, host with cluster access, or remote with VPN
- **User experience**: Zero-config ACP delegation to k8s services

### Critical Finding
**NO CODE CHANGES LIKELY NEEDED** - The architecture is already correct. TCPTransport uses standard `fetch()` which should handle Kubernetes DNS. Main validation needed: server bind address.

## Component Analysis

| Component | File | Status | Changes Needed |
|-----------|------|--------|----------------|
| acp_delegate Tool | acp-delegate.ts:178-488 | ✅ Ready | None - properly abstracted |
| Transport Factory | factory.ts:27-54 | ✅ Ready | None - supports tcp:// |
| TCP Transport | tcp-transport.ts:24-118 | ⚠️ Validate | Verify fetch() DNS resolution |
| Target Parser | transport.ts:62-100 | ⚠️ Validate | Verify FQDN support |
| ACP Server | server.ts | ⚠️ Verify | Check bind address (0.0.0.0) |
| K8s Service | values.yaml:13-24 | ✅ Ready | Already configured |

## Data Flow

```
User Call:
  acp_delegate(target="tcp://devbob.metabob.svc.cluster.local:8080")

Step 1 - Tool Entry:
  ACPDelegateTool.execute() receives target string

Step 2 - Transport Creation:
  createTransport() → parseTarget() → new TCPTransport(host, port)
  
Step 3 - Connection:
  TCPTransport.connect()
  → fetch("http://devbob.metabob.svc.cluster.local:8080/acp/stream")
  
Step 4 - DNS Resolution:
  Kubernetes cluster DNS resolves service name → ClusterIP
  
Step 5 - HTTP Routing:
  k8s service routes request to DevBob pod
  
Step 6 - Server Handling:
  server.ts handles POST /acp/stream
  
Step 7 - Protocol:
  Duplex streaming connection established
  ACP messages flow bidirectionally
```

## Validation Checklist

### Critical (Must Pass)
- [ ] Server binds to `0.0.0.0` not `127.0.0.1`
- [ ] Identify correct port (8080 or 8083)
- [ ] Bun fetch() resolves k8s DNS names
- [ ] /acp/stream endpoint accessible via service

### Important (Should Pass)
- [ ] DNS resolution from inside cluster
- [ ] DNS resolution from host with kubeconfig
- [ ] Connection timeout handling
- [ ] Error messages are clear

### Nice to Have
- [ ] Connection from remote with VPN
- [ ] kubectl proxy support
- [ ] Network policy compatibility

## Blockers Assessment

| Blocker | Risk | Test | Mitigation |
|---------|------|------|------------|
| DNS Resolution | LOW | fetch from cluster | Standard Bun behavior |
| Port Config | LOW | Grep server.ts | Just use correct port |
| Bind Address | MEDIUM | Check server init | Fix if bound to localhost |
| Network Access | LOW | Test from pod | K8s networking proven |

## Implementation Phases

### Phase 1: Validation (1-2 hours)
**Goal**: Confirm architecture assumptions

Tasks:
1. Grep `server.ts` for `/acp/stream` endpoint
2. Check bind address configuration
3. Confirm port mapping (8080 vs 8083)
4. Verify fetch() DNS behavior

**Output**: Validation report confirming readiness or identifying fixes

### Phase 2: Testing Inside Cluster (2-3 hours)
**Goal**: Prove k8s DNS connectivity

Tasks:
1. Deploy test pod in metabob namespace
2. Test health endpoint via service DNS
3. Test acp_delegate with service DNS
4. Verify impulse sharing works

**Output**: Successful delegation from cluster pod

### Phase 3: Testing Outside Cluster (1-2 hours)
**Goal**: Prove location independence

Tasks:
1. Test from host with cluster access
2. Test from remote via VPN/proxy
3. Document network requirements
4. Create troubleshooting guide

**Output**: Documentation and examples

## Expected Outcomes

### Success Criteria
```typescript
// From anywhere with cluster network access:
const result = await acp_delegate({
  target: "tcp://devbob.metabob.svc.cluster.local:8080",
  taskDescription: "Test task",
  prompt: "What is 2+2?",
  timeout: 30
})

// Expected:
// - Connection: <2s in-cluster, <5s remote
// - Result: Successful delegation with response
// - Impulse sharing: Works correctly
```

### Failure Modes
- **DNS Not Found**: Not in cluster network
- **Connection Refused**: Wrong port or server not ready
- **Timeout**: Network routing issue

## Key Insights

1. **Architecture Win**: Transport abstraction isolates connection logic perfectly. No tool changes needed.

2. **Likely Works Now**: Standard fetch() should handle k8s DNS. Only risk is server bind configuration.

3. **Port-Forward Unnecessary**: Current workflow uses port-forward for safe testing, not because it's required architecturally.

4. **Minimal Changes**: If server binds correctly (likely for k8s), this may work immediately.

5. **Big UX Win**: Eliminating port-forward makes ACP delegation truly location-independent.

## References

### Code Files
- `repos/metabob-opencode/packages/opencode/src/tool/acp-delegate.ts`
- `repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts`
- `repos/metabob-opencode/packages/opencode/src/acp/transports/factory.ts`
- `repos/metabob-opencode/packages/opencode/src/acp/transports/transport.ts`
- `repos/metabob-opencode/packages/opencode/src/server/server.ts`
- `helm/charts/devbob/values.yaml`

### Test Files
- `test-impulse-tcp-delegation.ts` - Impulse serialization
- `scripts/verify-devbob-acp-readiness.ts` - Readiness check
- `tests/validation-harnesses/acp-network-transport-*.ts` - Unit tests

### Documentation
- `ACP_TRANSPORT_DISCOVERY.md` - Architecture
- `ACTIVITY_ARCHITECTURE_RESET_ACTION_PLAN.md` - System overview

## Next Steps

1. **Run Validation** (use validation harness or manual checks)
2. **Create Test Pod** (minimal pod in metabob namespace)
3. **Test Connection** (attempt service DNS delegation)
4. **Document Results** (update guide with k8s approach)
5. **Deprecate Port-Forward** (remove from examples)

## Impulse Created

**ID**: `trace-acp-kubernetes-service-discovery`  
**Type**: templateDefinition  
**Budget**: 5000 tokens  
**Content**: Full trace analysis (see impulses/ directory)

This impulse contains:
- Complete component analysis
- Data flow diagram
- Validation checklist
- Implementation phases
- Test scenarios
- Expected behaviors

Use this impulse in downstream validation and enforcement activities.

---

**Trace Complete** - Ready for validation phase execution.
