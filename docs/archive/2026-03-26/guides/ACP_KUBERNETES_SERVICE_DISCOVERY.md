# ACP Kubernetes Service Discovery

**Date**: 2026-03-09  
**Status**: Production Ready  
**Specification**: acp-kubernetes-service-discovery

## Overview

ACP delegation now supports Kubernetes service DNS for location-independent agent communication. This eliminates the need for manual `kubectl port-forward` and enables connection from any location with cluster network access.

## Connection Methods

### Method 1: Kubernetes Service DNS (Recommended)

Connect directly using the Kubernetes service DNS name:

```typescript
const result = await acp_delegate({
  target: "tcp://devbob.metabob.svc.cluster.local:8080",
  taskDescription: "Execute task in DevBob",
  prompt: "What is the current working directory?",
  timeout: 30
})
```

**Benefits**:
- ✅ No manual port-forward required
- ✅ Works from inside cluster
- ✅ Works from host with cluster network access
- ✅ Works from remote with VPN/kubectl proxy
- ✅ Location-independent
- ✅ Production-ready

**Requirements**:
- Kubernetes cluster network access
- DevBob deployed in `metabob` namespace
- Network routing allows pod-to-pod or external-to-pod communication

### Method 2: Port-Forward (Legacy, Development Only)

For local development or troubleshooting:

```bash
# Terminal 1: Port-forward
kubectl port-forward -n metabob svc/devbob 8080:8080

# Terminal 2: Use localhost
acp_delegate({
  target: "tcp://localhost:8080",
  ...
})
```

**When to use**:
- Local development without cluster network access
- Troubleshooting connection issues
- Testing from machine without cluster routing

## Architecture

### Data Flow

```
User → acp_delegate tool
  ↓
Transport Factory → TCPTransport
  ↓
fetch("http://devbob.metabob.svc.cluster.local:8080/acp/stream")
  ↓
Kubernetes DNS → ClusterIP resolution
  ↓
Kubernetes Service → Routes to DevBob pod
  ↓
DevBob ACP Server → Handles /acp/stream endpoint
  ↓
ACP Protocol → Duplex streaming connection established
```

### Key Components

| Component | Configuration | Status |
|-----------|---------------|--------|
| **ACP Server Bind** | `0.0.0.0:8080` | ✅ Production Ready |
| **K8s Service** | `devbob.metabob.svc.cluster.local` | ✅ ClusterIP |
| **Service Port** | `8080 → 8080` | ✅ Exposed |
| **Endpoint** | `POST /acp/stream` | ✅ Implemented |
| **Transport** | `TCPTransport` | ✅ DNS-aware |

## Configuration Details

### DevBob Deployment

The DevBob deployment is pre-configured for network access:

**File**: `helm/charts/devbob/templates/deployment.yaml`

```yaml
args:
- acp
- --hostname
- "0.0.0.0"  # ← Binds to all interfaces for k8s service access
- --port
- "8080"
```

### Service Configuration

**File**: `helm/charts/devbob/values.yaml`

```yaml
service:
  type: ClusterIP
  port: 8080
  targetPort: 8080
```

**DNS Name**: `devbob.metabob.svc.cluster.local`

## Usage Examples

### Example 1: Simple Task Execution

```typescript
const result = await acp_delegate({
  target: "tcp://devbob.metabob.svc.cluster.local:8080",
  taskDescription: "Check working directory",
  prompt: "What is the current working directory?",
  timeout: 30
})

console.log(result.response) // → "/workspace"
```

### Example 2: With Impulse Sharing

```typescript
// Create impulse with data
await impulse_create({
  id: "api-spec",
  pointer: {
    type: "memo",
    content: "API Design:\n- REST endpoints\n- JWT auth"
  },
  budget: 2000
})

// Share with DevBob
const result = await acp_delegate({
  target: "tcp://devbob.metabob.svc.cluster.local:8080",
  taskDescription: "Implement API endpoints",
  prompt: "Implement the API endpoints per the shared design",
  shareImpulses: ["api-spec"],
  timeout: 300
})
```

### Example 3: Activity Execution

```typescript
const result = await acp_delegate({
  target: "tcp://devbob.metabob.svc.cluster.local:8080",
  taskDescription: "Run test activity",
  prompt: "Execute the 'add-rest-endpoint' activity with method=POST, path=/api/users",
  timeout: 600
})
```

## Network Access Scenarios

### Scenario 1: From Inside Cluster

**Context**: Running in a pod within the same Kubernetes cluster

**Configuration**: Use service DNS directly

```typescript
target: "tcp://devbob.metabob.svc.cluster.local:8080"
```

**Expected**: Connection < 2 seconds, full pod-to-pod networking

### Scenario 2: From Host with Cluster Access

**Context**: Running on host machine with kubectl configured

**Configuration**: Use service DNS directly (requires cluster network access)

```typescript
target: "tcp://devbob.metabob.svc.cluster.local:8080"
```

**Expected**: Connection < 5 seconds (depends on cluster network setup)

**Note**: May require additional network configuration depending on cluster type:
- Minikube: Requires `minikube tunnel` or service exposure
- Kind: Requires port mapping or ingress
- Cloud K8s: Usually works out-of-box with VPN/network access

### Scenario 3: From Remote with VPN

**Context**: Remote machine connected via VPN to cluster network

**Configuration**: Use service DNS directly

