# Validation Harness: DevBob Provider Initialization

## Overview

This validation harness tests that the Anthropic provider initializes successfully in the DevBob pod and can execute commands without `ProviderInitError`.

**Strategy**: kubectl exec test showing successful provider init and command execution

## Harness File

**Location**: `tests/validation-harnesses/devbob-provider-initialization-harness.ts`

**Type**: Automated validation script (no LLM required)

**Language**: TypeScript (Bun runtime)

## Test Cases

### Case 1: Provider Initialization Check
- **Input**: `opencode --version`
- **Expected Output**: Version string starting with "0.0.0-dev-"
- **Validation**: OpenCode binary runs without crashing
- **Impulse**: `validation-devbob-provider-initialization-case-1.json`

### Case 2: Config File Validation  
- **Input**: Check `/workspace/.config/opencode/opencode.json` exists and contains anthropic config
- **Expected Output**: "Config valid"
- **Validation**: Config file exists, is readable, and contains provider configuration
- **Impulse**: `validation-devbob-provider-initialization-case-2.json`

### Case 3: API Key Substitution
- **Input**: Check config file for template syntax `${ANTHROPIC_API_KEY}`
- **Expected Output**: "API key substituted"
- **Validation**: Environment variable was substituted, not left as template
- **Impulse**: `validation-devbob-provider-initialization-case-3.json`

### Case 4: SDK Package Installation
- **Input**: Check `/root/.cache/opencode/node_modules/@ai-sdk/anthropic/package.json` exists
- **Expected Output**: "Installed"
- **Validation**: SDK package is installed and accessible
- **Impulse**: `validation-devbob-provider-initialization-case-4.json`

### Case 5: OpenCode Run (Optional)
- **Input**: `opencode run "What is 2+2? Answer in one word."`
- **Expected Output**: "Command completed successfully"
- **Validation**: Command executes without ProviderInitError
- **Impulse**: Embedded in harness (optional test case parameter)

## Usage

### CLI Execution
```bash
bun tests/validation-harnesses/devbob-provider-initialization-harness.ts
```

### Programmatic Usage
```typescript
import { runValidation } from './tests/validation-harnesses/devbob-provider-initialization-harness.ts';

const testCase = {
  name: "Simple arithmetic test",
  input: "What is 2+2? Answer in one word.",
  expectedOutput: "Command completed successfully",
  expectedExitCode: 0,
  timeout: 30
};

const result = await runValidation(testCase);

if (result.pass) {
  console.log("✅ All validations passed");
} else {
  console.log("❌ Some validations failed");
  console.log(result.results);
}
```

### CI/CD Integration
```yaml
# Example GitHub Actions workflow
- name: Validate DevBob Provider
  run: |
    bun tests/validation-harnesses/devbob-provider-initialization-harness.ts
  env:
    KUBECONFIG: ${{ secrets.KUBECONFIG }}
```

## Output Format

### Success Case
```
🔍 DevBob Provider Initialization Validation Harness
============================================================

📍 Finding DevBob pod...
   ✓ Found pod: devbob-89d4997f6-4t4w6

🧪 Test 1: Provider Initialization Check
   ✓ PASS: 0.0.0-dev-202603030904

🧪 Test 2: Config File Validation
   ✓ PASS: Config valid

🧪 Test 3: API Key Substitution
   ✓ PASS: API key substituted

🧪 Test 4: SDK Package Installation
   ✓ PASS: Installed

🧪 Test 5: OpenCode Run - "Simple arithmetic test"
   ✓ PASS: Command completed successfully

============================================================
📊 Results: 5/5 tests passed
✅ ALL TESTS PASSED
============================================================
```

### Failure Case
```
🔍 DevBob Provider Initialization Validation Harness
============================================================

📍 Finding DevBob pod...
   ✓ Found pod: devbob-89d4997f6-4t4w6

🧪 Test 1: Provider Initialization Check
   ✗ FAIL: OpenCode version output unexpected

🧪 Test 2: Config File Validation
   ✓ PASS: Config valid

🧪 Test 3: API Key Substitution
   ✗ FAIL: Template found

🧪 Test 4: SDK Package Installation
   ✓ PASS: Installed

🧪 Test 5: OpenCode Run - "Simple arithmetic test"
   ✗ FAIL: ProviderInitError detected

============================================================
📊 Results: 2/5 tests passed
❌ SOME TESTS FAILED
============================================================
```

## Return Values

### `runValidation(testCase?)` Returns:
```typescript
{
  pass: boolean,              // Overall pass/fail status
  results: Record<string, ValidationResult>,  // Detailed results per test
  summary: string            // Human-readable summary
}
```

### `ValidationResult` Structure:
```typescript
{
  pass: boolean,
  actual: string,
  expected: string,
  error?: string,
  details?: Record<string, any>
}
```

## Exit Codes

- **0**: All validations passed
- **1**: One or more validations failed

## Prerequisites

1. **kubectl**: Must be installed and configured
2. **Namespace**: DevBob must be deployed in `metabob` namespace
3. **Pod Labels**: DevBob pod must have label `app.kubernetes.io/name=devbob`
4. **Bun Runtime**: Required to execute TypeScript harness

## Integration with Trace-Enforce-Validate Loop

This harness is designed to be used in the validation phase of the trace-enforce-validate loop:

1. **Trace**: `trace-devbob-provider-initialization` impulse identifies root causes
2. **Enforce**: Changes applied to Helm chart (`enforcement-devbob-provider-initialization`)
3. **Validate**: This harness confirms fixes work (`harness-devbob-provider-initialization`)

## Troubleshooting

### "No DevBob pod found"
- Check pod is running: `kubectl get pods -n metabob -l app.kubernetes.io/name=devbob`
- Verify namespace and labels match

### "Command timed out"
- OpenCode may be hanging due to provider initialization issues
- Check pod logs: `kubectl logs -n metabob <pod-name>`
- Review initContainer logs: `kubectl logs -n metabob <pod-name> -c setup-config`

### "ProviderInitError detected"
- Enforcement fixes not yet deployed
- Check config file has actual API key: `kubectl exec -n metabob <pod> -- cat /workspace/.config/opencode/opencode.json | grep apiKey`
- Verify initContainer ran successfully

## Impulse References

- **Harness**: `impulses/harness-devbob-provider-initialization.json`
- **Test Case 1**: `impulses/validation-devbob-provider-initialization-case-1.json`
- **Test Case 2**: `impulses/validation-devbob-provider-initialization-case-2.json`
- **Test Case 3**: `impulses/validation-devbob-provider-initialization-case-3.json`
- **Test Case 4**: `impulses/validation-devbob-provider-initialization-case-4.json`

## Related Documentation

- **Trace Analysis**: `TRACE_DEVBOB_PROVIDER_INITIALIZATION.md`
- **Enforcement Summary**: `ENFORCEMENT_DEVBOB_PROVIDER_INITIALIZATION.md`
- **Specification**: From calling agent context

