# Container Update Checklist

**Ensuring all canary containers are up to date and properly initialized.**

---

## Current Container Versions

From `repos/deployment/environments/production.canary.values.yaml`:

| Service | Current Tag | Last Updated |
|---------|-------------|--------------|
| metabob-activity-api | `1.2.10-de3c233` | Check git log |
| metabob-analysis-api | `0.1.2-de3c233` | Check git log |
| metabob-cloud-dashboard | `0.2.2-de3c233` | Check git log |
| metabob-internal-dashboard | `0.1.0-53ba3dc` | Check git log |
| minibob | `0.3.7-de3c233` | Check git log |
| concept-db | `0.1.0-de3c233` | Check git log |
| identity-vessel | `0.1.0-de3c233` | Check git log |
| user-vessel | `0.1.0-de3c233` | Check git log |

---

## Verification Steps

### 1. Check Current Deployed Versions

```bash
# Get all deployments with their image tags
kubectl get deployments -n activity-system \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[0].image}{"\n"}{end}' \
  | column -t

# Compare with values file
cat repos/deployment/environments/production.canary.values.yaml | grep -B 1 "tag:"
```

**What to check:**
- Are deployed tags the same as in values file?
- Do all tags follow the format `{version}-{sha7}`?
- Are there any `latest` tags (bad practice)?

### 2. Check Git History

```bash
cd repos/deployment

# Check when production.canary.values.yaml was last updated
git log -1 --format="%ai %an" environments/production.canary.values.yaml

# Check recent commits to main workspace
cd ..
git log --oneline -20
```

**What to check:**
- When was the last deployment?
- Are there commits in main workspace since the last deployment?
- Do commit SHAs match the image tags?

### 3. Verify CI/CD Pipeline Status

```bash
# Check recent workflow runs
gh run list --repo MetabobProject/deployment --limit 10

# View specific workflow
gh run view <run-id> --log

# Check if there are pending deployments
gh run list --status in_progress
```

**What to check:**
- Did the last deploy-canary workflow succeed?
- Are there any failed builds that need attention?
- When was the last successful deployment?

### 4. Check Container Registry

```bash
# List recent images in Docker Hub
# (Requires Docker Hub authentication)
docker search metabobapp/metabob-activity-api --limit 5

# Or check via Docker Hub web UI:
# https://hub.docker.com/u/metabobapp
```

**What to check:**
- Are the tags in values file available in the registry?
- Are there newer tags that should be deployed?

---

## Update Procedure

### Option 1: Trigger CI/CD (Recommended)

```bash
# 1. Make changes in main workspace
cd repos/metabob-activity-api
# Edit code
bun test
bun run typecheck

# 2. Commit to main workspace
git add .
git commit -m "feat: your change description"
git push origin dev

# 3. CI/CD automatically:
#    - Syncs to deployment repo
#    - Builds container
#    - Deploys to canary
#    - Updates production.canary.values.yaml
```

### Option 2: Manual Build and Deploy

```bash
cd repos/deployment

# 1. Build changed vessels
./scripts/build_changed.sh --env canary --push

# 2. Deploy to canary
helmfile -e canary sync

# 3. Verify deployment
kubectl rollout status deployment -n activity-system metabob-activity-api
kubectl get pods -n activity-system
```

### Option 3: Force Rebuild All

```bash
cd repos/deployment

# 1. Force rebuild all vessels
./scripts/build_changed.sh --env canary --push --force

# 2. Deploy all
helmfile -e canary sync

# 3. Wait for rollout
kubectl get pods -n activity-system -w
```

---

## Database Schema Management

### Current Schema Ownership

| Service | Owned Tables |
|---------|--------------|
| **identity-vessel** | `organizations`, `users`, `organization_members`, `api_key` |
| **metabob-activity-api** | `activity_template`, `activity_execution_trace`, `activity_metrics`, `minibob_instance` (deprecated) |
| **concept-db** | `concept`, `concept_relation`, `concept_tag` |

