# Deployment Architecture Violations Summary

**Date:** 2026-04-10
**Status:** Critical Design Correction Needed

---

## The Core Misunderstanding

We tried to build **pull-based Kubernetes deployment** as a special case requiring new backend APIs. This violated the foundational model in multiple ways.

**Truth:** Pull-based deployment is just another application of impulses → activities → traces. No special infrastructure needed.

---

## The Five Major Violations

### 1. Vessel Registry in Backend ❌

**What we did:**
```typescript
POST /v2/vessels/register
GET /v2/vessels/discover
```

**Why wrong:**
> "The backend is NOT a universal resolver. It is a trace store and pattern learner."

**Correct approach:**
- No vessel registry
- Vessels discovered through **introspection at point of use**
- Backend only stores traces, not live vessel state

---

### 2. Boredom Queue API ❌

**What we did:**
```typescript
POST /v2/activities/boredom/enqueue
GET /v2/activities/boredom/queue
```

**Why wrong:**
> "Minimal Backend API: POST /v2/traces (store), POST /v2/traces/query (resolve), POST /v2/activities/recommend (Thompson Sampling)"

**Correct approach:**
- No centralized queue
- Vessels ask: "Given my context, what should I work on?"
- Backend responds with **Thompson-sampled recommendation**
- Each vessel decides when it's idle (local concern)

---

### 3. Activities as Imperative Scripts ❌

**What we did:**
```typescript
tasks: [
  { command: "git pull" },
  { command: "docker build" },
  { command: "kubectl apply" }
]
```

**Why wrong:**
> "Activities are constrained state transitions linking input impulse sets to output impulse sets. NOT deployment scripts."

**Correct approach:**
```typescript
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
    { resolver: "k8s_resource", description: "Apply manifest" },
    { resolver: "prometheus_query", description: "Validate health" }
  ]
}
```

---

### 4. Missing Impulse Types ❌

**What we missed:**

Deployment data wasn't represented as impulses:
- `gitCommit` impulse
- `containerImage` impulse
- `deploymentState` impulse
- `healthMetrics` impulse

**Why wrong:**
> "Impulses Are Universal Data - Everything is an impulse: text, structured data, signals, commands."

**Correct approach:**
Define impulse types for all deployment-related data, with appropriate resolvers.

---

### 5. Resolvers in Wrong Place ❌

**What we assumed:**

MiniBob would somehow gain K8s API access and resolve deployment impulses.

**Why wrong:**
> "Resolvers Live Where Data Lives - The vessel with database credentials resolves SQL. The vessel with filesystem access resolves files."

**Correct approach:**
- **K8s-vessel** (in-cluster deployment) resolves K8s impulses
- **Filesystem vessel** (repos/deployment) resolves file/git impulses
- **Backend** resolves trace/metrics impulses
- **MiniBob** resolves file/memo impulses (stays in its lane)

---

## The Corrected Architecture

### What Actually Needs to Exist

```
┌────────────────────────────────────┐
│ K8s-Vessel (NEW)                   │
│ - Runs in cluster (Deployment)     │
│ - Resolves K8s impulses            │
│ - Executes deployment activities   │
│ - Records traces to backend        │
└────────────────────────────────────┘
              ↓
        (stores traces)
              ↓
┌────────────────────────────────────┐
│ Backend (NO CHANGES)               │
│ - POST /v2/traces (store)          │
│ - POST /v2/traces/query (resolve)  │
│ - POST /v2/activities/recommend    │
│ - Thompson Sampling                │
└────────────────────────────────────┘
              ↓
        (recommends activities)
              ↓
┌────────────────────────────────────┐
│ MiniBob (MINOR CHANGES)            │
│ - Remove vessel registration       │
│ - Use recommendation, not queue    │
│ - Keep local waking activities     │
└────────────────────────────────────┘
```

### Reconciliation Loop (Corrected)

```typescript
// Runs in k8s-vessel
async function reconciliationLoop() {
  while (true) {
    // 1. Create input impulses (metadata only)
    const impulses = [
      { id: "gitCommit", pointer: { type: "git", repo, branch }, loaded: false },
      { id: "currentDeployment", pointer: { type: "k8s_resource", ... }, loaded: false }
    ]

    // 2. Ask backend: "What activity matches these impulse shapes?"
    const recommendation = await backend.recommendActivity({
      goal: "deploy-canary",
      availableImpulses: impulses.map(i => i.metadata)
    })
    // Backend uses Thompson Sampling: { activityId: "deploy-canary", score: 0.94 }

    // 3. Load impulses (now that we know which activity)
    const loaded = await loadImpulses(impulses)

    // 4. Check if deployment needed
    if (needsUpdate(loaded)) {
      const trace = await executeActivity(recommendation.activityId, loaded)
      await backend.storeTrace(trace)  // Learning happens here
    }

    await sleep(RECONCILIATION_INTERVAL)
  }
}
```

