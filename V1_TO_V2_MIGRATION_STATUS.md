# V1 → V2 Activity Template Migration Status

**Date**: February 11, 2026  
**Status**: ✅ Ready for Execution

---

## ✅ Analysis & Planning Complete

### What We Found

**9 Bootstrap Templates** requiring migration:

- **Group A (3 templates)**: Already V2-compliant tasks, simple rename only
  - `feature-impl.json` ✅
  - `bug-fix.json` ✅
  - `jiggle-documentation.json` ✅

- **Group B (6 templates)**: V1 tasks, full transformation needed
  - `activity-create.json` 🔧
  - `activity-debug.json` 🔧
  - `activity-evolve.json` 🔧
  - `boredom-task-processor.json` 🔧
  - `code-analysis.json` 🔧
  - `refactor.json` 🔧

### Code Locations

**JSON Templates**:
- `repos/metabob-proto/activities/bootstrap/*.json` (9 files)

**TypeScript/JavaScript** (14 locations in `repos/metabob-opencode`):
- `src/session/bootstrap-templates.ts` (DEPRECATED - has converter)
- `src/session/template-loader.ts`
- `src/session/boredom-tasks.ts`
- `src/session/proto-converters.ts`
- `src/server/template-service-client.ts`
- `src/util/metabob.ts`
- `src/util/metabob-api.ts`
- Plus 7 generated proto files

---

## ✅ Migration Script Ready

**Script**: `scripts/migrate-bootstrap-v1-to-v2.py`

**Features**:
- ✅ Automatic Group A/B detection
- ✅ Backup creation (*.json.backup)
- ✅ Dry-run mode
- ✅ Error handling
- ✅ Summary reporting

**Tested**: Dry-run completed successfully on all 9 templates

### Dry-Run Results

```
============================================================
Bootstrap Template V1 → V2 Migration
[DRY RUN MODE - No files will be modified]
============================================================

Found 9 templates
Location: repos/metabob-proto/activities/bootstrap

Group A (simple rename): 3 templates
Group B (full migration): 6 templates

✓ All 9 templates validated successfully
✓ Preview shows correct V2 task structure
============================================================
```

---

## 📋 Execution Plan

### Step 1: Run Migration Script ⏳

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
python3 scripts/migrate-bootstrap-v1-to-v2.py
```

**Expected**:
- 9 templates migrated
- 9 backup files created (.json.backup)
- All templates now have `tasks` key with V2 structure

### Step 2: Register Templates to Backend ⏳

```bash
METABOB_API_KEY=mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8 \
  python3 scripts/register-bootstrap-templates.py
```

**Expected**:
- Session created
- 9 templates registered successfully
- Templates available via `/v2/activities/templates`

### Step 3: Verify Registration ⏳

```bash
curl -H "x-api-key: mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8" \
  http://localhost:8080/v2/activities/templates | \
  jq '.templates | length'
```

**Expected**: `9`

### Step 4: Test Activity Search ⏳

```javascript
// In OpenCode session or via metabob-cli MCP
search_activities({ category: "feature", verbose: true })
```

**Expected**: Returns `feature-impl-v1` with 5 tasks

### Step 5: Test Activity Execution ⏳

```javascript
activity({
  activityId: "feature-impl-v1",
  variables: {
    feature_name: "Test Feature",
    feature_description: "Simple integration test",
    target_location: "src/test"
  },
  reason: "Verify V2 template execution works end-to-end"
})
```

**Expected**: Activity executes all 5 tasks sequentially

### Step 6: Commit to Git ⏳

```bash
git add repos/metabob-proto/activities/bootstrap/*.json
git add scripts/migrate-bootstrap-v1-to-v2.py
git add scripts/register-bootstrap-templates.py
git commit -m "migrate: Convert bootstrap templates from V1 to V2 schema"
```

---

## 🎯 Delegation Strategy

### Task Delegation

| Task | Agent | Estimated Time |
|------|-------|----------------|
| Run migration script | **Host** | 1 min |
| Register templates | **Host** | 2 min |
| Verify registration | **Host** | 1 min |
| Test activity search | **devbob-opencode** | 2 min |
| Test activity execution | **devbob-opencode** | 5 min |
| Verify backend | **devbob-rpc-api** | 3 min |
| Commit changes | **devbob** | 2 min |

**Total**: ~16 minutes

### Why Host Machine?

The migration and registration should run on the **host machine** because:
1. Direct file system access to `repos/metabob-proto`
2. Backend accessible at `localhost:8080`
3. Can commit to git (mounted volume in containers might have permission issues)
4. Simpler workflow for initial migration

### Container Testing

After registration, delegate testing to **devbob-opencode** container:
- Has MCP configured with metabob-cli
- Can execute activity tool
- Verifies end-to-end integration

---

##Ready Commands

### Execute Migration (Host)

```bash
# Navigate to project
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Run migration (creates backups)
python3 scripts/migrate-bootstrap-v1-to-v2.py

# Check diff
git diff repos/metabob-proto/activities/bootstrap/

# Register to backend
METABOB_API_KEY=mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8 \
  python3 scripts/register-bootstrap-templates.py

# Verify
curl -s -H "x-api-key: mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8" \
  http://localhost:8080/v2/activities/templates | jq '.templates | length'
```

### Test via OpenCode (Container)

```bash
# Start devbob-opencode if not running
docker start devbob-opencode

# Connect to container
docker exec -it devbob-opencode /bin/bash

# Inside container:
metabob-cli activity search --category feature
metabob-cli activity get --id feature-impl-v1
```

---

## 📊 Success Criteria

- [x] Migration script created and tested (dry-run)
- [ ] All 9 templates migrated successfully
- [ ] Backups created for all templates
- [ ] All templates registered to backend
- [ ] `search_activities` returns 9 templates
- [ ] At least one activity executes successfully
- [ ] Changes committed to git

---

## 🔍 Rollback Plan

If something goes wrong:

```bash
# Restore from backups
cd repos/metabob-proto/activities/bootstrap
for f in *.json.backup; do 
  mv "$f" "${f%.backup}"
done

# Or use git
git checkout repos/metabob-proto/activities/bootstrap/
```

---

## 📁 Documentation

- **Analysis**: `BACKEND_SHARED_CONFIGURATION_STATUS.md`
- **Migration Plan**: `ACTIVITY_TEMPLATE_MIGRATION_PLAN.md`
- **This Status**: `V1_TO_V2_MIGRATION_STATUS.md`

---

**Status**: ✅ Ready for Execution  
**Next Action**: Run `python3 scripts/migrate-bootstrap-v1-to-v2.py`  
**Estimated Time**: ~16 minutes total  
**Risk Level**: Low (backups + git safety)

