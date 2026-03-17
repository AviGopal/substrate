# Validation Harnesses

Automated test harnesses for validating deployed specifications without requiring LLM inference.

## Purpose

Validation harnesses are deterministic test suites that:
- Load deployed applications/components
- Feed in predefined test inputs
- Capture actual outputs
- Compare against expected outputs stored as impulses
- Return PASS/FAIL results

Unlike traditional tests, these harnesses:
- ✅ Are **historical** - can be run without LLM
- ✅ Test **deployed systems** - not just code
- ✅ Validate **specifications** - not just unit functionality
- ✅ Store expectations as **impulses** - reusable across sessions

## Available Harnesses

### surrealdb-namespace-configuration-harness.ts

Validates that Activity API connects to SurrealDB in the correct namespace.

**Quick Start:**
```bash
ts-node tests/validation-harnesses/surrealdb-namespace-configuration-harness.ts
```

**What it validates:**
- ConfigMap has correct namespace configuration
- Pod environment variable set correctly
- SurrealDB connection succeeds
- /v2/activities/templates endpoint returns HTTP 200
- Logs show correct namespace usage

**Exit codes:**
- `0` - All validations passed
- `1` - Validation failed (configuration issue)
- `2` - Setup error (K8s not accessible, pod not ready)

**Related impulses:**
- `harness-surrealdb-namespace-configuration.md` - Harness documentation
- `validation-surrealdb-namespace-configuration-case-*.md` - Test cases

---

## Creating New Harnesses

### 1. Define Test Cases as Impulses

Create impulses with expected inputs/outputs:

```markdown
# impulses/validation-myspec-case-1.md

## Test Input
Description of input

## Expected Output
Description of expected output

## Success Criteria
- Criterion 1
- Criterion 2
```

### 2. Create Harness File

```typescript
// tests/validation-harnesses/myspec-harness.ts

export interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: any;
  error?: string;
  details?: string;
}

async function testCase1(): Promise<ValidationResult> {
  // 1. Load application/component
  // 2. Feed test input
  // 3. Capture actual output
  // 4. Compare against expected
  
  return {
    pass: actualOutput === expectedOutput,
    actual: actualOutput,
    expected: expectedOutput
  };
}

export async function runValidation() {
  const results = [];
  
  // Run test cases
  results.push(await testCase1());
  // ... more test cases
  
  // Report results
  const allPassed = results.every(r => r.pass);
  process.exit(allPassed ? 0 : 1);
}

if (require.main === module) {
  runValidation();
}
```

### 3. Create Harness Documentation Impulse

```markdown
# impulses/harness-myspec.md

## Purpose
What this harness validates

## Test Cases
List of test cases with impulse IDs

## Usage
How to run the harness

## Expected Behavior
What passing validation looks like
```

### 4. Add to CI/CD

```yaml
# .github/workflows/validate-deployment.yml
- name: Validate MySpec
  run: ts-node tests/validation-harnesses/myspec-harness.ts
```

---

## Harness Design Principles

### 1. Deterministic
- No randomness or LLM inference
- Same input always produces same output
- Can be run repeatedly for CI/CD

### 2. Historical
- Test cases stored as impulses
- Expected outputs captured from successful runs
- Can be replayed without original context

### 3. Specification-Focused
- Tests specifications, not just code
- Validates deployed system behavior
- Covers infrastructure + application + API layers

### 4. Self-Contained
- Each harness is independent
- Includes pre-flight checks
- Clear error messages for debugging

### 5. CI/CD Friendly
- Exit codes indicate status
- Structured output for parsing
- Can run in automated pipelines

---

## Integration Patterns

### Run in K8s Job

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: validate-surrealdb-namespace
spec:
  template:
    spec:
      containers:
      - name: validator
        image: node:18
        command: ["ts-node", "tests/validation-harnesses/surrealdb-namespace-configuration-harness.ts"]
      restartPolicy: Never
```

### Run in GitHub Actions

```yaml
- name: Checkout
  uses: actions/checkout@v3
  
- name: Setup Node
  uses: actions/setup-node@v3
  with:
    node-version: '18'
    
- name: Install Dependencies
  run: npm install -g ts-node typescript

- name: Run Validation
  run: ts-node tests/validation-harnesses/surrealdb-namespace-configuration-harness.ts
```

### Programmatic Use

```typescript
import { runValidation, ValidationResult } from './surrealdb-namespace-configuration-harness';

// Run all validations
const results = await runValidation();

// Check specific test
if (results.configMapTest.pass) {
  console.log('ConfigMap is correct');
}
```

---

## Troubleshooting

### Harness exits with code 2

**Cause:** Pre-flight checks failed  
**Solution:** 
- Verify kubectl is installed and configured
- Check K8s cluster is accessible
- Ensure pods are in Running state

### Harness exits with code 1

**Cause:** Validation failed  
**Solution:**
- Check harness output for failed test details
- Review related specification documentation
- Re-deploy with correct configuration

### Port-forward fails

**Cause:** Service not accessible or port in use  
**Solution:**
- Check service exists: `kubectl get svc -n <namespace>`
- Kill existing port-forward: `pkill -f "kubectl port-forward"`
- Try different port

---

## Best Practices

1. **Keep test cases atomic** - Each test should validate one specific thing
2. **Use clear assertions** - Expected outputs should be unambiguous
3. **Include context in errors** - Help users understand what went wrong
4. **Add pre-flight checks** - Fail fast if environment not ready
5. **Document expected behavior** - Store as impulses for historical reference
6. **Version test cases** - Update impulses when specifications change

---

## Related Documentation

- **Impulses System:** Core concept for storing test expectations
- **Specification Enforcement:** How specifications are applied
- **Activity Validation:** Broader validation framework
