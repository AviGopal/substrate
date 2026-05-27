# MiniBob-Driven Pull Deployment Architecture

**Status**: Proposal
**Author**: Claude + Avi
**Date**: 2026-04-10
**Purpose**: Transition from push-based CI/CD to pull-based GitOps with MiniBob as orchestrator

---

## Problem Statement

**Current Push Model Limitations:**

1. **Tight Coupling**: GitHub Actions directly pushes to cluster (brittle, single point of failure)
2. **No Experimentation**: One vessel variant deployed at a time (no A/B testing)
3. **Manual Rollback**: Human intervention required for failures
4. **Slow Feedback**: 16+ minute deploy cycles, no progressive delivery
5. **No Learning**: Deployments don't feed back into activity system
6. **Fixed Traffic Split**: Canary stuck at 10% (no dynamic adjustment)

**Desired Pull Model Benefits:**

1. **Decoupled**: Git is source of truth, cluster pulls desired state
2. **Multi-Vessel**: Run multiple variants simultaneously with traffic splitting
3. **Autonomous**: MiniBob orchestrates rollouts, rollbacks, promotions
4. **Fast Feedback**: Progressive delivery with automatic promotion/demotion
5. **Learning Loop**: Deployment outcomes feed Thompson Sampling
6. **Dynamic Traffic**: Traffic adjusted based on metrics (success rate, latency, cost)

---

## Architecture: MiniBob as GitOps Operator

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Git Repository (Source of Truth)                                │
│ ├── vessels/                                                    │
│ │   ├── metabob-activity-api/                                  │
│ │   │   ├── variant-1/ (Dockerfile, src/)                      │
│ │   │   ├── variant-2/ (different algorithm)                   │
│ │   │   └── variant-3/ (experimental features)                 │
│ │   └── minibob/                                               │
│ │       ├── variant-1/ (baseline)                              │
│ │       └── variant-2/ (with new tools)                        │
│ └── manifests/                                                  │
│     ├── desired-state.yaml (vessel fleet config)               │
│     └── traffic-policy.yaml (routing rules)                    │
└─────────────────────────────────────────────────────────────────┘
                            ▼ (MiniBob watches)
┌─────────────────────────────────────────────────────────────────┐
│ MiniBob Operator (Deployment in Kubernetes)                     │
│ ├── Watcher: Detects git changes via polling or webhook        │
│ ├── Builder: Triggers image builds for new/changed variants    │
│ ├── Deployer: Creates/updates Kubernetes deployments           │
│ ├── Traffic Manager: Adjusts Istio VirtualService weights      │
│ ├── Health Monitor: Collects metrics from Prometheus/SurrealDB │
│ └── Decision Engine: Thompson Sampling for traffic allocation  │
└─────────────────────────────────────────────────────────────────┘
                            ▼ (reconciles state)
┌─────────────────────────────────────────────────────────────────┐
│ Kubernetes Cluster                                               │
│ ├── activity-api-v1 (20% traffic) ─┐                           │
│ ├── activity-api-v2 (60% traffic)  ├─► VirtualService (Istio) │
│ ├── activity-api-v3 (20% traffic) ─┘                           │
│ ├── minibob-v1 (50% traffic) ─┬─► VirtualService               │
│ └── minibob-v2 (50% traffic) ─┘                                │
│                                                                  │
│ Stable Services (Single Instance):                              │
│ ├── surrealdb (single endpoint, stable schema)                 │
│ ├── redis (caching layer)                                       │
│ └── istio-ingressgateway (unified entry point)                 │
└─────────────────────────────────────────────────────────────────┘
                            ▼ (metrics flow back)
┌─────────────────────────────────────────────────────────────────┐
│ Learning Loop (SurrealDB)                                        │
│ ├── Execution traces: success_rate, duration, cost per variant │
│ ├── Thompson Sampling: α (successes), β (failures) per variant │
│ └── Feedback to MiniBob: Adjust traffic, promote/demote        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Design

