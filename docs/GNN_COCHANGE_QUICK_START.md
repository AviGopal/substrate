# GNN Co-Change Tool Building - Quick Start

**Goal**: Use GNN predictions, impulses, and trace validation to build tools across independent containers

---

## Core Concept

```
Specification (Impulse) 
    → GNN Predictions (Co-Changes) 
    → Implementation 
    → Trace Collection 
    → Validation (vs Design Goals)
    → Annotation (Knowledge Accumulation)
```

---

## The Five Impulse Types

### 1. Specification Impulse
**What to build**

```typescript
impulse_create({
  id: "spec-my-tool",
  pointer: {
    type: "memo",
    content: `# My Tool Specification
    
## Purpose
What this tool does and why

## Requirements
- Requirement 1
- Requirement 2

## Constraints
- Must be < 5 seconds
- Must work with existing APIs

## Dependencies
- service1/endpoint
- service2/component
    `
  },
  budget: 5000,
  type: "specification",
  metadata: {
    toolName: "my-tool",
    targetRepository: ["metabob-cli"],
    constraints: ["< 5s"],
    dependencies: ["service1"]
  }
});
```

### 2. Design Decision Impulse
**Why built this way**

```typescript
impulse_create({
  id: "decision-use-jwt",
  pointer: {
    type: "memo",
    content: "Chose JWT over sessions because stateless, scalable"
  },
  type: "designDecision",
  metadata: {
    component: "auth-tool",
    alternatives: ["sessions", "api-keys"],
    tradeoffs: ["complexity for scalability"],
    constraints: ["must scale horizontally"]
  }
});
```

### 3. API Contract Impulse
**Interface definitions**

```typescript
impulse_create({
  id: "contract-auth-api",
  pointer: {
    type: "memo",
    content: `
POST /auth/login
Request: { username: string, password: string }
Response: { token: string }
    `
  },
  type: "apiContract",
  metadata: {
    endpoints: ["/auth/login"],
    consumers: ["cli"],
    producers: ["rpc-api"]
  }
});
```

### 4. Test Trace Impulse
**Runtime execution data**

```typescript
// Created automatically by TraceCollector
impulse_create({
  id: "trace-test-001",
  pointer: {
    type: "file",
    path: ".metabob/traces/test-001.json"
  },
  type: "testTrace",
  metadata: {
    testName: "test_auth_flow",
    duration: 1234,
    componentsExecuted: ["auth-tool", "rpc-api/auth"],
    dataFlow: [
      { from: "rpc-api", to: "cli", data: { token: "..." } }
    ],
    assertions: [
      { expected: true, actual: true, passed: true }
    ]
  }
});
```

### 5. Validation Rules Impulse
**Expected behavior**

```typescript
impulse_create({
  id: "validation-my-tool",
  pointer: {
    type: "memo",
    content: JSON.stringify([
      {
        id: "perf-latency",
        description: "Must complete in < 5s",
        condition: "trace.summary.duration < 5000",
        severity: "error"
      }
    ])
  },
  type: "validationRules"
});
```

---

## GNN Co-Change Prediction

### Query API

```typescript
// Ask GNN: "If I change file X, what else should I change?"

const predictions = await fetch("http://metabob-api-dev:8080/api/v1/gnn/predict-cochange", {
  method: "POST",
  body: JSON.stringify({
    changedFiles: ["src/cli/auth-tool.ts"],
    repository: "metabob-cli",
    topK: 10
  })
}).then(r => r.json());

// Response:
{
  predictions: [
    {
      file: "tests/cli/auth-tool.test.ts",
      probability: 0.95,
      reason: "Tests always updated with implementation",
      suggestedChanges: "Add test cases"
    },
    {
      file: "src/cli/index.ts",
      probability: 0.78,
      reason: "CLI commands registered here",
      suggestedChanges: "Register new command"
    }
  ]
}
```

### Use in Planning

```typescript
// Create todo list from GNN predictions
const todos = predictions.predictions
  .filter(p => p.probability > 0.6)
  .map(p => ({
    file: p.file,
    action: p.suggestedChanges,
    priority: p.probability > 0.8 ? "high" : "medium"
  }));

todowrite({ todos });
```

---

## Trace Collection

### TraceCollector Class

