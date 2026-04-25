# GitOps + Vessel Integration: Complete Architecture Synthesis

**Date**: 2026-04-10
**Purpose**: Connect vessel-integration-standardization spec with MiniBob GitOps operator design
**Status**: Analysis & Roadmap

---

## Executive Summary

Two complementary architectural initiatives exist:

1. **Vessel Integration Standardization** (OpenSpec change: `vessel-integration-standardization`)
   - **Status**: Phases 1-2 complete, Phases 3-4 implemented but not deployed/tested
   - **Purpose**: Standardize how vessels discover each other, communicate, and resolve impulses
   - **Key Components**: Shape registry, vessel discovery, mTLS auth, circuit breakers, health scoring

2. **MiniBob GitOps Operator** (Design: `MINIBOB_GITOPS_DESIGN.md`)
   - **Status**: Proposal phase
   - **Purpose**: Pull-based deployment with multi-variant experimentation and autonomous promotion
   - **Key Components**: Git-driven desired state, Thompson Sampling traffic, auto-promotion, rollback

**These architectures are perfectly complementary:**
- Vessel Integration enables variants to discover and communicate
- GitOps Operator deploys and optimizes variants autonomously
- Together they create a self-improving deployment system

---

## Current Implementation Status

### Vessel Integration Standardization

**Phase 1-2: Complete ✅**

| Component | Status | Location |
|-----------|--------|----------|
| Shape Registry | ✅ Deployed | Activity-API `/v2/shapes/*` |
| Vessel Discovery | ✅ Deployed | Activity-API `/v2/vessels/*` |
| Analysis-API Direct | ✅ Deployed | Analysis-API `/v2/impulses/resolve` |
| MiniBob mTLS Client | ✅ Deployed | MiniBob vessel-to-vessel auth |
| Config Validation | ✅ Deployed | MiniBob startup validation |
| Context Acquisition | ✅ Implemented | MiniBob activities (error-log, requirements, codebase) |

**Phase 3: Implemented but not deployed ⚠️**

| Component | Status | Blocker |
|-----------|--------|---------|
| Goal Orchestrators | ✅ Code complete | Needs deployment + testing (tasks 9.1-9.8) |
| `goal:test` orchestrator | ✅ Implemented | Not yet tested end-to-end |
| `goal:refactor` orchestrator | ✅ Implemented | Not yet tested end-to-end |

**Phase 4: Implemented but not deployed ⚠️**

| Component | Status | Blocker |
|-----------|--------|---------|
| Circuit Breaker | ✅ Implemented | Needs deployment + testing (tasks 12.1-12.11) |
| Health Scoring | ✅ Implemented | Not yet validated with real failures |
| Routing Traces | ✅ Implemented | Not yet visualized in dashboard |
| Thompson Sampling Routing | ✅ Implemented | Not yet tested with multiple vessels |

**Phase 5: Not started ❌**

| Component | Status | Blocker |
|-----------|--------|---------|
| Remove Proxy Pattern | ❌ Pending | Needs Phases 3-4 validation first |
| Analysis-API shape rejection | ❌ Pending | Backward compat concerns |

### GitOps Operator

**Status: Proposal Phase**

All 5 phases are designed but not implemented:
- Phase 1: Operator foundation
- Phase 2: Multi-variant management
- Phase 3: Dynamic traffic optimization
- Phase 4: Auto-promotion & rollback
- Phase 5: Database migration automation

---

## Architecture Integration Map

### How They Work Together

