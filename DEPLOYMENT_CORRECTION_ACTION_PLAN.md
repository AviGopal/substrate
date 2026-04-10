# Deployment Architecture Correction - Action Plan

**Date:** 2026-04-10
**Status:** Ready for Implementation
**Priority:** High (Foundational violations must be corrected)

---

## Executive Summary

We designed pull-based Kubernetes deployment with **5 major violations** of the foundational model. This action plan outlines the concrete steps to correct these violations.

**Estimated Timeline:** 6 weeks
**Required Resources:** 1-2 developers
**Risk Level:** Medium (breaking changes in Phase 1)

---

## Phase 1: Remove Violations (Week 1) - BREAKING CHANGES

**Priority:** Critical
**Risk:** Medium (breaking changes to backend API)

### 1.1 Delete Vessel Registry from Backend

**Files to delete:**
- `repos/metabob-activity-api/src/routes/vessel-registry.ts`
- `repos/metabob-activity-api/src/jobs/cleanup-vessels.ts`

**Files to update:**
- `repos/metabob-activity-api/src/index.ts` (remove route imports)
- `repos/metabob-activity-api/src/models/schemas.ts` (remove vessel table definition)

**Database changes:**
```sql
-- Delete vessel table
DELETE FROM vessel;
REMOVE TABLE vessel;
```

**Tests affected:**
- Delete `src/routes/vessel-registry.test.ts`
- Update integration tests that reference vessel endpoints

**Validation:**
```bash
# Ensure these endpoints return 404
curl -X POST http://localhost:8080/v2/vessels/register
curl -X GET http://localhost:8080/v2/vessels/discover
```

---

### 1.2 Delete Boredom Queue API from Backend

**Files to update:**
- `repos/metabob-activity-api/src/routes/boredom.ts`
  - **DELETE** queue management endpoints (`/enqueue`, `/queue`, `/next`, `/ack`)
  - **KEEP** local task generation logic (can be refactored later)

**Endpoints to remove:**
- `POST /v2/activities/boredom/enqueue`
- `GET /v2/activities/boredom/queue`
- `POST /v2/activities/boredom/next`
- `POST /v2/activities/boredom/ack`

**Files to update:**
- `repos/metabob-activity-api/src/index.ts` (remove route imports for deleted endpoints)
- `repos/metabob-activity-api/src/routes/ci.ts` (if it references boredom queue)

**Redis cleanup:**
```typescript
// Add migration to clean up old queue keys
const redis = getRedisClient()
const keys = await redis.keys('boredom:queue:*')
await redis.del(...keys)
const taskKeys = await redis.keys('boredom:task:*')
await redis.del(...taskKeys)
```

**Tests affected:**
- Delete queue-related tests in `src/routes/boredom.test.ts`
- Keep recommendation tests (if any)

**Validation:**
```bash
# Ensure these endpoints return 404
curl -X POST http://localhost:8080/v2/activities/boredom/enqueue
curl -X GET http://localhost:8080/v2/activities/boredom/queue
```

---

### 1.3 Update MiniBob to Use Recommendations

**Files to update:**
- `repos/minibob/src/boredom.ts`

**Changes required:**

**OLD CODE (DELETE):**
```typescript
// Polling centralized queue
async function fetchBoredomTask() {
  const response = await fetch(`${BACKEND_URL}/v2/activities/boredom/next`, {
    method: 'POST',
    headers: { 'Authorization': `ApiKey ${API_KEY}` }
  })
  return response.json()
}
```

**NEW CODE (ADD):**
```typescript
// Using Thompson Sampling recommendation
async function getRecommendation() {
  const contextImpulses = await getLocalContext()

  const response = await fetch(`${BACKEND_URL}/v2/activities/recommend`, {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      goal: 'autonomous-improvement',
      availableImpulses: contextImpulses.map(i => i.metadata),
      vesselCapabilities: getCapabilities()
    })
  })

  return response.json()
}

async function getLocalContext() {
  // Create context impulses from local state
  return [
    {
      id: 'recentFailures',
      pointer: { type: 'recentExecutions', status: 'failed', limit: 10 },
      metadata: {
        shape: 'activityExecutionTrace',
        summary: 'Recent failed executions'
      }
    },
    {
      id: 'slowActivities',
      pointer: { type: 'metrics', sortBy: 'duration_ms', limit: 5 },
      metadata: {
        shape: 'activityMetrics',
        summary: 'Slowest activities'
      }
    }
  ]
}

function getCapabilities() {
  // Return what this vessel can do
  return [
    'debug-failed-execution',
    'optimize-activity',
    'refactor-template',
    'fix-bug',
    'add-feature'
  ]
}
```

