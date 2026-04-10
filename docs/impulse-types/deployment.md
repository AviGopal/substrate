# Deployment Impulse Types

**Date:** 2026-04-10
**Status:** Design Specification
**Purpose:** Define impulse types for deployment-related data following the foundational model

---

## Overview

Deployment data is represented as **impulses** - lazy-loaded pointers with metadata. This enables:
- Reasoning about deployments without loading all data
- Flexible resolution based on where data lives
- Token budget management
- Historical trace storage

---

## Configuration Impulses

These impulses describe **what to deploy**.

### gitCommit

**Shape:** Version control commit information

**Pointer:**
```typescript
{
  type: "git",
  repo: string,        // Git repository URL
  branch?: string,     // Branch name (optional)
  sha?: string,        // Commit SHA (optional)
  path?: string        // Path within repo (optional)
}
```

**Metadata:**
```typescript
{
  shape: "gitCommit",
  summary: "Commit abc123 on branch dev",
  author: "user@example.com",
  timestamp: "2026-04-10T12:00:00Z",
  message: "feat: add new feature",
  filesChanged: 12
}
```

**Resolved Content:**
```typescript
{
  sha: "abc123...",
  branch: "dev",
  author: { name: "...", email: "..." },
  timestamp: "...",
  message: "feat: add new feature",
  diff: "...",         // Full diff if loaded
  files: [             // Files changed
    { path: "src/index.ts", status: "modified", additions: 5, deletions: 2 }
  ]
}
```

**Resolver:** `git` (filesystem vessel, k8s-vessel)

**Budget Considerations:**
- Metadata only: ~500 tokens
- With diff: 2000-10000 tokens depending on changes
- With full file contents: Can exceed context window

---

### containerImage

**Shape:** Container image reference

**Pointer:**
```typescript
{
  type: "container_registry",
  registry: string,    // Registry URL (e.g., "docker.io")
  image: string,       // Image name (e.g., "minibob")
  tag: string,         // Image tag (e.g., "v1.2.3" or "canary-abc123")
  digest?: string      // SHA256 digest (optional)
}
```

**Metadata:**
```typescript
{
  shape: "containerImage",
  summary: "minibob:canary-abc123",
  registry: "ghcr.io",
  size_mb: 245,
  layers: 12,
  created: "2026-04-10T11:30:00Z",
  architecture: "linux/amd64"
}
```

**Resolved Content:**
```typescript
{
  registry: "ghcr.io",
  image: "metabobproject/minibob",
  tag: "canary-abc123",
  digest: "sha256:...",
  manifest: { ... },   // OCI manifest
  config: { ... },     // Image config (ENV, CMD, etc.)
  layers: [ ... ],     // Layer information
  vulnerabilities?: [ ... ]  // If scanned
}
```

**Resolver:** `container_registry` (k8s-vessel, registry-scanner vessel)

**Budget Considerations:**
- Metadata only: ~300 tokens
- With manifest: ~1000 tokens
- With full config: ~2000 tokens

---

### deploymentSpec

**Shape:** Kubernetes deployment manifest

**Pointer:**
```typescript
{
  type: "file",
  path: string,              // Path to manifest file
  format: "yaml" | "json"    // Manifest format
}
```

**OR (for templated specs):**
```typescript
{
  type: "helm_chart",
  chart: string,             // Chart name
  version: string,           // Chart version
  values: string             // Path to values file
}
```

**Metadata:**
```typescript
{
  shape: "deploymentSpec",
  summary: "Deployment manifest for minibob",
  kind: "Deployment",
  apiVersion: "apps/v1",
  replicas: 3,
  image: "minibob:canary-abc123",
  resources: {
    requests: { cpu: "100m", memory: "128Mi" },
    limits: { cpu: "500m", memory: "512Mi" }
  }
}
```

**Resolved Content:**
```typescript
{
  apiVersion: "apps/v1",
  kind: "Deployment",
  metadata: { name: "minibob", namespace: "activity-system" },
  spec: {
    replicas: 3,
    selector: { matchLabels: { app: "minibob" } },
    template: {
      metadata: { labels: { app: "minibob" } },
      spec: {
        containers: [ ... ]
      }
    }
  }
}
```

