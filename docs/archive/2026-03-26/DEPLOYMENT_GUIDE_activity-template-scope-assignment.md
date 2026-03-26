# Deployment Guide: Activity Template Scope Assignment

**Specification**: `activity-template-scope-assignment`  
**Status**: Code changes complete, deployment required  
**Date**: March 1, 2026

## Summary

This guide walks through deploying the enforcement changes for the `activity-template-scope-assignment` specification. The code changes have been implemented and are ready for deployment to the Kubernetes cluster.

## What Was Changed

### 1. Database Schema (`scripts/init-surrealdb-devbob-schema.sql`)
Added fields and index to `activity_template` table:
```sql
DEFINE FIELD scope ON activity_template TYPE string DEFAULT 'org';
DEFINE FIELD org_id ON activity_template TYPE string;
DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;
```

### 2. Business Logic (`repos/metabob-rpc-api/server/actions/activity.py`)
Updated `create_template()` function:
- Added `scope` parameter (default='org')
- Added `org_id` parameter (optional)
- Template dict now includes these fields (lines 338-339)

### 3. API Routes (`repos/metabob-rpc-api/server/routes/activity.py`)
Updated `create_activity_template()` route handler:
- Extracts `scope` from request body (default='org')
- Extracts `org_id` from Bearer token (using session_id as MVP placeholder)
- Passes both parameters to `create_template()`

## Deployment Steps

### Prerequisites
- kubectl configured and connected to the cluster
- Docker installed and running
- Access to SurrealDB (for schema migration)
- Permission to build and push Docker images

### Option 1: Automated Deployment Script

Run the provided deployment script:

```bash
./deploy-activity-template-scope-fix.sh
```

The script will:
1. Apply SurrealDB schema migration
2. Build new Docker image (`metabobapp/metabob-rpc-api:0.16.14-scope-fix`)
3. Update K8s deployment
4. Wait for rollout completion
5. Run validation tests

### Option 2: Manual Deployment

If the automated script fails or you prefer manual steps:

#### Step 1: Apply SurrealDB Schema Migration

**Critical**: Schema must be applied FIRST before code deployment.

Find the SurrealDB pod:
```bash
kubectl get pods -n metabob -l app=surrealdb
```

Apply schema changes:
```bash
# Method 1: Direct kubectl exec
kubectl exec -n metabob <surrealdb-pod-name> -- surreal sql \
  --conn http://localhost:8000 \
  --user root \
  --pass root \
  --ns metabob \
  --db production <<'EOF'
DEFINE FIELD scope ON activity_template TYPE string DEFAULT 'org';
DEFINE FIELD org_id ON activity_template TYPE string;
DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;
INFO FOR TABLE activity_template;
EOF
```

**Alternative**: If surreal CLI is not available in pod, use port-forward:
```bash
kubectl port-forward -n metabob svc/surrealdb 8000:8000
# Then use local surreal CLI or HTTP API
```

Verify schema changes:
```bash
# Should show scope and org_id fields
kubectl exec -n metabob <surrealdb-pod-name> -- surreal sql \
  --conn http://localhost:8000 \
  --user root --pass root \
  --ns metabob --db production \
  --pretty "INFO FOR TABLE activity_template;"
```

#### Step 2: Build Docker Image

```bash
cd repos/metabob-rpc-api

docker build \
  -f docker/Dockerfile.server \
  -t metabobapp/metabob-rpc-api:0.16.14-scope-fix \
  .
```

Verify image was built:
```bash
docker images | grep metabob-rpc-api
```

#### Step 3: Push to Registry (if needed)

If using a remote registry:
```bash
docker push metabobapp/metabob-rpc-api:0.16.14-scope-fix
```

For local development with kind/minikube:
```bash
# Load image into cluster
kind load docker-image metabobapp/metabob-rpc-api:0.16.14-scope-fix
# OR
minikube image load metabobapp/metabob-rpc-api:0.16.14-scope-fix
```

#### Step 4: Update K8s Deployment

Update the image in the deployment manifest:
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Create patched manifest
sed 's|image: metabobapp/metabob-rpc-api:.*|image: metabobapp/metabob-rpc-api:0.16.14-scope-fix|' \
  k8s-metabob-rpc-api-simple.yaml > k8s-metabob-rpc-api-simple-patched.yaml