### 1. MiniBob Operator

**Deployment Model**: MiniBob itself runs as a Kubernetes deployment with leader election.

**Core Activities**:

1. **watch-git-state** (waking activity, scheduled: every 60s)
   - Polls git repository for `desired-state.yaml` changes
   - Detects new vessel variants or configuration changes
   - Creates impulses for changed files (gitDiff pointers)

2. **reconcile-deployments** (triggered by watch-git-state)
   - Compares desired state (git) vs actual state (k8s)
   - Builds new images for changed variants (via kaniko or buildah)
   - Creates/updates Kubernetes Deployments + Services
   - Tags images with variant ID for tracking

3. **optimize-traffic-split** (waking activity, scheduled: every 5 minutes)
   - Queries SurrealDB for variant metrics (success rate, latency, cost)
   - Runs Thompson Sampling to compute optimal traffic allocation
   - Updates Istio VirtualService weights
   - Records decision rationale as execution trace

4. **auto-promote-variants** (waking activity, scheduled: every 15 minutes)
   - Identifies high-performing variants (success_rate > 90%, N > 100)
   - Gradually increases traffic (10% → 20% → 50% → 100%)
   - Deprecates low-performing variants (success_rate < 50%, N > 50)
   - Updates git `desired-state.yaml` via commit

5. **emergency-rollback** (waking activity, triggered: on health check failure)
   - Detects variant with error spike (5+ consecutive failures)
   - Immediately sets traffic to 0% for failing variant
   - Redistributes traffic to healthy variants
   - Notifies Slack/alerts

**Implementation**:

```typescript
// repos/minibob/src/operator/index.ts
export class MiniBobOperator {
  private watcherActivity: Activity = "watch-git-state"
  private reconcileActivity: Activity = "reconcile-deployments"
  private trafficActivity: Activity = "optimize-traffic-split"
  private promoteActivity: Activity = "auto-promote-variants"
  private rollbackActivity: Activity = "emergency-rollback"

  async start() {
    // Register waking activities
    await this.registerWakingActivities()

    // Start event loop
    while (true) {
      await this.executeScheduledActivities()
      await sleep(10000) // 10s loop
    }
  }

  async executeScheduledActivities() {
    // Check if any waking activities are due
    const dueActivities = await this.getDueActivities()

    for (const activity of dueActivities) {
      await this.executeActivity(activity)
    }
  }
}
```

### 2. Desired State Configuration

**File**: `repos/deployment/manifests/desired-state.yaml`

```yaml
apiVersion: minibob.metabob.com/v1
kind: VesselFleet
metadata:
  name: production-fleet
spec:
  vessels:
    - name: metabob-activity-api
      variants:
        - id: baseline-v1
          source: vessels/metabob-activity-api/
          dockerfile: Dockerfile
          traffic:
            initial: 50%  # Starting traffic allocation
            min: 10%      # Minimum traffic (for continuous testing)
            max: 100%     # Maximum traffic
          resources:
            cpu: 1000m
            memory: 2Gi
          healthCheck:
            path: /health
            interval: 10s
            successThreshold: 90%  # Required success rate

        - id: optimized-thompson-v2
          source: vessels/metabob-activity-api/
          dockerfile: Dockerfile
          buildArgs:
            - OPTIMIZATION_LEVEL=3
          traffic:
            initial: 30%
            min: 5%
            max: 100%
          resources:
            cpu: 1000m
            memory: 2Gi
          healthCheck:
            path: /health
            interval: 10s
            successThreshold: 90%

        - id: experimental-cache-v3
          source: vessels/metabob-activity-api/
          dockerfile: Dockerfile.experimental
          traffic:
            initial: 20%
            min: 5%
            max: 50%  # Cap experimental variants
          resources:
            cpu: 1000m
            memory: 2Gi
          healthCheck:
            path: /health
            interval: 10s
            successThreshold: 85%  # Lower bar for experiments

    - name: minibob
      variants:
        - id: stable-v1
          source: vessels/minibob/
          dockerfile: Dockerfile
          replicas: 3
          traffic:
            initial: 70%
            min: 30%
            max: 100%

        - id: with-new-tools-v2
          source: vessels/minibob/
          dockerfile: Dockerfile
          buildArgs:
            - ENABLE_EXPERIMENTAL_TOOLS=true
          replicas: 3
          traffic:
            initial: 30%
            min: 10%
            max: 70%

  trafficPolicy:
    algorithm: thompson_sampling  # thompson_sampling | round_robin | weighted
    optimizationGoal: success_rate  # success_rate | latency | cost | balanced
    updateInterval: 5m
    minSampleSize: 20  # Minimum executions before traffic adjustment

  promotionPolicy:
    autoPromote: true
    criteria:
      successRate: 0.90
      minExecutions: 100
      maxLatencyP95: 500ms
    graduaIncrease: [10%, 20%, 50%, 100%]  # Progressive rollout

  rollbackPolicy:
    autoRollback: true
    triggers:
      - errorRate > 0.10 (over 5 minutes)
      - p95Latency > 2000ms (over 5 minutes)
      - healthCheckFailures > 3 (consecutive)
```

