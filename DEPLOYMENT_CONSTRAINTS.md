# Distributed DevBob Deployment Constraints

**Date**: 2026-02-27  
**Purpose**: Define and enforce architectural constraints for distributed DevBob deployments  
**Principle**: Work happens across the system, not in one instance

---

## Core Architectural Constraints

### 1. Multi-Vessel Requirement

**Constraint**: Minimum 3 DevBob vessels must be deployed and running

**Rationale**:
- Enforces distributed development (no single-instance bypass)
- Enables parallel execution (3+ concurrent tasks)
- Provides fault tolerance (1 vessel can fail, 2 continue)
- Demonstrates true coordination (vessels must communicate)

**Validation**:
```bash
RUNNING=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob --field-selector=status.phase=Running --no-headers | wc -l)
if [ "$RUNNING" -lt 3 ]; then
  echo "❌ VIOLATION: Only $RUNNING vessels running (minimum: 3)"
  exit 1
fi
```

**Enforcement**:
```bash
kubectl scale deployment/devbob -n metabob --replicas=3
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=devbob -n metabob --timeout=300s
```

---

### 2. Coordination Layer Requirement

**Constraint**: All coordination services must be deployed and healthy

**Required Services**:
- ✅ Redis (master) - Boredom queue, session cache
- ✅ SurrealDB - Activity state, vessel registry, learning metrics
- ✅ metabob-rpc-api - Thompson Sampling, improvement gradients

**Rationale**:
- Redis: Required for boredom activity queue (autonomous improvement)
- SurrealDB: Required for vessel registry (discovery) and activity state (coordination)
- metabob-rpc-api: Required for learning loop (Thompson Sampling, gradients)

**Validation**:
```bash
# Check Redis
kubectl get pod -n metabob -l app.kubernetes.io/name=redis --field-selector=status.phase=Running
kubectl exec -n metabob statefulset/redis-master -- redis-cli ping | grep -q PONG

# Check SurrealDB
kubectl get pod -n metabob -l app.kubernetes.io/name=surrealdb --field-selector=status.phase=Running
curl -sf http://$(kubectl get svc/surrealdb -n metabob -o jsonpath='{.spec.clusterIP}'):8000/health

# Check metabob-rpc-api
kubectl get pod -n metabob -l app.kubernetes.io/name=metabob-rpc-api --field-selector=status.phase=Running
curl -sf http://$(kubectl get svc/metabob-rpc-api -n metabob -o jsonpath='{.spec.clusterIP}'):8080/health
```

**Enforcement**:
```bash
cd helm
helmfile -f helmfile.yaml -e local --selector name=redis sync --wait
helmfile -f helmfile.yaml -e local --selector name=surrealdb sync --wait
helmfile -f helmfile.yaml -e local --selector name=metabob-rpc-api sync --wait
```

---

### 3. Workspace Isolation Requirement

**Constraint**: Each vessel must have independent persistent storage (PVC)

