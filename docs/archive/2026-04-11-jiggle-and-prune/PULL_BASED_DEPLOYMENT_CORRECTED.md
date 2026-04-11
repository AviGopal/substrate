# Pull-Based Deployment Architecture: Corrected Using Foundation Ontology

**Date:** 2026-04-10
**Status:** Design Correction
**Purpose:** Redesign the pull-based deployment architecture to align with the foundational model defined in `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`

---

## Part 1: Critique of Previous Design

### What Violated the Foundation

Our previous pull-based deployment design made **fundamental violations** of the impulse-activity foundation:

#### 1. Vessel Registry Endpoint in Backend ❌

**What we did:**
```typescript
// POST /v2/vessels/register
// GET /v2/vessels/discover
// Centralized registry storing vessel capabilities
```

**Why this violates the foundation:**

> **Principle 3:** "Resolvers Live Where Data Lives - Don't centralize resolution."

> **Backend Role:** "The backend is NOT a universal resolver. It is a trace store and pattern learner."

The backend should ONLY store:
- Execution traces
- Learning metrics
- Historical patterns

It should NOT:
- Track live vessel state
- Act as service discovery
- Coordinate vessel operations

**The correct pattern:** Vessels are discovered through **introspection at the point of use**, not through a registry.

#### 2. Boredom Queue API ❌

**What we did:**
```typescript
// POST /v2/activities/boredom/enqueue
// GET /v2/activities/boredom/queue
// Centralized task queue in backend
```

**Why this violates the foundation:**

> **Backend Role:** "Minimal Backend API: POST /v2/traces (store), POST /v2/traces/query (resolve), POST /v2/activities/recommend (Thompson Sampling)"

The backend should use Thompson Sampling to **recommend activities** based on goal + context, not maintain a task queue.

**The correct pattern:**
- Vessel asks: "Given my current context (impulses), what activity should I execute?"
- Backend responds: "Based on Thompson Sampling, try activity X (α=45, β=3)"
- Vessel executes, records trace
- Backend learns from trace

#### 3. Activities as Imperative Scripts ❌

**What we did:**
```typescript
// Deployment activity with imperative steps:
// 1. git pull
// 2. docker build
// 3. kubectl apply
// 4. check health
```

**Why this violates the foundation:**

> **Activities:** "Constrained state transitions linking input impulse sets to output impulse sets. NOT deployment scripts or orchestration tools."

Activities should:
- Define input impulse shapes required
- Define output impulse shapes produced
- Describe state transformation (before → after)
- Be measured for success/failure/cost/duration

**The correct pattern:** Activities describe WHAT transformation is needed, not HOW to do it step-by-step.

#### 4. Missing Impulse Types for Deployment ❌

**What we missed:**

We didn't define impulse types for deployment-related data:
- `containerImage` impulse (points to image registry)
- `deploymentSpec` impulse (points to K8s manifest)
- `deploymentState` impulse (current cluster state)
- `healthMetrics` impulse (observability data)

**Why this violates the foundation:**

> **Principle 1:** "Impulses Are Universal Data - Everything is an impulse: text, structured data, signals, commands."

Deployment data is no different from any other data - it should be represented as impulses with metadata.

#### 5. Resolvers in Wrong Location ❌

**What we assumed:**

MiniBob would somehow gain Kubernetes API access and resolve deployment impulses.

**Why this violates the foundation:**

> **Principle 3:** "Resolvers Live Where Data Lives - The vessel with database credentials resolves SQL. The vessel with filesystem access resolves files."

The vessel with **Kubernetes API access** should resolve Kubernetes impulses. MiniBob has filesystem access, not K8s API access.

**The correct pattern:** A separate deployment vessel with K8s API credentials resolves K8s-related impulses.

---

## Part 2: Corrected Architecture

### Core Insight

**Pull-based deployment is not a special case** - it's just another application of the impulse-activity model:

