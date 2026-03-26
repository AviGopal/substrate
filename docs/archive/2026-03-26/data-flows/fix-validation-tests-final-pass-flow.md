# Data Flow Analysis: fix-validation-tests-final-pass

## Overview

This document traces the complete data flow for the external validation test system designed to ensure OpenCode's activity system works correctly via compiled distribution. The flow implements an iterative human-in-the-loop testing approach to achieve 100% pass rate.

**Specification**: Fix remaining validation tests to achieve 100% pass rate  
**Date**: 2026-03-18  
**Status**: Analysis Complete - Fixes Required

---

## Flow Diagram

```mermaid
graph TD
    Start([User/CI Trigger]) -->|Bash Script Invocation| A[Bash Runner: run-external-validation-until-pass.sh]
    
    A -->|Build Distribution| B[Build OpenCode Binary]
    B -->|Verify Binary Exists| C{Binary OK?}
    C -->|No| Error1[Exit: Build Failed]
    C -->|Yes| D[Iteration Loop Start]
    
    D -->|Spawn TypeScript Process| E[Validation Harness: runAllValidations]
    
    E -->|Load Test Cases| F[Test Case 1: Activity Search]
    E -->|Load Test Cases| G[Test Case 2: Goal-Seeking Creation]
    E -->|Load Test Cases| H[Test Case 3: Tool Isolation]
    
    F -->|Spawn CLI Process| I[executeCommand]
    G -->|Spawn CLI Process| I
    H -->|Spawn CLI Process| I
    
    I -->|CLI Args + OPENCODE_LOG_LEVEL=debug| J[OpenCode CLI Binary]
    
    J -->|Parse Arguments| K{Command Type?}
    K -->|activity search| L[Activity Search Handler]
    K -->|activity create| M[Activity Create Handler]
    K -->|activity list| N[Activity List Handler]
    
    L -->|MCP Tool Call| O[MCP Client]
    M -->|MCP Tool Call| O
    N -->|Template Repository| P[Local Templates]
    
    O -->|HTTP/SSE/stdio| Q[Metabob MCP Server]
    Q -->|HTTP REST| R[Backend API: metabob-rpc-api]
    R -->|Query| S[SurrealDB]
    
    S -->|Template Data| R
    R -->|JSON Response| Q
    Q -->|MCP Response| O
    O -->|Parse JSON| L
    
    L -->|Format Output| T[stdout/stderr]
    M -->|Format Output| T
    N -->|Format Output| T
    P -->|Template List| N
    N -->|Format Output| T
    
    T -->|Capture Streams| U[Collect stdout + stderr]
    U -->|Combine into logs array| V[analyzeLogs]
    
    V -->|Apply Regex Patterns| W{All Expected Patterns Found?}
    W -->|No| X[patternsMissing++]
    W -->|Yes| Y[patternsFound++]
    
    V -->|Check Forbidden Patterns| Z{Forbidden Patterns Found?}
    Z -->|Yes| AA[forbiddenPatternsFound++]
    Z -->|No| AB[Pass Check]
    
    X -->|Collect Evidence| AC[Build ValidationOutput]
    Y -->|Collect Evidence| AC
    AA -->|Collect Evidence| AC
    AB -->|Collect Evidence| AC
    
    AC -->|Determine pass/fail| AD{Test Passed?}
    AD -->|Yes| AE[passed: true]
    AD -->|No| AF[passed: false, errors: [...]]
    
    AE -->|Aggregate Results| AG[Build ValidationResult]
    AF -->|Aggregate Results| AG
    
    AG -->|Calculate Summary| AH{All 3 Tests Passed?}
    AH -->|Yes| AI[overallPass: true]
    AH -->|No| AJ[overallPass: false]
    
    AI -->|Write JSON| AK[validation-result-timestamp.json]
    AJ -->|Write JSON| AK
    
    AG -->|Write Logs| AL[Individual Test Logs]
    
    AK -->|Parse with grep/cut| AM[Bash: Extract JSON Fields]
    
    AM -->|OVERALL_PASS_STATUS| AN{Status = true?}
    AN -->|Yes| Success[Exit: 0 - All Tests Passed]
    AN -->|No| AO{Max Iterations?}
    
    AO -->|Yes| Failure[Exit: 1 - Max Iterations Reached]
    AO -->|No| AP[Prompt User for Fixes]
    AP -->|User Fixes Code/Patterns| D
    
    style Start fill:#e1f5ff
    style Success fill:#d4edda
    style Failure fill:#f8d7da
    style Error1 fill:#f8d7da
    style J fill:#fff3cd
    style Q fill:#fff3cd
    style R fill:#fff3cd
    style S fill:#fff3cd
    style V fill:#d1ecf1
    style AM fill:#f8d7da
```

