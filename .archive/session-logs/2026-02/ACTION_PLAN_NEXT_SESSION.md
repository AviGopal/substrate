# Action Plan: Next Session

**Date**: February 6, 2026  
**Based On**: Recent work pattern analysis  
**Session Type**: Implementation Phase 2  
**Duration**: 4-6 hours

---

## 📊 Current State Summary

### ✅ Completed (85% of project)
- Proto foundation (Tasks 6-9)
- Format analysis and architecture docs
- Application separation of concerns
- Database serialization bug fixed
- Proto package published (TypeScript + Python)

### ❌ Remaining (15% of project)
- Proto schema enhancement
- Conversion utilities implementation
- Template migration
- Executor format detection

---

## 🎯 Recommended Action: Proto Enhancement (Option A)

### Why This Path?

**Pattern Analysis Shows**:
1. You just completed analysis phase → Implementation is next
2. Proto-first is your consistent theme (all work builds on it)
3. Low risk, high impact (isolated changes)
4. Unblocks downstream work (converters, migration)
5. Follows your natural work cycle

**Risk Assessment**: ✅ LOW
- Changes isolated to proto repo
- No dependencies on other systems
- Easy to test and verify
- Reversible if issues found

---

## 📋 Detailed Implementation Plan

### Part 1: Proto Enhancement (2 hours) ⭐ START HERE

#### Task 1.1: Enhance variant.proto (30 min)

**File**: `repos/metabob-proto/proto/metabob/activity/variant.proto`

**Add to TaskStep message**:
```protobuf
message TaskStep {
  // ... existing fields ...
  
  // OpenCode execution extensions
  repeated string dependencies = 10;           // Task IDs this task depends on
  string subagent = 11;                       // "general", "memory", "session", etc
  repeated string impulse_references = 12;    // Context keys to load
}
```

**Add to ActivityVariant message**:
```protobuf
message ActivityVariant {
  // ... existing fields ...
  
  // OpenCode execution metadata (stored as JSON)
  string validation_config_json = 20;        // Validation rules per task
  string retry_config_json = 21;             // Retry strategies per task
  string context_requirements_json = 22;     // Context requirements array
  string learning_config_json = 23;          // Learning feedback config
  string composition_config_json = 24;       // Activity composition patterns
}
```

#### Task 1.2: Regenerate Code (20 min)

```bash
cd repos/metabob-proto
./scripts/generate.sh

# Verify Python
ls -lh gen/python/metabob/activity/

# Verify TypeScript
ls -lh gen/typescript/metabob/activity/

# Expected: New fields in generated code
```

#### Task 1.3: Test Proto Serialization (50 min)

**Create test file**: `repos/metabob-proto/test-enhanced-proto.py`

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "gen" / "python"))

from metabob.activity import ActivityVariant, TaskStep
import json

# Create enhanced variant
variant = ActivityVariant(
    variant_id="test-v1",
    activity_id="test",
    variant_name="Test Variant",
    description="Test with extensions",
    version=1,
    task_steps=[
        TaskStep(
            step_id="task-1",
            title="Test Task",
            description="Do something",
            tools=["read_file"],
            guidance=["Read carefully"],
            dependencies=[],  # NEW FIELD
            subagent="general",  # NEW FIELD
            impulse_references=["contextKey"]  # NEW FIELD
        )
    ],
    variables={"var1": "value1"},
    # NEW FIELDS
    validation_config_json='{"task-1": {"requiredFiles": ["test.py"]}}',
    retry_config_json='{"task-1": {"max_attempts": 2}}',
    context_requirements_json='[{"key": "contextKey", "required": true}]',
)

# Test serialization
json_str = variant.to_json()
print("✅ Serialized to JSON")

# Test deserialization
loaded = ActivityVariant.from_json(json_str)
print("✅ Deserialized from JSON")

# Verify fields
assert loaded.task_steps[0].subagent == "general"
assert loaded.task_steps[0].dependencies == []
assert loaded.validation_config_json != ""
print("✅ All fields preserved")

print("\n✅✅✅ Proto enhancement verified!")
```

**Run test**:
```bash
cd repos/metabob-proto
python3 test-enhanced-proto.py
# Expected: All assertions pass
```

#### Task 1.4: Update NPM Package (20 min)

```bash
cd repos/metabob-proto

# Rebuild package
npm run build  # or equivalent

# Create new tarball
npm pack

# Verify new package
tar -tzf metabob-proto-0.2.0.tgz | grep variant

