# Build and Deploy: HTTP RPC Client Fix

**Date**: March 1, 2026  
**Status**: Ready for Execution  
**Image Version**: 0.16.16-http-rpc

## Quick Start

```bash
# 1. Build Docker image
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api
docker build -t metabobapp/metabob-rpc-api:0.16.16-http-rpc .

# 2. Update Helm values
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/platform/metabob-apps
vi charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml
# Change: tag: 0.16.16-http-rpc

# 3. Deploy to K8s
helmfile -e default sync --selector 'name=metabob-rpc-api'

# 4. Verify deployment
kubectl get pods -n metabob -l app=metabob-rpc-api
kubectl logs -n metabob deployment/metabob-rpc-api --tail=50

# 5. Test persistence
kubectl port-forward -n metabob svc/metabob-rpc-api 8089:8080 &
curl -X POST http://localhost:8089/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{"id":"test-http-fix","name":"Test HTTP Fix","description":"Verify persistence","category":"infrastructure","tasks":[],"scope":"global","org_id":null}'

curl http://localhost:8089/v2/activities/templates/test-http-fix
# Should return the template (NOT 404!)
```

## Detailed Steps

### Step 1: Build Docker Image

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api

# Build with new tag
docker build -t metabobapp/metabob-rpc-api:0.16.16-http-rpc .

# Verify image built successfully
docker images | grep metabob-rpc-api | grep http-rpc

# Optional: Test locally before K8s deployment
docker run -it --rm \
  -e SURREALDB_URL=http://host.docker.internal:8000 \
  -e SURREALDB_USERNAME=root \
  -e SURREALDB_PASSWORD=changeme \
  -e SURREALDB_NAMESPACE=metabob \
  -e SURREALDB_DATABASE=production \
  -p 8090:8000 \
  metabobapp/metabob-rpc-api:0.16.16-http-rpc
```

### Step 2: Update Helm Values

**File**: `repos/platform/metabob-apps/charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml`

```yaml
name: rpc-api
namespace: metabob
release: default

image:
  imageRegistry: metabobapp
  rpc_api:
    repo: metabob-rpc-api
    tag: 0.16.16-http-rpc  # <-- UPDATE THIS LINE

surrealdb:
  database: production

service:
  replicas: 1
  workers: 4

config: universal-config
```

### Step 3: Deploy to K8s

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/platform/metabob-apps

# Deploy RPC API with new image
helmfile -e default sync --selector 'name=metabob-rpc-api'

# Watch rollout
kubectl rollout status deployment/metabob-rpc-api -n metabob

# Check pod status
kubectl get pods -n metabob -l app=metabob-rpc-api

# Expected output:
# NAME                              READY   STATUS    RESTARTS   AGE
# metabob-rpc-api-xxx-yyy           1/1     Running   0          30s
```

### Step 4: Verify Deployment

#### Check Logs for Startup Success

```bash
kubectl logs -n metabob deployment/metabob-rpc-api --tail=50

# Look for:
# ✅ "Connecting to SurrealDB: http://surrealdb:8000"
# ✅ "Signing in as root..."
# ✅ "Authentication successful (token-based)"
# ✅ "SurrealDB connection established"
# ✅ "Started server process"
```

#### Check for HTTP Client Logs

```bash
kubectl logs -n metabob deployment/metabob-rpc-api | grep -i "http"

# Should see HTTP RPC calls instead of library calls
```

### Step 5: Test Template Persistence

#### Create Template

```bash
kubectl port-forward -n metabob svc/metabob-rpc-api 8089:8080 > /tmp/pf.log 2>&1 &
PF_PID=$!
sleep 3

# Create test template
TIMESTAMP=$(date +%s)
curl -X POST http://localhost:8089/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"test-http-persist-${TIMESTAMP}\",
    \"name\": \"Test HTTP Persistence ${TIMESTAMP}\",
    \"description\": \"Testing HTTP RPC client persistence\",
    \"category\": \"infrastructure\",
    \"tasks\": [],
    \"scope\": \"global\",
    \"org_id\": null
  }" | jq .

# Save template ID for retrieval
TEMPLATE_ID="test-http-persist-${TIMESTAMP}"
```

#### Verify Persistence

```bash
# Retrieve the template
curl -s http://localhost:8089/v2/activities/templates/${TEMPLATE_ID} | jq .

# Expected: Template data returned (NOT {"error": "Template not found"})

# Check logs for success
kubectl logs -n metabob deployment/metabob-rpc-api --tail=20 | grep -i "template"

# Should see:
# ✅ "Template written to SurrealDB (primary)"
# ✅ NO "Template not found in SurrealDB" warnings

# Clean up
kill $PF_PID
```

### Step 6: Integration Tests

#### Test Full CRUD Operations

