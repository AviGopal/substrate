# Deployment Architecture Diagram

**Visual reference for the corrected pull-based deployment architecture**

---

## The Complete System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         IMPULSE-ACTIVITY SYSTEM                         │
│                                                                          │
│  ┌────────────────────┐        ┌────────────────────┐                  │
│  │ Filesystem Vessel  │        │ K8s-Vessel (NEW)   │                  │
│  │ (repos/deployment) │        │ (in-cluster pod)   │                  │
│  │                    │        │                    │                  │
│  │ Resolvers:         │        │ Resolvers:         │                  │
│  │ • file             │        │ • k8s_resource     │                  │
│  │ • git              │        │ • helm             │                  │
│  │                    │        │ • kubectl          │                  │
│  │ Impulses:          │        │                    │                  │
│  │ • gitCommit        │        │ Impulses:          │                  │
│  │ • deploymentSpec   │        │ • deploymentState  │                  │
│  │ • helmValues       │        │ • podStatus        │                  │
│  │                    │        │ • serviceEndpoint  │                  │
│  │ Activities:        │        │                    │                  │
│  │ • validate-yaml    │        │ Activities:        │                  │
│  │ • generate-config  │        │ • deploy-canary    │                  │
│  └────────────────────┘        │ • validate-health  │                  │
│                                 │ • rollback         │                  │
│                                 │ • scale-deployment │                  │
│                                 └────────────────────┘                  │
│                                          ↓                               │
│                                    (records traces)                      │
│                                          ↓                               │
│                                 ┌────────────────────┐                  │
│                                 │ Backend            │                  │
│                                 │ (activity-api)     │                  │
│                                 │                    │                  │
│                                 │ Resolvers:         │                  │
│                                 │ • trace            │                  │
│                                 │ • metrics          │                  │
│                                 │ • patterns         │                  │
│                                 │                    │                  │
│                                 │ Endpoints:         │                  │
│                                 │ • POST /v2/traces  │                  │
│                                 │ • POST /traces/query│                 │
│                                 │ • POST /recommend  │                  │
│                                 │                    │                  │
│                                 │ Learning:          │                  │
│                                 │ • Thompson Sampling│                  │
│                                 │ • Relevance scoring│                  │
│                                 │ • Pattern mining   │                  │
│                                 └────────────────────┘                  │
│                                          ↑                               │
│                                (asks for recommendations)               │
│                                          ↑                               │
│  ┌────────────────────┐        ┌────────────────────┐                  │
│  │ MiniBob            │        │ Metrics-Vessel     │                  │
│  │ (dev workstation)  │        │ (Prometheus)       │                  │
│  │                    │        │                    │                  │
│  │ Resolvers:         │        │ Resolvers:         │                  │
│  │ • file             │        │ • prometheus_query │                  │
│  │ • memo             │        │ • grafana_dash     │                  │
│  │ • git              │        │                    │                  │
│  │ • llm              │        │ Impulses:          │                  │
│  │                    │        │ • healthMetrics    │                  │
│  │ Activities:        │        │ • errorRate        │                  │
│  │ • fix-bug          │        │ • latency          │                  │
│  │ • add-feature      │        │                    │                  │
│  │ • refactor-code    │        │ Activities:        │                  │
│  └────────────────────┘        │ • analyze-metrics  │                  │
│                                 │ • alert-check      │                  │
│                                 └────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Reconciliation Loop (K8s-Vessel)