# Expected: New version with enhanced types
```

---

### Part 2: Conversion Utilities (2 hours)

#### Task 2.1: Implement protoToOpenCode (45 min)

**File**: `repos/metabob-opencode/packages/opencode/src/session/proto-converters.ts`

Replace stub with:
```typescript
import { ActivityVariant, TaskStep } from "@metabob/proto"
import { ActivityTemplate } from "./activity-template"

export function protoToOpenCode(
  protoVariant: ActivityVariant
): ActivityTemplate {
  return {
    id: protoVariant.variantId,
    name: protoVariant.variantName,
    version: protoVariant.version,
    description: protoVariant.description,
    category: "feature", // TODO: Add category to proto
    
    tasks: protoVariant.taskSteps.map(step => ({
      id: step.stepId,
      subagent: step.subagent || "general",
      description: step.title,
      dependencies: step.dependencies || [],
      impulseReferences: step.impulseReferences || [],
      prompt: {
        template: step.description,
        maxTokens: 8000,
        compressionStrategy: "filter" as const,
        variables: []
      },
      validation: step.validationConfigJson 
        ? JSON.parse(step.validationConfigJson)
        : {},
      retry: step.retryConfigJson
        ? JSON.parse(step.retryConfigJson)
        : { max_attempts: 1, strategy: "simple" as const }
    })),
    
    contextRequirements: protoVariant.contextRequirementsJson
      ? JSON.parse(protoVariant.contextRequirementsJson)
      : [],
    
    learning: protoVariant.learningConfigJson
      ? JSON.parse(protoVariant.learningConfigJson)
      : {},
    
    // Defaults for OpenCode-specific fields
    integration: { preChecks: [], postChecks: [], qualityGates: [] },
    hooks: {},
    metabob: {},
    composition: {}
  }
}
```

#### Task 2.2: Implement openCodeToProto (45 min)

```typescript
export function openCodeToProto(
  template: ActivityTemplate
): ActivityVariant {
  return {
    variantId: template.id,
    activityId: template.id.split("-").slice(0, -1).join("-"),
    variantName: template.name,
    version: template.version,
    description: template.description,
    
    taskSteps: template.tasks.map(task => ({
      stepId: task.id,
      title: task.description,
      description: task.prompt.template,
      tools: extractTools(task.prompt.template),
      guidance: [],
      dependencies: task.dependencies,
      subagent: task.subagent,
      impulseReferences: task.impulseReferences,
      validationConfigJson: JSON.stringify(task.validation),
      retryConfigJson: JSON.stringify(task.retry)
    })),
    
    variables: {},
    promptStrategy: "guided",
    contextBudgetTokens: 15000,
    
    contextRequirementsJson: JSON.stringify(template.contextRequirements),
    learningConfigJson: JSON.stringify(template.learning),
    compositionConfigJson: JSON.stringify(template.composition),
    
    status: "active",
    genealogy: createGenealogy(template)
  }
}

function extractTools(prompt: string): string[] {
  // Extract tool names from prompt template
  const toolPattern = /\b(read|write|bash|grep|glob|metabob_\w+)\b/g
  const matches = prompt.match(toolPattern) || []
  return [...new Set(matches)]
}
```

#### Task 2.3: Unit Tests (30 min)

**File**: `repos/metabob-opencode/packages/opencode/src/session/proto-converters.test.ts`

```typescript
import { describe, it, expect } from "bun:test"
import { protoToOpenCode, openCodeToProto } from "./proto-converters"

describe("Proto Converters", () => {
  it("converts proto to OpenCode format", () => {
    const proto = createTestProtoVariant()
    const openCode = protoToOpenCode(proto)
    
    expect(openCode.id).toBe(proto.variantId)
    expect(openCode.tasks).toHaveLength(proto.taskSteps.length)
    expect(openCode.tasks[0].subagent).toBe("general")
  })
  
  it("converts OpenCode to proto format", () => {
    const openCode = createTestOpenCodeTemplate()
    const proto = openCodeToProto(openCode)
    
    expect(proto.variantId).toBe(openCode.id)
    expect(proto.taskSteps).toHaveLength(openCode.tasks.length)
  })
  
  it("round-trips without data loss", () => {
    const original = createTestOpenCodeTemplate()
    const proto = openCodeToProto(original)
    const converted = protoToOpenCode(proto)
    
    expect(converted.id).toBe(original.id)
    expect(converted.tasks.length).toBe(original.tasks.length)
  })
})
```

---

### Part 3: Template Migration (2 hours)

#### Task 3.1: Convert bug-fix Template (40 min)

**Create script**: `repos/metabob-proto/scripts/migrate-template.py`

```python
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "gen" / "python"))
from metabob.activity import ActivityVariant, TaskStep