```bash
# Create
TEMPLATE_ID=$(curl -s -X POST http://localhost:8089/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{"id":"crud-test","name":"CRUD Test","description":"Test all operations","category":"infrastructure","tasks":[],"scope":"global"}' \
  | jq -r '.activity_id // .id')

# Read
curl -s http://localhost:8089/v2/activities/templates/${TEMPLATE_ID} | jq '.name'
# Expected: "CRUD Test"

# Update (if endpoint exists)
# curl -X PATCH http://localhost:8089/v2/activities/templates/${TEMPLATE_ID} ...

# Delete (if endpoint exists)
# curl -X DELETE http://localhost:8089/v2/activities/templates/${TEMPLATE_ID}
```

#### Test Query Operations

```bash
# List all templates
curl -s http://localhost:8089/v2/activities/templates | jq 'length'

# Should return count > 0
```

### Step 7: Verify No Regressions

#### Check Existing Functionality

```bash
# Health check
curl -s http://localhost:8089/ | jq .
# Expected: {"status":"ok",...}

# API version
curl -s http://localhost:8089/openapi.json | jq '.info.version'

# Other endpoints still work
curl -s http://localhost:8089/api/health | jq .
```

## Rollback Plan

### If Issues Arise

```bash
# 1. Revert to previous image
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/platform/metabob-apps
vi charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml
# Change back to: tag: 0.16.14-scope-fix

# 2. Redeploy
helmfile -e default sync --selector 'name=metabob-rpc-api'

# 3. Verify rollback
kubectl get pods -n metabob -l app=metabob-rpc-api
kubectl logs -n metabob deployment/metabob-rpc-api --tail=30
```

### If Code Needs Reverting

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api

# Restore old client
mv server/db/surrealdb_client.py server/db/surrealdb_client_http_broken.py
mv server/db/surrealdb_client_legacy.py server/db/surrealdb_client.py

# Rebuild image
docker build -t metabobapp/metabob-rpc-api:0.16.14-rollback .

# Update Helm values and deploy
```

## Success Criteria

✅ **Deployment successful when:**
1. Pod starts without errors
2. Logs show "SurrealDB connection established"
3. Template creation returns 201
4. Template retrieval returns template data (NOT 404)
5. No "Template not found in SurrealDB" warnings in logs
6. Health check passes
7. Existing API endpoints still work

## Monitoring

### Key Metrics to Watch

```bash
# Pod restarts (should be 0)
kubectl get pods -n metabob -l app=metabob-rpc-api

# Error rate in logs
kubectl logs -n metabob deployment/metabob-rpc-api | grep -i error | wc -l

# Successful template operations
kubectl logs -n metabob deployment/metabob-rpc-api | grep "Template written to SurrealDB" | wc -l
kubectl logs -n metabob deployment/metabob-rpc-api | grep "Template not found" | wc -l
# Second count should be 0!

# Response times (manual observation during testing)
time curl -s http://localhost:8089/v2/activities/templates/test-id > /dev/null
```

## Troubleshooting

### Issue: Pod CrashLoopBackOff

```bash
# Check logs
kubectl logs -n metabob deployment/metabob-rpc-api --previous

# Common causes:
# - Import error (wrong module name)
# - requests library not in requirements.txt
# - SurrealDB not accessible

# Fix: Check Dockerfile has requests library
grep requests repos/metabob-rpc-api/requirements.txt
```

### Issue: Connection Refused to SurrealDB

```bash
# Verify SurrealDB is running
kubectl get pods -n metabob -l app=surrealdb

# Test connectivity from RPC API pod
kubectl exec -n metabob deployment/metabob-rpc-api -- sh -c "curl -s http://surrealdb:8000/health"
```

### Issue: 401 Unauthorized

```bash
# Check credentials in secrets
kubectl get secret -n metabob surrealdb-credentials -o yaml

# Verify environment variables in pod
kubectl exec -n metabob deployment/metabob-rpc-api -- env | grep SURREAL
```

### Issue: Template Still Returns 404

```bash
# This means HTTP client still has issues
# Check logs for specific error
kubectl logs -n metabob deployment/metabob-rpc-api | grep -A 5 "Create failed"

# Verify HTTP RPC format is correct
kubectl logs -n metabob deployment/metabob-rpc-api | grep "Bearer"
# Should see Bearer token in requests
```

## Next Steps After Successful Deployment

1. **Run full test suite** (if available)
2. **Monitor for 24 hours** to ensure stability
3. **Update image tag** in all environments (dev, staging, prod)
4. **Remove surrealdb-py dependency** from requirements.txt (optional cleanup)
5. **Document lessons learned** for future similar issues
6. **Move to Task 3**: Add persistent storage for SurrealDB

## Notes

- **Image naming**: Using `0.16.16-http-rpc` to clearly indicate the fix
- **Backwards compatibility**: API interface unchanged, drop-in replacement
- **Risk**: Low - based on proven init_schema.py pattern
- **Dependencies**: Only requires `requests` library (already in requirements.txt)

## References

- Implementation Guide: `PERSISTENCE_FIX_IMPLEMENTATION_GUIDE.md`
- Production Assessment: `K8S_DEVBOB_PRODUCTION_READINESS_ASSESSMENT.md`
- Init Schema Pattern: `repos/platform/metabob-apps/charts/surrealdb/charts/templates/init-schema-configmap.yaml`