```
┌──────────────────────────────────────────────────────────────────┐
│ Git Repository (Desired State)                                   │
│ ├── vessels/activity-api/variant-1/                             │
│ ├── vessels/activity-api/variant-2/                             │
│ └── manifests/desired-state.yaml                                │
└──────────────────────────────────────────────────────────────────┘
                            ▼
        ╔════════════════════════════════════════╗
        ║ MiniBob GitOps Operator                ║
        ║ (Phase 1-5 of GitOps Design)           ║
        ╚════════════════════════════════════════╝
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ Kubernetes Cluster                                                │
│                                                                   │
│ ┌────────────────────┐  ┌────────────────────┐                  │
│ │ activity-api-v1    │  │ activity-api-v2    │                  │
│ │ (baseline)         │  │ (optimized)        │                  │
│ │                    │  │                    │                  │
│ │ Registers via:     │  │ Registers via:     │                  │
│ │ POST /v2/vessels/  │  │ POST /v2/vessels/  │                  │
│ │      register      │  │      register      │                  │
│ └────────────────────┘  └────────────────────┘                  │
│         │                        │                                │
│         └────────┬───────────────┘                                │
│                  ▼                                                │
│    ╔═══════════════════════════════════════╗                     │
│    ║ Activity-API (Vessel Discovery)       ║                     │
│    ║ - Vessel Registry: /v2/vessels/*     ║                     │
│    ║ - Shape Registry: /v2/shapes/*       ║                     │
│    ║ - Health Scoring (Phase 4)           ║                     │
│    ║ - Circuit Breakers (Phase 4)         ║                     │
│    ║ - Thompson Sampling Routing          ║                     │
│    ╚═══════════════════════════════════════╝                     │
│                  │                                                │
│                  ▼                                                │
│    ╔═══════════════════════════════════════╗                     │
│    ║ Istio VirtualService                  ║                     │
│    ║ - Traffic weights updated by Operator ║                     │
│    ║ - 50% → v1, 50% → v2                  ║                     │
│    ╚═══════════════════════════════════════╝                     │
└──────────────────────────────────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ Learning Loop (SurrealDB)                                         │
│ - Execution traces per variant                                   │
│ - Routing traces (who resolved what)                            │
│ - Circuit breaker events                                         │
│ - Health scores per vessel                                       │
│ - Thompson Sampling α/β per variant                              │
└──────────────────────────────────────────────────────────────────┘
```

### Component Interactions

**1. Vessel Registration (Vessel Integration Phase 1)**

When a variant starts up:
```
1. activity-api-v1 starts
2. Reads capabilities from embedded metadata
3. Calls: POST /v2/vessels/register
   {
     "id": "activity-api-v1-abc123",
     "capabilities": {
       "resolves": ["activityExecutionTrace", "activityTemplate"],
       "produces": ["executionTrace"],
       "version": "2.0"
     },
     "endpoint": "https://activity-api-v1.activity-system.svc.cluster.local:8080",
     "health_check": "/health"
   }
4. Activity-API stores in `vessel` table
5. Circuit breaker initialized in CLOSED state
```

**2. Vessel Discovery (Vessel Integration Phase 1)**

MiniBob looking for problem analysis:
```
1. MiniBob receives impulse: {type: "problemDetection", path: "src/auth.ts"}
2. Checks local resolvers first (not found)
3. Calls: GET /v2/vessels/discover?shape=problemDetection
4. Activity-API queries:
   - `vessel` table for capabilities
   - `vessel_health` table for health scores
   - `circuit_breaker_state` table for availability
5. Returns: [
   {
     "id": "analysis-api-v1",
     "endpoint": "https://analysis-api-v1...",
     "health_score": 0.95,
     "circuit_state": "closed"
   },
   {
     "id": "analysis-api-v2-experimental",
     "endpoint": "https://analysis-api-v2...",
     "health_score": 0.82,
     "circuit_state": "closed"
   }
 ]
6. MiniBob selects best candidate (health_score weighted)
7. Calls vessel directly via mTLS + API key
```

**3. Traffic Optimization (GitOps Phase 3 + Vessel Integration Phase 4)**

MiniBob Operator adjusts traffic every 5 minutes:
```
1. Operator runs waking activity: optimize-traffic-split
2. Queries SurrealDB for variant metrics:
   SELECT
     variant_id,
     count() AS executions,
     count(success = true) / count() AS success_rate,
     avg(duration_ms) AS avg_duration
   FROM execution
   WHERE created_at > time::now() - 1h
   GROUP BY variant_id

3. Gets results:
   - activity-api-v1: success_rate=0.92, avg_duration=250ms
   - activity-api-v2: success_rate=0.96, avg_duration=180ms

4. Runs Thompson Sampling:
   - v1: α=920, β=80  → sample=0.919
   - v2: α=960, β=40  → sample=0.958

5. Computes new traffic weights:
   - v1: 0.919 / (0.919 + 0.958) = 48.9% → round to 45%
   - v2: 0.958 / (0.919 + 0.958) = 51.1% → round to 55%

6. Updates Istio VirtualService:
   kubectl patch virtualservice activity-api \
     --patch '{"spec":{"http":[{"route":[
       {"destination":{"host":"activity-api-v1"},"weight":45},
       {"destination":{"host":"activity-api-v2"},"weight":55}
     ]}]}}'

7. Records decision in execution trace
```