**Tests to update:**
- `repos/minibob/src/boredom.test.ts` (update to test recommendation flow)

**Validation:**
```bash
# Start MiniBob in bored mode and verify it uses recommendations
minibob --idle --verbose
# Should see log: "Asking backend for recommendation (Thompson Sampling)"
# Should NOT see: "Polling boredom queue"
```

---

### 1.4 Remove Vessel Registration from MiniBob

**Files to update:**
- `repos/minibob/src/mcp.ts` (if it has vessel registration)
- `repos/minibob/index.ts` (remove registration calls)

**Code to delete:**
```typescript
// Remove this entire function
async function registerVessel() {
  await fetch(`${BACKEND_URL}/v2/vessels/register`, {
    method: 'POST',
    body: JSON.stringify({
      vesselId: INSTANCE_ID,
      vesselName: 'minibob',
      endpoint: `http://localhost:${PORT}`,
      shapes: ['file', 'memo', 'git'],
      capabilities: [...]
    })
  })
}
```

**Validation:**
```bash
# Start MiniBob and check logs
minibob --verbose
# Should NOT see: "Registering vessel with backend"
```

---

### 1.5 Testing and Validation

**Test checklist:**
- [ ] All backend tests pass
- [ ] MiniBob starts without errors
- [ ] MiniBob can execute activities
- [ ] Boredom system works (uses recommendations)
- [ ] No references to deleted endpoints in logs
- [ ] CI/CD pipeline passes

**Manual validation:**
```bash
# 1. Backend health check
curl http://localhost:8080/health

# 2. List activities (should work)
curl -H "Authorization: ApiKey $API_KEY" \
  http://localhost:8080/v2/activities/templates

# 3. Get recommendation (should work)
curl -X POST -H "Authorization: ApiKey $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"goal":"test","availableImpulses":[]}' \
  http://localhost:8080/v2/activities/recommend

# 4. Vessel registry (should fail - 404)
curl -X POST http://localhost:8080/v2/vessels/register

# 5. Boredom queue (should fail - 404)
curl -X POST http://localhost:8080/v2/activities/boredom/enqueue
```

**Rollback plan:**
```bash
# If Phase 1 causes issues, revert commits:
git revert HEAD~3..HEAD  # Revert last 3 commits
git push origin dev
# Redeploy previous version to canary
```

---

## Phase 2: Create K8s-Vessel (Week 2-3)

**Priority:** High
**Risk:** Low (new component, doesn't affect existing system)

### 2.1 Repository Setup

**Create new repo:**
```bash
mkdir -p repos/k8s-vessel
cd repos/k8s-vessel
bun init
```

**Directory structure:**
```
repos/k8s-vessel/
├── src/
│   ├── index.ts              # Entry point
│   ├── types.ts              # Type definitions
│   ├── resolvers/
│   │   ├── k8s-resource.ts   # K8s API resolver
│   │   └── helm.ts           # Helm operations resolver
│   ├── activities/
│   │   ├── deploy-canary.ts  # Deployment activity
│   │   ├── validate-health.ts
│   │   └── rollback.ts
│   ├── reconciliation.ts     # Main reconciliation loop
│   └── leader-election.ts    # HA support
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

**Dependencies to add:**
```json
{
  "dependencies": {
    "@kubernetes/client-node": "^0.21.0",
    "hono": "^4.0.0",
    "ioredis": "^5.3.2"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "bun-types": "^1.0.0",
    "typescript": "^5.3.0"
  }
}
```

---

### 2.2 Implement K8s Resource Resolver

**File:** `repos/k8s-vessel/src/resolvers/k8s-resource.ts`