```
┌─────────────────────────────────────────────────────────────────┐
│                     K8s-Vessel Main Loop                        │
└─────────────────────────────────────────────────────────────────┘
           │
           ↓
    ┌──────────────┐
    │ Wait 5 min   │ ← Reconciliation interval (configurable)
    └──────────────┘
           │
           ↓
    ┌──────────────────────────────────────────┐
    │ 1. CREATE INPUT IMPULSES (metadata only) │
    │                                           │
    │ impulses = [                              │
    │   { id: "gitCommit", pointer: {...} }    │
    │   { id: "deploymentState", pointer: {...}}│
    │   { id: "metrics", pointer: {...} }      │
    │ ]                                         │
    └──────────────────────────────────────────┘
           │
           ↓
    ┌──────────────────────────────────────────┐
    │ 2. ASK BACKEND FOR RECOMMENDATION        │
    │                                           │
    │ recommendation = backend.recommend({      │
    │   goal: "deploy-canary",                  │
    │   availableImpulses: metadata             │
    │ })                                        │
    │                                           │
    │ Backend uses Thompson Sampling:           │
    │ → "deploy-canary:v3" (α=45, β=3, 94%)   │
    └──────────────────────────────────────────┘
           │
           ↓
    ┌──────────────────────────────────────────┐
    │ 3. LOAD IMPULSES (content resolution)    │
    │                                           │
    │ loadedImpulses = await Promise.all(       │
    │   impulses.map(resolveImpulse)           │
    │ )                                         │
    └──────────────────────────────────────────┘
           │
           ↓
    ┌──────────────────────────────────────────┐
    │ 4. CHECK IF DEPLOYMENT NEEDED            │
    │                                           │
    │ gitSha = impulse("gitCommit").content.sha │
    │ currentSha = impulse("deploymentState")   │
    │              .content.image.split(':')[1] │
    │                                           │
    │ if (gitSha !== currentSha) {             │
    │   needsUpdate = true                      │
    │ }                                         │
    └──────────────────────────────────────────┘
           │
           ↓
    ┌──────────────────────────────────────────┐
    │ 5. EXECUTE ACTIVITY (if needed)          │
    │                                           │
    │ trace = await executeActivity(            │
    │   activityId: "deploy-canary",           │
    │   impulses: loadedImpulses                │
    │ )                                         │
    │                                           │
    │ Activity runs tasks:                      │
    │ → validate-inputs (k8s_resource resolver) │
    │ → check-current-state                     │
    │ → apply-manifest (helm resolver)          │
    │ → wait-for-rollout                        │
    │ → validate-health (prometheus resolver)   │
    └──────────────────────────────────────────┘
           │
           ↓
    ┌──────────────────────────────────────────┐
    │ 6. RECORD TRACE FOR LEARNING             │
    │                                           │
    │ await backend.storeTrace({                │
    │   traceId: "exec-abc123",                │
    │   activityId: "deploy-canary",           │
    │   inputImpulses: [...],                   │
    │   tasks: [...],                           │
    │   outputImpulses: [...],                  │
    │   outcome: { success: true, duration, cost}│
    │ })                                        │
    │                                           │
    │ Backend updates Thompson Sampling:        │
    │ → α = 45 + 1 = 46 (success count)        │
    └──────────────────────────────────────────┘
           │
           └────────────────────────────────────┐
                                                 │
                                          (loop back)
```

---

