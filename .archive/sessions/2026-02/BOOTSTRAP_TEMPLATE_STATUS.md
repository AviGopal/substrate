# Bootstrap Template Status & Fix Strategy

**Date**: 2026-02-11  
**Audit Finding**: Bootstrap templates are in TWO different formats

---

## Template Groups

### Group A: Proto-Aligned (Ready for Quick Fix) ✅

These templates use the correct proto-aligned structure and only need minor additions:

| Template | Structure | Missing Fields | Fix Complexity |
|----------|-----------|----------------|----------------|
| `feature-impl.json` | ✅ Correct | `subagent`, `impulse_refs` | SIMPLE |
| `bug-fix.json` | ✅ Correct | `subagent`, `impulse_refs` | SIMPLE |
| `jiggle-documentation.json` | ✅ Correct | `impulse_refs`, `metrics` | SIMPLE |

**Example Structure** (feature-impl.json):
```json
{
  "task_steps": [
    {
      "id": "understand-requirements",           // ✅ HAS
      "description": "...",                      // ✅ HAS
      "dependencies": [],                        // ✅ HAS
      "prompt": {                                 // ✅ NESTED OBJECT
        "template": "...",
        "max_tokens": 8000,
        "compression_strategy": "filter",
        "variables": []
      },
      "validation": { ... },                      // ✅ NESTED OBJECT
      "retry": { ... },                           // ✅ NESTED OBJECT
      "metrics": { ... },                         // ✅ NESTED OBJECT
      "guidance": [],
      "tools": { ... }
      // ❌ MISSING: "subagent"
      // ❌ MISSING: "impulse_refs"
    }
  ]
}
```

**Fix**: Just add two fields per task

### Group B: Old Format (Needs Major Restructuring) ❌

These templates use an obsolete schema and require complete transformation:

| Template | Current Format | Fix Complexity |
|----------|----------------|----------------|
| `activity-create.json` | ❌ Old Schema | COMPLEX |
| `activity-debug.json` | ❌ Old Schema | COMPLEX |
| `activity-evolve.json` | ❌ Old Schema | COMPLEX |
| `boredom-task-processor.json` | ❌ Old Schema | COMPLEX |
| `code-analysis.json` | ❌ Old Schema | COMPLEX |
| `refactor.json` | ❌ Old Schema | COMPLEX |

**Example Structure** (activity-create.json):
```json
{
  "task_steps": [
    {
      "step_id": "identify-pattern",            // ❌ Wrong field name
      "title": "Identify Interaction Pattern",  // ❌ Wrong field name
      "description": "...",                      // ✅ OK
      "tools": ["read_file", "grep_search"],    // ❌ Wrong structure
      "guidance": [...]                          // ✅ OK
      // ❌ MISSING: "id" field
      // ❌ MISSING: "subagent" field
      // ❌ MISSING: "dependencies" field
      // ❌ MISSING: "prompt" object (nested)
      // ❌ MISSING: "validation" object
      // ❌ MISSING: "retry" object
      // ❌ MISSING: "metrics" object
      // ❌ MISSING: "impulse_refs" array
    }
  ]
}
```

**Fix**: Requires field renaming, structure transformation, and data migration

---

## Conservative Fix Strategy

### Phase 1: Fix Group A (Low Risk) ✅

**Goal**: Get 3 core templates fully proto-aligned

**Templates**:
1. feature-impl.json
2. bug-fix.json
3. jiggle-documentation.json

**Process**:
```bash
# 1. Run fix script on Group A only
python scripts/fix_bootstrap_templates.py \
  --files feature-impl.json bug-fix.json jiggle-documentation.json

# 2. Validate
python scripts/validate_templates.py \
  activities/bootstrap/feature-impl.json \
  activities/bootstrap/bug-fix.json \
  activities/bootstrap/jiggle-documentation.json

# 3. Test registration
python test_register_template.py activities/bootstrap/feature-impl.json

# 4. Commit
git add activities/bootstrap/feature-impl.json \
        activities/bootstrap/bug-fix.json \
        activities/bootstrap/jiggle-documentation.json
git commit -m "Fix Group A bootstrap templates: add subagent and impulse_refs"
```

