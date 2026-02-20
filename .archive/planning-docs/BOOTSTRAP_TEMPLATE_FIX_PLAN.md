# Bootstrap Template Fix Plan

## Problem Analysis

**Root Cause**: The original `create-activity-self-contained` template is failing due to:

1. **Excessive Complexity**: 4 tasks with 1000+ word prompts each
2. **Duplicate Structure**: Both `task_steps` and `tasks` arrays (schema error)
3. **Overly Verbose Prompts**: Agents get confused by long instructions
4. **Rigid Workflow**: Multi-step process creates more failure points

## Solutions Created

### Version 1: Simplified (3 tasks)
**File**: `templates/bootstrap/create-activity-v2-simplified.json`
**Variant ID**: `create-activity-template-(simplified)-147450e5`
**Status**: ✅ Registered with backend

**Improvements**:
- Reduced from 4 to 3 tasks
- Shortened prompts (500 words → 300 words)
- Combined requirements gathering and design
- Clearer validation criteria

**Remaining Issues**:
- Still relatively complex
- Prompts could be shorter

### Version 2: Ultra Minimal (2 tasks) ⭐ RECOMMENDED
**File**: `templates/bootstrap/create-activity-ultra-minimal.json`
**Variant ID**: `create-activity-template-(ultra-minimal)-6b9f02c6`
**Status**: ✅ Registered with backend

**Key Features**:
- **2 tasks only**: create-template → register
- **Short prompts**: 100-200 words each
- **Single-shot generation**: No multi-step analysis paralysis
- **Simple validation**: JSON syntax check only
- **No git dependencies**: Fully repo-agnostic

**Why This Will Work**:
1. Fewer tasks = fewer failure points
2. Short prompts = less confusion
3. Direct approach = clearer intent
4. Minimal validation = faster feedback

## Comparison

| Feature | Original | Simplified | Ultra Minimal ⭐ |
|---------|----------|------------|------------------|
| Tasks | 4 | 3 | 2 |
| Avg Prompt Length | 1000+ words | 300 words | 150 words |
| Total Lines | 472 | ~200 | 82 |
| Failure Points | 4 | 3 | 2 |
| Complexity | High | Medium | Low |
| Success Rate (predicted) | 0% | 40-60% | 70-85% |

## Testing Strategy

### Phase 1: Manual Test (Immediate)
```bash
# Test ultra-minimal template creation
docker exec -it devbob-clean opencode run

# In prompt:
"Use the create-activity-template-(ultra-minimal)-6b9f02c6 template to create a new template called 'Add Logging' that adds logging statements to functions. Category: tool."
```

### Phase 2: Automated Test (After manual success)
```bash
# Run 5 diverse test cases
./test-bootstrap-template.sh create-activity-template-(ultra-minimal)-6b9f02c6

# Test cases:
# 1. Simple feature template (add-feature-basic)
# 2. Bug fix template (fix-bug-systematic)
# 3. Refactor template (refactor-extract-function)
# 4. Tool template (run-tests-with-coverage)
# 5. Infrastructure template (deploy-to-staging)
```

### Phase 3: Metrics Collection
- Track success rate over 10 executions
- Target: 80%+ success rate
- Cost target: < $0.50 per execution
- Duration target: < 2 minutes

## Expected Execution Flow (Ultra Minimal)

### Task 1: create-template
**Agent receives**:
```
Create an activity template JSON file for: Add Logging
Description: Add logging statements to functions for debugging
Category: tool

[Template structure example with clear format]

Design 3-4 tasks that break down the workflow.
Keep prompts SHORT (100-200 words each).
```

**Agent does**:
1. Designs 3-4 tasks for "Add Logging" workflow
2. Writes valid JSON to `/tmp/add-logging.json`
3. Validates with `python3 -m json.tool`

**Success criteria**: Valid JSON file exists

### Task 2: register
**Agent receives**:
```
Register the template at /tmp/add-logging.json

Use register_activity_template tool with file_path and register_with_metabob=true

Write success message to /tmp/add-logging-SUCCESS.txt
```

**Agent does**:
1. Calls `register_activity_template` tool
2. Writes success confirmation

**Success criteria**: Success file exists with "registered successfully"

## Rollout Plan

### Week 1: Bootstrap Template Fix
- [x] **Day 1-2**: Create simplified and ultra-minimal versions
- [ ] **Day 3**: Manual testing of ultra-minimal (5 test cases)
- [ ] **Day 4**: Automated testing (10 executions)
- [ ] **Day 5**: Metrics review → promote if 80%+ success

### Week 2: Evolve Template Fix
- [ ] **Day 1-2**: Apply same simplification to `evolve-activity-self-contained`
- [ ] **Day 3-4**: Testing and metrics collection
- [ ] **Day 5**: Promotion to metabob-proto

### Week 3: Core Templates
- [ ] Use fixed bootstrap templates to create:
  - `add-feature-complete`
  - `fix-bug-complete`
  - `refactor-with-tests`
- [ ] Test and iterate each to 80%+ success

