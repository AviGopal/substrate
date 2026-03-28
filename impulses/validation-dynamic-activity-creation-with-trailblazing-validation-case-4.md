# Validation Test Case 4: Integration Tests

**Impulse ID**: validation-dynamic-activity-creation-with-trailblazing-validation-case-4  
**Type**: memo  
**Budget**: 500 tokens

---

## Test Case: Integration Tests (turn-lifecycle-integration.test.ts)

### Input
```json
{
  "templateId": "create-activity-self-contained",
  "checkImplementation": true,
  "runIntegrationTests": true
}
```

### Expected Output
```json
{
  "pass": true,
  "actual": {
    "integrationTests": {
      "executed": true,
      "passed": true,
      "totalTests": 6,
      "passedTests": 6
    }
  },
  "errors": []
}
```

### Success Criteria
- Integration tests execute successfully
- All 6 tests pass (0 failures)
- Lifecycle hooks register correctly
- Memory management hook functions
- Activity recommendation injection works
- Metabob context preparation works
- Post-turn cleanup works
- Session memory optimization works
- Impulse learning initialization/flush works
- No errors array entries

### Test File
`repos/metabob-opencode/packages/opencode/test/session/turn-lifecycle-integration.test.ts`

### Note
This test validates that Phase 2b context injection doesn't break existing lifecycle hook infrastructure.
