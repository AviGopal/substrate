# Distributed DevBob - Visual Summary

**Quick visual reference for distributed development architecture**

---

## The Distributed System

```
┌────────────────────────────────────────────────────────────────────┐
│                   YOUR LOCAL KUBERNETES CLUSTER                    │
│                        (docker-desktop)                            │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Namespace: metabob                                          │ │
│  │                                                              │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐│ │
│  │  │  DevBob Pod 0  │  │  DevBob Pod 1  │  │  DevBob Pod 2  ││ │
│  │  │  (Backend)     │  │  (Frontend)    │  │  (Testing)     ││ │
│  │  │                │  │                │  │                ││ │
│  │  │ Port: 3000     │  │ Port: 3000     │  │ Port: 3000     ││ │
│  │  │ PVC: 10Gi      │  │ PVC: 10Gi      │  │ PVC: 10Gi      ││ │
│  │  │ CPU: 500m-2000m│  │ CPU: 500m-2000m│  │ CPU: 500m-2000m││ │
│  │  │ Mem: 512Mi-2Gi │  │ Mem: 512Mi-2Gi │  │ Mem: 512Mi-2Gi ││ │
│  │  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘│ │
│  │           │                   │                   │         │ │
│  │           │  Kubernetes Service Mesh (ClusterIP) │         │ │
│  │           └───────────────────┼───────────────────┘         │ │
│  │                               │                             │ │
│  │              ┌────────────────▼──────────────────┐          │ │
│  │              │   COORDINATION LAYER               │          │ │
│  │              ├────────────────────────────────────┤          │ │
│  │              │                                    │          │ │
│  │              │  ┌──────────────────────────────┐ │          │ │
│  │              │  │ Redis (Master + Replica)     │ │          │ │
│  │              │  │ - Boredom activity queue     │ │          │ │
│  │              │  │ - Session cache              │ │          │ │
│  │              │  │ Port: 6379                   │ │          │ │
│  │              │  └──────────────────────────────┘ │          │ │
│  │              │                                    │          │ │
│  │              │  ┌──────────────────────────────┐ │          │ │
│  │              │  │ SurrealDB (StatefulSet)      │ │          │ │
│  │              │  │ - Activity templates         │ │          │ │
│  │              │  │ - Execution history          │ │          │ │
│  │              │  │ - Vessel registry            │ │          │ │
│  │              │  │ - Learning metrics           │ │          │ │
│  │              │  │ Port: 8000                   │ │          │ │
│  │              │  │ Storage: 5Gi                 │ │          │ │
│  │              │  └──────────────────────────────┘ │          │ │
│  │              │                                    │          │ │
│  │              │  ┌──────────────────────────────┐ │          │ │
│  │              │  │ metabob-rpc-api (FastAPI)    │ │          │ │
│  │              │  │ - Thompson Sampling          │ │          │ │
│  │              │  │ - Improvement gradients      │ │          │ │
│  │              │  │ - Boredom activity fetch     │ │          │ │
│  │              │  │ Port: 8080                   │ │          │ │
│  │              │  └──────────────────────────────┘ │          │ │
│  │              │                                    │          │ │
│  │              └────────────────────────────────────┘          │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Flow

```
┌─────────────┐
│   START     │  opencode activity execute deploy-distributed-devbob-k8s
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ TASK 1: Validate Prerequisites (2 min)                      │
│                                                             │
│ ✓ Check kubectl, helm, helmfile                            │
│ ✓ Verify .env with ANTHROPIC_API_KEY                       │
│ ✓ Confirm DevBob image: devbob:local-fixed                 │
│ ✓ Load environment variables                               │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ TASK 2: Deploy Backend Stack (3-4 min)                     │
│                                                             │
│ helmfile sync:                                              │
│   1. Redis (master + replica)    → RUNNING                 │
│   2. SurrealDB (statefulset)     → RUNNING                 │
│   3. metabob-rpc-api (deployment) → RUNNING                 │
│                                                             │
│ Health checks:                                              │
│   - Redis: PING → PONG ✓                                   │
│   - SurrealDB: /health → 200 ✓                             │
│   - API: /health → 200 ✓                                   │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ TASK 3: Deploy DevBob Vessels (3-4 min)                    │
│                                                             │
│ Create: devbob.multi-vessel.values.yaml                    │
│   - replicaCount: 3                                         │
│   - image: devbob:local-fixed                               │
│   - persistence: 10Gi per vessel                            │
│                                                             │
│ helmfile sync:                                              │
│   - devbob-0 → RUNNING (PVC: devbob-pvc-0)                 │
│   - devbob-1 → RUNNING (PVC: devbob-pvc-1)                 │
│   - devbob-2 → RUNNING (PVC: devbob-pvc-2)                 │
│                                                             │
│ Verify:                                                     │
│   - All ACP servers listening on port 3000 ✓               │
│   - Backend connectivity (all vessels) ✓                   │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ TASK 4: Validate System Coordination (2-3 min)             │
│                                                             │
│ Initialize SurrealDB schema:                                │
│   CREATE TABLE vessel_registry                             │
│   CREATE TABLE activity_templates                          │
│   CREATE TABLE activity_executions                         │
│                                                             │
│ Register vessels:                                           │
│   INSERT INTO vessel_registry (devbob-0, IP, endpoint)     │
│   INSERT INTO vessel_registry (devbob-1, IP, endpoint)     │
│   INSERT INTO vessel_registry (devbob-2, IP, endpoint)     │
│                                                             │
│ Create validation report:                                   │
│   - distributed-devbob-validation.json ✓                   │
│   - DISTRIBUTED_DEVBOB_USAGE_GUIDE.md ✓                    │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ TASK 5: Create Workflow Examples (1-2 min)                 │
│                                                             │
│ Generate examples/vessel-coordination/:                     │
│   - implement-auth-system.sh ✓                             │
│   - acp-delegation-example.md ✓                            │
│   - cleanup-deployment.sh ✓                                │
│   - README.md ✓                                            │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   DONE ✅   │  Distributed system ready for development
└─────────────┘
```

---

## Vessel Coordination Patterns

### Pattern 1: Parallel Execution

```
    Task: "Implement authentication system"
         ↓
    ┌────┴────┐
    │ Delegate │ (split into 3 parallel tasks)
    └─┬───┬───┬┘
      │   │   │
      ▼   ▼   ▼
   ┌────┐┌────┐┌────┐
   │ V1 ││ V2 ││ V3 │  V1 = Backend, V2 = Frontend, V3 = Tests
   └────┘└────┘└────┘
      │   │   │
      │   │   │  All execute simultaneously
      ▼   ▼   ▼
   ┌────────────┐
   │   Merge    │  Results combined in SurrealDB
   └────────────┘
         ↓
    Feature Complete
    (3x faster than sequential)
