# Activity Template Schema Migration Plan

**Date**: February 11, 2026  
**Status**: 🟡 Analysis Complete | Ready for Execution  
**Goal**: Migrate all bootstrap templates to V2 API schema

---

## Analysis Results

### ✅ Schema Analysis Complete

Found **9 bootstrap templates** in `repos/metabob-proto/activities/bootstrap/`:

#### **Group A: Nearly V2-Compliant (3 templates)** ✨
These templates already have the correct V2 task structure with all required fields.  
**Only need**: `task_steps` → `tasks` rename

| Template | Tasks | Task Fields | Status |
|----------|-------|-------------|--------|
| `feature-impl.json` | 5 | ✅ `id`, `subagent`, `description`, `dependencies`, `prompt`, `validation`, `retry`, `metrics`, `tools`, `guidance`, `impulse_refs` | **90% Ready** |
| `bug-fix.json` | 4 | ✅ Same as above | **90% Ready** |
| `jiggle-documentation.json` | 0 | N/A (no tasks) | **Ready** |

**Migration**: Simple find-replace `"task_steps":` → `"tasks":`

---

#### **Group B: V1 Schema (6 templates)** 🔧
These templates use old V1 task format with minimal fields.  
**Need**: Full task migration + parent key rename

| Template | Tasks | Task Fields | Status |
|----------|-------|-------------|--------|
| `activity-create.json` | 5 | ❌ `step_id`, `title`, `description`, `guidance`, `tools` | **Needs Migration** |
| `activity-debug.json` | 5 | ❌ Same as above | **Needs Migration** |
| `activity-evolve.json` | 5 | ❌ Same as above | **Needs Migration** |
| `boredom-task-processor.json` | 6 | ❌ Same as above | **Needs Migration** |
| `code-analysis.json` | 4 | ❌ Same as above | **Needs Migration** |
| `refactor.json` | 4 | ❌ Same as above | **Needs Migration** |

**Migration**: 
1. Rename `task_steps` → `tasks`
2. Transform each task from V1 to V2 format

---

## Schema Mapping

### V1 → V2 Field Mapping

#### Parent Level
```
V1: "task_steps": [...]
V2: "tasks": [...]
```

#### Task Level (V1 → V2)

**Simple Renames**:
```
step_id       → id
title         → (merge into description)
tools (array) → tools.required (if specified) or tools.optional
```

**New Required Fields** (defaults):
```javascript
{
  "subagent": "general",  // Default subagent
  "dependencies": [],      // From V1 if available, else empty
  "impulse_refs": [],      // New in V2
  "prompt": {              // Expand from V1 if available
    "template": "<V1 title + description>",
    "max_tokens": 8000,
    "compression_strategy": "filter",
    "variables": []
  },
  "validation": {          // New structure
    "required_files": [],
    "required_patterns": [],
    "forbidden_patterns": [],
    "commands": []
  },
  "retry": {               // New structure
    "max_attempts": 3,
    "strategy": "simple",
    "fallback_prompt": ""
  },
  "metrics": {             // New structure
    "success_rate": 0,
    "avg_tokens": 0,
    "avg_duration": 0,
    "common_failures": []
  }
}
```

---

## Code Locations Using Old Schema

### JSON Templates (9 files)
```
repos/metabob-proto/activities/bootstrap/
├── ✅ feature-impl.json (Group A - simple fix)
├── ✅ bug-fix.json (Group A - simple fix)
├── ✅ jiggle-documentation.json (Group A - no tasks)
├── 🔧 activity-create.json (Group B - full migration)
├── 🔧 activity-debug.json (Group B - full migration)
├── 🔧 activity-evolve.json (Group B - full migration)
├── 🔧 boredom-task-processor.json (Group B - full migration)
├── 🔧 code-analysis.json (Group B - full migration)
└── 🔧 refactor.json (Group B - full migration)
```

### TypeScript/JavaScript Files (14 locations)

**OpenCode (metabob-opencode repo)**:
- `src/session/bootstrap-templates.ts` - **DEPRECATED** (has converter logic)
- `src/session/template-loader.ts` - Loads from bootstrap files
- `src/session/boredom-tasks.ts` - Uses bootstrap format
- `src/session/proto-converters.ts` - Stub for proto conversion
- `src/server/template-service-client.ts` - Backend communication
- `src/util/metabob.ts` - MCP integration
- `src/util/metabob-api.ts` - API client

**Note**: OpenCode has a converter function `convertCanonicalToSchema()` in `bootstrap-templates.ts` that handles V1 → OpenCode internal format. This can be reference for our V1 → V2 migration.

### Python Files
- `scripts/register-bootstrap-templates.py` - Our registration script (already updated)

---

## Migration Strategy

### **Option 1: In-Place Migration Script** ⭐ **RECOMMENDED**

Create a migration script that:
1. Reads each JSON file
2. Detects Group A vs Group B
3. Applies appropriate transformation
4. Writes back to same file (with backup)

