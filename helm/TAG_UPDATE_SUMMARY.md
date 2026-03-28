# Helm Chart Tag Update Summary

## Comparison: Before vs After

| Chart | Old Tag | New Tag | Status |
|-------|---------|---------|--------|
| metabob-activity-api | dev-1.0.0-cb3fb83-1774665243 | **1.1.1** | ✅ Updated |
| metabob-analysis-api | dev-0.1.0-cb3fb83-1774665243 | **0.1.1** | ✅ Updated |
| devbob (minibob) | dev-0.1.2-cb3fb83-1774665243 | **0.1.3** | ✅ Updated |
| metabob-cloud-dashboard | dev-0.1.0-cb3fb83-1774665243 | **0.2.0** | ✅ Updated |
| metabob-internal-dashboard | dev-0.1.0-cb3fb83-1774665243 | **0.1.0** | ✅ Updated |
| metabob-mcp | dev-0.1.0-cb3fb83-1774665243 | **0.1.0** | ✅ Updated |

## Changes Made

### 1. Removed Dev Tags
Old format: `dev-<version>-<commit>-<timestamp>`
New format: `<version>` (semantic versioning)

**Rationale:**
- Dev tags with commit hashes are for CI builds
- Release tags should use clean semantic versions
- Aligns with GitHub release tags (without 'v' prefix per Docker convention)

### 2. Version Alignment

All Helm charts now match their GitHub release tags:

**GitHub Tags** (with 'v'):
- metabob-activity-api: `v1.1.1`
- metabob-analysis-api: `v0.1.1`
- minibob: `v0.1.3`
- metabob-cloud-dashboard: `v0.2.0`
- metabob-internal-dashboard: `v0.1.0`
- metabob-mcp: `v0.1.0`

**Helm values.yaml** (without 'v'):
- metabob-activity-api: `1.1.1`
- metabob-analysis-api: `0.1.1`
- devbob (minibob): `0.1.3`
- metabob-cloud-dashboard: `0.2.0`
- metabob-internal-dashboard: `0.1.0`
- metabob-mcp: `0.1.0`

**Docker Images** (should be tagged without 'v'):
- metabobapp/metabob-activity-api:1.1.1
- metabobapp/metabob-analysis-api:0.1.1
- metabobapp/minibob:0.1.3
- metabobapp/metabob-cloud-dashboard:0.2.0
- metabobapp/metabob-internal-dashboard:0.1.0
- metabobapp/metabob-mcp:0.1.0

## Files Modified

```
helm/charts/metabob-activity-api/values.yaml
helm/charts/metabob-analysis-api/values.yaml
helm/charts/devbob/values.yaml
helm/charts/metabob-cloud-dashboard/values.yaml
helm/charts/metabob-internal-dashboard/values.yaml
helm/charts/metabob-mcp/values.yaml
```

## Next Steps

### 1. Build and Push Docker Images ⏳

The Helm charts now reference release tags, but Docker images need to be built and pushed:

```bash
# For each vessel, build from the deployment repo structure
cd repos/deployment

# Build metabob-activity-api
docker build -f vessels/metabob-activity-api/Dockerfile -t metabobapp/metabob-activity-api:1.1.1 vessels/
docker push metabobapp/metabob-activity-api:1.1.1

# Build metabob-analysis-api
docker build -f vessels/metabob-analysis-api/Dockerfile -t metabobapp/metabob-analysis-api:0.1.1 vessels/
docker push metabobapp/metabob-analysis-api:0.1.1

# Build minibob
docker build -f vessels/minibob/Dockerfile -t metabobapp/minibob:0.1.3 vessels/
docker push metabobapp/minibob:0.1.3

# Build metabob-cloud-dashboard
docker build -f vessels/metabob-cloud-dashboard/Dockerfile -t metabobapp/metabob-cloud-dashboard:0.2.0 vessels/
docker push metabobapp/metabob-cloud-dashboard:0.2.0

# Build metabob-internal-dashboard
docker build -f vessels/metabob-internal-dashboard/Dockerfile -t metabobapp/metabob-internal-dashboard:0.1.0 vessels/
docker push metabobapp/metabob-internal-dashboard:0.1.0

# Build metabob-mcp
docker build -f vessels/metabob-mcp/Dockerfile -t metabobapp/metabob-mcp:0.1.0 vessels/
docker push metabobapp/metabob-mcp:0.1.0
```

**Note:** For monorepo builds (during development), build from `repos/` instead of `vessels/`.

### 2. Deploy Updated Charts ⏳

Once Docker images are pushed:

```bash
# Deploy to development cluster
cd helm
helmfile -f helmfile-activity-dev.yaml -e dev apply

# Or deploy individual charts
helm upgrade metabob-activity-api ./charts/metabob-activity-api -n activity-system
helm upgrade metabob-analysis-api ./charts/metabob-analysis-api -n activity-system
# ... etc
```

### 3. Verify Deployments ⏳

```bash
# Check pod images
kubectl get pods -n activity-system -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].image}{"\n"}{end}'

# Expected output (example):
# metabob-activity-api-xxx    metabobapp/metabob-activity-api:1.1.1
# metabob-analysis-api-xxx    metabobapp/metabob-analysis-api:0.1.1
# minibob-xxx                 metabobapp/minibob:0.1.3
# ...
```

## Tag Convention Summary

| Context | Format | Example |
|---------|--------|---------|
| Git tags | `v<semver>` | `v1.1.1` |
| Docker tags | `<semver>` | `1.1.1` |
| Helm values | `"<semver>"` | `"1.1.1"` |
| Dev builds | `dev-<semver>-<commit>-<timestamp>` | `dev-1.1.1-abc123-1234567890` |

## CI/CD Integration

When the deployment CI/CD pipeline runs:

1. Detects submodule update (e.g., metabob-activity-api → v1.1.1)
2. Extracts version: `VERSION=$(git describe --tags | sed 's/^v//')`
3. Builds Docker image: `docker build -t metabobapp/metabob-activity-api:$VERSION`
4. Pushes to registry: `docker push metabobapp/metabob-activity-api:$VERSION`
5. Deploys Helm chart (values.yaml already has correct version)

## Rollback Process

If a deployment fails, Helm rollback references previous chart version:

```bash
# Rollback to previous release
helm rollback metabob-activity-api -n activity-system

# Or rollback to specific revision
helm rollback metabob-activity-api 5 -n activity-system

# Check history
helm history metabob-activity-api -n activity-system
```

The Helm chart history tracks which image tags were deployed, enabling easy rollback.
