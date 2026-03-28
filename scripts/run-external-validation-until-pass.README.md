# External Validation Until-Pass Runner

## Overview

This script implements an **iterative until-pass validation workflow** for the OpenCode activity system. It builds the OpenCode distribution and runs external validation tests repeatedly until all tests pass or a maximum iteration limit is reached.

## Purpose

Provides automated proof that the OpenCode activity system works correctly by:

1. Building OpenCode from source
2. Running black-box validation tests via compiled distribution
3. Analyzing test results
4. Prompting for fixes when tests fail
5. Re-running until 100% pass rate achieved
6. Performing meta-validation to ensure test correctness

## Architecture

### Data Flow

```
User Invokes Script
        ↓
    Build Distribution (Step 1)
        ↓
    Verify Binary Exists
        ↓
    ┌─────────────────────┐
    │  Iteration Loop     │
    │  (max 5 times)      │
    └─────────────────────┘
        ↓
    Execute Harness (Step 2)
        ↓
    Analyze Results (Step 3)
        ↓
    All Pass? ──No──→ Prompt for Fixes (Step 4) ──→ Loop Back
        ↓
       Yes
        ↓
    Meta-Validate (Step 5)
        ↓
    Generate Report (Step 6)
        ↓
    Exit (0=success, 1=failure)
```

### Components

1. **Build Integration** (`repos/metabob-opencode/packages/opencode`)
   - Invokes `bun run build`
   - Verifies `dist/opencode-linux-x64/bin/opencode` exists
   - Exits on build failure

2. **Validation Harness** (`tests/validation-harnesses/external-activity-system-validation-harness.ts`)
   - Tests 3 scenarios through compiled distribution only
   - Generates timestamped results in JSON format
   - Provides pass/fail status with evidence

3. **Iteration Logic** (This Script)
   - Loops up to `MAX_ITERATIONS` (default: 5)
   - Tracks iteration count and history
   - Prompts for manual fixes between iterations
   - Exits early on success

4. **Results Analysis** (This Script)
   - Parses `validation-result-<timestamp>.json`
   - Extracts `overallPass`, `passed`, `total`, `metaValidation`
   - Identifies failing test cases
   - Displays evidence and error patterns

## Usage

### Prerequisites

```bash
# Required tools
bun --version          # Bun runtime
node --version         # Node.js
npx --version          # npx (comes with npm)
ts-node --version      # TypeScript executor
```

### Basic Execution

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
bash scripts/run-external-validation-until-pass.sh
```

### Expected Output

#### Iteration 1 (If tests fail)

```
========================================================================
External Activity System Validation - Iterative Runner
========================================================================

Step 1: Building OpenCode distribution...
[Build output...]
✓ Build successful!
Binary location: /path/to/opencode

========================================================================
Starting Iterative Validation
Max Iterations: 5
========================================================================

╔════════════════════════════════════════════════════════════════════╗
║                       ITERATION 1 of 5                             ║
╚════════════════════════════════════════════════════════════════════╝

Executing validation harness...
[Harness output...]

Analyzing results...
Results from: test-results/.../validation-result-1234567890.json
Overall Pass: false
Test Cases: 2/3 passed

✗ Tests failed (2/3 passed)

Failing test cases:
[Failure details...]

Iteration 1 complete with failures.

Please:
1. Review the failure details above
2. Review logs in: test-results/external-validation-harness/
3. Apply fixes to code or test patterns
4. Press ENTER to re-run validation

Ready to continue? (Press ENTER or Ctrl+C to abort) 
```

#### Success (All tests pass)

```
╔════════════════════════════════════════════════════════════════════╗
║                  ✓ ALL TESTS PASSED! ✓                            ║
╚════════════════════════════════════════════════════════════════════╝

Passed on iteration 2

========================================================================
Step 5: Meta-Validation
========================================================================

Verifying test correctness...
Meta-Validation Status: true

Test Evidence Summary:
[Evidence details...]

========================================================================
Final Report
========================================================================

Total Iterations: 2
Final Status: PASSED
Results Directory: test-results/external-validation-harness/
Iteration Log: test-results/.../iteration-history-1234567890.log

External validation harness completed successfully!

This proves:
  ✓ OpenCode distribution builds correctly
  ✓ Activity system can find existing activities
  ✓ Activity system can create new activities via goal-seeking
  ✓ NO direct tool calls occur in root session
  ✓ All operations go through activity-first architecture
```

## Configuration

### Environment Variables

You can override defaults by editing the script:

```bash
# Maximum iterations before giving up
MAX_ITERATIONS=5

# Project directories
WORKSPACE_DIR="/home/avi/documents/work/exp-repo/metabob-devbob"
OPENCODE_DIR="$WORKSPACE_DIR/repos/metabob-opencode/packages/opencode"

# Validation harness location
HARNESS_FILE="$WORKSPACE_DIR/tests/validation-harnesses/external-activity-system-validation-harness.ts"

# Results directory
RESULTS_DIR="$WORKSPACE_DIR/test-results/external-validation-harness"
```

### Iteration Limit

To change the maximum iterations:

```bash
# Edit line 15 of the script
MAX_ITERATIONS=10  # Increase to 10 iterations
```

## Output Files

### 1. Iteration History Log

**Location**: `test-results/external-validation-harness/iteration-history-<timestamp>.log`

**Contents**:
- Complete execution trace
- Build output
- All iteration attempts
- Failure details
- Final report

**Example**:
```
========================================================================
External Activity System Validation - Iterative Runner
========================================================================