### 3. Traffic Management

**Istio VirtualService** (generated by MiniBob):

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: activity-api
  namespace: activity-system
spec:
  hosts:
    - activity.metabob.com
  http:
    - match:
        - headers:
            x-variant-override:
              exact: baseline-v1
      route:
        - destination:
            host: activity-api-baseline-v1
          weight: 100

    - route:
        - destination:
            host: activity-api-baseline-v1
          weight: 50  # Updated by MiniBob every 5 minutes
        - destination:
            host: activity-api-optimized-thompson-v2
          weight: 30
        - destination:
            host: activity-api-experimental-cache-v3
          weight: 20
```

**Variant Tracking** (added to every request):

```http
GET /v2/activities/templates HTTP/1.1
Host: activity.metabob.com
X-Variant-ID: optimized-thompson-v2
X-Request-ID: req_1775854000_abc123
```

Responses include:

```http
HTTP/1.1 200 OK
X-Served-By-Variant: optimized-thompson-v2
X-Served-By-Pod: activity-api-optimized-thompson-v2-5d7f8b9c-xz4k2
```

### 4. Database Stability Strategy

**Problem**: Multiple vessel variants hitting same database with potentially different schemas.

**Solution**: **Schema-first, backward-compatible migrations**

```
┌─────────────────────────────────────────────────────────────────┐
│ Schema Migration Strategy                                        │
│                                                                  │
│ 1. All variants must work with current schema version          │
│ 2. Schema changes deployed independently (not tied to variants) │
│ 3. Migrations are additive (never drop/rename immediately)     │
│ 4. Deprecation period: 2 weeks minimum                         │
│                                                                  │
│ Example Migration Timeline:                                     │
│ Week 1: Add new field `execution_v2` (nullable, default null)  │
│        - Old variants: Ignore new field                        │
│        - New variants: Write to both `execution` and `_v2`     │
│ Week 2: Deploy new variants, observe metrics                   │
│ Week 3: Backfill data, deprecate old field                     │
│ Week 4: Remove old field once all variants updated             │
└─────────────────────────────────────────────────────────────────┘
```

**Database Versioning**:

```sql
-- SurrealDB schema versioning table
DEFINE TABLE schema_version SCHEMAFULL;
DEFINE FIELD version ON schema_version TYPE int;
DEFINE FIELD applied_at ON schema_version TYPE datetime;
DEFINE FIELD description ON schema_version TYPE string;