```typescript
target: "tcp://devbob.metabob.svc.cluster.local:8080"
```

**Expected**: Connection time depends on VPN latency

### Scenario 4: Using kubectl proxy

**Context**: Any machine with kubectl access, no direct cluster network

**Setup**:
```bash
kubectl proxy --port=8001
```

**Configuration**: Use proxy URL

```typescript
target: "tcp://localhost:8001/api/v1/namespaces/metabob/services/devbob:8080/proxy/acp/stream"
```

**Expected**: Works through kubectl proxy layer

## Troubleshooting

### DNS Not Found

**Error**: `getaddrinfo ENOTFOUND devbob.metabob.svc.cluster.local`

**Cause**: Not in cluster network or DNS not configured

**Solutions**:
1. Verify cluster network access
2. Check namespace: `kubectl get svc -n metabob`
3. Test DNS: `kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup devbob.metabob.svc.cluster.local`
4. Fall back to port-forward for development

### Connection Refused

**Error**: `ECONNREFUSED`

**Cause**: Wrong port, pod not ready, or server not listening

**Solutions**:
1. Check pod status: `kubectl get pods -n metabob -l app=devbob`
2. Check pod logs: `kubectl logs -n metabob <pod-name>`
3. Verify port mapping: `kubectl get svc -n metabob devbob -o yaml`
4. Test endpoint: `kubectl exec -n metabob <pod-name> -- wget -O- http://localhost:8080/health`

### Connection Timeout

**Error**: `TCP connection timeout`

**Cause**: Network routing issue or firewall

**Solutions**:
1. Check network policies: `kubectl get networkpolicies -n metabob`
2. Verify service endpoints: `kubectl get endpoints -n metabob devbob`
3. Test from debug pod: `kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- curl http://devbob.metabob.svc.cluster.local:8080/health`

## Migration from Port-Forward

### Before (Port-Forward Required)

```bash
# Terminal 1
kubectl port-forward -n metabob svc/devbob 8080:8080

# Terminal 2
acp_delegate({
  target: "tcp://localhost:8080",
  ...
})
```

### After (Direct DNS)

```typescript
// No port-forward needed!
acp_delegate({
  target: "tcp://devbob.metabob.svc.cluster.local:8080",
  ...
})
```

## Testing

### Test 1: DNS Resolution

From inside cluster:

```bash
kubectl run -it --rm dns-test --image=busybox --restart=Never -- nslookup devbob.metabob.svc.cluster.local
```

Expected output:
```
Server:    10.96.0.10
Address 1: 10.96.0.10 kube-dns.kube-system.svc.cluster.local

Name:      devbob.metabob.svc.cluster.local
Address 1: 10.100.200.50 devbob.metabob.svc.cluster.local
```

### Test 2: HTTP Endpoint

```bash
kubectl run -it --rm http-test --image=curlimages/curl --restart=Never -- \
  curl -v http://devbob.metabob.svc.cluster.local:8080/health
```

Expected: HTTP 200 response

### Test 3: ACP Delegation

```typescript
// From any location with cluster access
const result = await acp_delegate({
  target: "tcp://devbob.metabob.svc.cluster.local:8080",
  taskDescription: "Health check",
  prompt: "Echo the text: k8s-dns-test",
  timeout: 10
})

console.assert(result.response.includes("k8s-dns-test"))
```

## Security Considerations

### Network Policies

If using NetworkPolicies, ensure pod-to-pod traffic is allowed:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-acp
  namespace: metabob
spec:
  podSelector:
    matchLabels:
      app: devbob
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector: {}  # Allow from all pods in namespace
    ports:
    - protocol: TCP
      port: 8080
```

### Service Exposure

The service uses ClusterIP (internal only). For external access:
- ✅ Use VPN to cluster network
- ✅ Use kubectl proxy
- ⚠️  Avoid LoadBalancer/NodePort (security risk)
- ⚠️  Avoid Ingress without proper authentication

## Performance

### Connection Times

| Scenario | Expected Time | Notes |
|----------|---------------|-------|
| In-cluster (pod-to-pod) | < 2 seconds | Optimal |
| Host with cluster access | < 5 seconds | Depends on network |
| Remote via VPN | < 10 seconds | Depends on latency |
| kubectl proxy | < 5 seconds | Additional proxy layer |

### Comparison vs Port-Forward

| Metric | Port-Forward | Service DNS |
|--------|--------------|-------------|
| Setup Time | 5-10 seconds | 0 seconds |
| Connection Time | < 1 second | < 2-5 seconds |
| Reliability | Manual process | Automatic |
| Location Dependency | Host machine only | Anywhere with cluster access |
| Production Readiness | ❌ Development only | ✅ Production ready |

## References

- **Trace Analysis**: `TRACE_acp-kubernetes-service-discovery.md`
- **Deployment Config**: `helm/charts/devbob/templates/deployment.yaml`
- **Service Config**: `helm/charts/devbob/values.yaml`
- **ACP Transport**: `repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts`

## Changelog

### 2026-03-09: Production Ready
- ✅ Verified DevBob binds to `0.0.0.0`
- ✅ Confirmed service DNS configuration
- ✅ Updated ACP command default to `0.0.0.0`
- ✅ Documented all connection methods
- ✅ Created troubleshooting guide

---

**Status**: ✅ Production Ready - Use `tcp://devbob.metabob.svc.cluster.local:8080` for all ACP delegation