**Risk**: LOW - Only adding two fields, structure already correct

**Expected Result**:
- 3 templates fully proto-aligned
- Can be registered directly to backend
- Safe for agents to learn from

### Phase 2: Quarantine Group B (No Risk) ⚠️

**Goal**: Prevent agents from learning from broken templates

**Process**:
```bash
# Move old-format templates to quarantine
mkdir -p activities/quarantine/old-format/
mv activities/bootstrap/activity-create.json activities/quarantine/old-format/
mv activities/bootstrap/activity-debug.json activities/quarantine/old-format/
mv activities/bootstrap/activity-evolve.json activities/quarantine/old-format/
mv activities/bootstrap/boredom-task-processor.json activities/quarantine/old-format/
mv activities/bootstrap/code-analysis.json activities/quarantine/old-format/
mv activities/bootstrap/refactor.json activities/quarantine/old-format/

# Create README explaining why
cat > activities/quarantine/old-format/README.md << 'EOF'
# Old Format Templates (Quarantined)

These templates use an obsolete schema that predates the proto-aligned format.
They have been moved here to prevent agents from learning incorrect patterns.

## Issues with Old Format
- Uses `step_id` instead of `id`
- Uses `title` instead of proper `description` structure
- Missing nested `prompt`, `validation`, `retry`, `metrics` objects
- Missing `subagent`, `impulse_refs` fields

## Migration Plan
These will be manually converted to proto format in Phase 3.

See: BOOTSTRAP_TEMPLATE_STATUS.md
EOF

git add activities/quarantine/
git commit -m "Quarantine old-format templates to prevent learning from broken schemas"
```

**Risk**: ZERO - Just moving files, not changing them

**Expected Result**:
- Broken templates can't confuse agents
- bootstrap/ directory only has correct templates
- Clear documentation of what needs fixing

### Phase 3: Migrate Group B (Future Work) 🔄

**Goal**: Convert old-format templates to proto schema

**Strategy**: MANUAL CONVERSION (not automated)

**Why Manual?**
- Field mapping is complex (step_id → id, title → ???)
- Semantic understanding needed (what should prompt template be?)
- Risk of data loss with automated conversion
- Only 6 templates, worth doing carefully

**Per-Template Checklist**:
- [ ] Read old template and understand intent
- [ ] Create new proto-aligned structure
- [ ] Map `step_id` → `id`
- [ ] Create nested `prompt` object with proper template
- [ ] Add `subagent: "general"` (or appropriate)
- [ ] Add complete `validation`, `retry`, `metrics` objects
- [ ] Add `impulse_refs: []`
- [ ] Add `dependencies: []`
- [ ] Test registration with backend
- [ ] Validate with proto schema

**Timeline**: Can be done incrementally, one template per week

---

## Immediate Action Plan

### Today: Fix Group A ✅

```bash
# 1. Backup everything first
cd repos/metabob-proto
cp -r activities/bootstrap activities/bootstrap.backup.$(date +%Y%m%d)

# 2. Create fix script for Group A only
cat > scripts/fix_group_a.py << 'EOF'
#!/usr/bin/env python3
import json
from pathlib import Path

GROUP_A_FILES = [
    "feature-impl.json",
    "bug-fix.json",
    "jiggle-documentation.json"
]

for filename in GROUP_A_FILES:
    filepath = Path(f"activities/bootstrap/{filename}")
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    # Determine field name (task_steps or tasks)
    field = 'task_steps' if 'task_steps' in data else 'tasks'
    
    # Add missing fields to each task
    for task in data[field]:
        if 'subagent' not in task:
            task['subagent'] = 'general'
        if 'impulse_refs' not in task:
            task['impulse_refs'] = []
    
    # Write back
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')
    
    print(f"✅ Fixed {filename}")
EOF

chmod +x scripts/fix_group_a.py
python scripts/fix_group_a.py

# 3. Validate
python scripts/fix_bootstrap_templates.py --validate-only \
  activities/bootstrap/feature-impl.json \
  activities/bootstrap/bug-fix.json \
  activities/bootstrap/jiggle-documentation.json

# 4. Commit if validation passes
git diff activities/bootstrap/
git add activities/bootstrap/feature-impl.json \
        activities/bootstrap/bug-fix.json \
        activities/bootstrap/jiggle-documentation.json
git commit -m "Add subagent and impulse_refs to Group A bootstrap templates

- feature-impl.json: Add missing proto-required fields
- bug-fix.json: Add missing proto-required fields  
- jiggle-documentation.json: Add missing proto-required fields

All three templates now fully proto-aligned and ready for registration.
Group B templates (old format) will be migrated separately."
```

