# Activity Creation with Self-Validation and Registration

**Date:** 2026-02-12  
**Status:** 🚧 DESIGN  
**Goal:** Build a self-validating activity creation system with evolutionary feedback

## Overview

We need to enhance the activity creation workflow to:

1. **Execute in isolated file tree** (temp directory for safety)
2. **Validate created templates** (schema, completeness, executability)
3. **Test-run the template** (execute with test data)
4. **Register with backend** (on validation success)
5. **Enable trailblazing** (auto-fix validation failures)
6. **Record execution data** (impulses, metrics → SurrealDB)
7. **Enable evolution** (variant creation, merge/split/refine logic)

## Current State

### What We Have ✅

1. **`register-activity-template` tool** (OpenCode)
   - Reads template JSON
   - Validates against `ActivityTemplate.Schema`
   - Registers with `TemplateRepository.save()`
   - Verifies registration worked

2. **`activity-create` bootstrap template** (Proto)
   - 4 steps: identify-pattern, define-scope, design-steps, create-template
   - Uses isolated workspace (`preActivity.workingDirectory.type = "temporary"`)
   - Extracts created files (`postActivity.extractFiles`)
   - Captures errors (`onError.createDiagnosticImpulse`)

3. **Backend variant creation** (`activity_variants.py`)
   - `create_variant()` - stores in SurrealDB
   - Auto-generates `content_hash` and `variant_id`
   - Checks for duplicate content
   - Stores task_steps, variables, metrics

4. **Activity execution infrastructure**
   - MCP incremental execution (`ActivityManager`)
   - Step-by-step tracking
   - Cost/token/duration metrics
   - Trailblazing recovery system

### What's Missing ❌

1. **Validation step** - Doesn't validate created template before registration
2. **Test execution step** - Doesn't try running the template
3. **Registration step** - Doesn't call `register_activity_template`
4. **Validation-driven trailblazing** - Doesn't trigger recovery on validation failure
5. **Impulse recording per step** - Execution data not captured for evolution
6. **Evolution logic** - No merge/split/refine analysis

## Architecture Design

### Phase 1: Enhanced Activity Creation Template

Extend `activity-create.json` with validation and registration:

```json
{
  "variant_id": "activity-create-v2",
  "version": 2,
  "description": "Create, validate, test, and register activity templates with trailblazing",
  "tasks": [
    // ... existing steps 1-4 ...
    
    {
      "id": "validate-schema",
      "description": "Validate Template Schema: Ensure template conforms to ActivityVariant schema",
      "tools": {
        "required": ["register_activity_template"]
      },
      "validation": {
        "postChecks": {
          "requiredPatterns": ["✓ Validation passed"]
        }
      },
      "prompt": {
        "template": "Validate the created template using register_activity_template with validate_only=true. The template file is at: {{template_file_path}}"
      }
    },
    
    {
      "id": "test-execute",
      "description": "Test Execute Template: Run the template with dummy data to verify it works",
      "tools": {
        "required": ["activity"]
      },
      "validation": {
        "postChecks": {
          "forbiddenPatterns": ["❌", "failed", "error"]
        }
      },
      "prompt": {
        "template": "Execute the template with test variables: {{test_variables}}. Verify all steps complete successfully."
      }
    },
    
    {
      "id": "register-template",
      "description": "Register Template: Register the validated template with the backend",
      "tools": {
        "required": ["register_activity_template"]
      },
      "validation": {
        "postChecks": {
          "requiredPatterns": ["✓ Template .* registered successfully"]
        }
      },
      "prompt": {
        "template": "Register the template file {{template_file_path}} using register_activity_template. This makes it available for use."
      }
    }
  ]
}
```

### Phase 2: Validation-Driven Trailblazing

**Current trailblazing** (Phase 1): AI continuation prompts on step failure  
**New trailblazing** (Phase 2): Validation-triggered recovery with specific fix prompts

```typescript
// In template-executor.ts
async function executeWithValidation(
  template: ActivityTemplate.Schema,
  variables: Record<string, unknown>
): Promise<ExecutionResult> {
  
  const result = await executeTemplate(template, variables)
  
  if (!result.success) {
    // Existing: Try Phase 1 recovery (AI continuation)
    const recovered = await trailblazingRecovery(result.error)
    if (recovered.success) return recovered
  }
  
  // NEW: Validation-specific recovery
  if (template.id === 'activity-create') {
    const validationStep = result.tasks.find(t => t.taskId === 'validate-schema')
    
    if (validationStep?.status === 'failed') {
      // Extract validation errors
      const errors = parseValidationErrors(validationStep.output)
      
      // Create recovery task with specific fix guidance
      const recoveryPrompt = `
        The template validation failed with these errors:
        ${errors.map(e => `- ${e.path}: ${e.message}`).join('\n')}
        
        Fix each error in the template file. Common fixes:
        - Missing required fields: Add the field with appropriate default
        - Invalid type: Convert to correct type (string/number/array)
        - Invalid enum value: Use one of: ${e.allowedValues}
      `
      
      const recoveryTask = createRecoveryTask(recoveryPrompt, validationStep)
      result.tasks.push(recoveryTask)
      
      // Re-execute validation step
      const revalidated = await executeTask(validationStep, variables)
      if (revalidated.success) {
        result.success = true
        result.variantCreated = true // Flag for backend storage
      }
    }
  }
  
  return result
}
```

