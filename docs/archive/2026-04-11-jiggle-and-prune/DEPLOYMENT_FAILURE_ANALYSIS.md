# Deployment Failure Analysis

**Date**: 2026-04-08
**Run**: 24161014964 (in progress)
**Status**: ❌ **FAILING**

## Executive Summary

The current deployment is failing because **user-vessel SQL files are not committed to git** in the deployment repository. The files exist locally but when CI/CD checks out the code, they're missing, causing Docker build failures.

---

## Error Chain

### 1. Build Failure
```
ERROR: failed to calculate checksum: "/sql": not found
```

**Dockerfile Line**:
```dockerfile
COPY sql ./sql
```

**Root Cause**: SQL directory exists locally but is not tracked in git

### 2. Image Not Pushed
Because the build failed, the image was never pushed to Docker Hub:
- Expected: `metabobapp/user-vessel:0.1.0-35dacd7`
- Status: **Does not exist**

### 3. Values File Updated Anyway
The build script updated `production.canary.values.yaml` with tag:
```yaml
user-vessel:
  image:
    tag: "0.1.0-7a72492"  # From a previous run
```

### 4. Helm Deployment Fails
Kubernetes tries to pull `metabobapp/user-vessel:0.1.0-7a72492`:
```
Failed to pull image: docker.io/metabobapp/user-vessel:0.1.0-7a72492: not found
```

**Result**:
- Old pod still running: `user-vessel-867c4bd5bd-zhqxj` (4 days old)
- New pod failing: `user-vessel-658966dcf6-cnzns` (ImagePullBackOff)

---

## Verification

### Files Exist Locally ✓
```bash
$ ls -la repos/deployment/vessels/user-vessel/sql/
total 16
drwxr-xr-x 3 avi avi  128 Apr  3 02:43 .
drwxr-xr-x 6 avi avi 4096 Apr  8 14:01 ..
-rw-r--r-- 1 avi avi 3519 Mar 31 05:10 001-user-vessel-extensions.surql
-rw-r--r-- 1 avi avi 4040 Apr  1 02:59 002-connection-tracking.surql
-rw-r--r-- 1 avi avi 1556 Apr  2 21:22 003-cost-tracking.surql
drwxr-xr-x 2 avi avi   86 Apr  8 13:58 schema
```

### Not Tracked in Git ❌
```bash
$ git ls-files vessels/user-vessel/sql/
(empty - nothing returned)

$ git status vessels/user-vessel/sql/
On branch dev
nothing to commit, working tree clean
```

**But the files aren't in `.gitignore` either!**

This means they were added to the local filesystem but `git add` was never run.

---

## Impact

| Service | Build Status | Image Exists | Deployment Status |
|---------|--------------|--------------|-------------------|
| metabob-activity-api | ✅ Success | ✅ Yes | ✅ Running (2/2) |
| identity-vessel | ✅ Success | ✅ Yes | ✅ Running (1/1) |
| metabob-cloud-dashboard | ✅ Success | ✅ Yes | ✅ Running (1/1) |
| **user-vessel** | ❌ **Failed** | ❌ **No** | ⚠️ **Old pod running** |
| minibob | ✅ Success | ✅ Yes | ✅ Running (1/1) |

**Critical**: user-vessel is stuck on an old image (4 days old) because new builds keep failing.

---

## Solution

### Step 1: Add SQL Files to Git

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment

# Add the SQL directory
git add vessels/user-vessel/sql/

# Verify what will be committed
git status vessels/user-vessel/sql/
```

Expected output:
```
Changes to be committed:
  new file:   vessels/user-vessel/sql/001-user-vessel-extensions.surql
  new file:   vessels/user-vessel/sql/002-connection-tracking.surql
  new file:   vessels/user-vessel/sql/003-cost-tracking.surql
  new file:   vessels/user-vessel/sql/schema/001-organizations.surql
  new file:   vessels/user-vessel/sql/schema/002-users.surql
  new file:   vessels/user-vessel/sql/schema/003-api-keys.surql
```

### Step 2: Commit

```bash
git commit -m "fix(user-vessel): add missing SQL schema files to git

The SQL directory was present locally but not tracked in git, causing
Docker builds to fail in CI/CD with '/sql: not found' error.