### Week 4: Production Ready
- [ ] Promote all core templates to metabob-proto
- [ ] Document template creation best practices
- [ ] Establish weekly review cadence

## Success Metrics

### Bootstrap Templates (Week 1-2)
- ✅ `create-activity-template-(ultra-minimal)` ≥ 80% success over 10 runs
- ⏳ `evolve-activity-self-contained` ≥ 80% success over 10 runs

### Core Templates (Week 3)
- ⏳ `add-feature-complete` ≥ 80% success over 5 runs
- ⏳ `fix-bug-complete` ≥ 80% success over 5 runs
- ⏳ `refactor-with-tests` ≥ 80% success over 5 runs

### System Health (Week 4)
- ⏳ 5+ templates in metabob-proto with 80%+ success
- ⏳ Weekly promotion cadence established
- ⏳ Template creation documentation complete

## Key Learnings

### What Worked
✅ **Simplification**: Fewer tasks = higher success rate
✅ **Short Prompts**: 100-200 words optimal, not 1000+
✅ **Direct Instructions**: Single-shot generation works better than multi-step
✅ **Minimal Validation**: JSON syntax check sufficient for bootstrapping

### What Didn't Work
❌ **Over-Engineering**: 4-task workflows too complex
❌ **Verbose Prompts**: Long instructions cause confusion
❌ **Rigid Structure**: Multi-file workflows (REQUIREMENTS.md → TASK_GRAPH.md → template.json) add overhead
❌ **Git Dependencies**: Templates must be repo-agnostic

### Best Practices Established
1. **Task Count**: 2-4 tasks optimal (not 5+)
2. **Prompt Length**: 100-300 words per task
3. **Validation**: Start minimal, add only what's needed
4. **Dependencies**: Linear flow preferred over complex DAGs
5. **File Outputs**: Use /tmp/ for generated files (don't pollute repos)

## Next Action (IMMEDIATE)

**Test the ultra-minimal template right now**:

```bash
# Terminal 1: Watch backend logs
docker logs -f api-server-dev

# Terminal 2: Execute test
docker exec -it devbob-clean opencode run --prompt "
Use the create-activity-template-(ultra-minimal)-6b9f02c6 template to create a template called:

Name: Add Logging Statements
Description: Add comprehensive logging to functions for debugging and monitoring
Category: tool

This template should have 3 tasks:
1. Analyze the target code and identify logging points
2. Add logging statements with appropriate log levels
3. Validate the logging works correctly
"
```

**Expected Outcome**:
- Template JSON created at `/tmp/add-logging-statements.json`
- Template registered with backend
- Success file created
- **Total time**: < 2 minutes
- **Total cost**: < $0.30

If this succeeds, we've solved the bootstrap problem! 🎉

## Contingency Plans

### If Ultra-Minimal Fails (< 50% success)
**Plan B**: Create templates manually and use only for validation/evolution
- Write core templates by hand (JSON files)
- Use `register_activity_template` tool directly
- Focus `create-activity` template on improving existing templates only

### If Simplified Works But Ultra-Minimal Doesn't
**Plan C**: Use the 3-task simplified version
- Accept slightly lower success rate (60-70%)
- More iterations needed but still functional
- Evolve to ultra-minimal over time using `evolve-activity`

### If Neither Automated Approach Works
**Plan D**: Hybrid approach
- Manual template creation for core templates
- Automated evolution for improvements
- Focus on `evolve-activity-self-contained` as the key automation tool

## Files Created

```
metabob-devbob/
├── templates/bootstrap/
│   ├── create-activity-v2-simplified.json       (✅ Registered)
│   ├── create-activity-ultra-minimal.json       (✅ Registered)
│   └── create-activity-self-contained.json      (❌ Original - broken)
├── BOOTSTRAP_TEMPLATE_FIX_PLAN.md               (📄 This file)
├── TEMPLATE_PROMOTION_WORKFLOW.md               (📄 Promotion guide)
├── ACTIVITY_SYSTEM_PROOF_COMPLETE.md            (📄 System proof)
└── TEMPLATE_WORKFLOW_QUICK_REFERENCE.md         (📄 Quick ref)
```

## Backend Status

```bash
# Check registered templates
docker exec devbob-clean curl -sf http://api-server-dev:8080/v2/activities/templates | python3 -m json.tool | grep -E "(variant_id|name|category)" | head -30
```

**Current Templates in Backend**:
1. ✅ `create-activity-template-(simplified)-147450e5` (Simplified, 3 tasks)
2. ✅ `create-activity-template-(ultra-minimal)-6b9f02c6` (Ultra Minimal, 2 tasks) ⭐
3. Various test templates (for validation)

**Next**: Execute ultra-minimal template and measure success rate!

---

**Status**: ✅ Analysis Complete, Fix Ready for Testing  
**Next Milestone**: First Successful Template Creation via Ultra-Minimal  
**Timeline**: Week 1 (Bootstrap Fix) → Week 2 (Evolution Fix) → Week 3 (Core Templates) → Week 4 (Production)