```
INPUT IMPULSES → ACTIVITY (state transition) → OUTPUT IMPULSES
```

For deployment:
```
gitCommit + deploymentSpec + clusterState → deploy-canary → deploymentResult + healthMetrics
```

### The Three Impulse Categories for Deployment

#### 1. Configuration Impulses (What to Deploy)

| Impulse Type | Pointer Shape | Resolver | Example |
|--------------|---------------|----------|---------|
| `gitCommit` | `{ type: "git", repo: string, sha: string }` | git-vessel | Latest commit on `dev` branch |
| `containerImage` | `{ type: "container_registry", image: string, tag: string }` | registry-vessel | `minibob:canary-abc123` |
| `deploymentSpec` | `{ type: "file", path: string }` | filesystem | `environments/canary/minibob.yaml` |
| `helmValues` | `{ type: "file", path: string }` | filesystem | `environments/canary.values.yaml` |

#### 2. State Impulses (Current Reality)

| Impulse Type | Pointer Shape | Resolver | Example |
|--------------|---------------|----------|---------|
| `deploymentState` | `{ type: "k8s_resource", kind: "Deployment", name: string, namespace: string }` | k8s-vessel | Current running deployment |
| `podStatus` | `{ type: "k8s_resource", kind: "Pod", selector: string }` | k8s-vessel | Running pod state |
| `serviceEndpoint` | `{ type: "k8s_resource", kind: "Service", name: string }` | k8s-vessel | Service endpoint |
| `healthMetrics` | `{ type: "prometheus_query", query: string }` | metrics-vessel | Error rate, latency |

#### 3. Historical Impulses (Learning from Past)

| Impulse Type | Pointer Shape | Resolver | Example |
|--------------|---------------|----------|---------|
| `activityExecutionTrace` | `{ type: "trace", traceId: string }` | backend | Previous deployment execution |
| `activityMetrics` | `{ type: "metrics", activityId: string, window: string }` | backend | Success rate of `deploy-canary` |
| `compositionPatterns` | `{ type: "patterns", goalCategory: string }` | backend | Common next steps after deployment |

### Where Resolvers Live

```
┌─────────────────────────────────────────────────────────────┐
│ FILESYSTEM VESSEL (codebase, repos/deployment)             │
│   Resolvers: file, git                                      │
│   Impulses: gitCommit, deploymentSpec, helmValues           │
│   Activities: validate-manifests, generate-config           │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    (provides impulses)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ K8S-VESSEL (Deployment controller pod in cluster)           │
│   Resolvers: k8s_resource, helm, kubectl                    │
│   Impulses: deploymentState, podStatus, serviceEndpoint     │
│   Activities: deploy-canary, rollback, health-check         │
│   Runs: In-cluster as Deployment with K8s ServiceAccount    │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    (records traces)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ BACKEND (metabob-activity-api)                              │
│   Resolvers: trace, metrics, patterns                       │
│   Impulses: activityExecutionTrace, activityMetrics         │
│   Activities: NONE (backend doesn't execute activities)     │
│   Purpose: Trace store + Thompson Sampling                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
                (recommends activities via Thompson Sampling)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ METRICS-VESSEL (Prometheus/Grafana)                         │
│   Resolvers: prometheus_query, grafana_dashboard            │
│   Impulses: healthMetrics, errorRate, latency               │
│   Activities: validate-health, analyze-metrics              │
└─────────────────────────────────────────────────────────────┘
```

**Key Insight:** Each vessel resolves impulses for data it has access to. No vessel tries to be universal. No centralized registry needed.

---

## Part 3: Component Definitions

### K8s-Vessel (New Component)

**What it IS:**
- A Kubernetes Deployment running in the cluster
- Has K8s ServiceAccount with RBAC permissions
- Implements impulse resolvers for K8s resources
- Executes deployment-related activities
- Records traces to backend for learning