```

### Pattern 2: Sequential Pipeline

```
    Task: "Design → Implement → Test"
         ↓
    ┌─────────┐
    │ Vessel 1│  Design API + Schema
    │ (Design)│  Creates impulse: "apiDesign"
    └────┬────┘
         │
         │  impulse shared via SurrealDB
         ▼
    ┌─────────┐
    │ Vessel 2│  Implement from design
    │  (Impl) │  Loads impulse: "apiDesign"
    └────┬────┘
         │
         │  implementation artifacts
         ▼
    ┌─────────┐
    │ Vessel 3│  Test implementation
    │ (Test)  │  Validates against design
    └────┬────┘
         ▼
    Complete Pipeline
    (clear phase separation)
```

### Pattern 3: ACP Delegation from Host

```
┌────────────────┐
│ Host OpenCode  │  (your laptop)
│ Session        │
└────────┬───────┘
         │
         │  Port-forward to K8s vessels
         │
    ┌────┴───────────────┐
    │                    │
    ▼                    ▼
┌─────────┐          ┌─────────┐
│ Vessel 1│          │ Vessel 2│  (in Kubernetes)
│ (K8s)   │          │ (K8s)   │
└─────────┘          └─────────┘
    │                    │
    │  Execute tasks     │
    │  Return results    │
    │                    │
    ▼                    ▼
┌────────────────────────────┐
│  Host integrates results   │
│  (artifacts merged)        │
└────────────────────────────┘
```

---

## Vessel Discovery

### Dynamic Discovery (SurrealDB Query)

```sql
-- Find available vessels
SELECT 
  vessel_id,
  pod_name,
  acp_endpoint,
  status,
  last_heartbeat
