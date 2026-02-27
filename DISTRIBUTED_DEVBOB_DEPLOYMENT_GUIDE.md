# Distributed DevBob Deployment Guide

**Date**: 2026-02-26  
**Purpose**: Deploy production-like Kubernetes environment with coordinated DevBob vessels  
**Principle**: **Work happens across the system, not in one instance**

---

## Quick Start

### Deploy 3-Vessel System (Default)

```bash
opencode activity execute deploy-distributed-devbob-k8s \
  --variables '{
    "kubeContext": "docker-desktop",
    "namespace": "metabob",
    "vesselCount": 3,
    "devbobImage": "devbob",
    "devbobTag": "local-fixed",
    "imagePullPolicy": "Never"
  }' \
  --reason "Deploy distributed DevBob system for coordinated development"
```

**What This Deploys:**
- ✅ Redis (boredom queue, session cache)
- ✅ SurrealDB (activity templates, execution history, vessel registry)
- ✅ metabob-rpc-api (Thompson Sampling, learning backend)
- ✅ 3x DevBob vessels (independent containers with ACP servers)
- ✅ Persistent storage (10Gi per vessel)
- ✅ Service mesh (ClusterIP for each vessel)

**Estimated Time:** 8-12 minutes  
**Estimated Cost:** $2-3 (depends on activity execution)

---

## Architecture

### The Distributed Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISTRIBUTED DEVBOB SYSTEM                    │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Vessel 1    │  │  Vessel 2    │  │  Vessel 3    │         │
│  │ (Backend)    │  │ (Frontend)   │  │ (Testing)    │         │
│  │              │  │              │  │              │         │
│  │ ACP: 3000    │  │ ACP: 3000    │  │ ACP: 3000    │         │
│  │ PVC: 10Gi    │  │ PVC: 10Gi    │  │ PVC: 10Gi    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                  │
│         └─────────────────┼─────────────────┘                  │
│                           │                                    │
│              ┌────────────▼────────────┐                       │
│              │   Coordination Layer    │                       │
│              ├─────────────────────────┤                       │
│              │ • SurrealDB (state)     │                       │
│              │ • Redis (queue)         │                       │
│              │ • metabob-rpc-api       │                       │
│              └─────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

### Why Multiple Vessels?

1. **Parallel Execution**: Multiple features developed simultaneously
2. **Specialization**: Vessels can focus on specific domains (backend, frontend, testing)
3. **Fault Isolation**: One vessel failure doesn't stop others
4. **Scalability**: Add more vessels as workload increases
5. **Learning Distribution**: Activities learn across the entire fleet

---

## Deployment Flow

### Task 1: Validate Prerequisites (2 min)
- Check kubectl, helm, helmfile installed
- Verify .env file with ANTHROPIC_API_KEY
- Confirm DevBob image available
- Load environment variables

### Task 2: Deploy Backend Stack (3-4 min)
- Deploy Redis (boredom activity queue)
- Deploy SurrealDB (activity state + vessel registry)
- Deploy metabob-rpc-api (learning backend)
- Wait for all services healthy

### Task 3: Deploy DevBob Vessels (3-4 min)
- Create multi-vessel Helm values
- Deploy N vessels (default: 3)
- Configure ACP endpoints
- Allocate persistent storage per vessel
- Wait for all pods ready

### Task 4: Validate System Coordination (2-3 min)
- Test backend connectivity (all vessels → all services)
- Validate ACP endpoints (port 3000 per vessel)
- Initialize SurrealDB schema
- Register vessels in vessel registry
- Create usage guide

### Task 5: Create Distributed Workflow Examples (1-2 min)
- Generate example scripts
- Document ACP delegation patterns
- Create monitoring configs
- Provide cleanup scripts

---

## Vessel Coordination Patterns

### Pattern 1: Parallel Execution

**Scenario:** Implement full-stack feature  
**Approach:** Delegate to specialized vessels simultaneously

