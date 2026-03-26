# Production Deployment Analysis & Next Steps

**Date**: 2026-03-02  
**Purpose**: Compare current code state with production deployment and identify required updates

---

## Executive Summary

### Critical Finding: Production is Broken
- 🔴 **Production Status**: `opencode-server` pod in **CrashLoopBackOff** for 5+ days
- 🔴 **Error**: `Exit Code 126` - Permission denied: `/usr/local/bin/bun: Permission denied`
- 🔴 **Image**: `metabobapp/devbob:v1.0.0` (OUTDATED)
- 🔴 **Chart**: `opencode-server-1.0.0` (should be renamed to `devbob`)

### Code vs Production Gap
| Component | Current Code | Production | Status |
|-----------|--------------|------------|--------|
| **OpenCode** | `spec-impulse-learning-in-rpc-api-only-v1-3-g4077374e` | `v1.0.0` | ❌ Very outdated |
| **RPC API** | `spec-async-ripple-surrealdb-v1` (SurrealDB official lib) | Unknown | ❓ Needs check |
| **Platform** | `4803b14` (GITHUB_TOKEN support) | Older | ⚠️ Out of sync |
| **Image Tag** | Should be `v1.0.64` (from package.json) | `v1.0.0` | ❌ Outdated |
| **Chart Name** | `devbob` | `opencode-server` | ⚠️ Naming mismatch |

### Immediate Actions Required
1. ✅ Fix permission issue in production image
2. ✅ Build and push new image from current code
3. ✅ Update production helmfile to use new image
4. ✅ Rename `opencode-server` → `devbob` in production
5. ✅ Verify RPC API is updated with SurrealDB changes

---

## Production Current State

### Kubernetes Context
- **Cluster**: `gke_metabob_us-west2_production`
- **Namespace**: `metabob`
- **Context**: `metabob-production`

### Deployed Services (Helm Releases)
```
NAME               REVISION  UPDATED              STATUS    CHART VERSION        APP VERSION
opencode-server    5         2026-02-18 20:07     deployed  opencode-server-1.0.0  1.0.0
metabob-rpc-api    48        2026-02-16 11:33     deployed  metabob-rpc-api-0.2.0  0.16.0
slack-bot          6         2026-02-18 00:40     deployed  slack-bot-1.0.0        1.0.0
surrealdb          3         2026-02-17 22:19     deployed  surrealdb-0.1.0        2.3.10
redis              6         2026-01-13 20:02     deployed  redis-17.11.8          7.0.12
metabob-dashboard  16        2026-01-17 04:28     deployed  metabob-dashboard-...  0.2.23
```

### Pod Status
```
NAME                                READY   STATUS             RESTARTS       AGE
opencode-server-bb4f6cbc4-dw22c     1/2     CrashLoopBackOff   1432 (recent)  5d2h
slack-bot-xxx                       1/1     Running            -              12d
```

**Critical Issue**: `opencode-server` has crashed 1432 times over 5 days!

### Crash Details
```
Container: opencode-server
Image: metabobapp/devbob:v1.0.0
Command: opencode serve --hostname=0.0.0.0 --port=8080
State: Waiting (CrashLoopBackOff)
Last Exit Code: 126 (Permission denied)
Error: /usr/local/bin/opencode: line 2: /usr/local/bin/bun: Permission denied
```

**Root Cause**: The `v1.0.0` image has incorrect permissions on the Bun executable.

---

## Current Code State

### Repository Versions

#### 1. metabob-opencode (DevBob)
**Current Commit**: `4077374e` - "Test: Vessel pre-activity baseline commit"  
**Tag**: `spec-impulse-learning-in-rpc-api-only-v1-3-g4077374e`  
**Package Version**: `1.0.64` (from package.json)

**Recent Changes** (last 5 commits):
1. Test: Vessel pre-activity baseline commit
2. feat: implement nested activity message forwarding system
3. refactor(impulse-learning): Reduce to data collection only
4. feat(impulse-learning): Enforce architectural boundary - learning in rpc-api only
5. Enforce complete architecture separation: remove ML logic from execution layer

**Key Features Added Since v1.0.0**:
- ✅ Nested activity message forwarding
- ✅ Impulse learning moved to RPC API (architectural separation)
- ✅ Activity vessel system
- ✅ Complete architecture refactoring
- ✅ Improved ACP delegation

#### 2. metabob-rpc-api
**Current Commit**: `36f66c9` - "feat(rpc-api): Complete Async Ripple Changes for SurrealDB Official Library"  
**Tag**: `spec-async-ripple-surrealdb-v1`