### Schema Initialization Flow

```
1. SurrealDB starts (StatefulSet)
2. metabob-activity-api init-db job runs (Helm post-install hook)
   - Creates all table schemas
   - Applies migrations
3. init-data job runs (Helm post-install hook)
   - Creates organizations
   - Creates users
   - Creates API keys
   - Creates MiniBob instances (deprecated)
```

### Verify Schema Status

```bash
# Port-forward to SurrealDB
kubectl port-forward svc/surrealdb 8000:8000 -n activity-system

# Check schema version
bun run repos/metabob-activity-api/scripts/check-schema-version.ts

# Check table ownership
bun run /tmp/check-table-ownership.ts
```

### Schema Update Procedure

If schema needs updating:

```bash
# 1. Create migration file
cd repos/metabob-activity-api/sql
# Create new file: XXX-description.surql

# 2. Test locally first
bun run sql/apply-migrations.ts

# 3. Push to dev (triggers CI/CD)
cd ../..
git add repos/metabob-activity-api/sql
git commit -m "schema: add new migration"
git push origin dev

# 4. CI/CD runs init-db job with new migrations

# 5. Verify migration applied
kubectl logs -n activity-system -l app.kubernetes.io/component=init-db --tail=100
```

---

## Initial Data Management

### What Gets Seeded

From `secrets/canary.secrets.yaml` → `initData`:

```yaml
organizations:
  - id: metabob
    name: Metabob

users:
  - email: self@metabob.com
    name: MiniBob Service Account
    role: service
    orgId: metabob
    apiKeys: [self-local-dev, self-canary, self-production]

  - email: avi@metabob.com
    name: Avi
    role: admin
    orgId: metabob

minibobInstances:
  - instanceId: minibob-canary-001
    orgId: metabob
    vesselId: minibob-k8s-canary
```

### Verify Seed Data

```bash
# Port-forward to SurrealDB
kubectl port-forward svc/surrealdb 8000:8000 -n activity-system

# Check organizations
bun run /tmp/query-all-orgs.ts

# Check users
bun run scripts/commission-canary.ts org list

# Check API keys
bun run scripts/commission-canary.ts apikey list
```

### Re-seed Data

If seed data is missing or incorrect:

```bash
cd repos/deployment

# 1. Delete init-data job (triggers re-run on next sync)
kubectl delete job init-data -n activity-system

# 2. Verify secrets are correct
sops repos/deployment/secrets/canary.secrets.yaml

# 3. Re-run init-data
helmfile -e canary sync --selector app.kubernetes.io/component=initialization

# 4. Check logs
kubectl logs -n activity-system -l app.kubernetes.io/component=initialization -f

# 5. Verify data created
bun run /tmp/verify-canary-setup.sh
```

---

## Complete Update Checklist

### Pre-Update

- [ ] Check git status for uncommitted changes
- [ ] Review recent commits since last deployment
- [ ] Verify tests pass locally (`bun test`)
- [ ] Check CI/CD status (no pending/failed runs)

### Container Updates

- [ ] Verify current deployed tags match values file
- [ ] Build changed containers (or trigger CI/CD)
- [ ] Check container images exist in registry
- [ ] Update values file with new tags
- [ ] Deploy to canary (`helmfile -e canary sync`)
- [ ] Verify rollout complete (`kubectl rollout status`)

### Schema Updates

- [ ] Check if schema migrations are needed
- [ ] Verify init-db job ran successfully
- [ ] Check migration logs for errors
- [ ] Verify table schemas match source files
- [ ] Test schema changes with sample queries

### Initial Data

- [ ] Verify `organizations:metabob` exists
- [ ] Check users are created correctly
- [ ] Verify API keys are registered
- [ ] Test API key authentication
- [ ] Check organization memberships

### Post-Update Verification