**4. Circuit Breaker (Vessel Integration Phase 4)**

Vessel fails repeatedly:
```
1. MiniBob resolves impulse via analysis-api-v2
2. Request fails (timeout after 5s)
3. Activity-API records failure in circuit_breaker_trace:
   {
     "vessel_id": "analysis-api-v2",
     "event": "failure",
     "consecutive_failures": 1,
     "failure_rate_window": 0.10  // 10% over 60s
   }

4. On 5th consecutive failure:
   - Circuit breaker state: CLOSED → OPEN
   - Event recorded with reason: "5 consecutive failures"
   - Vessel marked ineligible for routing

5. Subsequent impulse resolutions:
   - analysis-api-v2 filtered out (circuit open)
   - Only analysis-api-v1 considered
   - MiniBob routes to v1 automatically

6. After 30 seconds:
   - Circuit breaker state: OPEN → HALF_OPEN
   - Next request allowed as "test probe"
   - If succeeds: HALF_OPEN → CLOSED
   - If fails: HALF_OPEN → OPEN (30s more)
```

**5. Auto-Promotion (GitOps Phase 4)**

Variant performs well:
```
1. Operator runs waking activity: auto-promote-variants (every 15 min)
2. Queries for promotion candidates:
   - success_rate > 0.90
   - execution_count > 100
   - p95_latency < 500ms

3. Finds activity-api-v2:
   - success_rate: 0.96
   - executions: 342
   - p95_latency: 280ms

4. Progressive rollout:
   Week 1: 55% → 65% (gradual increase)
   Week 2: 65% → 80% (continues)
   Week 3: 80% → 100% (full promotion)

5. Updates git desired-state.yaml:
   git commit -m "auto-promote: activity-api-v2 to 100% (success_rate=0.96)"

6. Deprecates old variant:
   - activity-api-v1 traffic: 45% → 20% → 0%
   - Deployment scaled down after 7 days at 0%
   - Git commit documents decision rationale
```

**6. Emergency Rollback (GitOps Phase 4)**

Variant suddenly fails:
```
1. Operator runs waking activity: emergency-rollback (every 10s)
2. Checks recent failure spike:
   - analysis-api-v2: 5 failures in last 30 seconds
   - Error rate: 100% (was 4% before)

3. Triggers emergency rollback:
   - analysis-api-v2 traffic: 55% → 0% (immediate)
   - Circuit breaker: CLOSED → OPEN
   - Slack notification: "Emergency rollback: analysis-api-v2"

4. Redistributes traffic:
   - analysis-api-v1: 45% → 100%
   - Load balancer updated within 5 seconds
   - No new requests routed to failing variant

5. Records in execution trace:
   {
     "activity_id": "emergency-rollback",
     "trigger": "error_spike",
     "variant_affected": "analysis-api-v2",
     "traffic_before": "55%",
     "traffic_after": "0%",
     "latency_impact": "< 30 seconds",
     "reason": "5/5 requests failed in 30s window"
   }

6. Investigation triggered:
   - Creates GitHub issue automatically
   - Includes logs, traces, error messages
   - Tags on-call engineer
```

---

## Integration Benefits

| Capability | Vessel Integration Provides | GitOps Operator Uses It For |
|------------|----------------------------|----------------------------|
| **Vessel Discovery** | `/v2/vessels/discover` endpoint | Finding available variants for traffic split |
| **Health Scoring** | Real-time health scores per variant | Weighted traffic allocation decisions |
| **Circuit Breakers** | Automatic failure detection | Emergency rollback triggers |
| **Shape Registry** | Centralized shape definitions | Validating variant compatibility |
| **mTLS Auth** | Secure vessel-to-vessel communication | Variant-to-variant impulse resolution |
| **Routing Traces** | Decision audit trail | Learning optimal routing patterns |
| **Thompson Sampling** | Probabilistic variant selection | Traffic weight computation |