**Recent Changes** (last 5 commits):
1. Complete Async Ripple Changes for SurrealDB Official Library
2. Replace custom SurrealDB client with official library (fixes variant_id persistence)
3. Add POST /v2/activities/templates/{id}/metrics endpoint
4. Remove unused surrealdb-py dependency
5. Fix get_templates_by_activity_id return logic

**CRITICAL**: RPC API now uses **official SurrealDB library** - production must be updated!

#### 3. platform/metabob-apps (Helm Charts)
**Current Commit**: `4803b14` - "Add GITHUB_TOKEN support to devbob deployment"  
**Branch**: `feat/add-redis-to-dev-storage` (ahead of origin by 10 commits)

**Recent Changes** (last 5 commits):
1. Add GITHUB_TOKEN support to devbob deployment
2. Fix devbob K8s deployment configuration
3. Add --print-logs flag to devbob ACP server command
4. Rename opencode-server to devbob (local charts)
5. Fix opencode-server deployment: set HOME env var

**Key Chart Updates**:
- ✅ Renamed to `devbob` (but production still uses `opencode-server`)
- ✅ Added GITHUB_TOKEN secret support
- ✅ Fixed HOME environment variable
- ✅ Improved security context

---

## Image Comparison

### Production Image: `metabobapp/devbob:v1.0.0`
**Issues**:
- ❌ Permission error on `/usr/local/bin/bun`
- ❌ Very old code (pre-vessel, pre-refactoring)
- ❌ Missing architectural improvements
- ❌ Missing SurrealDB official library support

### Local Image: `devbob:latest`
**Status**: Built from `Dockerfile.devbob-local`
- ✅ Works in local K8s (docker-desktop)
- ✅ Based on current code
- ✅ Has proper permissions
- ⚠️ Not pushed to registry (metabobapp/devbob)

### Required Image: `metabobapp/devbob:v1.0.64`
**Should Include**:
- ✅ OpenCode v1.0.64 from package.json
- ✅ Current code (4077374e)
- ✅ Proper Bun permissions
- ✅ All recent architectural improvements
- ✅ Compatible with SurrealDB official library

---

## Helmfile Comparison

### Local Helmfile (`repos/platform/metabob-apps/helmfile.yaml.gotmpl`)
```yaml
environments:
  default:      # docker-desktop
  integration:  # metabob-integration
  production:   # metabob-production

releases:
  - name: devbob  # NEW NAME
    namespace: metabob
    chart: charts/devbob/charts
    values:
      - charts/devbob/values/{{ .environmentName }}.devbob.values.yaml
      - charts/devbob/values/{{ .environmentName }}.devbob.secrets.yaml
```

### Production Deployed
```yaml
# Actual helm release name: opencode-server (OLD)
# Chart: opencode-server-1.0.0
# Image: metabobapp/devbob:v1.0.0
```

**Gap**: Production uses old chart name and old image.

---

## Configuration Comparison

### Production Values (`production.devbob.values.yaml`)
```yaml
image:
  repository: metabobapp/devbob
  tag: "v1.0.1"  # Chart says this, but deployed is v1.0.0

resources:
  limits:
    cpu: 1000m
    memory: 2Gi
  requests:
    cpu: 250m
    memory: 1Gi

opencode:
  config:
    metabob:
      enabled: true
      max_issues: 5
      min_severity: "MEDIUM"
      inject_annotations: true
      auto_impact_analysis: true
      template_auto_registration:
        enabled: true
```

### Default Values (`default.devbob.values.yaml`)
```yaml
image:
  repository: metabobapp/devbob
  tag: "latest"

resources:
  limits:
    cpu: 500m
    memory: 1Gi
  requests:
    cpu: 100m
    memory: 256Mi

opencode:
  config:
    metabob:
      enabled: false  # Disabled for local
```

**Key Differences**:
| Setting | Production | Default/Local |
|---------|-----------|---------------|
| Image tag | `v1.0.1` (but deployed v1.0.0) | `latest` |
| CPU limit | 1000m | 500m |
| Memory limit | 2Gi | 1Gi |
| Metabob enabled | ✅ Yes | ❌ No |
| Auto-registration | ✅ Yes | ❌ No |
| Service type | ClusterIP | NodePort |

---

## Root Cause Analysis: Production Failure

### The Permission Error
```
/usr/local/bin/opencode: line 2: /usr/local/bin/bun: Permission denied
Exit Code: 126
```

**Diagnosis**:
1. The `opencode` wrapper script tries to execute Bun
2. Bun binary lacks execute permissions
3. Container runs as non-root in production (Istio sidecar enforces this)
4. Security context mismatch between image build and runtime

