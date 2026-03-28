# Validation Harness Impulse: metabob-cli-to-dashboard-complete-data-flow

## Metadata
- **Impulse ID**: harness-metabob-cli-to-dashboard-complete-data-flow
- **Type**: file
- **Budget**: 2000 tokens
- **Purpose**: Reference to validation harness for automated testing

## File Pointer
```json
{
  "path": "tests/validation-harnesses/metabob-cli-to-dashboard-complete-data-flow-harness.ts",
  "type": "typescript",
  "lineCount": 580,
  "purpose": "Automated validation harness for E2E data flow testing"
}
```

## Usage

### Run from CLI
```bash
cd tests/validation-harnesses
npx ts-node metabob-cli-to-dashboard-complete-data-flow-harness.ts
```

### Run from code
```typescript
import { runValidation } from './metabob-cli-to-dashboard-complete-data-flow-harness';

const input = {
  apiBaseUrl: 'http://app.metabob.local',
  jwtToken: '<from /tmp/e2e-test-creds.sh>',
  orgId: '<from /tmp/e2e-test-creds.sh>'
};

const result = await runValidation(input);
console.log(result.pass ? 'PASS' : 'FAIL');
```

## Test Cases Covered
1. Project Persistence (validation-metabob-cli-to-dashboard-complete-data-flow-case-1)
2. Problem Persistence (validation-metabob-cli-to-dashboard-complete-data-flow-case-2)
3. Temporal Tracking (validation-metabob-cli-to-dashboard-complete-data-flow-case-3)
4. Data Hierarchy (validation-metabob-cli-to-dashboard-complete-data-flow-case-4)
5. Dashboard Visibility (API simulation)
6. SurrealDB Direct Query (via API)

## Expected Outcomes
- All 6 test cases pass
- No errors in execution
- Project and problem data persist correctly
- Temporal fields have 'Z' suffix
- Data hierarchy maintained

## Integration
This harness can be:
- Run manually for validation
- Integrated into CI/CD pipeline
- Used in automated regression testing
- Referenced in activity validation tasks

## Historical Context
Created to validate fixes for SurrealDB persistence bug:
- Commit adb858a: project_ops.py SQL INSERT
- Commit d5420bf: problem_ops.py SQL INSERT

Verifies specification: metabob-cli-to-dashboard-complete-data-flow
