# E2E Testing: Goal Flow Through MiniBob

This document provides concrete examples for testing how user goals flow through the system, with variated test cases for live validation.

---

## 1. Test Categories

### A. Entry Point Tests
Verify goals enter correctly via different paths.

### B. Transformation Tests
Verify data shape transformations at each stage.

### C. Learning Loop Tests
Verify Thompson Sampling converges and metrics update.

### D. Integration Tests
Verify component communication (MiniBob → Activity-API → SurrealDB).

---

## 2. Entry Point Test Cases

### 2.1 HTTP /goal Endpoint

```bash
# Test 1: Simple goal
curl -X POST http://minibob:3000/goal \
  -H "Content-Type: application/json" \
  -d '{"goal": "add a hello function to utils.ts"}'

# Expected response shape:
{
  "id": "exec_1711361234567_abc123",
  "templateId": "feature-add-function-v1",
  "status": "completed",
  "metrics": {
    "duration": 12500,
    "cost": 0.08,
    "totalTokens": { "input": 4200, "output": 890 }
  }
}

# Test 2: Goal with context
curl -X POST http://minibob:3000/goal \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "fix the validation bug",
    "context": {
      "file": "src/validators.ts",
      "line": 42,
      "error": "TypeError: Cannot read property of undefined"
    }
  }'

# Test 3: Goal that should improvise (no matching template)
curl -X POST http://minibob:3000/goal \
  -H "Content-Type: application/json" \
  -d '{"goal": "investigate why the database connection times out after 30 seconds of inactivity"}'
```

### 2.2 CLI Entry

```bash
# Test 1: Direct improvisation
bun run repos/minibob/index.ts improvise "create a README.md for the project"

# Test 2: Run specific template
bun run repos/minibob/index.ts run templates/feature-add-endpoint.json \
  --var endpoint=/api/health \
  --var method=GET

# Test 3: Understand codebase (exploration)
bun run repos/minibob/index.ts understand src/routes --focus "error handling"
```

### 2.3 MCP Tool Calls (via metabob-mcp)

```json
// Tools available via MCP protocol
{
  "tools/list": [
    "get_priority_issues",
    "search_codebase",
    "analyze_change_impact",
    "suggest_related_changes",
    "annotate_component",
    "mark_problem_complete",
    "generate_implementation_spec"
  ]
}

// Test: generate_implementation_spec (creates goal-like flow)
{
  "method": "tools/call",
  "params": {
    "name": "generate_implementation_spec",
    "arguments": {
      "goal": "Add rate limiting to the API endpoints",
      "entry_points": ["src/routes/index.ts"],
      "context": "We're seeing 429 errors under load"
    }
  }
}
```

---

## 3. Transformation Test Cases

### 3.1 Goal Parsing → Goal Object

```typescript
// Input variations and expected type inference:

const testCases = [
  // Feature detection
  { input: "add login button", expectedType: "feature" },
  { input: "create user registration", expectedType: "feature" },
  { input: "implement OAuth flow", expectedType: "feature" },

  // Bugfix detection
  { input: "fix authentication bug", expectedType: "bugfix" },
  { input: "resolve the null pointer error", expectedType: "bugfix" },
  { input: "debug why tests fail", expectedType: "bugfix" },

  // Refactor detection
  { input: "refactor database module", expectedType: "refactor" },
  { input: "clean up the legacy code", expectedType: "refactor" },
  { input: "reorganize folder structure", expectedType: "refactor" },

  // Exploration detection
  { input: "analyze codebase security", expectedType: "exploration" },
  { input: "explore the API surface", expectedType: "exploration" },
  { input: "find all unused imports", expectedType: "exploration" },

  // Other (no keywords match)
  { input: "update the version number", expectedType: "other" },
  { input: "run the migration script", expectedType: "other" },
];

// Verification:
for (const { input, expectedType } of testCases) {
  const goal = GoalProcessor.parseGoal(input);
  assert(goal.type === expectedType, `${input} → ${goal.type} (expected ${expectedType})`);
}
```

### 3.2 Goal → Recommendation Request

```typescript
// Goal object
const goal = {
  message: "fix the login timeout bug",
  type: "bugfix",
  intent: "fix the login timeout bug",
  context: { file: "src/auth.ts" },
  createdAt: Date.now()
};

// Expected transformation to API request:
const expectedRequest = {
  taskDescription: "fix the login timeout bug",  // goal.intent
  category: "bugfix",                            // goal.type
  loadedImpulseIds: [],                          // current impulses
  limit: 3                                       // top N
};

// Verification endpoint:
POST /v2/activities/recommend
→ Returns array of { template_id, selection_metadata }
```

### 3.3 Execution → Trace