-- Each variant checks minimum schema version
SELECT * FROM schema_version ORDER BY version DESC LIMIT 1;
-- If version < REQUIRED_MIN_VERSION, variant refuses to start
```

**Connection Pooling**:

```typescript
// Shared SurrealDB client across all variants
// Each variant uses same connection pool
// Service: surrealdb.activity-system.svc.cluster.local:8000
const db = new Surreal({
  url: process.env.SURREALDB_URL,
  namespace: "activity-system",
  database: "learning_loop",
  // Connection pool shared across variants
  maxConnections: 100,
  minConnections: 10
})
```

### 5. Service Mesh Stability

**Problem**: Vessel variants come and go, but service mesh config should be stable.

**Solution**: **Stable service names, variant-specific backends**

```yaml
# Stable service (never changes)
apiVersion: v1
kind: Service
metadata:
  name: activity-api  # ← Clients always use this
  namespace: activity-system
spec:
  selector:
    app: activity-api  # ← All variants have this label
  ports:
    - port: 8080
      targetPort: 8080

---
# Variant-specific deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: activity-api-baseline-v1
  labels:
    app: activity-api  # ← Matches stable service selector
    variant: baseline-v1  # ← Variant identifier
spec:
  replicas: 3
  selector:
    matchLabels:
      app: activity-api
      variant: baseline-v1
  template:
    metadata:
      labels:
        app: activity-api
        variant: baseline-v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      containers:
        - name: activity-api
          image: metabob/activity-api:baseline-v1
          env:
            - name: VARIANT_ID
              value: baseline-v1
```

**Istio DestinationRule** (per-variant subsets):

```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: activity-api
  namespace: activity-system
spec:
  host: activity-api
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        http2MaxRequests: 100
    outlierDetection:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
  subsets:
    - name: baseline-v1
      labels:
        variant: baseline-v1
    - name: optimized-thompson-v2
      labels:
        variant: optimized-thompson-v2
    - name: experimental-cache-v3
      labels:
        variant: experimental-cache-v3
