# Pull-Based Deployment Architecture Correction - README

**Date:** 2026-04-10
**Status:** Critical Design Review Complete

---

## What Happened

We designed a pull-based Kubernetes deployment system that **violated the foundational model** defined in `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`.

The violations were subtle but fundamental:
- Added vessel registry endpoints to backend (backend should only store traces)
- Added boredom queue API to backend (backend should only recommend via Thompson Sampling)
- Treated activities as imperative scripts (activities are state transitions with input/output impulse sets)
- Missing impulse types for deployment data (everything should be impulses)
- Planned to put resolvers in wrong places (resolvers live where data lives)

---

## What Changed

We **re-examined the architecture through the lens of the foundational ontology** and discovered that pull-based deployment doesn't need special infrastructure - it's just another application of the impulse-activity model.

---

## Documents Created

### 1. Full Corrected Design
**File:** `PULL_BASED_DEPLOYMENT_CORRECTED.md`

**Contents:**
- Detailed critique of previous design (what violated the foundation)
- Corrected architecture using activities, impulses, vessels, resolvers properly
- Clear definition of what each component IS and IS NOT
- Implementation roadmap (5 phases)
- Migration path

**Key Sections:**
- Part 1: Critique of Previous Design
- Part 2: Corrected Architecture (vessels, impulses, resolvers)
- Part 3: Component Definitions (K8s-Vessel, Backend, MiniBob, Filesystem)
- Part 4: Deployment Activities (Corrected)
- Part 5: Pull-Based Reconciliation Loop
- Part 6: Boredom System (Corrected)
- Part 7: Implementation Roadmap
- Part 8: What Each Component IS and IS NOT
- Part 9: Migration Path

---

### 2. Violations Summary
**File:** `DEPLOYMENT_ARCHITECTURE_VIOLATIONS_SUMMARY.md`

**Contents:**
- Quick reference for the 5 major violations
- Side-by-side OLD vs NEW comparisons
- What needs to change immediately (breaking changes)
- Key takeaways
- The big picture (orchestrator vs vessel)

**Best for:** Quick understanding of what went wrong and what needs to change.

---

### 3. Deployment Impulse Types
**File:** `docs/impulse-types/deployment.md`

**Contents:**
- Complete specification of all deployment-related impulse types
- Configuration impulses (`gitCommit`, `containerImage`, `deploymentSpec`)
- State impulses (`deploymentState`, `podStatus`, `serviceEndpoint`, `healthMetrics`)
- Historical impulses (`activityExecutionTrace`, `activityMetrics`)
- Result impulses (`deploymentResult`, `validationResult`)
- Resolver implementation guide
- Token budget management
- Usage patterns and examples

**Best for:** Implementing the corrected design.

---

### 4. Architecture Diagram
**File:** `DEPLOYMENT_ARCHITECTURE_DIAGRAM.md`

**Contents:**
- Visual representation of the complete system
- Reconciliation loop flowchart (K8s-Vessel)
- Boredom system flowchart (Any Vessel)
- Data flow diagram (deployment activity)
- OLD vs NEW comparison diagrams

**Best for:** Visual understanding of the architecture.

---

## Quick Reference

### What Was Wrong ❌

```typescript
// Backend had vessel registry
POST /v2/vessels/register
GET /v2/vessels/discover

// Backend had boredom queue
POST /v2/activities/boredom/enqueue
GET /v2/activities/boredom/queue

// Activities were imperative scripts
tasks: [
  { command: "git pull" },
  { command: "docker build" },
  { command: "kubectl apply" }
]
```

### What Is Correct ✅