## Boredom System (Any Vessel)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vessel Idle Detection                     │
└─────────────────────────────────────────────────────────────────┘
           │
           ↓
    ┌──────────────┐
    │ Check idle   │ ← timeSinceLastGoal() > IDLE_THRESHOLD
    └──────────────┘
           │
           ↓ (if idle)
    ┌──────────────────────────────────────────┐
    │ 1. CREATE CONTEXT IMPULSES               │
    │                                           │
    │ contextImpulses = [                       │
    │   {                                       │
    │     id: "recentFailures",                │
    │     pointer: { type: "recentExecutions",  │
    │                status: "failed" },        │
    │     metadata: {                           │
    │       shape: "activityExecutionTrace",   │
    │       summary: "10 recent failures"      │
    │     }                                     │
    │   },                                      │
    │   {                                       │
    │     id: "slowActivities",                │
    │     pointer: { type: "metrics",          │
    │                sortBy: "duration_ms" },   │
    │     metadata: {                           │
    │       shape: "activityMetrics",          │
    │       summary: "5 slowest activities"    │
    │     }                                     │
    │   }                                       │
    │ ]                                         │
    └──────────────────────────────────────────┘
           │
           ↓
    ┌──────────────────────────────────────────┐
    │ 2. ASK BACKEND FOR RECOMMENDATION        │
    │                                           │
    │ recommendation = backend.recommend({      │
    │   goal: "autonomous-improvement",         │
    │   availableImpulses: contextImpulses,     │
    │   vesselCapabilities: [                   │
    │     "debug-execution",                    │
    │     "optimize-activity",                  │
    │     "refactor-template"                   │
    │   ]                                       │
    │ })                                        │
    │                                           │
    │ Backend matches:                          │
    │ → Input shapes: [executionTrace, metrics] │
    │ → Vessel capabilities: [debug, optimize]  │
    │ → Thompson Sampling selects:              │
    │   "debug-failed-execution:v2" (α=42, β=5)│
    └──────────────────────────────────────────┘
           │
           ↓
    ┌──────────────────────────────────────────┐
    │ 3. LOAD IMPULSES                         │
    │                                           │
    │ loadedImpulses = await loadImpulses(...)  │
    └──────────────────────────────────────────┘
           │
           ↓
    ┌──────────────────────────────────────────┐
    │ 4. EXECUTE RECOMMENDED ACTIVITY          │
    │                                           │
    │ trace = await executeActivity(            │
    │   "debug-failed-execution",              │
    │   loadedImpulses                          │
    │ )                                         │
    └──────────────────────────────────────────┘
           │
           ↓
    ┌──────────────────────────────────────────┐
    │ 5. RECORD TRACE                          │
    │                                           │
    │ await backend.storeTrace(trace)           │
    │                                           │
    │ Learning happens:                         │
    │ → If successful: α++                      │
    │ → If failed: β++                          │
    │ → Next time, recommendation improves      │
    └──────────────────────────────────────────┘
           │
           └────────────────────────────────────┐
                                                 │
                                    (check idle again)
```

**Key Insight:** No centralized queue! Each vessel:
1. Detects its own idle state (local)
2. Provides its own context (what it can see)
3. Asks backend for recommendation (Thompson Sampling)
4. Executes recommended activity
5. Records trace for learning

---

## Data Flow: Deployment Activity

```
INPUT IMPULSES                    ACTIVITY                  OUTPUT IMPULSES
┌─────────────────┐              ┌────────────────┐        ┌─────────────────┐
│ gitCommit       │─────────────→│                │        │                 │
│ (from git repo) │              │                │        │ deploymentResult│
└─────────────────┘              │                │        │ (success/fail)  │
                                  │  deploy-canary │───────→└─────────────────┘
┌─────────────────┐              │                │
│ containerImage  │─────────────→│                │        ┌─────────────────┐
│ (from registry) │              │                │        │ healthMetrics   │
└─────────────────┘              │                │───────→│ (error rate,    │
                                  │                │        │  latency)       │
┌─────────────────┐              │                │        └─────────────────┘
│ deploymentSpec  │─────────────→│                │
│ (from fs)       │              │                │        ┌─────────────────┐
└─────────────────┘              │                │        │ podStatus       │
                                  │                │───────→│ (running pods)  │
┌─────────────────┐              │                │        └─────────────────┘
│ activityMetrics │─────────────→│                │
│ (from backend)  │   (optional) │                │
└─────────────────┘              └────────────────┘
                                          │
                                          │ (each task uses resolver)
                                          ↓
                          ┌───────────────────────────────┐
                          │ Task 1: validate-inputs       │
                          │ Resolver: k8s_resource        │
                          └───────────────────────────────┘
                                          ↓
                          ┌───────────────────────────────┐
                          │ Task 2: check-current-state   │
                          │ Resolver: k8s_resource        │
                          └───────────────────────────────┘
                                          ↓
                          ┌───────────────────────────────┐
                          │ Task 3: apply-manifest        │
                          │ Resolver: helm                │
                          └───────────────────────────────┘
                                          ↓
                          ┌───────────────────────────────┐
                          │ Task 4: wait-for-rollout      │
                          │ Resolver: k8s_resource        │
                          └───────────────────────────────┘
                                          ↓
                          ┌───────────────────────────────┐
                          │ Task 5: validate-health       │
                          │ Resolver: prometheus_query    │
                          └───────────────────────────────┘
                                          │
                                          ↓
                                 ┌─────────────────┐
                                 │ TRACE RECORDED  │
                                 │                 │
                                 │ • Input impulses│
                                 │ • Task results  │
                                 │ • Output impulses│
                                 │ • State transition│
                                 │ • Outcome       │
                                 └─────────────────┘
                                          │
                                          ↓
                                 ┌─────────────────┐
                                 │ BACKEND LEARNS  │
                                 │                 │
                                 │ Thompson Sampling:│
                                 │ α = 45 → 46     │
                                 │ β = 3           │
                                 │ Score: 94%→94%  │
                                 └─────────────────┘