### Tomorrow: Quarantine Group B ⚠️

```bash
# Move broken templates out of bootstrap/
mkdir -p activities/quarantine/old-format/
git mv activities/bootstrap/activity-create.json activities/quarantine/old-format/
git mv activities/bootstrap/activity-debug.json activities/quarantine/old-format/
git mv activities/bootstrap/activity-evolve.json activities/quarantine/old-format/
git mv activities/bootstrap/boredom-task-processor.json activities/quarantine/old-format/
git mv activities/bootstrap/code-analysis.json activities/quarantine/old-format/
git mv activities/bootstrap/refactor.json activities/quarantine/old-format/

# Document why
# (Create README as shown above)

git commit -m "Quarantine old-format templates

Moved 6 templates with obsolete schema to quarantine/:
- activity-create.json
- activity-debug.json
- activity-evolve.json
- boredom-task-processor.json
- code-analysis.json
- refactor.json

These use pre-proto schema (step_id, flat structure, missing nested objects).
Will be manually migrated in Phase 3.

This prevents agents from learning incorrect format."
```

### Next Week: Deploy Fixed Templates 🚀

```bash
# Copy Group A templates to devbob-opencode container
docker cp activities/bootstrap/feature-impl.json devbob-opencode:/workspace/examples/
docker cp activities/bootstrap/bug-fix.json devbob-opencode:/workspace/examples/
docker cp activities/bootstrap/jiggle-documentation.json devbob-opencode:/workspace/examples/

# Remove old incorrect examples
docker exec devbob-opencode rm -f /workspace/test-*.json

# Test: Ask agent to create a template
# Expected: Uses correct proto format
```

---

## Success Criteria

### Phase 1 Complete When:
- ✅ 3 Group A templates have `subagent` field
- ✅ 3 Group A templates have `impulse_refs` array
- ✅ All 3 pass proto validation
- ✅ All 3 register successfully with backend
- ✅ Changes committed to git

### Phase 2 Complete When:
- ✅ 6 Group B templates moved to quarantine/
- ✅ bootstrap/ directory only has correct templates
- ✅ README explains why templates were quarantined
- ✅ Changes committed to git

### Phase 3 Complete When:
- ✅ All 6 Group B templates converted to proto format
- ✅ All 9 templates (3+6) fully proto-aligned
- ✅ All templates registered in backend
- ✅ Quarantine directory emptied or documented as historical

---

## Risk Assessment

| Phase | Risk Level | Why | Mitigation |
|-------|------------|-----|------------|
| Phase 1 | 🟢 LOW | Only adding fields | Backup first, validate before commit |
| Phase 2 | 🟢 ZERO | Just moving files | Git tracks moves, easy to revert |
| Phase 3 | 🟡 MEDIUM | Manual conversion | Do one template at a time, test each |

---

## Why This Approach?

1. **Incremental**: Fix what's easy first, tackle hard problems later
2. **Safe**: Each phase can be validated and rolled back
3. **Pragmatic**: 3 good templates > 9 broken templates
4. **Clear**: Separation between working and broken is explicit
5. **Documented**: Future maintainers understand what happened

---

## Next Steps

Run Phase 1 today:
```bash
cd repos/metabob-proto
python scripts/fix_group_a.py
git diff
git commit
```

That's it. Simple, safe, effective.
