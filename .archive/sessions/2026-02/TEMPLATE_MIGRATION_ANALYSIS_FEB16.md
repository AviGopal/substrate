# Template Schema Migration Analysis

**Date**: February 16, 2026  
**Status**: ✅ Ready for Execution  
**Risk**: 🟢 Low (Simple rename operation)

---

## Executive Summary

**Good News**: All "V1" templates already use V2-compliant task structures internally!  
**Migration Needed**: Simple parent key rename: `task_steps` → `tasks`  
**Risk Level**: Minimal - No data transformation required  
**Time to Migrate**: < 5 minutes (automated script)

---

## Current State Analysis

### Template Inventory (16 Total)

#### ✅ Already V2 (12 templates)
```
V2 | tasks | 5 tasks | activity-create.json
V2 | tasks | 5 tasks | activity-debug.json  
V2 | tasks | 5 tasks | activity-evolve.json
V2 | tasks | 6 tasks | boredom-task-processor.json
V2 | tasks | 4 tasks | bug-fix.json
V2 | tasks | 4 tasks | code-analysis.json
V2 | tasks | 5 tasks | create-activity-template-v3-compat.json
V2 | tasks | 5 tasks | create-activity-template-v3.json
V2 | tasks | 5 tasks | feature-impl.json
V2 | tasks | 4 tasks | jiggle-documentation.json
V2 | tasks | 4 tasks | refactor.json
V2 | tasks | 5 tasks | security-audit-complete.json
```

**Status**: ✅ No action needed

---

#### 🔧 Needs Migration (4 templates)

| File | Modified | Activity ID | Variant | Tasks | Task Structure |
|------|----------|-------------|---------|-------|----------------|
| `activity-create-v2.json` | Feb 16 01:21 | activity-create | v2-self-validating | 7 | ✅ V2-compliant |
| `add-rest-endpoint.json` | Feb 15 21:54 | add-rest-endpoint | v1-baseline | 6 | ✅ V2-compliant |
| `fix-security-bug.json` | Feb 12 23:55 | fix-security-bug | v1-baseline | 7 | ✅ V2-compliant |
| `safe-refactor.json` | Feb 12 23:56 | safe-refactor | v1-baseline | 8 | ✅ V2-compliant |

**Migration Required**: Rename `task_steps` → `tasks` (parent key only)

**Task Structure Sample** (all 4 templates have identical V2 structure):
```json
{
  "id": "step-1",
  "subagent": "general",
  "description": "...",
  "dependencies": [],
  "guidance": ["..."],
  "tools": { "required": [...], "optional": [...] },
  "impulse_refs": [],
  "prompt": { "template": "...", "max_tokens": 8000, ... },
  "validation": { "required_files": [...], ... },
  "retry": { "max_attempts": 3, "strategy": "simple" },
  "metrics": { "success_rate": 0, ... }
}
```

**Conclusion**: ✅ All tasks already V2-compliant, just wrong parent key name

---

## Timeline Analysis

### Recent Template Activity

**February 11, 2026** - Mass V2 Migration
- 12 templates migrated to V2 format
- Bulk update committed

**February 12, 2026** - New Templates Added
- `fix-security-bug.json` created (V1 format)
- `safe-refactor.json` created (V1 format)

**February 14-15, 2026** - Template Development
- `create-activity-template-v3.json` added (V2)
- `create-activity-template-v3-compat.json` added (V2)
- `jiggle-documentation.json` updated (V2)
- `security-audit-complete.json` added (V2)

**February 15, 2026** - Template Updates
- `add-rest-endpoint.json` updated (still V1 key)
- `feature-impl.json` updated (V2)
- `bug-fix.json` updated (V2)
- `refactor.json` updated (V2)

**February 16, 2026** - Latest Activity
- `activity-create-v2.json` created (V1 key, V2 structure)

---

## Migration Impact Analysis

### Files to Modify (4 files)

```
repos/metabob-proto/activities/bootstrap/
├── activity-create-v2.json      (7 tasks)
├── add-rest-endpoint.json       (6 tasks)
├── fix-security-bug.json        (7 tasks)
└── safe-refactor.json           (8 tasks)
```

**Total Tasks**: 28 tasks across 4 templates  
**All tasks already V2-compliant** ✅

---

### Systems That Consume Templates

#### 1. Backend (metabob-rpc-api)
**API Endpoint**: `POST /v2/activities/templates`

**Schema Validation**:
```python
# backend expects:
{
  "tasks": [...]  # NOT task_steps
}
```

**Current Behavior**:
- ✅ Accepts V2 templates (`tasks` key)
- ❌ Rejects V1 templates (`task_steps` key) - schema validation fails

**Impact**: After migration, all 4 templates will be uploadable to backend

