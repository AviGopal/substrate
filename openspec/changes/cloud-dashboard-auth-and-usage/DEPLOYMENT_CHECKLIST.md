# Deployment Checklist: Cloud Dashboard Auth and Usage Features

This checklist guides the deployment of authentication, members management, usage analytics, and execution trace viewer features from development through canary to production.

## Pre-Deployment Verification

### Code Quality Checks

- [ ] **Backend Tests Pass**
  ```bash
  cd repos/user-vessel
  bun test  # Should pass or show "0 test files" (expected)
  ```

- [ ] **Frontend Build Succeeds**
  ```bash
  cd repos/metabob-cloud-dashboard
  bun run build
  # Expected: ✅ Build completed in ~200ms
  ```

- [ ] **TypeScript Compilation Passes**
  - No errors in `bun run build` output
  - All imports resolve correctly
  - No type mismatches

- [ ] **Manual Testing Complete**
  - All items in TESTING_GUIDE.md Testing Sign-off Checklist completed
  - Critical bugs fixed or documented
  - Known issues documented in release notes

### Code Review

- [ ] **All changes reviewed**
  - Auth endpoints (signup, login, /auth/me) reviewed
  - Frontend pages (Members, UsageAnalytics, ExecutionTraces) reviewed
  - API integrations reviewed
  - Security considerations verified

- [ ] **RBAC enforcement verified**
  - Admin-only actions properly gated
  - Member roles enforced in backend
  - Frontend UI reflects permissions

- [ ] **Security checklist**
  - Passwords hashed with Bun.password.hash()
  - Password validation enforced (8+ chars, complexity)
  - JWT tokens use appropriate expiry (15 minutes)
  - No credentials in code or logs
  - CORS configured correctly

### Git Preparation

- [ ] **All changes committed**
  ```bash
  git status
  # Should show clean working tree or only expected changes
  ```

- [ ] **Commit messages follow convention**
  - Format: `<type>(<scope>): <subject>`
  - Types: feat, fix, refactor, test, docs
  - Scopes: user-vessel, cloud-dashboard, activity-api

- [ ] **Branch is up to date**
  ```bash
  git fetch origin
  git status
  # Should show "Your branch is up to date with 'origin/main'"
  ```

## Environment Variables and Secrets

### user-vessel (Identity Service)

Required environment variables:

- [ ] `SURREALDB_URL` - Database connection URL
- [ ] `SURREALDB_NAMESPACE` - Database namespace (activity-system)
- [ ] `SURREALDB_DATABASE` - Database name (learning_loop)
- [ ] `SURREALDB_USERNAME` - Database username
- [ ] `SURREALDB_PASSWORD` - Database password (secret)
- [ ] `JWT_SECRET` - JWT signing secret (must be secure, 32+ chars)
- [ ] `JWT_EXPIRES_IN` - Token expiry (default: 15m)
- [ ] `USER_VESSEL_PORT` - Service port (default: 8080)

**Verify secrets exist:**
```bash
# For canary/production deployment
# Secrets should be in GitHub repository secrets or Kubernetes secrets
kubectl get secret user-vessel-secrets -n activity-system
```

### metabob-cloud-dashboard

Required environment variables:

- [ ] `USER_VESSEL_URL` - Identity service URL
  - Local: `http://user-vessel.activity-system.svc.cluster.local:8080`
  - Canary: `https://identity.metabob.com`
  - Production: `https://identity.metabob.com`

- [ ] `ACTIVITY_API_URL` - Activity API URL
  - Local: `http://metabob-activity-api.activity-system.svc.cluster.local:8080`
  - Canary: `https://activity.metabob.com`
  - Production: `https://activity.metabob.com`

### Secrets Management

- [ ] **JWT_SECRET generated and stored securely**
  ```bash
  # Generate strong JWT secret (do this once)
  openssl rand -hex 32

  # Store in Kubernetes secret
  kubectl create secret generic user-vessel-secrets \
    --from-literal=jwt-secret=<generated-secret> \
    -n activity-system
  ```

- [ ] **SurrealDB credentials available**
  - Should already exist from metabob-activity-api deployment
  - Verify: `kubectl get secret surrealdb-auth -n activity-system`

## Database Migrations

### user-vessel Schema Extensions

