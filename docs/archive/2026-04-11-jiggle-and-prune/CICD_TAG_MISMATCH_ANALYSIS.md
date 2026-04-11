# CI/CD Tag Mismatch Analysis

## The Problem You Identified

**You're absolutely right**: The CI/CD should build images with correct tags and deploy with those same tags. But that's not happening.

## What's Actually Happening

### Timeline of user-vessel Builds

| Commit | Tag Format | Build Result | Image Exists? | Deployment Status |
|--------|-----------|--------------|---------------|-------------------|
| `bd76d83` | `0.1.0-bd76d83` | ✅ **Success** | ✅ **Yes** | ✅ **Running** (4 days) |
| `7a72492` | `0.1.0-7a72492` | ❌ Failed (SQL missing) | ❌ **No** | ⚠️ In values file |
| `35dacd7` | `0.1.0-35dacd7` | ❌ Failed (SQL missing) | ❌ **No** | ⚠️ Attempted |
| `3aff6b6` | `0.1.0-3aff6b6` | ❌ Failed (SQL missing) | ❌ **No** | ⚠️ Attempted |

### Current State Mismatch

**What's Running**:
```bash
$ kubectl get pod user-vessel-867c4bd5bd-zhqxj -o jsonpath='{.spec.containers[0].image}'
metabobapp/user-vessel:0.1.0-bd76d83  # ✅ This image EXISTS
```

**What Deployment is Configured For**:
```bash
$ kubectl get deployment user-vessel -o jsonpath='{.spec.template.spec.containers[0].image}'
metabobapp/user-vessel:0.1.0-bd76d83  # ✅ Still the old one (Helm rollback)
```

**What Values File Says**:
```yaml
# environments/production.canary.values.yaml
user-vessel:
  image:
    tag: "0.1.0-7a72492"  # ❌ This image DOESN'T EXIST
```

**What Recent Build Tried**:
```
Building user-vessel with tag: 0.1.0-35dacd7  # ❌ Build failed, no image
```

## Root Cause Analysis

### Issue #1: SQL Files Not in Git ✅ IDENTIFIED
```
Docker build: COPY sql ./sql
                      ↓
Git repo: sql/ directory not tracked
                      ↓
CI/CD checkout: sql/ directory empty
                      ↓
Build fails: "/sql": not found
```

### Issue #2: Values File Update Logic ⚠️ PROBLEMATIC

**Current build_changed.sh logic**:
```bash
build_vessel() {
  # ...
  docker build ... || {
    echo "Build failed"
    return 1  # ← STOPS HERE if build fails
  }

  docker push ... || {
    echo "Push failed"
    return 1  # ← STOPS HERE if push fails
  }

  update_environment_values "$vessel_name" "$tag"  # ← NEVER REACHED if build/push fails
}
```

**This is correct!** The values file should NOT be updated if build/push fails.

**But why does the values file have `0.1.0-7a72492`?**

Let me check...

```bash
$ git show cd795ab:environments/production.canary.values.yaml | grep -A 2 "user-vessel:"
user-vessel:
  replicaCount: 2
  image:
    tag: "0.1.0-7a72492"
```

**Commit cd795ab**: "chore: update canary image tags [skip ci]"

This tag was set by a CI/CD run that thought it built successfully with commit 7a72492. But that image doesn't actually exist in Docker Hub, which means either:

1. The build succeeded locally but push failed (and values got updated anyway - BUG!)
2. The build succeeded in CI but the image was later deleted
3. There's a race condition in the build script

### Issue #3: Helm Deployment Behavior ℹ️ CORRECT