**Example Scenario**: Deploy new analysis variant

```
1. GitOps Operator: Detects new variant in git (analysis-api-v3-ml-enhanced)
2. GitOps Operator: Builds image, deploys to k8s at 20% traffic
3. Vessel Integration: Variant registers capabilities via /v2/vessels/register
4. Vessel Integration: Shape registry validates it can resolve problemDetection
5. GitOps Operator: Sets Istio traffic weights (v1:40%, v2:40%, v3:20%)
6. Vessel Integration: MiniBob discovers v3 via /v2/vessels/discover
7. Vessel Integration: MiniBob routes 20% of problemDetection requests to v3
8. Vessel Integration: Circuit breaker monitors v3 health
9. GitOps Operator: Thompson Sampling adjusts traffic based on success rate
10. If v3 outperforms: Auto-promote to 100% over 3 weeks
11. If v3 fails: Circuit breaker opens, emergency rollback to v1/v2
```

---

## Unified Implementation Roadmap

### Phase 1: Complete Vessel Integration (1 week)

**Goal**: Finish deploying and testing Phases 3-4 of vessel-integration-standardization

**Tasks**:
1. Deploy goal orchestrators to canary (tasks 9.1-9.8)
   - Test `minibob --single "test the auth module"`
   - Test `minibob --single "refactor user service"`
   - Verify composition graphs in traces

2. Deploy circuit breaker + health scoring (tasks 12.1-12.11)
   - Simulate vessel failures
   - Verify circuit opens after 5 failures
   - Verify routing traces appear in SurrealDB
   - Validate health score computation

3. Remove proxy pattern (tasks 13.1-13.10)
   - Analysis-API shapes route direct to vessel
   - Activity-API rejects with "use vessel-direct"

**Success Criteria**:
- ✅ All 18 vessel integration specs fully deployed
- ✅ Circuit breakers tested with real failures
- ✅ Health scores updating based on vessel performance
- ✅ Routing traces visible in dashboard
- ✅ Goal orchestrators working end-to-end

### Phase 2: GitOps Operator Foundation (1 week)

**Goal**: MiniBob watches git and deploys single variant (parity with current push model)

**Prerequisites**: Vessel Integration Phase 1 complete

**Tasks**:
1. Implement MiniBob operator activities:
   - `operator-watch-git` - Poll git every 60s for changes
   - `operator-build-image` - Build Docker images via kaniko
   - `operator-deploy-variant` - Apply Kubernetes manifests
   - `operator-verify-health` - Check /health endpoints

2. Deploy MiniBob operator to k8s:
   - 1 replica with leader election
   - RBAC for deployments, services, configmaps
   - Git webhook integration (optional)

3. Test end-to-end:
   - Push to git → MiniBob detects → Builds → Deploys
   - Execution traces recorded for operator activities

**Success Criteria**:
- ✅ Git push triggers autonomous deployment
- ✅ No human intervention needed
- ✅ All operator activities traced in SurrealDB

### Phase 3: Multi-Variant Deployment (1 week)

**Goal**: Deploy 3 variants simultaneously with static traffic split

**Prerequisites**: GitOps Operator Phase 1 complete

**Tasks**:
1. Extend operator activities:
   - `operator-reconcile-variants` - Deploy all variants from desired-state.yaml
   - `operator-configure-traffic` - Generate Istio VirtualService
   - `operator-collect-metrics` - Query Prometheus per-variant

2. Infrastructure:
   - Prometheus + Grafana for metrics
   - Variant ID propagation (X-Variant-ID header)
   - SurrealDB schema for variant metrics

3. Test deployment:
   - 3 variants: baseline (50%), optimized (30%), experimental (20%)
   - Metrics visible per variant in Grafana
   - Vessel discovery lists all 3 variants

**Success Criteria**:
- ✅ 3 variants running simultaneously
- ✅ Traffic split as configured
- ✅ Per-variant metrics collected
- ✅ Vessel discovery aware of all variants

### Phase 4: Dynamic Traffic Optimization (1 week)

**Goal**: Thompson Sampling automatically adjusts traffic every 5 minutes

