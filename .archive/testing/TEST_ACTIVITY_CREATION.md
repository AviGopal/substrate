# Testing Activity Creation with Self-Validation

**Date:** 2026-02-12  
**Status:** ✅ READY TO TEST  
**Template:** `activity-create-v2.json`

## What We Built

Enhanced the activity creation system with:

1. **Schema Validation Step** - Validates template against ActivityVariant schema
2. **Test Execution Step** - Runs the template with dummy data
3. **Registration Step** - Registers validated template with backend
4. **Trailblazing Recovery** - Auto-fixes validation and execution failures
5. **Isolated Workspace** - Creates templates in temp directory for safety

## Template Features

### Variables
- `activity_name` (required): Name for the new activity
- `activity_id` (required): Unique ID (e.g., "deploy-prod-v1")
- `target_category` (required): feature-impl | bug-fix | refactor | infrastructure | tool
- `source_pattern` (optional): Description of successful interaction to formalize
- `test_variables` (optional): Test data for validation run

### Steps (7 total)
1. **identify-pattern**: Analyze successful interaction to extract reusable pattern
2. **define-scope**: Define what activity will/won't do, success criteria, failure modes
3. **design-steps**: Break down into 3-7 discrete steps with dependencies
4. **create-template**: Write ActivityVariant JSON following proto schema
5. **validate-schema**: Validate with `register_activity_template(validate_only=true)`
6. **test-execute**: Register and run with test data to verify execution
7. **create-summary**: Document the template for future reference

### Validation & Recovery

**Schema Validation (Step 5)**:
- Validates JSON syntax with `jq`
- Validates schema with `register_activity_template`
- On failure: Trailblazing analyzes errors and fixes template
- Max 5 attempts with incremental recovery

**Execution Validation (Step 6)**:
- Registers template with backend
- Executes with test variables
- Verifies all steps complete successfully
- On failure: Trailblazing fixes and re-tests
- Max 3 attempts

### Hooks

**Pre-Activity**:
- Creates temporary workspace (`/tmp/template-create-*`)
- Sets isolated environment
- Enables trailblazing mode

**Post-Activity**:
- Extracts `*.json` templates to `./created-templates/`
- Extracts summary to `./created-templates/`
- Captures validation metrics

**On Error**:
- Captures environment and logs
- Creates diagnostic impulse
- Enables trailblazing recovery (max 3 attempts)

## How to Test

### Prerequisites

1. **Backend running with authentication**:
   ```bash
   docker ps | grep api-server-dev
   # Should show: api-server-dev (port 8080)
   ```

2. **Session token configured**:
   ```bash
   python3 create_test_session.py
   # Creates ~/.metabob/config.json with session_token
   ```

3. **Template registered with backend**:
   ```bash
   # Register activity-create-v2 template
   curl -X POST http://localhost:8080/v2/activities/templates \
     -H "Authorization: Bearer $(jq -r .session_token ~/.metabob/config.json)" \
     -H "Content-Type: application/json" \
     -d @repos/metabob-proto/activities/bootstrap/activity-create-v2.json
   ```

### Test 1: Create Simple Activity (Happy Path)

**Goal**: Create a simple activity template that validates and executes successfully

```python
# test_create_simple_activity.py
import asyncio
from metabob_cli.mcp.activity_manager import ActivityManager
from pathlib import Path
import json

async def test_create_simple_activity():
    # Read session token
    config_path = Path.home() / ".metabob" / "config.json"
    with open(config_path) as f:
        config = json.load(f)
        session_token = config['session_token']
    
    manager = ActivityManager(
        base_url="http://localhost:8080",
        session_token=session_token
    )
    
    # Start execution
    result = await manager.start_execution(
        activity_id="activity-create-v2",
        session_id="test-simple-activity",
        variables={
            "activity_name": "Hello World",
            "activity_id": "hello-world-v1",
            "target_category": "tool",
            "source_pattern": "Simple greeting activity for testing",
            "test_variables": {
                "name": "World"
            }
        },
        cost_budget=1.0
    )
    
    print(f"Execution started: {result['execution_id']}")
    
    # Execute steps
    while True:
        step = await manager.get_next_step(result['execution_id'])
        
        if step.get('complete'):
            print("✅ Activity completed successfully!")
            break
        
        if step.get('error'):
            print(f"❌ Error: {step['error']}")
            break
        
        print(f"\n📋 Step {step['step_index'] + 1}/{step['total_steps']}: {step['current_step']['description']}")
        
        # Report step completion (in real execution, agent does this)
        await manager.report_step_result(
            execution_id=result['execution_id'],
            step_id=step['current_step']['step_id'],
            success=True,
            output="Step completed",
            error="",
            cost=0.01,
            tokens=100,
            duration=1000,
            tool_calls=[]
        )

if __name__ == "__main__":
    asyncio.run(test_create_simple_activity())
```