```

---

## Implementation Roadmap

### Phase 1: MiniBob Operator Foundation (1 week)

**Goals**:
- MiniBob runs as Kubernetes deployment
- Watches git repository for changes
- Builds and deploys single variant (parity with current push model)

**Activities to Implement**:
1. `operator-watch-git` - Poll git every 60s, detect changes
2. `operator-build-image` - Build Docker image via kaniko
3. `operator-deploy-variant` - Apply Kubernetes manifests
4. `operator-verify-health` - Check /health endpoint

**Infrastructure**:
- Deploy MiniBob operator to k8s (1 replica)
- Grant k8s RBAC for deployments, services, configmaps
- Set up git webhook (optional, polling is fine initially)

**Success Criteria**:
- Push to git → MiniBob detects → Builds → Deploys → Verifies (end-to-end)
- Execution traces recorded for operator activities

### Phase 2: Multi-Variant Management (1 week)

**Goals**:
- Support multiple variants of same vessel
- Static traffic splitting (manual weights in config)
- Metrics collection per variant

**Activities to Implement**:
1. `operator-reconcile-variants` - Deploy all variants from desired-state.yaml
2. `operator-configure-traffic` - Generate Istio VirtualService
3. `operator-collect-metrics` - Query Prometheus for per-variant stats

**Infrastructure**:
- Prometheus + Grafana for metrics
- Variant ID propagation (headers, labels, traces)
- SurrealDB schema for variant metrics

**Success Criteria**:
- 3 variants deployed simultaneously
- Traffic split 50/30/20 via Istio
- Metrics visible per variant in Grafana

### Phase 3: Dynamic Traffic Optimization (1 week)

**Goals**:
- Thompson Sampling for traffic allocation
- Automatic traffic adjustment every 5 minutes
- Gradual rollout based on success rate

**Activities to Implement**:
1. `operator-optimize-traffic` - Run Thompson Sampling algorithm
2. `operator-adjust-weights` - Update VirtualService weights
3. `operator-record-decision` - Log rationale as execution trace

**Learning Integration**:
- Query `v_activity_score` view for per-variant metrics
- Thompson alpha/beta computation
- Traffic weight optimization

**Success Criteria**:
- Traffic automatically shifts to best-performing variant
- Poor variants gradually get less traffic
- Decisions recorded and traceable

### Phase 4: Auto-Promotion & Rollback (1 week)

**Goals**:
- Auto-promote high-performing variants
- Auto-rollback failing variants
- Git commits for promoted variants (audit trail)

**Activities to Implement**:
1. `operator-auto-promote` - Identify promotion candidates
2. `operator-progressive-rollout` - 10% → 20% → 50% → 100%
3. `operator-emergency-rollback` - Instant traffic to 0% on failure
4. `operator-update-git-state` - Commit promoted variant to git

**Success Criteria**:
- Variant with 95% success rate auto-promoted to 100%
- Variant with error spike rolled back in < 30 seconds
- Git commit shows promotion decision rationale

### Phase 5: Database Migration Automation (1 week)

**Goals**:
- Schema versioning enforced
- Automated migration execution
- Backward compatibility validation

**Activities to Implement**:
1. `operator-apply-migrations` - Run schema migrations
2. `operator-verify-compatibility` - Check all variants support schema
3. `operator-backfill-data` - Data migration for new fields

**Infrastructure**:
- SurrealDB migration framework
- Schema version table
- Migration scripts in git

**Success Criteria**:
- Schema changes applied without downtime
- All variants continue working during migration
- Rollback possible if compatibility issues

---

## Benefits Summary

| Aspect | Push Model (Current) | Pull Model (MiniBob Operator) |
|--------|---------------------|-------------------------------|
| **Deployment Speed** | 16+ minutes | 2-5 minutes (parallel builds) |
| **Experimentation** | 1 variant at a time | N variants simultaneously |
| **Rollback** | Manual (5-10 min) | Automatic (< 30 seconds) |
| **Learning Loop** | Disconnected | Fully integrated |
| **Traffic Optimization** | Static 10/90 split | Dynamic Thompson Sampling |
| **Database Risk** | Schema break = outage | Backward compat enforced |
| **GitOps** | Push from CI | Pull by operator |
| **Observability** | External (GitHub Actions) | Internal (execution traces) |

---

## Questions & Considerations

### 1. How to keep applications fresh while trying many vessels?

**Answer**: Continuous experimentation with minimum traffic allocations.

- Each variant gets minimum 5-10% traffic (configurable)
- New variants start at `initial%` (e.g., 20%)
- Traffic adjusts every 5 minutes based on metrics
- Variants never completely starved (always learning)

### 2. How to maintain database connectivity sanity?

**Answer**: Schema-first, backward-compatible migrations + connection pooling.

- Single SurrealDB endpoint (stable service)
- Shared connection pool across all variants
- Schema versioning enforced at startup
- Migrations additive only (no breaking changes)
- Deprecation period: 2 weeks minimum

### 3. How to keep service mesh sane?

**Answer**: Stable service names, variant-specific labels.

- Service name never changes (`activity-api.activity-system.svc.cluster.local`)
- Variants are subsets of stable service
- Istio VirtualService updated by operator (not manual)
- Circuit breaking + outlier detection per variant
- Metrics collected via prometheus annotations

### 4. What if MiniBob operator itself fails?

**Answer**: Operator is stateless; state lives in git + k8s.

- MiniBob operator crashes → K8s restarts it
- Desired state in git (source of truth)
- Current state in k8s (can be inspected)
- Reconciliation loop resumes on restart
- No data loss (all decisions traced in SurrealDB)

### 5. How to handle secrets across variants?

**Answer**: Secrets stored in k8s Secrets, shared across variants.

- Variants pull secrets from same Secret resource
- SOPS encryption for git-stored secrets
- Secret rotation handled independently of deployments
- No secrets in variant code or images

---

## Next Steps

1. **Review & Approval**: Discuss architecture with team
2. **POC**: Implement Phase 1 (operator foundation) in 1 week
3. **Iterate**: Gather feedback, refine design
4. **Rollout**: Phases 2-5 over 4 weeks
5. **Dogfood**: Use MiniBob to deploy MiniBob variants (meta!)

---

**End of Design Document**