```bash
# From host OpenCode or coordination script
kubectl exec -n metabob devbob-0-xxx -- opencode activity execute \
  --template add-feature-complete \
  --variables '{"featureName": "authentication-backend"}' &

kubectl exec -n metabob devbob-1-xxx -- opencode activity execute \
  --template add-feature-complete \
  --variables '{"featureName": "authentication-frontend"}' &

wait  # Wait for both to complete
```

**Benefits:**
- ⚡ 2x faster (parallel vs sequential)
- 🎯 Specialized focus per vessel
- 🔄 Independent progress tracking

### Pattern 2: Sequential Pipeline

**Scenario:** Design → Implement → Test workflow  
**Approach:** Chain vessels with impulse sharing

```bash
# Vessel 1: Design
kubectl exec -n metabob devbob-0-xxx -- opencode activity execute \
  --template design-api \
  --variables '{"apiName": "authentication"}' \
  --reason "API design phase"

# Vessel 2: Implement (uses design impulse from SurrealDB)
kubectl exec -n metabob devbob-1-xxx -- opencode activity execute \
  --template add-feature-complete \
  --variables '{"featureName": "authentication", "impulseId": "apiDesign"}' \
  --reason "Implementation phase"

# Vessel 3: Test
kubectl exec -n metabob devbob-2-xxx -- opencode activity execute \
  --template add-comprehensive-tests \
  --variables '{"featureName": "authentication"}' \
  --reason "Testing phase"
```

**Benefits:**
- 📋 Clear phase separation
- 🔗 Impulse-based context sharing
- ✅ Sequential validation

### Pattern 3: ACP Delegation (from Host)

**Scenario:** Host OpenCode delegates to K8s vessels  
**Approach:** Use ACP protocol via port-forward

```typescript
// In host OpenCode session

// Port-forward to vessels
// kubectl port-forward -n metabob svc/devbob-0 3001:3000 &
// kubectl port-forward -n metabob svc/devbob-1 3002:3000 &

const [backend, frontend] = await Promise.all([
  acp_delegate({
    target: "http://localhost:3001",
    taskDescription: "Implement backend",
    prompt: "Create authentication endpoints",
    shareImpulses: ["apiDesign"],
    timeout: 600
  }),
  
  acp_delegate({
    target: "http://localhost:3002",
    taskDescription: "Implement frontend",
    prompt: "Create login UI",
    shareImpulses: ["uiDesign"],
    timeout: 600
  })
]);

console.log("Both vessels completed!");
```

**Benefits:**
- 🌐 Remote execution from host
- 📤 Impulse sharing across network
- 🔀 Flexible task routing

---

## Vessel Discovery

### Query Available Vessels (SurrealDB)

```sql
-- From any vessel or via port-forward
SELECT 
  vessel_id, 
  pod_name, 
  acp_endpoint, 
  status,
  last_heartbeat
FROM vessel_registry 
WHERE status = 'running'
ORDER BY pod_name;
```

### Via Kubectl

```bash
# List all DevBob vessels
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob

# Get vessel details
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o json | \
  jq -r '.items[] | "Vessel: \(.metadata.name) | IP: \(.status.podIP) | Status: \(.status.phase)"'

# Check ACP endpoints
kubectl get svc -n metabob -l app.kubernetes.io/name=devbob
```

---

## Monitoring

### Check System Health

```bash
# All pods status
kubectl get pods -n metabob

# Vessel logs (check ACP initialization)
kubectl logs -n metabob -l app.kubernetes.io/name=devbob --tail=50

# Backend connectivity test
kubectl exec -n metabob deploy/devbob -- sh -c '
  echo "Testing backend..."
  redis-cli -h redis-master ping
  curl -sf http://surrealdb:8000/health
  curl -sf http://metabob-rpc-api:8080/health
'
```

### Query Activity Metrics

```sql
-- Recent activity executions
SELECT 
  vessel_id,
  template_id,
  success,
  duration,
  timestamp
FROM activity_executions
WHERE timestamp > time::now() - 1h
ORDER BY timestamp DESC;

-- Vessel performance comparison
SELECT 
  vessel_id,
  count() as total_activities,
  math::mean(duration) as avg_duration,
  sum(case when success = true then 1 else 0 end) as successes
FROM activity_executions
GROUP BY vessel_id;
```

