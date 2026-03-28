# Validation Test Case 2: evolve-activity-self-contained

**Impulse ID**: validation-dynamic-activity-creation-with-trailblazing-validation-case-2  
**Type**: memo  
**Budget**: 500 tokens

---

## Test Case: evolve-activity-self-contained Template Validation

### Input
```json
{
  "templateId": "evolve-activity-self-contained",
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
      "evolveActivitySelfContained": {
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
      "templateId": "evolve-activity-self-contained"
    }
  },
  "errors": []
}
```

### Success Criteria
- `pass: true`
- evolve-activity-self-contained recognized by `isMetaTemplate()`
- Template JSON file exists with correct trailblazing config
- Context requirements include parent activity references
- No errors array entries
