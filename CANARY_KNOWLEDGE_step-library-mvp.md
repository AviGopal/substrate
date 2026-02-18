# Canary Knowledge: Step Library MVP

## Status
- ✅ Experiment: SUCCESS (2026-02-17 16:17)
- ✅ Container: devbob-clean
- 🔒 Confidence: HIGH

## What Was Built

Foundational step library system with 4 core files:
1. `step.ts` - Core types and Zod schema
2. `step-registry.ts` - In-memory storage
3. `step-executor.ts` - Execution engine with timeout
4. `steps/read-file.ts` - Example filesystem step

## How It Was Built

### Container
```bash
docker exec -i devbob-clean bash
cd /workspace
mkdir -p src/step/steps
```

### Files Created

**step.ts** (~25 lines):
- Core `Step` type with Zod schema
- `StepResult` interface for execution results
- `StepExecutor` function type
- Categories: filesystem, code, test, git, llm, data

**step-registry.ts** (~25 lines):
- Simple Map-based storage
- Operations: register, get, list, search
- No persistence yet (start simple)

**step-executor.ts** (~30 lines):
- Executes step with timeout
- Error handling with try/catch
- Returns StepResult with duration

**steps/read-file.ts** (~20 lines):
- Registers 'read-file' step
- Uses fs/promises readFile
- Returns content in StepResult

**test-steps.ts** (~40 lines):
- Tests registry (1 step registered)
- Tests execution (read /tmp/test.txt)
- Validates: registry works, execution works

### Execution
```bash
cd /workspace
bun run test-steps.ts

# Output:
# === Step Library Test ===
# 1. Registry test
#   Registered steps: 1
#     - read-file: Read contents of a file
#   ✓ Registry works
# 2. Execute read-file step
#   Success: true
#   Output: Hello from step library!
#   Duration: 0ms
#   ✓ Execution works
# === All Tests Passed ===
```

## Why It Worked

1. **Start Simple**: In-memory registry, no persistence initially
2. **TypeScript + Zod**: Type safety without complexity
3. **Container First**: Isolated environment, no host pollution
4. **Test Immediately**: Validated each component works
5. **Clear Interfaces**: Step, StepResult, StepExecutor

## Validation

```bash
# In devbob-clean container:
docker exec -i devbob-clean bash -c "cd /workspace && bun run test-steps.ts"

# Expected:
# ✓ Registry: 1 step registered
# ✓ Execution: read-file works
# ✓ Duration: <10ms
```

## Failure Modes

1. **Import errors**: Use correct paths (./src/step/...)
2. **Module not found**: Run from workspace root
3. **Zod validation**: Check schema matches input

## Next Steps

1. **Add more steps**:
   - write-file
   - run-command
   - parse-json
   
2. **Persistence**:
   - Save registry to disk
   - Load on startup
   
3. **Integration**:
   - Copy to repos/metabob-opencode
   - Wire into activity system
   - Create activity that uses steps

## Artifacts

- Container: devbob-clean
- Files: /workspace/src/step/*
- Test: /workspace/test-steps.ts
- Copied to: ./step-library-poc/

## Demonstration

To repeat this:

```bash
# 1. Start container
docker exec -i devbob-clean bash

# 2. Create files (see "How It Was Built")
# 3. Run test
cd /workspace && bun run test-steps.ts

# Should see "All Tests Passed"
```

## Key Decisions

- **No persistence initially**: Start with Map, add later
- **Zod for validation**: Type-safe, runtime validation
- **Timeout per step**: Prevent hanging
- **Simple executor**: One function, clear responsibility

## Related Knowledge

- Enables: Dynamic workflow composition
- Pattern: Build in container, validate, then adopt
- Future: Add 59 more steps (filesystem, code, test, git, llm, data)