```typescript
import { TraceCollector } from './trace-collector';

test("my test", async () => {
  const trace = new TraceCollector();
  
  // Record test start
  trace.record({ type: "test_start", component: "my-tool", name: "my test" });
  
  // Record function call
  trace.record({ 
    type: "function_call", 
    component: "rpc-api/auth", 
    function: "login", 
    args: { username: "test" } 
  });
  
  const token = await authAPI.login({ username: "test", password: "test123" });
  
  // Record function return
  trace.record({ 
    type: "function_return", 
    component: "rpc-api/auth", 
    function: "login", 
    result: { token } 
  });
  
  // Record assertion
  trace.record({ 
    type: "assertion", 
    expected: true, 
    actual: !!token, 
    passed: !!token 
  });
  
  expect(token).toBeTruthy();
  
  // Save trace
  await trace.save("my-test-001");
  
  // Create impulse
  await impulse_create({
    id: "trace-my-test-001",
    pointer: { type: "file", path: ".metabob/traces/my-test-001.json" },
    budget: 1000,
    type: "testTrace",
    metadata: trace.summarize()
  });
});
```

### Trace Format

```json
{
  "traceId": "my-test-001",
  "events": [
    { "type": "test_start", "component": "my-tool", "timestamp": 1706389200000 },
    { "type": "function_call", "component": "rpc-api/auth", "function": "login", ... },
    { "type": "function_return", "component": "rpc-api/auth", "result": {...}, ... },
    { "type": "assertion", "expected": true, "actual": true, "passed": true, ... }
  ],
  "summary": {
    "totalEvents": 4,
    "duration": 1234,
    "componentsExecuted": ["my-tool", "rpc-api/auth"],
    "dataFlow": [
      { "from": "rpc-api/auth", "to": "cli", "data": { "token": "..." } }
    ],
    "assertions": [
      { "expected": true, "actual": true, "passed": true }
    ]
  }
}
```

---

## Trace Validation

### Validate Against Specification

```typescript
// Load trace and spec
const traceImpulse = await impulse_load({ id: "trace-my-test-001" });
const specImpulse = await impulse_load({ id: "spec-my-tool" });

// Validate
const validation = await validateTrace("trace-my-test-001", "spec-my-tool");

console.log(validation);
// {
//   passed: true,
//   violations: [],
//   suggestions: [],
//   summary: {
//     totalRules: 4,
//     passed: 4,
//     failed: 0
//   }
// }

// If failed:
if (!validation.passed) {
  console.error("Violations:", validation.violations);
  // Fix issues and re-run tests
}
```

### Validation Rules

Built-in rules check:
- **Performance**: Duration < constraint
- **Data Flow**: Required data passes between components
- **Component Coverage**: All required components executed
- **API Contract**: Responses match contract
- **Assertions**: All tests passed

---

## Knowledge Accumulation

### Annotate Components

```typescript
// After successful validation, annotate
await metabob_annotate_component({
  file_path: "src/cli/auth-tool.ts",
  component_name: "AuthTool",
  component_type: "class",
  reason: `Authentication testing tool (per spec-my-tool).
           Design: Simple CLI for ease of use.
           Validated: trace-my-test-001 (< 5s, all passed).
           MESSAGE_FOR:rpc-api/auth - Depends on /auth/login endpoint.`
});
```

### Store in Metabob Backend

```typescript
// Store validated trace for future reference
await fetch("http://metabob-api-dev:8080/api/v1/knowledge/traces", {
  method: "POST",
  body: JSON.stringify({
    traceId: "trace-my-test-001",
    specId: "spec-my-tool",
    repository: "metabob-cli",
    validationReport: validation,
    trace: await loadTrace("trace-my-test-001")
  })
});

// Store design decision
await fetch("http://metabob-api-dev:8080/api/v1/knowledge/design-decisions", {
  method: "POST",
  body: JSON.stringify({
    component: "auth-tool",
    decision: "Use JWT for authentication",
    alternatives: ["sessions", "api-keys"],
    tradeoffs: ["complexity for scalability"],
    relatedTraces: ["trace-my-test-001"]
  })
});
```

### Search for Similar Tools

```typescript
// Next time, search for similar work
const similar = await fetch("http://metabob-api-dev:8080/api/v1/knowledge/search?query=authentication&validated=true")
  .then(r => r.json());

console.log("Similar tools:", similar.results);
// Returns: Previously validated auth tools with traces
```

---

## Complete Workflow Example

### Step 1: Create Specification (Host)

```typescript
await impulse_create({
  id: "spec-user-auth-tool",
  pointer: {
    type: "memo",
    content: `# User Auth Tool