**Expected Output**:
```
Execution started: exec_abc123

📋 Step 1/7: Identify Interaction Pattern
📋 Step 2/7: Define Activity Scope
📋 Step 3/7: Design Task Steps
📋 Step 4/7: Create Activity Template
📋 Step 5/7: Validate Template Schema
  ✓ Validation passed for template "Hello World" (hello-world-v1)
📋 Step 6/7: Test Execute Template
  ✓ Template "Hello World" registered successfully
  ✅ Activity completed: Hello World
📋 Step 7/7: Create Template Summary

✅ Activity completed successfully!

Created files:
- /tmp/template-create-abc123/hello-world-v1.json
- /tmp/template-create-abc123/TEMPLATE_SUMMARY.md
- Copied to: ./created-templates/
```

### Test 2: Create Activity with Validation Failure (Trailblazing)

**Goal**: Create activity that fails schema validation, then auto-fixes via trailblazing

```python
# Intentionally create invalid template by corrupting JSON in step 4
# Trailblazing should detect validation errors and fix them
```

**Expected Behavior**:
1. Step 4 creates invalid JSON (missing required fields)
2. Step 5 validation fails with detailed errors
3. Trailblazing kicks in (attempt 1/5)
4. Recovery prompt: "Fix these validation errors: ..."
5. Agent edits JSON to fix errors
6. Re-run validation (attempt 2/5)
7. Validation passes ✅
8. Continue to test execution

### Test 3: Create Activity with Execution Failure (Trailblazing)

**Goal**: Create activity that passes schema but fails test execution

**Expected Behavior**:
1. Steps 1-5 succeed (schema valid)
2. Step 6 test execution fails (runtime error)
3. Trailblazing kicks in (attempt 1/3)
4. Recovery prompt: "Step X failed with error Y. Fix the template."
5. Agent analyzes failure and edits template
6. Re-register and re-test
7. Test passes ✅
8. Continue to summary

### Test 4: Complex Activity Creation

**Goal**: Create a multi-step activity with dependencies and validation

```python
variables = {
    "activity_name": "Deploy to Staging",
    "activity_id": "deploy-staging-v1",
    "target_category": "infrastructure",
    "source_pattern": "Successful deployment workflow: build → test → deploy → verify",
    "test_variables": {
        "environment": "staging",
        "branch": "main",
        "version": "1.2.3"
    }
}
```

**Expected Template**:
```json
{
  "variant_id": "deploy-staging-v1",
  "task_steps": [
    {
      "id": "build",
      "description": "Build application artifacts",
      "dependencies": [],
      ...
    },
    {
      "id": "test",
      "description": "Run integration tests",
      "dependencies": ["build"],
      ...
    },
    {
      "id": "deploy",
      "description": "Deploy to staging environment",
      "dependencies": ["test"],
      ...
    },
    {
      "id": "verify",
      "description": "Verify deployment health",
      "dependencies": ["deploy"],
      ...
    }
  ]
}
```

## Success Criteria

### For Each Test

✅ **Schema Validation**: Template passes `register_activity_template(validate_only=true)`  
✅ **Test Execution**: Template executes successfully with test data  
✅ **Registration**: Template registered and retrievable from backend  
✅ **File Extraction**: JSON and summary copied to `./created-templates/`  
✅ **Trailblazing**: Failures auto-recover within max attempts

### Overall Metrics

- **Creation Success Rate**: >90% of attempts produce valid, executable templates
- **Validation Success Rate**: 100% of created templates pass schema validation (after trailblazing)
- **Execution Success Rate**: >85% of validated templates execute successfully
- **Recovery Success Rate**: >95% of validation/execution failures recover via trailblazing
- **Registration Success Rate**: 100% of validated templates register successfully

## Debugging

### Common Issues

**Issue**: Schema validation fails repeatedly  
**Fix**: Check proto schema vs. template structure. Ensure using `task_steps` not `tasks`.

**Issue**: Test execution fails with "Template not found"  
**Fix**: Ensure template was registered in step 6. Check backend logs.

**Issue**: Trailblazing doesn't trigger  
**Fix**: Verify `onError.enableTrailblazing: true` in hooks. Check `ENABLE_TRAILBLAZING` env var.

**Issue**: Files not extracted to `./created-templates/`  
**Fix**: Check `postActivity.extractFiles` hook. Ensure temp directory preserved.

### Logs to Check

1. **Activity Manager logs**: Shows step execution, validation results
2. **Backend logs**: `docker logs api-server-dev` - shows template registration
3. **Temp workspace**: `/tmp/template-create-*` - created files before extraction
4. **Extracted files**: `./created-templates/` - final output

## Next Steps

After successful testing:

1. **Register activity-create-v2** with production backend
2. **Update documentation** with examples
3. **Create validation test suite** for common template patterns
4. **Build meta-activities**: activity-split, activity-merge, activity-refine
5. **Implement evolution analytics** (Phase 5 of design doc)

## Files

- **Template**: `repos/metabob-proto/activities/bootstrap/activity-create-v2.json`
- **Design Doc**: `ACTIVITY_CREATION_VALIDATION_DESIGN.md`
- **Auth Fix**: `ACTIVITY_EXECUTION_AUTH_FIX.md`
- **Test Scripts**: `test_create_simple_activity.py` (to be created)