---

## Configuration Options

### Variables Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `kubeContext` | string | **required** | Kubernetes context (e.g., docker-desktop) |
| `namespace` | string | `metabob` | K8s namespace for deployment |
| `vesselCount` | number | `3` | Number of DevBob vessels to deploy |
| `devbobImage` | string | `devbob` | Docker image repository |
| `devbobTag` | string | `local-fixed` | Docker image tag |
| `imagePullPolicy` | string | `Never` | Image pull policy (Never/Always/IfNotPresent) |
| `workspaceSize` | string | `10Gi` | Persistent storage size per vessel |
| `enableHealthProbes` | boolean | `false` | Enable HTTP health checks |

### Custom Deployment Examples

#### Deploy 5 vessels with GHCR image
```bash
opencode activity execute deploy-distributed-devbob-k8s \
  --variables '{
    "kubeContext": "docker-desktop",
    "vesselCount": 5,
    "devbobImage": "ghcr.io/avigopal/opencode/devbob",
    "devbobTag": "latest",
    "imagePullPolicy": "Always"
  }'
```

#### Deploy to remote cluster
```bash
# Switch context first
kubectx my-remote-cluster

opencode activity execute deploy-distributed-devbob-k8s \
  --variables '{
    "kubeContext": "my-remote-cluster",
    "namespace": "devbob-prod",
    "vesselCount": 10,
    "workspaceSize": "50Gi"
  }'
```

---

## Cleanup

### Remove Deployment

```bash
# Option 1: Using helmfile
cd helm
helmfile -f helmfile.yaml -e local destroy

# Option 2: Delete namespace (removes everything)
kubectl delete namespace metabob --wait=true

# Option 3: Use cleanup script (generated by activity)
bash examples/vessel-coordination/cleanup-deployment.sh
```

---

## Troubleshooting

### Issue: Vessels stuck in Pending

**Symptom:** Pods show `Pending` status

**Check:**
```bash
kubectl describe pod -n metabob <pod-name>
```

**Common causes:**
- Insufficient cluster resources (CPU/memory)
- PVC binding issues (check storage class)
- Image pull failures (if using remote registry)

**Fix:**
```bash
# Check node resources
kubectl top nodes

# Check PVC status
kubectl get pvc -n metabob

# Check events
kubectl get events -n metabob --sort-by='.lastTimestamp'
```

### Issue: Backend connectivity failures

**Symptom:** Vessels can't reach Redis/SurrealDB/API

**Check:**
```bash
# Test from vessel
kubectl exec -n metabob deploy/devbob -- sh -c '
  redis-cli -h redis-master.metabob.svc.cluster.local ping
  curl http://surrealdb.metabob.svc.cluster.local:8000/health
  curl http://metabob-rpc-api.metabob.svc.cluster.local:8080/health
'
```

**Fix:**
- Ensure backend services are running: `kubectl get pods -n metabob`
- Check service DNS: Services use `<name>.<namespace>.svc.cluster.local`
- Verify network policies (if any)

### Issue: ACP endpoints not responding

**Symptom:** Port-forward works but no response

**Check:**
```bash
# Check if ACP server started
kubectl logs -n metabob <vessel-pod> | grep -i acp

# Expected: "service=acp-command setup connection"
```

**Fix:**
- Verify ANTHROPIC_API_KEY is set (check secret)
- Check container logs for errors
- Restart pod: `kubectl rollout restart deployment/devbob -n metabob`

---

## Architecture Decisions

### Why SurrealDB for Coordination?

**Graph database** enables complex queries:
- Vessel-to-vessel relationships
- Activity dependency tracking
- Impulse provenance graphs
- Learning metric aggregation

### Why Multiple PVCs vs Shared Storage?

**Isolation benefits:**
- No workspace conflicts between vessels
- Independent git repositories per vessel
- Parallel file operations (no locking)
- Easier backup/restore per vessel

