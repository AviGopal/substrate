# Canary Test Activity - Usage Guide

## One Reusable Activity for Safe Experimentation

**File**: `canary-test-activity.json`

This single activity handles the entire canary workflow:
1. ✅ Experiment in container
2. ✅ Capture knowledge
3. ✅ Demonstrate repeatability
4. ✅ Optionally adopt to host with rollback

**No more manual steps. Just one activity call.**

---

## Quick Start

### Test an Activity Safely (Experiment + Demonstrate Only)

```bash
opencode activity execute canary-test-activity \
  --variables '{
    "activityId": "add-feature-no-conditionals",
    "activityVariables": {
      "feature_name": "hello-world",
      "feature_description": "Simple hello world function"
    }
  }' \
  --reason "Safe experimentation with canary"
```

**Result**:
- ✅ Experiments in `devbob-opencode` container
- ✅ Captures knowledge in `CANARY_KNOWLEDGE_add-feature-no-conditionals.md`
- ✅ Demonstrates in fresh container
- ✅ Reports if repeatable
- ⏸️ Does NOT adopt to host (safe)

---

### Test and Adopt to Host (Full Workflow)

```bash
opencode activity execute canary-test-activity \
  --variables '{
    "activityId": "add-feature-no-conditionals",
    "activityVariables": {
      "feature_name": "hello-world",
      "feature_description": "Simple hello world function"
    },
    "adoptToHost": true
  }' \
  --reason "Canary test with automatic adoption"
```

**Result**:
- ✅ Experiments in container
- ✅ Captures knowledge
- ✅ Demonstrates in fresh container
- ✅ Adopts to host (if demonstration succeeds)
- ✅ Creates rollback branch automatically
- ✅ Validates deployment

---

## Use Cases

### Use Case 1: Test Self-Improvement Activity

**Scenario**: Want to test `create-step-library-system` before running on host

```bash
opencode activity execute canary-test-activity \
  --variables '{
    "activityId": "create-step-library-system",
    "activityVariables": {
      "targetDirectory": "src/step",
      "stepCount": 60
    }
  }' \
  --reason "Test step library creation in canary"
```

**What Happens**:
1. Creates step library in container
2. Captures: "how we built 60 atomic steps"
3. Demonstrates: repeats in fresh container
4. Reports: if repeatable and safe
5. Does NOT touch host system

**Review Knowledge**: `CANARY_KNOWLEDGE_create-step-library-system.md`

**If Good**: Re-run with `"adoptToHost": true`

---

### Use Case 2: Test Bug Fix Before Deploying

**Scenario**: Fixed a bug, want to test before deploying

```bash
opencode activity execute canary-test-activity \
  --variables '{
    "activityId": "fix-bug-complete",
    "activityVariables": {
      "bug_description": "Memory leak in session cleanup",
      "affected_files": ["src/session/cleanup.ts"]
    }
  }' \
  --reason "Test bug fix in canary before production"
```

**What Happens**:
1. Applies fix in container
2. Runs tests in container
3. Captures fix approach
4. Demonstrates fix works consistently
5. Does NOT deploy to production

**Review**: Check if tests pass in demonstration

**If Good**: Adopt with `"adoptToHost": true`

---

### Use Case 3: Validate Refactoring

**Scenario**: Major refactoring, want to ensure it's safe

```bash
opencode activity execute canary-test-activity \
  --variables '{
    "activityId": "refactor-component-complete",
    "activityVariables": {
      "file_path": "src/session/activity-executor.ts",
      "component_name": "ActivityExecutor",
      "refactoring_goal": "Extract task execution into separate class"
    }
  }' \
  --reason "Validate refactoring is safe and repeatable"
```

**What Happens**:
1. Refactors in container
2. Runs tests
3. Captures refactoring approach
4. Demonstrates: refactoring is consistent
5. Does NOT touch production code

**Safety**: If demonstration fails, we learn what's wrong before touching host

---

## Workflow Phases

### Phase 1: Experiment

**Container**: Fresh `devbob-opencode` container
**Action**: Execute activity with given variables
**Capture**: Copy artifacts to `./canary-artifacts/experiment-*/`
**Cleanup**: Stop container

**Output**: Experiment directory path

---

### Phase 2: Capture Knowledge

**Input**: Experiment artifacts
**Action**: Analyze what happened
**Create**: `CANARY_KNOWLEDGE_{{activityId}}.md`

**Knowledge Document Contains**:
- What was built
- How it was built (exact commands)
- Why it worked (or failed)
- Validation steps
- Failure modes

**Purpose**: Enable someone else to repeat the process

---

### Phase 3: Demonstrate

**Container**: FRESH `devbob-opencode` container (previous destroyed)
**Action**: Execute SAME activity with SAME variables
**Capture**: Copy artifacts to `./canary-artifacts/demonstration-*/`
**Compare**: `diff` between experiment and demonstration
**Update**: Knowledge document with demonstration results

**Success Criteria**:
- Activity executes successfully
- Core functionality matches experiment
- Repeatability proven

**Confidence Levels**:
- **HIGH**: Perfect match, fully automated
- **MEDIUM**: Minor differences (timestamps, IDs)
- **LOW**: Significant differences, manual steps needed

---

### Phase 4: Adopt (Optional)

**Condition**: Only if `adoptToHost: true`

**Pre-flight Check**:
- Experiment: SUCCESS?
- Demonstration: SUCCESS?
- Confidence: HIGH?