**What it IS NOT:**
- A general-purpose MiniBob instance
- A centralized orchestrator
- A service registry
- A task queue manager

**Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: k8s-vessel
  namespace: activity-system
spec:
  replicas: 3  # For high availability
  selector:
    matchLabels:
      app: k8s-vessel
  template:
    metadata:
      labels:
        app: k8s-vessel
    spec:
      serviceAccountName: k8s-vessel-sa
      containers:
      - name: vessel
        image: k8s-vessel:v1.0.0
        env:
        - name: METABOB_API_KEY
          valueFrom:
            secretKeyRef:
              name: k8s-vessel-secret
              key: api-key
        - name: METABOB_ENDPOINT
          value: "http://metabob-activity-api.activity-system.svc.cluster.local:8080"
```

**RBAC (Least Privilege):**
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: k8s-vessel-role
rules:
  # Read cluster state
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods", "services"]
    verbs: ["get", "list", "watch"]

  # Update managed deployments only
  - apiGroups: ["apps"]
    resources: ["deployments"]
    resourceNames: ["minibob", "metabob-activity-api", "activity-dashboard"]
    verbs: ["update", "patch"]

  # Leader election
  - apiGroups: ["coordination.k8s.io"]
    resources: ["leases"]
    resourceNames: ["k8s-vessel-leader"]
    verbs: ["get", "create", "update"]
```

**Capabilities:**
```typescript
{
  impulseResolvers: [
    { type: "k8s_resource", shapes: ["Deployment", "Pod", "Service"] },
    { type: "helm", shapes: ["Release", "Chart"] }
  ],
  activities: [
    "deploy-canary",
    "deploy-production",
    "rollback-deployment",
    "validate-health",
    "scale-deployment"
  ]
}
```

### Backend (No Changes Needed)

**What it IS:**
- Trace store: Receives execution traces from all vessels
- Pattern learner: Thompson Sampling, relevance scoring
- Historical data source: Resolves trace-type impulses

**What it IS NOT:**
- Vessel registry
- Task queue
- Universal resolver
- Deployment orchestrator

**API (Already Correct):**
```
POST /v2/traces
  Store execution trace from vessel

POST /v2/traces/query
  Resolve trace-type impulse pointers

POST /v2/activities/recommend
  Thompson-sampled activity recommendation
```

**NO vessel registry endpoints needed.**
**NO boredom queue endpoints needed.**

### Filesystem Vessel (repos/deployment)

**What it IS:**
- Git repository with deployment manifests
- Provides configuration impulses
- Validates manifest syntax
- Does NOT execute deployments

**What it IS NOT:**
- A runtime environment
- Connected to Kubernetes
- A deployment controller

**Capabilities:**
```typescript
{
  impulseResolvers: [
    { type: "file", patterns: ["*.yaml", "*.values.yaml"] },
    { type: "git", operations: ["log", "diff", "status"] }
  ],
  activities: [
    "validate-manifests",
    "generate-helmfile",
    "lint-kubernetes-yaml"
  ]
}
```

---

## Part 4: Deployment Activities (Corrected)

### Activity: deploy-canary