### Phase 3: Impulse Recording Per Step

Each step execution should record its impulses for evolutionary analysis:

```typescript
// In ActivityManager.reportStepResult()
async reportStepResult(options: {
  executionId: string
  stepId: string
  success: boolean
  output: string
  impulses: Array<{  // NEW: Capture impulses used
    id: string
    type: string
    content_summary: string
    tokens_used: number
    relevance_score: number
  }>
}) {
  // Store in SurrealDB execution record
  await db.query(`
    UPDATE activity_executions:${executionId}
    SET steps.${stepId}.impulses = $impulses
    WHERE id = activity_executions:${executionId}
  `, { impulses: options.impulses })
}
```

### Phase 4: Evolution Analytics (Backend)

**Location**: `server/actions/activity_evolution.py` (new file)

```python
async def analyze_variant_performance(
    db: SurrealDBClient,
    variant_id: str,
    lookback_days: int = 30
) -> EvolutionRecommendation:
    """
    Analyze variant execution history to recommend evolution actions.
    
    Returns:
        - MERGE: Variant is redundant with another (>90% overlap)
        - SPLIT: Variant handles too many use cases (low success rate, high variance)
        - REFINE: Variant needs improvement (moderate success, consistent failures)
        - PROMOTE: Variant is excellent (>90% success, beats alternatives)
        - RETIRE: Variant is obsolete (low usage, better alternatives exist)
    """
    
    # Get execution history
    executions = await db.query("""
        SELECT * FROM activity_executions 
        WHERE variant_id = $variant_id 
        AND created_at > time::now() - duration::days($lookback_days)
    """, {"variant_id": variant_id, "lookback_days": lookback_days})
    
    # Compute metrics
    success_rate = sum(1 for e in executions if e.success) / len(executions)
    avg_cost = sum(e.total_cost for e in executions) / len(executions)
    
    # Analyze failure patterns
    failures = [e for e in executions if not e.success]
    failure_steps = Counter(f.failed_step for f in failures)
    
    # Compare with similar variants (same activity_id)
    siblings = await get_sibling_variants(db, variant_id)
    
    # Decision logic
    if success_rate < 0.3:
        # Check if splitting would help
        if len(failure_steps) > 1 and variance(failure_causes) > 0.5:
            return EvolutionRecommendation(
                action="SPLIT",
                reason=f"Low success rate ({success_rate:.1%}) with diverse failure modes",
                suggested_splits=[
                    {"focus": cause, "filter": criteria} 
                    for cause, criteria in identify_split_axes(failures)
                ]
            )
    
    if success_rate > 0.9 and len(siblings) > 0:
        # Check if merging would help
        overlapping = [s for s in siblings if overlap_score(variant_id, s.id) > 0.9]
        if overlapping:
            return EvolutionRecommendation(
                action="MERGE",
                reason=f"Excellent performance, overlaps with {len(overlapping)} variants",
                merge_targets=overlapping
            )
    
    # ... more logic
```

### Phase 5: Automated Evolution Workflow

**Trigger**: Backend cron job runs daily

```python
# server/jobs/evolution_cron.py

async def run_evolution_cycle():
    """
    Daily evolution cycle:
    1. Analyze all active variants
    2. Identify evolution opportunities
    3. Create evolution tasks
    4. Submit to activity queue
    """
    
    variants = await get_active_variants(db)
    
    for variant in variants:
        recommendation = await analyze_variant_performance(db, variant.variant_id)
        
        if recommendation.action == "SPLIT":
            # Create activity to split variant
            await create_activity_execution(
                activity_id="activity-split",  # New meta-activity
                variables={
                    "source_variant": variant.variant_id,
                    "split_axes": recommendation.suggested_splits
                }
            )
        
        elif recommendation.action == "MERGE":
            # Create activity to merge variants
            await create_activity_execution(
                activity_id="activity-merge",
                variables={
                    "variants_to_merge": recommendation.merge_targets
                }
            )
        
        elif recommendation.action == "REFINE":
            # Create activity to refine variant
            await create_activity_execution(
                activity_id="activity-refine",
                variables={
                    "variant_to_refine": variant.variant_id,
                    "failure_patterns": recommendation.failure_analysis
                }
            )
```

## Implementation Plan