**Prerequisites**: Multi-Variant Phase 3 complete + Vessel Integration Phase 4 (circuit breakers)

**Tasks**:
1. Implement optimization activity:
   - `operator-optimize-traffic` - Run Thompson Sampling
   - `operator-adjust-weights` - Update VirtualService
   - `operator-record-decision` - Log rationale as trace

2. Integration with vessel discovery:
   - Query health scores from `/v2/vessels/discover`
   - Filter out vessels with circuit_state=open
   - Weight traffic by success rate + health score

3. Test optimization:
   - Simulate variant with 95% success rate
   - Verify traffic increases over time
   - Simulate variant failure, verify traffic decrease

**Success Criteria**:
- ✅ Traffic shifts to best-performing variant
- ✅ Poor variants lose traffic automatically
- ✅ Decisions recorded and traceable
- ✅ Circuit breakers integrate correctly

### Phase 5: Auto-Promotion & Rollback (1 week)

**Goal**: Autonomous promotion and emergency rollback

**Prerequisites**: Dynamic Traffic Phase 4 complete

**Tasks**:
1. Implement promotion/rollback activities:
   - `operator-auto-promote` - Identify candidates
   - `operator-progressive-rollout` - 10% → 20% → 50% → 100%
   - `operator-emergency-rollback` - Instant traffic to 0%
   - `operator-update-git-state` - Commit decisions to git

2. Thresholds:
   - Promotion: success_rate > 0.90, N > 100
   - Rollback: error spike (5 failures in 30s)

3. Test scenarios:
   - Deploy high-performing variant → auto-promote
   - Deploy failing variant → emergency rollback
   - Verify git commits show decision rationale

**Success Criteria**:
- ✅ High performers auto-promoted to 100%
- ✅ Failures rolled back in < 30 seconds
- ✅ Git audit trail for all decisions
- ✅ No human intervention required

### Phase 6: Database Migration Automation (1 week)

**Goal**: Schema changes without downtime

**Prerequisites**: Auto-Promotion Phase 5 complete

**Tasks**:
1. Implement migration activities:
   - `operator-apply-migrations` - Run schema migrations
   - `operator-verify-compatibility` - Check all variants support schema
   - `operator-backfill-data` - Data migration for new fields

2. Schema versioning:
   - SurrealDB schema_version table
   - Variants declare minimum schema version
   - Refuse to start if incompatible

3. Test migration:
   - Add new field while 3 variants running
   - Verify all variants continue working
   - Verify backfill completes

**Success Criteria**:
- ✅ Schema changes applied without downtime
- ✅ All variants compatible during migration
- ✅ Rollback possible if compatibility issues

---

## Critical Integration Points

### 1. Vessel Registration → Variant Discovery

**Flow**:
```
variant starts → registers capabilities → operator discovers it → includes in traffic split
```

**Integration**:
- GitOps operator queries `/v2/vessels/discover` before adjusting traffic
- Only includes variants with `circuit_state != "open"`
- Weights traffic by health scores

**Code Location**:
- Vessel Integration: `repos/metabob-activity-api/src/routes/vessels.ts` (discovery endpoint)
- GitOps Operator: `repos/minibob/src/operator/traffic-optimizer.ts` (query logic)

### 2. Health Scoring → Traffic Weights

**Flow**:
```
execution traces → health score computation → Thompson Sampling → traffic weights
```

**Integration**:
- GitOps operator reads health scores from `vessel_health` table
- Uses scores as priors for Thompson Sampling
- Records traffic decisions as traces (feeds back into health)

**Code Location**:
- Vessel Integration: `repos/metabob-activity-api/src/services/health-scoring.ts`
- GitOps Operator: `repos/minibob/src/operator/thompson-sampling.ts`

### 3. Circuit Breaker → Emergency Rollback

**Flow**:
```
5 consecutive failures → circuit opens → variant filtered → traffic redistributed
```

**Integration**:
- GitOps operator queries circuit breaker state
- Excludes variants with open circuits from traffic split
- Logs emergency rollback as activity execution

**Code Location**:
- Vessel Integration: `repos/metabob-activity-api/src/services/circuit-breaker.ts`
- GitOps Operator: `repos/minibob/src/operator/emergency-rollback.ts`

### 4. Shape Registry → Variant Compatibility