**Resolver:** `file` (filesystem vessel) or `helm` (k8s-vessel)

**Budget Considerations:**
- Metadata only: ~400 tokens
- Full manifest: 1000-3000 tokens
- Helm chart with values: 2000-5000 tokens

---

## State Impulses

These impulses describe **current reality**.

### deploymentState

**Shape:** Current Kubernetes deployment state

**Pointer:**
```typescript
{
  type: "k8s_resource",
  kind: "Deployment",
  namespace: string,
  name: string,
  apiVersion?: string
}
```

**Metadata:**
```typescript
{
  shape: "deploymentState",
  summary: "minibob deployment with 3 replicas",
  name: "minibob",
  namespace: "activity-system",
  replicas: { desired: 3, available: 3, ready: 3 },
  image: "minibob:v1.2.2",
  status: "healthy",
  age: "2h"
}
```

**Resolved Content:**
```typescript
{
  metadata: { name: "...", namespace: "...", labels: { ... } },
  spec: { ... },           // Desired state
  status: {                // Current state
    replicas: 3,
    availableReplicas: 3,
    readyReplicas: 3,
    conditions: [
      { type: "Available", status: "True", reason: "MinimumReplicasAvailable" }
    ]
  },
  resourceVersion: "12345",
  generation: 42
}
```

**Resolver:** `k8s_resource` (k8s-vessel)

**Budget Considerations:**
- Metadata only: ~400 tokens
- Full resource: 1500-3000 tokens
- With events: +500 tokens

---

### podStatus

**Shape:** Status of pods for a deployment

**Pointer:**
```typescript
{
  type: "k8s_resource",
  kind: "Pod",
  namespace: string,
  selector: Record<string, string>   // Label selector
}
```

**Metadata:**
```typescript
{
  shape: "podStatus",
  summary: "3 pods running, 0 pending, 0 failed",
  count: { running: 3, pending: 0, failed: 0, unknown: 0 },
  readiness: { ready: 3, total: 3 },
  restarts: 0,
  age: "2h"
}
```

**Resolved Content:**
```typescript
{
  pods: [
    {
      name: "minibob-abc123-xyz",
      phase: "Running",
      conditions: [ ... ],
      containerStatuses: [
        {
          name: "vessel",
          state: { running: { startedAt: "..." } },
          ready: true,
          restartCount: 0
        }
      ],
      events: [ ... ]     // Recent events
    }
  ]
}
```

**Resolver:** `k8s_resource` (k8s-vessel)

**Budget Considerations:**
- Metadata only: ~300 tokens
- Full pod list (3 pods): ~2000 tokens
- With events: +1000 tokens

---

### serviceEndpoint

**Shape:** Kubernetes Service endpoint information

**Pointer:**
```typescript
{
  type: "k8s_resource",
  kind: "Service",
  namespace: string,
  name: string
}
```

**Metadata:**
```typescript
{
  shape: "serviceEndpoint",
  summary: "Service minibob on port 8080",
  name: "minibob",
  namespace: "activity-system",
  type: "ClusterIP",
  clusterIP: "10.96.1.23",
  ports: [ { port: 8080, targetPort: 8080 } ],
  endpoints: { ready: 3, notReady: 0 }
}
```

**Resolved Content:**
```typescript
{
  metadata: { name: "...", namespace: "..." },
  spec: {
    type: "ClusterIP",
    clusterIP: "10.96.1.23",
    ports: [ { port: 8080, targetPort: 8080, protocol: "TCP" } ],
    selector: { app: "minibob" }
  },
  status: {
    loadBalancer: { ... }  // If type: LoadBalancer
  },
  endpoints: [             // From Endpoints resource
    {
      addresses: [ { ip: "10.244.0.5", nodeName: "...", ... } ],
      ports: [ { port: 8080, protocol: "TCP" } ]
    }
  ]
}
```

**Resolver:** `k8s_resource` (k8s-vessel)

