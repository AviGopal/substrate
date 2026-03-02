# Multi-Vessel DevBob Architecture

**Goal:** Organize work across multiple DevBob containers to improve speed through parallelization

**Date:** March 2, 2026  
**Status:** Planning → Implementation

---

## Architecture Overview

### Current State (Single Vessel)
```
┌─────────────────────────────────────┐
│  DevBob Pod (devbob-96ddd7d87-hdwv8) │
│  ├─ ACP Server (port 8080)          │
│  ├─ Git/GitHub CLI                  │
│  ├─ Bun runtime                     │
│  └─ Workspace (/workspace)          │
└─────────────────────────────────────┘
         ↓
    GitHub API
```

**Limitation:** Single-threaded execution, one task at a time

### Target State (Multi-Vessel Fleet)
```
                    ┌─────────────────────┐
                    │  Coordinator Agent  │
                    │  (Local or Pod 0)   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼───────┐  ┌────▼─────┐  ┌──────▼──────┐
    │ DevBob Vessel 1 │  │ Vessel 2 │  │  Vessel 3   │
    │ (Feature Dev)   │  │ (Testing)│  │ (Docs/PRs)  │
    ├─────────────────┤  ├──────────┤  ├─────────────┤
    │ ACP Server      │  │ ACP Srv  │  │  ACP Srv    │
    │ Port 8080       │  │ Port 8080│  │  Port 8080  │
    └─────────────────┘  └──────────┘  └─────────────┘
         │                    │              │
         └────────────────────┴──────────────┘
                        │
                   GitHub API
```

**Benefits:**
- Parallel task execution (3x speed improvement)
- Specialized vessel roles
- Load distribution
- Fault tolerance

---

## Vessel Roles & Specialization

### Vessel 1: Feature Development
**Primary Role:** Code implementation and feature development
- Clone repositories
- Implement features
- Make code changes
- Create feature branches

**Workload:** 40% of tasks
**Priority:** High-complexity tasks

### Vessel 2: Testing & Quality
**Primary Role:** Test execution and quality validation
- Run test suites
- Execute Metabob scans
- Validate code quality
- Check pre-commit hooks

**Workload:** 30% of tasks
**Priority:** Validation tasks

### Vessel 3: Documentation & PRs
**Primary Role:** Documentation and PR management
- Author documentation
- Update changelogs
- Create PRs
- Review status updates

**Workload:** 30% of tasks
**Priority:** Communication tasks

---

## Communication Architecture

### ACP (Agent Client Protocol)

Each vessel runs an ACP server accessible via:
```
Vessel 1: devbob-96ddd7d87-xxxxx:8080
Vessel 2: devbob-96ddd7d87-yyyyy:8080
Vessel 3: devbob-96ddd7d87-zzzzz:8080

Service: devbob.metabob.svc.cluster.local:8080
```

### Coordination Patterns

#### Pattern 1: Parallel Independent Tasks
```
Coordinator
  ├─→ Vessel 1: Implement feature X
  ├─→ Vessel 2: Run tests for feature Y
  └─→ Vessel 3: Update docs for feature Z

All execute simultaneously, no dependencies
```

#### Pattern 2: Sequential Pipeline
```
Vessel 1: Implement feature
    ↓
Vessel 2: Run tests
    ↓
Vessel 3: Create PR

Each waits for previous vessel to complete
```

#### Pattern 3: Fan-out / Fan-in
```
Coordinator splits task
  ├─→ Vessel 1: Part A
  ├─→ Vessel 2: Part B
  └─→ Vessel 3: Part C
       ↓
Coordinator merges results
```

---

## Scaling Strategy

### Phase 1: Scale to 3 Replicas (Immediate)
```bash
kubectl scale deployment devbob -n metabob --replicas=3
```

**Expected:**
- 3 pods running in ~30 seconds
- Each with unique pod name
- All share same service endpoint
- All have GITHUB_TOKEN configured

### Phase 2: Test ACP Connectivity (Validation)
```bash
# Test each pod's ACP server
kubectl exec -n metabob devbob-pod-1 -- curl http://localhost:8080/health
kubectl exec -n metabob devbob-pod-2 -- curl http://localhost:8080/health
kubectl exec -n metabob devbob-pod-3 -- curl http://localhost:8080/health

# Test cross-pod communication
kubectl exec -n metabob devbob-pod-1 -- curl http://devbob-pod-2:8080/health
```

### Phase 3: Implement Task Distribution (Activity)
- Create "multi-vessel-coordinator" activity template
- Implement task splitting logic
- Test parallel execution
- Measure performance improvements

---

## Use Cases & Examples

### Use Case 1: Parallel Feature Development
**Scenario:** Implement 3 independent features simultaneously

**Coordinator Task:**
```javascript
const tasks = [
  { vessel: 1, task: "Implement user authentication" },
  { vessel: 2, task: "Implement data export" },
  { vessel: 3, task: "Implement notification system" }
];

// Execute in parallel via acp_delegate
const results = await Promise.all(
  tasks.map(t => acp_delegate({
    target: `k8s://metabob/devbob-pod-${t.vessel}:8080`,
    taskDescription: t.task,
    prompt: `Implement feature: ${t.task}`
  }))
);
```

**Expected Speed:** 3x faster than sequential (10 min → 3.5 min)

### Use Case 2: Test-Driven Development Pipeline
**Scenario:** Feature → Test → PR workflow

**Sequential Execution:**
```javascript
// Vessel 1: Implement feature (10 min)
await acp_delegate({
  target: "k8s://metabob/devbob-pod-1:8080",
  taskDescription: "Implement feature",
  prompt: "Implement user authentication feature"
});

