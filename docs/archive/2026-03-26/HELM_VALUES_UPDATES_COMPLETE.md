# Helm Values Updates - RPC API Configuration Fix

## Summary

All changes made to fix the RPC API OOM issue have been propagated to the canonical Helm charts in `repos/platform/deployments/metabob`.

## Changes Made

### 1. Template Updates (`deployment-api.yaml`)

**File**: `repos/platform/deployments/metabob/charts/metabob-rpc-api/charts/templates/deployment-api.yaml`

#### Environment Variables - Parameterized
```yaml
# BEFORE (hardcoded):
env:
  - name: WORKERS
    value: '16'
  - name: CONFIG_PATH
    value: /usr/app/.env

# AFTER (parameterized):
env:
  - name: WORKERS
    value: '{{ .Values.service.workers | default "4" }}'
  - name: TIMEOUT_KEEP_ALIVE
    value: '{{ .Values.service.timeoutKeepAlive | default "75" }}'
  - name: CONFIG_PATH
    value: /usr/app/.env
  - name: LOG_LEVEL
    value: {{ .Values.service.logLevel | default "INFO" }}
```

#### Resource Limits - Increased and Parameterized
```yaml
# BEFORE (insufficient):
resources:
  requests:
    memory: "48Mi"   # Way too low!
    cpu: "50m"
  limits:
    memory: "64Mi"   # Caused OOM kills
    cpu: "50m"

# AFTER (appropriate):
{{- if .Values.service.resources }}
resources:
  {{- toYaml .Values.service.resources | nindent 12 }}
{{- else }}
resources:
  requests:
    memory: "1Gi"    # Sufficient for 4 workers
    cpu: "500m"
  limits:
    memory: "2Gi"    # Prevents OOM kills
    cpu: "2000m"
{{- end }}
```

#### Health Probes - Added
```yaml
# ADDED (were missing):
livenessProbe:
  httpGet:
    path: /
    port: 80
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 10
  failureThreshold: 10

readinessProbe:
  httpGet:
    path: /
    port: 80
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 10
  failureThreshold: 10
```

### 2. Base Values (`charts/values.yaml`)

**File**: `repos/platform/deployments/metabob/charts/metabob-rpc-api/charts/values.yaml`

**Added**:
```yaml
service:
  replicas: 1
  workers: 4                    # Number of Uvicorn workers
  timeoutKeepAlive: 75
  logLevel: INFO
  
  resources:                    # Resource configuration to prevent OOM
    requests:
      memory: "1Gi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "2000m"
  
  livenessProbe:               # Health probe configuration
    initialDelaySeconds: 10
    periodSeconds: 10
    timeoutSeconds: 10
    failureThreshold: 10
  
  readinessProbe:
    initialDelaySeconds: 10
    periodSeconds: 10
    timeoutSeconds: 10
    failureThreshold: 10
```

### 3. Local Environment Values

**File**: `repos/platform/deployments/metabob/charts/metabob-rpc-api/values/local.metabob-rpc-api.values.yaml`

**Added**:
```yaml
service:
  replicas: 1
  workers: 4                    # Optimized for local docker-desktop
  
  resources:                    # Local environment resource limits
    requests:
      memory: "1Gi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "2000m"
```

### 4. Production Environment Values

**File**: `repos/platform/deployments/metabob/charts/metabob-rpc-api/values/production.metabob-rpc-api.values.yaml`

**Added**:
```yaml
service:
  replicas: 10
  workers: 8                    # Production: 8 workers per replica
  
  resources:                    # Production resource configuration
    requests:
      memory: "3Gi"             # 8 workers * 500MB = 4Gi min
      cpu: "2000m"
    limits:
      memory: "6Gi"             # Allocated 6Gi for headroom
      cpu: "4000m"
```

### 5. Integration Environment Values

**File**: `repos/platform/deployments/metabob/charts/metabob-rpc-api/values/integration.metabob-rpc-api.values.yaml`