```typescript
// Backend ONLY stores traces and recommends activities
POST /v2/traces              // Store execution trace
POST /v2/traces/query        // Resolve trace-type impulses
POST /v2/activities/recommend // Thompson-sampled recommendation

// Activities are state transitions
{
  inputSchema: {
    required: [
      { shape: "gitCommit" },
      { shape: "containerImage" },
      { shape: "deploymentSpec" }
    ]
  },
  outputSchema: {
    produces: [
      { shape: "deploymentResult" },
      { shape: "healthMetrics" }
    ]
  },
  tasks: [
    { resolver: "k8s_resource", description: "..." },
    { resolver: "helm", description: "..." }
  ]
}
```

---

## The Core Insight

**Pull-based deployment is not a special case requiring new backend APIs.**

It's just the impulse-activity model applied to deployment:

```
INPUT IMPULSES (gitCommit, containerImage, deploymentSpec)
        ↓
ACTIVITY (deploy-canary with k8s resolvers)
        ↓
OUTPUT IMPULSES (deploymentResult, healthMetrics)
        ↓
TRACE RECORDED (backend learns via Thompson Sampling)
```

**No vessel registry needed.**
**No boredom queue API needed.**
**No special orchestration needed.**

Just vessels, impulses, activities, and Thompson Sampling - the same foundation that powers everything else.

---

## What Needs to Change

### Immediate (Breaking Changes)

1. **Remove from Backend:**
   - `src/routes/vessel-registry.ts` (entire file)
   - `src/routes/boredom.ts` (queue endpoints only)
   - All `/v2/vessels/*` endpoints
   - All `/v2/activities/boredom/enqueue` endpoints
   - `vessel` table from SurrealDB

2. **Update MiniBob:**
   - Replace boredom queue polling with recommendation
   - Remove vessel registration calls
   - Use `POST /v2/activities/recommend` instead of queue fetch

### Gradual (Non-Breaking)

1. **Create K8s-Vessel:**
   - New repository: `repos/k8s-vessel/`
   - Implement K8s impulse resolvers
   - Implement deployment activities
   - Deploy in cluster with RBAC

2. **Define Impulse Types:**
   - Document all deployment impulse types
   - Implement resolvers in appropriate vessels

3. **Convert Deployment Scripts to Activities:**
   - Identify manual deployment steps
   - Convert to activity templates
   - Bootstrap Thompson Sampling

---

## How Boredom Works Now (Corrected)

### OLD Pattern (Violated Foundation) ❌

```typescript
// Vessel polls centralized queue
const task = await backend.fetchBoredomTask()
await executeTask(task)
```

**Problems:**
- Centralized queue in backend
- Backend assigns work
- No Thompson Sampling for task selection

### NEW Pattern (Foundation-Aligned) ✅

```typescript
// 1. Vessel detects idle (local)
if (timeSinceLastGoal() > IDLE_THRESHOLD) {

  // 2. Create context impulses
  const context = [
    { shape: "activityExecutionTrace", summary: "Recent failures" },
    { shape: "activityMetrics", summary: "Slow activities" }
  ]

  // 3. Ask backend for recommendation (Thompson Sampling)
  const recommendation = await backend.recommendActivity({
    goal: "autonomous-improvement",
    availableImpulses: context,
    vesselCapabilities: this.getCapabilities()
  })

  // 4. Execute recommended activity
  await executeActivity(recommendation.activityId, context)
}
```

**Improvements:**
- No centralized queue
- Idle detection is local to each vessel
- Backend uses Thompson Sampling to recommend
- Context-aware (vessel provides what it can see)
- Capability-aware (backend only recommends what vessel can do)

---

## Implementation Phases

### Phase 1: Remove Violations (Week 1)
- Delete vessel registry from backend
- Delete boredom queue API from backend
- Update MiniBob to use recommendations
- Test that existing functionality still works

### Phase 2: Create K8s-Vessel (Week 2-3)
- Set up new repository
- Implement basic reconciliation loop
- Deploy in cluster with RBAC
- Test with dummy deployments

### Phase 3: Define Impulse Types (Week 3-4)
- Document all deployment impulse types
- Implement resolvers in k8s-vessel
- Test impulse resolution