- [ ] **Check if migrations already applied**
  ```bash
  # Query SurrealDB to check if password_hash field exists
  curl -X POST http://surql.metabob.local/sql \
    -u 'root:password' \
    -H "surreal-ns: activity-system" \
    -H "surreal-db: learning_loop" \
    -d 'INFO FOR TABLE users;'
  ```

- [ ] **Apply schema if needed**
  ```bash
  cd repos/user-vessel
  bun run apply-schema

  # Or manually:
  surreal sql --endpoint http://localhost:8000 \
    --namespace activity-system \
    --database learning_loop \
    --username root \
    --password <password> \
    --file sql/001-user-vessel-extensions.surql
  ```

- [ ] **Verify schema applied**
  - `users` table has `password_hash` field
  - `user_password` ACCESS method defined
  - No errors in migration logs

## Deployment Steps

### Step 1: Push to dev Branch (Triggers Canary)

```bash
# Ensure you're on the correct branch
git checkout dev
git pull origin dev

# Push changes
git push origin dev
```

**What happens automatically:**
1. GitHub Actions workflow `deploy-canary.yml` triggers
2. Changed vessels detected (user-vessel, metabob-cloud-dashboard)
3. Docker images built with canary tags
4. Images pushed to Docker Hub
5. `production.canary.values.yaml` updated with new tags
6. Deployment to canary environment (GKE)
7. Health checks run

- [ ] **Monitor GitHub Actions workflow**
  ```bash
  gh run list --repo MetabobProject/deployment --limit 5
  gh run view <run-id> --log
  ```

- [ ] **Verify canary deployment starts**
  - Workflow shows "Deploying to canary..."
  - No build errors
  - Image push succeeds

### Step 2: Monitor Canary Deployment

- [ ] **Check pod status**
  ```bash
  # Wait for pods to be ready (may take 2-3 minutes)
  kubectl get pods -n activity-system -l environment=canary -w

  # All pods should show Running with 1/1 READY
  ```

- [ ] **Check service health**
  ```bash
  # user-vessel health
  curl https://identity.metabob.com/health
  # Expected: {"status":"healthy"}

  # cloud-dashboard health
  curl https://app.metabob.com/health
  # Expected: {"status":"ok"} or similar

  # activity-api health (should still work)
  curl https://activity.metabob.com/health
  # Expected: {"status":"ok"}
  ```

- [ ] **Check logs for errors**
  ```bash
  # user-vessel logs
  kubectl logs -n activity-system -l app.kubernetes.io/name=user-vessel -l environment=canary --tail=100

  # cloud-dashboard logs
  kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-cloud-dashboard -l environment=canary --tail=100
  ```

### Step 3: Validate in Canary Environment

Run through critical user flows against canary:

- [ ] **Test signup flow**
  ```bash
  curl -X POST https://identity.metabob.com/v2/auth/signup \
    -H "Content-Type: application/json" \
    -d '{
      "email": "canary-test@example.com",
      "password": "CanaryTest123",
      "name": "Canary Tester",
      "org_name": "Canary Test Org"
    }'
  # Expected: 201 Created with token
  ```

- [ ] **Test login flow**
  ```bash
  curl -X POST https://identity.metabob.com/v2/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "canary-test@example.com",
      "password": "CanaryTest123"
    }'
  # Expected: 200 OK with token
  ```

- [ ] **Test /auth/me endpoint**
  ```bash
  # Use token from login response
  curl https://identity.metabob.com/v2/auth/me \
    -H "Authorization: Bearer <token>"
  # Expected: 200 OK with user profile
  ```

- [ ] **Test dashboard access in browser**
  - Navigate to https://app.metabob.com
  - Login with canary test account
  - Verify all pages load:
    - API Keys page
    - Members page
    - Usage Analytics page
    - Activity Traces page
  - Test key interactions (add member, view trace detail, etc.)

- [ ] **Check for JavaScript errors**
  - Open browser console (F12)
  - Navigate through all pages
  - No console errors should appear
  - Network tab shows successful API calls

### Step 4: Canary Soak Period (24-48 Hours Recommended)

- [ ] **Monitor canary stability**
  - Check error rates in logs
  - Monitor resource usage (CPU, memory)
  - Watch for any crashes or restarts

- [ ] **Performance monitoring**
  ```bash
  # Check pod resource usage
  kubectl top pods -n activity-system -l environment=canary
  ```

