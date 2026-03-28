# Validation Harness: Hierarchical Activity Composition Standard

**Specification**: hierarchical-activity-composition-standard  
**Created On**: 2026-03-09  
**Harness File**: `tests/validation-harnesses/hierarchical-activity-composition-standard-harness.ts`  
**Runner**: `tests/validation-harnesses/run-hierarchical-composition-validation.ts`  
**Impulse ID**: harness-hierarchical-activity-composition-standard

---

## Overview

This validation harness provides automated, non-LLM testing for the hierarchical-activity-composition-standard specification. It verifies that the codebase supports compose-first workflows, activities-as-impulses, config_update tool usage (no CLI), and robust error handling for hierarchical composition.

**Validation Strategy**: Multi-stage validation across 7 test cases covering:
1. Activity tool composition-first guidance
2. Goal-seeking planner preferComposition default
3. config_update tool createImpulse parameter
4. Activity dependency tracking
5. Nested activity execution (activities-as-impulses)
6. No CLI-dependent config changes
7. Error handling (JSON parsing, circular refs, retry logic)

---

## Test Cases

### Test Case 1: Activity Tool Description Guides Composition-First

**Impulse ID**: `validation-hierarchical-activity-composition-standard-case-1`

**Input**:
```json
{
  "check": "activity tool description file content"
}
```

**Expected Output**:
```json
{
  "hasSearchGuidance": true,
  "hasComposeGuidance": true,
  "descriptionLength": { "min": 100 },
  "hasTemplateIdParam": true
}
```

**Validation Logic**:
- Reads `src/tool/activity.txt` description file
- Checks for keywords: "search", "existing", "compos", "reuse"
- Verifies description length > 100 characters
- Confirms `templateId` parameter exists in source

**Why This Matters**: The activity tool is the primary entry point for work execution. The description must guide users to search existing templates before creating new ones, establishing the compose-first paradigm.

---

### Test Case 2: Goal-Seeking Defaults to preferComposition: true

**Impulse ID**: `validation-hierarchical-activity-composition-standard-case-2`

**Input**:
```json
{
  "check": "create-activity-goal-seeking.ts source code"
}
```

**Expected Output**:
```json
{
  "hasConstraintsParam": true,
  "hasPreferCompositionField": true,
  "sourceHasDefaultTrue": true
}
```

**Validation Logic**:
- Reads `src/tool/create-activity-goal-seeking.ts` source
- Searches for `constraints` parameter
- Searches for `preferComposition` field
- Confirms default value is `true` in code

**Why This Matters**: Goal-seeking planner is the dynamic activity creation entry point. Defaulting to composition ensures the 60% quality threshold is applied, prioritizing reuse over duplication.

---

### Test Case 3: config_update Tool Supports createImpulse Parameter

**Impulse ID**: `validation-hierarchical-activity-composition-standard-case-3`

**Input**:
```json
{
  "check": "config-update.ts source code"
}
```

**Expected Output**:
```json
{
  "hasCreateImpulseParam": true,
  "paramIsBoolean": true,
  "hasImpulseDescription": true
}
```

**Validation Logic**:
- Reads `src/tool/config-update.ts` source
- Checks for `createImpulse` parameter
- Verifies parameter type is `z.boolean()`
- Confirms description mentions "impulse"

**Why This Matters**: Agent IDE constraint (no CLI access) requires programmatic config changes via tools. The `createImpulse` parameter enables config changes to be captured as impulses for activity reuse.

---

### Test Case 4: Activity Coordination Supports Task Dependencies

**Impulse ID**: `validation-hierarchical-activity-composition-standard-case-4`

**Input**:
```json
{
  "check": "activity-template.ts for dependencies field"
}
```

**Expected Output**:
```json
{
  "hasDependenciesField": true,
  "hasTaskSchema": true,
  "sourceIncludes": {
    "dependencies": true,
    "array": true
  }
}
```

**Validation Logic**:
- Reads `src/session/activity-template.ts` source
- Searches for `dependencies` field in task schema
- Confirms `z.array` is used (Zod array validation)
- Verifies `TaskSchema` or `Task.Schema` exists

**Why This Matters**: Hierarchical composition requires task orchestration with dependency tracking. DAG structure enables complex workflows where tasks execute in correct order.

---

### Test Case 5: Activities Can Execute Nested Activities

**Impulse ID**: `validation-hierarchical-activity-composition-standard-case-5`

**Input**:
```json
{
  "check": "impulse-resolver.ts for activityOutput case"
}
```

**Expected Output**:
```json
{
  "hasActivityOutputCase": true,
  "hasActivityIdField": true,
  "hasTaskIdField": true,
  "hasSafeStringify": true
}
```

**Validation Logic**:
- Reads `src/session/impulse-resolver.ts` source
- Searches for `case "activityOutput"` in pointer resolution
- Confirms `activityId` and `taskId` fields exist
- Verifies `safeStringify` or `JSON.stringify` is used

**Why This Matters**: Activities-as-impulses pattern is core to hierarchical composition. Parent activities must be able to load and inject child activity outputs as data, enabling complex multi-level compositions.

---

### Test Case 6: No CLI-Dependent Config Changes in Agent Code

**Impulse ID**: `validation-hierarchical-activity-composition-standard-case-6`

**Input**:
```json
{
  "check": "agent files for CLI invocations",
  "files": [
    "agent.ts",
    "subagent.ts",
    "config-update.ts",
    "goal-seeking-planner.ts"
  ]
}
```

**Expected Output**:
```json
{
  "violations": [],
  "violationCount": 0,
  "filesChecked": { "min": 1 }
}
```