def migrate_bootstrap_template(input_path: Path, output_path: Path):
    """Convert bootstrap template to enhanced proto format"""
    
    with open(input_path) as f:
        old_format = json.load(f)
    
    # Create enhanced variant
    variant = ActivityVariant(
        variant_id=old_format["variant_id"],
        activity_id=old_format["activity_id"],
        variant_name=old_format["variant_name"],
        description=old_format["description"],
        version=old_format["version"],
        task_steps=[
            TaskStep(
                step_id=step["step_id"],
                title=step["title"],
                description=step["description"],
                tools=step.get("tools", []),
                guidance=step.get("guidance", []),
                dependencies=[],  # Add from analysis
                subagent="general",  # Add from analysis
                impulse_references=[]  # Add from analysis
            )
            for step in old_format["task_steps"]
        ],
        variables=old_format.get("variables", {}),
        prompt_strategy=old_format.get("prompt_strategy", "guided"),
        context_budget_tokens=old_format.get("context_budget_tokens", 15000),
        status="active"
    )
    
    # Save enhanced format
    with open(output_path, 'w') as f:
        json.dump(json.loads(variant.to_json()), f, indent=2)
    
    print(f"✅ Migrated: {input_path.name} → {output_path.name}")

if __name__ == "__main__":
    bootstrap_dir = Path(__file__).parent.parent / "activities" / "bootstrap"
    migrate_bootstrap_template(
        bootstrap_dir / "bug-fix.json",
        bootstrap_dir / "bug-fix-enhanced.json"
    )
```

**Run migration**:
```bash
cd repos/metabob-proto
python3 scripts/migrate-template.py

# Verify output
cat activities/bootstrap/bug-fix-enhanced.json
```

#### Task 3.2: Test Execution (40 min)

```bash
cd repos/metabob-opencode

# Load enhanced template
bun run src/session/template-loader.ts \
  --template ../metabob-proto/activities/bootstrap/bug-fix-enhanced.json

# Test execution (dry run)
opencode activity run bug-fix-v1 \
  --var bugDescription="Test bug" \
  --dry-run

# Expected: Template loads and validates
```

#### Task 3.3: Documentation (40 min)

**Create**: `TEMPLATE_MIGRATION_GUIDE.md`

```markdown
# Template Migration Guide

## For Template Authors

### Old Format (Bootstrap)
- Simple task_steps structure
- No execution metadata
- Storage-focused

### New Format (Enhanced Proto)
- Execution extensions (dependencies, subagent, impulses)
- Validation and retry config
- Context requirements
- Learning feedback

### Migration Steps
1. Load old template
2. Run migration script
3. Test execution
4. Verify output

### Examples
See: activities/bootstrap/bug-fix-enhanced.json
```

---

## ✅ Success Criteria

At end of session, you should have:

- ✅ Proto schema enhanced with execution extensions
- ✅ TypeScript + Python types regenerated
- ✅ Conversion utilities implemented and tested
- ✅ At least 1 template migrated and validated
- ✅ Migration guide documented

---

## 🚀 Quick Start

```bash
# 1. Open proto schema
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-proto
code proto/metabob/activity/variant.proto

# 2. Add fields (see Task 1.1 above)

# 3. Regenerate
./scripts/generate.sh

# 4. Test
python3 test-enhanced-proto.py

# 5. Continue with conversion utilities...
```

---

## 📊 Progress Tracking

| Phase | Tasks | Est. Time | Status |
|-------|-------|-----------|--------|
| Part 1: Proto Enhancement | 4 tasks | 2 hours | ⏳ Pending |
| Part 2: Conversion Utilities | 3 tasks | 2 hours | ⏳ Pending |
| Part 3: Template Migration | 3 tasks | 2 hours | ⏳ Pending |
| **Total** | **10 tasks** | **6 hours** | **0% Complete** |

Update as you progress!

---

## 🎯 Next Session After This

**Target**: Migrate all bootstrap templates + Update executor
**Duration**: 4-6 hours
**Outcome**: Full unified format implementation

---

## 📌 Key Files Reference

**Proto Schema**:
- `repos/metabob-proto/proto/metabob/activity/variant.proto`

**Conversion**:
- `repos/metabob-opencode/packages/opencode/src/session/proto-converters.ts`

**Templates**:
- `repos/metabob-proto/activities/bootstrap/*.json`

**Scripts**:
- `repos/metabob-proto/scripts/generate.sh`
- `repos/metabob-proto/scripts/migrate-template.py`

---

**Ready to implement! 🚀**