- [ ] **Collect feedback**
  - Test with multiple users if possible
  - Document any issues discovered
  - Decide: Fix and redeploy to canary, or rollback

**Decision Point:**
- ✅ **Proceed to production** if no critical issues found
- ⚠️ **Fix and redeploy** if minor issues found
- ❌ **Rollback** if critical issues found

### Step 5: Promote to Production

**IMPORTANT:** Only proceed if canary validation passed and soak period completed.

#### Option A: Manual Promotion Script (Recommended)

```bash
cd repos/deployment

# Promote with health checks
./scripts/promote-canary-to-production.sh

# Or specify exact canary tag:
./scripts/promote-canary-to-production.sh 20260408-v0.2.2-abc1234-1234567890

# Dry-run first (recommended):
./scripts/promote-canary-to-production.sh --dry-run
```

**Script performs these steps:**
1. Health check canary environment
2. Pull and retag Docker images (canary → latest)
3. Update `production.values.yaml`
4. Deploy to production via helmfile
5. Wait for rollout to complete
6. Health check production environment

- [ ] **Promotion script succeeds**
  - All health checks pass
  - No errors during image retagging
  - Helmfile deployment succeeds
  - Production health checks pass

#### Option B: GitHub Actions Workflow

- [ ] **Trigger manual promotion workflow**
  1. Go to GitHub Actions → "Promote to Production"
  2. Click "Run workflow"
  3. Type "PROMOTE" in confirmation field
  4. Click "Run workflow"

- [ ] **Monitor workflow execution**
  ```bash
  gh run list --repo MetabobProject/deployment --limit 5
  gh run view <run-id> --log
  ```

### Step 6: Verify Production Deployment

- [ ] **Check pod status**
  ```bash
  kubectl get pods -n activity-system -l environment=production -w
  # All pods should show Running with READY
  ```

- [ ] **Health checks**
  ```bash
  # user-vessel
  curl https://identity.metabob.com/health

  # cloud-dashboard
  curl https://app.metabob.com/health

  # activity-api (should still work)
  curl https://activity.metabob.com/health
  ```

- [ ] **Verify all services responding**
  - Identity service: https://identity.metabob.com
  - Dashboard: https://app.metabob.com
  - Activity API: https://activity.metabob.com

- [ ] **Test critical flows in production**
  - Signup new account
  - Login with existing account
  - Access Members page
  - Access Usage Analytics page
  - Access Activity Traces page
  - View trace detail

- [ ] **Check for errors in production logs**
  ```bash
  # user-vessel
  kubectl logs -n activity-system -l app.kubernetes.io/name=user-vessel -l environment=production --tail=200

  # cloud-dashboard
  kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-cloud-dashboard -l environment=production --tail=200
  ```

### Step 7: Post-Deployment Validation

- [ ] **Monitor production for 1-2 hours**
  - Watch pod status
  - Check error rates
  - Monitor resource usage
  - Verify user traffic is being served

- [ ] **User acceptance testing**
  - Have team members test production environment
  - Verify all features working as expected
  - Document any issues

- [ ] **Update documentation**
  - Mark tasks 7.1-7.13 as complete in tasks.md
  - Update README if needed
  - Document any deployment notes or gotchas

## Rollback Procedures

### If Issues Found in Canary

**Stop before production promotion**

```bash
# Option 1: Revert git changes
cd repos/deployment
git revert HEAD
git push origin dev
# CI/CD will auto-deploy previous version to canary

# Option 2: Manual rollback via Helm
helm rollback user-vessel -n activity-system
helm rollback metabob-cloud-dashboard -n activity-system
```

### If Issues Found in Production

**Act quickly to minimize impact**

```bash
# Option 1: Automated rollback script (fastest)
cd repos/deployment
./scripts/rollback-production.sh <previous-canary-tag>

# Option 2: Helm rollback (most reliable)
helm rollback user-vessel -n activity-system
helm rollback metabob-cloud-dashboard -n activity-system

# Option 3: Manual kubectl image update (targeted)
kubectl set image deployment/user-vessel \
  user-vessel=metabobapp/user-vessel:<previous-tag> \
  -n activity-system
```

- [ ] **Verify rollback successful**
  ```bash
  # Check pod status
  kubectl get pods -n activity-system -l environment=production

  # Health checks
  curl https://identity.metabob.com/health
  curl https://app.metabob.com/health

  # Check deployed image tags
  kubectl get deployment -n activity-system -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[0].image}{"\n"}{end}'
  ```

