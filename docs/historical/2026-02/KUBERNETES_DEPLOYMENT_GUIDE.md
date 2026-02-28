# Kubernetes Deployment Activities Guide

**Date**: 2026-02-26  
**Purpose**: Deploy DevBob platform to Kubernetes using helmfile and repos/platform structure

---

## Overview

This guide documents how to deploy the DevBob platform to Kubernetes clusters managed by helmfile. The deployment uses:
- **Environment configuration** from `.env` (ANTHROPIC_API_KEY, METABOB_API_KEY, etc.)
- **Platform repository** at `repos/platform` (helmfile, terraform, configs)
- **Kubernetes contexts**: metabob-ops-k8s, metabob-development-k8s, metabob-production-k8s, metabob-research-k8s
- **Helmfile** for declarative deployments with environment-specific values

---

## Quick Start

### 1. Prerequisites
```bash
# Install required tools
brew install kubectl helm helmfile sops kubectx

# Verify versions
kubectl version --client
helm version
helmfile --version
sops --version

# Check .env file exists with API keys
test -f .env && echo "✅ .env found" || echo "❌ .env missing"
```

### 2. Setup Kubectl Contexts
```bash
cd repos/platform/infrastructure
make setup-kubectx

# Verify contexts
kubectx | grep metabob
# Should show:
#   metabob-ops-k8s
#   metabob-development-k8s
#   metabob-production-k8s
#   metabob-research-k8s
```

### 3. Deploy to Environment
```bash
# Load environment variables
set -a; source .env; set +a

# Switch to target environment
kubectx metabob-research-k8s

# Deploy platform services
cd repos/platform/deployments/platform
helmfile -e research diff    # Preview changes
helmfile -e research sync    # Apply changes

# Check deployment
kubectl get pods -n default
```

---

## Deployment Architecture

### Directory Structure
```
repos/platform/
├── environments/              # Environment-specific configs
│   ├── ops/
│   │   ├── config.yaml       # Ops environment values
│   │   └── secrets.yaml      # SOPS-encrypted secrets
│   ├── development/
│   ├── production/
│   └── research/
├── deployments/               # Workload-specific helmfiles
│   ├── ops/                  # ArgoCD, monitoring
│   ├── platform/             # Core platform services
│   ├── metabob/              # Metabob application
│   └── research/             # Research workloads
└── infrastructure/           # Terraform IaC
    └── Makefile              # Infrastructure automation
```

### Environment Mapping
| Environment | Context | Namespace | Use Case |
|-------------|---------|-----------|----------|
| ops | metabob-ops-k8s | argocd | Platform services, ArgoCD |
| development | metabob-development-k8s | metabob | Dev testing |
| production | metabob-production-k8s | metabob | Production workloads |
| research | metabob-research-k8s | default | Research experiments |

---

## Activity: deploy-to-kubernetes

**File**: `.metabob/activities/deploy-to-kubernetes.json` (partial - needs completion)

**Purpose**: Deploy services to Kubernetes using helmfile with full validation and health checks

### Task Flow
1. **validate-prerequisites**: Check tools, .env, platform repo, kubectl context, cluster access
2. **load-environment**: Source .env, validate secrets, create K8s secrets, check SOPS
3. **helmfile-diff**: Preview changes, analyze diff, flag risky changes, require approval
4. **helmfile-sync**: Apply deployment, monitor progress, validate health
5. **verify-deployment**: Check pods, services, ingresses, run smoke tests

### Variables
```typescript
{
  environment: "ops" | "development" | "production" | "research",  // Required
  workload: "platform" | "metabob" | "ops" | "",                  // Optional
  namespace: "default" | "metabob" | "argocd",                     // Optional
  loadSecrets: boolean,                                            // Default: true
  requireApproval: boolean,                                        // Default: false (true for prod)
  diffArgs: string,                                                // Default: "--detailed-exitcode"
  syncArgs: string,                                                // Default: ""
  healthCheckTimeout: number                                       // Default: 300 seconds
}
```

### Usage Examples

#### Deploy Platform Services to Research
```bash
opencode activity execute deploy-to-kubernetes \
  --variables '{
    "environment": "research",
    "workload": "platform",
    "namespace": "default",
    "loadSecrets": true
  }' \
  --reason "Deploy platform services to research environment for testing"
```

#### Deploy to Production (with approval)
```bash
opencode activity execute deploy-to-kubernetes \
  --variables '{
    "environment": "production",
    "workload": "metabob",
    "namespace": "metabob",
    "requireApproval": true,
    "loadSecrets": true
  }' \
  --reason "Deploy metabob application to production after successful testing"
```

---

## Manual Deployment Workflow

