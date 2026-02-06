# Syncing Templates from metabob-opencode

## Overview

metabob-opencode is the source of truth for activity template development. Templates are tested and refined there, then synced to metabob-proto for backend seeding.

---

## Current Status

**metabob-opencode**:
- create-activity-template: v4 (latest)
- Location: `packages/opencode/templates/built-in/`

**metabob-proto**:
- create-activity-template: v3 (outdated)
- Location: `activities/templates/`

**Action needed**: Sync v4 to proto and re-seed database

---

## Sync Process

### Step 1: Copy v4 Template

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos

# Copy latest version
cp metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json \
   metabob-proto/activities/templates/create-activity-template.json

# Verify copy
diff metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json \
     metabob-proto/activities/templates/create-activity-template.json
```

### Step 2: Re-Seed Database

```bash
cd metabob-proto

# Re-seed all activities (includes updated create-activity-template)
python scripts/seed_activities.py

# Verify seeding succeeded
# Check for "Successfully seeded X activities" message
```

### Step 3: Verify in Backend

```bash
# Check template is available
curl http://localhost:8080/activity-recommendations/variants/create-activity-template/details | jq '.version'
# Should return: 4

# Verify all fields present
curl http://localhost:8080/activity-recommendations/variants/create-activity-template/details | \
  jq '{version, name, tasks: (.task_steps | length)}'
# Should show: {"version": 4, "name": "Create Activity Template", "tasks": 4}
```

### Step 4: Test in metabob-opencode

```bash
cd metabob-opencode/packages/opencode

# Clear cache to force fresh load
rm -rf ~/.cache/opencode/templates 2>/dev/null || true

# Test search
bun run test-search-activities.ts
# Should find create-activity-template v4

# Test execution
bun test test/session/create-activity-template-v4.test.ts
```

---

## Template Sync Schedule

### When to Sync

**Immediately** (within 24 hours):
- Major version changes (v3 → v4)
- Critical bug fixes
- Schema changes

**Weekly**:
- Minor improvements
- Documentation updates
- New templates

**Monthly**:
- Version consolidation
- Deprecated template cleanup

### Who Syncs

**Developer who**:
- Creates new template version
- Fixes critical template bugs
- Adds new templates

**Process**:
1. Test in opencode
2. Validate with script
3. Copy to proto
4. Re-seed database
5. Verify in backend
6. Document in commit

---

## Automation Opportunity

### Create Sync Script

**File**: `metabob-proto/scripts/sync-from-opencode.sh`

```bash
#!/bin/bash
# Sync templates from metabob-opencode to metabob-proto

OPENCODE_DIR="../metabob-opencode/packages/opencode/templates/built-in"
PROTO_DIR="activities/templates"

echo "Syncing templates from opencode to proto..."

# List of templates to sync
TEMPLATES=(
  "create-activity-template.json"
  "fix-bug-with-impulses.json"
  "cleanup-docs-tests.json"
  "git-revision-management.json"
)

for template in "${TEMPLATES[@]}"; do
  if [ -f "$OPENCODE_DIR/$template" ]; then
    echo "Syncing: $template"
    cp "$OPENCODE_DIR/$template" "$PROTO_DIR/$template"
    
    # Show version
    VERSION=$(jq -r '.version // 1' "$PROTO_DIR/$template")
    echo "  Version: $VERSION"
  else
    echo "Warning: $template not found in opencode"
  fi
done

echo ""
echo "Sync complete. Run 'python scripts/seed_activities.py' to update database."
```

**Usage**:
```bash
cd metabob-proto
bash scripts/sync-from-opencode.sh
python scripts/seed_activities.py
```

---

## Compliance Verification

### Checklist

**Before Deployment**:
- [ ] metabob-proto has latest template versions
- [ ] Database re-seeded with latest templates
- [ ] Backend returns correct versions
- [ ] metabob-cli MCP tools work with templates
- [ ] metabob-opencode can load and execute templates

**After Deployment**:
- [ ] Search returns updated templates
- [ ] Execution uses new versions
- [ ] Metrics tracking works
- [ ] Thompson Sampling updated
- [ ] No version conflicts

### Verification Commands

```bash
# Check proto version
jq -r '.version' metabob-proto/activities/templates/create-activity-template.json

# Check opencode version
jq -r '.version' metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json

# Check backend version
curl http://localhost:8080/activity-recommendations/variants/create-activity-template/details | jq '.version'

# All three should match
```

---

## Troubleshooting

### Issue: Backend Returns Old Version

**Cause**: Database not re-seeded

**Solution**:
```bash
cd metabob-proto
python scripts/seed_activities.py --force
```

### Issue: Template Not Found in Search

**Cause**: Cache stale in opencode

**Solution**:
```bash
# Clear cache
rm -rf ~/.cache/opencode/templates

# Or force refresh
search_activities({ skipCache: true })
```

### Issue: Format Mismatch Errors

**Cause**: proto format vs opencode format confusion

**Solution**: Check ActivityManager.py lines 318-402 for transformation logic

---

## Summary

**Issue**: metabob-proto has v3, opencode has v4

**Solution**: 
1. Copy v4 to proto
2. Re-seed database
3. Verify across stack

**Debug tools**: 
- Enable with `export OPENCODE_ACTIVITY_DEBUG=true`
- Full debugging capability when needed
- Hidden by default for clean interface

**Next action**: Sync metabob-proto and re-seed database