When Helm tries to deploy with tag `0.1.0-7a72492`:
1. Creates new ReplicaSet with image `user-vessel:0.1.0-7a72492`
2. Tries to start pod
3. Pod fails to pull image (doesn't exist)
4. Helm waits for timeout
5. **Helm rollback** (because of `--atomic` flag)
6. Old deployment still running with `0.1.0-bd76d83`

This is actually correct behavior! Helm is protecting us from a bad deployment.

## The Real Issues

### 1. SQL Files Not Tracked in Git
**Impact**: All builds since `bd76d83` have failed

**Fix**:
```bash
cd repos/deployment
git add vessels/user-vessel/sql/
git commit -m "fix(user-vessel): add SQL schema files to git"
git push origin dev
```

### 2. Values File Has Non-Existent Tag
**Impact**: Helm keeps trying to deploy non-existent image

**How it got this way**: Unknown - need to investigate build logs from when `7a72492` was set

**Fix**: Either:
- Option A: Let it auto-fix when next build succeeds (adds SQL files)
- Option B: Manually update values file to use `bd76d83` (the working tag)
- Option C: Manually update values file to use `latest` temporarily

### 3. Continue-on-Error in Workflow
**Impact**: CI/CD appears "successful" even when builds fail

**Current workflow**:
```yaml
- name: Build and push images
  continue-on-error: true  # ← DANGEROUS!
  run: ./scripts/build_changed.sh --env canary --push --force
```

This masks failures! The build script returns exit code 1 when vessels fail, but the workflow continues anyway.

## What Should Happen (Correct CI/CD Flow)

```
1. Commit 35dacd7 pushed to dev
        ↓
2. CI/CD triggered
        ↓
3. Build all changed vessels
   - metabob-cloud-dashboard: ✅ Success → tag: 0.2.2-35dacd7
   - user-vessel: ❌ Failed → NO TAG UPDATE
        ↓
4. Update values file with ONLY successful builds
   values.yaml:
     metabob-cloud-dashboard:
       tag: "0.2.2-35dacd7"  ✅ Updated
     user-vessel:
       tag: "0.1.0-bd76d83"  ✅ Unchanged (old working tag)
        ↓
5. Helm deploy
   - cloud-dashboard: ✅ Deploys with new image
   - user-vessel: ✅ Stays on old working image
        ↓
6. Health checks pass
        ↓
7. Deployment successful (partial update is OK!)
```

## What's Actually Happening (Broken Flow)

```
1. Commit 35dacd7 pushed
        ↓
2. CI/CD triggered
        ↓
3. Build all vessels
   - cloud-dashboard: ✅ Success
   - user-vessel: ❌ Failed (SQL missing)
        ↓
4. Update values file (BUG - how did user-vessel tag get updated?)
   values.yaml:
     metabob-cloud-dashboard:
       tag: "0.2.2-35dacd7"  ✅
     user-vessel:
       tag: "0.1.0-7a72492"  ❌ NON-EXISTENT IMAGE
        ↓
5. Helm deploy
   - cloud-dashboard: ✅ Works
   - user-vessel: ❌ Fails (image not found)
        ↓
6. Helm rollback user-vessel to old image
        ↓
7. Deployment "succeeds" but user-vessel still on old image
```

## Investigation Needed

**Question**: How did `0.1.0-7a72492` get into the values file if the build failed?

**Check commit cd795ab**:
```bash
$ git show cd795ab --stat
commit cd795ab
Author: github-actions[bot]
Date:   ...

    chore: update canary image tags [skip ci]

 environments/production.canary.values.yaml | 8 ++++----
 1 file changed, 4 insertions(+), 4 deletions(-)
```

This was auto-committed by CI/CD. Let's see what the build logs said...

**Hypothesis**: The build script has a bug where it updates values even on failure, OR there was a successful build at commit 7a72492 but the image push failed or was later deleted.

## Recommended Fixes

### Immediate (Now)

1. **Add SQL files to git** ✅ This fixes the build failure
   ```bash
   git add vessels/user-vessel/sql/
   git commit -m "fix(user-vessel): add SQL schema files"
   git push origin dev
   ```

2. **Let CI/CD rebuild** - It will create `0.1.0-{new-sha}` successfully

### Short-term (This Week)

1. **Remove `continue-on-error: true`** from workflow
   - Let builds fail loudly
   - Don't mask errors

2. **Add build verification** after push
   ```bash
   # In build_changed.sh after docker push
   docker pull "$tag" || {
     echo "Failed to verify pushed image!"
     return 1
   }
   ```

3. **Only update values file for successful builds**
   - Already implemented correctly in script
   - But verify it's actually working

### Long-term (This Month)

1. **Add image existence check before Helm deploy**
   ```yaml
   - name: Verify images exist
     run: |
       for tag in $(yq '.*.image.tag' environments/production.canary.values.yaml); do
         docker pull metabobapp/service:$tag || exit 1
       done
   ```

2. **Add build report**
   - Show which vessels built successfully
   - Show which failed and why
   - Don't proceed with deployment if critical services failed

3. **Separate build and deploy jobs**
   - Build job: Build + push images
   - Verification job: Verify all images exist
   - Deploy job: Only runs if verification passes

## Correct CI/CD Flow Design

```yaml
jobs:
  build:
    steps:
      - Build all changed vessels
      - Push successful builds
      - Update values file ONLY for successful builds
      - Output: List of built tags + failed vessels
      - Exit code: 0 if all critical vessels succeeded, 1 if any critical failed

  verify:
    needs: build
    steps:
      - Read values file
      - Verify all referenced images exist in Docker Hub
      - Exit code: 0 if all exist, 1 if any missing

  deploy:
    needs: verify
    steps:
      - Helm deploy with verified tags
      - Health checks
      - Traffic shifting
```

## Commands to Fix Now

```bash
# 1. Fix SQL files
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment
git add vessels/user-vessel/sql/
git status vessels/user-vessel/sql/  # Verify files will be committed

# 2. Commit
git commit -m "fix(user-vessel): add missing SQL schema files to git

SQL files were present locally but not tracked in git, causing
Docker builds to fail in CI/CD with '/sql: not found' errors.

This resolves ImagePullBackOff errors for user-vessel deployments."

# 3. Push
git push origin dev

# 4. Monitor
gh run watch --repo MetabobProject/deployment

# 5. Verify build
gh run view --repo MetabobProject/deployment --log | grep "user-vessel"

# Should see:
# ✓ Built user-vessel
# ✓ Pushed user-vessel
# ✓ Updated environments/production.canary.values.yaml
```

## Expected Outcome

After SQL files are added:
1. ✅ Build succeeds: `user-vessel:0.1.0-{sha}`
2. ✅ Push succeeds
3. ✅ Values file updated with correct tag
4. ✅ Helm deploys with correct tag
5. ✅ Pod starts successfully
6. ✅ Old pod terminated
7. ✅ user-vessel running latest code

Then cloud-dashboard auth fix can be deployed!

---

## Summary

**You're Correct**: CI/CD should build with correct tags and deploy with those tags.

**What's Wrong**:
1. ❌ SQL files not in git → builds failing
2. ❌ Values file has non-existent tag (investigation needed)
3. ❌ `continue-on-error` masks failures

**What's Right**:
1. ✅ Build script logic (doesn't update values on failure)
2. ✅ Helm rollback on failed deployment
3. ✅ Tag format is consistent

**Next Action**: Add SQL files to git and push!