**Structure (Following Foundation):**
```typescript
{
  id: "deploy-canary",
  name: "Deploy to Canary Environment",

  // Input impulse requirements
  inputSchema: {
    required: [
      { shape: "gitCommit", description: "Commit to deploy" },
      { shape: "containerImage", description: "Built container image" },
      { shape: "deploymentSpec", description: "K8s manifest" }
    ],
    optional: [
      { shape: "activityMetrics", description: "Historical success rate" },
      { shape: "deploymentState", description: "Current cluster state" }
    ]
  },

  // Output impulse guarantees
  outputSchema: {
    produces: [
      { shape: "deploymentResult", description: "Deployment outcome" },
      { shape: "healthMetrics", description: "Post-deployment health" },
      { shape: "podStatus", description: "Running pod state" }
    ]
  },

  // Execution steps (resolver-based)
  tasks: [
    {
      id: "validate-inputs",
      resolver: "k8s_resource",  // K8s-vessel resolver
      description: "Verify deployment spec is valid"
    },
    {
      id: "check-current-state",
      resolver: "k8s_resource",
      description: "Get current deployment state for rollback"
    },
    {
      id: "apply-manifest",
      resolver: "helm",  // K8s-vessel resolver
      description: "Apply Helm chart to cluster"
    },
    {
      id: "wait-for-rollout",
      resolver: "k8s_resource",
      description: "Wait for deployment to become ready"
    },
    {
      id: "validate-health",
      resolver: "prometheus_query",  // Metrics-vessel resolver
      description: "Check health endpoints and metrics"
    }
  ],

  // Validation
  validation: {
    requiredOutputs: ["deploymentResult", "healthMetrics"],
    successCriteria: {
      "deploymentResult.status": "success",
      "healthMetrics.errorRate": { lt: 0.01 }
    }
  },

  // Thompson Sampling state (computed from traces)
  thompson: {
    alpha: 45,  // 45 successes
    beta: 3     // 3 failures
  }
}
```

**Key Differences from Imperative Script:**
1. **Declares input/output shapes** - Not hardcoded commands
2. **Uses resolvers** - Not bash scripts
3. **Measurable outcomes** - Success criteria defined
4. **Learning-enabled** - Thompson Sampling tracks performance

### Activity: validate-canary-health

```typescript
{
  id: "validate-canary-health",
  name: "Validate Canary Deployment Health",

  inputSchema: {
    required: [
      { shape: "serviceEndpoint", description: "Canary service URL" },
      { shape: "healthMetrics", description: "Current metrics" }
    ],
    optional: [
      { shape: "activityExecutionTrace", description: "Previous validation traces" }
    ]
  },

  outputSchema: {
    produces: [
      { shape: "validationResult", description: "Health check outcome" },
      { shape: "promotionDecision", description: "Promote or rollback" }
    ]
  },

  tasks: [
    {
      id: "http-health-check",
      resolver: "http",  // HTTP resolver
      description: "Check /health endpoint returns 200"
    },
    {
      id: "metrics-validation",
      resolver: "prometheus_query",
      description: "Verify error rate < 1% for 15 minutes"
    },
    {
      id: "decide-promotion",
      resolver: "llm",  // LLM for reasoning about multiple signals
      description: "Analyze health signals and recommend action"
    }
  ],

  validation: {
    successCriteria: {
      "validationResult.healthCheck": "pass",
      "validationResult.metricsCheck": "pass"
    }
  }
}
```

---

## Part 5: Pull-Based Reconciliation Loop

### How It Works (Corrected)

```typescript
// Runs in k8s-vessel deployment
async function reconciliationLoop() {
  while (true) {
    try {
      // 1. CREATE INPUT IMPULSES (don't load yet)
      const impulses = [
        {
          id: "gitCommit",
          pointer: { type: "git", repo: DEPLOYMENT_REPO, branch: "main" },
          budget: 1000,
          loaded: false
        },
        {
          id: "currentDeployment",
          pointer: { type: "k8s_resource", kind: "Deployment", name: "minibob", namespace: "activity-system" },
          budget: 2000,
          loaded: false
        },
        {
          id: "recentTraces",
          pointer: { type: "recentExecutions", activityId: "deploy-canary", limit: 5 },
          budget: 5000,
          loaded: false
        }
      ]

      // 2. ASK BACKEND: "What activity matches these impulse shapes?"
      const recommendation = await backend.recommendActivity({
        goal: "deploy-canary",
        availableImpulses: impulses.map(i => ({ shape: i.id, metadata: i.pointer }))
      })

      // Backend responds with Thompson-sampled activity:
      // { activityId: "deploy-canary", variantId: "deploy-canary:v3", score: 0.94 }

      // 3. LOAD IMPULSES (now that we know which activity to run)
      const loadedImpulses = await Promise.all(
        impulses.map(imp => resolveImpulse(imp))
      )

      // 4. CHECK IF DEPLOYMENT NEEDED
      const gitCommitContent = loadedImpulses.find(i => i.id === "gitCommit").content
      const currentDeploymentContent = loadedImpulses.find(i => i.id === "currentDeployment").content

      if (gitCommitContent.sha !== currentDeploymentContent.image.split(':')[1]) {
        // Deployment needed - execute activity
        const trace = await executeActivity(recommendation.activityId, loadedImpulses)

        // 5. RECORD TRACE FOR LEARNING
        await backend.storeTrace(trace)
      }

    } catch (error) {
      await recordFailure(error)
    }

    // 6. WAIT FOR NEXT INTERVAL
    await sleep(RECONCILIATION_INTERVAL) // 5 minutes
  }
}
```