```typescript
import { KubeConfig, AppsV1Api, CoreV1Api } from '@kubernetes/client-node'
import type { ImpulseResolver, ImpulsePointer } from '../types'

interface K8sResourcePointer extends ImpulsePointer {
  type: 'k8s_resource'
  kind: string
  namespace: string
  name?: string
  selector?: Record<string, string>
}

export class K8sResourceResolver implements ImpulseResolver {
  private kubeConfig: KubeConfig
  private appsApi: AppsV1Api
  private coreApi: CoreV1Api

  constructor() {
    this.kubeConfig = new KubeConfig()
    this.kubeConfig.loadFromDefault()
    this.appsApi = this.kubeConfig.makeApiClient(AppsV1Api)
    this.coreApi = this.kubeConfig.makeApiClient(CoreV1Api)
  }

  async resolve(pointer: K8sResourcePointer): Promise<unknown> {
    const { kind, namespace, name, selector } = pointer

    switch (kind) {
      case 'Deployment':
        if (name) {
          const { body } = await this.appsApi.readNamespacedDeployment(name, namespace)
          return body
        } else {
          // List all deployments (with selector if provided)
          const { body } = await this.appsApi.listNamespacedDeployment(namespace)
          return body.items
        }

      case 'Pod':
        if (selector) {
          const labelSelector = Object.entries(selector)
            .map(([k, v]) => `${k}=${v}`)
            .join(',')
          const { body } = await this.coreApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, labelSelector)
          return body.items
        }
        break

      case 'Service':
        if (name) {
          const { body } = await this.coreApi.readNamespacedService(name, namespace)
          return body
        }
        break

      default:
        throw new Error(`Unsupported kind: ${kind}`)
    }
  }

  async getMetadata(pointer: K8sResourcePointer): Promise<ImpulseMetadata> {
    const resource = await this.resolve(pointer)

    // Extract metadata without loading full content
    if (Array.isArray(resource)) {
      return {
        shape: this.inferShape(pointer.kind),
        summary: `${resource.length} ${pointer.kind}(s)`,
        count: resource.length
      }
    } else {
      return {
        shape: this.inferShape(pointer.kind),
        summary: this.summarize(resource),
        name: resource.metadata.name,
        namespace: resource.metadata.namespace
      }
    }
  }

  private inferShape(kind: string): string {
    const shapeMap = {
      'Deployment': 'deploymentState',
      'Pod': 'podStatus',
      'Service': 'serviceEndpoint'
    }
    return shapeMap[kind] || kind.toLowerCase()
  }

  private summarize(resource: any): string {
    // Create human-readable summary
    if (resource.kind === 'Deployment') {
      const replicas = resource.status?.replicas || 0
      const available = resource.status?.availableReplicas || 0
      return `${resource.metadata.name}: ${available}/${replicas} replicas`
    }
    return `${resource.kind} ${resource.metadata.name}`
  }
}
```

---

### 2.3 Implement Reconciliation Loop

**File:** `repos/k8s-vessel/src/reconciliation.ts`