```typescript
// After activity completes, verify trace shape:

const traceShape = {
  execution_id: "string (required)",
  template_id: "string (required)",
  status: "success | failure | partial",
  duration_ms: "number >= 0",
  cost_usd: "number >= 0",
  execution_trace: {
    tasks: [
      {
        id: "string",
        description: "string",
        actualPrompt: "string (the expanded prompt)",
        toolCalls: [
          {
            id: "string",
            name: "bash | read | write | edit | git",
            arguments: "object",
            result: { success: "boolean", output: "string" }
          }
        ],
        response: "string (LLM response)",
        result: { status: "success | failure", error: "optional string" },
        inputState: { filesAvailable: [], environment: {}, impulses: [] },
        outputState: { filesModified: [], filesCreated: [], filesDeleted: [] }
      }
    ],
    filesModified: ["array of file paths"],
    goalContext: {
      goal: "original goal message",
      intent: "parsed intent",
      context: {}
    }
  }
};

// Verification query:
SELECT * FROM activity_execution_traces
WHERE execution_id = $executionId
```

---

## 4. Thompson Sampling Test Cases

### 4.1 Verify Exploration vs Exploitation

```typescript
// Setup: Two templates with different histories
const templates = [
  { variant_id: "v1", successes: 10, failures: 2 },  // 83% success
  { variant_id: "v2", successes: 2, failures: 0 },   // 100% but low N
];

// Run 100 recommendations
const selections = [];
for (let i = 0; i < 100; i++) {
  const rec = await recommend({ taskDescription: "test", category: "test" });
  selections.push(rec[0].template_id);
}

// Verify:
// - v1 should be selected ~70-80% (exploitation)
// - v2 should be selected ~20-30% (exploration due to uncertainty)
const v1Percent = selections.filter(s => s === "v1").length;
assert(v1Percent > 60 && v1Percent < 90, "Should balance exploration/exploitation");
```

### 4.2 Verify Convergence Over Time

```typescript
// Setup: Equal starting point
await setMetrics("v1", { alpha: 1, beta: 1 });
await setMetrics("v2", { alpha: 1, beta: 1 });

// Simulate: v1 always succeeds, v2 always fails
for (let i = 0; i < 20; i++) {
  // Execute both
  await recordExecution("v1", { success: true });
  await recordExecution("v2", { success: false });
}

// After 20 iterations:
// v1: alpha = 21, beta = 1 → expected = 0.95
// v2: alpha = 1, beta = 21 → expected = 0.05

// Verify v1 now dominates recommendations
const recs = await recommend({ taskDescription: "test", category: "test", limit: 3 });
assert(recs[0].template_id === "v1", "Best template should rank first");
assert(recs[0].selection_metadata.sample > 0.9, "Sample should reflect success history");
```

### 4.3 Verify New Template Gets Explored

```typescript
// Create brand new template (no history)
const newTemplate = await createTemplate({
  variant_id: "brand-new-v1",
  activity_id: "brand-new",
  // alpha = 1, beta = 1 (prior)
});

// Request recommendations
const recs = await recommend({ taskDescription: "test", category: "brand-new" });

// Verify:
// - New template should appear in results
// - Should have high variance (uncertainty)
const newRec = recs.find(r => r.template_id === "brand-new-v1");
assert(newRec !== undefined, "New template should be recommended");
assert(newRec.selection_metadata.sample >= 0.3, "Should have reasonable sample due to prior");
```

---

## 5. Integration Test Cases

### 5.1 Full Goal → Execution → Learning Cycle

```typescript
// 1. Submit goal
const response = await fetch("http://minibob:3000/goal", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    goal: "create a test file test-integration.ts with a simple function"
  })
});
const execution = await response.json();

// 2. Verify execution completed
assert(execution.status === "completed");
assert(execution.id.startsWith("exec_"));

// 3. Wait for backend processing (async)
await sleep(500);

// 4. Verify trace stored in SurrealDB
const traces = await db.query(`
  SELECT * FROM activity_execution_traces
  WHERE execution_id = $id
`, { id: execution.id });
assert(traces.length === 1);
assert(traces[0].status === "success");

// 5. Verify metrics updated
const metrics = await db.query(`
  SELECT * FROM variant_performance_metrics
  WHERE variant_id = $id
`, { id: execution.templateId });
assert(metrics[0].total_executions > 0);

// 6. Verify file was actually created
const fileExists = await Bun.file("test-integration.ts").exists();
assert(fileExists);

// 7. Cleanup
await Bun.write("test-integration.ts", ""); // or delete
```

### 5.2 Impulse Resolution Chain

```typescript
// 1. Create a failed execution trace
const failedExec = await submitGoal({
  goal: "intentionally-failing-goal-for-test"
  // This should fail and create a trace
});
assert(failedExec.status === "failure");

// 2. Create impulse pointer to the failure
const pointer = {
  type: "activityExecutionTrace",
  executionId: failedExec.id
};

// 3. Resolve impulse via backend
const resolved = await fetch("http://activity-api:8080/v2/impulses/resolve", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pointer })
});
const { content } = await resolved.json();

// 4. Verify content is formatted as markdown
assert(content.includes("# Execution Trace:"));
assert(content.includes("Status: failure"));
assert(content.includes("Error:"));
```

