# Validation Test Case 3: debug-activity-self-contained

**Impulse ID**: validation-dynamic-activity-creation-with-trailblazing-validation-case-3  
**Type**: memo  
**Budget**: 500 tokens

---

## Test Case: debug-activity-self-contained Template Validation

### Input
```json
{
  "templateId": "debug-activity-self-contained",
  "checkImplementation": true,
  "runIntegrationTests": false
}
```

### Expected Output
```json
{
  "pass": true,
  "actual": {
    "isMetaTemplateCheck": {
      "createActivity": true,
      "evolveActivity": true,
      "debugActivity": true
    },
    "autoEnableLogic": {
      "present": true
    },
    "phase2bInjection": {
      "present": true
    },
    "templateJsonFiles": {
      "debugActivitySelfContained": {
        "exists": true,
        "hasTrailblazingConfig": true,
        "config": {
          "enabled": true,
          "maxCostPerTask": 1.0,
          "maxTotalCost": 5.0
        }
      }
    },
    "runtimeValidation": {
      "templateExists": true,
      "templateId": "debug-activity-self-contained"
    }
  },
  "errors": []
}
```

### Success Criteria
- `pass: true`
- debug-activity-self-contained recognized by `isMetaTemplate()`
- Template JSON file exists with correct trailblazing config
- Context requirements include error patterns and execution traces
- Template includes recovery task generation
- No errors array entries