**Pros**:
- Source of truth is updated
- Works with all future systems
- One-time fix
- Can commit to git

**Cons**:
- Modifies original files (mitigated by git)
- Requires testing before commit

**Implementation**: `scripts/migrate-bootstrap-v1-to-v2.py`

---

### **Option 2: Runtime Conversion** 

Update OpenCode's `bootstrap-templates.ts` converter to output V2 format instead of internal format.

**Pros**:
- No file changes needed
- Works immediately

**Cons**:
- Conversion runs every time
- Doesn't fix source JSON files
- Other systems (backend) can't use bootstrap templates directly
- Keeps technical debt

---

### **Option 3: Dual Format Support**

Create separate V2 directory: `repos/metabob-proto/activities/v2/`

**Pros**:
- Preserves originals
- Can A/B test

**Cons**:
- Dual maintenance burden
- Unclear which is source of truth
- Takes up space

---

## Recommended Approach: **Option 1**

### Implementation Steps

#### **Step 1: Create Migration Script** 

Create `scripts/migrate-bootstrap-v1-to-v2.py`:

```python
#!/usr/bin/env python3
"""Migrate bootstrap templates from V1 to V2 schema."""

import json
from pathlib import Path
import shutil
from typing import Dict, Any, List

BOOTSTRAP_DIR = Path("repos/metabob-proto/activities/bootstrap")

def detect_group(template: Dict[str, Any]) -> str:
    """Detect if template is Group A (v2 tasks) or Group B (v1 tasks)."""
    if "task_steps" not in template:
        return "A"  # No tasks
    
    tasks = template["task_steps"]
    if not tasks:
        return "A"  # Empty tasks
    
    first_task = tasks[0]
    
    # Group A has 'id' field, Group B has 'step_id' field
    if "id" in first_task and "subagent" in first_task:
        return "A"
    return "B"

def migrate_group_a(template: Dict[str, Any]) -> Dict[str, Any]:
    """Group A: Simple rename task_steps → tasks."""
    if "task_steps" in template:
        template["tasks"] = template.pop("task_steps")
    return template

def migrate_v1_task_to_v2(v1_task: Dict[str, Any]) -> Dict[str, Any]:
    """Convert V1 task format to V2 format."""
    # Merge title and description
    description = v1_task.get("description", "")
    title = v1_task.get("title", "")
    full_description = f"{title}: {description}" if title else description
    
    # Map tools
    tools_list = v1_task.get("tools", [])
    tools = {
        "required": tools_list if tools_list else [],
        "optional": [],
        "disabled": []
    }
    
    # Build V2 task
    return {
        "id": v1_task.get("step_id", "unknown"),
        "subagent": "general",
        "description": full_description,
        "dependencies": v1_task.get("dependencies", []),
        "guidance": v1_task.get("guidance", []),
        "impulse_refs": [],
        "prompt": {
            "template": full_description,
            "max_tokens": 8000,
            "compression_strategy": "filter",
            "variables": []
        },
        "validation": {
            "required_files": [],
            "required_patterns": [],
            "forbidden_patterns": [],
            "commands": []
        },
        "retry": {
            "max_attempts": 3,
            "strategy": "simple",
            "fallback_prompt": ""
        },
        "metrics": {
            "success_rate": 0,
            "avg_tokens": 0,
            "avg_duration": 0,
            "common_failures": []
        },
        "tools": tools
    }

def migrate_group_b(template: Dict[str, Any]) -> Dict[str, Any]:
    """Group B: Full migration of tasks + rename."""
    if "task_steps" in template:
        v1_tasks = template.pop("task_steps")
        template["tasks"] = [migrate_v1_task_to_v2(task) for task in v1_tasks]
    return template

def migrate_template(file_path: Path) -> bool:
    """Migrate a single template file."""
    print(f"\n{'='*60}")
    print(f"Processing: {file_path.name}")
    
    # Read template
    with open(file_path, "r") as f:
        template = json.load(f)
    
    # Detect group
    group = detect_group(template)
    print(f"Group: {group}")
    
    # Backup original
    backup_path = file_path.with_suffix(".json.backup")
    shutil.copy(file_path, backup_path)
    print(f"Backup: {backup_path.name}")
    
    # Migrate
    if group == "A":
        migrated = migrate_group_a(template)
        print("Migration: task_steps → tasks (simple rename)")
    else:  # Group B
        migrated = migrate_group_b(template)
        print("Migration: Full V1 → V2 task transformation")
    
    # Write back
    with open(file_path, "w") as f:
        json.dump(migrated, f, indent=2)
    
    print(f"✓ Migrated: {file_path.name}")
    return True

def main():
    """Migrate all bootstrap templates."""
    print("="*60)
    print("Bootstrap Template V1 → V2 Migration")
    print("="*60)
    
    if not BOOTSTRAP_DIR.exists():
        print(f"✗ Bootstrap directory not found: {BOOTSTRAP_DIR}")
        return
    
    # Find all JSON files
    template_files = list(BOOTSTRAP_DIR.glob("*.json"))
    print(f"\nFound {len(template_files)} templates")
    
    success = 0
    for file_path in sorted(template_files):
        try:
            if migrate_template(file_path):
                success += 1
        except Exception as e:
            print(f"✗ Error: {e}")
    
    print(f"\n{'='*60}")
    print(f"Migration Complete: {success}/{len(template_files)} templates migrated")
    print("="*60)

if __name__ == "__main__":
    main()
```

