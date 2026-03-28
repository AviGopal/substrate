# Validation Harness: vessel-repository-independence

**Created:** 2026-03-16  
**Type:** Deterministic Static Analysis (No LLM Required)  
**Harness File:** `tests/validation-harnesses/vessel-repository-independence-harness.ts`  
**Impulse:** `harness-vessel-repository-independence`

---

## Overview

This validation harness provides **automated, deterministic validation** of the vessel-repository-independence specification without requiring LLM intervention. It performs static analysis to verify architectural boundaries between the three vessels (MiniBob, Activity API, Dashboard).

---

## Test Cases

### Test Case 1: No Activity API Imports in Other Vessels ✅ CRITICAL

**Impulse:** `validation-vessel-repository-independence-case-1`

```typescript
{
  searchPattern: "from.*metabob-activity-api|import.*metabob-activity-api",
  searchPaths: ["repos/minibob", "repos/activity-dashboard"],
  expectedOutput: { matchCount: 0 }
}
```

**Validation:** Searches for any import statements referencing `metabob-activity-api` in MiniBob or Dashboard codebases.

**Expected Result:** 0 matches (vessels must use HTTP/REST, not code imports)

---

### Test Case 2: No MiniBob Imports in Other Vessels ✅ CRITICAL

**Impulse:** `validation-vessel-repository-independence-case-2`

```typescript
{
  searchPattern: "from.*minibob|import.*minibob",
  searchPaths: ["repos/metabob-activity-api", "repos/activity-dashboard"],
  expectedOutput: { matchCount: 0 }
}
```

**Validation:** Searches for any import statements referencing `minibob` in Activity API or Dashboard codebases.

**Expected Result:** 0 matches (vessels must be independent)

---

### Test Case 3: No Dashboard Imports in Other Vessels ✅ CRITICAL

**Impulse:** `validation-vessel-repository-independence-case-3`

```typescript
{
  searchPattern: "from.*activity-dashboard|import.*activity-dashboard",
  searchPaths: ["repos/metabob-activity-api", "repos/minibob"],
  expectedOutput: { matchCount: 0 }
}
```

**Validation:** Searches for any import statements referencing `activity-dashboard` in Activity API or MiniBob codebases.

**Expected Result:** 0 matches (vessels must be independent)

---

### Test Case 4: Self-Contained Helm Charts ✅ CRITICAL

**Impulse:** `validation-vessel-repository-independence-case-4`

```typescript
{
  helmChartPaths: [
    "repos/metabob-activity-api/helm/activity-api/Chart.yaml",
    "repos/activity-dashboard/helm/Chart.yaml",
    "repos/minibob/helm/minibob-cluster/Chart.yaml"
  ],
  expectedOutput: { allChartsExist: true, chartCount: 3 }
}
```

**Validation:** Checks filesystem for existence of Helm Chart.yaml files in each vessel repository.

**Expected Result:** All 3 Helm charts exist

---

### Test Case 5: Dashboard HTTP Communication ✅ CRITICAL

**Impulse:** `validation-vessel-repository-independence-case-5`

```typescript
{
  searchPattern: "fetch\\(|axios\\.|http\\.",
  searchPaths: ["repos/activity-dashboard/src"],
  minimumMatches: 1,
  expectedOutput: { hasHttpCalls: true }
}
```

**Validation:** Searches Dashboard source code for HTTP/REST API calls (fetch, axios, http).

**Expected Result:** At least 1 HTTP call found (Dashboard uses REST API)

---

### Test Case 6: Independent Dockerfiles ⚠️ HIGH

**Impulse:** `validation-vessel-repository-independence-case-6`

```typescript
{
  dockerfilePaths: [
    "repos/metabob-activity-api/Dockerfile",
    "repos/activity-dashboard/Dockerfile",
    "repos/minibob/Dockerfile"
  ],
  expectedOutput: { allDockerfilesExist: true, dockerfileCount: 3 }
}
```

**Validation:** Checks filesystem for existence of Dockerfile in each vessel repository.

**Expected Result:** All 3 Dockerfiles exist

---

## Usage

### CLI Execution

```bash
# Run from repository root
npx ts-node tests/validation-harnesses/vessel-repository-independence-harness.ts
```

**Output:**
```
🔍 Vessel Repository Independence Validation

Loaded 6 test cases

✅ [CRITICAL] No imports from Activity API in other vessels
   ✅ No cross-vessel imports found (expected: 0, actual: 0)

✅ [CRITICAL] No imports from MiniBob in other vessels
   ✅ No cross-vessel imports found (expected: 0, actual: 0)

✅ [CRITICAL] No imports from Dashboard in other vessels
   ✅ No cross-vessel imports found (expected: 0, actual: 0)

✅ [CRITICAL] Self-contained Helm charts exist
   ✅ All 3 Helm charts exist

✅ [CRITICAL] Dashboard HTTP-only communication
   ✅ Found 15 HTTP/REST API calls (minimum: 1)

✅ [HIGH] Independent Dockerfiles exist
   ✅ All 3 Dockerfiles exist

────────────────────────────────────────────────────────────────────────────────

📊 Summary: 6/6 tests passed (100.0%)

✅ All tests passed - vessel independence ENFORCED
```

