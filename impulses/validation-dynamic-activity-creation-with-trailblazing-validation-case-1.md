# Validation Test Case 1: create-activity-self-contained

**Impulse ID**: validation-dynamic-activity-creation-with-trailblazing-validation-case-1  
**Type**: memo  
**Budget**: 500 tokens

---

## Test Case: create-activity-self-contained Template Validation

### Input
```json
{
  "templateId": "create-activity-self-contained",
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
      "present": true,
      "location": "activity.ts (found)"
    },
    "phase2bInjection": {
      "present": true,
      "location": "activity.ts (found)"
    },
    "templateJsonFiles": {
      "createActivitySelfContained": {
        "exists": true,
        "hasTrailblazingConfig": true
      }
    },
    "runtimeValidation": {
      "templateExists": true,
      "templateId": "create-activity-self-contained"
    }
  },
  "errors": []
}
```

### Success Criteria
- `pass: true`
- All 3 meta-templates recognized by `isMetaTemplate()`
- Auto-enable logic present in activity.ts
- Phase 2b context injection present in activity.ts
- Template JSON file exists with trailblazing config
- No errors array entries