```typescript
import { K8sResourceResolver } from './resolvers/k8s-resource'

const RECONCILIATION_INTERVAL = 5 * 60 * 1000 // 5 minutes
const BACKEND_URL = process.env.METABOB_ENDPOINT || 'http://metabob-activity-api.activity-system.svc.cluster.local:8080'
const API_KEY = process.env.METABOB_API_KEY

export async function reconciliationLoop() {
  const k8sResolver = new K8sResourceResolver()

  while (true) {
    try {
      // 1. Create input impulses (metadata only)
      const impulses = [
        {
          id: 'gitCommit',
          pointer: {
            type: 'git',
            repo: 'https://github.com/MetabobProject/deployment.git',
            branch: 'main'
          },
          loaded: false
        },
        {
          id: 'currentDeployment',
          pointer: {
            type: 'k8s_resource',
            kind: 'Deployment',
            name: 'minibob',
            namespace: 'activity-system'
          },
          loaded: false
        }
      ]

      // 2. Ask backend for activity recommendation
      const recommendation = await fetch(`${BACKEND_URL}/v2/activities/recommend`, {
        method: 'POST',
        headers: {
          'Authorization': `ApiKey ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          goal: 'deploy-canary',
          availableImpulses: impulses.map(i => ({
            shape: i.id,
            metadata: i.pointer
          }))
        })
      }).then(r => r.json())

      console.log('[Reconciliation] Recommended activity:', recommendation.activityId)

      // 3. Load impulses
      const loadedImpulses = await Promise.all(
        impulses.map(async imp => ({
          ...imp,
          content: await resolveImpulse(imp, k8sResolver),
          loaded: true
        }))
      )

      // 4. Check if deployment needed
      const gitCommit = loadedImpulses.find(i => i.id === 'gitCommit').content
      const currentDeployment = loadedImpulses.find(i => i.id === 'currentDeployment').content

      const gitSha = gitCommit.sha
      const currentImage = currentDeployment.spec.template.spec.containers[0].image
      const currentSha = currentImage.split(':')[1]

      if (gitSha !== currentSha) {
        console.log('[Reconciliation] Deployment needed:', gitSha, '!=', currentSha)

        // 5. Execute activity
        const trace = await executeActivity(recommendation.activityId, loadedImpulses)

        // 6. Record trace
        await fetch(`${BACKEND_URL}/v2/traces`, {
          method: 'POST',
          headers: {
            'Authorization': `ApiKey ${API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(trace)
        })

        console.log('[Reconciliation] Deployment complete, trace recorded')
      } else {
        console.log('[Reconciliation] No deployment needed, current:', currentSha)
      }

    } catch (error) {
      console.error('[Reconciliation] Error:', error)
    }

    // 7. Wait for next interval
    await sleep(RECONCILIATION_INTERVAL)
  }
}

async function resolveImpulse(impulse: any, k8sResolver: K8sResourceResolver) {
  if (impulse.pointer.type === 'k8s_resource') {
    return k8sResolver.resolve(impulse.pointer)
  } else if (impulse.pointer.type === 'git') {
    // TODO: Implement git resolver
    return { sha: 'abc123', branch: 'main' }
  }
  throw new Error(`Unknown impulse type: ${impulse.pointer.type}`)
}

async function executeActivity(activityId: string, impulses: any[]) {
  // TODO: Implement activity execution
  return {
    traceId: `exec-${Date.now()}`,
    activityId,
    inputImpulses: impulses,
    tasks: [],
    outputImpulses: [],
    outcome: { success: true, duration_ms: 0, cost_usd: 0 }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

---

### 2.4 Kubernetes Deployment

**File:** `repos/k8s-vessel/k8s/deployment.yaml`

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: k8s-vessel-sa
  namespace: activity-system

---
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
    resourceNames: ["minibob", "metabob-activity-api"]
    verbs: ["update", "patch"]

  # Leader election
  - apiGroups: ["coordination.k8s.io"]
    resources: ["leases"]
    resourceNames: ["k8s-vessel-leader"]
    verbs: ["get", "create", "update"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: k8s-vessel-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: k8s-vessel-role
subjects:
  - kind: ServiceAccount
    name: k8s-vessel-sa
    namespace: activity-system

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: k8s-vessel
  namespace: activity-system
spec:
  replicas: 3
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
        image: k8s-vessel:v0.1.0
        env:
        - name: METABOB_API_KEY
          valueFrom:
            secretKeyRef:
              name: k8s-vessel-secret
              key: api-key
        - name: METABOB_ENDPOINT
          value: "http://metabob-activity-api.activity-system.svc.cluster.local:8080"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
```

---

### 2.5 Testing

**Test checklist:**
- [ ] K8s resource resolver can read Deployments
- [ ] K8s resource resolver can read Pods
- [ ] K8s resource resolver can read Services
- [ ] Reconciliation loop runs without errors
- [ ] Leader election works (only one replica active)
- [ ] RBAC permissions are correct (no cluster-admin)

**Manual validation:**
```bash
# 1. Deploy to test cluster
kubectl apply -f k8s/deployment.yaml

# 2. Check pods
kubectl get pods -n activity-system -l app=k8s-vessel

# 3. Check logs
kubectl logs -n activity-system -l app=k8s-vessel --tail=100

# 4. Verify only one pod is active (leader)
kubectl logs -n activity-system -l app=k8s-vessel | grep "Became leader"
# Should see exactly one pod log: "Became leader, starting reconciliation"
```

---

## Phase 3: Define Deployment Impulse Types (Week 3-4)

**Priority:** Medium
**Risk:** Low (documentation + implementation)

### 3.1 Document Impulse Types

**Already created:** `docs/impulse-types/deployment.md`

**Review checklist:**
- [ ] All impulse types defined (gitCommit, containerImage, deploymentSpec, etc.)
- [ ] Pointer structures documented
- [ ] Metadata structures documented
- [ ] Resolved content structures documented
- [ ] Resolver names specified
- [ ] Token budgets estimated

---

### 3.2 Implement Missing Resolvers

**Resolvers needed:**
1. ✅ `k8s_resource` - Already implemented in Phase 2
2. ⬜ `container_registry` - Read container image metadata
3. ⬜ `prometheus_query` - Query Prometheus metrics
4. ⬜ `helm` - Helm operations

**Implement container_registry resolver:**
```typescript
// repos/k8s-vessel/src/resolvers/container-registry.ts
import { ContainerRegistryClient } from '@azure/container-registry'

export class ContainerRegistryResolver implements ImpulseResolver {
  async resolve(pointer: ContainerRegistryPointer) {
    // Query container registry API
    const { registry, image, tag } = pointer

    // Get manifest and config
    const manifest = await this.getManifest(registry, image, tag)
    const config = await this.getConfig(registry, image, manifest.config.digest)

    return { manifest, config }
  }
}
```

**Implement prometheus_query resolver:**
```typescript
// repos/k8s-vessel/src/resolvers/prometheus-query.ts
export class PrometheusQueryResolver implements ImpulseResolver {
  async resolve(pointer: PrometheusQueryPointer) {
    const { query, start, end, step } = pointer

    const url = new URL('/api/v1/query_range', PROMETHEUS_URL)
    url.searchParams.set('query', query)
    url.searchParams.set('start', start || (Date.now() - 5 * 60 * 1000).toString())
    url.searchParams.set('end', end || Date.now().toString())
    url.searchParams.set('step', step || '15s')

    const response = await fetch(url.toString())
    const data = await response.json()

    return data.data.result
  }
}
```

---

## Phase 4: Create Deployment Activities (Week 4-5)

**Priority:** High
**Risk:** Medium (core functionality)

### 4.1 Define Activity Templates

**File:** `repos/k8s-vessel/activities/deploy-canary.json`

```json
{
  "id": "deploy-canary",
  "name": "Deploy to Canary Environment",
  "category": "infrastructure",

  "inputSchema": {
    "required": [
      { "shape": "gitCommit", "budget": 2000 },
      { "shape": "containerImage", "budget": 1000 },
      { "shape": "deploymentSpec", "budget": 3000 }
    ],
    "optional": [
      { "shape": "activityMetrics", "budget": 1500 },
      { "shape": "deploymentState", "budget": 2000 }
    ]
  },

  "outputSchema": {
    "produces": [
      { "shape": "deploymentResult" },
      { "shape": "healthMetrics" },
      { "shape": "podStatus" }
    ]
  },

  "tasks": [
    {
      "id": "validate-inputs",
      "resolver": "k8s_resource",
      "description": "Verify deployment spec is valid"
    },
    {
      "id": "check-current-state",
      "resolver": "k8s_resource",
      "description": "Get current deployment state for rollback"
    },
    {
      "id": "apply-manifest",
      "resolver": "helm",
      "description": "Apply Helm chart to cluster"
    },
    {
      "id": "wait-for-rollout",
      "resolver": "k8s_resource",
      "description": "Wait for deployment to become ready"
    },
    {
      "id": "validate-health",
      "resolver": "prometheus_query",
      "description": "Check health endpoints and metrics"
    }
  ],

  "validation": {
    "requiredOutputs": ["deploymentResult", "healthMetrics"],
    "successCriteria": {
      "deploymentResult.status": "success",
      "healthMetrics.errorRate": { "lt": 0.01 }
    }
  }
}
```

**Additional activities to create:**
- `validate-canary-health.json`
- `rollback-deployment.json`
- `promote-to-production.json`

---

### 4.2 Implement Activity Executor

**File:** `repos/k8s-vessel/src/activity-executor.ts`

```typescript
import type { Activity, Impulse, ExecutionTrace } from './types'

export class ActivityExecutor {
  private resolvers: Map<string, ImpulseResolver>

  constructor() {
    this.resolvers = new Map([
      ['k8s_resource', new K8sResourceResolver()],
      ['helm', new HelmResolver()],
      ['prometheus_query', new PrometheusQueryResolver()],
    ])
  }

  async execute(activity: Activity, impulses: Impulse[]): Promise<ExecutionTrace> {
    const trace: ExecutionTrace = {
      traceId: `exec-${Date.now()}`,
      activityId: activity.id,
      inputImpulses: impulses,
      tasks: [],
      outputImpulses: [],
      outcome: { success: true, duration_ms: 0, cost_usd: 0 }
    }

    const startTime = Date.now()

    try {
      // Execute each task
      for (const task of activity.tasks) {
        const taskStart = Date.now()

        // Get resolver for this task
        const resolver = this.resolvers.get(task.resolver)
        if (!resolver) {
          throw new Error(`Unknown resolver: ${task.resolver}`)
        }

        // Execute task
        const result = await this.executeTask(task, resolver, impulses)

        trace.tasks.push({
          id: task.id,
          resolver: task.resolver,
          inputRefs: impulses.map(i => i.id),
          outputRef: result.id,
          duration_ms: Date.now() - taskStart,
          success: true
        })

        // Add result as output impulse
        trace.outputImpulses.push(result)
      }

      trace.outcome.success = true

    } catch (error) {
      trace.outcome.success = false
      trace.outcome.error = error.message
    }

    trace.outcome.duration_ms = Date.now() - startTime

    return trace
  }

  private async executeTask(task: Task, resolver: ImpulseResolver, impulses: Impulse[]) {
    // Task-specific logic here
    // For now, just return dummy result
    return {
      id: `output-${task.id}`,
      pointer: { type: 'memo', content: { status: 'success' } },
      loaded: true,
      content: { status: 'success' }
    }
  }
}
```

---

### 4.3 Bootstrap Thompson Sampling

**Task:** Create initial traces for each activity to bootstrap Thompson Sampling.

**Script:** `repos/k8s-vessel/scripts/bootstrap-thompson.ts`

```typescript
// Create synthetic traces for bootstrap
const activities = [
  'deploy-canary',
  'validate-health',
  'rollback-deployment'
]

for (const activityId of activities) {
  // Create 10 successful traces
  for (let i = 0; i < 10; i++) {
    await createTrace({
      activityId,
      outcome: { success: true, duration_ms: 45000 + Math.random() * 10000 }
    })
  }

  // Create 1 failed trace
  await createTrace({
    activityId,
    outcome: { success: false, duration_ms: 5000 }
  })
}

// This gives each activity: α=11, β=2 (starting score ~85%)
```

---

## Phase 5: Integration Testing (Week 6)

**Priority:** Critical
**Risk:** High (end-to-end validation)

### 5.1 End-to-End Deployment Flow

**Test scenario:**
```bash
# 1. Push change to dev branch
echo "# Test change" >> README.md
git add README.md
git commit -m "test: trigger deployment"
git push origin dev

# 2. Wait for k8s-vessel to detect change (max 5 min)
kubectl logs -n activity-system -l app=k8s-vessel --tail=100 -f

# Expected log output:
# [Reconciliation] Recommended activity: deploy-canary
# [Reconciliation] Deployment needed: <new-sha> != <old-sha>
# [Activity] Executing deploy-canary
# [Activity] Task 1: validate-inputs - success
# [Activity] Task 2: check-current-state - success
# [Activity] Task 3: apply-manifest - success
# [Activity] Task 4: wait-for-rollout - success
# [Activity] Task 5: validate-health - success
# [Reconciliation] Deployment complete, trace recorded

# 3. Verify deployment updated
kubectl get deployment minibob -n activity-system -o yaml | grep image:
# Should show new image tag

# 4. Verify trace recorded
curl -H "Authorization: ApiKey $API_KEY" \
  "http://activity.metabob.com/v2/traces/query" \
  -d '{"type":"recentExecutions","activityId":"deploy-canary","limit":1}'

# 5. Verify Thompson Sampling updated
curl -H "Authorization: ApiKey $API_KEY" \
  "http://activity.metabob.com/v2/activities/metrics?activityId=deploy-canary"
# Check α and β values increased
```

---

### 5.2 Learning Loop Validation

**Test:** Multiple deployments improve success rate

```bash
# Deploy 10 times
for i in {1..10}; do
  echo "# Change $i" >> test.txt
  git add test.txt
  git commit -m "test: deployment $i"
  git push origin dev
  sleep 360  # Wait 6 minutes between deployments
done

# Check Thompson Sampling improved
curl -H "Authorization: ApiKey $API_KEY" \
  "http://activity.metabob.com/v2/activities/metrics?activityId=deploy-canary"

# Expected: α value increased, success rate stable or improving
```

---

### 5.3 Failure Handling

**Test:** Failed deployment creates trace

```bash
# Push invalid manifest
echo "invalid: yaml: :" >> environments/canary/minibob.yaml
git add environments/canary/minibob.yaml
git commit -m "test: invalid manifest"
git push origin dev

# Wait for k8s-vessel
kubectl logs -n activity-system -l app=k8s-vessel --tail=100

# Expected:
# [Activity] Task 1: validate-inputs - FAILED
# [Reconciliation] Deployment failed, trace recorded

# Verify trace shows failure
curl -H "Authorization: ApiKey $API_KEY" \
  "http://activity.metabob.com/v2/traces/query" \
  -d '{"type":"recentExecutions","activityId":"deploy-canary","limit":1}'

# Verify β incremented
curl -H "Authorization: ApiKey $API_KEY" \
  "http://activity.metabob.com/v2/activities/metrics?activityId=deploy-canary"
```

---

## Success Metrics

After completing all phases, we should achieve:

1. **No vessel registry** - Backend has no `/v2/vessels/*` endpoints
2. **No boredom queue API** - Backend has no `/v2/activities/boredom/enqueue` endpoint
3. **Recommendation-based boredom** - All vessels use `POST /v2/activities/recommend`
4. **Autonomous deployments** - Push to `dev` → automatic canary deployment
5. **Learning loop working** - Thompson Sampling improves success rate over time
6. **Clean API surface** - Backend only has: `/v2/traces`, `/v2/traces/query`, `/v2/activities/recommend`

---

## Rollback Plan

If any phase fails:

### Phase 1 Rollback
```bash
git revert HEAD~N  # N = number of commits to revert
git push origin dev
# Redeploy previous backend version
```

### Phase 2 Rollback
```bash
# Delete k8s-vessel deployment
kubectl delete deployment k8s-vessel -n activity-system
kubectl delete clusterrolebinding k8s-vessel-binding
kubectl delete clusterrole k8s-vessel-role
```

### Phase 3-5 Rollback
- Delete activity templates
- Revert repository changes
- No impact on running system

---

## Team Assignments

**Backend work (Phase 1):**
- Delete vessel registry routes
- Delete boredom queue endpoints
- Update tests
- Deploy to canary

**MiniBob work (Phase 1):**
- Update boredom system to use recommendations
- Remove vessel registration
- Update tests

**K8s-Vessel work (Phase 2-4):**
- Create new repository
- Implement resolvers
- Implement reconciliation loop
- Create activity templates
- Deploy to test cluster

**Integration testing (Phase 5):**
- End-to-end testing
- Learning loop validation
- Failure handling validation

---

## Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Phase 1 | Violations removed, backend clean, MiniBob updated |
| 2-3 | Phase 2 | K8s-vessel created, basic reconciliation working |
| 3-4 | Phase 3 | All impulse types documented and implemented |
| 4-5 | Phase 4 | Deployment activities created and tested |
| 6 | Phase 5 | End-to-end integration, learning loop validated |

---

## Communication

**Daily standups:**
- Progress on current phase
- Blockers
- Testing results

**Weekly reviews:**
- Demo working functionality
- Review traces and metrics
- Adjust timeline if needed

**Documentation updates:**
- Update `CLAUDE.md` as we go
- Document learnings
- Update architecture diagrams

---

## Resources

- **Full design:** `PULL_BASED_DEPLOYMENT_CORRECTED.md`
- **Violations summary:** `DEPLOYMENT_ARCHITECTURE_VIOLATIONS_SUMMARY.md`
- **Impulse types:** `docs/impulse-types/deployment.md`
- **Diagrams:** `DEPLOYMENT_ARCHITECTURE_DIAGRAM.md`
- **Foundation:** `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
