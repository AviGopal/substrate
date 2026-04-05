# Deployment Reliability Issues Analysis

## Executive Summary

After analyzing the deployment configuration and researching Kubernetes/Helm best practices, I've identified **7 critical reliability issues** that explain why deployments are not consistently successful. These issues revolve around:

1. **Improper Helm hook usage**
2. **Race conditions between init jobs and application pods**
3. **Inconsistent migration patterns**
4. **Suboptimal Job configuration**
5. **Missing dependency guarantees**

---

## Critical Issues Found

### Issue 1: Migration Job Without Proper Helm Hooks ❌

**File:** `charts/surrealdb/templates/migration-job.yaml`

**Problem:**
- Migration job is a regular `Job` without Helm hook annotations
- Job name includes `.Release.Revision` which creates a new job on every upgrade
- No `helm.sh/hook` annotations, so Helm doesn't wait for completion
- Helmfile considers the release "done" before migration completes

**Current Code:**
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ .Values.name }}-migration-{{ .Release.Revision }}
  # NO HELM HOOKS! ❌
spec:
  backoffLimit: 10  # Too high
  template:
    spec:
      restartPolicy: OnFailure  # Wrong for migrations
```

**Impact:**
- Activity-api pods start before migrations finish
- Database schema incomplete when services connect
- Random failures depending on timing
- Accumulated failed jobs not cleaned up

**Best Practice from Research:**

According to [Helm documentation](https://helm.sh/docs/topics/charts_hooks/) and [migration best practices](https://atlasgo.io/guides/deploying/helm):

> "To satisfy the principle of having migrations run before the new application version starts, as well as ensure that only one migration job runs concurrently, use Helm's pre-upgrade hooks feature."

**Fix:**
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ .Values.name }}-migration
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "0"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  backoffLimit: 3
  activeDeadlineSeconds: 600  # 10 minutes total
  template:
    spec:
      restartPolicy: Never  # Create new pods for debugging
```

---

### Issue 2: Inconsistent Hook Weights and Ordering ⚠️

**Problem:**
Multiple jobs with unclear ordering and weight gaps:
- SurrealDB migration: No hook weight (runs as regular job)
- Activity-api init-db: weight `-5` (pre-install hook)
- SurrealDB init-data: weight `10` (post-install hook)

**Race Condition:**
```
1. Helm renders all templates
2. Activity-api init-db hook runs (weight -5) ← May run BEFORE migration!
3. SurrealDB migration job starts (no hook, no wait)
4. Helm considers release ready
5. Application pods start
6. Init-data hook runs (weight 10)
7. Migration still running? Services fail!
```

**Fix:**
Clear weight hierarchy:
```yaml
# Weight -10: Pre-checks (connectivity, prerequisites)
# Weight -5:  NOT USED
# Weight 0:   Schema migrations (SurrealDB migration)
# Weight 5:   Post-migration setup (indexes, functions)
# Weight 10:  Seed data (init-data, test fixtures)
# Weight 15:  Validation jobs
```

---

### Issue 3: Wrong `restartPolicy` for Migration Jobs ❌

**File:** `charts/surrealdb/templates/migration-job.yaml:20`

**Current:**
```yaml
restartPolicy: OnFailure
```