### Why Local Works But Production Fails
| Aspect | Local (docker-desktop) | Production (GKE) |
|--------|------------------------|------------------|
| Security context | `runAsUser: 0` (root) | `runAsUser: 1337` (istio-proxy) |
| Istio sidecar | ❌ No | ✅ Yes |
| Bun permissions | Inherited from root | Restricted |
| ReadOnlyRootFS | `false` | Attempted `true` (failed) |

### The Fix
**In Dockerfile**:
```dockerfile
# Ensure Bun is executable by all users
RUN chmod +x /root/.bun/bin/bun && \
    chmod +x /opt/opencode/bin/opencode
```

**In Helm values** (production):
```yaml
securityContext:
  runAsNonRoot: false  # Or ensure Bun is installed in non-root location
  runAsUser: 0
  readOnlyRootFilesystem: false
```

---

## Image Build Requirements

### What Needs to Be Built

#### 1. DevBob Image (`metabobapp/devbob:v1.0.64`)
**Source**: `repos/metabob-opencode` (commit 4077374e)  
**Dockerfile**: `Dockerfile.devbob-local` (needs adjustments for production)

**Build Process**:
```bash
# 1. Build OpenCode binary
cd repos/metabob-opencode/packages/opencode
bun run build  # Creates dist/opencode-linux-x64/bin/opencode

# 2. Build Docker image
cd /home/avi/documents/work/exp-repo/metabob-devbob
docker build -f Dockerfile.devbob-local -t metabobapp/devbob:v1.0.64 .

# 3. Fix permissions in Dockerfile (ADD THIS)
RUN chmod +x /root/.bun/bin/bun && \
    chmod 755 /opt/opencode/bin/opencode

# 4. Test locally
docker run -it metabobapp/devbob:v1.0.64 opencode --version

# 5. Push to registry
docker push metabobapp/devbob:v1.0.64
docker tag metabobapp/devbob:v1.0.64 metabobapp/devbob:latest
docker push metabobapp/devbob:latest
```

#### 2. RPC API Image (if needed)
**Source**: `repos/metabob-rpc-api` (commit 36f66c9)  
**Critical**: Uses **official SurrealDB library** now

**Check if production needs update**:
```bash
kubectl config use-context metabob-production
kubectl get deployment metabob-rpc-api -n metabob -o yaml | grep image:
# Compare with latest code
```

---

## Migration Plan: Fixing Production

### Phase 1: Emergency Fix (TODAY - 2-3 hours)

#### Step 1: Build Fixed Image [30 minutes]
```bash
# Fix Dockerfile permissions
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Update Dockerfile.devbob-local - add after Bun installation:
# RUN chmod +x /root/.bun/bin/bun && \
#     ln -s /root/.bun/bin/bun /usr/local/bin/bun && \
#     chmod 755 /opt/opencode/bin/opencode

# Build
docker build -f Dockerfile.devbob-local -t metabobapp/devbob:v1.0.64 .

# Test locally with non-root user
docker run --user 1000 metabobapp/devbob:v1.0.64 opencode --version
```

#### Step 2: Push to Registry [10 minutes]
```bash
# Login to Docker Hub
docker login

# Push versioned image
docker push metabobapp/devbob:v1.0.64

# Tag and push latest
docker tag metabobapp/devbob:v1.0.64 metabobapp/devbob:latest
docker push metabobapp/devbob:latest
```

#### Step 3: Update Production Helm Values [15 minutes]
```bash
cd repos/platform/metabob-apps

# Edit charts/devbob/values/production.devbob.values.yaml
# Change:
#   tag: "v1.0.1"  → tag: "v1.0.64"

# Commit change
git add charts/devbob/values/production.devbob.values.yaml
git commit -m "fix(devbob): Update production image to v1.0.64 with permission fix"
```

#### Step 4: Deploy to Production [15 minutes]
```bash
# Switch to production context
kubectl config use-context metabob-production

# Deploy using helmfile
cd repos/platform/metabob-apps
helmfile -e production apply --selector name=opencode-server

# Or direct helm upgrade
helm upgrade opencode-server charts/opencode-server/charts \
  -f charts/devbob/values/production.devbob.values.yaml \
  -f charts/devbob/values/production.devbob.secrets.yaml \
  -n metabob
```

#### Step 5: Verify Fix [15 minutes]
```bash
# Watch pod restart
kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server -w

# Check logs
kubectl logs -f deployment/opencode-server -n metabob

# Verify it's running
kubectl exec -it deployment/opencode-server -n metabob -- opencode --version
# Should output: 1.0.64

# Test health endpoint
kubectl exec -it deployment/opencode-server -n metabob -- curl localhost:8080/health
```

