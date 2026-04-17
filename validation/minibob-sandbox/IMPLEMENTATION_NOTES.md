# Sandbox Implementation Notes

## Current Status

**Phase:** Mock Implementation (Ready for Integration)

The sandbox environment is fully structured but requires integration with the actual MiniBob execution system.

## What's Complete

### 1. Environment Setup ✓

- **sandbox.config.json** - Configuration with environment variable substitution
- **setup.sh** - Automated workspace initialization
- **workspace/** - Sample files for resolver testing
- **Git repository** - Initialized with sample commits

### 2. Test Definitions ✓

- **validation-tests.json** - 12 comprehensive test scenarios
- Coverage of all resolver types
- Priority-based test filtering
- Expected outcomes and validation rules

### 3. Test Runner Structure ✓

- **run-validation.ts** - Test execution framework
- Report generation
- Metrics tracking
- Trace submission logic

### 4. Documentation ✓

- **README.md** - Complete usage guide
- **IMPLEMENTATION_NOTES.md** - This file
- **.gitignore** - Proper exclusions

### 5. Utilities ✓

- **collect-traces.sh** - Quick trace collection
- Report formatting
- Summary generation

## What Needs Integration

### 1. Goal Execution (HIGH PRIORITY)

**File:** `run-validation.ts`, function `mockExecuteGoal()`

**Current State:**
```typescript
async function mockExecuteGoal(
  test: ValidationTest,
  config: SandboxConfig,
): Promise<ActivityExecution> {
  // TODO: Call actual MiniBob goal processor here
  return {
    id: `exec_${Date.now()}_mock`,
    templateId: test.templateId || "improvised",
    status: "completed",
    // ... mock data
  };
}
```

**Required Integration:**
```typescript
import { processGoal } from "../src/goal-processor";
import { executeActivity } from "../src/activity";
import { loadConfig } from "../src/config";

async function executeGoal(
  test: ValidationTest,
  sandboxConfig: SandboxConfig,
): Promise<ActivityExecution> {
  // Load MiniBob config
  const minibobConfig = await loadConfig();

  // Override with sandbox settings
  minibobConfig.workingDirectory = sandboxConfig.workingDirectory;
  minibobConfig.apiKey = sandboxConfig.llm.apiKey;

  // Execute based on test type
  if (test.type === "goal") {
    return await processGoal(test.goal!, {
      workingDirectory: sandboxConfig.workingDirectory,
      expectedOutputShapes: test.expectedOutcomes.map(o =>
        inferShapeFromOutcome(o)
      ),
    });
  } else if (test.type === "activity") {
    const template = await loadTemplate(test.templateId!);
    return await executeActivity(template, test.variables || {}, minibobConfig);
  } else if (test.type === "bootstrap") {
    // Bootstrap execution with no prior impulses
    return await processGoal(test.goal!, {
      workingDirectory: sandboxConfig.workingDirectory,
      bootstrapMode: true,
    });
  }

  throw new Error(`Unknown test type: ${test.type}`);
}
```

**Dependencies:**
- `../src/goal-processor.ts` - processGoal function
- `../src/activity.ts` - executeActivity function
- `../src/config.ts` - loadConfig function

### 2. Outcome Validation (MEDIUM PRIORITY)

**File:** `run-validation.ts`, function `validateOutcomes()`

**Current State:**
```typescript
async function validateOutcomes(
  test: ValidationTest,
  execution: ActivityExecution,
): Promise<string[]> {
  // TODO: Implement actual outcome validation
  return test.expectedOutcomes;
}
```

**Required Implementation:**
```typescript
import { existsSync, readFileSync } from "fs";
import { join } from "path";

async function validateOutcomes(
  test: ValidationTest,
  execution: ActivityExecution,
  workspaceDir: string,
): Promise<string[]> {
  const achieved: string[] = [];
  const validation = test.validation;

  // Check required files
  if (validation.requiredFiles) {
    const allFilesExist = validation.requiredFiles.every(file =>
      existsSync(join(workspaceDir, file))
    );
    if (allFilesExist) {
      achieved.push("Required files created");
    }
  }

  // Check required patterns
  if (validation.requiredPatterns) {
    for (const { file, pattern } of validation.requiredPatterns) {
      const filePath = join(workspaceDir, file);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, "utf-8");
        if (new RegExp(pattern).test(content)) {
          achieved.push(`Pattern found in ${file}`);
        }
      }
    }
  }

  // Check output exists
  if (validation.requireOutput) {
    const hasOutput = execution.taskResults.some(
      r => r.output && r.output.length > 0
    );
    if (hasOutput) {
      achieved.push("Output generated");
    }
  }

  // Check ribosome extraction
  if (validation.checkRibosomeExtraction) {
    const hasTemplate = execution.executionTrace?.tasks.some(
      t => t.metadata?.ribosomeExtracted
    );
    if (hasTemplate) {
      achieved.push("Template extracted");
    }
  }

  // Check Thompson metadata
  if (validation.checkThompsonMetadata) {
    const hasThompsonData = execution.metadata?.thompsonSampling;
    if (hasThompsonData) {
      achieved.push("Thompson Sampling metadata present");
    }
  }

  return achieved;
}
```

### 3. Resolver Detection (MEDIUM PRIORITY)

**File:** `run-validation.ts`, function `extractResolversUsed()`

**Current State:**
```typescript
function extractResolversUsed(execution: ActivityExecution): string[] {
  // TODO: Extract actual resolvers from execution trace
  return ["MockResolver"];
}
```

**Required Implementation:**
```typescript
function extractResolversUsed(execution: ActivityExecution): string[] {
  const resolvers = new Set<string>();

  if (!execution.executionTrace) return [];

  // Extract from task metadata
  execution.executionTrace.tasks.forEach(task => {
    if (task.metadata?.resolver) {
      resolvers.add(task.metadata.resolver);
    }

    // Extract from tool calls (fallback)
    task.toolCalls.forEach(tool => {
      if (tool.name.endsWith("Resolver")) {
        resolvers.add(tool.name);
      }
    });
  });

  return Array.from(resolvers);
}
```

### 4. Trace Submission (LOW PRIORITY)

**File:** `run-validation.ts`, function `submitTrace()`

**Current State:**
```typescript
async function submitTrace(
  trace: ExecutionTrace,
  config: SandboxConfig,
): Promise<void> {
  // TODO: Submit trace to backend
  console.log(`  📊 Trace submitted to ${config.backend.endpoint}`);
}
```

**Required Implementation:**
```typescript
async function submitTrace(
  trace: ExecutionTrace,
  config: SandboxConfig,
): Promise<void> {
  const endpoint = `${config.backend.endpoint}/v2/activities/execution-traces`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `ApiKey ${config.backend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(trace),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to submit trace: ${response.status} ${response.statusText}`
    );
  }

  console.log(`  📊 Trace submitted to ${config.backend.endpoint}`);
}
```

## Integration Checklist

### Phase 1: Basic Execution
- [ ] Import MiniBob goal processor
- [ ] Replace mockExecuteGoal with real execution
- [ ] Test with simple goal (test-001)
- [ ] Verify execution completes
- [ ] Check trace is generated

### Phase 2: Validation
- [ ] Implement outcome validation
- [ ] Check file existence
- [ ] Check pattern matching
- [ ] Test with file operation goal
- [ ] Verify outcomes are correctly identified

### Phase 3: Resolver Detection
- [ ] Extract resolver names from trace
- [ ] Count resolver usage
- [ ] Calculate success rates
- [ ] Test with multiple resolvers
- [ ] Verify statistics are accurate

### Phase 4: Trace Submission
- [ ] Implement backend submission
- [ ] Add authentication header
- [ ] Handle errors gracefully
- [ ] Test submission to canary
- [ ] Verify traces appear in backend

### Phase 5: Full Validation
- [ ] Run all 12 tests
- [ ] Verify all resolvers tested
- [ ] Check Thompson Sampling integration
- [ ] Validate ribosome extraction
- [ ] Confirm trace collection works

## Testing Strategy

### 1. Incremental Integration

Start with simplest test and add complexity:

1. **test-001** - Simple file operation
   - Tests: GoalAnalysisResolver, FileResolver
   - Minimal LLM usage
   - Fast execution

2. **test-005** - Activity composition
   - Tests: ActivityExecutorResolver
   - Uses existing template
   - Moderate complexity

3. **test-011** - Thompson Sampling
   - Tests: Backend integration
   - Activity recommendation
   - Full execution path

4. **Full Suite** - All 12 tests
   - Comprehensive validation
   - All resolvers tested
   - Complete metrics

### 2. Validation Levels

**Level 1: Smoke Test**
- Run test-001 only
- Verify basic execution works
- Check trace is generated
- Duration: ~15s

**Level 2: Core Tests**
- Run high-priority tests (5 tests)
- Cover main resolvers
- Validate key features
- Duration: ~60s

**Level 3: Full Suite**
- Run all 12 tests
- Complete resolver coverage
- Edge cases and error handling
- Duration: ~5 minutes

### 3. Metrics to Track

**Per Test:**
- Execution time vs expected duration
- Cost vs budget
- Resolver accuracy (expected vs actual)
- Outcome achievement rate

**Aggregate:**
- Overall success rate (target: > 80%)
- Total cost per run
- Average test duration
- Trace submission success rate (target: 100%)

## Known Limitations

### 1. Mock Implementation

Currently, all tests return mock data. Real execution will:
- Take longer (LLM calls)
- Cost money (API usage)
- May fail (network issues, LLM errors)
- Produce real artifacts (files, commits)

### 2. Workspace Isolation

Tests run in shared workspace. Consider:
- Reset workspace between tests
- Use separate directories per test
- Git stash/reset between runs
- Clean up generated files

### 3. Backend Dependency

Requires production backend:
- Network connectivity
- Valid API key
- Backend availability
- Sufficient quota

### 4. Non-Deterministic Behavior

LLM-based tests may:
- Produce different outputs each run
- Fail intermittently
- Take varying amounts of time
- Use different amounts of tokens

## Future Enhancements

### 1. Continuous Integration

Run sandbox tests in CI/CD:
- On pull requests
- Before deployment
- Nightly for trace collection
- Weekly for full validation

### 2. Performance Benchmarking

Track metrics over time:
- Test duration trends
- Cost per test trends
- Success rate trends
- Resolver efficiency

### 3. Automated Template Extraction

After successful improvisation:
- Automatically extract template
- Register with backend
- Add to local cache
- Re-run test to validate

### 4. Parallel Execution

Run independent tests in parallel:
- Faster total duration
- More efficient resource usage
- Earlier failure detection
- Better CI/CD integration

## Related Documentation

- [../src/goal-processor.ts](../src/goal-processor.ts) - Goal processing logic
- [../src/activity.ts](../src/activity.ts) - Activity execution
- [../src/resolvers/](../src/resolvers/) - Resolver implementations
- [../../docs/UNIFIED_EXECUTION_PATH.md](../../docs/UNIFIED_EXECUTION_PATH.md) - Execution architecture

## Questions for Integration

1. **Goal Processor API** - What's the exact interface for processGoal()?
2. **Config Overrides** - How to override config for sandbox execution?
3. **Trace Access** - How to get execution trace from ActivityExecution?
4. **Resolver Metadata** - Where is resolver name stored in trace?
5. **Backend Schema** - What's the exact format for trace submission?

## Contact

For questions about sandbox integration:
- Review [README.md](./README.md) for usage guide
- Check [Root CLAUDE.md](../../CLAUDE.md) for project context
- Examine [MiniBob CLAUDE.md](../CLAUDE.md) for architecture details