### Step 1: Enhance activity-create template ✅ Ready
- Add `validate-schema` step
- Add `test-execute` step  
- Add `register-template` step
- Update hooks to capture created template path

### Step 2: Extend validation tooling 🚧 Needs work
- Enhance `register-activity-template` to return detailed validation errors
- Add `validate_template_execution` helper to test-run templates
- Add structured error parsing

### Step 3: Implement validation-driven trailblazing 🚧 Needs work
- Extend `template-executor.ts` with validation-specific recovery
- Parse validation errors into actionable fix prompts
- Create recovery tasks automatically
- Store variant on successful recovery

### Step 4: Add impulse recording 🚧 Needs work
- Extend `ActivityManager.reportStepResult()` to accept impulses
- Capture impulses during step execution
- Store in SurrealDB execution records
- Add impulse retrieval API

### Step 5: Build evolution analytics (Backend) ⏸️ Future
- Create `server/actions/activity_evolution.py`
- Implement `analyze_variant_performance()`
- Add merge/split/refine detection logic
- Create evolution recommendation API

### Step 6: Build meta-activities (OpenCode) ⏸️ Future
- Create `activity-split.json` template
- Create `activity-merge.json` template
- Create `activity-refine.json` template
- Test evolution workflows

### Step 7: Automated evolution cron ⏸️ Future
- Create `server/jobs/evolution_cron.py`
- Schedule daily evolution analysis
- Submit evolution activities to queue
- Monitor evolution outcomes

## Testing Strategy

### Unit Tests
- Template validation logic
- Error parsing
- Recovery prompt generation
- Impulse recording

### Integration Tests
- Full activity-create execution
- Validation failure → recovery → success
- Template registration verification
- Impulse data in SurrealDB

### End-to-End Tests
1. **Happy path**: Create valid template → validate → test → register → success
2. **Validation failure**: Create invalid template → validation fails → trailblaze fixes → register → success
3. **Execution failure**: Create template with buggy step → test fails → trailblaze fixes → success

### Evolution Tests (Future)
1. **Split detection**: Run variants with diverse failure modes → split recommended
2. **Merge detection**: Run overlapping variants → merge recommended
3. **Refine workflow**: Execute refine activity → improved variant created

## Success Metrics

### Phase 1-2: Activity Creation
- ✅ 100% of created templates pass schema validation
- ✅ 90%+ of created templates execute successfully on first try
- ✅ 95%+ of validation failures recovered via trailblazing
- ✅ All validated templates successfully registered

### Phase 3-4: Data Collection
- ✅ 100% of step executions record impulses
- ✅ Impulse data queryable in SurrealDB
- ✅ Execution history retained for 90 days

### Phase 5-7: Evolution (Future)
- ⏸️ Evolution recommendations generated weekly
- ⏸️ 80%+ of split/merge/refine activities succeed
- ⏸️ Variant population improves over time (higher avg success rate)

## Files to Create/Modify

### Immediate (Steps 1-4)

1. **repos/metabob-proto/activities/bootstrap/activity-create-v2.json** (new)
   - Enhanced version with validation and registration steps

2. **repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.ts** (modify)
   - Return structured validation errors
   - Add detailed error messages with fix hints

3. **repos/metabob-opencode/packages/opencode/src/session/template-executor.ts** (modify)
   - Add validation-driven trailblazing logic
   - Parse validation errors
   - Generate recovery prompts

4. **repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py** (modify)
   - Extend `reportStepResult()` to accept impulses
   - Store impulses in execution record

5. **repos/metabob-rpc-api/server/routes/v2_activities.py** (modify)
   - Extend execution record schema to store impulses
   - Add impulse retrieval endpoint

### Future (Steps 5-7)

6. **repos/metabob-rpc-api/server/actions/activity_evolution.py** (new)
   - Evolution analytics logic
   - Merge/split/refine detection

7. **repos/metabob-rpc-api/server/jobs/evolution_cron.py** (new)
   - Daily evolution analysis job

8. **repos/metabob-proto/activities/meta/activity-split.json** (new)
   - Template for splitting activities

9. **repos/metabob-proto/activities/meta/activity-merge.json** (new)
   - Template for merging activities

10. **repos/metabob-proto/activities/meta/activity-refine.json** (new)
    - Template for refining activities

## Next Actions

**To start implementation:**

1. ✅ Review this design with team
2. Create enhanced `activity-create-v2.json` template
3. Update `register-activity-template` tool with better error reporting
4. Test the validation → trailblaze → register flow manually
5. Implement impulse recording in ActivityManager
6. Build evolution analytics (Phase 5+)

**Dependencies:**
- Authentication system working (✅ DONE)
- Activity execution working (✅ DONE)
- Template registration working (✅ DONE)
- Trailblazing recovery working (✅ EXISTS, needs validation integration)