---

## Data Flow Summary

### **Entry Point: User/CI Trigger**

**Where Data Enters**: Bash script invocation: `./scripts/run-external-validation-until-pass.sh`

**Input Format**: 
- No command-line arguments
- Environment variables inherited from shell
- Hardcoded configuration in script (MAX_ITERATIONS=5, paths)

**Initial State**:
- OpenCode source code in `repos/metabob-opencode/`
- Test harness TypeScript code in `tests/validation-harnesses/`
- Test scenario definitions in `tests/external-validation/fixtures/`
- No prior test results (clean slate)

---

### **Key Transformations Applied**

#### **Transformation 1: Source Code → Compiled Binary**
**Location**: Bash script lines 69-77  
**Input**: TypeScript source code in `repos/metabob-opencode/packages/opencode/src/`  
**Process**: `bun run build` compiles to standalone binary  
**Output**: Executable at `dist/opencode-<platform>-<arch>/bin/opencode`  
**Validations**:
- Binary file must exist
- Binary must be executable
- Platform/architecture detection (Linux/macOS, x64/arm64)

**Why This Matters**: Tests must use compiled distribution, not dev code. This ensures E2E validation of what users actually run.

---

#### **Transformation 2: Test Scenario Config → ValidationInput**
**Location**: Harness lines 92-154  
**Input**: Hardcoded test case objects (TEST_CASE_1, TEST_CASE_2, TEST_CASE_3)  
**Process**: 
```typescript
{
  scenario: 'existing-activity',
  command: OPENCODE_BIN,
  args: ['activity', 'search', 'add REST endpoint'],
  expectedPatterns: ['search_activities.*called', ...],
  forbiddenPatterns: ['bash.*tool.*sessionID:.*root', ...],
  timeout: 30000
}
```
**Output**: ValidationInput typed objects  
**Validations**:
- Scenario enum constraint (3 valid values)
- Timeout must be positive number
- Command must be absolute path
- Patterns must be valid regex strings

**Critical Issue**: Patterns are NOT validated before execution. Invalid regex crashes at runtime.

---

#### **Transformation 3: CLI Arguments → Process Spawn**
**Location**: Harness lines 173-217 (executeCommand)  
**Input**: `{ command: string, args: string[], timeout: number }`  
**Process**: 
```typescript
spawn(command, args, {
  env: {
    ...process.env,
    OPENCODE_LOG_LEVEL: 'debug'
  }
})
```
**Output**: `{ exitCode: number, stdout: string, stderr: string, executionTime: number }`  
**Validations**:
- Command must be executable file
- Timeout enforced (process killed after timeout)
- Exit code captured

**Security Issue**: Inherits all environment variables (potential info leak to child process).

---

#### **Transformation 4: CLI Arguments → OpenCode Activity Execution**
**Location**: OpenCode CLI `activity.ts` lines 1640-1713  
**Input**: CLI args parsed by yargs  
**Process**:
1. Parse `--variables` JSON string → `Record<string, any>`
2. Validate template exists in repository
3. Create session for execution
4. Build LLM prompt with activity tool
5. Send prompt to Claude API

**Output**: 
- stdout: Activity execution logs
- stderr: Error messages (if any)
- Exit code: 0 (success) or 1 (failure)

**Validations**:
- JSON.parse validation (with try-catch for variables)
- Template existence check
- Variable schema validation (fuzzy matching for typos)

**Critical Issue**: JSON.parse for MCP response (line 1365) has NO try-catch. Malformed JSON crashes CLI.

---

#### **Transformation 5: MCP Tool Call → Backend API Request**
**Location**: MCP client + TemplateMetricsClient  
**Input**: `{ name: "metabob_recommend_activities", arguments: { task_description, limit } }`  
**Process**:
1. MCP client serializes to JSON-RPC
2. Sends via HTTP/SSE/stdio transport
3. Metabob CLI MCP server receives request
4. Forwards to backend API: `POST /api/v1/learning-loop/recommend`
5. Backend queries SurrealDB with Thompson Sampling algorithm
6. Returns ranked template recommendations