**Key insight:** No queue, no registry - just impulses, activities, and Thompson Sampling.

---

## Boredom System (Corrected)

### OLD (Violates Foundation) ❌

```typescript
// Vessel polls centralized queue
const task = await backend.fetchBoredomTask()
await executeTask(task)
```

### NEW (Foundation-Aligned) ✅

```typescript
// Vessel detects idle state (local)
if (timeSinceLastGoal() > IDLE_THRESHOLD) {
  // Create context impulses (what's available)
  const context = [
    { shape: "activityExecutionTrace", summary: "Recent failures" },
    { shape: "activityMetrics", summary: "Slow activities" }
  ]

  // Ask backend for recommendation (Thompson Sampling)
  const recommendation = await backend.recommendActivity({
    goal: "autonomous-improvement",
    availableImpulses: context,
    vesselCapabilities: this.getCapabilities()
  })

  // Execute recommended activity
  await executeActivity(recommendation.activityId, context)
}
```

**No queue API needed.** Backend just recommends based on:
- Available impulse shapes
- Vessel capabilities
- Historical success rates (Thompson Sampling)

---

## What Needs to Change

### Backend (Remove Violations)

**DELETE:**
- `src/routes/vessel-registry.ts` - Entire file
- `src/routes/boredom.ts` - Queue endpoints (keep recommendation logic)
- All `/v2/vessels/*` endpoints
- All `/v2/activities/boredom/enqueue` endpoints
- `vessel` table from SurrealDB schema

**KEEP:**
- `POST /v2/traces`
- `POST /v2/traces/query`
- `POST /v2/activities/recommend` (this is the only way to get work)

### MiniBob (Use Recommendation)

**CHANGE:**
- Replace boredom queue polling with Thompson Sampling recommendation
- Remove vessel registration calls
- Keep local waking activities (those are fine)

**NEW PATTERN:**
```typescript
// OLD
const task = await backend.fetchBoredomTask()

// NEW
const recommendation = await backend.recommendActivity({
  goal: "autonomous-improvement",
  availableImpulses: getLocalContext()
})
```

### New Component: K8s-Vessel

**CREATE:**
- `repos/k8s-vessel/` - New vessel implementation
- Impulse resolvers: `k8s_resource`, `helm`
- Activities: `deploy-canary`, `validate-health`, `rollback`
- Reconciliation loop using Thompson Sampling
- Leader election for HA

---

## Migration Path

### Phase 1: Stop Using Violations

1. **Remove vessel registry:**
   - MiniBob stops calling `POST /v2/vessels/register`
   - Backend removes registry endpoints
   - Delete `vessel` table

2. **Remove boredom queue API:**
   - MiniBob uses `POST /v2/activities/recommend` instead
   - Backend removes queue endpoints
   - Keep local queue file for development

### Phase 2: Create K8s-Vessel

1. New repository with K8s impulse resolvers
2. Deploy in cluster with RBAC
3. Implement reconciliation loop
4. Test with dummy deployments

### Phase 3: Define Deployment Activities

1. Document impulse types (`docs/impulse-types/deployment.md`)
2. Create activity templates (`deploy-canary.json`, etc.)
3. Bootstrap Thompson Sampling with historical data

---

## Key Takeaways

1. **No special infrastructure for pull-based deployment** - Just impulses, activities, resolvers, and Thompson Sampling

2. **Backend is ONLY a trace store + pattern learner** - Never add endpoints for:
   - Service discovery
   - Task queues
   - Vessel coordination
   - Universal resolution

3. **Vessels discover through introspection, not registry** - When MiniBob needs to know what a codebase can do, it reads `package.json`, `Makefile`, etc.

4. **Thompson Sampling replaces task queues** - Vessels don't poll for tasks, they ask for recommendations based on available context

5. **Activities describe transformations, not scripts** - Input shapes → State transition → Output shapes

---

## The Big Picture

**We were trying to build a deployment orchestrator.** That's the wrong abstraction.

**We should build a vessel that executes deployment activities.** That's the correct abstraction.

The difference is subtle but critical:
- **Orchestrator** coordinates other systems, maintains state, assigns work
- **Vessel** executes activities, resolves impulses, records traces

The backend provides recommendations via Thompson Sampling. The vessel decides when to ask for recommendations (idle detection). This is **pull-based learning**, not **push-based orchestration**.

---

## Next Steps

1. Read the full corrected design: `PULL_BASED_DEPLOYMENT_CORRECTED.md`
2. Review violations with team
3. Create GitHub issues for each phase
4. Start with Phase 1 (remove violations) - these are breaking changes
5. Build k8s-vessel incrementally (Phase 2)

**Full details:** `/home/avi/documents/work/exp-repo/metabob-devbob/PULL_BASED_DEPLOYMENT_CORRECTED.md`
