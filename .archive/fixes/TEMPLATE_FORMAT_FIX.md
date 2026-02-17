# Activity Template Format Issue - Root Cause Analysis

## Problem

Agent in devbob-opencode container created activity template in **wrong format**, causing registration and execution failures.

## Root Cause

The devbob-opencode container workspace contains **incorrect example templates** that use the OLD simplified schema instead of the proto-aligned V2 schema.

### Incorrect Examples in Container

Location: `/workspace/test-greeting-activity.json`

```json
{
  "tasks": [
    {
      "id": "print_greeting",
      "prompt": "Print a greeting...",  // ❌ WRONG: Flat string
      "agent": "general",                // ❌ WRONG: Should be "subagent"
      "success_criteria": [...]
    }
  ]
}
```

### Correct Proto-Aligned Format

The V2 API expects ProtoTaskStep format (aligned with metabob-proto):

```json
{
  "name": "Activity Name",
  "category": "feature|bugfix|refactor|infrastructure",
  "description": "Activity description",
  "variables": {
    "var_name": {
      "type": "string",
      "required": false,
      "default": "value",
      "description": "Variable description"
    }
  },
  "context_requirements": [],
  "tasks": [                                    // ✅ Can use "tasks" or "task_steps"
    {
      "id": "task_id",
      "subagent": "general",                    // ✅ CORRECT: subagent not agent
      "description": "Task description",
      "dependencies": [],
      "prompt": {                               // ✅ CORRECT: Nested object
        "template": "Do something with {{var}}",
        "max_tokens": 1000,
        "compression_strategy": "filter",
        "variables": ["var"]
      },
      "validation": {                           // ✅ CORRECT: Nested validation
        "required_patterns": ["pattern"],
        "forbidden_patterns": [],
        "required_files": [],
        "commands": []
      },
      "retry": {                                // ✅ CORRECT: Nested retry config
        "max_attempts": 2,
        "strategy": "simple",
        "fallback_prompt": ""
      },
      "metrics": {                              // ✅ CORRECT: Nested metrics
        "success_rate": 0.0,
        "avg_tokens": 0,
        "avg_duration": 0,
        "common_failures": []
      },
      "impulse_refs": [],                       // ✅ CRITICAL for learning system
      "guidance": ["hints for agent"],
      "expected_actions": ["action1", "action2"]
    }
  ]
}
```

## Key Differences

| Field | Old Format | Proto Format | Backend Expects |
|-------|------------|--------------|-----------------|
| Agent type | `agent` | `subagent` | `subagent` ✅ |
| Prompt | Flat string | Nested object | Nested object ✅ |
| Validation | Optional dict | Nested object | Nested object ✅ |
| Retry | Missing | Nested object | Nested object ✅ |
| Metrics | Missing | Nested object | Nested object ✅ |
| Impulse refs | Missing | Array | Array ✅ |

## Impact

1. **Agent learns wrong format**: Copies from incorrect examples
2. **Registration fails**: Backend rejects schema (422 validation error)
3. **Execution fails**: Missing required fields (404 not found)

## Solution

### Immediate Fix

1. Replace incorrect examples in devbob-opencode container
2. Add correct proto-aligned example templates
3. Document format in container's README

### Long-term Fix

1. **Template validation**: Add schema validation before registration
2. **Format migration**: Convert old templates to proto format
3. **Documentation**: Clear examples in all workspaces
4. **Type safety**: Use TypeScript types to enforce correct structure

## Files to Update

### In devbob-opencode Container

```bash
# Replace with correct format
/workspace/test-greeting-activity.json
/workspace/test-template.json
/workspace/examples/*.json

# Add documentation
/workspace/ACTIVITY_TEMPLATE_FORMAT.md
```

### In Host Project

```bash
# Already correct
metabob-devbob/test-template-v2-correct.json ✅
metabob-devbob/register-hello-world-template.py ✅
```

## Verification

After fix, agent should:
1. Read correct example templates
2. Create proto-aligned format
3. Successfully register with backend
4. Templates are discoverable and executable

## Related Files

- Backend schema: `repos/metabob-rpc-api/server/models/proto_task_step.py`
- API endpoint: `repos/metabob-rpc-api/server/routes/v2_activities.py`
- Proto definition: `repos/metabob-proto/proto/metabob/activity/variant.proto`
