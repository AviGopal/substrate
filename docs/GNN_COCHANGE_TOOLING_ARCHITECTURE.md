# GNN Co-Change Prediction Tooling Architecture

**Status**: Design Phase  
**Created**: January 27, 2026  
**Version**: 1.0.0

---

## Executive Summary

This document describes an architecture for **specification-driven tool development** using:

1. **GNN-based Co-Change Prediction**: ML model predicts which files/components change together
2. **Metabob Integration**: Shares specifications, design decisions, and component metadata
3. **Impulse System**: Cross-container knowledge sharing (specifications, traces, design goals)
4. **Activity System**: Orchestrates tool development workflows
5. **Trace Validation**: Links runtime traces to design goals and validates outcomes

**Vision**: Independent DevBob containers build tools by:
- Reading specifications from impulses (shared design knowledge)
- Using GNN predictions to identify affected components
- Capturing execution traces during testing
- Validating traces match design goals
- Sharing learnings via Metabob annotations

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  SPECIFICATION LAYER                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Impulse System (Cross-Container Knowledge Sharing)      │  │
│  │                                                          │  │
│  │  Types:                                                  │  │
│  │    • specification - Project requirements & constraints  │  │
│  │    • designDecision - Why choices were made             │  │
│  │    • apiContract - Interface definitions                │  │
│  │    • testTrace - Runtime execution data                 │  │
│  │    • validationRules - Expected behavior                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                   PREDICTION LAYER                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  GNN Co-Change Prediction Model                          │  │
│  │                                                          │  │
│  │  Input:                                                  │  │
│  │    • Git commit history                                  │  │
│  │    • File dependency graph (from Metabob CPG)           │  │
│  │    • Component call graph                                │  │
│  │    • Past co-change patterns                            │  │
│  │                                                          │  │
│  │  Output:                                                 │  │
│  │    • Probability matrix: P(file_j changes | file_i)     │  │
│  │    • Component-level predictions                         │  │
│  │    • Confidence scores                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                 DEVELOPMENT LAYER                               │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ DevBob Container │  │ DevBob Container │  │ DevBob       │ │
│  │ (rpc-api)        │  │ (dashboard)      │  │ (cli)        │ │
│  │                  │  │                  │  │              │ │
│  │ 1. Read spec     │  │ 1. Read spec     │  │ 1. Read spec │ │
│  │    (impulse)     │  │    (impulse)     │  │    (impulse) │ │
│  │ 2. Query GNN     │  │ 2. Query GNN     │  │ 2. Query GNN │ │
│  │ 3. Modify files  │  │ 3. Modify files  │  │ 3. Modify    │ │
│  │ 4. Capture trace │  │ 4. Capture trace │  │ 4. Capture   │ │
│  │ 5. Validate      │  │ 5. Validate      │  │ 5. Validate  │ │
│  │ 6. Annotate      │  │ 6. Annotate      │  │ 6. Annotate  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                  VALIDATION LAYER                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Trace Validator (Design Goal Alignment)                 │  │
│  │                                                          │  │
│  │  1. Compare runtime traces to specification             │  │
│  │  2. Verify API contracts honored                        │  │
│  │  3. Check performance constraints met                   │  │
│  │  4. Validate data flow matches design                   │  │
│  │  5. Report deviations and suggest fixes                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                   LEARNING LAYER                                │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Metabob Backend (Knowledge Accumulation)                │  │
│  │                                                          │  │
│  │  • Store validated traces                                │  │
│  │  • Update GNN training data with new co-changes         │  │
│  │  • Annotate components with design decisions            │  │
│  │  • Build specification corpus for future tools          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Deep-Dive

### 1. Impulse System for Specification Sharing

**What**: Impulses are serializable knowledge containers shared across containers

**Impulse Types for Tool Building**:

```typescript
// Specification Impulse - What to build
interface SpecificationImpulse {
  id: string;
  type: "specification";
  pointer: {
    type: "memo";
    content: string;  // Markdown specification
  };
  budget: number;
  priority: "high" | "medium" | "low";
  metadata: {
    toolName: string;
    version: string;
    targetRepository: string[];  // ["metabob-rpc-api", "metabob-dashboard"]
    constraints: string[];        // ["backward-compatible", "< 100ms latency"]
    dependencies: string[];       // Other tool names
  };
}

// Design Decision Impulse - Why built this way
interface DesignDecisionImpulse {
  id: string;
  type: "designDecision";
  pointer: {
    type: "memo";
    content: string;  // Why choice was made
  };
  metadata: {
    component: string;            // Which component this affects
    alternatives: string[];       // Other options considered
    tradeoffs: string[];         // What was sacrificed
    constraints: string[];       // What forced this decision
    relatedDecisions: string[];  // Links to other decisions
  };
}

// API Contract Impulse - Interface definition
interface APIContractImpulse {
  id: string;
  type: "apiContract";
  pointer: {
    type: "memo";
    content: string;  // OpenAPI spec, TypeScript types, etc.
  };
  metadata: {
    endpoints: string[];
    version: string;
    consumers: string[];         // Who depends on this
    producers: string[];         // Who implements this
  };
}

// Test Trace Impulse - Runtime execution data
interface TestTraceImpulse {
  id: string;
  type: "testTrace";
  pointer: {
    type: "file";               // Points to trace file
    path: string;               // .metabob/traces/{traceId}.json
  };
  budget: number;
  metadata: {
    testName: string;
    timestamp: string;
    duration: number;
    componentsExecuted: string[];
    dataFlow: {
      from: string;
      to: string;
      data: any;
      timestamp: number;
    }[];
    assertions: {
      expected: any;
      actual: any;
      passed: boolean;
    }[];
  };
}

// Validation Rules Impulse - Expected behavior
interface ValidationRulesImpulse {
  id: string;
  type: "validationRules";
  pointer: {
    type: "memo";
    content: string;  // Rules in structured format
  };
  metadata: {
    rules: {
      id: string;
      description: string;
      condition: string;        // Predicate to check
      severity: "error" | "warning" | "info";
      relatedSpec: string;      // Links to specification impulse
    }[];
  };
}
```

**Impulse Lifecycle**:

```typescript
// Step 1: Create specification impulse (in host or any container)
await impulse_create({
  id: "spec-user-auth-tool",
  pointer: {
    type: "memo",
    content: `
# User Authentication Tool Specification

## Purpose
Build a CLI tool to test user authentication flows across all services.

## Requirements
- Must work with JWT tokens from rpc-api
- Must test dashboard login flow
- Must validate token expiry handling
- Must support multiple user roles

## Constraints
- Must be < 500 lines of code
- Must have 90%+ test coverage
- Must run in < 5 seconds

## Dependencies
- metabob-rpc-api auth endpoints
- metabob-dashboard auth components
    `
  },
  budget: 5000,
  priority: "high",
  type: "specification",
  metadata: {
    toolName: "user-auth-tool",
    version: "1.0.0",
    targetRepository: ["metabob-cli"],
    constraints: ["< 500 LOC", "90% coverage", "< 5s runtime"],
    dependencies: []
  }
});

// Step 2: Share impulse with target container
await acp_delegate({
  target: "docker://devbob-cli",
  taskDescription: "Build user authentication testing tool",
  prompt: `Build the user authentication testing tool per specification.
  
  Use the specification impulse for requirements and constraints.
  Query GNN to identify related authentication components.
  Implement the tool with comprehensive tests.
  Capture execution traces during testing.
  Validate traces match design goals.`,
  shareImpulses: ["spec-user-auth-tool"],
  timeout: 600
});

// Step 3: Container reads impulse during execution
const impulse = await impulse_load({ id: "spec-user-auth-tool" });
const spec = impulse.pointer.content;  // Markdown specification
const constraints = impulse.metadata.constraints;

// Step 4: Create trace impulse after testing
await impulse_create({
  id: "trace-user-auth-tool-test-001",
  pointer: {
    type: "file",
    path: ".metabob/traces/user-auth-tool-test-001.json"
  },
  budget: 2000,
  type: "testTrace",
  metadata: {
    testName: "test_jwt_flow",
    timestamp: new Date().toISOString(),
    duration: 1234,
    componentsExecuted: ["cli/auth-tool", "rpc-api/auth", "dashboard/login"],
    dataFlow: [...],
    assertions: [...]
  }
});

// Step 5: Validate trace against specification
const validation = await validateTrace("trace-user-auth-tool-test-001", "spec-user-auth-tool");
// Returns: { passed: true, violations: [], suggestions: [] }
```

---

### 2. GNN Co-Change Prediction Model

**What**: Graph Neural Network that learns which files/components change together

**Training Data**:

```typescript
interface CoChangeTrainingData {
  // Git commit history
  commits: {
    hash: string;
    filesChanged: string[];
    message: string;
    timestamp: string;
    author: string;
  }[];
  
  // Code structure from Metabob CPG
  graph: {
    nodes: {
      id: string;              // file path or component ID
      type: "file" | "class" | "function" | "method";
      features: number[];      // Embeddings from code
    }[];
    edges: {
      from: string;
      to: string;
      type: "imports" | "calls" | "inherits" | "uses";
      weight: number;
    }[];
  };
  
  // Past co-change patterns
  cochangeHistory: {
    file1: string;
    file2: string;
    cochangeCount: number;      // How many times changed together
    totalCommits: number;       // Out of how many commits
    probability: number;        // cochangeCount / totalCommits
  }[];
}
```

**Model Architecture**:

```python
class CoChangeGNN(torch.nn.Module):
    def __init__(self, node_features, hidden_dim, num_layers):
        super().__init__()
        
        # Graph convolution layers
        self.conv1 = GCNConv(node_features, hidden_dim)
        self.conv2 = GCNConv(hidden_dim, hidden_dim)
        self.conv3 = GCNConv(hidden_dim, hidden_dim)
        
        # Attention mechanism for co-change prediction
        self.attention = MultiHeadAttention(hidden_dim, num_heads=4)
        
        # Co-change probability predictor
        self.predictor = torch.nn.Sequential(
            torch.nn.Linear(hidden_dim * 2, hidden_dim),
            torch.nn.ReLU(),
            torch.nn.Linear(hidden_dim, 1),
            torch.nn.Sigmoid()  # Probability of co-change
        )
    
    def forward(self, x, edge_index, file_pair_indices):
        # Propagate node features through graph
        x = F.relu(self.conv1(x, edge_index))
        x = F.relu(self.conv2(x, edge_index))
        x = F.relu(self.conv3(x, edge_index))
        
        # Apply attention to capture long-range dependencies
        x = self.attention(x, x, x)
        
        # Predict co-change probability for file pairs
        file1_emb = x[file_pair_indices[:, 0]]
        file2_emb = x[file_pair_indices[:, 1]]
        pair_emb = torch.cat([file1_emb, file2_emb], dim=1)
        
        return self.predictor(pair_emb)  # [batch_size, 1]
```

**Inference API**:

```typescript
// Hosted in metabob-rpc-api
POST /api/v1/gnn/predict-cochange
{
  changedFiles: string[];       // Files being modified
  repository: string;           // Which repo
  topK: number;                 // Return top K likely co-changes
}

Response:
{
  predictions: [
    {
      file: "src/auth/jwt.ts",
      probability: 0.87,
      reason: "Frequently changes with auth.ts (65% of commits)",
      components: ["verify_token", "decode_jwt"],
      suggestedChanges: "Update token validation logic"
    },
    {
      file: "tests/auth/jwt.test.ts",
      probability: 0.92,
      reason: "Tests always updated with implementation",
      components: ["test_verify_token"],
      suggestedChanges: "Add test cases for new validation"
    }
  ],
  confidence: 0.89
}
```

**Usage in Tool Development**:

```typescript
// Agent queries GNN before implementing
const changedFiles = ["src/cli/auth-tool.ts"];  // New tool being built

const predictions = await fetch("http://metabob-api-dev:8080/api/v1/gnn/predict-cochange", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    changedFiles,
    repository: "metabob-cli",
    topK: 10
  })
}).then(r => r.json());

// predictions.predictions:
// - tests/cli/auth-tool.test.ts (0.95) - Add tests
// - src/cli/index.ts (0.78) - Register new command
// - docs/cli-commands.md (0.65) - Document new tool
// - src/shared/auth-types.ts (0.45) - May need type updates

// Agent creates todo list based on predictions
const todos = predictions.predictions
  .filter(p => p.probability > 0.6)
  .map(p => ({
    file: p.file,
    action: p.suggestedChanges,
    priority: p.probability > 0.8 ? "high" : "medium"
  }));
```

---

### 3. Trace Collection During Testing

**What**: Capture runtime execution data to validate against design goals

**Instrumentation**:

```typescript
// Trace collector (injected during test execution)
class TraceCollector {
  traces: TraceEvent[] = [];
  
  record(event: TraceEvent) {
    this.traces.push({
      ...event,
      timestamp: Date.now(),
      stack: new Error().stack  // Capture call stack
    });
  }
  
  async save(traceId: string) {
    await fs.writeFile(
      `.metabob/traces/${traceId}.json`,
      JSON.stringify({
        traceId,
        events: this.traces,
        summary: this.summarize()
      }, null, 2)
    );
  }
  
  summarize() {
    return {
      totalEvents: this.traces.length,
      duration: this.traces[this.traces.length - 1].timestamp - this.traces[0].timestamp,
      componentsExecuted: [...new Set(this.traces.map(t => t.component))],
      dataFlow: this.buildDataFlow(),
      assertions: this.traces.filter(t => t.type === "assertion")
    };
  }
  
  buildDataFlow() {
    // Track data as it flows between components
    const flows: DataFlow[] = [];
    for (let i = 1; i < this.traces.length; i++) {
      const prev = this.traces[i - 1];
      const curr = this.traces[i];
      
      if (curr.type === "function_call" && prev.type === "function_return") {
        flows.push({
          from: prev.component,
          to: curr.component,
          data: curr.args,
          timestamp: curr.timestamp
        });
      }
    }
    return flows;
  }
}

// Usage in tests
test("JWT authentication flow", async () => {
  const trace = new TraceCollector();
  
  // Instrument code
  trace.record({ type: "test_start", component: "auth-tool", name: "JWT flow" });
  
  // Step 1: Get token from rpc-api
  trace.record({ type: "function_call", component: "rpc-api/auth", function: "login", args: { username: "test" } });
  const token = await authAPI.login({ username: "test", password: "test123" });
  trace.record({ type: "function_return", component: "rpc-api/auth", function: "login", result: { token } });
  
  // Step 2: Verify token
  trace.record({ type: "function_call", component: "cli/auth-tool", function: "verifyToken", args: { token } });
  const valid = await authTool.verifyToken(token);
  trace.record({ type: "function_return", component: "cli/auth-tool", function: "verifyToken", result: { valid } });
  
  // Step 3: Assert
  trace.record({ type: "assertion", expected: true, actual: valid, passed: valid === true });
  expect(valid).toBe(true);
  
  // Save trace
  await trace.save("jwt-flow-001");
  
  // Create trace impulse
  await impulse_create({
    id: "trace-jwt-flow-001",
    pointer: { type: "file", path: ".metabob/traces/jwt-flow-001.json" },
    budget: 1000,
    type: "testTrace",
    metadata: trace.summarize()
  });
});
```

**Trace Format**:

```json
{
  "traceId": "jwt-flow-001",
  "events": [
    {
      "type": "test_start",
      "component": "auth-tool",
      "name": "JWT flow",
      "timestamp": 1706389200000
    },
    {
      "type": "function_call",
      "component": "rpc-api/auth",
      "function": "login",
      "args": { "username": "test" },
      "timestamp": 1706389200100,
      "stack": "..."
    },
    {
      "type": "function_return",
      "component": "rpc-api/auth",
      "function": "login",
      "result": { "token": "eyJ..." },
      "timestamp": 1706389200250
    },
    ...
  ],
  "summary": {
    "totalEvents": 12,
    "duration": 1234,
    "componentsExecuted": ["auth-tool", "rpc-api/auth", "cli/auth-tool"],
    "dataFlow": [
      {
        "from": "rpc-api/auth",
        "to": "cli/auth-tool",
        "data": { "token": "eyJ..." },
        "timestamp": 1706389200250
      }
    ],
    "assertions": [
      { "expected": true, "actual": true, "passed": true }
    ]
  }
}
```

---

### 4. Trace Validation Against Design Goals

**What**: Compare runtime behavior to specification and design decisions

**Validation Rules Engine**:

```typescript
interface ValidationRule {
  id: string;
  description: string;
  condition: (trace: Trace, spec: Specification) => boolean;
  severity: "error" | "warning" | "info";
  suggestion?: string;
}

const validationRules: ValidationRule[] = [
  // Performance constraint
  {
    id: "perf-latency",
    description: "Tool must complete in < 5 seconds",
    condition: (trace, spec) => {
      const constraint = spec.constraints.find(c => c.includes("5s"));
      return constraint ? trace.summary.duration < 5000 : true;
    },
    severity: "error",
    suggestion: "Optimize slow operations or use caching"
  },
  
  // Data flow validation
  {
    id: "data-flow-auth-token",
    description: "JWT token must flow from rpc-api to cli",
    condition: (trace, spec) => {
      const flow = trace.summary.dataFlow.find(f => 
        f.from.includes("rpc-api/auth") && 
        f.to.includes("cli") &&
        f.data.token
      );
      return !!flow;
    },
    severity: "error",
    suggestion: "Ensure token is passed from API to CLI tool"
  },
  
  // Component coverage
  {
    id: "component-coverage",
    description: "All required components must be executed",
    condition: (trace, spec) => {
      const required = spec.metadata.dependencies || [];
      const executed = trace.summary.componentsExecuted;
      return required.every(req => executed.some(ex => ex.includes(req)));
    },
    severity: "warning",
    suggestion: "Add test coverage for missing components"
  },
  
  // API contract adherence
  {
    id: "api-contract",
    description: "API responses must match contract",
    condition: (trace, spec) => {
      // Check if all function returns match expected types
      const apiCalls = trace.events.filter(e => e.type === "function_return" && e.component.includes("api"));
      return apiCalls.every(call => validateAgainstContract(call, spec));
    },
    severity: "error",
    suggestion: "Fix API response to match contract"
  }
];

async function validateTrace(traceId: string, specId: string): Promise<ValidationReport> {
  // Load trace and specification
  const traceImpulse = await impulse_load({ id: traceId });
  const specImpulse = await impulse_load({ id: specId });
  
  const trace = JSON.parse(await fs.readFile(traceImpulse.pointer.path, "utf-8"));
  const spec = parseSpecification(specImpulse.pointer.content);
  
  // Run all validation rules
  const results = validationRules.map(rule => ({
    ruleId: rule.id,
    description: rule.description,
    passed: rule.condition(trace, spec),
    severity: rule.severity,
    suggestion: rule.suggestion
  }));
  
  const violations = results.filter(r => !r.passed);
  
  return {
    traceId,
    specId,
    passed: violations.filter(v => v.severity === "error").length === 0,
    violations,
    suggestions: violations.map(v => v.suggestion).filter(Boolean),
    summary: {
      totalRules: results.length,
      passed: results.filter(r => r.passed).length,
      failed: violations.length,
      errors: violations.filter(v => v.severity === "error").length,
      warnings: violations.filter(v => v.severity === "warning").length
    }
  };
}
```

**Validation Report**:

```json
{
  "traceId": "trace-jwt-flow-001",
  "specId": "spec-user-auth-tool",
  "passed": true,
  "violations": [],
  "suggestions": [],
  "summary": {
    "totalRules": 4,
    "passed": 4,
    "failed": 0,
    "errors": 0,
    "warnings": 0
  }
}
```

---

### 5. Knowledge Accumulation in Metabob

**What**: Store validated traces and design decisions for future tool development

**Metabob Backend Endpoints**:

```typescript
// Store validated trace
POST /api/v1/knowledge/traces
{
  traceId: string;
  specId: string;
  repository: string;
  validationReport: ValidationReport;
  trace: Trace;
}

// Store design decision
POST /api/v1/knowledge/design-decisions
{
  component: string;
  decision: string;
  alternatives: string[];
  tradeoffs: string[];
  relatedTraces: string[];  // Links to traces that validate this decision
}

// Query knowledge for similar tools
GET /api/v1/knowledge/search?query=authentication&type=trace&validated=true

Response:
{
  results: [
    {
      traceId: "trace-jwt-flow-001",
      specId: "spec-user-auth-tool",
      repository: "metabob-cli",
      summary: "JWT authentication flow validated successfully",
      componentsUsed: ["rpc-api/auth", "cli/auth-tool"],
      designDecisions: [
        {
          component: "cli/auth-tool",
          decision: "Use JWT instead of session cookies",
          reason: "Stateless, scalable across services",
          validatedBy: "trace-jwt-flow-001"
        }
      ]
    }
  ]
}
```

**Annotation Integration**:

```typescript
// After successful validation, annotate components
async function annotateFromValidatedTrace(traceId: string) {
  const trace = await loadTrace(traceId);
  const spec = await loadSpecification(trace.specId);
  
  // Annotate each component with its role in the design
  for (const component of trace.summary.componentsExecuted) {
    const role = determineComponentRole(component, trace, spec);
    
    await metabob_annotate_component({
      file_path: componentToFile(component),
      component_name: component,
      component_type: "function",
      reason: `Used in ${spec.metadata.toolName}: ${role}. 
               Validated by trace ${traceId}.
               Performance: ${trace.summary.duration}ms.
               Data flow: ${describeDataFlow(component, trace)}.
               MESSAGE_FOR:${getRelatedComponents(component, trace).join(",")}`
    });
  }
}

function determineComponentRole(component: string, trace: Trace, spec: Specification): string {
  const events = trace.events.filter(e => e.component === component);
  
  if (events.some(e => e.type === "function_call" && e.function.includes("login"))) {
    return "Provides authentication tokens for user login flow";
  } else if (events.some(e => e.type === "function_call" && e.function.includes("verify"))) {
    return "Validates JWT tokens for secure API access";
  }
  
  return "Supports authentication tooling";
}
```