### Why ClusterIP vs LoadBalancer?

**Internal-only communication:**
- Vessels communicate via K8s service mesh
- No external exposure needed (security)
- Port-forward for development access
- Ingress for production dashboards

---

## Next Steps

### After Deployment

1. **Test vessel coordination** (generated examples)
   ```bash
   bash examples/vessel-coordination/implement-auth-system.sh
   ```

2. **Set up monitoring** (Grafana dashboard)
   ```bash
   kubectl apply -f examples/vessel-coordination/grafana-dashboard.json
   ```

3. **Integrate with CI/CD**
   - Use deployment activity in GitHub Actions
   - Deploy on every merge to main
   - Run distributed tests across vessels

4. **Scale vessel fleet**
   ```bash
   kubectl scale deployment/devbob -n metabob --replicas=10
   ```

---

## Files Generated by Activity

| File | Description |
|------|-------------|
| `distributed-devbob-validation.json` | Complete system validation report |
| `DISTRIBUTED_DEVBOB_USAGE_GUIDE.md` | Comprehensive usage documentation |
| `examples/vessel-coordination/implement-auth-system.sh` | Example distributed workflow |
| `examples/vessel-coordination/acp-delegation-example.md` | ACP delegation patterns |
| `examples/vessel-coordination/cleanup-deployment.sh` | Cleanup script |
| `helm/charts/devbob.multi-vessel.values.yaml` | Helm values for multi-vessel |
| `backend-stack-health.json` | Backend service health report |
| `devbob-vessels-inventory.json` | Vessel registry and endpoints |

---

## Key Benefits

### Distributed Development

✅ **Parallel execution**: Multiple features simultaneously  
✅ **Fault isolation**: One failure doesn't stop the system  
✅ **Specialization**: Vessels focus on specific domains  
✅ **Scalability**: Add vessels as workload grows

### Production Parity

✅ **Same stack as production**: Redis, SurrealDB, metabob-rpc-api  
✅ **Real coordination**: ACP protocol, shared state  
✅ **Persistent storage**: Each vessel has dedicated workspace  
✅ **Service mesh**: K8s native networking

### Learning System

✅ **Thompson Sampling**: Bayesian multi-armed bandit  
✅ **Improvement gradients**: Prioritize template improvements  
✅ **Boredom activities**: Autonomous self-improvement  
✅ **Vessel metrics**: Performance tracking per vessel

---

## Success Metrics

After deployment, you should see:

| Metric | Expected | Command |
|--------|----------|---------|
| **Vessels running** | {{vesselCount}} | `kubectl get pods -n metabob -l app.kubernetes.io/name=devbob` |
| **Backend healthy** | 3/3 | `kubectl get pods -n metabob -l 'app.kubernetes.io/name in (redis,surrealdb,metabob-rpc-api)'` |
| **PVCs bound** | {{vesselCount}} | `kubectl get pvc -n metabob` |
| **ACP endpoints** | {{vesselCount}} | `kubectl get svc -n metabob -l app.kubernetes.io/name=devbob` |
| **Vessels registered** | {{vesselCount}} | SurrealDB query: `SELECT count() FROM vessel_registry WHERE status='running'` |

---

## Additional Resources

- **Activity Template**: `templates/infrastructure/deploy-distributed-devbob-k8s.json`
- **Helm Charts**: `helm/charts/devbob/`, `helm/charts/surrealdb/`, `helm/charts/metabob-rpc-api/`
- **Helmfile**: `helm/helmfile.yaml`
- **Dataflow Documentation**: `DATAFLOW_AND_LEARNING_ARCHITECTURE.md`
- **Vessel Ontology**: `docs/architecture/ONTOLOGY_OF_BECOMING.md`

---

**Status**: 🚀 Ready for distributed development  
**Deployment Method**: Helm + Helmfile + Activity Template  
**Coordination**: ACP + SurrealDB + Redis  
**Principle**: Work happens across the system, not in one instance