**Problem:**
According to [Kubernetes documentation](https://kubernetes.io/docs/concepts/workloads/controllers/job/) and [troubleshooting guides](https://oneuptime.com/blog/post/2026-02-09-job-failures-backoff-restart/view):

> "With OnFailure, Kubernetes restarts the container within the same Pod... Use Never when debugging information from each attempt is valuable."

For migrations:
- Each failure creates useful logs for debugging
- Restarting in same pod loses failure context
- Migration state may be partially applied

**Fix:**
```yaml
restartPolicy: Never
```

This creates a new pod for each retry, preserving failed pods for inspection.

---

### Issue 4: `backoffLimit` Too High for Migrations ⚠️

**Current:** `backoffLimit: 10` (migration-job.yaml:13)

**Problem:**
According to [best practices](https://www.baeldung.com/ops/kubernetes-backofflimit):

> "For a database migration that either works or doesn't, a backoffLimit of 2–4 is reasonable."

10 retries means:
- 10 attempts at applying potentially broken migrations
- Each retry delays deployment by minutes
- May apply partial migrations multiple times
- Masks real configuration problems

**Fix:**
```yaml
backoffLimit: 3
activeDeadlineSeconds: 600  # Fail after 10 minutes total
```

---

### Issue 5: Helm `atomic: true` Conflicts with Hook Failures ❌

**File:** `helmfiles/local.yaml.gotmpl:11`

**Current:**
```yaml
helmDefaults:
  atomic: true  # ← Causes issues with hooks
  cleanupOnFail: true
```

**Problem:**
From [Helm documentation](https://helm.sh/docs/topics/charts_hooks/):

> "If a hook resource is a Job or Pod kind, Helm will wait until it successfully runs to completion, and if the hook fails, the release will fail."

With `atomic: true`:
- Hook failure triggers **immediate rollback**
- Rollback may delete debugging information
- No time to investigate what went wrong
- Creates cascade of failed releases

**For Local Development Fix:**
```yaml
helmDefaults:
  atomic: false  # Allow inspection of failures
  wait: true
  timeout: 900
  cleanupOnFail: false  # Keep resources for debugging
```

**For Production:**
```yaml
helmDefaults:
  atomic: true  # Rollback on failure (safer)
  wait: true
  timeout: 900
  cleanupOnFail: true
```

---

### Issue 6: Hook Delete Policy Race Condition ⚠️

**File:** `charts/surrealdb/templates/init-data-job.yaml:10`

**Current:**
```yaml
"helm.sh/hook-delete-policy": before-hook-creation
```

**Problem:**
According to [hook lifecycle research](https://alexandre-vazquez.com/understanding-helm-hooks-a-guide-to-using-hooks-in-your-helm-charts/):

> "Setting 'before-hook-creation' deletes the previous resource before a new hook is launched, and hook-succeeded deletes the resource after the hook is successfully executed."

With only `before-hook-creation`:
- Successful jobs accumulate (never cleaned)
- Failed jobs remain forever
- Namespace gets cluttered

**Fix:**
```yaml
"helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
```

This combination:
- Cleans successful jobs automatically
- Preserves failed jobs for debugging
- Prevents "already exists" errors on upgrade

---

### Issue 7: No Init Containers in Application Deployments ❌

**File:** `charts/metabob-activity-api/templates/deployment.yaml`

**Problem:**
Application pods have no init containers to verify database readiness. They start immediately after helmfile considers the release ready, which may be before:
- Migrations complete
- Database is actually ready
- Schema is fully applied

**Current Flow:**
```
1. Helmfile deploys surrealdb ✓
2. Migration job starts (not tracked by helmfile)
3. Helmfile deploys activity-api ✓ ← TOO EARLY!
4. Activity-api pod starts
5. Connection to DB succeeds
6. But schema not ready! ← RACE CONDITION
```

**Best Practice:**
According to [ASP.NET Core Kubernetes guide](https://andrewlock.net/deploying-asp-net-core-applications-to-kubernetes-part-7-running-database-migrations/):

> "A preferred approach is to build a CLI tool responsible for executing database migrations, deployed as a Kubernetes job, with an init container inside each application pod that delays application startup until after the job completes successfully."

**Fix:**
Add init container to deployment:
```yaml
spec:
  template:
    spec:
      initContainers:
      - name: wait-for-migration
        image: busybox:1.36
        command: ['sh', '-c']
        args:
        - |
          echo "Waiting for migration job to complete..."
          until kubectl wait --for=condition=complete job/surrealdb-migration -n activity-system --timeout=600s 2>/dev/null; do
            echo "Migration not complete, waiting..."
            sleep 5
          done
          echo "Migration complete!"
      containers:
      - name: activity-api
        # ... application container
```

---

## Recommended Fix Priority

### High Priority (Fix First)

1. **Add Helm hooks to migration job** (Issue #1)
   - Add `helm.sh/hook: pre-install,pre-upgrade`
   - Remove `.Release.Revision` from job name
   - Add proper delete policy

2. **Fix restartPolicy in migration jobs** (Issue #3)
   - Change from `OnFailure` to `Never`
   - Preserves debugging information

3. **Add init containers to deployments** (Issue #7)
   - Wait for migration job completion
   - Prevent race conditions

### Medium Priority

4. **Reduce backoffLimit** (Issue #4)
   - Change from 10 to 3
   - Add `activeDeadlineSeconds: 600`

5. **Fix hook delete policies** (Issue #6)
   - Add `hook-succeeded` to all hooks
   - Prevent job accumulation

### Low Priority (Improvements)

6. **Standardize hook weights** (Issue #2)
   - Clear weight hierarchy
   - Document ordering

7. **Adjust atomic setting** (Issue #5)
   - Disable for local development
   - Keep enabled for production

---

## Implementation Plan

### Step 1: Fix SurrealDB Migration Job

**File:** `charts/surrealdb/templates/migration-job.yaml`

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ .Values.name }}-migration  # Remove revision suffix
  namespace: {{ .Values.namespace }}
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "0"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
  labels:
    app.kubernetes.io/name: {{ .Values.name }}
    app.kubernetes.io/component: migration
    app.kubernetes.io/part-of: metabob-learning-system
spec:
  backoffLimit: 3
  activeDeadlineSeconds: 600
  template:
    metadata:
      labels:
        app.kubernetes.io/name: {{ .Values.name }}
        app.kubernetes.io/component: migration
    spec:
      restartPolicy: Never  # Changed from OnFailure
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: migrate
          image: "{{ .Values.migration.image.repository }}:{{ .Values.migration.image.tag }}"
          imagePullPolicy: {{ .Values.migration.image.pullPolicy | default "IfNotPresent" }}
          command:
            - /bin/sh
            - -c
            - |
              echo "Waiting for SurrealDB to be ready..."
              until bun -e "
                const res = await fetch('http://{{ .Values.name }}.{{ .Values.namespace }}.svc.cluster.local:{{ .Values.service.port }}/health');
                if (!res.ok) process.exit(1);
                console.log('Health check passed');
              " 2>/dev/null; do
                echo "  SurrealDB not ready, retrying in 2s..."
                sleep 2
              done
              echo "✓ SurrealDB is ready"
              echo "Starting migration..."
              bun run sql/migrate.ts
          env:
            - name: SURREALDB_URL
              value: "http://{{ .Values.name }}.{{ .Values.namespace }}.svc.cluster.local:{{ .Values.service.port }}"
            - name: SURREALDB_NAMESPACE
              value: "{{ .Values.database.namespace }}"
            - name: SURREALDB_DATABASE
              value: "{{ .Values.database.name }}"
            - name: SURREALDB_USERNAME
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.auth.existingSecret | default (printf "%s-credentials" .Values.name) }}
                  key: {{ .Values.auth.usernameKey }}
            - name: SURREALDB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.auth.existingSecret | default (printf "%s-credentials" .Values.name) }}
                  key: {{ .Values.auth.passwordKey }}
            - name: NODE_ENV
              value: "production"
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
```

### Step 2: Fix Init Data Job Hooks

**File:** `charts/surrealdb/templates/init-data-job.yaml`

```yaml
metadata:
  annotations:
    "helm.sh/hook": post-install,post-upgrade
    "helm.sh/hook-weight": "10"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded  # Add hook-succeeded
spec:
  backoffLimit: 3  # Add explicit limit
  template:
    spec:
      restartPolicy: Never  # Changed from default
```

### Step 3: Fix Activity-API Init Job

**File:** `charts/metabob-activity-api/templates/init-db-job.yaml`

```yaml
metadata:
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "5"  # After migration (weight 0)
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  ttlSecondsAfterFinished: 300
  backoffLimit: 3
  activeDeadlineSeconds: 600
  template:
    spec:
      restartPolicy: Never  # Changed from OnFailure
```

### Step 4: Add Init Container to Activity-API Deployment

**File:** `charts/metabob-activity-api/templates/deployment.yaml`

Add after line 23 (`spec:`):
```yaml
spec:
  template:
    spec:
      initContainers:
      - name: wait-for-db-ready
        image: curlimages/curl:8.5.0
        command: ['sh', '-c']
        args:
        - |
          echo "Waiting for SurrealDB to be ready..."
          until curl -f http://surrealdb.activity-system.svc.cluster.local:8000/health; do
            echo "  Database not ready, retrying in 5s..."
            sleep 5
          done
          echo "✓ Database is ready"
      containers:
      - name: {{ .Chart.Name }}
        # ... existing container spec
```

### Step 5: Update Helmfile Defaults for Local

**File:** `helmfiles/local.yaml.gotmpl`

```yaml
helmDefaults:
  createNamespace: true
  wait: true
  timeout: 900  # Increased from 600
  atomic: false  # Changed for local development
  cleanupOnFail: false  # Keep resources for debugging
```

---

## Testing the Fixes

### Test 1: Fresh Install
```bash
# Clean slate
kubectl delete namespace activity-system

# Deploy
cd repos/deployment/helm
helmfile -e local sync

# Verify job completion order
kubectl get jobs -n activity-system --sort-by=.metadata.creationTimestamp

# Should see:
# surrealdb-migration     Complete
# metabob-activity-api-init-db  Complete  (if enabled)
# surrealdb-init-data     Complete

# Verify pods are ready
kubectl get pods -n activity-system
```

### Test 2: Upgrade with Schema Changes
```bash
# Modify a schema file
# Then upgrade
helmfile -e local sync

# Verify migration ran
kubectl logs job/surrealdb-migration -n activity-system

# Verify no race conditions
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=20
```

### Test 3: Failure Recovery
```bash
# Introduce intentional error in migration
# Deploy and observe failure
helmfile -e local sync

# Check job status
kubectl describe job/surrealdb-migration -n activity-system

# Verify:
# - Job failed after 3 attempts
# - Failed pods preserved for debugging
# - Application pods didn't start
```

---

## Additional Resources

### Kubernetes/Helm Documentation
- [Helm Chart Hooks](https://helm.sh/docs/topics/charts_hooks/)
- [Kubernetes Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
- [Job Failure Handling](https://kubernetes.io/docs/tasks/job/pod-failure-policy/)

### Best Practices Articles
- [How to Use Helm Hooks for Pre/Post Install Jobs](https://oneuptime.com/blog/post/2026-01-17-helm-hooks-pre-post-install-upgrade/view)
- [Deploying Schema Migrations to Kubernetes with Helm](https://atlasgo.io/guides/deploying/helm)
- [Running Database Migrations in Kubernetes](https://andrewlock.net/deploying-asp-net-core-applications-to-kubernetes-part-7-running-database-migrations/)
- [Troubleshooting Kubernetes Job Failures](https://oneuptime.com/blog/post/2026-02-09-job-failures-backoff-restart/view)
- [Understanding backoffLimit in Kubernetes](https://www.baeldung.com/ops/kubernetes-backofflimit)

### Debugging Commands
```bash
# List all jobs with status
kubectl get jobs -n activity-system

# Check job logs
kubectl logs job/<job-name> -n activity-system

# Describe job for events
kubectl describe job/<job-name> -n activity-system

# List failed pods (preserved with restartPolicy: Never)
kubectl get pods -n activity-system --field-selector=status.phase=Failed

# Get logs from failed pod
kubectl logs <failed-pod-name> -n activity-system

# Check hook execution order
kubectl get events -n activity-system --sort-by='.lastTimestamp' | grep -i hook
```

---

## Conclusion

The deployment reliability issues stem from **improper Helm hook usage** and **missing guarantees about init job completion**. The fixes are straightforward:

1. ✅ Add Helm hooks to migration jobs
2. ✅ Use `restartPolicy: Never` for debugging
3. ✅ Add init containers to wait for migrations
4. ✅ Reduce backoffLimit to fail fast
5. ✅ Fix hook delete policies

These changes align with Kubernetes best practices and will eliminate race conditions, making deployments reliable and predictable.

**Next Step:** Implement fixes in priority order, test thoroughly in local environment, then promote to production.
