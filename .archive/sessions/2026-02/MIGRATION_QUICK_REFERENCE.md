# SurrealDB Migration Quick Reference

**TLDR:** Production is safe. Helmfile diff is misleading. Verify before applying.

---

## Timeline

- **Jan 16:** PVC created (50Gi)
- **Jan 21:** StatefulSet deployed
- **Jan 22:** Production config set `persistence: true`
- **Feb 12:** Current pod started (4 days old)
- **Feb 16:** Today - all stable ✅

**Current Status:**
- StatefulSet: 26 days old, healthy
- PVC: 30 days old, bound and in use
- Storage: RocksDB at `/data/database.db`

---

## Quick Verification

```bash
# Run automated verification
./verify-surrealdb-config.sh

# If all checks pass → Safe to proceed
# If any check fails → Debug before applying
```

---

## Manual Verification

```bash
# 1. Check what helmfile will apply
cd repos/platform/metabob-apps
helmfile -e production write-values --output-file-template "/tmp/{{.Release.Name}}.yaml"
cat /tmp/surrealdb.yaml | grep -A5 persistence

# Expected: persistence.enabled: true
# If false → DON'T APPLY

# 2. Check template rendering
helmfile -e production template --include-crds | grep -A30 "name: surrealdb" | grep "kind:"

# Expected: kind: StatefulSet
# If Deployment → DON'T APPLY

# 3. Verify cluster state
kubectl get statefulset surrealdb -n metabob
kubectl logs surrealdb-0 -n metabob | grep "rocksdb"

# Should show: Started kvs store at rocksdb:///data/database.db
```

---

## Safe Apply

```bash
# After verification passes
cd repos/platform/metabob-apps
helmfile -e production apply --selector name=surrealdb

# Verify no changes occurred
kubectl get statefulset,deployment -n metabob | grep surrealdb
# Should still show: statefulset.apps/surrealdb
```

---

## If Migration Needed (Intentional Switch to Memory)

⚠️ **WARNING: Data loss! Only if intentional.**

```bash
# 1. BACKUP FIRST
kubectl exec -n metabob surrealdb-0 -c surrealdb -- surreal export \
  --endpoint http://localhost:8000 \
  --username $SURREAL_USER \
  --password $SURREAL_PASS \
  --namespace metabob \
  --database production \
  /tmp/backup.surql

kubectl cp metabob/surrealdb-0:/tmp/backup.surql ./surrealdb-backup.surql -c surrealdb

# 2. Update config
vi charts/surrealdb/values/production.surrealdb.values.yaml
# Set: persistence.enabled: false

# 3. Apply
helmfile -e production apply --selector name=surrealdb

# 4. This will:
#    - Delete StatefulSet
#    - Create Deployment
#    - Start with empty in-memory database
#    - PVC remains (orphaned)
```

---

## Emergency Rollback

```bash
# If something goes wrong
helm history surrealdb -n metabob
helm rollback surrealdb <previous-revision> -n metabob

# Or edit values back
vi charts/surrealdb/values/production.surrealdb.values.yaml
# Set: persistence.enabled: true
helmfile -e production apply --selector name=surrealdb
```

---

## Decision Matrix

| Verification Result | Action |
|---------------------|--------|
| ✅ All checks pass | Safe to apply |
| ❌ Persistence: false | Fix config, don't apply |
| ❌ Renders Deployment | Debug values, don't apply |
| ❌ PVC not bound | Investigate storage |

---

## Key Files

```
Configuration:
  charts/surrealdb/charts/values.yaml                           (base)
  charts/surrealdb/values/production.surrealdb.values.yaml      (production)
  
Templates:
  charts/surrealdb/charts/templates/statefulset.yaml            (if persistence: true)
  charts/surrealdb/charts/templates/deployment.yaml             (if persistence: false)

Verification:
  ./verify-surrealdb-config.sh                                  (run this first!)
```

---

## Remember

1. **Always verify before applying**
2. **Backup before changes**
3. **Test in integration first**
4. **Monitor logs after changes**
5. **Helmfile diff can be misleading**

---

For detailed analysis, see:
- `SURREALDB_MIGRATION_TIMELINE_ANALYSIS.md` - Full timeline and migration plan
- `SURREALDB_CONFIGURATION_ANALYSIS.md` - Technical root cause analysis
- `DEPLOYMENT_STATE_ACTUAL.md` - Complete deployment state

**Safe migrations = Verification + Backup + Testing + Monitoring**