---

## Tool Development Workflow

### End-to-End Example: Building "user-auth-tool"

**Phase 1: Specification Creation (Host or Lead Agent)**

```typescript
// 1. Create specification impulse
await impulse_create({
  id: "spec-user-auth-tool",
  pointer: {
    type: "memo",
    content: `
# User Authentication Tool

## Purpose
CLI tool to test authentication flows across all services.

## Requirements
- Test JWT token generation
- Test token validation
- Test token expiry
- Support multiple user roles (admin, user, guest)

## Constraints
- Must complete in < 5 seconds
- Must work with existing rpc-api auth endpoints
- Must not modify existing auth logic

## Design Goals
- Simple CLI interface: \`auth-tool test --user admin\`
- Clear success/failure output
- Return exit code 0 on success, 1 on failure

## Dependencies
- metabob-rpc-api: /auth/login, /auth/verify
- JWT library for token decoding
    `
  },
  budget: 5000,
  priority: "high",
  type: "specification",
  metadata: {
    toolName: "user-auth-tool",
    version: "1.0.0",
    targetRepository: ["metabob-cli"],
    constraints: ["< 5s", "no auth logic changes"],
    dependencies: ["metabob-rpc-api/auth"]
  }
});

// 2. Create API contract impulse
await impulse_create({
  id: "contract-rpc-api-auth",
  pointer: {
    type: "memo",
    content: `
# RPC API Auth Contract

POST /auth/login
Request: { username: string, password: string }
Response: { token: string, expiresAt: string }

POST /auth/verify
Request: { token: string }
Response: { valid: boolean, user: { id: string, role: string } }
    `
  },
  budget: 2000,
  type: "apiContract",
  metadata: {
    endpoints: ["/auth/login", "/auth/verify"],
    version: "1.0.0",
    consumers: ["metabob-cli"],
    producers: ["metabob-rpc-api"]
  }
});

// 3. Create validation rules impulse
await impulse_create({
  id: "validation-user-auth-tool",
  pointer: {
    type: "memo",
    content: JSON.stringify([
      {
        id: "perf-latency",
        description: "Must complete in < 5 seconds",
        condition: "trace.summary.duration < 5000",
        severity: "error"
      },
      {
        id: "data-flow-token",
        description: "JWT token must flow from rpc-api to cli",
        condition: "trace.summary.dataFlow.some(f => f.from.includes('rpc-api') && f.data.token)",
        severity: "error"
      },
      {
        id: "all-roles-tested",
        description: "Must test admin, user, and guest roles",
        condition: "['admin', 'user', 'guest'].every(role => trace.events.some(e => e.args?.role === role))",
        severity: "warning"
      }
    ])
  },
  budget: 1000,
  type: "validationRules",
  metadata: {
    rules: [...]
  }
});
```

**Phase 2: Delegation to DevBob CLI Agent**

```typescript
// Delegate to devbob-cli container
const result = await acp_delegate({
  target: "docker://devbob-cli-agent",
  taskDescription: "Build user authentication testing tool",
  prompt: `Build the user authentication testing tool.

IMPORTANT: Follow this workflow:
1. Read specification impulse: spec-user-auth-tool
2. Read API contract impulse: contract-rpc-api-auth
3. Query GNN for co-change predictions
4. Implement the tool with predicted co-changes
5. Write comprehensive tests
6. Capture execution traces during testing
7. Validate traces against validation-user-auth-tool
8. Annotate components with design decisions
9. Report results to central API

Use activity template if available, or implement manually.`,
  shareImpulses: [
    "spec-user-auth-tool",
    "contract-rpc-api-auth",
    "validation-user-auth-tool"
  ],
  timeout: 900
});
```

**Phase 3: Implementation in DevBob CLI Container**

```typescript
// Inside devbob-cli agent session

// Step 1: Load specification
const specImpulse = await impulse_load({ id: "spec-user-auth-tool" });
const spec = parseSpecification(specImpulse.pointer.content);
console.log("Building:", spec.metadata.toolName);
console.log("Constraints:", spec.metadata.constraints);

