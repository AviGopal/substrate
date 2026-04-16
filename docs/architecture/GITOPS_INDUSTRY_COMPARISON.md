# GitOps Industry Practices vs MiniBob Operator Architecture

**Date**: 2026-04-11
**Purpose**: Compare MiniBob operator design with industry best practices (ArgoCD, Flux, Kubernetes operators)
**Research Sources**: ArgoCD, Flux, Cilium Cluster Mesh, Kubernetes Operator Pattern (2026)

---

## Industry Best Practices (2026)

### 1. GitOps Tools Landscape

#### ArgoCD
**Architecture**: [Centralized control plane with pull-based sync](https://devstarsj.github.io/2026/03/18/gitops-argocd-flux-kubernetes-guide-2026/)

**Key Features**:
- Rich web UI for visualizing application state
- Multi-tenancy with fine-grained RBAC
- Centralized management for multiple clusters
- [Image automation via Argo CD Image Updater](https://www.askantech.com/gitops-infrastructure-management-continuous-deployment-argocd-flux/)
- Application CRD for declarative app definitions

**Deployment Model**:
```yaml
# ArgoCD runs as deployment in argocd namespace
apiVersion: apps/v1
kind: Deployment
metadata:
  name: argocd-application-controller
  namespace: argocd
spec:
  replicas: 1  # Single controller with leader election
```

**Strengths**:
- Enterprise-grade UI and RBAC
- Extensive integrations (Helm, Kustomize, Jsonnet)
- Multi-cluster management from single control plane

**Weaknesses**:
- Heavy footprint (10+ components)
- Centralized architecture can be bottleneck
- Not composable with other tools

#### Flux
**Architecture**: [Lightweight, composable toolkit using pull model](https://northflank.com/blog/flux-vs-argo-cd)

**Key Features**:
- [Pull-based: agents in cluster periodically check Git](https://calmops.com/devops/gitops-2026-complete-guide/)
- No built-in dashboard (uses Grafana/Prometheus)
- [Enhanced multi-cluster support in Flux 2.0 (2026)](https://reintech.io/blog/argocd-vs-flux-which-gitops-tool-should-you-choose-in-2026)
- Composable controllers (source-controller, kustomize-controller, helm-controller)

**Deployment Model**:
```yaml
# Flux runs as multiple deployments in flux-system namespace
apiVersion: apps/v1
kind: Deployment
metadata:
  name: source-controller
  namespace: flux-system
spec:
  replicas: 1
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kustomize-controller
  namespace: flux-system
spec:
  replicas: 1
```

**Strengths**:
- Lightweight and composable
- Unix philosophy (do one thing well)
- Native Kubernetes integration
- [50% increase in production speed, 75% increase in deployment frequency (Deutsche Telekom case study)](https://dasroot.net/posts/2026/04/kubernetes-deployment-automation-argocd-flux/)

**Weaknesses**:
- No native UI (relies on external tools)
- Requires understanding of multiple controllers
- Less opinionated (more configuration needed)

### 2. Progressive Delivery

#### Flagger
**Purpose**: [Automates canary releases, blue-green deployments, A/B tests](https://www.askantech.com/gitops-infrastructure-management-continuous-deployment-argocd-flux/)

**Integration**:
- Works with ArgoCD and Flux
- Monitors metrics from Prometheus or Datadog
- Automatically promotes or rolls back based on metrics

**Example**:
```yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: podinfo
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: podinfo
  progressDeadlineSeconds: 60
  service:
    port: 9898
  analysis:
    interval: 1m
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
    - name: request-success-rate
      thresholdRange:
        min: 99
      interval: 1m
    - name: request-duration
      thresholdRange:
        max: 500
      interval: 1m
```

**Traffic Management**:
- Integrates with Istio, Linkerd, App Mesh for traffic shifting
- Gradual rollout: 10% → 20% → 30% ... → 100%
- Automatic rollback on metric threshold violations

### 3. Kubernetes Operator Pattern

#### Standard Architecture
**Definition**: [Software extensions to Kubernetes using custom resources and control loops](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/)

**Deployment Location**: [Controllers run outside control plane, typically as Deployments](https://dasroot.net/posts/2026/03/kubernetes-operators-building-custom-controllers-kubebuilder/)

**Common Pattern**:
```
┌─────────────────────────────────────────────────────────┐
│ Kubernetes Cluster                                      │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ operator-system namespace                       │   │
│ │                                                 │   │
│ │ ┌─────────────────────────────────────────┐   │   │
│ │ │ Operator Deployment                     │   │   │
│ │ │ - 3 replicas (HA)                       │   │   │
│ │ │ - Leader election via Lease resource    │   │   │
│ │ │ - Watches CustomResources               │   │   │
│ │ │ - Reconciles desired vs actual state    │   │   │
│ │ └─────────────────────────────────────────┘   │   │
│ │                                                 │   │
│ │ ┌─────────────────────────────────────────┐   │   │
│ │ │ Lease (for leader election)             │   │   │
│ │ │ holderIdentity: operator-pod-abc123     │   │   │
│ │ │ leaseDurationSeconds: 15                │   │   │
│ │ └─────────────────────────────────────────┘   │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ application namespace                           │   │
│ │                                                 │   │
│ │ ┌─────────────────────────────────────────┐   │   │
│ │ │ CustomResources (managed by operator)   │   │   │
│ │ └─────────────────────────────────────────┘   │   │
│ └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

#### Leader Election
**Mechanism**: [Instances compete for Lease resource via holderIdentity](https://oneuptime.com/blog/post/2026-02-09-namespace-scoped-operators-leader/view)

**Implementation** ([Kubernetes Leader Election](https://kubernetes.io/docs/concepts/cluster-administration/coordinated-leader-election/)):
```go
// Leader election configuration
leaderElectionConfig := leaderelection.LeaderElectionConfig{
    Lock: &resourcelock.LeaseLock{
        LeaseMeta: metav1.ObjectMeta{
            Name:      "operator-lock",
            Namespace: "operator-system",
        },
        Client: clientset.CoordinationV1(),
        LockConfig: resourcelock.ResourceLockConfig{
            Identity: hostname,
        },
    },
    LeaseDuration: 15 * time.Second,
    RenewDeadline: 10 * time.Second,
    RetryPeriod:   2 * time.Second,
    Callbacks: leaderelection.LeaderCallbacks{
        OnStartedLeading: func(ctx context.Context) {
            // Start reconciliation loop
        },
        OnStoppedLeading: func() {
            // Cleanup
        },
    },
}
```

**Key Points** ([Operator SDK Advanced Topics](https://sdk.operatorframework.io/docs/building-operators/golang/advanced-topics/)):
- Multiple replicas for HA
- Only leader performs reconciliation
- Automatic failover if leader crashes
- [Lease renewal required before leaseDurationSeconds expires](https://kubernetes.recipes/recipes/deployments/kubernetes-leases/)

### 4. Multi-Cluster and Cross-Cluster Communication

#### Service Mesh Solutions

**Cilium Cluster Mesh** ([Cilium Documentation](https://docs.tigera.io/use-cases/cluster-mesh)):
```
┌──────────────────────┐         ┌──────────────────────┐
│ Cluster A            │         │ Cluster B            │
│                      │         │                      │
│ ┌────────────────┐  │         │  ┌────────────────┐ │
│ │ Service: api   │  │◄────────┼─►│ Service: api   │ │
│ │ (local pods)   │  │  Mesh   │  │ (local pods)   │ │
│ └────────────────┘  │         │  └────────────────┘ │
│                      │         │                      │
│ Global Service       │         │  Global Service      │
│ Discovery            │         │  Discovery           │
└──────────────────────┘         └──────────────────────┘
```

**Features**:
- Cross-cluster service discovery
- Load balancing across clusters
- Network policy enforcement globally
- [DNS-based discovery: service.namespace.svc.cluster.local](https://oneuptime.com/blog/post/2026-03-13-cilium-cluster-mesh/view)

**Istio Multi-Cluster** ([Kubernetes Multi-Cluster Comms](https://www.infoq.com/articles/kubernetes-multicluster-comms/)):
```yaml
# ServiceEntry for cross-cluster service
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: remote-service
spec:
  hosts:
  - api.remote-cluster.svc.cluster.local
  location: MESH_INTERNAL
  ports:
  - number: 8080
    name: http
    protocol: HTTP
  resolution: DNS
  endpoints:
  - address: remote-cluster-gateway.istio-system.svc.cluster.local
    ports:
      http: 15443  # mTLS port
```

**Service Mirror Operator** ([Linkerd Multi-Cluster](https://www.buoyant.io/blog/multi-cluster-multi-region-setup-using-linkerd-service-mesh)):
- Kubernetes Operator that mirrors remote services locally
- Enables local service discovery for remote services
- Pods refer to remote services using standard Kubernetes DNS

#### Azure Kubernetes Fleet Manager
[Managed Cilium Cluster Mesh](https://opensource.microsoft.com/blog/2026/03/24/whats-new-with-microsoft-in-open-source-and-kubernetes-at-kubecon-cloudnativecon-europe-2026/):
- Unified connectivity across AKS clusters
- Global service registry for cross-cluster discovery
- Centrally managed routing configuration

### 5. Multi-Tenancy Patterns

#### Native Kubernetes Approach
[Kubernetes Multi-Tenancy](https://kubernetes.io/docs/concepts/security/multi-tenancy/):
- Namespaces for logical separation
- RBAC for access control
- Network policies for network isolation
- Resource quotas for resource limits

**Example**:
```yaml
# Namespace per tenant
apiVersion: v1
kind: Namespace
metadata:
  name: tenant-org-123
---
# RBAC for tenant isolation
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: tenant-admin
  namespace: tenant-org-123
subjects:
- kind: User
  name: user@org-123.com
roleRef:
  kind: ClusterRole
  name: admin
  apiGroup: rbac.authorization.k8s.io
---
# Network policy for isolation
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-from-other-namespaces
  namespace: tenant-org-123
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector: {}  # Only pods in same namespace
```

#### Service Mesh Multi-Tenancy
[Service Mesh for Multi-Tenancy](https://northflank.com/blog/kubernetes-multi-tenancy):
- OSI Layer 7 policies based on workload identity
- Encryption via mutual TLS
- Easier namespace-based multi-tenancy management

---

## MiniBob Operator: Industry Comparison

### Architecture Alignment

| Aspect | Industry Standard | MiniBob Operator Design | Assessment |
|--------|------------------|------------------------|------------|
| **Pull Model** | ✅ ArgoCD, Flux pull from Git | ✅ MiniBob watches Git repo | Aligned |
| **Operator Pattern** | ✅ CRD + Controller | ✅ Activities as reconciliation loops | Aligned (novel approach) |
| **Deployment Location** | ✅ Dedicated namespace (operator-system) | ✅ activity-system namespace | Aligned |
| **Leader Election** | ✅ Lease-based with 3 replicas | ⚠️ Not specified | **Need to add** |
| **Progressive Delivery** | ✅ Flagger for canary releases | ✅ Thompson Sampling traffic | **Superior** (learns optimal weights) |
| **Multi-Cluster** | ✅ Cilium/Istio cluster mesh | ⚠️ Not addressed | **Need to add** |
| **Multi-Tenancy** | ✅ Namespace + RBAC | ✅ SurrealDB PERMISSIONS | Aligned |
| **Secrets Management** | ✅ Sealed Secrets, SOPS | ✅ SOPS + k8s Secrets | Aligned |
| **Observability** | ✅ Prometheus + Grafana | ✅ Execution traces + dashboard | **Superior** (traceable decisions) |

### Key Differences

#### 1. Activities as Reconciliation Loops (Novel)

**Industry Standard**:
```go
// Go-based reconciliation loop
func (r *Reconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    // Get desired state from CRD
    desiredState := &v1.MyResource{}
    if err := r.Get(ctx, req.NamespacedName, desiredState); err != nil {
        return ctrl.Result{}, err
    }

    // Get actual state from cluster
    actualState := getActualState()

    // Reconcile
    if !reflect.DeepEqual(desiredState, actualState) {
        applyChanges(desiredState)
    }

    return ctrl.Result{}, nil
}
```

**MiniBob Approach**:
```typescript
// Activity-based reconciliation
{
  "id": "operator-reconcile-deployments",
  "name": "Reconcile Vessel Deployments",
  "waking": {
    "trigger": "scheduled",
    "interval": "60s"
  },
  "tasks": [
    {
      "id": "fetch-desired-state",
      "prompt": {
        "template": "Read desired-state.yaml from git repository at {{gitRepo}}/manifests/desired-state.yaml"
      }
    },
    {
      "id": "fetch-actual-state",
      "prompt": {
        "template": "Query Kubernetes API for current deployments in namespace activity-system"
      }
    },
    {
      "id": "reconcile-differences",
      "prompt": {
        "template": "Compare desired vs actual state. For each difference, apply changes via kubectl"
      }
    }
  ]
}
```

**Advantages**:
- ✅ Every reconciliation is traced (execution trace)
- ✅ LLM can handle complex logic without coding
- ✅ Activities are composable and reusable
- ✅ Learning loop improves reconciliation over time

**Disadvantages**:
- ⚠️ Slower than compiled Go code
- ⚠️ Non-deterministic (LLM-based decisions)
- ⚠️ Higher latency for critical reconciliation

#### 2. Thompson Sampling vs Fixed Canary Weights

**Industry (Flagger)**:
```yaml
# Fixed progressive rollout steps
analysis:
  stepWeight: 10  # Increase by 10% each step
  maxWeight: 50   # Max 50% traffic
```

**MiniBob**:
```typescript
// Dynamic Thompson Sampling
const variants = await getVariantMetrics();
const weights = thompsonSampling(variants.map(v => ({
  alpha: v.successCount + 1,
  beta: v.failureCount + 1
})));

// Traffic automatically shifts to best performer
updateIstioWeights(weights);
```

**Advantages**:
- ✅ Automatically finds optimal traffic split
- ✅ Adapts to variant performance in real-time
- ✅ No manual threshold configuration
- ✅ Learns from execution traces

**Industry Validation**:
- Flagger uses fixed weights (manual tuning)
- Thompson Sampling is research-backed but not widely deployed in GitOps

#### 3. Execution Traces vs Prometheus Metrics

**Industry (Prometheus)**:
```yaml
# Metrics scraped from pods
- job_name: 'kubernetes-pods'
  kubernetes_sd_configs:
  - role: pod
  metrics_path: /metrics
```

**MiniBob**:
```typescript
// Every operation is an execution trace
{
  "activity_id": "operator-optimize-traffic",
  "variant_id": "minibob-operator-v1",
  "success": true,
  "duration_ms": 1200,
  "cost_usd": 0.003,
  "inputs": {
    "current_weights": {"v1": 0.5, "v2": 0.5},
    "variant_metrics": [...]
  },
  "outputs": {
    "new_weights": {"v1": 0.45, "v2": 0.55},
    "reason": "v2 has higher success rate (0.96 vs 0.92)"
  },
  "state_transition": {
    "before": "VirtualService traffic: 50/50",
    "after": "VirtualService traffic: 45/55"
  }
}
```

**Advantages**:
- ✅ Complete audit trail of all decisions
- ✅ Reasoning captured ("why this weight?")
- ✅ Inputs/outputs recorded for debugging
- ✅ State transitions visible

---

## Infrastructure Stack Placement

### Where Should MiniBob Operator Run?

Based on industry research, here's the recommended deployment architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│ Kubernetes Cluster (production or staging)                      │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ activity-system namespace                                  │ │
│ │                                                            │ │
│ │ ┌────────────────────────────────────────────────────┐   │ │
│ │ │ MiniBob Operator Deployment                        │   │ │
│ │ │                                                    │   │ │
│ │ │ Replicas: 3 (HA with leader election)             │   │ │
│ │ │ Leader Election: Lease resource                   │   │ │
│ │ │                                                    │   │ │
│ │ │ Waking Activities:                                │   │ │
│ │ │ - operator-watch-git (every 60s)                  │   │ │
│ │ │ - operator-optimize-traffic (every 5m)            │   │ │
│ │ │ - operator-auto-promote (every 15m)               │   │ │
│ │ │ - operator-emergency-rollback (every 10s)         │   │ │
│ │ │                                                    │   │ │
│ │ │ RBAC:                                              │   │ │
│ │ │ - ClusterRole: deployments, services, pods        │   │ │
│ │ │ - ClusterRole: virtualservices (Istio)            │   │ │
│ │ │ - ClusterRole: leases (leader election)           │   │ │
│ │ └────────────────────────────────────────────────────┘   │ │
│ │                                                            │ │
│ │ ┌────────────────────────────────────────────────────┐   │ │
│ │ │ Lease (operator-lock)                              │   │ │
│ │ │ holderIdentity: minibob-operator-abc123           │   │ │
│ │ │ leaseDurationSeconds: 15                           │   │ │
│ │ └────────────────────────────────────────────────────┘   │ │
│ │                                                            │ │
│ │ ┌────────────────────────────────────────────────────┐   │ │
│ │ │ Managed Workloads (by operator)                    │   │ │
│ │ │                                                    │   │ │
│ │ │ - activity-api-v1 (deployment + service)           │   │ │
│ │ │ - activity-api-v2 (deployment + service)           │   │ │
│ │ │ - analysis-api-v1 (deployment + service)           │   │ │
│ │ │ - analysis-api-v2 (deployment + service)           │   │ │
│ │ │                                                    │   │ │
│ │ │ VirtualService (Istio traffic routing)             │   │ │
│ │ │ - Weights managed by operator                     │   │ │
│ │ └────────────────────────────────────────────────────┘   │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ istio-system namespace                                     │ │
│ │                                                            │ │
│ │ - Ingress Gateway (traffic entry point)                   │ │
│ │ - Pilot (service discovery + routing)                     │ │
│ │ - Citadel (mTLS certificate management)                   │ │
│ └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

External Services:
- Git Repository (source of truth for desired state)
- SurrealDB (execution traces, metrics, learning)
- Prometheus (metrics collection)
- Grafana (dashboard visualization)
```

### Deployment Recommendations

#### 1. Namespace Strategy

**Recommended**: Single `activity-system` namespace for all components

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: activity-system
  labels:
    istio-injection: enabled  # Enable service mesh
    name: activity-system
```

**Why not separate namespaces?**
- Operator needs RBAC access to managed workloads
- Easier RBAC management (all in one namespace)
- Simpler service discovery (same namespace DNS)
- Industry pattern: Operators often manage resources in same namespace

**Alternative**: Cluster-scoped operator
```yaml
# ClusterRole allows operator to manage any namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: minibob-operator
rules:
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["services", "pods"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
- apiGroups: ["networking.istio.io"]
  resources: ["virtualservices"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
```

#### 2. Leader Election Configuration

**Implementation**:
```typescript
// repos/minibob/src/operator/leader-election.ts
import { KubeConfig, CoordinationV1Api } from '@kubernetes/client-node';

export class LeaderElection {
  private readonly leaseName = 'minibob-operator-lock';
  private readonly namespace = 'activity-system';
  private readonly leaseDuration = 15; // seconds
  private readonly renewDeadline = 10; // seconds
  private readonly retryPeriod = 2; // seconds

  private isLeader = false;
  private identity: string;

  constructor() {
    this.identity = process.env.HOSTNAME || `minibob-${Date.now()}`;
  }

  async start(onStartedLeading: () => void) {
    while (true) {
      try {
        const acquired = await this.tryAcquireLease();

        if (acquired && !this.isLeader) {
          console.log(`[LeaderElection] Became leader: ${this.identity}`);
          this.isLeader = true;
          onStartedLeading();
        }

        if (this.isLeader) {
          await this.renewLease();
        }

        await sleep(this.retryPeriod * 1000);
      } catch (error) {
        console.error('[LeaderElection] Error:', error);
        this.isLeader = false;
        await sleep(this.retryPeriod * 1000);
      }
    }
  }

  private async tryAcquireLease(): Promise<boolean> {
    // Implementation using Kubernetes Lease API
    // Returns true if lease acquired or held
  }

  private async renewLease(): Promise<void> {
    // Renew lease before leaseDuration expires
  }
}
```

**Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minibob-operator
  namespace: activity-system
spec:
  replicas: 3  # HA with leader election
  selector:
    matchLabels:
      app: minibob-operator
  template:
    metadata:
      labels:
        app: minibob-operator
    spec:
      serviceAccountName: minibob-operator
      containers:
      - name: operator
        image: metabob/minibob:latest
        command: ["bun", "run", "operator"]
        env:
        - name: HOSTNAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: LEADER_ELECTION_ENABLED
          value: "true"
        - name: LEADER_ELECTION_NAMESPACE
          value: "activity-system"
```

#### 3. RBAC Configuration

**ServiceAccount + Role + RoleBinding**:
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: minibob-operator
  namespace: activity-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: minibob-operator
rules:
# Deployment management
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

# Service management
- apiGroups: [""]
  resources: ["services"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]

# Pod inspection
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]

# Istio traffic management
- apiGroups: ["networking.istio.io"]
  resources: ["virtualservices", "destinationrules"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]

# Leader election
- apiGroups: ["coordination.k8s.io"]
  resources: ["leases"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: minibob-operator
subjects:
- kind: ServiceAccount
  name: minibob-operator
  namespace: activity-system
roleRef:
  kind: ClusterRole
  name: minibob-operator
  apiGroup: rbac.authorization.k8s.io
```

---

## Cross-Instance and Inter-Vessel Communication

### How MiniBob Architecture Supports This

#### 1. Within Same Cluster (Current Design)

```
┌─────────────────────────────────────────────────────────────┐
│ activity-system namespace                                    │
│                                                              │
│ ┌──────────────────┐                 ┌──────────────────┐  │
│ │ MiniBob Pod 1    │                 │ MiniBob Pod 2    │  │
│ │ (replica 1)      │                 │ (replica 2)      │  │
│ │                  │                 │                  │  │
│ │ Needs impulse:   │                 │ Needs impulse:   │  │
│ │ problemDetection │                 │ errorAnalysis    │  │
│ └────────┬─────────┘                 └────────┬─────────┘  │
│          │                                    │             │
│          │ 1. GET /v2/vessels/discover       │             │
│          │    ?shape=problemDetection         │             │
│          └────────────────┬───────────────────┘             │
│                           ▼                                 │
│              ┌─────────────────────────┐                    │
│              │ Activity-API            │                    │
│              │ (Vessel Discovery)      │                    │
│              │                         │                    │
│              │ Returns:                │                    │
│              │ - analysis-api-v1       │                    │
│              │ - analysis-api-v2       │                    │
│              │ (with health scores)    │                    │
│              └─────────────────────────┘                    │
│                           │                                 │
│          ┌────────────────┴────────────────┐               │
│          │ 2. Direct vessel-to-vessel call │               │
│          │    (mTLS + API key)              │               │
│          ▼                                  ▼               │
│ ┌──────────────────┐              ┌──────────────────┐    │
│ │ analysis-api-v1  │              │ analysis-api-v2  │    │
│ │                  │              │                  │    │
│ │ POST /v2/impulses│              │ POST /v2/impulses│    │
│ │      /resolve    │              │      /resolve    │    │
│ └──────────────────┘              └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Key Points**:
- ✅ All pods in same namespace
- ✅ Vessel discovery via Activity-API
- ✅ Direct pod-to-pod communication (fast)
- ✅ mTLS via Istio (automatic within mesh)
- ✅ Health scores filter unhealthy vessels

#### 2. Across Clusters (Multi-Cluster)

**Scenario**: MiniBob in Cluster A needs to resolve impulse in Cluster B

**Option 1: Service Mesh Federation** (Recommended)

```
┌─────────────────────────────┐         ┌─────────────────────────────┐
│ Cluster A (us-west)         │         │ Cluster B (us-east)         │
│                             │         │                             │
│ ┌─────────────────────┐    │         │    ┌─────────────────────┐ │
│ │ MiniBob Pod         │    │         │    │ analysis-api-v2     │ │
│ │                     │    │         │    │                     │ │
│ │ Resolves:           │    │  Mesh   │    │ Serves:             │ │
│ │ problemDetection    │────┼─────────┼───►│ problemDetection    │ │
│ └─────────────────────┘    │         │    └─────────────────────┘ │
│                             │         │                             │
│ Istio/Cilium Mesh           │         │    Istio/Cilium Mesh        │
│ - Shared control plane      │◄────────┼───►- Shared control plane   │
│ - Cross-cluster routing     │         │    - Cross-cluster routing  │
└─────────────────────────────┘         └─────────────────────────────┘
```

**Implementation using Cilium Cluster Mesh**:
```yaml
# Cluster A configuration
apiVersion: cilium.io/v2
kind: CiliumClusterwideNetworkPolicy
metadata:
  name: allow-cross-cluster
spec:
  endpointSelector: {}
  egress:
  - toEndpoints:
    - matchLabels:
        io.cilium.k8s.policy.cluster: cluster-b
```

**Service Discovery**:
```typescript
// MiniBob queries Activity-API (which is cluster-aware)
const vessels = await fetch('https://activity.metabob.com/v2/vessels/discover?shape=problemDetection');

// Returns vessels across all federated clusters
[
  {
    "id": "analysis-api-v1",
    "endpoint": "https://analysis-api-v1.activity-system.svc.cluster.local",  // Local
    "cluster": "us-west",
    "health_score": 0.95
  },
  {
    "id": "analysis-api-v2",
    "endpoint": "https://analysis-api-v2.activity-system.svc.clusterset.local",  // Remote
    "cluster": "us-east",
    "health_score": 0.92
  }
]

// MiniBob selects best vessel (could be in different cluster)
// Service mesh handles routing transparently
```

**Option 2: Global Load Balancer** (Simpler)

```
┌─────────────────────────────────────────────────────────────┐
│ Global Load Balancer (Cloudflare, AWS Global Accelerator)  │
│                                                              │
│ https://analysis.metabob.com                                │
│ ├─► 50% → Cluster A (us-west)                              │
│ └─► 50% → Cluster B (us-east)                              │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴────────────────────┐
        ▼                                        ▼
┌──────────────────┐                   ┌──────────────────┐
│ Cluster A        │                   │ Cluster B        │
│ analysis-api-v1  │                   │ analysis-api-v2  │
└──────────────────┘                   └──────────────────┘
```

**Advantages**:
- ✅ Simpler than mesh federation
- ✅ Works with any infrastructure
- ✅ Automatic failover

**Disadvantages**:
- ❌ No fine-grained routing control
- ❌ Can't route specific requests to specific clusters
- ❌ Health checks less sophisticated

#### 3. Multi-Tenant Isolation (Cross-Org)

**Requirement**: Org A's MiniBob cannot access Org B's data

**Solution**: SurrealDB PERMISSIONS + API key scoping

```
┌─────────────────────────────────────────────────────────────┐
│ activity-system namespace                                    │
│                                                              │
│ ┌────────────────┐                   ┌────────────────┐    │
│ │ MiniBob        │                   │ MiniBob        │    │
│ │ (Org A)        │                   │ (Org B)        │    │
│ │                │                   │                │    │
│ │ API Key:       │                   │ API Key:       │    │
│ │ key_org_a_123  │                   │ key_org_b_456  │    │
│ └────────┬───────┘                   └────────┬───────┘    │
│          │                                    │             │
│          │ Claims: {org_id: "org-a"}         │             │
│          │                   Claims: {org_id: "org-b"}     │
│          └────────────────┬───────────────────┘             │
│                           ▼                                 │
│              ┌─────────────────────────┐                    │
│              │ Activity-API            │                    │
│              │                         │                    │
│              │ Validates API key       │                    │
│              │ → org_id extracted      │                    │
│              └─────────────────────────┘                    │
│                           │                                 │
│                           ▼                                 │
│              ┌─────────────────────────┐                    │
│              │ SurrealDB               │                    │
│              │                         │                    │
│              │ PERMISSIONS enforce:    │                    │
│              │ WHERE org_id = $auth.   │                    │
│              │                org_id   │                    │
│              └─────────────────────────┘                    │
│                                                              │
│ Result: Org A sees only Org A data                         │
│         Org B sees only Org B data                         │
└─────────────────────────────────────────────────────────────┘
```

**No namespace separation needed**:
- All MiniBob instances run in same namespace
- API key provides org context
- Database enforces isolation via PERMISSIONS
- More efficient than namespace-per-tenant

---

## Recommendations

### 1. Adopt Industry-Standard Operator Pattern with MiniBob Twist

**Deploy MiniBob Operator as**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minibob-operator
  namespace: activity-system
spec:
  replicas: 3  # HA
  selector:
    matchLabels:
      app: minibob-operator
      role: gitops-operator
  template:
    spec:
      serviceAccountName: minibob-operator
      containers:
      - name: operator
        image: metabob/minibob:operator
        command: ["bun", "run", "operator", "--leader-election"]
        env:
        - name: GIT_REPO
          value: "https://github.com/MetabobProject/deployment.git"
        - name: GIT_BRANCH
          value: "main"
        - name: RECONCILE_INTERVAL
          value: "60s"
```

**Why this works**:
- ✅ Standard Kubernetes deployment (familiar to ops teams)
- ✅ Leader election prevents duplicate reconciliation
- ✅ Activities as reconciliation loops (MiniBob innovation)
- ✅ All decisions traced (auditability)

### 2. Use Cilium Cluster Mesh for Multi-Cluster

**If multi-cluster is needed**:
- Use Cilium Cluster Mesh (industry standard 2026)
- Vessel discovery returns cross-cluster endpoints
- Service mesh handles mTLS and routing transparently
- MiniBob doesn't need to know about cluster boundaries

**Implementation**:
```bash
# Connect clusters via Cilium
cilium clustermesh enable
cilium clustermesh connect --context cluster-a --destination-context cluster-b
```

### 3. Progressive Delivery with Thompson Sampling

**Keep MiniBob's innovation**:
- Thompson Sampling is superior to fixed Flagger weights
- Industry uses Prometheus metrics; MiniBob uses execution traces
- Combine both: Thompson Sampling + Prometheus for full observability

**Hybrid approach**:
```typescript
// Collect both Prometheus metrics and execution traces
const prometheusMetrics = await queryPrometheus('http_requests_total');
const executionTraces = await querySurrealDB('SELECT * FROM execution');

// Use both for Thompson Sampling
const alpha = executionTraces.successCount + prometheusMetrics.successCount;
const beta = executionTraces.failureCount + prometheusMetrics.failureCount;

const weights = thompsonSampling({alpha, beta});
```

### 4. Single Namespace with PERMISSIONS-Based Isolation

**Don't use namespace-per-tenant**:
- Activity-API already enforces multi-tenancy via SurrealDB PERMISSIONS
- All MiniBob instances can run in `activity-system` namespace
- API key provides org context
- More efficient resource usage

### 5. Leverage Existing Infrastructure

**Use what's already deployed**:
- ✅ Istio for service mesh (already configured)
- ✅ SurrealDB for state storage (already deployed)
- ✅ Prometheus for metrics (industry standard)
- ✅ MiniBob activities for reconciliation (dogfooding)

---

## Final Architecture Recommendation

```
┌─────────────────────────────────────────────────────────────────┐
│ Kubernetes Cluster (GKE Production)                             │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ activity-system namespace                                  │ │
│ │                                                            │ │
│ │ ┌────────────────────────────────────────────────────┐   │ │
│ │ │ MiniBob Operator (3 replicas, leader election)    │   │ │
│ │ │                                                    │   │ │
│ │ │ Waking Activities (only leader executes):         │   │ │
│ │ │ - operator-watch-git (60s) → Git polling          │   │ │
│ │ │ - operator-optimize-traffic (5m) → Thompson Samp. │   │ │
│ │ │ - operator-auto-promote (15m) → Progressive roll  │   │ │
│ │ │ - operator-emergency-rollback (10s) → Failover    │   │ │
│ │ └────────────────────────────────────────────────────┘   │ │
│ │                                                            │ │
│ │ Managed Workloads:                                         │ │
│ │ ├── activity-api-v1 (45% traffic)                         │ │
│ │ ├── activity-api-v2 (55% traffic)                         │ │
│ │ ├── analysis-api-v1 (60% traffic)                         │ │
│ │ └── analysis-api-v2 (40% traffic)                         │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ istio-system namespace (Service Mesh)                      │ │
│ │ - Ingress Gateway → https://activity.metabob.com          │ │
│ │ - VirtualServices (traffic weights updated by operator)    │ │
│ │ - mTLS certificates (automatic via Citadel)               │ │
│ └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

External:
- Git: Source of truth (desired-state.yaml)
- SurrealDB: Execution traces, variant metrics
- Prometheus: System metrics (optional, complementary)
- Grafana: Dashboards (execution traces + Prometheus)
```

**Key Characteristics**:
- ✅ Industry-standard deployment pattern (Kubernetes Deployment)
- ✅ MiniBob innovation (activities as reconciliation, Thompson Sampling)
- ✅ Leader election for HA (standard Lease-based)
- ✅ Single namespace (efficiency, simpler RBAC)
- ✅ Service mesh for cross-vessel communication (Istio)
- ✅ Multi-tenant isolation via PERMISSIONS (not namespaces)
- ✅ Traceable decisions (execution traces)

---

## Sources

- [GitOps for Azure Kubernetes Service](https://learn.microsoft.com/en-us/azure/architecture/example-scenario/gitops-aks/gitops-blueprint-aks)
- [Kubernetes Deployment Automation with ArgoCD and Flux](https://dasroot.net/posts/2026/04/kubernetes-deployment-automation-argocd-flux/)
- [GitOps with ArgoCD and Flux: Deploying Kubernetes Applications the Right Way in 2026](https://devstarsj.github.io/2026/03/18/gitops-argocd-flux-kubernetes-guide-2026/)
- [Flux vs Argo CD: Which GitOps tool fits your Kubernetes workflows best?](https://northflank.com/blog/flux-vs-argo-cd)
- [GitOps 2026 Complete Guide](https://calmops.com/devops/gitops-2026-complete-guide/)
- [Kubernetes Operator Pattern](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/)
- [Building Custom Kubernetes Operators with Kubebuilder](https://dasroot.net/posts/2026/03/kubernetes-operators-building-custom-controllers-kubebuilder/)
- [Understanding the Kubernetes Operator Pattern](https://oneuptime.com/blog/post/2026-02-20-kubernetes-operator-pattern/view)
- [Kubernetes Leader Election](https://kubernetes.io/docs/concepts/cluster-administration/coordinated-leader-election/)
- [Namespace-Scoped Operators with Leader Election](https://oneuptime.com/blog/post/2026-02-09-namespace-scoped-operators-leader/view)
- [Cilium Cluster Mesh](https://docs.tigera.io/use-cases/cluster-mesh)
- [Kubernetes Multi-Tenancy](https://kubernetes.io/docs/concepts/security/multi-tenancy/)
- [Kubernetes Multi-Cluster Service Mesh](https://www.infoq.com/articles/kubernetes-multicluster-comms/)

---

**End of Industry Comparison Document**