### Phase 2: Rename Chart (THIS WEEK - 1-2 hours)

#### Step 1: Prepare Chart Rename [30 minutes]
The helmfile already uses `devbob` but production deployed as `opencode-server`.

**Options**:
1. **Keep old name** (`opencode-server`) - avoid disruption
2. **Rename gradually** - deploy new chart alongside old, migrate
3. **Force rename** - delete old, deploy new (risky)

**Recommended**: Option 1 (keep opencode-server in production for now)

```bash
# Rename chart directory to match production
cd repos/platform/metabob-apps/charts
cp -r devbob opencode-server

# Or update helmfile to use old name in production
# helmfile.yaml.gotmpl:
# - name: {{ if eq .Environment.Name "production" }}opencode-server{{ else }}devbob{{ end }}
```

#### Step 2: Update Helmfile for Production [30 minutes]
```bash
# Option A: Conditional release name
releases:
  - name: {{ if eq .Environment.Name "production" }}opencode-server{{ else }}devbob{{ end }}
    namespace: metabob
    chart: charts/devbob/charts
    values:
      - charts/devbob/values/{{ .environmentName }}.devbob.values.yaml

# Option B: Keep opencode-server chart for production
releases:
  - name: opencode-server
    installed: {{ eq .Environment.Name "production" | toYaml }}
    namespace: metabob
    chart: charts/devbob/charts  # Same chart, different release name
    
  - name: devbob
    installed: {{ ne .Environment.Name "production" | toYaml }}
    namespace: metabob
    chart: charts/devbob/charts
```

### Phase 3: RPC API Update (THIS WEEK - 2-3 hours)

#### Step 1: Verify RPC API Version [15 minutes]
```bash
kubectl config use-context metabob-production

# Check current image
kubectl get deployment metabob-rpc-api -n metabob -o jsonpath='{.spec.template.spec.containers[0].image}'

# Check for SurrealDB library version
kubectl exec -it deployment/metabob-rpc-api -n metabob -- pip list | grep surreal
```

#### Step 2: Build New RPC API Image [30 minutes]
**Only if production RPC API doesn't have SurrealDB official library**

```bash
cd repos/metabob-rpc-api

# Check Dockerfile location
find . -name "Dockerfile" -type f

# Build image (TBD - need to find Dockerfile)
# docker build -t metabobapp/metabob-rpc-api:v0.17.0 .
# docker push metabobapp/metabob-rpc-api:v0.17.0
```

#### Step 3: Update RPC API in Production [30 minutes]
```bash
# Update helm values
cd repos/platform/metabob-apps
# Edit charts/metabob-rpc-api/values/production.metabob-rpc-api.values.yaml

# Deploy
helmfile -e production apply --selector name=metabob-rpc-api

# Verify
kubectl logs -f deployment/metabob-rpc-api -n metabob
```

### Phase 4: Continuous Deployment (NEXT WEEK)

#### Setup CI/CD Pipeline
**Goal**: Automate image builds on every commit to main

**GitHub Actions Workflow** (`.github/workflows/build-devbob.yml`):
```yaml
name: Build and Push DevBob Image

on:
  push:
    branches: [main]
    paths:
      - 'repos/metabob-opencode/**'
      - 'Dockerfile.devbob-local'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      
      - name: Get package version
        id: version
        run: |
          VERSION=$(jq -r .version repos/metabob-opencode/packages/opencode/package.json)
          echo "version=$VERSION" >> $GITHUB_OUTPUT
      
      - name: Build OpenCode binary
        run: |
          cd repos/metabob-opencode/packages/opencode
          npm install -g bun
          bun install
          bun run build
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          file: Dockerfile.devbob-local
          push: true
          tags: |
            metabobapp/devbob:v${{ steps.version.outputs.version }}
            metabobapp/devbob:latest
      
      - name: Update Helm values
        run: |
          cd repos/platform/metabob-apps
          sed -i 's/tag: ".*"/tag: "v${{ steps.version.outputs.version }}"/' \
            charts/devbob/values/production.devbob.values.yaml
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add charts/devbob/values/production.devbob.values.yaml
          git commit -m "chore(devbob): Auto-update image to v${{ steps.version.outputs.version }}"
          git push
```

---

## Critical Questions to Answer

### 1. Docker Registry Access
- ❓ Do we have credentials for `metabobapp` Docker Hub organization?
- ❓ Who has push access?
- ❓ Is there a CI/CD pipeline already?

**Action**: Check Docker Hub credentials
```bash
docker login
# Try pushing a test image
docker tag hello-world metabobapp/test:v1
docker push metabobapp/test:v1
```