Step 1: Building OpenCode distribution...
...
```

### 2. Validation Results

**Location**: `test-results/external-validation-harness/validation-result-<timestamp>.json`

**Format**:
```json
{
  "specificationName": "external-activity-system-validation",
  "timestamp": 1234567890,
  "testCases": [
    {
      "id": "case-1-existing-activity",
      "passed": true,
      "output": { ... }
    },
    ...
  ],
  "summary": {
    "totalTests": 3,
    "passed": 3,
    "failed": 0,
    "overallPass": true
  },
  "metaValidation": {
    "allRequirementsTested": true
  }
}
```

### 3. Raw Command Logs

**Location**: `test-results/external-validation-harness/validation-logs-<timestamp>.txt`

**Contents**: Stdout and stderr from each validation command

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All tests passed within iteration limit |
| `1` | Tests failed after max iterations OR build failed |

## Troubleshooting

### Build Fails

**Error**: `ERROR: Build failed!`

**Solution**:
1. Check that Bun is installed: `bun --version`
2. Navigate to OpenCode dir: `cd repos/metabob-opencode/packages/opencode`
3. Try manual build: `bun run build`
4. Check for TypeScript errors

### Binary Not Found

**Error**: `ERROR: Expected binary not found`

**Solution**:
1. Verify build output location
2. Check platform/architecture: `uname -m`
3. Update `EXPECTED_BINARY` path in script if needed

### Harness Execution Fails

**Error**: `ERROR: No result file found`

**Solution**:
1. Check that ts-node is installed: `npm install -g ts-node`
2. Verify harness file exists
3. Check harness permissions: `ls -la tests/validation-harnesses/`
4. Review temp output: `cat /tmp/harness_output`

### Tests Never Pass

**Issue**: Max iterations reached without success

**Solution**:
1. Review failure patterns in iteration log
2. Check individual test case failures
3. Analyze forbidden pattern matches
4. Fix code issues identified by tests
5. Update test patterns if they're incorrect

## Meta-Validation

After tests pass, the script performs **meta-validation** to ensure the tests correctly validate the activity system.

### Checks Performed

1. **testedCompiledDistribution**: Verifies tests used compiled binary (not dev code)
2. **testedExistingActivity**: Confirms test case 1 executed
3. **testedGoalSeeking**: Confirms test case 2 executed
4. **testedNoDirectTools**: Confirms test case 3 executed
5. **testedLogAnalysis**: Confirms evidence was generated
6. **allRequirementsTested**: All above checks passed

### What to Do If Meta-Validation Fails

If `allRequirementsTested: false`, review:
- Test case definitions in harness
- Log pattern matching logic
- Expected vs forbidden pattern lists
- Evidence collection code

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: External Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      
      - name: Install Dependencies
        run: npm install -g ts-node
      
      - name: Run Validation
        run: bash scripts/run-external-validation-until-pass.sh
        
      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: validation-results
          path: test-results/external-validation-harness/
```

## Related Files

- **Validation Harness**: `tests/validation-harnesses/external-activity-system-validation-harness.ts`
- **Harness README**: `tests/validation-harnesses/external-activity-system-validation-harness.README.md`
- **Build Script**: `repos/metabob-opencode/packages/opencode/script/build.ts`
- **Results Directory**: `test-results/external-validation-harness/`

## Implementation Details

### Gaps Addressed

This script addresses 5 critical gaps identified in the trace analysis:

1. ✅ **No iterative loop**: Implemented while loop with max iterations
2. ✅ **No fix application logic**: Interactive prompts between iterations
3. ✅ **No build integration**: Builds distribution as first step
4. ✅ **No meta-validation review**: Checks `allRequirementsTested` after pass
5. ✅ **No iteration tracking**: Logs all attempts to timestamped file

### Design Decisions

**Why Shell Script?**
- Simple, portable, no dependencies beyond bash
- Easy to understand and modify
- Direct integration with existing tools (bun, npx, ts-node)
- Can be run manually or in CI/CD

**Why Manual Fix Prompts?**
- Allows human judgment on what fixes to apply
- Prevents infinite loops of bad automated fixes
- Provides visibility into failure patterns
- Maintains control over code changes

**Why Max 5 Iterations?**
- Prevents infinite loops
- Forces investigation after repeated failures
- Balances automation with manual intervention

## Success Criteria

The script succeeds when:

1. ✅ OpenCode distribution builds without errors
2. ✅ Validation harness executes successfully
3. ✅ All 3 test cases pass (100% pass rate)
4. ✅ No forbidden patterns found in logs
5. ✅ All expected patterns found in logs
6. ✅ `overallPass: true` in results
7. ✅ `allRequirementsTested: true` in meta-validation

## Next Steps After Success

Once validation passes:

1. **Review Results**: Examine evidence in results directory
2. **Commit Changes**: If fixes were applied, commit them
3. **Update Documentation**: Document any insights or issues found
4. **Run in CI**: Integrate script into continuous integration pipeline
5. **Monitor**: Track pass rates over time to detect regressions

## Support

For issues or questions:

1. Check the iteration log for detailed error messages
2. Review the validation harness README
3. Examine individual test case outputs
4. Consult the trace analysis for architecture details

---

**Created**: 2026-03-18  
**Author**: OpenCode Enforcement System  
**Related**: `trace-run-external-validation-until-pass` impulse