### Programmatic Usage

```typescript
import { runAllValidations, loadTestCases } from './tests/validation-harnesses/vessel-repository-independence-harness';

// Load test cases from impulse files
const testCases = loadTestCases('./impulses');

// Run all validations
const { summary, results } = runAllValidations(testCases);

console.log(`Pass rate: ${summary.passRate}%`);
console.log(`Passed: ${summary.passed}/${summary.total}`);

// Check individual results
results.forEach(result => {
  if (!result.pass) {
    console.error(`FAILED: ${result.testName}`);
    console.error(`Details: ${result.details}`);
  }
});
```

---

## Integration with CI/CD

### GitHub Actions Workflow

```yaml
name: Validate Vessel Independence

on:
  pull_request:
    paths:
      - 'repos/**'
  push:
    branches:
      - main

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install -g ts-node typescript
      
      - name: Run validation harness
        run: npx ts-node tests/validation-harnesses/vessel-repository-independence-harness.ts
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Validating vessel repository independence..."
npx ts-node tests/validation-harnesses/vessel-repository-independence-harness.ts

if [ $? -ne 0 ]; then
  echo "❌ Vessel independence validation FAILED"
  echo "Fix architectural boundary violations before committing"
  exit 1
fi

echo "✅ Vessel independence validation PASSED"
```

---

## Architecture

### Harness Components

```
vessel-repository-independence-harness.ts
├── Types
│   ├── ValidationInput
│   ├── ValidationExpectedOutput
│   ├── ValidationResult
│   └── TestCase
├── Validation Functions
│   ├── searchPattern() - ripgrep/grep pattern matching
│   ├── searchPatternWithGrep() - fallback grep
│   └── checkFilesExist() - filesystem verification
├── Test Case Validators
│   ├── validateNoCrossVesselImports()
│   ├── validateHelmChartsExist()
│   ├── validateDockerfilesExist()
│   └── validateHttpCommunication()
├── Main Validation Runner
│   ├── runValidation() - single test case
│   ├── runAllValidations() - all test cases
│   └── loadTestCases() - impulse file loading
└── CLI Entry Point
    └── main() - command-line execution
```

### Tools Used

1. **ripgrep (rg)**: Fast pattern matching (primary)
2. **grep**: Fallback pattern matching
3. **fs (Node.js)**: Filesystem checks

---

## Test Case Format

Test cases are stored as impulse files in `impulses/` directory:

```json
{
  "id": "validation-vessel-repository-independence-case-N",
  "type": "memo",
  "description": "Test case description",
  "content": {
    "testName": "Human-readable test name",
    "input": {
      "searchPattern": "regex pattern",
      "searchPaths": ["path1", "path2"],
      "excludePaths": ["node_modules", "dist"]
    },
    "expectedOutput": {
      "matchCount": 0,
      "pass": true,
      "reason": "Why this is expected"
    }
  },
  "metadata": {
    "category": "architectural-boundary",
    "severity": "CRITICAL"
  }
}
```

---

## Validation Categories

### Architectural Boundary (CRITICAL)
- Test Case 1: No Activity API imports
- Test Case 2: No MiniBob imports
- Test Case 3: No Dashboard imports

### Deployment Independence (CRITICAL/HIGH)
- Test Case 4: Self-contained Helm charts
- Test Case 6: Independent Dockerfiles

### HTTP Communication (CRITICAL)
- Test Case 5: Dashboard HTTP-only communication

---

## Exit Codes

- **0**: All tests passed - vessel independence enforced
- **1**: One or more tests failed - vessel independence violated

---

## Benefits

### 1. **No LLM Required**
- Deterministic static analysis
- Fast execution (< 5 seconds)
- Low cost (no API calls)

### 2. **Historical Test Cases**
- Test cases stored as impulses
- Reusable across sessions
- Version controlled

### 3. **CI/CD Integration**
- Pre-commit hooks
- GitHub Actions workflows
- Automated enforcement

### 4. **Developer Feedback**
- Clear pass/fail results
- Specific violation details
- Actionable error messages

---

## Maintenance

### Adding New Test Cases

1. Create impulse file: `impulses/validation-vessel-repository-independence-case-N.json`
2. Define test input and expected output
3. Update `loadTestCases()` function to include new case count
4. Run harness to verify new test case

### Updating Existing Test Cases

1. Modify impulse file in `impulses/` directory
2. Test cases are automatically reloaded on next execution
3. No code changes required

---

## Related Artifacts

- **Trace Impulse:** `impulses/trace-vessel-repository-independence.json`
- **Enforcement Impulse:** `impulses/enforcement-vessel-repository-independence.json`
- **Harness Impulse:** `impulses/harness-vessel-repository-independence.json`
- **Test Case Impulses:** `impulses/validation-vessel-repository-independence-case-[1-6].json`

---

**Status:** ✅ **READY FOR USE**

The validation harness is production-ready and can be integrated into CI/CD pipelines to enforce vessel-repository-independence specification automatically.