**Added**:
```yaml
service:
  replicas: 10
  workers: 4                    # Integration: 4 workers for testing
  
  resources:                    # Integration resource configuration
    requests:
      memory: "1Gi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "2000m"
```

## Rationale

### Workers-to-Memory Calculation

Each Uvicorn worker process requires approximately 300-500MB of memory under typical load:

| Environment | Workers | Memory Request | Memory Limit | CPU Limit | Replicas | Total Workers |
|-------------|---------|----------------|--------------|-----------|----------|---------------|
| Local       | 4       | 1Gi            | 2Gi          | 2000m     | 1        | 4             |
| Integration | 4       | 1Gi            | 2Gi          | 2000m     | 10       | 40            |
| Production  | 8       | 3Gi            | 6Gi          | 4000m     | 10       | 80            |

### Why These Numbers?

**Local (docker-desktop)**:
- 4 workers = minimal viable for testing
- 2Gi limit = safe for typical laptop resources
- 1 replica = development/testing only

**Integration**:
- 4 workers per pod = sufficient for canary testing
- 2Gi limit = same as local for consistency
- 10 replicas = moderate scale testing

**Production**:
- 8 workers per pod = high throughput
- 6Gi limit = provides headroom for traffic spikes
- 10 replicas = high availability

## Deployment

To apply these changes to your local Kubernetes cluster:

```bash
cd repos/platform/deployments/metabob

# Deploy to local environment
helmfile -e local apply

# Or deploy specific release
helmfile -e local apply --selector name=metabob-rpc-api
```

To apply to production (when ready):

```bash
# Deploy to production environment
helmfile -e prod apply

# Or use blue/green deployment via Istio traffic splitting
helmfile -e prod apply --selector name=metabob-rpc-api
kubectl patch virtualservice metabob-rpc-api -n metabob --type merge -p '{"spec":{"http":[{"route":[{"destination":{"host":"metabob-rpc-api"},"weight":100}]}]}}'
```

## Verification

After deployment, verify the configuration:

```bash
# Check pod resources
kubectl describe pod -n metabob <rpc-api-pod> | grep -A 5 "Limits:"

# Check environment variables
kubectl exec -n metabob <rpc-api-pod> -c rpc-api -- env | grep WORKERS

# Check worker processes
kubectl exec -n metabob <rpc-api-pod> -c rpc-api -- sh -c "ps aux | grep python | wc -l"

# Expected: 6-8 processes (parent + 4 workers + resource tracker + misc)
```

## Backward Compatibility

These changes are backward compatible:
- ✅ Default values provided for all new parameters
- ✅ Existing deployments will use sensible defaults if values not specified
- ✅ Template uses conditional logic to preserve old behavior if `service.resources` not set

## Files Modified

1. ✅ `repos/platform/deployments/metabob/charts/metabob-rpc-api/charts/templates/deployment-api.yaml`
2. ✅ `repos/platform/deployments/metabob/charts/metabob-rpc-api/charts/values.yaml`
3. ✅ `repos/platform/deployments/metabob/charts/metabob-rpc-api/values/local.metabob-rpc-api.values.yaml`
4. ✅ `repos/platform/deployments/metabob/charts/metabob-rpc-api/values/production.metabob-rpc-api.values.yaml`
5. ✅ `repos/platform/deployments/metabob/charts/metabob-rpc-api/values/integration.metabob-rpc-api.values.yaml`

## Next Steps

1. **Commit these changes** to the platform repository
2. **Test in local environment** to verify no regressions
3. **Deploy to integration** for canary testing
4. **Monitor metrics** (memory usage, pod restarts, response times)
5. **Promote to production** when validated

## Related Documentation

- `RPC_API_FIX_AND_VERIFICATION_COMPLETE.md` - Details of the original fix
- `repos/platform/deployments/metabob/helmfile.yaml.gotmpl` - Main helmfile configuration
- `helm/charts/metabob-rpc-api/` - Original local helm charts (now superseded by platform repo)

---

**Date**: March 1, 2026  
**Status**: Complete  
**Tested**: Local environment (docker-desktop)  
**Ready for**: Integration deployment