- [ ] All pods are running (`kubectl get pods`)
- [ ] Health endpoints return 200 (`/health`)
- [ ] API authentication works
- [ ] Dashboard loads correctly
- [ ] MiniBob can connect
- [ ] Logs show no errors

### Local Machine Configuration

- [ ] METABOB_API_KEY environment variable set
- [ ] Or ~/.metabob/config.json has correct key
- [ ] METABOB_ENDPOINT points to canary
- [ ] Run `/tmp/verify-canary-setup.sh`
- [ ] Test MiniBob commands

---

## Automation Opportunities

### 1. Pre-deployment Validation Script

```bash
#!/bin/bash
# scripts/validate-pre-deploy.sh

# Check uncommitted changes
if [[ -n $(git status -s) ]]; then
  echo "Warning: Uncommitted changes detected"
fi

# Verify tests pass
bun test || exit 1

# Check schema migrations are up to date
bun run sql/check-migrations.ts || exit 1

# Verify secrets are valid
sops -d secrets/canary.secrets.yaml > /dev/null || exit 1

echo "✓ Pre-deployment validation passed"
```

### 2. Post-deployment Smoke Test

```bash
#!/bin/bash
# scripts/smoke-test-canary.sh

# Health checks
curl -f https://activity.metabob.com/health || exit 1

# API authentication
curl -f -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/templates || exit 1

# Database connectivity
kubectl port-forward svc/surrealdb 8000:8000 -n activity-system &
sleep 2
curl -f http://localhost:8000/health || exit 1

echo "✓ Smoke tests passed"
```

### 3. Container Version Report

```bash
#!/bin/bash
# scripts/report-container-versions.sh

echo "=== Deployed Versions ==="
kubectl get deployments -n activity-system \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[0].image}{"\n"}{end}' \
  | column -t

echo ""
echo "=== Values File Versions ==="
cat environments/production.canary.values.yaml | grep -B 1 "tag:"

echo ""
echo "=== Registry Latest Tags ==="
# TODO: Add Docker Hub API query
```

---

## Troubleshooting Common Issues

### Issue: Init-data job failed

**Symptoms:**
- `organizations:metabob` doesn't exist
- No API keys in database
- Users not created

**Diagnosis:**
```bash
kubectl get jobs -n activity-system -l app.kubernetes.io/component=initialization
kubectl logs -n activity-system -l app.kubernetes.io/component=initialization
```

**Fix:**
```bash
kubectl delete job init-data -n activity-system
helmfile -e canary sync --selector app.kubernetes.io/component=initialization
```

### Issue: Schema migrations not applied

**Symptoms:**
- Missing tables or fields
- SQL errors in application logs
- PERMISSIONS errors

**Diagnosis:**
```bash
kubectl logs -n activity-system -l app.kubernetes.io/component=init-db
bun run sql/check-schema.ts
```

**Fix:**
```bash
kubectl delete job metabob-activity-api-init-db -n activity-system
helmfile -e canary sync --selector vessel=metabob-activity-api
```

### Issue: Containers using old tags

**Symptoms:**
- Changes not visible in canary
- Old behavior persists after deployment
- Image pull errors

**Diagnosis:**
```bash
kubectl describe deployment metabob-activity-api -n activity-system | grep Image:
cat environments/production.canary.values.yaml | grep -A 2 "metabob-activity-api:"
```

**Fix:**
```bash
# Rebuild and push
./scripts/build_changed.sh --env canary --push --force

# Update deployment
helmfile -e canary sync

# Force pod restart
kubectl rollout restart deployment metabob-activity-api -n activity-system
```

---

## Related Documentation

- **Canary Setup:** `CANARY_SETUP_GUIDE.md`
- **Database Audit:** `CANARY_DATABASE_AUDIT.md`
- **Deployment Workflow:** `repos/deployment/DEPLOYMENT_WORKFLOW.md`
- **CI/CD Documentation:** `repos/deployment/.github/workflows/README.md`