// Vessel 2: Run tests (5 min)
await acp_delegate({
  target: "k8s://metabob/devbob-pod-2:8080",
  taskDescription: "Run tests",
  prompt: "Run full test suite and report results"
});

// Vessel 3: Create PR (2 min)
await acp_delegate({
  target: "k8s://metabob/devbob-pod-3:8080",
  taskDescription: "Create PR",
  prompt: "Create PR with test results"
});
```

**Total Time:** 17 minutes (sequential)

### Use Case 3: Repository Analysis
**Scenario:** Analyze multiple repositories simultaneously

**Parallel Execution:**
```javascript
const repos = [
  "metabob-devbob",
  "opencode",
  "metabob-rpc-api"
];

const analyses = await Promise.all(
  repos.map((repo, i) => acp_delegate({
    target: `k8s://metabob/devbob-pod-${i+1}:8080`,
    taskDescription: `Analyze ${repo}`,
    prompt: `Clone and analyze repository: ${repo}`
  }))
);
```

**Expected Speed:** 3x faster (30 min → 10 min)

---

## Performance Expectations

### Single Vessel Baseline
- Feature implementation: 10 minutes
- Test execution: 5 minutes
- PR creation: 2 minutes
- **Total:** 17 minutes (sequential)

### Multi-Vessel (3 pods)
**Parallel Independent:**
- 3 features simultaneously: ~10 minutes (vs 30 min)
- **Speedup:** 3x

**Pipeline with Parallelization:**
- Feature + Docs (parallel): 10 minutes
- Tests: 5 minutes
- PR: 2 minutes
- **Total:** 17 minutes → ~12 minutes
- **Speedup:** 1.4x (with smart scheduling)

### Multi-Vessel (5 pods)
**Parallel Independent:**
- 5 features simultaneously: ~10 minutes (vs 50 min)
- **Speedup:** 5x

---

## Resource Requirements

### Per Vessel
- CPU: 500m (0.5 cores)
- Memory: 1Gi
- Storage: 5Gi (shared workspace)

### Total (3 vessels)
- CPU: 1.5 cores
- Memory: 3Gi
- Storage: 15Gi

### Total (5 vessels)
- CPU: 2.5 cores
- Memory: 5Gi
- Storage: 25Gi

**Note:** Check cluster capacity before scaling

---

## Implementation Plan

### Step 1: Scale Deployment ✅ (Next)
```bash
kubectl scale deployment devbob -n metabob --replicas=3
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -w
```

### Step 2: Verify Pod Health
```bash
# Wait for all pods to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=devbob -n metabob --timeout=60s

# Check ACP servers
for pod in $(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o name); do
  echo "Testing $pod"
  kubectl exec -n metabob $pod -- curl -s http://localhost:8080/health
done
```

### Step 3: Test Cross-Pod Communication
```bash
# Get pod IPs
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o wide

# Test pod-to-pod connectivity
POD1=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}')
POD2=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o jsonpath='{.items[1].metadata.name}')

kubectl exec -n metabob $POD1 -- curl -s http://$POD2:8080/health
```

### Step 4: Implement Coordinator Activity
Create activity template: `multi-vessel-task-coordinator`
- Task splitting logic
- Vessel selection algorithm
- Result aggregation
- Error handling

### Step 5: Execute Parallel Workload
Test with 3 parallel tasks:
- Task 1: Clone and analyze repo A
- Task 2: Clone and analyze repo B
- Task 3: Clone and analyze repo C

Measure execution time vs single vessel

### Step 6: Optimize & Scale
- Tune resource limits
- Implement smart scheduling
- Add monitoring
- Scale to 5 vessels if beneficial

---

## Monitoring & Observability

### Pod Status
```bash
watch kubectl get pods -n metabob -l app.kubernetes.io/name=devbob
```

### Resource Usage
```bash
kubectl top pods -n metabob -l app.kubernetes.io/name=devbob
```

### ACP Server Logs
```bash
kubectl logs -n metabob -l app.kubernetes.io/name=devbob --all-containers --tail=50 -f
```

### Service Endpoints
```bash
kubectl get endpoints -n metabob devbob
```

---

## Failure Handling

### Pod Failure
- **Detection:** Kubernetes readiness/liveness probes
- **Action:** Automatic pod restart
- **Impact:** Coordinator retries failed task on different vessel

### Network Partition
- **Detection:** ACP connection timeout
- **Action:** Retry with exponential backoff
- **Fallback:** Execute locally if all vessels unreachable

### Resource Exhaustion
- **Detection:** OOM kills, CPU throttling
- **Action:** Scale down replicas temporarily
- **Prevention:** Set resource limits appropriately

---

## Success Metrics

### Performance
- **Target:** 2-3x speedup for parallel workloads
- **Measure:** Task completion time (single vs multi)

### Reliability
- **Target:** 99% task success rate
- **Measure:** Failed tasks / Total tasks

### Resource Efficiency
- **Target:** <80% CPU/Memory utilization per pod
- **Measure:** `kubectl top pods`

### Coordination
- **Target:** <1s overhead per vessel delegation
- **Measure:** Time to delegate vs execute locally

---

## Next Steps

1. **Scale to 3 replicas** (immediate)
2. **Verify health and connectivity** (5 min)
3. **Test parallel task execution** (10 min)
4. **Create coordinator activity template** (30 min)
5. **Execute real workload** (test speedup)
6. **Document results and optimize** (20 min)

---

**Status:** Ready to implement  
**Expected Time:** 1-2 hours  
**Expected Speedup:** 2-3x for parallel tasks