```

---

## Comparison: OLD vs NEW

### OLD Architecture (Violated Foundation) ❌

```
┌─────────────────────────────────────────────────────────┐
│                    BACKEND (WRONG)                       │
│                                                          │
│ ┌──────────────────────────┐                            │
│ │ Vessel Registry          │ ← Central service discovery│
│ │ POST /v2/vessels/register│                            │
│ │ GET /v2/vessels/discover │                            │
│ └──────────────────────────┘                            │
│                ↑                                         │
│        (vessels register here)                          │
│                                                          │
│ ┌──────────────────────────┐                            │
│ │ Boredom Queue            │ ← Centralized task queue   │
│ │ POST /boredom/enqueue    │                            │
│ │ GET /boredom/queue       │                            │
│ └──────────────────────────┘                            │
│                ↑                                         │
│        (vessels poll for tasks)                         │
│                                                          │
│ ┌──────────────────────────┐                            │
│ │ Trace Store              │ ← Only correct part        │
│ │ POST /v2/traces          │                            │
│ └──────────────────────────┘                            │
└─────────────────────────────────────────────────────────┘
```

**Problems:**
- Backend acts as universal resolver
- Centralized coordination
- Vessels depend on backend for work assignment
- No Thompson Sampling for boredom tasks
- Backend stores live state (vessel registry)

---

### NEW Architecture (Foundation-Aligned) ✅

```
┌─────────────────────────────────────────────────────────┐
│                   BACKEND (CORRECT)                      │
│                                                          │
│ ┌──────────────────────────┐                            │
│ │ Trace Store              │ ← Store execution history  │
│ │ POST /v2/traces          │                            │
│ │ POST /v2/traces/query    │                            │
│ └──────────────────────────┘                            │
│                                                          │
│ ┌──────────────────────────┐                            │
│ │ Thompson Sampling        │ ← Learning algorithm       │
│ │ POST /activities/recommend│                           │
│ └──────────────────────────┘                            │
│                ↑                                         │
│        (vessels ask for recommendations)                │
└─────────────────────────────────────────────────────────┘
                 ↑
                 │ (recommendation requests)
                 │
┌────────────────┴────────────────────────────────────────┐
│                    VESSELS                               │
│                                                          │
│  Each vessel:                                           │
│  • Detects idle state (local)                           │
│  • Creates context impulses (what it can see)           │
│  • Asks backend for recommendation (Thompson Sampling)  │
│  • Executes recommended activity                        │
│  • Records trace                                        │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ MiniBob  │  │K8s-Vessel│  │ Metrics  │             │
│  │          │  │          │  │ Vessel   │             │
│  │ (local)  │  │(in-cluster)│ (Prometheus)             │
│  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
```

**Improvements:**
- Backend only stores traces + recommends activities
- No centralized coordination
- Vessels autonomous (idle detection is local)
- Thompson Sampling for all work (including boredom)
- No live state tracking (only historical traces)

---

## Key Takeaway

**Everything is impulses → activities → traces.**

There's no special infrastructure for deployment. Just:
1. Define deployment impulse types
2. Create deployment activities
3. Implement resolvers where data lives (k8s-vessel)
4. Record traces for learning
5. Thompson Sampling improves over time

**No vessel registry. No boredom queue API. No special case.**

Just the foundational model applied consistently.
