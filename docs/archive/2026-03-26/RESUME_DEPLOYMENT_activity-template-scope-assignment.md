# Resume Deployment: Activity Template Scope Assignment

## Quick Status

**Specification**: `activity-template-scope-assignment`  
**Current State**: Code changes complete, ready for deployment  
**Blocker**: K8s deployment required (RPC API running old image from Feb 16)

## What's Done ✅

1. **Traced the bug** - Root cause identified in 3 layers (schema, business logic, API routes)
2. **Enforced the fix** - Code changes applied to all 3 layers
3. **Created validation harness** - Automated tests ready to verify the fix
4. **Analyzed conflicts** - No conflicts with other specifications
5. **Analyzed ripple effects** - No additional changes required

## What's Needed ⚠️

**Deploy to Kubernetes** to make validation pass:

1. Apply SurrealDB schema migration (add scope and org_id fields)
2. Build new Docker image with updated Python code
3. Deploy to K8s cluster
4. Re-run validation tests

## How to Deploy

### Option 1: Automated Script (Recommended)

```bash
./deploy-activity-template-scope-fix.sh
```

This script handles all steps automatically.

### Option 2: Manual Deployment

Follow the detailed guide: `DEPLOYMENT_GUIDE_activity-template-scope-assignment.md`

### Option 3: Step-by-Step Quick Start

```bash
# 1. Apply schema migration
kubectl exec -n metabob <surrealdb-pod> -- surreal sql \
  --conn http://localhost:8000 --user root --pass root \
  --ns metabob --db production <<'SQL'
DEFINE FIELD scope ON activity_template TYPE string DEFAULT 'org';
DEFINE FIELD org_id ON activity_template TYPE string;
DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;
SQL

# 2. Build image
cd repos/metabob-rpc-api
docker build -f docker/Dockerfile.server -t metabobapp/metabob-rpc-api:0.16.14-scope-fix .

# 3. Deploy
kubectl set image deployment/metabob-rpc-api -n metabob \
  rpc-api=metabobapp/metabob-rpc-api:0.16.14-scope-fix

# 4. Wait for rollout
kubectl rollout status deployment/metabob-rpc-api -n metabob

# 5. Validate
npx tsx tests/validation-harnesses/run-activity-template-scope-assignment-validation.ts
```

## Files Reference

- **Deployment script**: `deploy-activity-template-scope-fix.sh`
- **Deployment guide**: `DEPLOYMENT_GUIDE_activity-template-scope-assignment.md`
- **Schema changes**: `scripts/init-surrealdb-devbob-schema.sql:46-50`
- **Code changes**: 
  - `repos/metabob-rpc-api/server/actions/activity.py:338-339`
  - `repos/metabob-rpc-api/server/routes/activity.py:211-229`
- **Validation harness**: `tests/validation-harnesses/run-activity-template-scope-assignment-validation.ts`
- **Previous validation results**: `tests/validation-harnesses/validation-results-activity-template-scope-assignment.json`

## Expected Outcome

After deployment, validation should show:
- ✅ Test 1: Explicit scope assignment - PASS
- ✅ Test 2: Default scope assignment - PASS
- ✅ Test 3: org_id extraction from Bearer token - PASS
- ✅ Test 4: Scope persistence in variants - PASS

**Overall Status**: PASS (4/4 tests)

## Rollback (if needed)

```bash
kubectl set image deployment/metabob-rpc-api -n metabob \
  rpc-api=metabobapp/metabob-rpc-api:0.16.13
```

Schema changes are backward-compatible, so rollback is safe.

## Questions?

- For detailed deployment instructions, see `DEPLOYMENT_GUIDE_activity-template-scope-assignment.md`
- For automated deployment, run `./deploy-activity-template-scope-fix.sh`
- For troubleshooting, check the deployment guide's troubleshooting section