### Step 1: Validate Prerequisites
```bash
# Check tools
kubectl version --client
helmfile --version
helm version
sops --version

# Check .env
test -f .env && echo "✅ .env exists"
grep -q "ANTHROPIC_API_KEY=" .env && echo "✅ ANTHROPIC_API_KEY set"
grep -q "METABOB_API_KEY=" .env && echo "✅ METABOB_API_KEY set"

# Check platform repo
test -d repos/platform && echo "✅ platform repo exists"
test -f repos/platform/environments/research/config.yaml && echo "✅ research config exists"

# Check kubectl context
kubectl config get-contexts | grep metabob-research-k8s && echo "✅ context exists"
```

### Step 2: Load Environment
```bash
# Source .env
set -a
source .env
set +a

# Verify loaded
echo "ANTHROPIC_API_KEY length: ${#ANTHROPIC_API_KEY}"
echo "METABOB_API_KEY length: ${#METABOB_API_KEY}"

# Create Kubernetes secrets
kubectl create namespace default --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic anthropic-api-key \
  --from-literal=api-key="$ANTHROPIC_API_KEY" \
  --namespace=default \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic metabob-api-key \
  --from-literal=api-key="$METABOB_API_KEY" \
  --namespace=default \
  --dry-run=client -o yaml | kubectl apply -f -

# Verify secrets
kubectl get secrets -n default | grep -E "(anthropic|metabob)"
```

### Step 3: Preview Deployment
```bash
# Switch to correct context
kubectx metabob-research-k8s

# Navigate to workload
cd repos/platform/deployments/platform

# Run helmfile diff
helmfile -e research diff --detailed-exitcode

# Save diff to file
helmfile -e research diff > helmfile-diff-$(date +%Y%m%d-%H%M%S).txt

# Analyze changes
grep -E "^[+-]" helmfile-diff-*.txt | wc -l  # Count changes
grep "image:" helmfile-diff-*.txt            # Check image updates
```

### Step 4: Apply Deployment
```bash
# Apply changes
helmfile -e research sync

# Monitor deployment
watch kubectl get pods -n default

# Check logs
kubectl logs -f <pod-name> -n default
```

### Step 5: Verify Deployment
```bash
# Check all resources
kubectl get all -n default

# Check specific deployments
kubectl get deployments -n default
kubectl get services -n default
kubectl get ingresses -n default

# Verify pods are running
kubectl get pods -n default --field-selector=status.phase!=Running

# Check pod logs for errors
kubectl logs --selector=app=<app-name> -n default --tail=50 | grep -i error
```

---

## Environment-Specific Configurations

### .env File Structure
```bash
# Core API Keys (required)
ANTHROPIC_API_KEY=sk-ant-api03-...
METABOB_API_KEY=mb_devbob_test_simple_2026_v2

# Slack Integration (optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...

# Database (if needed)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Custom configs
ENVIRONMENT=research
CLUSTER_NAME=metabob-research-k8s
```

### Helmfile Environment Values

**Location**: `repos/platform/deployments/<workload>/environments/<env>.values.yaml`

**Example** (`research.values.yaml`):
```yaml
# Global configuration
global:
  environment: research
  domain: research.metabob.dev
  
# Resource limits
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

# Replicas
replicaCount: 1  # Single replica for research

# Image configuration
image:
  pullPolicy: IfNotPresent
  
# Feature flags
features:
  debug: true
  monitoring: true
  tracing: false
```

---

## SOPS Secret Management

### Encrypt Secrets
```bash
cd repos/platform/environments/research

# Edit secrets (will auto-encrypt on save)
sops secrets.yaml

# Or encrypt existing file
sops -e secrets.yaml > secrets.enc.yaml
```

### Decrypt Secrets (for debugging)
```bash
# Decrypt to stdout
sops -d secrets.yaml

# Decrypt to file
sops -d secrets.yaml > secrets.dec.yaml

# Never commit decrypted files!
```

### SOPS Configuration
**File**: `repos/platform/environments/<env>/.sops.yaml`

```yaml
creation_rules:
  - path_regex: secrets\.yaml$
    encrypted_regex: ^(data|stringData)$
    gcp_kms: projects/metabob/locations/global/keyRings/sops/cryptoKeys/sops-key
    # Or use age:
    # age: age1...
```

---

## Helmfile Commands Reference

### Basic Operations
```bash
# List releases
helmfile -e <env> list

# Show template output
helmfile -e <env> template

# Preview changes
helmfile -e <env> diff

# Apply changes
helmfile -e <env> sync

# Sync specific release
helmfile -e <env> sync --selector name=<release-name>

# Delete releases
helmfile -e <env> destroy
```

### Advanced Operations
```bash
# Sync with concurrency
helmfile -e <env> sync --concurrency 3

# Skip tests
helmfile -e <env> sync --skip-tests

# Force update
helmfile -e <env> sync --force

# Dry run
helmfile -e <env> apply --dry-run
```