# Apply
kubectl apply -f k8s-metabob-rpc-api-simple-patched.yaml
```

Or use `kubectl set image`:
```bash
kubectl set image deployment/metabob-rpc-api \
  -n metabob \
  rpc-api=metabobapp/metabob-rpc-api:0.16.14-scope-fix
```

#### Step 5: Wait for Rollout

```bash
kubectl rollout status deployment/metabob-rpc-api -n metabob
```

Watch pods:
```bash
kubectl get pods -n metabob -l app=metabob-rpc-api -w
```

#### Step 6: Verify Deployment

Check pod is running new image:
```bash
kubectl get pods -n metabob -l app=metabob-rpc-api \
  -o jsonpath='{.items[0].spec.containers[0].image}'
```

Expected output: `metabobapp/metabob-rpc-api:0.16.14-scope-fix`

Check pod logs for any errors:
```bash
kubectl logs -n metabob -l app=metabob-rpc-api --tail=50
```

### Step 7: Run Validation Tests

```bash
npx tsx tests/validation-harnesses/run-activity-template-scope-assignment-validation.ts
```

Or manually test via API:
```bash
# Create a template with scope
curl -X POST http://<rpc-api-url>/v2/activities/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <session-token>" \
  -d '{
    "name": "test-scope-template",
    "description": "Test template for scope assignment",
    "category": "feature",
    "scope": "org",
    "task_steps": []
  }'
```

Check response includes `scope` and `org_id` fields.

## Expected Validation Results

After deployment, validation should show:

```json
{
  "overallStatus": "PASS",
  "summary": {
    "total": 4,
    "passed": 4,
    "failed": 0,
    "skipped": 0
  }
}
```

Test cases:
1. ✅ Explicit scope assignment - scope persisted as 'org'
2. ✅ Default scope assignment - scope defaults to 'org'
3. ✅ org_id extraction from Bearer token - org_id set from session
4. ✅ Scope persistence in variants - scope inherited by variants

## Rollback Procedure

If deployment causes issues:

```bash
# Rollback to previous image
kubectl set image deployment/metabob-rpc-api \
  -n metabob \
  rpc-api=metabobapp/metabob-rpc-api:0.16.13

# Wait for rollback
kubectl rollout status deployment/metabob-rpc-api -n metabob
```

**Note**: Schema changes are backward-compatible (fields have defaults), so rollback won't break old code.

## Troubleshooting

### Issue: Schema migration fails
**Solution**: Check SurrealDB connection and credentials. Verify namespace and database are correct ('metabob', 'production').

### Issue: Docker build fails
**Solution**: 
- Check you're in the correct directory (`repos/metabob-rpc-api`)
- Verify Dockerfile exists at `docker/Dockerfile.server`
- Check Python dependencies in `requirements.txt`

### Issue: Image push fails
**Solution**: 
- Login to registry: `docker login`
- Check registry permissions
- For local clusters, use `kind load` or `minikube image load` instead

### Issue: Pods crash-looping
**Solution**:
- Check logs: `kubectl logs -n metabob -l app=metabob-rpc-api`
- Common causes: missing env vars, connection to SurrealDB/Redis failed
- Verify SurrealDB and Redis services are running

### Issue: Validation fails after deployment
**Solution**:
- Check pod is running new image (not cached old image)
- Verify schema changes were applied to SurrealDB
- Check Bearer token is being passed correctly
- Review validation harness logs for specific failure reasons

## Post-Deployment

Once validation passes:

1. ✅ Update impulse `validation-results-activity-template-scope-assignment` with PASS status
2. ✅ Document deployment timestamp and image version
3. ✅ Mark specification as ENFORCED in tracking system
4. ✅ Update FINAL_SUMMARY document with deployment confirmation

## Files Referenced

- Schema: `scripts/init-surrealdb-devbob-schema.sql:46-50`
- Business logic: `repos/metabob-rpc-api/server/actions/activity.py:338-339`
- API routes: `repos/metabob-rpc-api/server/routes/activity.py:211-229`
- Validation harness: `tests/validation-harnesses/run-activity-template-scope-assignment-validation.ts`
- Deployment script: `deploy-activity-template-scope-fix.sh`
- Previous validation results: `tests/validation-harnesses/validation-results-activity-template-scope-assignment.json`

## Questions?

For deployment issues, check:
- K8s cluster status: `kubectl cluster-info`
- Pod events: `kubectl describe pod -n metabob <pod-name>`
- Service connectivity: `kubectl get svc -n metabob`
- Resource constraints: `kubectl top pods -n metabob`