FROM vessel_registry
WHERE status = 'running'
  AND last_heartbeat > time::now() - 5m
ORDER BY pod_name;
```

**Returns:**
```json
[
  {
    "vessel_id": "abc123-def456",
    "pod_name": "devbob-0-xyz",
    "acp_endpoint": "http://10.1.2.3:3000",
    "status": "running",
    "last_heartbeat": "2026-02-26T10:30:00Z"
  },
  {
    "vessel_id": "def456-ghi789",
    "pod_name": "devbob-1-xyz",
    "acp_endpoint": "http://10.1.2.4:3000",
    "status": "running",
    "last_heartbeat": "2026-02-26T10:30:02Z"
  },
  ...
]
```

### Static Discovery (kubectl)

```bash
# Get all vessels
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob

# Get with IPs
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob \
  -o custom-columns=NAME:.metadata.name,IP:.status.podIP,STATUS:.status.phase
```

---

## Data Flow

### Activity Execution Flow

```
┌──────────────┐
│ User/Boredom │ Triggers activity
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Vessel 1     │ Executes activity
│ (DevBob Pod) │ Measures: success, duration, cost, tokens
└──────┬───────┘
       │
       │  MCP call: metabob_post_activity_result
       ▼
┌──────────────┐
│ metabob-cli  │ (inside vessel container)
│ (MCP Server) │ Proxies to backend
└──────┬───────┘
       │
       │  HTTP POST /api/v1/activity-execution/results
       ▼
┌───────────────┐
│metabob-rpc-api│ Thompson Sampling update
│  (Backend)    │ Calculate improvement gradient
└──────┬────────┘
       │
       │  SurrealDB driver
       ▼
┌──────────────┐
│  SurrealDB   │ Update:
│  (Database)  │ - learning.success_rate
│              │ - learning.execution_count
│              │ - improvement_gradient
└──────┬───────┘
       │
       │  Query from any vessel
       ▼
┌──────────────┐
│ Vessel 2/3   │ Fetch boredom activities
│ (Idle)       │ GET /api/v1/learning-loop/boredom-activities
└──────────────┘
```

### Boredom Activity Flow

```
┌──────────┐
│ Vessel 1 │ Idle for 5+ minutes
└────┬─────┘
     │
     │  MCP: metabob_fetch_boredom_activities
     ▼
┌────────────┐
│metabob-rpc │ Query SurrealDB:
│   -api     │ - success_rate < 0.95
│            │ - execution_count > 5
│            │ - improvement_gradient DESC
└────┬───────┘
     │
     │  Returns top 5 activities
     ▼
┌──────────┐
│ Vessel 1 │ Auto-execute highest priority
└────┬─────┘ (initiatedBy: 'boredom-auto')
     │
     │  Execute activity template
     ▼
┌──────────┐
│ Improve  │ Fix failing template
│ Template │ Update documentation
└────┬─────┘ Optimize performance
     │
     │  Record results
     ▼
┌──────────┐
│SurrealDB │ Metrics updated
└──────────┘ Gradient recalculated
     │       Priority lowered (improved!)
     │
     └───► Loop continues
```

---

## Resource Allocation

### Per-Vessel Resources

```
┌─────────────────────────────────────────────────────┐
│             DevBob Vessel Resource Profile          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  CPU:                                               │
│    Requests: 500m   (0.5 cores minimum)            │
│    Limits:   2000m  (2 cores maximum)              │
│                                                     │
│  Memory:                                            │
│    Requests: 512Mi  (minimum allocation)           │
│    Limits:   2Gi    (prevent OOM)                  │
│                                                     │
│  Storage:                                           │
│    PVC: 10Gi        (workspace persistence)        │
│    Type: ReadWriteOnce                             │
│    Class: default   (local-path on docker-desktop) │
│                                                     │
│  Network:                                           │
│    ACP Port:    3000 (ClusterIP service)           │
│    Data Bridge: 8083 (dashboard connection)        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Total System Resources (3 vessels)