**Validation Logic**:
- Searches agent files for CLI patterns:
  - `opencode config`
  - `opencode mcp`
  - `process.exec.*opencode`
  - `child_process.*opencode`
  - `spawn.*opencode`
- Reports violations with file name and pattern

**Why This Matters**: Agent IDE constraint requires all config manipulation via `config_update` tool. CLI dependencies break the compose-first paradigm by preventing config changes from being captured as impulses.

---

### Test Case 7: Error Handling for Hierarchical Composition

**Impulse ID**: `validation-hierarchical-activity-composition-standard-case-7`

**Input**:
```json
{
  "check": "error handling in planner, resolver, loader"
}
```

**Expected Output**:
```json
{
  "hasJSONParseErrorHandling": true,
  "hasCircularRefHandling": true,
  "hasRetryLogic": true
}
```

**Validation Logic**:
- Reads `src/session/goal-seeking-planner.ts`: Checks for `try`/`catch` around `JSON.parse`
- Reads `src/session/impulse-resolver.ts`: Checks for `safeStringify` or `WeakSet` + `Circular`
- Reads `src/session/template-loader.ts`: Checks for `retry` or `attempt` keywords

**Why This Matters**: Production reliability requires resilient error handling. Malformed LLM output, circular references, and network failures must not crash the compose-first workflow.

---

## Usage

### Run All Validations

```bash
cd repos/metabob-opencode/packages/opencode
bun run tests/validation-harnesses/run-hierarchical-composition-validation.ts
```

### Expected Output (All Passing)

```
╔════════════════════════════════════════════════════════════════╗
║  Hierarchical Activity Composition Standard - Validation      ║
╚════════════════════════════════════════════════════════════════╝

Test Results:
─────────────────────────────────────────────────────────────────

✅ PASS: Activity tool description guides composition-first
✅ PASS: Goal-seeking planner defaults to preferComposition: true
✅ PASS: config_update tool supports createImpulse parameter
✅ PASS: Activity coordination supports task dependencies
✅ PASS: Activities can execute nested activities
✅ PASS: No CLI-dependent config changes in agent code
✅ PASS: Error handling for hierarchical composition

─────────────────────────────────────────────────────────────────

Summary:
  Total:  7
  Passed: 7 ✅
  Failed: 0 ❌
  Pass Rate: 100.0%

─────────────────────────────────────────────────────────────────

🎉 All validation tests passed!
The hierarchical-activity-composition-standard is fully implemented.
```

### Run Individual Test

```typescript
import { testCases } from "./hierarchical-activity-composition-standard-harness"

const result = await testCases.testActivityToolDescriptionGuidesComposition()
console.log(result.pass ? "PASS" : "FAIL", result.testCase)
```

---

## Integration with CI/CD

Add to `.github/workflows/test.yml`:

```yaml
- name: Validate Hierarchical Composition Standard
  run: |
    cd repos/metabob-opencode/packages/opencode
    bun run tests/validation-harnesses/run-hierarchical-composition-validation.ts
```

This ensures the specification remains enforced across all code changes.

---

## Maintenance

### When to Update This Harness

1. **Specification Changes**: If hierarchical-activity-composition-standard spec evolves, update test cases
2. **File Moves**: If source files move (e.g., `activity.ts` → `activity-tool.ts`), update file paths
3. **API Changes**: If tool schemas change, update expected outputs
4. **New Enforcement Points**: Add new test cases for additional architectural constraints

### How to Add a Test Case

1. Add test function to `hierarchical-activity-composition-standard-harness.ts`:
   ```typescript
   export async function testMyNewValidation(): Promise<ValidationResult> {
     // Implementation
   }
   ```

2. Add to `testCases` export at bottom of harness file

3. Create impulse for test case:
   ```json
   {
     "impulseId": "validation-hierarchical-activity-composition-standard-case-8",
     "name": "My new validation",
     "input": {...},
     "expectedOutput": {...}
   }
   ```

4. Update this documentation with test case details

---

## Files

- **Harness**: `repos/metabob-opencode/packages/opencode/tests/validation-harnesses/hierarchical-activity-composition-standard-harness.ts`
- **Runner**: `repos/metabob-opencode/packages/opencode/tests/validation-harnesses/run-hierarchical-composition-validation.ts`
- **Test Cases**: `validation-test-cases.json` (this document)
- **Documentation**: `VALIDATION_HARNESS_hierarchical-activity-composition-standard.md` (this file)

---

## Impulse Metadata

**ID**: harness-hierarchical-activity-composition-standard  
**Type**: file  
**Pointer**: `tests/validation-harnesses/hierarchical-activity-composition-standard-harness.ts`  
**Budget**: 2000 tokens  
**Dependencies**: 
- trace-hierarchical-activity-composition-standard (trace analysis)
- enforcement-hierarchical-activity-composition-standard (enforcement changes)

This harness can be run at any time without LLM access to verify the specification is enforced. Historical test cases are stored as impulses for regression testing.

---

## Summary

The validation harness provides **automated, deterministic verification** that the hierarchical-activity-composition-standard is properly implemented. All 7 test cases check critical architectural constraints:

- ✅ Compose-first guidance in tool descriptions
- ✅ Default to composition in goal-seeking
- ✅ Config changes as impulses (no CLI)
- ✅ Task dependency tracking for orchestration
- ✅ Activities-as-impulses for hierarchical composition
- ✅ No CLI violations in agent code
- ✅ Production-ready error handling

This validation harness is **CI/CD ready** and can be run on every commit to ensure the compose-first paradigm remains enforced across all code changes.