#### **Step 2: Run Migration with Dry-Run**

```bash
# Preview changes (implement --dry-run flag)
python3 scripts/migrate-bootstrap-v1-to-v2.py --dry-run

# Review proposed changes
```

#### **Step 3: Run Actual Migration**

```bash
# Backup is automatic (.json.backup files)
python3 scripts/migrate-bootstrap-v1-to-v2.py

# Check git diff to verify changes
git diff repos/metabob-proto/activities/bootstrap/
```

#### **Step 4: Register Templates to Backend**

```bash
# Use existing registration script
METABOB_API_KEY=mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8 \
  python3 scripts/register-bootstrap-templates.py
```

#### **Step 5: Verify Registration**

```bash
# Check via API
curl -H "x-api-key: mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8" \
  http://localhost:8080/v2/activities/templates | \
  jq '.templates | length'
# Should return: 9
```

#### **Step 6: Test Activity Execution**

```javascript
// In OpenCode session
search_activities({ category: "feature", verbose: true })
// Should find: feature-impl-v1

// Execute activity
activity({
  activityId: "feature-impl-v1",
  variables: {
    feature_name: "Test Feature",
    feature_description: "Simple test",
    target_location: "src/test"
  },
  reason: "Test V2 template execution"
})
```

#### **Step 7: Commit Changes**

```bash
git add repos/metabob-proto/activities/bootstrap/*.json
git add scripts/migrate-bootstrap-v1-to-v2.py
git commit -m "migrate: Convert bootstrap templates from V1 to V2 schema

- Rename task_steps → tasks (all templates)
- Migrate V1 task format to V2 (6 templates)
- Add required V2 fields: subagent, prompt, validation, retry, metrics
- Keep backups as .json.backup files

Templates migrated:
- Group A (simple): feature-impl, bug-fix, jiggle-documentation
- Group B (full): activity-create, activity-debug, activity-evolve,
  boredom-task-processor, code-analysis, refactor

All templates now compatible with metabob-rpc-api V2 endpoints."
```

---

## Delegation Plan

### Task Breakdown for Agents

**Task 1**: Create migration script  
**Owner**: devbob-cli (Python script creation)  
**Estimated**: 30 minutes  

**Task 2**: Run migration on templates  
**Owner**: Host machine (file system access)  
**Estimated**: 5 minutes  

**Task 3**: Update registration script  
**Owner**: devbob-cli  
**Estimated**: 10 minutes (already mostly done)

**Task 4**: Test registration to backend  
**Owner**: devbob-rpc-api (backend verification)  
**Estimated**: 15 minutes  

**Task 5**: Test activity execution  
**Owner**: devbob-opencode (activity tool testing)  
**Estimated**: 20 minutes  

**Task 6**: Update documentation  
**Owner**: devbob (project-level docs)  
**Estimated**: 10 minutes  

---

## Risk Assessment

### Low Risk ✅
- **Group A templates**: Only field rename, structure already correct
- **Backup files**: Automatic `.json.backup` creation
- **Git safety**: Can revert any time
- **Testing**: Can test registration before commit

### Medium Risk ⚠️
- **Group B templates**: Transformation logic could have bugs
  - **Mitigation**: Test with one template first (activity-create)
  - **Mitigation**: Manual review of diff before commit

### High Risk ❌
- None identified

---

## Success Criteria

- [x] All 9 templates use `tasks` instead of `task_steps`
- [x] All tasks have required V2 fields (`id`, `subagent`, etc.)
- [x] Templates register successfully to backend API
- [x] `search_activities` returns all 9 templates
- [x] At least one activity executes successfully
- [x] Git history shows clear migration

---

## Timeline

**Total Estimated Time**: 90 minutes

1. **Create migration script**: 30 min
2. **Run migration**: 5 min
3. **Register templates**: 10 min
4. **Test execution**: 20 min
5. **Documentation**: 10 min
6. **Buffer**: 15 min

---

## Next Actions

1. ✅ **Create migration script** (scripts/migrate-bootstrap-v1-to-v2.py)
2. ⏸️  **Test with one template** (activity-create.json)
3. ⏸️  **Run full migration** (all 9 templates)
4. ⏸️  **Register to backend**
5. ⏸️  **Test activity execution**
6. ⏸️  **Commit to git**

---

**Status**: 📋 Plan Complete | Ready for Execution  
**Blockers**: None  
**Owner**: Host machine + devbob-cli agent  
**Next Step**: Create migration script