**Rationale**:
- Prevents workspace conflicts (no shared file locks)
- Enables parallel file operations (independent git repos)
- Provides data isolation (vessel 1 changes don't affect vessel 2)
- Simplifies backup/restore (per-vessel snapshots)

**Validation**:
```bash
VESSELS=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob --no-headers | wc -l)
PVCS=$(kubectl get pvc -n metabob -l app.kubernetes.io/name=devbob --field-selector=status.phase=Bound --no-headers | wc -l)

if [ "$PVCS" -lt "$VESSELS" ]; then
  echo "❌ VIOLATION: Only $PVCS PVCs for $VESSELS vessels"
  exit 1
fi
```

**Enforcement**:
```yaml
# In Helm values
persistence:
  enabled: true
  size: 10Gi
  storageClassName: default
  accessModes:
    - ReadWriteOnce  # Each vessel gets own PVC
```

---

### 4. ACP Communication Requirement

**Constraint**: All vessels must expose ACP endpoints (port 3000)

**Rationale**:
- Enables task delegation (host → vessel, vessel → vessel)
- Standardizes communication protocol (language-agnostic)
- Supports impulse sharing (context transfer)
- Required for distributed workflows

**Validation**:
```bash
# Check services expose port 3000
SERVICES=$(kubectl get svc -n metabob -l app.kubernetes.io/name=devbob -o json | jq -r '.items[].spec.ports[] | select(.port==3000) | .port' | wc -l)
VESSELS=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob --no-headers | wc -l)

if [ "$SERVICES" -eq 0 ]; then
  echo "❌ VIOLATION: No ACP services configured"
  exit 1
fi
```

**Enforcement**:
```yaml
# In Helm values
service:
  type: ClusterIP
  ports:
    - name: acp
      port: 3000
      targetPort: 3000
      protocol: TCP
```

---

### 5. Vessel Registry Requirement

**Constraint**: SurrealDB must have vessel_registry table with all vessels registered

**Rationale**:
- Enables dynamic vessel discovery (query-based, not hardcoded)
- Tracks vessel health (heartbeat timestamps)
- Supports load balancing (route tasks to available vessels)
- Required for coordination layer

**Validation**:
```sql
-- Query vessel count in SurrealDB
SELECT count() as registered_vessels FROM vessel_registry WHERE status = 'running';

-- Expected: registered_vessels >= 3
```

**Enforcement**:
```sql
-- Initialize schema
DEFINE TABLE vessel_registry SCHEMAFULL;
DEFINE FIELD vessel_id ON vessel_registry TYPE string;
DEFINE FIELD pod_name ON vessel_registry TYPE string;
DEFINE FIELD pod_ip ON vessel_registry TYPE string;
DEFINE FIELD acp_endpoint ON vessel_registry TYPE string;
DEFINE FIELD status ON vessel_registry TYPE string;
DEFINE FIELD last_heartbeat ON vessel_registry TYPE datetime;

-- Register vessels
INSERT INTO vessel_registry (vessel_id, pod_name, pod_ip, acp_endpoint, status, last_heartbeat)
SELECT 
  uid as vessel_id,
  name as pod_name,
  ip as pod_ip,
  'http://' + ip + ':3000' as acp_endpoint,
  'running' as status,
  time::now() as last_heartbeat
FROM (kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o json);
```

---

### 6. Backend Connectivity Requirement

**Constraint**: All vessels must be able to reach all backend services

**Rationale**:
- Vessels depend on Redis (boredom queue)
- Vessels depend on SurrealDB (activity state)
- Vessels depend on metabob-rpc-api (learning metrics)
- Network issues break coordination

**Validation**:
```bash
# Test from each vessel
for POD in $(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o jsonpath='{.items[*].metadata.name}'); do
  echo "Testing vessel: $POD"
  
  # Redis
  kubectl exec -n metabob $POD -- curl -sf http://redis-master:6379 || echo "Redis unreachable"
  
  # SurrealDB
  kubectl exec -n metabob $POD -- curl -sf http://surrealdb:8000/health || echo "SurrealDB unreachable"
  
  # metabob-rpc-api
  kubectl exec -n metabob $POD -- curl -sf http://metabob-rpc-api:8080/health || echo "API unreachable"
done
```

**Enforcement**:
```bash
# Ensure services are in same namespace
kubectl get svc -n metabob

# Ensure DNS resolution works
kubectl exec -n metabob deploy/devbob -- nslookup redis-master.metabob.svc.cluster.local
```

---

### 7. Resource Allocation Constraint

**Constraint**: Each vessel must have minimum resource guarantees

**Rationale**:
- Prevents resource starvation (eviction under load)
- Ensures consistent performance (predictable activity execution)
- Enables autoscaling (knows resource needs)
- Required for production deployment

**Minimum Resources per Vessel**:
- CPU: 500m (0.5 cores)
- Memory: 512Mi
- Storage: 10Gi

**Validation**:
```bash
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o json | \
  jq -r '.items[] | "\(.metadata.name): CPU=\(.spec.containers[0].resources.requests.cpu) MEM=\(.spec.containers[0].resources.requests.memory)"'
```

**Enforcement**:
```yaml
# In Helm values
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi
```

---

### 8. Anti-Affinity Constraint

**Constraint**: Vessels should be spread across nodes (if multi-node cluster)

**Rationale**:
- Improves fault tolerance (node failure doesn't kill all vessels)
- Balances load (distribute resource usage)
- Reduces blast radius (network issues affect fewer vessels)
- Best practice for distributed systems

**Validation**:
```bash
# Check vessel distribution
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName --no-headers

# Count vessels per node
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o json | \
  jq -r '.items | group_by(.spec.nodeName) | .[] | "\(.[0].spec.nodeName): \(length) vessels"'
```

**Enforcement**:
```yaml
# In Helm values
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app.kubernetes.io/name
                operator: In
                values:
                  - devbob
          topologyKey: kubernetes.io/hostname
```

---

### 9. Health Probe Constraint

**Constraint**: Vessels must have liveness and readiness probes configured

**Rationale**:
- Enables automatic recovery (Kubernetes restarts unhealthy pods)
- Prevents traffic to unready vessels (readiness gates)
- Monitors vessel health (detect hangs, crashes)
- Required for production reliability

**Validation**:
```bash
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o json | \
  jq -r '.items[] | "\(.metadata.name): Liveness=\(.spec.containers[0].livenessProbe != null) Readiness=\(.spec.containers[0].readinessProbe != null)"'
```

**Enforcement**:
```yaml
# In Helm values
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 60
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

---

### 10. Dataflow Enforcement Constraint

**Constraint**: metabob-opencode → metabob-cli → metabob-rpc-api → SurrealDB (no shortcuts)

**Rationale**:
- Enforces MCP gateway pattern (loose coupling)
- Prevents direct DB access (exclusive gateway)
- Enables graceful degradation (offline mode)
- Architectural principle compliance

**Validation**:
```bash
# Check metabob-cli is configured in vessels
kubectl exec -n metabob deploy/devbob -- sh -c 'which metabob-cli || echo "metabob-cli not found"'

# Check metabob-rpc-api is accessible
kubectl exec -n metabob deploy/devbob -- curl -sf http://metabob-rpc-api:8080/health

# Check no direct SurrealDB access from OpenCode
# (This requires code inspection - no direct import of SurrealDB driver in opencode codebase)
```

**Enforcement**:
```bash
# Ensure metabob-cli is installed in DevBob image
# Ensure metabob-rpc-api is deployed
# Ensure SurrealDB is not exposed externally (only ClusterIP)
kubectl get svc/surrealdb -n metabob -o jsonpath='{.spec.type}'
# Expected: ClusterIP (not LoadBalancer or NodePort)
```

---

## Constraint Summary Table

| # | Constraint | Minimum | Validation | Auto-Enforceable |
|---|------------|---------|------------|------------------|
| 1 | Multi-Vessel | 3 vessels | Pod count | ✅ Yes (scale) |
| 2 | Coordination Layer | Redis + SurrealDB + API | Health checks | ✅ Yes (helmfile) |
| 3 | Workspace Isolation | 1 PVC per vessel | PVC count | ✅ Yes (Helm config) |
| 4 | ACP Communication | Port 3000 exposed | Service check | ✅ Yes (Helm config) |
| 5 | Vessel Registry | All vessels registered | SurrealDB query | ⚠️ Manual (SQL) |
| 6 | Backend Connectivity | All vessels → all services | Curl tests | ⚠️ Manual (network) |
| 7 | Resource Allocation | 500m CPU, 512Mi RAM | Resource requests | ✅ Yes (Helm config) |
| 8 | Anti-Affinity | Spread across nodes | Node distribution | ✅ Yes (Helm config) |
| 9 | Health Probes | Liveness + Readiness | Probe config | ✅ Yes (Helm config) |
| 10 | Dataflow Enforcement | MCP gateway only | Service topology | ⚠️ Manual (arch review) |

**Auto-Enforceable**: 7/10 (70%)  
**Validation Required**: 10/10 (100%)

---

## Enforcement Strategy

### Phase 1: Pre-Deployment Checks
- Verify Kubernetes cluster access
- Check namespace exists
- Validate Helm charts present
- Ensure .env file configured

### Phase 2: Automated Enforcement
- Deploy backend services (Redis, SurrealDB, metabob-rpc-api)
- Scale DevBob to minimum 3 replicas
- Apply resource requests/limits
- Configure anti-affinity rules
- Enable health probes
- Expose ACP endpoints

### Phase 3: Post-Deployment Validation
- Verify pod counts (3+ vessels)
- Test backend health (Redis, SurrealDB, API)
- Check PVC bindings (1 per vessel)
- Validate service endpoints (ACP on port 3000)
- Test backend connectivity (from each vessel)
- Verify resource allocations

### Phase 4: Manual Registration
- Initialize SurrealDB schema
- Register vessels in vessel_registry
- Verify dataflow architecture compliance

---

## Violation Handling

### Critical Violations (Block Deployment)
- ❌ Less than 3 vessels running
- ❌ Backend service missing (Redis, SurrealDB, or API)
- ❌ No PVCs bound

**Action**: Halt deployment, show error, provide fix commands

### Warning Violations (Allow with Notice)
- ⚠️ Health probes not configured
- ⚠️ Anti-affinity not set
- ⚠️ Resource limits missing

**Action**: Continue deployment, log warnings, recommend fixes

### Info Violations (Monitor Only)
- ℹ️ Vessel registry not populated
- ℹ️ No heartbeat in last 5 minutes
- ℹ️ Only 1 node available (can't spread vessels)

**Action**: Log info messages, no blocking

---

## Compliance Report Format

```json
{
  "timestamp": "2026-02-27T12:00:00Z",
  "namespace": "metabob",
  "status": "COMPLIANT" | "VIOLATIONS" | "WARNINGS",
  "constraints": [
    {
      "id": 1,
      "name": "Multi-Vessel Requirement",
      "status": "PASS" | "FAIL" | "WARN",
      "required": 3,
      "actual": 3,
      "details": "3 vessels running",
      "severity": "critical" | "warning" | "info"
    },
    ...
  ],
  "summary": {
    "total_constraints": 10,
    "passed": 8,
    "failed": 1,
    "warnings": 1
  },
  "violations": [
    {
      "constraint_id": 2,
      "severity": "critical",
      "message": "metabob-rpc-api not deployed",
      "fix": "cd helm && helmfile -f helmfile.yaml -e local --selector name=metabob-rpc-api sync"
    }
  ],
  "recommendations": [
    "Deploy metabob-rpc-api for full learning loop functionality",
    "Register vessels in SurrealDB vessel_registry table"
  ]
}
```

---

## Next Steps

1. **Create Enforcement Activity**: `enforce-deployment-constraints.json`
2. **Create Validation Activity**: `validate-deployment-constraints.json`
3. **Execute Enforcement**: Apply all auto-enforceable constraints
4. **Execute Validation**: Generate compliance report
5. **Remediate Violations**: Fix any critical issues
6. **Re-validate**: Confirm 100% compliance

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-27  
**Status**: ✅ Constraints defined, ready for enforcement