**Flow**:
```
variant declares shapes → shape registry validates → operator checks compatibility
```

**Integration**:
- GitOps operator calls `/v2/shapes` to get variant's declared shapes
- Before deploying new variant, validates it can produce required shapes
- Prevents deploying incompatible variants

**Code Location**:
- Vessel Integration: `repos/metabob-activity-api/src/routes/shapes.ts`
- GitOps Operator: `repos/minibob/src/operator/compatibility-checker.ts`

---

## Remaining Questions & Decisions

### 1. Should GitOps Operator live in MiniBob or separate service?

**Option A: Inside MiniBob** (Recommended)
- ✅ MiniBob already has activity system
- ✅ Waking activities are natural fit
- ✅ Operator activities traced like any other
- ✅ Dogfooding (MiniBob deploys MiniBob)
- ❌ MiniBob becomes more complex

**Option B: Separate Service**
- ✅ Cleaner separation of concerns
- ✅ Can deploy operator independently
- ❌ Need to replicate activity system
- ❌ Not dogfooding MiniBob

**Decision**: Option A. GitOps operator is a vessel capability, just like MiniBob's other capabilities. It should live inside MiniBob.

### 2. How to handle secrets across variants?

**Solution**: Secrets stored in k8s Secrets, shared across variants
- All variants mount same Secret resource
- SOPS encryption for git-stored secrets
- Secret rotation independent of deployments
- No secrets in variant code/images

### 3. When to extract Vessel Registry to dedicated service?

**Criteria**:
- 5+ vessels registered
- OR discovery query latency > 10ms P99
- OR health computation impacts Activity-API performance

**Current**: 2 vessels (MiniBob, Analysis-API) → stay in Activity-API
**Future**: Extract when criteria met

### 4. How to version desired-state.yaml?

**Solution**: Git tags + schema versioning
```yaml
apiVersion: minibob.metabob.com/v1  # Schema version
kind: VesselFleet
metadata:
  name: production-fleet
  version: 2026.04.10  # Deployment version
```

Operator validates `apiVersion` on startup, refuses to run if incompatible.

---

## Success Metrics

### Deployment Velocity
- **Current**: 16+ minutes (push model)
- **Target**: 2-5 minutes (pull model)

### Experimentation Rate
- **Current**: 1 variant at a time
- **Target**: 3+ variants simultaneously

### Rollback Speed
- **Current**: 5-10 minutes (manual)
- **Target**: < 30 seconds (automatic)

### Variant Success Rate
- **Current**: Unknown (no tracking)
- **Target**: > 90% average across all variants

### Learning Loop Integration
- **Current**: Disconnected
- **Target**: 100% of deployments traced

---

## Next Actions

**Immediate (This Week)**:
1. Complete Vessel Integration Phase 3-4 deployment
2. Validate circuit breakers with real failures
3. Test goal orchestrators end-to-end

**Near-Term (Next 2 Weeks)**:
1. Implement GitOps Operator Phase 1 (foundation)
2. Test autonomous deployment (git → deploy)
3. Validate operator activities traced correctly

**Mid-Term (Next 4 Weeks)**:
1. Deploy multi-variant support (Phase 2-3)
2. Integrate Thompson Sampling with vessel discovery
3. Test auto-promotion and rollback (Phase 4-5)

**Long-Term (Next 8 Weeks)**:
1. Database migration automation (Phase 6)
2. Extract Vessel Registry if needed
3. Measure success metrics, iterate

---

## Conclusion

**Vessel Integration** and **GitOps Operator** are two halves of the same vision:

- **Vessel Integration**: How variants discover and communicate
- **GitOps Operator**: How variants are deployed and optimized

Together they enable:
- **Autonomous experimentation** (deploy 3 variants, let system choose best)
- **Fast feedback loops** (2-5 minute deploys, 30-second rollbacks)
- **Learning integration** (all decisions traced and fed back)
- **Self-improvement** (system learns which variants work best)

**The architecture is sound. The specs are standardized. The path is clear.**

Next step: Execute the roadmap above. Start with completing Vessel Integration Phase 3-4, then build GitOps Operator Phase 1.

**Let MiniBob deploy MiniBob.**

---

**End of Synthesis Document**
