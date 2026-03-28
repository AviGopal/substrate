# Demonstrating minibob in Your Environment

## Current Environment Status

**Cluster**: Kubernetes (Docker Desktop) ✅  
**Existing Namespaces**: `metabob`, `testing-minibob` ✅  
**Available Tools**: helmfile, helm, docker, bun ✅

## 3-Level Demonstration Plan

### Level 1: Local Validation (5 minutes) ⚡
**No deployment required** - Validates infrastructure works

### Level 2: Single Pod (15 minutes) 🚀 **RECOMMENDED**
**Light deployment** - Shows self-configuration and core capabilities

### Level 3: Full Cluster (45 minutes) 🎯
**Complete system** - Shows ACP, boredom, and autonomous refinement

---

## Level 1: Local Validation (START HERE)

### Step 1: Run Meta-Validation

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Validate the validators
bun run tests/validation-harnesses/run-meta-validation.ts
```

**Observable**: ✅ 10/10 validation steps pass without deployment

### Step 2: Check Prerequisites

```bash
# See what's ready vs what needs deployment
bun run tests/validation-harnesses/lib/prerequisites.ts
```

**Observable**: Clear checklist showing cluster available, deployment needed


---

## Level 2: Single Pod Validation (RECOMMENDED)

### Step 1: Deploy Single minibob Pod

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/helm

# Deploy to existing testing-minibob namespace
helmfile -e testing sync -l namespace=testing-minibob

# Check pod status
kubectl get pods -n testing-minibob
```

**Observable**: 1 minibob pod running

### Step 2: Observe Self-Configuration

```bash
# Check logs for auto-detection
kubectl logs -n testing-minibob minibob-0 | head -50
```

**Observable**: Logs show "Environment: Kubernetes", "Mode: Single-pod", capabilities auto-configured

### Step 3: Check Health Endpoint

```bash
# Port-forward
kubectl port-forward -n testing-minibob minibob-0 8080:8080 &

# Query health
curl http://localhost:8080/health | jq .
```

**Observable**: JSON shows auto-detected environment and capabilities

### Step 4: Run Validation Tests

```bash
cd ../repos/minibob
./scripts/test-vessel-capabilities.sh testing-minibob
```

**Observable**: 2-3 tests pass (ACP skipped in single-pod mode)

---

## Level 3: Full Cluster Demonstration

### Deploy 3-Pod Cluster

```bash
cd helm
helmfile -e testing sync -l namespace=minibob-cluster

kubectl get pods -n minibob-cluster
```

**Observable**: 3 minibob pods running, ACP auto-enabled, boredom activated

### Test ACP Delegation

```bash
cd ../repos/minibob
./scripts/test-vessel-capabilities.sh minibob-cluster
```

**Observable**: All 4 tests pass including ACP delegation between pods

### Observe Boredom System

```bash
kubectl logs -n minibob-cluster minibob-0 -f | grep -i boredom
```

**Observable**: After 60s idle, boredom activates and runs self-improvement

---

## Quick Demo (15 minutes)

```bash
# 1. Meta-validation (2 min)
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run tests/validation-harnesses/run-meta-validation.ts

# 2. Deploy single pod (5 min)
cd helm && helmfile -e testing sync -l namespace=testing-minibob
kubectl wait --for=condition=ready pod -n testing-minibob --all --timeout=300s

# 3. Check self-configuration (2 min)
kubectl logs -n testing-minibob minibob-0 | head -50
kubectl port-forward -n testing-minibob minibob-0 8080:8080 &
curl http://localhost:8080/health | jq .

# 4. Run tests (5 min)
cd ../repos/minibob
./scripts/test-vessel-capabilities.sh testing-minibob

# 5. Review results (1 min)
ls -la metrics/
```

**Proves**: minibob self-configures, validates, and operates autonomously

