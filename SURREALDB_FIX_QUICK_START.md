# SurrealDB Helmfile Fix - Quick Start

**Status**: 🟢 Ready to Execute  
**Time**: 12 minutes  
**Risk**: Low

---

## TL;DR

Production SurrealDB is safe, but helmfile config is broken. Run these scripts to fix it:

```bash
# 1. Test current state (2 min)
./test-helmfile-fix.sh

# 2. Apply fix with automatic backup (1 min)
./apply-helmfile-fix.sh

# 3. Verify everything works (2 min)
./verify-surrealdb-config.sh

# 4. Commit the fix (1 min)
cd repos/platform/metabob-apps
git add helmfile.yaml.gotmpl
git commit -m "fix: surrealdb helmfile values resolution"
```

Done! ✅

---

## What's Wrong

Helmfile is not loading `production.surrealdb.values.yaml` which contains:
```yaml
persistence:
  enabled: true
  size: 50Gi
```

This causes helmfile to render a Deployment instead of StatefulSet, which would **destroy all data** if applied.

---

## The Fix

Remove 4 lines from `helmfile.yaml.gotmpl`:

```diff
- name: surrealdb
  <<: [*localChart, *envSpec]
- values:
-   - auth:
-       username: {{ ... }}
-       password: {{ ... }}
```

The credentials are already in `environments/production/secrets.yaml` and don't need to be inline.

---

## Safety Features

✅ Automatic backup before changes  
✅ Auto-rollback if tests fail  
✅ Multiple verification steps  
✅ No changes to production cluster  
✅ Full git history for recovery

---

## Quick Verification

After running the scripts, verify:

```bash
# Should show "StatefulSet"
helmfile -e production template --selector name=surrealdb | grep "kind:" | head -1

# Should show "enabled: true"
helmfile -e production write-values --output-file-template "/tmp/{{.Release.Name}}.yaml"
grep "enabled:" /tmp/surrealdb.yaml
```

Both passing = Fix successful! ✅

---

## If Something Goes Wrong

```bash
# Restore from backup
ls -la repos/platform/metabob-apps/helmfile.yaml.gotmpl.backup.*
cp repos/platform/metabob-apps/helmfile.yaml.gotmpl.backup.TIMESTAMP \
   repos/platform/metabob-apps/helmfile.yaml.gotmpl

# Or restore from git
cd repos/platform/metabob-apps
git checkout helmfile.yaml.gotmpl
```

---

## Files Created

1. **`test-helmfile-fix.sh`** - Diagnostic test
2. **`apply-helmfile-fix.sh`** - Apply fix with safety checks
3. **`verify-surrealdb-config.sh`** - Full verification (already exists)
4. **`SURREALDB_FIX_READY.md`** - Comprehensive guide
5. **`SURREALDB_HELMFILE_FIX_COMPLETE.md`** - Technical deep dive

---

## Ready to Start?

Run the diagnostic test:

```bash
./test-helmfile-fix.sh
```

The script will guide you through the rest! 🚀

---

## For More Details

See `SURREALDB_FIX_READY.md` for:
- Full execution plan
- Detailed explanation
- Risk assessment
- Rollback procedures
- Success criteria
