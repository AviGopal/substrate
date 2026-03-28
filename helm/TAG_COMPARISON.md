# Vessel Tag Comparison: GitHub vs Helm Charts

## Current Status

| Vessel | GitHub Release Tag | Helm Chart Tag | Match? | Action Needed |
|--------|-------------------|----------------|--------|---------------|
| metabob-activity-api | **v1.1.1** | dev-1.0.0-cb3fb83-1774665243 | ❌ | Update to v1.1.1 |
| metabob-analysis-api | **v0.1.1** | dev-0.1.0-cb3fb83-1774665243 | ❌ | Update to v0.1.1 |
| minibob (devbob chart) | **v0.1.3** | dev-0.1.2-cb3fb83-1774665243 | ❌ | Update to v0.1.3 |
| metabob-cloud-dashboard | **v0.2.0** | dev-0.1.0-cb3fb83-1774665243 | ❌ | Update to v0.2.0 |
| metabob-internal-dashboard | **v0.1.0** | dev-0.1.0-cb3fb83-1774665243 | ✅ | Version matches (update format) |
| metabob-mcp | **v0.1.0** | dev-0.1.0-cb3fb83-1774665243 | ✅ | Version matches (update format) |

## Issues Identified

### 1. Dev Tags vs Release Tags
Helm charts use dev tags with commit hashes:
```yaml
tag: "dev-1.0.0-cb3fb83-1774665243"
```

Should use clean release tags:
```yaml
tag: "v1.1.1"
```

### 2. Version Mismatches

**metabob-activity-api:**
- Helm: dev-1.0.0 → Should be: v1.1.1
- Gap: 2 minor versions behind

**metabob-analysis-api:**
- Helm: dev-0.1.0 → Should be: v0.1.1
- Gap: 1 patch version behind

**minibob:**
- Helm: dev-0.1.2 → Should be: v0.1.3
- Gap: 1 patch version behind

**metabob-cloud-dashboard:**
- Helm: dev-0.1.0 → Should be: v0.2.0
- Gap: 1 minor version behind

## Recommended Updates

### Update Strategy

For production deployments, use release tags without 'v' prefix:
```yaml
image:
  repository: metabobapp/metabob-activity-api
  tag: "1.1.1"  # Not "v1.1.1" - Docker tags typically omit 'v'
```

For development, optionally keep dev tags or use 'latest':
```yaml
image:
  repository: metabobapp/metabob-activity-api
  tag: "latest"
```

### Chart-Specific Updates

**helm/charts/metabob-activity-api/values.yaml:**
```yaml
# Line 7
- tag: "dev-1.0.0-cb3fb83-1774665243"
+ tag: "1.1.1"
```

**helm/charts/metabob-analysis-api/values.yaml:**
```yaml
- tag: "dev-0.1.0-cb3fb83-1774665243"
+ tag: "0.1.1"
```

**helm/charts/devbob/values.yaml:**
```yaml
- tag: "dev-0.1.2-cb3fb83-1774665243"
+ tag: "0.1.3"
```

**helm/charts/metabob-cloud-dashboard/values.yaml:**
```yaml
- tag: "dev-0.1.0-cb3fb83-1774665243"
+ tag: "0.2.0"
```

**helm/charts/metabob-internal-dashboard/values.yaml:**
```yaml
- tag: "dev-0.1.0-cb3fb83-1774665243"
+ tag: "0.1.0"
```

**helm/charts/metabob-mcp/values.yaml:**
```yaml
- tag: "dev-0.1.0-cb3fb83-1774665243"
+ tag: "0.1.0"
```

## Docker Image Tag Convention

GitHub tags use 'v' prefix: `v1.1.1`
Docker tags omit 'v' prefix: `1.1.1`

When building images from GitHub tags, strip the 'v':
```bash
VERSION=$(git describe --tags | sed 's/^v//')
docker build -t metabobapp/metabob-activity-api:$VERSION .
```

## Verification Commands

After updating Helm charts:

```bash
# Check all chart tags
for chart in metabob-activity-api metabob-analysis-api devbob metabob-cloud-dashboard metabob-internal-dashboard metabob-mcp; do
  echo "$chart: $(grep 'tag:' helm/charts/$chart/values.yaml | head -1)"
done

# Verify images exist in Docker Hub (after CI/CD runs)
docker pull metabobapp/metabob-activity-api:1.1.1
docker pull metabobapp/metabob-analysis-api:0.1.1
docker pull metabobapp/minibob:0.1.3
docker pull metabobapp/metabob-cloud-dashboard:0.2.0
docker pull metabobapp/metabob-internal-dashboard:0.1.0
docker pull metabobapp/metabob-mcp:0.1.0
```

## CI/CD Impact

The deployment CI/CD workflow should:
1. Detect submodule version change (e.g., metabob-activity-api updated to v1.1.1)
2. Strip 'v' prefix from git tag
3. Build and push: `metabobapp/metabob-activity-api:1.1.1`
4. Update Helm values or use `--set` override:
   ```bash
   helm upgrade metabob-activity-api ./charts/metabob-activity-api \
     --set image.tag=1.1.1
   ```

## Next Steps

1. ✅ Update all Helm chart values.yaml files with correct release tags
2. ✅ Commit Helm chart updates
3. ⏳ Build and push Docker images with release tags (CI/CD or manual)
4. ⏳ Deploy updated Helm charts to cluster
5. ⏳ Verify pods are using correct image versions