**Key Differences from Previous Design:**
1. **No vessel registry lookup** - Vessel knows what it can do
2. **No boredom queue** - Uses Thompson Sampling recommendation
3. **Impulses first, resolution later** - Metadata-driven decision making
4. **Activity-centric** - All work through activities, not scripts
5. **Learning-enabled** - Every execution traced and learned from

### Leader Election (For HA)

```typescript
import { LeaderElection } from '@kubernetes/client-node'

const leaderElection = new LeaderElection({
  leaseName: 'k8s-vessel-leader',
  leaseNamespace: 'activity-system',
  leaseDuration: 15,
  renewDeadline: 10,
  retryPeriod: 2,

  onStartedLeading: () => {
    console.log('[k8s-vessel] Became leader, starting reconciliation')
    reconciliationLoop()
  },

  onStoppedLeading: () => {
    console.log('[k8s-vessel] Lost leadership, stopping reconciliation')
  }
})

leaderElection.run()
```

---

## Part 6: Boredom System (Corrected)

### What Boredom Actually Is

> "Boredom is when a vessel has no active user goals and asks the backend: 'Given my current context, what should I work on?'"

### Corrected Flow

```typescript
// Runs in ANY vessel (MiniBob, k8s-vessel, etc.) when idle
async function checkBoredom() {
  // 1. DETECT IDLE STATE (local to vessel)
  if (timeSinceLastGoal() < IDLE_THRESHOLD) {
    return // Still working on user goals
  }

  // 2. CREATE CONTEXT IMPULSES (what's available locally)
  const contextImpulses = [
    {
      id: "recentFailures",
      pointer: { type: "recentExecutions", status: "failed", limit: 10 },
      metadata: { shape: "activityExecutionTrace", summary: "Recent failures to debug" }
    },
    {
      id: "slowActivities",
      pointer: { type: "metrics", sortBy: "duration_ms", limit: 5 },
      metadata: { shape: "activityMetrics", summary: "Activities that could be optimized" }
    },
    {
      id: "localFiles",
      pointer: { type: "file", pattern: "**/*.ts" },
      metadata: { shape: "file", summary: "Local codebase" }
    }
  ]

  // 3. ASK BACKEND: "What should I work on given this context?"
  const recommendation = await backend.recommendActivity({
    goal: "autonomous-improvement",  // Boredom goal category
    availableImpulses: contextImpulses.map(i => i.metadata),
    vesselCapabilities: this.getCapabilities()  // What CAN this vessel do
  })

  // Backend responds with Thompson-sampled activity:
  // { activityId: "debug-failed-execution", variantId: "...", score: 0.87 }

  // 4. EXECUTE RECOMMENDED ACTIVITY
  const loadedImpulses = await loadImpulses(contextImpulses)
  const trace = await executeActivity(recommendation.activityId, loadedImpulses)

  // 5. RECORD TRACE
  await backend.storeTrace(trace)
}
```