This commit adds all SQL schema and migration files required by the
user-vessel Dockerfile."
```

### Step 3: Push to Trigger Rebuild

```bash
git push origin dev
```

CI/CD will automatically:
1. Check out code (now with SQL files)
2. Build user-vessel successfully
3. Push image to Docker Hub
4. Update values file with new tag
5. Deploy to Kubernetes
6. Replace failed pod with working pod

**Expected Duration**: ~15 minutes

---

## Why This Happened

Looking at git history:

```bash
$ git log --oneline vessels/user-vessel/ | head -5
cd795ab chore: update canary image tags [skip ci]
18f446e chore: update canary image tags [skip ci]
c1719e1 chore: update canary image tags [skip ci]
...
```

All recent commits are just tag updates (`[skip ci]`). The SQL files were probably:
1. Created or updated locally
2. Never `git add`ed
3. CI/CD kept updating tags but never rebuilt successfully
4. Old image from 4 days ago is still running

**Likely cause**: Manual sync from main workspace without proper git add.

---

## Verification After Fix

### 1. Check Build Logs
```bash
gh run watch --repo MetabobProject/deployment
```

Look for:
```
✓ Built user-vessel
✓ Pushed user-vessel
✓ Updated environments/production.canary.values.yaml
```

### 2. Check Image Exists
```bash
# After build completes
NEW_TAG=$(grep -A 3 "user-vessel:" repos/deployment/environments/production.canary.values.yaml | grep "tag:" | awk '{print $2}' | tr -d '"')
echo "Checking for image: metabobapp/user-vessel:$NEW_TAG"

# Try to pull it
docker pull metabobapp/user-vessel:$NEW_TAG
```

Should succeed (not "not found")

### 3. Check Pod Status
```bash
kubectl get pods -n activity-system -l app.kubernetes.io/name=user-vessel

# Should show:
# NAME                          READY   STATUS    AGE
# user-vessel-<new-hash>-xxxxx  1/1     Running   <minutes>
```

### 4. Test Auth Endpoints
```bash
# Test signup through dashboard
curl -X POST https://app.metabob.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "name": "Test User",
    "org_name": "Test Org"
  }'
```

Should return `201 Created` with JWT token (not 500 or connection error)

---

## Lessons Learned

1. **Verify git tracking**: Not everything in working directory is in git
2. **CI/CD isn't perfect**: `continue-on-error: true` masked the build failure
3. **Tag updates don't mean builds succeeded**: Check actual Docker Hub
4. **Monitor deployment health**: Old pods running for days is a red flag

---

## Related Issues

### Issue #1: cloud-dashboard Auth Proxy
**Status**: Fixed locally, not deployed yet
- File: `repos/metabob-cloud-dashboard/src/index.ts`
- Change: Use `USER_VESSEL_URL` instead of `IDENTITY_VESSEL_URL`
- Blocked by: This user-vessel deployment issue

Once user-vessel is fixed and both are deployed:
- Dashboard → user-vessel auth will work
- Signup/login will be functional

### Issue #2: Missing Test/Lint in CI
**Status**: Disabled, needs fixing
- Tests commented out in workflow
- Linting commented out in workflow
- Secret scanning needs Gitleaks license

---

## Immediate Next Steps

1. ✅ **Fix user-vessel SQL files** (add to git, commit, push)
2. ⏳ **Wait for deployment** (~15 min)
3. ✅ **Verify user-vessel is running**
4. 🔄 **Deploy cloud-dashboard auth fix**
5. ✅ **Test end-to-end auth flow**
6. 📊 **Update documentation**

---

## Commands Summary

```bash
# Fix SQL files
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment
git add vessels/user-vessel/sql/
git commit -m "fix(user-vessel): add missing SQL schema files to git"
git push origin dev

# Monitor
gh run watch --repo MetabobProject/deployment

# Verify
kubectl get pods -n activity-system -l app.kubernetes.io/name=user-vessel -w
```

---

## Timeline

| Time | Event | Status |
|------|-------|--------|
| 21:18 | Build triggered (run 24159247957) | Started |
| 21:21 | user-vessel build failed ("/sql" not found) | ❌ Failed |
| 21:21 | Build continued with error | ⚠️ Masked |
| 21:33 | Helm deploy failed (image not found) | ❌ Failed |
| 22:02 | Manual rebuild triggered (run 24161014964) | Started |
| 22:15 | Still failing (SQL files still not in git) | ❌ In Progress |
| **NOW** | **Root cause identified** | **Ready to fix** |

---

## Conclusion

**Single fix needed**: Add SQL files to git

**Confidence**: 🟢 **HIGH** - Clear root cause, straightforward solution

**Risk**: 🟢 **LOW** - Just adding missing files, no code changes

**Ready to proceed with fix!**