If NOT all YES → ABORT

**Actions**:
1. Create rollback branch: `canary-rollback-{{activityId}}-{{timestamp}}`
2. Execute activity ON HOST (not container)
3. Validate deployment (tests, files, behavior)
4. If validation FAILS → automatic rollback
5. If validation SUCCEEDS → update knowledge document

**Safety**: Rollback branch always available

---

## Knowledge Document Format

**File**: `CANARY_KNOWLEDGE_{{activityId}}.md`

```markdown
# Canary Knowledge: {{activityId}}

## Status
- Experiment: SUCCESS
- Demonstration: SUCCESS
- Confidence: HIGH
- Adopted: YES (2024-02-17)

## What Was Built
[Description of changes]

## How It Was Built
### Prerequisites
[Requirements]

### Execution Steps
1. [Step 1 with exact commands]
2. [Step 2 with exact commands]

### Key Decisions
[Why we chose this approach]

## Why It Worked
[Root cause analysis]

## Validation
- Tests: [list]
- Files: [list]
- Behavior: [description]

## Failure Modes
[What can go wrong, how to detect, how to recover]

## Artifacts
- Experiment: [path]
- Demonstration: [path]
- Differences: [list]

## Adoption History
- Rollback branch: canary-rollback-{{activityId}}-{{timestamp}}
- Production status: ACTIVE
- Incidents: 0
```

---

## Advanced Usage

### Custom Container

```bash
opencode activity execute canary-test-activity \
  --variables '{
    "activityId": "my-activity",
    "activityVariables": {...},
    "containerName": "devbob-cli"
  }' \
  --reason "Test in CLI-focused container"
```

---

### Multi-Stage Testing

```bash
# Stage 1: Experiment only
opencode activity execute canary-test-activity \
  --variables '{
    "activityId": "my-activity",
    "activityVariables": {...}
  }'

# Review CANARY_KNOWLEDGE_my-activity.md

# Stage 2: If good, adopt
opencode activity execute canary-test-activity \
  --variables '{
    "activityId": "my-activity",
    "activityVariables": {...},
    "adoptToHost": true
  }'
```

---

## Variables Reference

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `activityId` | string | ✅ Yes | - | Activity template to test |
| `activityVariables` | object | ✅ Yes | - | Variables for the activity |
| `containerName` | string | No | `devbob-opencode` | Container to use |
| `adoptToHost` | boolean | No | `false` | Auto-adopt to host if demonstration succeeds |

---

## Success Metrics

After running canary-test-activity:

✅ **Experiment Success**: Activity ran in container without errors
✅ **Knowledge Captured**: Detailed documentation exists
✅ **Demonstration Success**: Activity repeated successfully
✅ **Repeatability**: Demonstration matches experiment
✅ **Confidence: HIGH**: Fully automated, no manual steps
✅ **Adopted (if enabled)**: Deployed to host with rollback available

---

## Failure Handling

### If Experiment Fails

**Result**: Knowledge document shows "Experiment: FAILURE"

**Action**: 
- Review experiment logs
- Fix the underlying activity
- Run canary-test-activity again

**Safety**: Host system untouched

---

### If Demonstration Fails

**Result**: Knowledge document shows "Demonstration: FAILURE"

**Action**:
- Compare experiment vs. demonstration artifacts
- Identify what's different
- Update activity to be more deterministic
- Run canary-test-activity again

**Insight**: Activity not fully automated or has hidden dependencies

---

### If Adoption Validation Fails

**Result**: Automatic rollback executed

**Action**:
- Review rollback branch
- Investigate why validation failed
- Fix issues
- Retry adoption

**Safety**: Host system restored to pre-adoption state

---

## Integration with Self-Improvement

### Before Any Self-Improvement Activity

```bash
# Always test in canary first
opencode activity execute canary-test-activity \
  --variables '{
    "activityId": "create-step-library-system",
    "activityVariables": {...}
  }' \
  --reason "Safe experimentation before self-improvement"
```

### After Successful Canary Test

```bash
# Adopt to host
opencode activity execute canary-test-activity \
  --variables '{
    "activityId": "create-step-library-system",
    "activityVariables": {...},
    "adoptToHost": true
  }' \
  --reason "Deploy validated self-improvement"
```

---

## The Power of ONE Reusable Activity

**Instead of**: Manual steps, bash scripts, remembering workflow

**We Have**: One activity that encapsulates entire canary process

**Benefits**:
- ✅ Repeatable (same command every time)
- ✅ Reliable (tested workflow)
- ✅ Documented (knowledge capture built-in)
- ✅ Safe (rollback always available)
- ✅ Reusable (works for any activity)

**This is how we should build: ONE activity that does it right, then use it everywhere.**

---

## Next Steps

1. Register this activity:
   ```bash
   # Copy to activity templates directory
   cp canary-test-activity.json .metabob/activities/
   
   # Or use register tool (if available)
   opencode activity register canary-test-activity.json
   ```

2. Test with simple activity:
   ```bash
   opencode activity execute canary-test-activity \
     --variables '{
       "activityId": "ultra-simple-test",
       "activityVariables": {}
     }' \
     --reason "Test canary workflow"
   ```

3. Use for all self-improvement work:
   ```bash
   # Always canary test first
   opencode activity execute canary-test-activity ...
   ```

**Let's make safe experimentation the default, not the exception.** 🚀