**Key Differences:**
1. **NO centralized queue** - Backend recommends based on Thompson Sampling
2. **Context-aware** - Vessel provides its available impulses
3. **Capability-aware** - Backend only recommends activities vessel CAN execute
4. **Learning-driven** - Thompson Sampling improves recommendations over time

### Backend Recommendation Logic

```typescript
// In metabob-activity-api
async function recommendActivity(request: {
  goal: string
  availableImpulses: ImpulseMetadata[]
  vesselCapabilities?: string[]
}) {
  // 1. FIND MATCHING ACTIVITIES
  const availableShapes = request.availableImpulses.map(i => i.shape)

  const candidates = await db.query(`
    SELECT * FROM activity_template
    WHERE input_shapes ALLINSIDE $availableShapes
    ${request.vesselCapabilities ?
      'AND activities ANYINSIDE $capabilities' : ''}
  `, {
    availableShapes,
    capabilities: request.vesselCapabilities || []
  })

  // 2. THOMPSON SAMPLING
  const selected = thompsonSample(candidates.map(c => ({
    id: c.id,
    alpha: c.thompson.alpha,
    beta: c.thompson.beta
  })))

  return {
    activityId: selected.id,
    variantId: selected.variant_id,
    score: selected.alpha / (selected.alpha + selected.beta)
  }
}
```

**NO queue needed.** Backend just recommends based on:
- Input shapes available
- Vessel capabilities
- Historical success rates (Thompson Sampling)

---

## Part 7: Implementation Roadmap

### Phase 1: Create K8s-Vessel

1. **New repository:** `repos/k8s-vessel/`
2. **Implement impulse resolvers:**
   - `k8s_resource`: Get/Update K8s resources
   - `helm`: Helm operations
3. **Implement activities:**
   - `deploy-canary`
   - `validate-health`
   - `rollback-deployment`
4. **Deploy in cluster** with RBAC
5. **Test reconciliation loop** with dummy deployments

### Phase 2: Update Backend (Remove Violations)

1. **Remove vessel registry routes:**
   - Delete `src/routes/vessel-registry.ts`
   - Remove `/v2/vessels/*` endpoints
2. **Remove boredom queue routes:**
   - Delete `src/routes/boredom.ts` (queue endpoints)
   - Keep recommendation logic in activities route
3. **Keep only foundation-aligned endpoints:**
   - `POST /v2/traces`
   - `POST /v2/traces/query`
   - `POST /v2/activities/recommend`

### Phase 3: Update MiniBob (Use Recommendation, Not Queue)

1. **Replace boredom queue polling** with recommendation:
   ```typescript
   // OLD (violates foundation)
   const task = await backend.fetchBoredomTask()

   // NEW (foundation-aligned)
   const recommendation = await backend.recommendActivity({
     goal: "autonomous-improvement",
     availableImpulses: getLocalContext()
   })
   ```
2. **Remove vessel registration** - MiniBob doesn't need to register
3. **Keep local waking activities** - Those are fine

### Phase 4: Define Deployment Impulse Types

1. **Document impulse types** in `docs/impulse-types/deployment.md`:
   - `gitCommit`
   - `containerImage`
   - `deploymentSpec`
   - `deploymentState`
   - `healthMetrics`
2. **Implement resolvers** in k8s-vessel
3. **Test impulse resolution** independently

### Phase 5: Create Deployment Activities

1. **Define activity templates:**
   - `deploy-canary.json`
   - `deploy-production.json`
   - `validate-health.json`
   - `rollback-deployment.json`
2. **Test activities** in isolation
3. **Record traces** for Thompson Sampling bootstrap

### Phase 6: Integration Testing

1. **End-to-end deployment flow:**
   - Push to `dev` branch
   - k8s-vessel detects change
   - Executes `deploy-canary` activity
   - Records trace
   - Backend learns from trace
2. **Validate learning loop:**
   - Multiple deployments improve success rate
   - Thompson Sampling selects best variants