**Budget Considerations:**
- Metadata only: ~300 tokens
- Full service + endpoints: ~1000 tokens

---

### healthMetrics

**Shape:** Observability metrics for deployed service

**Pointer:**
```typescript
{
  type: "prometheus_query",
  query: string,           // PromQL query
  start?: string,          // Start time (ISO 8601)
  end?: string,            // End time (ISO 8601)
  step?: string            // Resolution step
}
```

**Metadata:**
```typescript
{
  shape: "healthMetrics",
  summary: "Error rate 0.02%, latency p99 45ms",
  errorRate: 0.0002,
  latencyP50: 12,
  latencyP99: 45,
  requestRate: 150,        // requests/sec
  availability: 0.9998,
  timeRange: "5m"
}
```

**Resolved Content:**
```typescript
{
  metrics: [
    {
      metric: { __name__: "http_requests_total", status: "200", ... },
      values: [ [timestamp, value], ... ]
    }
  ],
  aggregations: {
    errorRate: 0.0002,
    latency: { p50: 12, p95: 32, p99: 45 },
    requestRate: 150,
    availability: 0.9998
  }
}
```

**Resolver:** `prometheus_query` (metrics-vessel, k8s-vessel if Prometheus in-cluster)

**Budget Considerations:**
- Metadata only: ~300 tokens
- Aggregations only: ~500 tokens
- Full time series: 2000-10000 tokens (large)

---

## Historical Impulses

These impulses reference **past execution data**.

### activityExecutionTrace

**Shape:** Complete execution trace for an activity

**Pointer:**
```typescript
{
  type: "activityExecutionTrace",
  traceId: string          // Execution trace ID
}
```

**Metadata:**
```typescript
{
  shape: "activityExecutionTrace",
  summary: "deploy-canary execution from 2026-04-10",
  activityId: "deploy-canary",
  variantId: "deploy-canary:v3",
  outcome: "success",
  duration_ms: 45000,
  cost_usd: 0.12,
  timestamp: "2026-04-10T12:00:00Z"
}
```

**Resolved Content:**
```typescript
{
  trace_id: "exec-abc123",
  activity_id: "deploy-canary",
  variant_id: "deploy-canary:v3",
  input_impulses: [ ... ],
  tasks: [
    {
      id: "task-1",
      resolver: "k8s_resource",
      input_refs: [ ... ],
      output_ref: "...",
      duration_ms: 5000,
      success: true
    }
  ],
  output_impulses: [ ... ],
  state_transition: {
    before: { "deployment/minibob": "image:v1.2.2" },
    after: { "deployment/minibob": "image:v1.2.3" }
  },
  outcome: {
    success: true,
    duration_ms: 45000,
    cost_usd: 0.12
  }
}
```

**Resolver:** `trace` (backend - metabob-activity-api)

**Budget Considerations:**
- Metadata only: ~400 tokens
- Full trace: 3000-10000 tokens (depends on task count)
- Limit: Use `offset` and `limit` for large traces

---

### activityMetrics

**Shape:** Performance metrics for an activity

**Pointer:**
```typescript
{
  type: "activityMetrics",
  activityId: string,
  variantId?: string,      // Specific variant (optional)
  window?: string          // Time window (e.g., "7d")
}
```

**Metadata:**
```typescript
{
  shape: "activityMetrics",
  summary: "deploy-canary: 94% success, avg 45s",
  activityId: "deploy-canary",
  successRate: 0.94,
  avgDuration_ms: 45000,
  avgCost_usd: 0.12,
  executionCount: 47
}
```

**Resolved Content:**
```typescript
{
  activity_id: "deploy-canary",
  variants: [
    {
      variant_id: "deploy-canary:v3",
      thompson: { alpha: 45, beta: 3 },
      stats: {
        executions: 48,
        successes: 45,
        failures: 3,
        avgDuration_ms: 45000,
        avgCost_usd: 0.12
      }
    }
  ],
  aggregated: {
    successRate: 0.94,
    avgDuration_ms: 45000,
    avgCost_usd: 0.12,
    totalExecutions: 48
  }
}
```