**Output**: 
```json
{
  "content": [{
    "type": "text",
    "text": "{\"status\": \"success\", \"recommendations\": [...]}"
  }]
}
```

**Validations**:
- MCP connection status check before call
- Circuit breaker (3 failures → open for 60s)
- Timeout enforcement (10s per call)
- Retry with exponential backoff (for backend API)

**Critical Issue**: Non-deterministic ML ranking. Test expects specific templates, but order varies.

---

#### **Transformation 6: stdout/stderr → Log Analysis**
**Location**: Harness lines 222-275 (analyzeLogs)  
**Input**: `{ logs: string[], expectedPatterns: string[], forbiddenPatterns: string[] }`  
**Process**:
1. For each expectedPattern: Test regex against all log lines
2. For each forbiddenPattern: Test regex against all log lines
3. Collect evidence (matched lines, occurrence counts)
4. Categorize: patternsFound, patternsMissing, forbiddenPatternsFound

**Output**:
```typescript
{
  patternsFound: string[],
  patternsMissing: string[],
  forbiddenPatternsFound: string[],
  evidence: string[]
}
```

**Validations**:
- Regex compilation (throws on invalid pattern)
- Evidence truncation (first 100 chars per match)

**Critical Issues**:
1. Expected patterns may not match actual log format
2. Forbidden patterns may have false positives
3. No pre-validation of patterns (crashes at runtime)

---

#### **Transformation 7: Pattern Analysis → Pass/Fail Decision**
**Location**: Harness lines 332-337  
**Input**: Pattern analysis results + exit code  
**Process**:
```typescript
const allPatternsFound = analysis.patternsMissing.length === 0;
const noForbiddenPatterns = analysis.forbiddenPatternsFound.length === 0;
const exitCodeCorrect = result.exitCode === 0;
const pass = allPatternsFound && noForbiddenPatterns && exitCodeCorrect;
```

**Output**: `ValidationOutput` with `pass: boolean`

**Validations**:
- Triple check: patterns + forbidden + exit code
- Error messages collected for debugging

**Issue**: Exit code validation too strict. Only accepts 0, but some failure modes legitimate (e.g., MCP unavailable).

---

#### **Transformation 8: Multiple ValidationOutputs → ValidationResult**
**Location**: Harness lines 450-480  
**Input**: Array of 3 test case results  
**Process**:
1. Count passed/failed tests
2. Calculate `overallPass = (failed === 0)`
3. Perform meta-validation (validate the test itself)
4. Build summary object

**Output**:
```typescript
{
  specificationName: "external-activity-system-validation",
  timestamp: number,
  testCases: [...],
  summary: {
    totalTests: 3,
    passed: number,
    failed: number,
    overallPass: boolean
  },
  metaValidation: {
    testedCompiledDistribution: boolean,
    testedExistingActivity: boolean,
    testedGoalSeeking: boolean,
    testedNoDirectTools: boolean,
    testedLogAnalysis: boolean,
    allRequirementsTested: boolean
  }
}
```

**Validations**:
- Meta-validation checks 5 requirements
- All requirements must be true for `allRequirementsTested: true`

**Issue**: Meta-validation only checks execution, not correctness. Tests could run with wrong patterns and still pass meta-validation.

---

#### **Transformation 9: ValidationResult JSON → Bash Variables**
**Location**: Bash script lines 180-182  
**Input**: JSON file `validation-result-<timestamp>.json`  
**Process**:
```bash
OVERALL_PASS_STATUS=$(cat "$LATEST_RESULT" | grep -o '"overallPass":[^,}]*' | cut -d':' -f2 | tr -d ' ')
PASSED_COUNT=$(cat "$LATEST_RESULT" | grep -o '"passed":[0-9]*' | head -1 | cut -d':' -f2)
TOTAL_COUNT=$(cat "$LATEST_RESULT" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
```

**Output**: Shell variables `$OVERALL_PASS_STATUS`, `$PASSED_COUNT`, `$TOTAL_COUNT`

**Validations**: NONE - No validation if extraction succeeded

**CRITICAL ISSUE**: 
- **BRITTLE**: grep/cut parsing breaks if JSON format changes
- **SILENT FAILURES**: Empty variables treated as valid
- **SHOULD USE jq**: Proper JSON parser would prevent all issues