### Phase 4: Deployment Activities (Week 4-5)
- Create activity templates
- Test activities in isolation
- Bootstrap Thompson Sampling

### Phase 5: Integration (Week 6)
- End-to-end deployment flow
- Validate learning loop
- Production deployment

---

## Success Criteria

After implementation, we should be able to:

1. **Push to `dev` branch** → k8s-vessel automatically detects and deploys to canary
2. **No manual `kubectl` commands** → All changes via Git commits
3. **Thompson Sampling improves success rate** → System learns from each deployment
4. **Vessels work autonomously when idle** → Boredom system uses recommendations, not queue
5. **Backend has minimal API surface** → Only traces, query, recommend endpoints

---

## Key References

| Document | Purpose |
|----------|---------|
| `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` | Canonical foundational model |
| `PULL_BASED_DEPLOYMENT_CORRECTED.md` | Complete corrected design |
| `DEPLOYMENT_ARCHITECTURE_VIOLATIONS_SUMMARY.md` | Quick violations reference |
| `docs/impulse-types/deployment.md` | Impulse type specifications |
| `DEPLOYMENT_ARCHITECTURE_DIAGRAM.md` | Visual diagrams |

---

## Questions Answered

### Q: Do we need a vessel registry?
**A:** No. Vessels are discovered through introspection at the point of use (e.g., reading `package.json` for npm scripts, `Makefile` for make targets).

### Q: How do vessels get work when idle?
**A:** They ask the backend for a Thompson-sampled recommendation based on their current context and capabilities. No centralized queue.

### Q: Where do deployment resolvers live?
**A:** In k8s-vessel (in-cluster deployment with K8s API access). Resolvers live where data lives.

### Q: What does the backend actually do?
**A:** Three things only:
1. Store execution traces (`POST /v2/traces`)
2. Resolve trace-type impulses (`POST /v2/traces/query`)
3. Recommend activities via Thompson Sampling (`POST /v2/activities/recommend`)

### Q: Is this similar to ArgoCD or Flux?
**A:** Conceptually similar (pull-based, reconciliation loop, GitOps), but implemented differently. We use activities instead of Helm/Kustomize controllers, and Thompson Sampling instead of manual sync policies.

### Q: Can we still have local boredom queues?
**A:** Yes, for development. The local queue file (`~/.minibob/boredom-queue.json`) is fine - it's local to the vessel, not a centralized API.

---

## Next Actions

1. **Review with team** - Ensure everyone understands the violations
2. **Create GitHub issues** - One per phase
3. **Start Phase 1** - Remove violations (breaking changes, do first)
4. **Parallel work** - Phase 2 (k8s-vessel) can start while Phase 1 completes
5. **Document as we go** - Update CLAUDE.md, add examples

---

## The Bottom Line

We were building a deployment orchestrator. That's the wrong abstraction.

We should build a vessel that executes deployment activities. That's the correct abstraction.

The difference:
- **Orchestrator**: Coordinates other systems, maintains state, assigns work
- **Vessel**: Executes activities, resolves impulses, records traces

The backend provides recommendations via Thompson Sampling. The vessel decides when to ask for recommendations. This is **pull-based learning**, not **push-based orchestration**.

---

## Contact

For questions or clarifications, see the full documents:
- **Complete design:** `/home/avi/documents/work/exp-repo/metabob-devbob/PULL_BASED_DEPLOYMENT_CORRECTED.md`
- **Quick summary:** `/home/avi/documents/work/exp-repo/metabob-devbob/DEPLOYMENT_ARCHITECTURE_VIOLATIONS_SUMMARY.md`
- **Impulse types:** `/home/avi/documents/work/exp-repo/metabob-devbob/docs/impulse-types/deployment.md`
- **Diagrams:** `/home/avi/documents/work/exp-repo/metabob-devbob/DEPLOYMENT_ARCHITECTURE_DIAGRAM.md`