---

## Part 8: What Each Component IS and IS NOT

### K8s-Vessel

**IS:**
- A Kubernetes Deployment running in the cluster
- An impulse resolver for K8s resources
- An activity executor for deployments
- A trace generator for learning

**IS NOT:**
- A general-purpose MiniBob instance
- A centralized orchestrator
- A service registry
- A vessel discovery system

**Analogy:** Like a worker node in a factory. It has specific tools (K8s API), executes specific activities (deployments), and reports results. It doesn't coordinate other workers or maintain a directory of all workers.

### Backend (metabob-activity-api)

**IS:**
- A trace store (records what happened)
- A pattern learner (Thompson Sampling, relevance scoring)
- A historical data source (resolves trace-type impulses)

**IS NOT:**
- A vessel registry
- A task queue
- A universal resolver
- A deployment orchestrator
- A service discovery system

**Analogy:** Like a library that stores books (traces) and helps you find relevant ones. It doesn't tell you what to do, just provides data about what worked in the past.

### MiniBob

**IS:**
- A lightweight vessel for code development
- An impulse resolver for files and memos
- An activity executor for coding tasks
- A trace generator for learning

**IS NOT:**
- The only vessel in the system
- A deployment controller
- A Kubernetes operator
- A centralized orchestrator

**Analogy:** Like a programmer with an IDE. It can read files, write code, run tests, commit changes. It cannot deploy to Kubernetes (wrong tools/access).

### repos/deployment (Filesystem Vessel)

**IS:**
- A Git repository with deployment manifests
- An impulse source for configuration data
- A validation environment for manifest syntax

**IS NOT:**
- A runtime environment
- Connected to Kubernetes
- A deployment controller
- An execution environment

**Analogy:** Like a filing cabinet that stores blueprints. You can read the blueprints, validate their syntax, but you need a construction crew (k8s-vessel) to actually build something.

---

## Part 9: Migration Path

### Immediate Actions (Breaking Changes)

1. **Stop using vessel registry:**
   - Remove registration calls from MiniBob
   - Remove registry endpoints from backend
   - Delete `vessel` table from SurrealDB

2. **Stop using boredom queue API:**
   - MiniBob uses Thompson Sampling recommendation instead
   - Remove `/v2/activities/boredom/*` endpoints
   - Keep local queue file option for development

3. **Document the change:**
   - Update `CLAUDE.md` to explain new pattern
   - Create migration guide for other vessels

### Gradual Additions (Non-Breaking)

1. **Create k8s-vessel incrementally:**
   - Start with basic reconciliation loop
   - Add impulse resolvers one by one
   - Test each activity independently

2. **Define impulse types as needed:**
   - Document each new type in `docs/impulse-types/`
   - Implement resolvers in appropriate vessels

3. **Convert deployment scripts to activities:**
   - Identify manual deployment steps
   - Convert to activity templates
   - Bootstrap Thompson Sampling with historical data

---

## Conclusion

The **pull-based deployment architecture does NOT require special infrastructure** - it's just the impulse-activity model applied to deployment:

1. **Impulses** represent deployment configuration and state
2. **Activities** describe deployment transformations
3. **Resolvers** live where data lives (K8s vessel has K8s access)
4. **Backend** stores traces and recommends activities
5. **Learning** improves deployment success over time

**No vessel registry needed.**
**No boredom queue API needed.**
**No special orchestration needed.**

Just vessels, impulses, activities, and Thompson Sampling - the same foundation that powers everything else in the system.

---

## References

- [IMPULSE_ACTIVITY_FOUNDATION.md](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md) - Canonical model
- [PULL_BASED_DEPLOYMENT_RESEARCH.md](repos/minibob/PULL_BASED_DEPLOYMENT_RESEARCH.md) - Production patterns
- [CLAUDE.md](CLAUDE.md) - Development philosophy