---

#### 2. MCP Server (metabob-cli)
**Tool**: `search_activities`, `activity`

**Behavior**:
- Reads from backend via API
- Backend already stores in V2 format
- No MCP code changes needed

**Impact**: None (MCP already uses V2 from backend)

---

#### 3. Bootstrap Scripts
**Script**: `scripts/bootstrap_core_templates.py`

**Current Implementation**:
```python
# Line ~50-60
response = requests.post(
    f'{base_url}/v2/activities/templates',
    json={
        'name': template['variant_name'],
        'category': template['activity_id'],
        'tasks': template.get('tasks') or template.get('task_steps'),  # Handles both!
        ...
    }
)
```

**Status**: ✅ Already handles both `tasks` and `task_steps`  
**Impact**: None (script is tolerant of both formats)

---

#### 4. Admin CLI
**Command**: `python -m admin.cli activities seed`

**Current Implementation**: Unknown (need to verify)

**Expected Behavior**: Should accept V2 format  
**Impact**: Unknown until tested

---

#### 5. OpenCode (metabob-opencode)
**Files**: 
- `src/session/template-loader.ts`
- `src/session/bootstrap-templates.ts`

**Current Implementation**:
```typescript
// Has converter: convertCanonicalToSchema()
// Likely handles both formats
```

**Status**: 🟡 Needs verification  
**Impact**: Unknown (OpenCode may have converter)

---

## Migration Strategy

### Recommended Approach: Simple Find-Replace Script

**Why This Works**:
1. All task structures already V2-compliant ✅
2. Only parent key name differs
3. No data transformation needed
4. Low risk of breaking anything

**Script**:
```python
#!/usr/bin/env python3
"""Migrate V1 templates to V2 format (rename task_steps → tasks)"""
import json
from pathlib import Path

BOOTSTRAP_DIR = Path("repos/metabob-proto/activities/bootstrap")
V1_TEMPLATES = [
    "activity-create-v2.json",
    "add-rest-endpoint.json", 
    "fix-security-bug.json",
    "safe-refactor.json"
]

def migrate_template(file_path: Path) -> None:
    """Migrate single template file"""
    # Read template
    template = json.loads(file_path.read_text())
    
    # Check if migration needed
    if "task_steps" not in template:
        print(f"⏭️  {file_path.name}: Already V2 (has 'tasks' key)")
        return
    
    # Create backup
    backup_path = file_path.with_suffix(".json.bak")
    backup_path.write_text(file_path.read_text())
    print(f"💾 Backed up to: {backup_path.name}")
    
    # Migrate: rename key
    template["tasks"] = template.pop("task_steps")
    
    # Write back
    file_path.write_text(json.dumps(template, indent=2) + "\n")
    print(f"✅ Migrated: {file_path.name} ({len(template['tasks'])} tasks)")

def main():
    print("=" * 60)
    print("TEMPLATE SCHEMA MIGRATION: V1 → V2")
    print("=" * 60)
    print(f"Directory: {BOOTSTRAP_DIR}")
    print(f"Templates to migrate: {len(V1_TEMPLATES)}")
    print()
    
    for template_name in V1_TEMPLATES:
        file_path = BOOTSTRAP_DIR / template_name
        if not file_path.exists():
            print(f"⚠️  {template_name}: File not found")
            continue
        migrate_template(file_path)
        print()
    
    print("=" * 60)
    print("✨ MIGRATION COMPLETE")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Verify templates: jq '.tasks | length' <file>")
    print("2. Test upload: python scripts/bootstrap_core_templates.py")
    print("3. Commit changes: git add . && git commit -m 'migrate templates to V2'")

if __name__ == "__main__":
    main()
```

---

## Migration Procedure

### Step 1: Pre-Migration Verification

```bash
cd repos/metabob-proto/activities/bootstrap

# Verify current state
echo "=== V1 Templates (need migration) ==="
for f in activity-create-v2.json add-rest-endpoint.json fix-security-bug.json safe-refactor.json; do
  echo "$f: $(jq -r 'if .tasks then "V2" elif .task_steps then "V1" else "UNKNOWN" end' "$f")"
done

# Verify task structures are V2-compliant
echo ""
echo "=== Task Structure Verification ==="
for f in activity-create-v2.json add-rest-endpoint.json fix-security-bug.json safe-refactor.json; do
  echo "$f task keys:"
  jq '.task_steps[0] | keys' "$f" | grep -E "id|subagent|description|prompt|validation|retry|metrics"
done
```

**Expected Output**:
```
=== V1 Templates (need migration) ===
activity-create-v2.json: V1
add-rest-endpoint.json: V1
fix-security-bug.json: V1
safe-refactor.json: V1

=== Task Structure Verification ===
[All should show V2 fields: id, subagent, description, prompt, etc.]
```