Purpose: Test JWT auth across services
Requirements: Login, verify, multi-role support
Constraints: < 5s execution`
  },
  budget: 5000,
  type: "specification",
  metadata: {
    toolName: "user-auth-tool",
    targetRepository: ["metabob-cli"],
    constraints: ["< 5s"]
  }
});

await impulse_create({
  id: "validation-user-auth-tool",
  pointer: {
    type: "memo",
    content: JSON.stringify([
      { id: "perf", description: "< 5s", condition: "duration < 5000", severity: "error" }
    ])
  },
  type: "validationRules"
});
```

### Step 2: Delegate to DevBob (Host)

```typescript
await acp_delegate({
  target: "docker://devbob-cli-agent",
  taskDescription: "Build user auth tool",
  prompt: `Build user-auth-tool following specification.
  
  1. Load spec-user-auth-tool impulse
  2. Query GNN for co-changes
  3. Implement tool + predicted files
  4. Capture traces during tests
  5. Validate against validation-user-auth-tool
  6. Annotate components
  7. Report to central API`,
  shareImpulses: ["spec-user-auth-tool", "validation-user-auth-tool"]
});
```

### Step 3: Implementation (DevBob CLI Container)

```typescript
// Load spec
const spec = await impulse_load({ id: "spec-user-auth-tool" });

// Query GNN
const gnn = await fetch("http://metabob-api-dev:8080/api/v1/gnn/predict-cochange", {
  method: "POST",
  body: JSON.stringify({
    changedFiles: ["src/cli/auth-tool.ts"],
    repository: "metabob-cli",
    topK: 5
  })
}).then(r => r.json());

// Implement tool
await write({ 
  filePath: "/workspace/src/cli/auth-tool.ts",
  content: "..." 
});

// Implement tests (GNN predicted this)
await write({ 
  filePath: "/workspace/tests/cli/auth-tool.test.ts",
  content: "..." 
});

// Run tests with trace collection
await bash({ command: "npm test -- auth-tool.test.ts" });

// Validate
const validation = await validateTrace("trace-001", "spec-user-auth-tool");

if (validation.passed) {
  // Annotate
  await metabob_annotate_component({
    file_path: "src/cli/auth-tool.ts",
    component_name: "AuthTool",
    component_type: "class",
    reason: "Auth testing tool. Validated by trace-001."
  });
  
  // Report
  await fetch("http://metabob-api-dev:8080/api/v1/knowledge/traces", {
    method: "POST",
    body: JSON.stringify({ traceId: "trace-001", specId: "spec-user-auth-tool", ... })
  });
}
```

---

## Benefits at a Glance

| Feature | Benefit |
|---------|---------|
| **Specification Impulses** | Clear requirements, constraints, dependencies |
| **GNN Predictions** | Don't forget tests, docs, related files |
| **Trace Collection** | Prove tool works as designed |
| **Trace Validation** | Automatically check performance, data flow, contracts |
| **Annotations** | Future tools learn from validated work |
| **Knowledge Search** | Reuse proven patterns |

---

## Implementation Phases

### Phase 1: Impulse System Enhancement (1 week)
- [ ] Add new impulse types (specification, designDecision, etc.)
- [ ] Implement impulse sharing via acp_delegate
- [ ] Create metabob-cli impulse commands

### Phase 2: GNN Model (2 weeks)
- [ ] Collect git history + CPG data
- [ ] Train GNN on co-change patterns
- [ ] Deploy as REST API

### Phase 3: Trace Collection (1 week)
- [ ] Implement TraceCollector
- [ ] Integrate with test framework
- [ ] Create trace impulses automatically

### Phase 4: Validation (1 week)
- [ ] Build validation rules engine
- [ ] Implement standard rules
- [ ] Generate reports

### Phase 5: Knowledge Accumulation (1 week)
- [ ] Add Metabob backend endpoints
- [ ] Auto-annotate from traces
- [ ] Build search API

---

## Quick Commands

```bash
# Create specification impulse
impulse_create --id spec-my-tool --type specification --file spec.md --budget 5000

# Query GNN
curl -X POST http://metabob-api-dev:8080/api/v1/gnn/predict-cochange \
  -d '{"changedFiles": ["src/tool.ts"], "topK": 10}'

# Validate trace
validate-trace --trace trace-001 --spec spec-my-tool

# Search knowledge
curl http://metabob-api-dev:8080/api/v1/knowledge/search?query=auth&validated=true
```

---

**Next Step**: Implement Phase 1 (Impulse System Enhancement)  
**Timeline**: 6 weeks to complete system  
**Related**: [Full Architecture](./GNN_COCHANGE_TOOLING_ARCHITECTURE.md)