### 2. Production Deployment Process
- ❓ Is production deployed via helmfile or direct helm?
- ❓ Is there a GitOps controller (ArgoCD/Flux)?
- ❓ Who has production kubectl access?

**Action**: Check for GitOps
```bash
kubectl config use-context metabob-production
kubectl get pods -n argocd 2>/dev/null || echo "No ArgoCD"
kubectl get pods -n flux-system 2>/dev/null || echo "No Flux"
```

### 3. RPC API Compatibility
- ❓ Is production RPC API using official SurrealDB library?
- ❓ Does DevBob v1.0.64 require updated RPC API?
- ❓ Are there breaking changes?

**Action**: Check RPC API logs for SurrealDB library
```bash
kubectl logs deployment/metabob-rpc-api -n metabob | grep -i surreal
```

### 4. Database Migrations
- ❓ Does the new code require SurrealDB schema changes?
- ❓ Are there any migration scripts needed?

**Action**: Check for migration scripts
```bash
find repos/metabob-rpc-api -name "*migration*" -o -name "*schema*"
```

---

## Risk Assessment

### High Risk Areas
1. **Production outage duration**: Already down for 5+ days
2. **Image compatibility**: New image might have different dependencies
3. **RPC API sync**: DevBob might expect new RPC API endpoints
4. **Database schema**: Might need SurrealDB schema updates

### Mitigation Strategies
1. **Build hotfix image first** - minimal changes, just fix permissions
2. **Test in staging/integration** - verify before production
3. **Blue-green deployment** - keep old pod until new works
4. **Rollback plan** - keep v1.0.0 image available

---

## Immediate Action Items (Priority Order)

### P0 - CRITICAL (Do Now)
1. ✅ **Fix Dockerfile permissions** - Add `chmod +x` for Bun
2. ✅ **Build image v1.0.64** - From current code
3. ✅ **Push to Docker Hub** - `metabobapp/devbob:v1.0.64`
4. ✅ **Update production values** - Change tag to v1.0.64
5. ✅ **Deploy to production** - `helmfile apply` or `helm upgrade`
6. ✅ **Verify fix** - Check pod is running, logs are clean

### P1 - HIGH (This Week)
1. ✅ **Check RPC API compatibility** - Verify SurrealDB library version
2. ✅ **Update RPC API if needed** - Build and deploy new image
3. ✅ **Rename chart handling** - Decide: keep opencode-server or rename
4. ✅ **Test full flow** - Activity execution, Metabob integration
5. ✅ **Document deployment process** - Update runbook

### P2 - MEDIUM (Next Week)
1. ✅ **Setup CI/CD pipeline** - GitHub Actions for auto-build
2. ✅ **Implement GitOps** - ArgoCD or Flux for auto-deploy
3. ✅ **Add monitoring** - Prometheus alerts for crashes
4. ✅ **Create staging environment** - Test before production

---

## Success Criteria

### Immediate (Today)
- [ ] DevBob pod running without crashes in production
- [ ] `kubectl logs` shows successful startup
- [ ] `/health` endpoint returns 200 OK
- [ ] No CrashLoopBackOff errors

### This Week
- [ ] RPC API verified compatible with new DevBob
- [ ] Full activity execution works end-to-end
- [ ] Metabob integration functional
- [ ] Slack bot can trigger DevBob activities

### Next Week
- [ ] CI/CD pipeline building images automatically
- [ ] Production deployments via GitOps
- [ ] Monitoring and alerting active
- [ ] Zero manual deployment steps

---

## Next Commands to Run

```bash
# 1. Fix Dockerfile and build
cd /home/avi/documents/work/exp-repo/metabob-devbob
# Edit Dockerfile.devbob-local (add chmod commands)
docker build -f Dockerfile.devbob-local -t metabobapp/devbob:v1.0.64 .

# 2. Test locally
docker run --rm -it --user 1000 metabobapp/devbob:v1.0.64 opencode --version

# 3. Push to registry
docker login
docker push metabobapp/devbob:v1.0.64

# 4. Update helm values
cd repos/platform/metabob-apps
# Edit charts/devbob/values/production.devbob.values.yaml
# Change tag to v1.0.64

# 5. Deploy to production
kubectl config use-context metabob-production
helmfile -e production apply --selector name=opencode-server

# 6. Monitor deployment
kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server -w
kubectl logs -f deployment/opencode-server -n metabob
```

---

**Status**: Ready for Emergency Fix  
**Next Step**: Fix Dockerfile permissions and build v1.0.64 image  
**ETA**: 2-3 hours to restore production service