---

### Step 2: Run Migration Script

```bash
cd /path/to/metabob-devbob

# Create migration script
cat > scripts/migrate_v1_to_v2.py << 'EOF'
[Script content from above]
EOF

chmod +x scripts/migrate_v1_to_v2.py

# Run migration
python3 scripts/migrate_v1_to_v2.py
```

**Expected Output**:
```
============================================================
TEMPLATE SCHEMA MIGRATION: V1 → V2
============================================================
Directory: repos/metabob-proto/activities/bootstrap
Templates to migrate: 4

💾 Backed up to: activity-create-v2.json.bak
✅ Migrated: activity-create-v2.json (7 tasks)

💾 Backed up to: add-rest-endpoint.json.bak
✅ Migrated: add-rest-endpoint.json (6 tasks)

💾 Backed up to: fix-security-bug.json.bak
✅ Migrated: fix-security-bug.json (7 tasks)

💾 Backed up to: safe-refactor.json.bak
✅ Migrated: safe-refactor.json (8 tasks)

============================================================
✨ MIGRATION COMPLETE
============================================================
```

---

### Step 3: Post-Migration Verification

```bash
cd repos/metabob-proto/activities/bootstrap

# Verify all templates are now V2
echo "=== Post-Migration State ==="
for f in *.json; do
  [[ "$f" == *.bak ]] && continue
  schema=$(jq -r 'if .tasks then "V2" elif .task_steps then "V1" else "UNKNOWN" end' "$f")
  task_count=$(jq '.tasks | length' "$f" 2>/dev/null || echo "0")
  echo "$schema | $task_count tasks | $f"
done

# Verify task structures intact
echo ""
echo "=== Task Structure Integrity Check ==="
for f in activity-create-v2.json add-rest-endpoint.json fix-security-bug.json safe-refactor.json; do
  task_keys=$(jq '.tasks[0] | keys | length' "$f")
  echo "$f: $task_keys keys in first task (expect 11: id, subagent, description, etc.)"
done

# Validate JSON syntax
echo ""
echo "=== JSON Validation ==="
for f in activity-create-v2.json add-rest-endpoint.json fix-security-bug.json safe-refactor.json; do
  if jq empty "$f" 2>/dev/null; then
    echo "✅ $f: Valid JSON"
  else
    echo "❌ $f: INVALID JSON"
  fi
done
```

**Expected Output**:
```
=== Post-Migration State ===
V2 | 5 tasks | activity-create.json
V2 | 7 tasks | activity-create-v2.json      ← MIGRATED
V2 | 5 tasks | activity-debug.json
V2 | 5 tasks | activity-evolve.json
V2 | 6 tasks | add-rest-endpoint.json       ← MIGRATED
... (all V2)

=== Task Structure Integrity Check ===
activity-create-v2.json: 11 keys in first task
add-rest-endpoint.json: 11 keys in first task
fix-security-bug.json: 11 keys in first task
safe-refactor.json: 11 keys in first task

=== JSON Validation ===
✅ activity-create-v2.json: Valid JSON
✅ add-rest-endpoint.json: Valid JSON
✅ fix-security-bug.json: Valid JSON
✅ safe-refactor.json: Valid JSON
```

---

### Step 4: Test Upload to Backend

```bash
# Start backend if not running
cd repos/platform
docker-compose up -d surreal redis api-server

# Test bootstrap upload
cd /path/to/metabob-devbob
python3 scripts/bootstrap_core_templates.py
```

**Expected Output**:
```
============================================================
BOOTSTRAP CORE ACTIVITY TEMPLATES
============================================================

1. Getting session token...
   ✓ Token loaded

2. Checking backend...
   ✓ Backend reachable

3. Uploading core templates...

✅ Uploaded: activity-create-v2.json → activity-create-29e9d6c5
✅ Uploaded: add-rest-endpoint.json → add-rest-endpoint-97b69d8d
✅ Uploaded: fix-security-bug.json → fix-security-bug-a1b2c3d4
✅ Uploaded: safe-refactor.json → safe-refactor-x9y8z7w6

============================================================
✨ BOOTSTRAP COMPLETE - All templates uploaded!
============================================================
```

---

### Step 5: Commit Migration

```bash
cd repos/metabob-proto/activities/bootstrap

# Stage migrated files
git add activity-create-v2.json add-rest-endpoint.json fix-security-bug.json safe-refactor.json

# Commit
git commit -m "migrate: rename task_steps → tasks for V2 API compatibility

Migrated 4 templates to V2 schema format:
- activity-create-v2.json (7 tasks)
- add-rest-endpoint.json (6 tasks)
- fix-security-bug.json (7 tasks)
- safe-refactor.json (8 tasks)

Changes:
- Renamed parent key: task_steps → tasks
- Task structures already V2-compliant (no data changes)
- All templates now uploadable to V2 backend API

Verification:
- JSON syntax valid
- Task structures intact (11 fields per task)
- Bootstrap upload successful
- All 16 templates now V2 format"

# Optional: Push to remote
git push origin master
```