**Resolver:** `metrics` (backend - metabob-activity-api)

**Budget Considerations:**
- Metadata only: ~300 tokens
- Aggregated stats: ~800 tokens
- Per-variant breakdown: ~1500 tokens

---

## Result Impulses

These impulses are **produced by activities**.

### deploymentResult

**Shape:** Outcome of a deployment activity

**Pointer:**
```typescript
{
  type: "memo",            // Embedded content
  content: DeploymentResult
}
```

**Metadata:**
```typescript
{
  shape: "deploymentResult",
  summary: "Deployment succeeded, 3 replicas healthy",
  status: "success",
  replicas: { desired: 3, available: 3 },
  duration_ms: 45000,
  rollout: "complete"
}
```

**Resolved Content:**
```typescript
{
  status: "success" | "failed" | "partial",
  deployment: {
    name: "minibob",
    namespace: "activity-system",
    image: "minibob:canary-abc123",
    replicas: { desired: 3, available: 3, ready: 3 }
  },
  rollout: {
    status: "complete",
    duration_ms: 45000,
    oldReplicaSet: "minibob-old",
    newReplicaSet: "minibob-new"
  },
  healthCheck: {
    passed: true,
    endpoint: "http://minibob.activity-system.svc:8080/health",
    responseCode: 200
  },
  errors?: [ ... ]         // If failed
}
```

**Resolver:** `memo` (any vessel - embedded)

**Budget Considerations:**
- Full result: ~1000 tokens
- With errors: +500 tokens per error

---

### validationResult

**Shape:** Outcome of health/validation check

**Pointer:**
```typescript
{
  type: "memo",
  content: ValidationResult
}
```

**Metadata:**
```typescript
{
  shape: "validationResult",
  summary: "All checks passed",
  healthCheck: "pass",
  metricsCheck: "pass",
  errorRate: 0.0002,
  recommendation: "promote"
}
```

**Resolved Content:**
```typescript
{
  checks: [
    {
      name: "http-health",
      status: "pass",
      endpoint: "...",
      responseCode: 200,
      latency_ms: 12
    },
    {
      name: "metrics-validation",
      status: "pass",
      errorRate: 0.0002,
      threshold: 0.01,
      latency_p99: 45
    }
  ],
  overall: "pass" | "fail",
  recommendation: "promote" | "rollback" | "monitor",
  confidence: 0.95,
  reasoning?: "Error rate 0.02% < 1% threshold, latency stable"
}
```

**Resolver:** `memo` (any vessel - embedded)

**Budget Considerations:**
- Full result: ~800 tokens
- With reasoning: +200 tokens

---

## Usage Patterns

### Deployment Activity Example

```typescript
{
  id: "deploy-canary",
  name: "Deploy to Canary Environment",

  inputSchema: {
    required: [
      { shape: "gitCommit", budget: 2000 },
      { shape: "containerImage", budget: 1000 },
      { shape: "deploymentSpec", budget: 3000 }
    ],
    optional: [
      { shape: "activityMetrics", budget: 1500 },
      { shape: "deploymentState", budget: 2000 }
    ]
  },

  outputSchema: {
    produces: [
      { shape: "deploymentResult" },
      { shape: "healthMetrics" },
      { shape: "podStatus" }
    ]
  },

  tasks: [
    {
      id: "validate-inputs",
      resolver: "k8s_resource",
      impulses: ["deploymentSpec"],
      description: "Verify deployment spec is valid"
    },
    {
      id: "check-current-state",
      resolver: "k8s_resource",
      impulses: ["deploymentState"],
      description: "Get current state for rollback"
    },
    {
      id: "apply-manifest",
      resolver: "helm",
      impulses: ["deploymentSpec", "containerImage"],
      description: "Apply Helm chart to cluster"
    },
    {
      id: "wait-for-rollout",
      resolver: "k8s_resource",
      description: "Wait for deployment ready"
    },
    {
      id: "validate-health",
      resolver: "prometheus_query",
      description: "Check health metrics"
    }
  ]
}
```

### Reconciliation Loop Example