```
Component       CPU Req    CPU Lim    Mem Req    Mem Lim    Storage
─────────────────────────────────────────────────────────────────────
Redis           100m       250m       256Mi      512Mi      -
SurrealDB       200m       1000m      512Mi      1Gi        5Gi
metabob-rpc-api 200m       1000m      512Mi      1Gi        -
DevBob Vessel 1 500m       2000m      512Mi      2Gi        10Gi
DevBob Vessel 2 500m       2000m      512Mi      2Gi        10Gi
DevBob Vessel 3 500m       2000m      512Mi      2Gi        10Gi
─────────────────────────────────────────────────────────────────────
TOTALS          2000m      8250m      2816Mi     9.5Gi      35Gi
                (2 cores)  (8.25)     (2.75Gi)   (9.5Gi)
```

**Minimum Node Requirements (docker-desktop):**
- CPU: 4 cores (recommended: 8+)
- Memory: 8Gi (recommended: 16Gi+)
- Disk: 40Gi available

---

## Monitoring Queries

### Vessel Health Check

```bash
#!/bin/bash
# Quick health check for all vessels

echo "=== VESSEL HEALTH CHECK ==="

# Pod status
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob

# Backend connectivity
for pod in $(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o name); do
  echo ""
  echo "Testing: $pod"
  kubectl exec -n metabob $pod -- sh -c '
    echo -n "Redis: "
    redis-cli -h redis-master ping 2>/dev/null || echo "FAIL"
    
    echo -n "SurrealDB: "
    curl -sf http://surrealdb:8000/health >/dev/null && echo "OK" || echo "FAIL"
    
    echo -n "RPC API: "
    curl -sf http://metabob-rpc-api:8080/health >/dev/null && echo "OK" || echo "FAIL"
  '
done
```

### Activity Metrics Dashboard (SQL)

```sql
-- Last hour activity summary
SELECT 
  COUNT(*) as total_executions,
  SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successes,
  SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failures,
  ROUND(AVG(duration) / 1000, 2) as avg_duration_sec,
  ROUND(SUM(cost), 4) as total_cost_usd,
  COUNT(DISTINCT vessel_id) as active_vessels
FROM activity_executions
WHERE timestamp > time::now() - 1h;

-- Per-vessel breakdown
SELECT 
  vessel_id,
  COUNT(*) as executions,
  ROUND(AVG(duration) / 1000, 2) as avg_duration_sec,
  ROUND(SUM(cost), 4) as cost_usd
FROM activity_executions
WHERE timestamp > time::now() - 1h
GROUP BY vessel_id
ORDER BY executions DESC;
```

---

## Quick Commands Reference

```bash
# Deploy
opencode activity execute deploy-distributed-devbob-k8s \
  --variables '{"kubeContext": "docker-desktop", "vesselCount": 3}'

# Check status
kubectl get pods -n metabob

# Get vessel logs
kubectl logs -n metabob -l app.kubernetes.io/name=devbob --tail=100

# Port-forward to vessel
kubectl port-forward -n metabob svc/devbob-0 3001:3000 &

# Port-forward to SurrealDB
kubectl port-forward -n metabob svc/surrealdb 8000:8000 &

# Execute on vessel
kubectl exec -n metabob devbob-0-xxx -- opencode activity execute <template>

# Cleanup
kubectl delete namespace metabob
```

---

## Success Checklist

After deployment, verify:

- ✅ **Backend running**: Redis, SurrealDB, metabob-rpc-api (3/3 pods)
- ✅ **Vessels running**: N pods with status Running (e.g., 3/3)
- ✅ **PVCs bound**: N+1 PVCs (N vessels + 1 SurrealDB)
- ✅ **ACP endpoints**: All vessels listening on port 3000
- ✅ **Backend connectivity**: All vessels can reach all backend services
- ✅ **Vessel registry**: All vessels registered in SurrealDB
- ✅ **SurrealDB schema**: Tables created (vessel_registry, activity_templates, etc.)
- ✅ **Example files**: Generated in examples/vessel-coordination/
- ✅ **Usage guide**: DISTRIBUTED_DEVBOB_USAGE_GUIDE.md exists

---

**Status**: Ready for distributed development 🚀  
**Execution**: `opencode activity execute deploy-distributed-devbob-k8s`  
**Duration**: ~10 minutes  
**Cost**: ~$2-3