---

## Rollback Plan

If migration causes issues:

```bash
cd repos/metabob-proto/activities/bootstrap

# Restore from backups
for f in activity-create-v2.json add-rest-endpoint.json fix-security-bug.json safe-refactor.json; do
  if [ -f "$f.bak" ]; then
    echo "Restoring $f from backup"
    cp "$f.bak" "$f"
  fi
done

# Verify restoration
for f in activity-create-v2.json add-rest-endpoint.json fix-security-bug.json safe-refactor.json; do
  schema=$(jq -r 'if .tasks then "V2" elif .task_steps then "V1" else "UNKNOWN" end' "$f")
  echo "$f: $schema"
done

# Commit rollback if needed
git checkout -- activity-create-v2.json add-rest-endpoint.json fix-security-bug.json safe-refactor.json
```

---

## Risk Assessment

### Low Risk ✅

**Why migration is safe**:
1. ✅ All task structures already V2-compliant (verified)
2. ✅ Only parent key name changes (`task_steps` → `tasks`)
3. ✅ No data transformation or field mapping needed
4. ✅ Bootstrap script already handles both formats
5. ✅ Backups created automatically by migration script
6. ✅ Easy rollback via git or backups
7. ✅ Can test on local backend before committing

**What could go wrong** (very unlikely):
- ⚠️  JSON syntax error during write (mitigated by validation step)
- ⚠️  Backend rejects templates (mitigated by testing upload step)
- ⚠️  OpenCode has issues with V2 format (mitigated by checking logs)

**Mitigation**:
- All risks have verification steps built into procedure
- Backups created before any changes
- Git provides version control rollback

---

## Success Criteria

### Must Have ✅
- [ ] All 4 V1 templates migrated to V2 format
- [ ] JSON syntax valid for all migrated files
- [ ] Task structures intact (11 fields per task)
- [ ] Bootstrap upload successful to backend
- [ ] All 16 bootstrap templates now V2 format

### Nice to Have 🎯
- [ ] OpenCode loads templates without errors
- [ ] MCP search_activities returns all 16 templates
- [ ] Activity execution works with migrated templates
- [ ] No warnings in backend logs

---

## Timeline Estimate

| Step | Time | Notes |
|------|------|-------|
| Pre-migration verification | 2 min | Check current state |
| Create migration script | 5 min | Copy script to file |
| Run migration | 30 sec | Automated |
| Post-migration verification | 3 min | Validate changes |
| Test backend upload | 2 min | Bootstrap script |
| Commit changes | 2 min | Git commit |
| **TOTAL** | **15 min** | **Conservative estimate** |

Actual time likely: **5-10 minutes** (most steps are automated)

---

## Next Steps After Migration

### Immediate (Same Session)
1. ✅ Run migration script
2. ✅ Verify all templates V2
3. ✅ Test backend upload
4. ✅ Commit changes

### Follow-Up (Next Session)
1. Test OpenCode integration (MCP search/execute)
2. Test activity execution with migrated templates
3. Monitor backend logs for any issues
4. Update documentation if needed

### Future Enhancements
1. Add pre-commit hook to enforce V2 schema
2. Add CI/CD validation for template schema
3. Create template linter/validator tool
4. Document V2 schema in detail for contributors

---

## Related Documentation

- **Migration Plan**: `ACTIVITY_TEMPLATE_MIGRATION_PLAN.md` (Feb 11, 2026)
- **V2 API Design**: `API_V2_DESIGN.md`
- **Bootstrap Guide**: `ACTIVITY_SYSTEM_COLD_START_GUIDE.md`
- **Template Validation**: `BOOTSTRAP_VALIDATION_REPORT.md`

---

## Conclusion

**Migration is straightforward and low-risk**:
- ✅ Simple parent key rename (`task_steps` → `tasks`)
- ✅ All task structures already V2-compliant
- ✅ Automated script with backups
- ✅ Easy verification and rollback
- ✅ 15 minutes total time (conservative)

**Recommendation**: ✅ **PROCEED WITH MIGRATION**

The migration is essentially a "cosmetic" change (key rename only) with no risk to task data integrity. All safety checks are in place, and rollback is trivial if needed.

---

**Status**: 🟢 Ready for Execution  
**Risk Level**: Low  
**Estimated Time**: 15 minutes  
**Recommendation**: Proceed immediately