### 5.3 MCP → Activity-API → SurrealDB Chain

```typescript
// 1. Call MCP tool
const mcpResponse = await callMcpTool("get_priority_issues", {
  limit: 5,
  severity: ["HIGH", "CRITICAL"]
});

// 2. Verify response shape
assert(Array.isArray(mcpResponse.issues));
assert(mcpResponse.issues.length <= 5);
for (const issue of mcpResponse.issues) {
  assert(["HIGH", "CRITICAL"].includes(issue.severity));
}

// 3. Verify data came from SurrealDB (check via direct query)
const dbIssues = await db.query(`
  SELECT * FROM analysis_problems
  WHERE severity IN ['HIGH', 'CRITICAL']
  LIMIT 5
`);
assert(dbIssues.length === mcpResponse.issues.length);
```

---

## 6. Variated Test Goals (Copy-Paste Ready)

### Feature Goals
```json
{ "goal": "add a logout button to the header" }
{ "goal": "create a new API endpoint for user profile" }
{ "goal": "implement dark mode toggle" }
{ "goal": "add form validation to the signup page" }
{ "goal": "create a caching layer for database queries" }
```

### Bugfix Goals
```json
{ "goal": "fix the null pointer exception in UserService.getById" }
{ "goal": "resolve the race condition in session handling" }
{ "goal": "debug why the test suite hangs on CI" }
{ "goal": "fix the memory leak in the WebSocket handler" }
{ "goal": "repair the broken pagination in the admin panel" }
```

### Refactor Goals
```json
{ "goal": "refactor the authentication module to use middleware" }
{ "goal": "clean up duplicate code in the validators" }
{ "goal": "reorganize the folder structure for better modularity" }
{ "goal": "simplify the complex nested conditionals in calculatePrice" }
{ "goal": "extract common logic into a shared utility module" }
```

### Exploration Goals
```json
{ "goal": "analyze the codebase for security vulnerabilities" }
{ "goal": "find all usages of deprecated APIs" }
{ "goal": "explore the database schema and relationships" }
{ "goal": "identify performance bottlenecks in the API" }
{ "goal": "map the dependency graph between modules" }
```

### Complex Goals (Likely to Improvise)
```json
{ "goal": "migrate the database from PostgreSQL to SurrealDB while maintaining backward compatibility" }
{ "goal": "implement real-time collaborative editing with conflict resolution" }
{ "goal": "add end-to-end encryption for all user data with key rotation" }
{ "goal": "create a plugin system that allows third-party extensions" }
{ "goal": "optimize the search algorithm to handle 10x current load" }
```

---

## 7. Verification Checklist

### Per-Execution Verification

- [ ] Goal parsed correctly (type, intent, context)
- [ ] Recommendation returned (template_id, selection_metadata)
- [ ] Execution completed (status, metrics)
- [ ] Trace stored (all tasks, tool calls, state transitions)
- [ ] Metrics updated (alpha/beta, success_rate)
- [ ] Files actually modified (if applicable)
- [ ] Dashboard shows execution

### Learning Loop Verification

- [ ] Thompson Sampling produces varied selections (not deterministic)
- [ ] Better templates rank higher after successes
- [ ] Failed templates rank lower over time
- [ ] New templates get explored (not starved)
- [ ] Ribosome extracts templates from successful improvisation

### Integration Verification

- [ ] MiniBob can reach Activity-API (health check)
- [ ] Activity-API can reach SurrealDB (connection test)
- [ ] MCP server can authenticate (API key → JWT)
- [ ] Impulse resolution works for all 11 pointer types
- [ ] Dashboard receives WebSocket updates

---

## 8. Running the Tests

### Prerequisites

```bash
# 1. Deploy activity-system
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync

# 2. Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=minibob -n activity-system --timeout=300s
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=metabob-activity-api -n activity-system --timeout=300s

# 3. Verify endpoints
curl http://api.minibob.local/health
curl http://minibob.minibob.local/health
```

### Run All Tests

```bash
# Unit tests (no cluster needed)
bun test repos/minibob/src/**/*.test.ts

# Integration tests (cluster required)
bun test e2e/goal-flow-tests.spec.ts

# Manual goal test
curl -X POST http://minibob.minibob.local/goal \
  -H "Content-Type: application/json" \
  -d '{"goal": "add hello world function to utils.ts"}' | jq
```

### Debugging Failures

```bash
# Check MiniBob logs
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f

# Check Activity-API logs
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f

# Query SurrealDB directly
kubectl exec -n activity-system surrealdb-0 -- \
  surreal sql --ns activity-system --db learning_loop \
  --user root --pass $SURREALDB_PASSWORD \
  "SELECT * FROM activity_execution_traces ORDER BY created_at DESC LIMIT 5"
```