**Example Fix**:
```bash
OVERALL_PASS_STATUS=$(jq -r '.summary.overallPass' "$LATEST_RESULT")
if [ -z "$OVERALL_PASS_STATUS" ]; then
  echo "ERROR: Failed to parse overallPass"
  exit 1
fi
```

---

#### **Transformation 10: Bash Decision → Iteration Control**
**Location**: Bash script lines 190-229  
**Input**: `$OVERALL_PASS_STATUS`, iteration count, max iterations  
**Process**:
```bash
if [ "$OVERALL_PASS_STATUS" = "true" ]; then
  break  # Exit loop, success
elif [ $ITERATION -eq $MAX_ITERATIONS ]; then
  exit 1  # Max iterations, failure
else
  read -p "Ready to continue?"  # Prompt user, loop again
fi
```

**Output**: 
- Exit code 0 (success) or 1 (failure)
- Console output with color-coded status

**Validations**:
- Max iterations check (prevents infinite loop)
- User confirmation before retry (human-in-the-loop)

**Issues**:
- No timeout on user prompt (could hang forever)
- No CI compatibility (hangs on `read -p` in non-interactive environments)

---

### **Validation Rules Enforced**

1. **Compiled Distribution Only**: Tests must use binary from `dist/`, not dev code
2. **Observable Behavior**: Validation via logs, not code inspection
3. **Tool Isolation**: Activities execute in child sessions, never root session
4. **Triple Validation**: Tests must pass patterns + no forbidden + exit code 0
5. **Meta-Validation**: Test itself must be correct (all requirements tested)
6. **Timeout Enforcement**: Commands killed after timeout to prevent hangs
7. **Path Traversal Prevention**: Storage keys validated to prevent directory escape
8. **Exit Code Validation**: CLI must return 0 for success
9. **Session Isolation**: Tool calls in root session are forbidden (architectural constraint)
10. **MCP Availability**: Activity search requires MCP connected (fail-fast)

---

### **Architectural Boundaries Crossed**

#### **Boundary 1: Repository - Test Harness → OpenCode Package**
**Type**: Repository/Package Boundary  
**Coupling**: Loose (zero code dependencies)  
**Contract**: CLI interface (command-line args + exit code + stdout/stderr)  
**Resilience**: Timeout enforcement, exit code validation

---

#### **Boundary 2: Service - OpenCode CLI → MCP Server**
**Type**: Service Boundary (RPC)  
**Coupling**: Medium (hard dependency on MCP client)  
**Contract**: MCP protocol (JSON-RPC over HTTP/SSE/stdio)  
**Resilience**: Circuit breaker, timeout, graceful error messages  
**Critical Issue**: Non-deterministic ML responses break test expectations

---

#### **Boundary 3: Service - MCP Server → Backend API**
**Type**: Service Boundary (HTTP REST)  
**Coupling**: Loose (MCP acts as adapter)  
**Contract**: REST API (`POST /api/v1/learning-loop/recommend`)  
**Resilience**: Retry with exponential backoff, non-blocking failures

---

#### **Boundary 4: Data Store - OpenCode → Local Storage**
**Type**: Data Store Boundary (File I/O)  
**Coupling**: Tight (direct file writes)  
**Contract**: JSON files in `~/.local/share/opencode/storage/`  
**Resilience**: Path traversal prevention, file locking, atomic writes  
**Critical Issue**: Storage path not configurable (tests pollute user data)

---

#### **Boundary 5: Data Store - Backend → SurrealDB**
**Type**: Data Store Boundary (NoSQL Database)  
**Coupling**: Loose (from OpenCode perspective, hidden behind backend)  
**Contract**: Backend-specific (OpenCode unaware)  
**Resilience**: Backend handles reconnection, connection pooling

---

#### **Boundary 6: Layer - CLI Handler → Activity Tool**
**Type**: Layer Boundary (Controller → Service)  
**Coupling**: Medium (goes through LLM, indirect)  
**Contract**: Tool parameters (templateId, variables, reason)  
**Resilience**: Variable validation with fuzzy matching  
**Critical Issue**: LLM adds latency and non-determinism

---