```typescript
async function reconciliationLoop() {
  // 1. Create impulses (metadata only)
  const impulses = [
    {
      id: "gitCommit",
      pointer: { type: "git", repo: DEPLOYMENT_REPO, branch: "main" },
      metadata: { shape: "gitCommit", summary: "Latest commit" },
      budget: 2000,
      loaded: false
    },
    {
      id: "currentDeployment",
      pointer: { type: "k8s_resource", kind: "Deployment", name: "minibob", namespace: "activity-system" },
      metadata: { shape: "deploymentState", summary: "Current deployment" },
      budget: 2000,
      loaded: false
    }
  ]

  // 2. Ask backend for activity recommendation
  const recommendation = await backend.recommendActivity({
    goal: "deploy-canary",
    availableImpulses: impulses.map(i => i.metadata)
  })

  // 3. Load impulses
  const loaded = await loadImpulses(impulses)

  // 4. Check if update needed
  const gitCommit = loaded.find(i => i.id === "gitCommit").content
  const currentDeploy = loaded.find(i => i.id === "currentDeployment").content

  if (needsUpdate(gitCommit, currentDeploy)) {
    // 5. Execute activity
    const trace = await executeActivity(recommendation.activityId, loaded)

    // 6. Record trace
    await backend.storeTrace(trace)
  }
}
```

---

## Resolver Implementation Guide

Each impulse type needs a resolver. Here's how to implement them:

### K8s Resource Resolver (k8s-vessel)

```typescript
class K8sResourceResolver implements ImpulseResolver {
  type = "k8s_resource"

  async resolve(pointer: K8sResourcePointer): Promise<unknown> {
    const { kind, namespace, name, apiVersion } = pointer

    // Use @kubernetes/client-node
    const k8sApi = this.getApiForKind(kind)
    const resource = await k8sApi.read(name, namespace)

    return resource.body
  }

  async getMetadata(pointer: K8sResourcePointer): Promise<ImpulseMetadata> {
    const resource = await this.resolve(pointer)

    return {
      shape: this.inferShape(pointer.kind),
      summary: this.summarize(resource),
      // ... extract key fields for metadata
    }
  }
}
```

### Prometheus Query Resolver (metrics-vessel)

```typescript
class PrometheusQueryResolver implements ImpulseResolver {
  type = "prometheus_query"

  async resolve(pointer: PrometheusQueryPointer): Promise<unknown> {
    const { query, start, end, step } = pointer

    const response = await this.prometheusClient.query({
      query,
      start: start || new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      end: end || new Date().toISOString(),
      step: step || "15s"
    })

    return response.data.result
  }

  async getMetadata(pointer: PrometheusQueryPointer): Promise<ImpulseMetadata> {
    const result = await this.resolve(pointer)

    // Compute aggregations for metadata
    const aggregations = this.computeAggregations(result)

    return {
      shape: "healthMetrics",
      summary: this.formatSummary(aggregations),
      ...aggregations
    }
  }
}
```

---

## Token Budget Management

Deployment impulses can be large. Use budgets wisely:

| Impulse Type | Metadata Only | With Content | Full Detail |
|--------------|---------------|--------------|-------------|
| `gitCommit` | 500 | 2000 | 10000 |
| `containerImage` | 300 | 1000 | 2000 |
| `deploymentSpec` | 400 | 3000 | 5000 |
| `deploymentState` | 400 | 2000 | 3000 |
| `healthMetrics` | 300 | 500 | 10000 |
| `activityExecutionTrace` | 400 | 5000 | 10000 |

**Best Practice:**
1. Start with metadata only (small budget)
2. Load content only when activity requires it
3. Use `offset` and `limit` for large traces
4. Unload impulses after use to free memory

---

## References

- [IMPULSE_ACTIVITY_FOUNDATION.md](../architecture/IMPULSE_ACTIVITY_FOUNDATION.md) - Canonical model
- [PULL_BASED_DEPLOYMENT_CORRECTED.md](../../PULL_BASED_DEPLOYMENT_CORRECTED.md) - Architecture