// Step 2: Load API contract
const contractImpulse = await impulse_load({ id: "contract-rpc-api-auth" });
const contract = parseAPIContract(contractImpulse.pointer.content);
console.log("API endpoints:", contract.endpoints);

// Step 3: Query GNN for co-change predictions
const gnnPredictions = await fetch("http://metabob-api-dev:8080/api/v1/gnn/predict-cochange", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    changedFiles: ["src/cli/auth-tool.ts"],
    repository: "metabob-cli",
    topK: 10
  })
}).then(r => r.json());

console.log("GNN predictions:", gnnPredictions.predictions);
// Predicted co-changes:
// - tests/cli/auth-tool.test.ts (0.95)
// - src/cli/index.ts (0.78)
// - docs/cli-commands.md (0.65)

// Step 4: Implement tool
await write({
  filePath: "/workspace/src/cli/auth-tool.ts",
  content: `
import { Command } from 'commander';
import { AuthAPI } from '../api/auth';

export class AuthTool {
  async testAuthentication(role: string): Promise<boolean> {
    try {
      // Login
      const { token } = await AuthAPI.login({
        username: \`test-\${role}\`,
        password: 'test123'
      });
      
      // Verify token
      const { valid, user } = await AuthAPI.verify({ token });
      
      return valid && user.role === role;
    } catch (error) {
      console.error("Auth test failed:", error.message);
      return false;
    }
  }
}

// CLI command
const program = new Command();
program
  .command('test')
  .option('--user <role>', 'User role to test')
  .action(async (options) => {
    const tool = new AuthTool();
    const success = await tool.testAuthentication(options.user || 'user');
    
    console.log(success ? "✓ Auth test passed" : "✗ Auth test failed");
    process.exit(success ? 0 : 1);
  });
  `
});

// Step 5: Implement tests (as predicted by GNN)
await write({
  filePath: "/workspace/tests/cli/auth-tool.test.ts",
  content: `
import { AuthTool } from '../../src/cli/auth-tool';
import { TraceCollector } from '../trace-collector';

describe('AuthTool', () => {
  test('JWT authentication flow', async () => {
    const trace = new TraceCollector();
    const tool = new AuthTool();
    
    trace.record({ type: 'test_start', component: 'auth-tool', name: 'JWT flow' });
    
    // Test admin role
    const adminSuccess = await tool.testAuthentication('admin');
    expect(adminSuccess).toBe(true);
    
    // Test user role
    const userSuccess = await tool.testAuthentication('user');
    expect(userSuccess).toBe(true);
    
    // Save trace
    await trace.save('jwt-flow-001');
    
    // Create trace impulse
    await impulse_create({
      id: 'trace-jwt-flow-001',
      pointer: { type: 'file', path: '.metabob/traces/jwt-flow-001.json' },
      budget: 1000,
      type: 'testTrace',
      metadata: trace.summarize()
    });
  });
});
  `
});

// Step 6: Run tests and capture traces
await bash({ command: "npm test -- auth-tool.test.ts" });

// Step 7: Validate traces
const validation = await validateTrace("trace-jwt-flow-001", "spec-user-auth-tool");
console.log("Validation:", validation);

if (!validation.passed) {
  console.error("Validation failed:", validation.violations);
  // Fix issues and re-run
}

// Step 8: Annotate components
await metabob_annotate_component({
  file_path: "src/cli/auth-tool.ts",
  component_name: "AuthTool",
  component_type: "class",
  reason: `Authentication testing tool. 
           Purpose: Test JWT flows across services (per spec-user-auth-tool).
           Design decision: Use simple CLI interface for ease of use.
           Validated by: trace-jwt-flow-001 (< 5s, all assertions passed).
           MESSAGE_FOR:rpc-api/auth - Depends on /auth/login and /auth/verify endpoints.`
});

// Step 9: Report to central API
await fetch("http://metabob-api-dev:8080/api/v1/knowledge/traces", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    traceId: "trace-jwt-flow-001",
    specId: "spec-user-auth-tool",
    repository: "metabob-cli",
    validationReport: validation,
    trace: await loadTrace("trace-jwt-flow-001")
  })
});
```

**Phase 4: Learning and Reuse**

```typescript
// Next time someone builds a similar tool:

// Query knowledge base for similar tools
const similar = await fetch("http://metabob-api-dev:8080/api/v1/knowledge/search?query=authentication&type=trace&validated=true")
  .then(r => r.json());

console.log("Similar tools:", similar.results);
// Returns: user-auth-tool (validated, < 5s, all tests passed)

// Load specification as reference
const refSpec = await impulse_load({ id: "spec-user-auth-tool" });

// Load validated trace as example
const refTrace = await impulse_load({ id: "trace-jwt-flow-001" });

// Build new tool following proven pattern
```

---

## Activity Templates for Tool Building

### Template: build-tool-from-specification

```json
{
  "name": "Build Tool from Specification",
  "description": "Build a new tool following a specification impulse with GNN-guided co-change predictions and trace validation",
  "category": "tool",
  "tasks": [
    {
      "id": "task-1",
      "subagent": "general",
      "description": "Load specification and plan implementation",
      "prompt": {
        "template": "Load specification impulse {{specId}} and plan implementation. Query GNN for co-change predictions. Create implementation plan.",
        "variables": [
          { "name": "specId", "type": "string", "required": true }
        ]
      }
    },
    {
      "id": "task-2",
      "subagent": "general",
      "description": "Implement tool and predicted co-changes",
      "dependencies": ["task-1"],
      "prompt": {
        "template": "Implement the tool based on specification. Include all GNN-predicted co-changes (tests, docs, etc.)."
      }
    },
    {
      "id": "task-3",
      "subagent": "general",
      "description": "Run tests and capture traces",
      "dependencies": ["task-2"],
      "prompt": {
        "template": "Run tests with TraceCollector. Capture all execution traces. Save as trace impulses."
      }
    },
    {
      "id": "task-4",
      "subagent": "general",
      "description": "Validate traces against specification",
      "dependencies": ["task-3"],
      "prompt": {
        "template": "Validate all traces against {{specId}}. Fix any violations. Re-run if needed."
      }
    },
    {
      "id": "task-5",
      "subagent": "general",
      "description": "Annotate and report",
      "dependencies": ["task-4"],
      "prompt": {
        "template": "Annotate components with design decisions. Report validated traces to central API. Create design decision impulses."
      }
    }
  ]
}
```

---

## Implementation Roadmap

### Phase 1: Impulse System Enhancement (1 week)
- Add new impulse types: specification, designDecision, apiContract, testTrace, validationRules
- Implement impulse sharing across containers via acp_delegate
- Create impulse management commands in metabob-cli

### Phase 2: GNN Co-Change Model (2 weeks)
- Collect training data from git history + Metabob CPG
- Train GNN model on co-change patterns
- Deploy model as REST API in metabob-rpc-api
- Integrate with activity system for automatic queries

### Phase 3: Trace Collection (1 week)
- Implement TraceCollector class
- Add instrumentation to test framework
- Create trace storage (.metabob/traces/)
- Implement trace impulse creation

### Phase 4: Trace Validation (1 week)
- Implement validation rules engine
- Create standard validation rules
- Integrate with specification impulses
- Generate validation reports

### Phase 5: Knowledge Accumulation (1 week)
- Add Metabob backend endpoints for traces and design decisions
- Implement automatic annotation from validated traces
- Create search API for similar tools
- Build learning dashboard

### Phase 6: Activity Templates (3 days)
- Create build-tool-from-specification template
- Create validate-trace-against-spec template
- Create update-tool-from-feedback template
- Test end-to-end workflows

---

## Benefits

1. **Specification-Driven Development**: Tools built to clear requirements
2. **Predictive Co-Changes**: GNN reduces forgotten files/tests
3. **Runtime Validation**: Traces prove design goals met
4. **Knowledge Reuse**: Future tools learn from validated past work
5. **Cross-Container Coordination**: Impulses share knowledge seamlessly
6. **Continuous Learning**: Every validated trace improves GNN model

---

## Related Documents
- [DEVBOB_SELF_SUSTAINING_ROADMAP.md](./DEVBOB_SELF_SUSTAINING_ROADMAP.md)
- [INTENT_DRIVEN_DATAFLOW_ORCHESTRATION.md](./INTENT_DRIVEN_DATAFLOW_ORCHESTRATION.md)
- [IMPULSE_SYSTEM_GUIDE.md](./IMPULSE_SYSTEM_GUIDE.md) (to be created)

---

**Status**: Design Complete  
**Next**: Implement Phase 1 (Impulse System Enhancement)  
**Timeline**: 6 weeks to full system
