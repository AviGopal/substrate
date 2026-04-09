# Redeployment Plan - 2026-04-09

**Objective:** Push all current code to remote and trigger CI/CD for canary deployment.

---

## Current State

### Main Workspace (metabob-devbob)

**Branch:** `dev`
**Last Commit:** `3952376d` - feat(templates): migrate to camelCase and register 19 activities

**Uncommitted Changes:**
```
M .metabob/config.json
M docs/API_KEY_VALIDATION_ENDPOINT.md
M package.json
M repos/deployment (submodule)
M repos/metabob-activity-api/package.json
D repos/metabob-activity-api/sql/create-minibob-instance.ts
M repos/metabob-activity-api/sql/init-test-data.ts
M repos/metabob-activity-api/src/models/schemas.ts
M repos/metabob-activity-api/src/routes/activities.ts
M scripts/dev-dashboard.sh
M scripts/seed-vessel-activities.ts
```

**Untracked Files:**
- Documentation files (*.md)
- Playwright MCP snapshots (.playwright-mcp/*)
- Activity traces (.metabob/activities/, .metabob/traces/)
- GitHub workflow (.github/workflows/terminal-observe-and-learn.yml)

**Recent Commits (not pushed):**
```
3952376d feat(templates): migrate to camelCase and register 19 activities
e51f561b feat(verification): add comprehensive tutor and search testing
63457948 docs(demos): add comprehensive demo summary
141aadd2 docs(demos): add API key setup guide
072b2012 feat(demos): add complete activity-driven development demo
```

### Deployment Repo (repos/deployment)

**Submodule Status:**
```
+65c79eeb identity-vessel (uncommitted changes)
 aa723077 metabob-activity-api (clean)
 cf6d6f87 metabob-analysis-api (clean)
 82a1bbf6 metabob-cloud-dashboard (clean)
 c8486dc3 metabob-internal-dashboard (clean)
 31726121 metabob-proto (clean)
 da89c2c8 minibob (clean)
```

**Uncommitted Changes:**
```
M vessels/user-vessel/src/db/surreal.ts
M vessels/user-vessel/src/routes/auth.ts
```

---

## Deployment Strategy

### Phase 1: Commit Main Workspace Changes

**Goal:** Commit functional code changes, exclude temporary/generated files.

**Files to Commit:**
- ✅ `repos/metabob-activity-api/src/models/schemas.ts` (schema updates)
- ✅ `repos/metabob-activity-api/src/routes/activities.ts` (route updates)
- ✅ `repos/metabob-activity-api/sql/init-test-data.ts` (data init changes)
- ✅ `repos/metabob-activity-api/package.json` (dependency updates)
- ❓ `repos/metabob-activity-api/sql/create-minibob-instance.ts` (deleted - verify this is intentional)

**Files to Exclude:**
- ❌ `.metabob/activities/`, `.metabob/traces/` (runtime data)
- ❌ `.playwright-mcp/*` (MCP cache)
- ❌ Documentation files like `CANARY_DATABASE_AUDIT.md` (unless you want them tracked)
- ❌ `.metabob/config.json` (local configuration)

**Commands:**
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Review changes
git diff repos/metabob-activity-api/src/models/schemas.ts
git diff repos/metabob-activity-api/src/routes/activities.ts

# Stage functional code changes
git add repos/metabob-activity-api/src/models/schemas.ts
git add repos/metabob-activity-api/src/routes/activities.ts
git add repos/metabob-activity-api/sql/init-test-data.ts
git add repos/metabob-activity-api/package.json
git add repos/metabob-activity-api/sql/create-minibob-instance.ts  # Deletion

# Optional: Add documentation
git add CANARY_DATABASE_AUDIT.md
git add CANARY_SETUP_GUIDE.md
git add CONTAINER_UPDATE_CHECKLIST.md
git add docs/API_KEY_VALIDATION_ENDPOINT.md

# Commit
git commit -m "feat(activity-api): update schemas and data initialization

- Update SurrealDB schemas for auth tables
- Remove deprecated create-minibob-instance script
- Update init-test-data for API key authentication
- Add canary database audit and setup documentation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Push to remote
git push origin dev
```

### Phase 2: Update Deployment Repo Submodules

**Goal:** Update deployment repo to reference latest vessel commits.

**Commands:**
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment

# Update submodule references to latest commits
git submodule update --remote --merge

# Check which vessels were updated
git status

# Commit submodule updates
git add vessels/metabob-activity-api
git add vessels/identity-vessel
git add vessels/user-vessel
# ... add any other updated submodules

git commit -m "chore: update vessel submodules to latest commits"

# Push to deployment repo
git push origin dev
```

### Phase 3: Sync Deployment Repo with Vessels

**Goal:** Ensure deployment repo has the latest vessel code.

The deployment repo uses a "vessels/" directory structure where code is synced from the main workspace:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment

# Sync metabob-activity-api
rsync -av --delete \
  ../../repos/metabob-activity-api/src/ \
  vessels/metabob-activity-api/src/

rsync -av --delete \
  ../../repos/metabob-activity-api/sql/ \
  vessels/metabob-activity-api/sql/

# Sync package.json and other config
cp ../../repos/metabob-activity-api/package.json vessels/metabob-activity-api/
cp ../../repos/metabob-activity-api/bun.lockb vessels/metabob-activity-api/ 2>/dev/null || true

# Check what changed
git status

# Commit vessel code sync
git add vessels/metabob-activity-api
git commit -m "sync: update metabob-activity-api from main workspace"

# Push
git push origin dev
```

### Phase 4: Trigger CI/CD (Automatic)

Pushing to `dev` branch in the deployment repo triggers:

1. **GitHub Actions:** `.github/workflows/deploy-canary.yml`
2. **Build:** Containers are built with tags like `{version}-{sha7}`
3. **Deploy:** Helmfile deploys to canary environment
4. **Update:** `production.canary.values.yaml` is updated with new tags

**Monitor CI/CD:**
```bash
# Watch GitHub Actions
gh run list --repo MetabobProject/deployment --limit 5

# Follow specific run
gh run view <run-id> --log --log-failed

# Or view in browser
open https://github.com/MetabobProject/deployment/actions
```

### Phase 5: Verify Deployment

**Check deployment status:**
```bash
# Verify pods are running
kubectl get pods -n activity-system

# Check new image tags
kubectl get deployments -n activity-system \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[0].image}{"\n"}{end}'

# Watch rollout
kubectl rollout status deployment -n activity-system metabob-activity-api
```

**Verify database initialization:**
```bash
# Port-forward to SurrealDB
kubectl port-forward svc/surrealdb 8000:8000 -n activity-system

# Run verification script
/tmp/verify-canary-setup.sh
```

**Test API:**
```bash
# Health check
curl https://activity.metabob.com/health

# Authenticated endpoint
curl -H "Authorization: ApiKey mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5" \
  https://activity.metabob.com/v2/activities/templates
```

---

## Checklist

### Pre-Deployment

- [ ] Review uncommitted changes in main workspace
- [ ] Run tests locally: `bun test`
- [ ] Run linting: `bun run lint`
- [ ] Verify changes are intentional (especially deletions)
- [ ] Check for secrets in code (API keys, passwords)

### Main Workspace

- [ ] Stage functional code changes
- [ ] Commit with descriptive message
- [ ] Push to origin dev

### Deployment Repo

- [ ] Update submodule references
- [ ] Sync vessel code from main workspace
- [ ] Commit vessel updates
- [ ] Push to origin dev

### CI/CD

- [ ] Verify GitHub Actions workflow triggered
- [ ] Monitor build progress
- [ ] Check for build failures
- [ ] Verify container push to registry

### Post-Deployment

- [ ] All pods running and healthy
- [ ] New image tags match expectations
- [ ] Database initialized correctly
- [ ] API authentication works
- [ ] Run `/tmp/verify-canary-setup.sh`
- [ ] Test MiniBob connectivity

---

## Rollback Plan

If deployment fails:

```bash
# 1. Check what went wrong
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=100

# 2. Rollback deployment
cd repos/deployment
git revert HEAD
git push origin dev

# 3. Or manually rollback in Kubernetes
kubectl rollout undo deployment -n activity-system metabob-activity-api

# 4. Verify rollback
kubectl rollout status deployment -n activity-system metabob-activity-api
```

---

## Key Considerations

### Schema Migrations

The changes in `repos/metabob-activity-api/sql/` will affect database schema:

- **init-test-data.ts:** Data seeding script
- **create-minibob-instance.ts:** Deleted (deprecated authentication)

**Verify migrations:**
```bash
cd repos/metabob-activity-api
bun run sql/check-migrations.ts
```

### API Key Authentication

Recent changes migrated from MiniBob instance auth to API key auth:

- Old: `POST /v2/auth/minibob/signin` with instance_id + api_key
- New: `Authorization: ApiKey <key>` header validated by identity service

**Ensure:**
- Identity service is deployed and healthy
- API keys are registered in database
- Activity-API can reach identity service

### Breaking Changes

**Check for breaking changes:**
- Schema field type changes
- Removed endpoints
- Changed authentication methods
- Modified response formats

**Test backward compatibility:**
```bash
# Test old MiniBob instances can still connect
minibob --single "test connection"
```

---

## Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Commit & push main workspace | 5 minutes | Review diffs carefully |
| Update deployment repo | 10 minutes | Sync vessels, update submodules |
| CI/CD build & deploy | 15-20 minutes | Automated |
| Verification | 10 minutes | Check pods, test API |
| **Total** | **40-45 minutes** | |

---

## Next Steps After Deployment

1. **Monitor canary for 24-48 hours**
   - Check logs for errors
   - Monitor performance metrics
   - Run integration tests

2. **Update local configuration**
   - Set METABOB_API_KEY to canary key
   - Update endpoint to activity.metabob.com
   - Test MiniBob commands

3. **Promote to production** (after canary soak)
   ```bash
   cd repos/deployment
   ./scripts/promote-canary-to-production.sh
   ```

---

## Related Documentation

- **CANARY_SETUP_GUIDE.md:** Local setup instructions
- **CANARY_DATABASE_AUDIT.md:** Database initialization analysis
- **CONTAINER_UPDATE_CHECKLIST.md:** Container version management
- **repos/deployment/DEPLOYMENT_WORKFLOW.md:** CI/CD documentation