---

## Deployment Validation

### Health Check Script
```bash
#!/bin/bash
# check-deployment-health.sh

NAMESPACE="${1:-default}"
TIMEOUT=300
START_TIME=$(date +%s)

echo "Checking deployment health in namespace: $NAMESPACE"

while true; do
  # Get pod status
  NOT_RUNNING=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running --no-headers 2>/dev/null | wc -l)
  
  if [ "$NOT_RUNNING" -eq 0 ]; then
    echo "✅ All pods running"
    break
  fi
  
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))
  
  if [ $ELAPSED -gt $TIMEOUT ]; then
    echo "❌ Timeout waiting for pods to be ready"
    kubectl get pods -n "$NAMESPACE"
    exit 1
  fi
  
  echo "⏳ Waiting for pods... ($NOT_RUNNING not running, ${ELAPSED}s elapsed)"
  sleep 5
done

# Check for errors in logs
echo ""
echo "Checking logs for errors..."
kubectl logs --selector=app.kubernetes.io/name -n "$NAMESPACE" --tail=100 --timestamps | grep -i error || echo "✅ No errors in recent logs"

# Check services
echo ""
echo "Services:"
kubectl get services -n "$NAMESPACE"

# Check ingresses
echo ""
echo "Ingresses:"
kubectl get ingresses -n "$NAMESPACE" 2>/dev/null || echo "No ingresses"

echo ""
echo "✅ Deployment health check complete"
```

---

## Troubleshooting

### Common Issues

#### 1. Context Not Found
```bash
# Problem: kubectl context doesn't exist
# Solution: Setup contexts
cd repos/platform/infrastructure
make setup-kubectx

# Verify
kubectx | grep metabob
```

#### 2. Cannot Connect to Cluster
```bash
# Problem: kubectl cannot reach cluster
# Check: VPN connected, cluster running, credentials valid

# Test connectivity
kubectl cluster-info

# Check credentials
kubectl config view --minify

# Refresh credentials (DigitalOcean)
doctl kubernetes cluster kubeconfig save <cluster-name>
```

#### 3. Secrets Not Decrypted
```bash
# Problem: SOPS cannot decrypt secrets
# Check: SOPS keys, GCP credentials

# Test decryption
sops -d repos/platform/environments/research/secrets.yaml

# Check SOPS config
cat repos/platform/environments/research/.sops.yaml

# Verify GCP credentials
gcloud auth list
```

#### 4. Helmfile Fails
```bash
# Problem: helmfile sync fails
# Debug steps:

# 1. Check helmfile syntax
helmfile -e research lint

# 2. Check template rendering
helmfile -e research template > /tmp/rendered.yaml
cat /tmp/rendered.yaml

# 3. Check helm values
helm template <release-name> <chart-path> -f values.yaml

# 4. Check cluster access
kubectl get nodes
```

#### 5. Pods Not Starting
```bash
# Problem: Pods stuck in Pending/CrashLoopBackOff

# Check pod status
kubectl describe pod <pod-name> -n default

# Check events
kubectl get events -n default --sort-by='.lastTimestamp'

# Check logs
kubectl logs <pod-name> -n default --previous  # Previous container logs

# Check resources
kubectl top nodes
kubectl top pods -n default

# Check image pull
kubectl get pods -n default -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.containerStatuses[*].state}{"\n"}{end}'
```

---

## Next Steps

1. **Complete Activity**: Finish implementing `deploy-to-kubernetes.json` with:
   - helmfile-sync task
   - verify-deployment task
   - rollback logic
   - health check validation

2. **Create Additional Activities**:
   - `provision-kubernetes-cluster`: Terraform-based cluster provisioning
   - `promote-configuration`: Promote configs between environments
   - `rollback-deployment`: Rollback to previous version
   - `scale-deployment`: Scale replicas up/down

3. **Integration**:
   - ArgoCD GitOps workflow
   - GitHub Actions CI/CD
   - Monitoring and alerting
   - Automated testing

4. **Testing**:
   - Test deployment to research environment
   - Verify health checks
   - Test rollback procedures
   - Validate multi-environment workflows

---

## References

- [Platform README](repos/platform/README.md)
- [Deployment Rules](repos/platform/DEPLOYMENT-RULES.md)
- [Deployment Quick Start](repos/platform/DEPLOYMENT-QUICK-START.md)
- [Kubectl Context Setup](repos/platform/docs/KUBECTX-SETUP.md)
- [GitHub CI/CD Setup](repos/platform/docs/GITHUB-CICD-SETUP.md)

---

**Status**: ✅ Kubernetes deployment activities framework created  
**Next**: Complete activity implementation and test end-to-end