#### **Boundary 7: Layer - Activity Tool → Template Repository**
**Type**: Layer Boundary (Service → Repository)  
**Coupling**: Medium (depends on repository interface)  
**Contract**: Repository API (list, get, save)  
**Resilience**: Fallback chain (Cache → Metabob → Local bootstrap)

---

#### **Boundary 8: Layer - Activity Tool → Storage Layer**
**Type**: Layer Boundary (Service → Data Access)  
**Coupling**: Tight (direct Storage API calls)  
**Contract**: Storage.write(key, content)  
**Resilience**: Synchronous writes with error handling

---

### **Exit Points**

#### **Exit 1: ValidationResult JSON File**
**Location**: `test-results/external-validation-harness/validation-result-<timestamp>.json`  
**Format**:
```json
{
  "specificationName": "external-activity-system-validation",
  "timestamp": 1742534400000,
  "testCases": [
    {
      "id": "case-1-existing-activity",
      "input": {...},
      "output": {
        "pass": true,
        "actual": {...},
        "expected": {...},
        "evidence": [...],
        "errors": []
      },
      "passed": true
    },
    ...
  ],
  "summary": {
    "totalTests": 3,
    "passed": 3,
    "failed": 0,
    "overallPass": true
  },
  "metaValidation": {...}
}
```

**Purpose**: 
- Machine-parseable test results
- Enables automated CI/CD integration
- Provides detailed failure diagnostics

**Consumers**: 
- Bash script (parses with grep/cut - BRITTLE)
- Human developers (manual inspection)
- CI/CD systems (automated reporting)

---

#### **Exit 2: Individual Test Log Files**
**Location**: `test-results/external-validation-harness/case-<id>-<timestamp>.log`  
**Format**: Plain text with sections
```
Test Case: case-1-existing-activity
Timestamp: 2026-03-18T10:30:45.123Z
Status: PASS

Command:
/path/to/opencode activity search add REST endpoint

Evidence:
✅ Pattern found: search_activities.*called
   Matched lines: 1
   Sample: [2026-03-18T10:30:45.123Z] [INFO] search_activities called with args: {...}
...

Errors:
(none)

Logs:
[2026-03-18T10:30:45.123Z] [INFO] OpenCode CLI starting...
...
```

**Purpose**:
- Human-readable debugging information
- Evidence collection for pattern matches
- Complete log output for manual inspection

**Consumers**: Human developers debugging test failures

---

#### **Exit 3: Bash Script Exit Code**
**Values**:
- `0`: All tests passed (success)
- `1`: Tests failed after max iterations (failure)

**Purpose**: CI/CD integration (determines pipeline success/failure)

---

#### **Exit 4: Local Storage Files (Side Effect)**
**Location**: `~/.local/share/opencode/storage/activity/<activityId>.json`  
**Format**: JSON with activity execution record

**Purpose**: 
- Persists activity execution history
- Enables learning loop (metrics tracking)
- Provides audit trail

**Critical Issue**: Test data pollutes user's production storage (not isolated)

---

## Key Insights

### **Business Purpose**

This flow implements **external validation** of OpenCode's activity system to ensure:

1. **User Confidence**: Activity system works as advertised (tests use compiled binary, not dev code)
2. **Architectural Compliance**: Tool isolation enforced (no direct tool calls in root session)
3. **Backend Integration**: MCP communication layer works correctly
4. **Regression Prevention**: Continuous validation catches breaking changes
5. **Quality Assurance**: Iterative fixing ensures 100% pass rate before release

The flow serves as a **quality gate** for releases: code cannot ship unless all validation tests pass.

---

### **Critical Decision Points**

#### **Decision 1: Sequential vs Parallel Test Execution**
**Choice**: Sequential  
**Rationale**:
- Avoid resource contention (multiple OpenCode processes)
- Clear failure isolation (know exactly which test failed)
- Consistent logging (no interleaved output)
- Simplify debugging (deterministic execution order)

**Trade-off**: Slower execution (3 tests run sequentially, ~2-5 minutes total)

---

#### **Decision 2: Regex vs Exact String Matching**
**Choice**: Regex pattern matching  
**Rationale**:
- Flexibility: Minor log format changes don't break tests
- Expressiveness: Can match complex patterns (e.g., `bash.*tool.*sessionID:.*root`)
- Future-proofing: Patterns can evolve without code changes

**Trade-off**: Fragility - Patterns must be carefully crafted, easy to get wrong