- [ ] **Document rollback reason**
  - Create GitHub issue describing the problem
  - Document what went wrong
  - Plan fix and re-deployment

## Post-Deployment Tasks

### Communication

- [ ] **Notify team of successful deployment**
  - Send Slack notification or email
  - Include what was deployed
  - Note any known limitations or issues

- [ ] **Update project tracking**
  - Mark Jira/GitHub issues as deployed
  - Update project board status
  - Close completed tasks

### Monitoring Setup

- [ ] **Set up alerts (if not already configured)**
  - High error rate alerts
  - Service down alerts
  - High resource usage alerts

- [ ] **Dashboard monitoring**
  - Add deployment annotation to metrics dashboards
  - Monitor user activity
  - Track error rates

### Documentation Updates

- [ ] **Update CHANGELOG.md** (if exists)
  ```markdown
  ## [0.2.2] - 2026-04-08

  ### Added
  - Email/password authentication (signup, login, /auth/me)
  - Members management page with role-based access
  - Usage Analytics page with cost tracking and charts
  - Activity Traces page with filtering and detail view

  ### Changed
  - Dashboard now requires authentication
  - API calls include JWT token

  ### Fixed
  - (List any bugs fixed)
  ```

- [ ] **Update README.md** (if needed)
  - Document new authentication flow
  - Add environment variables section
  - Update setup instructions

### Cleanup

- [ ] **Remove test accounts created during testing**
  ```sql
  -- In SurrealDB
  DELETE users WHERE email LIKE 'test%' OR email LIKE 'canary-test%';
  DELETE organizations WHERE name LIKE '%Test%';
  ```

- [ ] **Archive deployment logs** (optional)
  ```bash
  # Save deployment logs for record-keeping
  kubectl logs -n activity-system -l app.kubernetes.io/name=user-vessel > user-vessel-deployment.log
  kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-cloud-dashboard > dashboard-deployment.log
  ```

## Deployment Sign-Off

**Date:** _______________

**Deployed By:** _______________

**Deployment Type:**
- [ ] Canary only (testing)
- [ ] Production promotion

**Canary Soak Period:** _____ hours/days

**Production Validation:**
- [ ] All health checks passed
- [ ] User acceptance testing completed
- [ ] No critical errors in logs
- [ ] Performance within acceptable range

**Rollback Plan:**
- [ ] Tested and documented
- [ ] Previous image tags available

**Known Issues:**
(Document any known issues or limitations)

---

**Approvals:**

Technical Lead: _______________ Date: _______________

Product Owner: _______________ Date: _______________

---

## Quick Reference: Key Commands

```bash
# Monitor GitHub Actions
gh run list --repo MetabobProject/deployment --limit 5
gh run view <run-id> --log

# Check canary pods
kubectl get pods -n activity-system -l environment=canary

# Check production pods
kubectl get pods -n activity-system -l environment=production

# Health checks
curl https://identity.metabob.com/health
curl https://app.metabob.com/health
curl https://activity.metabob.com/health

# View logs
kubectl logs -n activity-system -l app.kubernetes.io/name=user-vessel --tail=100 -f
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-cloud-dashboard --tail=100 -f

# Promote to production
cd repos/deployment
./scripts/promote-canary-to-production.sh

# Rollback production
./scripts/rollback-production.sh <previous-tag>
helm rollback user-vessel -n activity-system
```

## Support and Troubleshooting

**Common Issues:**

1. **"Network Error" in dashboard**
   - Check USER_VESSEL_URL environment variable
   - Verify user-vessel pod is running
   - Check CORS configuration

2. **"Unauthorized" errors**
   - Check JWT_SECRET matches between services
   - Verify token expiry time
   - Check Authorization header format

3. **Empty data in Usage Analytics**
   - Verify activity-api is accessible
   - Check if execution traces exist in database
   - Verify API endpoint configuration

4. **Database connection errors**
   - Check SURREALDB_URL is correct
   - Verify SurrealDB pod is running
   - Check namespace and database name

For additional help, see:
- TESTING_GUIDE.md - Comprehensive testing instructions
- repos/deployment/DEPLOYMENT_WORKFLOW.md - Detailed deployment guide
- CLAUDE.md - Development philosophy and best practices
