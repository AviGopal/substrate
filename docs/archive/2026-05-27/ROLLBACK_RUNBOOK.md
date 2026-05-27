# Rollback Runbook

This runbook provides step-by-step procedures for rolling back the Metabob system in case of deployment failures or critical issues.

## Quick Reference

| Scenario | Procedure | Time Estimate |
|----------|-----------|---------------|
| Bad API deployment | [Service Rollback](#1-service-rollback) | 2-5 min |
| Schema migration failure | [Schema Rollback](#2-schema-rollback) | 5-15 min |
| Full stack issues | [Full Stack Rollback](#3-full-stack-rollback) | 15-30 min |
| Data corruption | [Data Restore](#4-data-restore) | 30-60 min |
| Auth system broken | [Auth Rollback](#5-auth-rollback) | 5-10 min |

---

## Pre-Rollback Checklist

Before any rollback:

- [ ] Confirm the issue requires rollback (not a transient error)
- [ ] Notify team of impending rollback
- [ ] Capture current state for post-mortem
- [ ] Identify rollback target version
- [ ] Verify backups are available

```bash
# Capture current state
kubectl get pods -n activity-system -o wide > pods-before-rollback.txt
kubectl get events -n activity-system --sort-by='.lastTimestamp' > events-before-rollback.txt
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=500 > api-logs.txt
```

---

## 1. Service Rollback

### Scenario
A service deployment causes errors (500s, crashes, performance issues).

### Steps

#### 1.1 Identify Current Revision

```bash
# List deployment history
kubectl rollout history deployment -n activity-system metabob-activity-api

# Example output:
# REVISION  CHANGE-CAUSE
# 1         Initial deployment
# 2         Update image to v1.2.0
# 3         Update image to v1.3.0  <- Current (broken)
```

#### 1.2 Rollback to Previous Revision

```bash
# Rollback to previous revision
kubectl rollout undo deployment -n activity-system metabob-activity-api

# Or rollback to specific revision
kubectl rollout undo deployment -n activity-system metabob-activity-api --to-revision=2
```

#### 1.3 Verify Rollback

```bash
# Wait for rollout to complete
kubectl rollout status deployment -n activity-system metabob-activity-api --timeout=300s

# Check pod status
kubectl get pods -n activity-system -l app.kubernetes.io/name=metabob-activity-api

# Verify health
curl http://api.minibob.local/health
```

#### 1.4 Verify Functionality

```bash
# Test critical endpoints
curl http://api.minibob.local/v2/activities/templates | jq '.templates | length'
curl http://api.minibob.local/v2/health/deep
```

### Rollback Multiple Services

```bash
# Parallel rollback
kubectl rollout undo deployment -n activity-system metabob-activity-api &
kubectl rollout undo deployment -n activity-system metabob-analysis-api &
kubectl rollout undo deployment -n activity-system minibob &
wait

# Verify all
kubectl get pods -n activity-system
```

---

## 2. Schema Rollback

### Scenario
A database schema migration breaks queries or corrupts data.

### Steps

#### 2.1 Identify Target Version

```bash
# Query current migrations
surreal sql --conn $SURREALDB_URL \
  --ns activity-system --db learning_loop \
  --user root --pass $PASSWORD \
  -q "SELECT * FROM schema_version ORDER BY applied_at DESC LIMIT 5"
```

#### 2.2 Create Backup Before Rollback

```bash
# Export current state
surreal export \
  --conn $SURREALDB_URL \
  --ns activity-system \
  --db learning_loop \
  --user root \
  --pass $PASSWORD \
  > backup-pre-rollback-$(date +%Y%m%d-%H%M%S).surql
```

#### 2.3 Run Schema Rollback

```bash
# Using migration tool
cd repos/metabob-proto
bun run surrealdb/lib/migrate.ts --rollback 002

# This will:
# 1. Show migrations to be rolled back
# 2. Prompt for confirmation
# 3. Execute reverse migrations
# 4. Update schema_version table
```

#### 2.4 Manual Rollback (If Tool Unavailable)

```surql
-- Example: Rollback "add new column" migration

-- 1. Remove new column
REMOVE FIELD new_column ON activity_template;

-- 2. Update schema_version
DELETE schema_version WHERE filename = '015-add-new-column.surql';
```

#### 2.5 Verify Schema State

```surql
-- Check table structure
INFO FOR TABLE activity_template;

-- Check schema_version
SELECT * FROM schema_version ORDER BY applied_at DESC;
```

---

## 3. Full Stack Rollback

### Scenario
Complete system failure requiring rollback of all services and potentially data.

### Steps

#### 3.1 Capture State

```bash
# Full state capture
kubectl get all -n activity-system > full-state-before.txt
kubectl describe deployments -n activity-system > deployments-before.txt
```

#### 3.2 Rollback Services

```bash
# Rollback all deployments
for deploy in $(kubectl get deployments -n activity-system -o name); do
  echo "Rolling back $deploy"
  kubectl rollout undo $deploy -n activity-system
done

# Wait for all rollouts
for deploy in $(kubectl get deployments -n activity-system -o name); do
  kubectl rollout status $deploy -n activity-system --timeout=300s
done
```

#### 3.3 Rollback Helm Release (Alternative)

```bash
# List release history
helm history metabob-activity-api -n activity-system

# Rollback to specific revision
helm rollback metabob-activity-api 2 -n activity-system

# Or use helmfile
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl rollback
```

#### 3.4 Rollback Schema If Needed

See [Schema Rollback](#2-schema-rollback).

#### 3.5 Full System Verification

```bash
# Check all pods running
kubectl get pods -n activity-system

# Check all services
kubectl get svc -n activity-system

# Health check each service
curl http://api.minibob.local/health
curl http://dashboard.minibob.local/health

# Test end-to-end
./integration-tests/smoke-test.sh
```

---

## 4. Data Restore

### Scenario
Data corruption requiring restore from backup.

### Steps

#### 4.1 Identify Backup

```bash
# List available backups
ls -la backups/

# Example:
# backup-20260324-120000.surql  (before bad migration)
# backup-20260325-080000.surql  (after bad migration)
```

#### 4.2 Stop Write Traffic

```bash
# Scale down services to stop writes
kubectl scale deployment -n activity-system metabob-activity-api --replicas=0
kubectl scale deployment -n activity-system minibob --replicas=0

# Verify pods terminated
kubectl get pods -n activity-system -l app.kubernetes.io/name=metabob-activity-api
```

#### 4.3 Drop and Recreate Database

```bash
surreal sql --conn $SURREALDB_URL \
  --user root --pass $PASSWORD <<EOF
USE NS activity-system;
REMOVE DATABASE learning_loop;
DEFINE DATABASE learning_loop;
EOF
```

#### 4.4 Import Backup

```bash
surreal import \
  --conn $SURREALDB_URL \
  --ns activity-system \
  --db learning_loop \
  --user root \
  --pass $PASSWORD \
  < backups/backup-20260324-120000.surql
```

#### 4.5 Run Migrations (If Needed)

If backup is from before recent migrations:

```bash
cd repos/metabob-proto
bun run surrealdb/lib/migrate.ts

cd repos/metabob-activity-api
bun run sql/migrate.ts
```

#### 4.6 Restart Services

```bash
kubectl scale deployment -n activity-system metabob-activity-api --replicas=2
kubectl scale deployment -n activity-system minibob --replicas=3

# Wait for ready
kubectl rollout status deployment -n activity-system metabob-activity-api
```

#### 4.7 Verify Data Integrity

```surql
-- Check record counts
SELECT count() FROM activity_template;
SELECT count() FROM activity_execution_traces;

-- Sample data verification
SELECT * FROM activity_template LIMIT 5;
```

---

## 5. Auth Rollback

### Scenario
Authentication system broken (users can't log in, JWT invalid).

### Steps

#### 5.1 Quick Auth Check

```bash
# Test auth endpoints
curl -v http://api.minibob.local/v2/auth/apikey \
  -H "Content-Type: application/json" \
  -d '{"api_key": "mk_test_key"}'
```

#### 5.2 Disable Auth Temporarily

If auth is completely broken, temporarily bypass:

```bash
# Set DISABLE_AUTH flag
kubectl set env deployment/metabob-activity-api DISABLE_AUTH=true -n activity-system

# Restart
kubectl rollout restart deployment -n activity-system metabob-activity-api
```

**WARNING:** This disables RBAC. Use only for emergency recovery.

#### 5.3 Verify ACCESS Definitions

```surql
-- Check ACCESS definitions exist
INFO FOR DB;

-- Re-apply if missing
-- Copy from repos/metabob-proto/surrealdb/core/001-auth-access.surql
```

#### 5.4 Re-create Test User/Key

```surql
-- Create test API key
CREATE api_keys SET
  id = api_keys:test,
  org_id = organizations:metabob_internal,
  user_id = users:admin,
  key_hash = crypto::argon2::generate('mk_test_key'),
  scopes = ['read', 'write'],
  is_active = true,
  created_at = time::now();
```

#### 5.5 Re-enable Auth

```bash
kubectl set env deployment/metabob-activity-api DISABLE_AUTH- -n activity-system
kubectl rollout restart deployment -n activity-system metabob-activity-api
```

---

## Post-Rollback Actions

After any rollback:

### 1. Verify System Health

```bash
# Full health check
curl http://api.minibob.local/health | jq .
curl http://dashboard.minibob.local/health | jq .

# Run smoke tests
./tests/smoke-test.sh
```

### 2. Notify Stakeholders

```
Subject: [ROLLBACK COMPLETE] Metabob System

Rollback completed at: <timestamp>
Previous version: <bad version>
Rolled back to: <good version>
Services affected: <list>
Data impact: <none/minimal/significant>

Root cause investigation: In progress
```

### 3. Document in Audit Log

```surql
CREATE audit_logs SET
  event = 'system_rollback',
  severity = 'critical',
  org_id = organizations:metabob_internal,
  details = {
    reason: 'API deployment caused 500 errors',
    from_version: '1.3.0',
    to_version: '1.2.0',
    performed_by: 'ops-team',
    duration_minutes: 5
  },
  created_at = time::now();
```

### 4. Schedule Post-Mortem

- Within 24 hours for critical issues
- Include: timeline, root cause, prevention measures

---

## Emergency Contacts

| Role | Contact | When |
|------|---------|------|
| On-call Engineer | #ops-alerts | Any incident |
| Database Admin | #db-team | Schema/data issues |
| Platform Lead | @platform-lead | Full stack issues |
| Security | #security | Auth/access issues |

---

## Related Documentation

- `DEPLOYMENT_GUIDE.md` - Deployment procedures
- `docs/RBAC_TROUBLESHOOTING.md` - Auth issues
- `repos/metabob-proto/surrealdb/MIGRATION_GUIDE.md` - Schema migrations