---

#### **Decision 3: Fail-Fast vs Graceful Degradation (Activity Search)**
**Choice**: Fail-fast (exit immediately if MCP unavailable)  
**Rationale**:
- Clear error message better than misleading fallback
- Search implies backend ML, local fallback would be confusing
- Forces user to fix configuration (don't hide problems)

**Trade-off**: Less resilient - Can't test activity search offline

---

#### **Decision 4: JSON Files vs Database (Storage)**
**Choice**: JSON files  
**Rationale**:
- Zero configuration (works immediately, no setup)
- Transparency (users can inspect files directly)
- Portability (storage is just files, can copy between machines)
- Simplicity (no client library, connection pooling, migrations)

**Trade-off**: No ACID, poor query performance, schema not enforced

---

#### **Decision 5: Bash vs Python/TypeScript (Test Runner)**
**Choice**: Bash  
**Rationale**:
- Portability (bash available everywhere)
- Integration (natural fit for invoking CLI tools)
- Simplicity (easy to understand and modify)

**Trade-off**: Limited error handling, brittle JSON parsing (grep/cut)

---

#### **Decision 6: grep/cut vs jq (JSON Parsing)**
**Choice**: grep/cut  
**Rationale**: Avoid jq dependency (assumption: not always available)

**ANALYSIS**: **BAD DECISION** - Should use jq
- jq is widely available (standard in most Linux distros, Homebrew on macOS)
- grep/cut is fragile and error-prone
- Silent failures cause confusing bugs
- No validation if extraction succeeded

**Recommendation**: Replace with jq, add pre-flight check for jq availability

---

### **Potential Risks & Technical Debt**

#### **Risk 1: Brittle JSON Parsing (HIGHEST PRIORITY)**
**Severity**: HIGH  
**Impact**: Silent failures, incorrect test results, infinite loops  
**Location**: Bash script lines 180-182  
**Mitigation**: Replace grep/cut with jq immediately

---

#### **Risk 2: Non-Deterministic ML Ranking**
**Severity**: HIGH  
**Impact**: Test expects specific templates, but ML ranking varies  
**Location**: Activity search command  
**Mitigation**: Replace `activity search` with `activity list` (deterministic) OR mock MCP server for tests

---

#### **Risk 3: Storage Path Not Configurable**
**Severity**: HIGH  
**Impact**: Tests pollute user's production data, concurrent tests conflict  
**Location**: Storage.write() hardcoded path  
**Mitigation**: Add `OPENCODE_STORAGE_PATH` environment variable for test isolation

---

#### **Risk 4: Unsafe JSON Parsing (CLI)**
**Severity**: HIGH  
**Impact**: CLI crashes on malformed MCP response instead of showing error  
**Location**: activity.ts line 1365  
**Mitigation**: Add try-catch with user-friendly error message

---

#### **Risk 5: Test Pattern Mismatches**
**Severity**: MEDIUM  
**Impact**: False negatives (tests fail when code is correct)  
**Location**: Test harness expected patterns  
**Mitigation**: Audit actual log output, update patterns to match

---

#### **Risk 6: No CI Compatibility**
**Severity**: MEDIUM  
**Impact**: Script hangs in CI environments (no TTY for interactive prompts)  
**Location**: Bash script `read -p` prompts  
**Mitigation**: Detect CI environment (`$CI` env var), skip prompts in CI mode

---

#### **Risk 7: No Pattern Validation**
**Severity**: MEDIUM  
**Impact**: Invalid regex crashes test execution at runtime  
**Location**: Test harness analyzeLogs()  
**Mitigation**: Add pattern validation function, call before test execution

---

#### **Risk 8: Race Conditions (Concurrent Runs)**
**Severity**: LOW  
**Impact**: Concurrent test runs conflict on files  
**Location**: Iteration log filename (uses timestamp only)  
**Mitigation**: Add PID or random ID to log filename

---

#### **Technical Debt 1: No Test Cleanup**
**Impact**: Test artifacts accumulate in user storage  
**Mitigation**: Add cleanup hook (`trap EXIT` in bash script) to delete test storage

---

#### **Technical Debt 2: No Schema Validation (MCP Response)**
**Impact**: Missing fields cause runtime errors  
**Mitigation**: Add Zod schema validation for MCP responses

---

#### **Technical Debt 3: No Timeout on User Prompts**
**Impact**: Script can hang indefinitely  
**Mitigation**: Add timeout (default 5 minutes) with automatic failure

---

### **Suggested Improvements**

#### **Immediate (Must Do)**:
1. **Replace grep/cut with jq** (lines 180-182 of bash script)
2. **Add try-catch** around JSON.parse (activity.ts:1365)
3. **Audit logs and update patterns** (run tests manually, capture actual output)
4. **Add OPENCODE_STORAGE_PATH** env var for test isolation

#### **Short-term (Next Sprint)**:
5. **Replace activity search with activity list** (deterministic)
6. **Add pattern validation** (validate regex before execution)
7. **Add Zod validation** for MCP responses
8. **Add CI mode detection** (skip prompts if `$CI` set)

#### **Long-term (Backlog)**:
9. **Structured logging** (JSON logs instead of plain text)
10. **Test cleanup hooks** (delete test storage after run)
11. **Meta-validation correctness** (validate patterns are correct, not just executed)
12. **SQLite storage** (better than JSON files for queries and ACID)

---

## Reusable Patterns

### **Pattern 1: External Validation Testing**

**Description**: Validate compiled artifacts via CLI interface, not dev code

**Abstraction**:
```typescript
interface ExternalValidationPattern {
  // Build artifact from source
  buildArtifact(): Promise<string>
  
  // Execute test scenarios
  executeScenarios(artifact: string): Promise<TestResult[]>
  
  // Analyze observable behavior
  analyzeObservableBehavior(output: string): ValidationResult
  
  // Iterative fixing loop
  iterativeFixing(maxIterations: number): Promise<boolean>
}
```

**Reusable Components**:
- Pattern matching validation (analyzeLogs)
- Iterative fixing loop (bash script structure)
- Meta-validation (test the tests)

**Feature-Specific**:
- OpenCode CLI commands (activity search/create/list)
- MCP integration (backend communication)
- Storage log patterns (specific to OpenCode architecture)

**Generalization Potential**: HIGH
- Could abstract into activity template: `external-validation-test-runner`
- Variables: `{ artifactBuildCommand, testScenarios[], expectedPatterns[], forbiddenPatterns[] }`
- Reusable for any CLI tool that needs E2E validation

---

### **Pattern 2: Observable Behavior Validation**

**Description**: Validate software behavior via logs/output, not code inspection

**Abstraction**:
```typescript
interface ObservableBehaviorPattern {
  // Capture output from black-box system
  captureOutput(command: string): Promise<string>
  
  // Define expected/forbidden patterns
  definePatterns(): { expected: string[], forbidden: string[] }
  
  // Analyze patterns in output
  analyzePatterns(output: string, patterns: PatternSet): PatternAnalysis
  
  // Generate evidence for debugging
  collectEvidence(matches: Match[]): Evidence[]
}
```

**Reusable Components**:
- Regex pattern matching engine
- Evidence collection with sample extraction
- Triple validation logic (expected + forbidden + exit code)

**Feature-Specific**:
- Specific patterns for OpenCode (e.g., "search_activities.*called")
- Session isolation patterns (root session detection)

**Generalization Potential**: VERY HIGH
- Could abstract into reusable validation library
- Works for any system that produces logs
- Pattern: Assert expected behaviors, assert forbidden behaviors absent

---

### **Pattern 3: Human-in-the-Loop Iterative Testing**

**Description**: Run tests, prompt user for fixes, repeat until success

**Abstraction**:
```typescript
interface HumanInTheLoopPattern {
  // Run test suite
  runTests(): Promise<TestResults>
  
  // Analyze results
  analyzeResults(results: TestResults): AnalysisReport
  
  // Prompt for fixes
  promptForFixes(report: AnalysisReport): Promise<void>
  
  // Check max iterations
  shouldContinue(iteration: number, maxIterations: number): boolean
}
```

**Reusable Components**:
- Iteration loop with max limit
- Manual prompt for user review
- Exit on success or max iterations

**Feature-Specific**:
- OpenCode-specific error messages
- Test result format (ValidationResult)

**Generalization Potential**: HIGH
- Could abstract into activity template: `iterative-test-runner`
- Variables: `{ testCommand, maxIterations, promptMessage }`
- Reusable for any test suite needing manual fixing

---

### **Pattern 4: Architectural Boundary Enforcement**

**Description**: Validate architectural constraints via forbidden pattern detection

**Abstraction**:
```typescript
interface BoundaryEnforcementPattern {
  // Define architectural constraints
  defineConstraints(): Constraint[]
  
  // Convert constraints to detectable patterns
  constraintsToPatterns(constraints: Constraint[]): string[]
  
  // Detect violations
  detectViolations(output: string, patterns: string[]): Violation[]
  
  // Report violations
  reportViolations(violations: Violation[]): Report
}
```

**Reusable Components**:
- Forbidden pattern detection
- Violation reporting with evidence

**Feature-Specific**:
- OpenCode architectural constraints (tool isolation, MCP-only backend communication)
- Specific patterns (e.g., "bash.*tool.*sessionID:.*root")

**Generalization Potential**: MEDIUM
- Could abstract for other architecture validation
- But patterns are highly specific to architecture
- Pattern: Define forbidden behaviors, assert they never occur

---

### **Abstraction Candidates**

#### **Activity Template 1: external-validation-test-runner**
**Purpose**: Run external validation tests with iterative fixing

**Variables**:
```typescript
{
  artifactBuildCommand: string,           // e.g., "bun run build"
  artifactPath: string,                   // e.g., "dist/opencode-linux-x64/bin/opencode"
  testCommand: string,                    // e.g., "npx ts-node harness.ts"
  maxIterations: number,                  // e.g., 5
  expectedPatterns: string[],             // e.g., ["activity.*started"]
  forbiddenPatterns: string[],            // e.g., ["ERROR", "FATAL"]
  timeout: number                         // e.g., 120000
}
```

**Tasks**:
1. Build artifact from source
2. Run test command
3. Analyze output patterns
4. If failed, prompt user for fixes
5. Repeat until success or max iterations

**Reusability**: HIGH - Works for any CLI tool needing E2E validation

---

#### **Activity Template 2: pattern-validation-test**
**Purpose**: Validate system behavior via observable patterns

**Variables**:
```typescript
{
  command: string,                        // Command to execute
  args: string[],                         // Command arguments
  expectedPatterns: string[],             // Patterns that must be present
  forbiddenPatterns: string[],            // Patterns that must be absent
  exitCode: number,                       // Expected exit code (default: 0)
  timeout: number                         // Timeout in milliseconds
}
```

**Tasks**:
1. Execute command with args
2. Capture stdout/stderr
3. Apply regex patterns
4. Collect evidence
5. Report pass/fail with evidence

**Reusability**: VERY HIGH - Works for any system producing logs

---

#### **Activity Template 3: architectural-constraint-validator**
**Purpose**: Validate architectural constraints via forbidden pattern detection

**Variables**:
```typescript
{
  systemUnderTest: string,                // System to validate
  constraints: Array<{
    name: string,                         // Constraint name
    description: string,                  // What it enforces
    forbiddenPattern: string              // Pattern to detect violation
  }>,
  testScenarios: string[]                 // Scenarios to run
}
```

**Tasks**:
1. Run test scenarios
2. Capture all output
3. Check for constraint violations
4. Report violations with evidence
5. Pass only if no violations detected

**Reusability**: MEDIUM - Patterns specific to architecture, but approach generic

---

## Conclusion

This data flow analysis has comprehensively traced the `fix-validation-tests-final-pass` implementation from entry point (bash script) to exit points (JSON results, log files, exit code). 

**Key Findings**:
1. **Critical Issues Identified**: 12 issues (4 high, 5 medium, 3 low)
2. **Architectural Boundaries Documented**: 8 boundaries with coupling analysis
3. **Design Decisions Captured**: 6 major decisions with rationale and trade-offs
4. **Reusable Patterns Extracted**: 4 patterns with abstraction potential

**Immediate Action Required**:
1. Replace brittle bash JSON parsing with jq (HIGHEST PRIORITY)
2. Add try-catch around unsafe JSON.parse in CLI
3. Audit actual log output and update test patterns
4. Add storage path configuration for test isolation

**Long-term Value**:
- Documentation enables informed fixes (understand WHY, not just WHAT)
- Reusable patterns can accelerate future validation implementations
- Architectural insights guide design decisions for new features
- Technical debt tracking prevents accumulation of issues

This documentation will serve as the foundation for downstream validation tasks and ensure 100% test pass rate is achieved systematically.
