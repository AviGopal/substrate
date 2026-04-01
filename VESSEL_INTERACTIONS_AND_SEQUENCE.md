# Vessel Interactions and Required Sequence

**Purpose**: Document how vessels interact with the backend and each other using existing idioms (impulses, activities, traces).

---

## The Main Vessel: MiniBob

### Role
**MiniBob is the PRIMARY execution vessel** - it orchestrates goal achievement through activity composition.

### Responsibilities

1. **Receive User Goals**
   ```typescript
   User: "Add authentication"
   MiniBob: Converts to structured goal with intent/context
   ```

2. **Request Activity Recommendations**
   ```typescript
   // Via impulse (NEW way):
   createGoalImpulse(goal.intent)
   loadImpulse(goalImpulseId) → Backend resolves → Recommendations

   // Via direct API (DEPRECATED way):
   mcp.recommendActivities(goal.intent) → Recommendations
   ```

3. **Load Activity Templates**
   ```typescript
   loadTemplateFromMCPOrLocal(templateId)
   // Tries backend first, falls back to local files
   ```

4. **Execute Activities**
   ```typescript
   ActivityExecutor.execute(template, variables)
   // Runs tasks with LLM + tools
   ```

5. **Verify & Backtrack**
   ```typescript
   // Check alignment after each stage
   verifyStageAlignment(stage, result)
   // If misaligned: try alternate or improvise
   ```

6. **Store Execution Traces**
   ```typescript
   mcp.storeExecutionTrace(execution)
   // Backend learns patterns
   ```

7. **Compose Activities** (Progressive Composition)
   ```typescript
   // Within activity tasks:
   execute_activity({
     templateId: "setup-auth-middleware",
     variables: {}
   })
   ```

---

## Backend: metabob-activity-api

### Role
**Trace Store + Pattern Learner** - NOT a vessel, but serves vessel-created data.

### Responsibilities

1. **Authenticate Vessels**
   ```typescript
   POST /v2/auth/minibob/signin
   // Returns JWT with org_id for RBAC
   ```

2. **Store Execution Traces**
   ```typescript
   POST /v2/activities/execution-traces
   // Receives traces from any vessel
   ```

3. **Recommend Activities** (Thompson Sampling)
   ```typescript
   POST /v2/activities/recommend
   // Uses historical traces to rank templates
   ```

4. **Serve Templates**
   ```typescript
   GET /v2/activities/templates/:id
   // Templates created by any vessel
   ```

5. **Resolve Historical Impulses**
   ```typescript
   POST /v2/traces/query (FUTURE)
   // Unified query interface for all trace types
   ```

6. **Learn Patterns**
   ```typescript
   // Background processes:
   - Update Thompson Sampling scores
   - Mine composition patterns
   - Discover execution sequences
   - Calculate impulse relevance
   ```

---

## Other Vessels

### Identity-Vessel

**Role**: User/API key authentication

**Interaction with Backend**:
```typescript
// Backend delegates user auth to identity-vessel
POST /v2/auth/user/login → identity-vessel handles
// identity-vessel returns JWT token
// Backend stores token in session
```

**Interaction with MiniBob**:
- None directly
- Both authenticate independently with backend
- Share org_id for multi-tenant isolation

### React-Renderer (Example Future Vessel)

**Role**: UI component generation

**Responsibilities**:
```typescript
// Resolves UI-type impulses
{
  id: "login-form",
  type: "uiComponent",
  pointer: { type: "react", componentName: "LoginForm" }
}

// React-Renderer vessel:
loadImpulse("login-form") → Generates React component
```

**Interaction with Backend**:
```typescript
// Stores UI execution traces
POST /v2/activities/execution-traces
{
  vessel_id: "react-renderer-001",
  activity_id: "generate-login-form",
  output_impulses: ["ui:login-form-jsx"]
}
```

**Interaction with MiniBob**:
```typescript
// MiniBob delegates UI generation to React-Renderer
// Via impulse resolution:

MiniBob: createImpulse({
  type: "uiComponent",
  pointer: { componentName: "LoginForm" }
})

loadImpulse() → Vessel discovery → React-Renderer resolves
```

---

## Required Sequence: Goal → Execution → Learning

### Sequence 1: Simple Goal (No Composition)

```
┌──────────────────────────────────────────────────────────┐
│ User: "Create a hello world script"                     │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ MiniBob: Parse Goal                                    │
│ - Type: feature                                        │
│ - Intent: "Create simple hello world script"          │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ MiniBob → Backend: Get Recommendations                │
│ POST /v2/activities/recommend                         │
│ {                                                      │
│   task_description: "Create simple hello world",     │
│   category: "feature",                                │
│   limit: 3                                            │
│ }                                                      │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Backend: Thompson Sampling                            │
│ - Query execution traces                              │
│ - Rank templates by success rate                      │
│ - Sample from Beta(alpha, beta) distributions         │
│ - Return top 3 ranked                                 │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Backend → MiniBob: Recommendations                    │
│ {                                                      │
│   recommendations: [                                  │
│     {                                                  │
│       template_id: "hello-world-minimal",            │
│       selection_metadata: {                           │
│         sampled_value: 0.85,                         │
│         alpha: 10, beta: 2                           │
│       }                                                │
│     }                                                  │
│   ]                                                    │
│ }                                                      │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ MiniBob: Load Template                                │
│ GET /v2/activities/templates/hello-world-minimal      │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Backend → MiniBob: Template JSON                      │
│ {                                                      │
│   id: "hello-world-minimal",                          │
│   tasks: [{                                            │
│     id: "write-hello",                                │
│     prompt: { template: "Write hello world..." }     │
│   }],                                                  │
│   variables: [{ name: "name", type: "string" }]      │
│ }                                                      │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ MiniBob: Execute Activity                             │
│ ActivityExecutor.execute(template, {name: "World"})   │
│ - Task 1: write-hello                                 │
│   - LLM generates with write tool                     │
│   - Creates /tmp/hello.txt                            │
│   - Status: completed                                 │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ MiniBob → Backend: Store Trace                        │
│ POST /v2/activities/execution-traces                  │
│ {                                                      │
│   execution_id: "exec-123",                           │
│   template_id: "hello-world-minimal",                 │
│   status: "success",                                  │
│   duration_ms: 2340,                                  │
│   cost_usd: 0.0012,                                   │
│   execution_trace: {                                  │
│     tasks: [{ task_id: "write-hello", ... }],        │
│     filesModified: ["/tmp/hello.txt"]                │
│   }                                                    │
│ }                                                      │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Backend: Update Learning                              │
│ UPDATE activity_template                              │
│ SET thompson_alpha = thompson_alpha + 1 (10→11)       │
│ WHERE template_id = 'hello-world-minimal'             │
└────────────────────────────────────────────────────────┘
```

### Sequence 2: Progressive Composition (Multi-Stage)

```
┌──────────────────────────────────────────────────────────┐
│ User: "Add authentication"                              │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ MiniBob: Execute progressive-goal-achievement          │
│ (Foundational template)                                │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Stage 1: Decompose Goal                               │
│ - LLM breaks "Add authentication" into stages         │
│ - Output: [setup-middleware, integrate-routes, test]  │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Stage 2: Execute Stage 1                              │
│ - Search activities: "auth middleware setup"          │
│ - Get recommendations from backend                     │
│ - Execute: setup-auth-middleware                       │
│ - Verify: Check middleware file exists                │
│ - Status: ALIGNED ✓                                   │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Stage 3: Execute Stage 2                              │
│ - Search: "auth routes integration"                   │
│ - Execute: integrate-auth-routes                       │
│ - Verify: Check routes protected                      │
│ - Status: MISALIGNED ✗ (routes don't exist)          │
│ - Backtrack: Try improvisation                        │
│ - Improvise with LLM → Create routes                  │
│ - Verify again: ALIGNED ✓                            │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Stage 4: Execute Stage 3                              │
│ - Search: "auth flow testing"                         │
│ - Execute: test-auth-flow                             │
│ - Verify: Tests pass                                  │
│ - Status: ALIGNED ✓                                   │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ MiniBob → Backend: Store Trace (Composition)          │
│ POST /v2/activities/execution-traces                  │
│ {                                                      │
│   execution_id: "exec-456",                           │
│   template_id: "progressive-goal-achievement",        │
│   execution_trace: {                                  │
│     composition_sequence: [                            │
│       { activity: "setup-auth-middleware", success: true },│
│       { activity: "integrate-auth-routes", success: false },│
│       { activity: "improvise-create-routes", success: true },│
│       { activity: "test-auth-flow", success: true }  │
│     ]                                                  │
│   },                                                   │
│   parent_execution_id: null                           │
│ }                                                      │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Backend: Learn Patterns                               │
│ 1. Update Thompson Sampling:                          │
│    - setup-auth-middleware: alpha +1                  │
│    - integrate-auth-routes: beta +1 (failed)         │
│    - test-auth-flow: alpha +1                        │
│                                                        │
│ 2. Record Composition Edges:                          │
│    - setup → integrate (failed, weight↓)             │
│    - setup → improvise (success, weight↑)            │
│    - improvise → test (success, weight↑)             │
│                                                        │
│ 3. Mine Sequence Pattern:                             │
│    - [setup, improvise, test] → success rate 100%    │
│    - Frequency: 1 (first occurrence)                 │
└────────────────────────────────────────────────────────┘
```

### Sequence 3: Multi-Vessel Interaction

```
┌──────────────────────────────────────────────────────────┐
│ User (via Web Dashboard): "Generate login page"         │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ MiniBob: Receives goal from dashboard                 │
│ Goal: "Generate login page with auth integration"     │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ MiniBob: Execute Activity "full-stack-login"          │
│ Task 1: Create backend auth endpoint                  │
│   - MiniBob executes directly (bash, write tools)     │
│   - Creates src/api/auth.ts                           │
│ Task 2: Generate login UI component                   │
│   - Needs React component generation                  │
│   - Creates impulse for React-Renderer vessel         │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ MiniBob: Create UI Impulse                            │
│ {                                                      │
│   id: "login-ui-component",                           │
│   type: "uiComponent",                                │
│   pointer: {                                           │
│     type: "react",                                     │
│     componentSpec: {                                   │
│       name: "LoginForm",                              │
│       fields: ["email", "password"],                  │
│       submitEndpoint: "/api/auth/login"              │
│     }                                                  │
│   },                                                   │
│   priority: "high"                                    │
│ }                                                      │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ MiniBob: Resolve Impulse                              │
│ loadImpulse("login-ui-component")                     │
│ → Vessel discovery: React-Renderer can handle         │
│ → Delegates to React-Renderer                         │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ React-Renderer: Generate Component                    │
│ 1. Load component template                            │
│ 2. Generate React JSX                                 │
│ 3. Create LoginForm.tsx                               │
│ 4. Return impulse content                             │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ React-Renderer → Backend: Store Trace                 │
│ POST /v2/activities/execution-traces                  │
│ {                                                      │
│   vessel_id: "react-renderer-001",                    │
│   activity_id: "generate-react-form",                 │
│   parent_execution_id: "exec-789" (MiniBob's execution)│
│   output_impulses: ["ui:LoginForm.tsx"]              │
│ }                                                      │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ MiniBob: Receives Resolved Impulse                    │
│ {                                                      │
│   id: "login-ui-component",                           │
│   loaded: true,                                       │
│   content: "import React...\nfunction LoginForm..."   │
│ }                                                      │
│ → Writes to src/components/LoginForm.tsx             │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ MiniBob → Backend: Store Trace (Composition)          │
│ POST /v2/activities/execution-traces                  │
│ {                                                      │
│   vessel_id: "minibob-local-001",                     │
│   activity_id: "full-stack-login",                    │
│   execution_trace: {                                  │
│     composition_sequence: [                            │
│       { vessel: "minibob", activity: "create-api" }, │
│       { vessel: "react-renderer", activity: "generate-ui" }│
│     ],                                                 │
│     impulses_delegated: ["login-ui-component"]       │
│   }                                                    │
│ }                                                      │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Backend: Learn Cross-Vessel Patterns                  │
│ - Record MiniBob → React-Renderer composition         │
│ - Track impulse delegation patterns                   │
│ - Calculate vessel-specific success rates             │
│ - Mine common impulse types for each vessel           │
└────────────────────────────────────────────────────────┘
```

---

## Existing Idioms That Enable This

### 1. Impulses (Lazy-Loaded Pointers)

**How it enables vessel interaction**:
```typescript
// MiniBob creates impulse (doesn't need to know WHO resolves it)
const impulse = createImpulse({
  id: "ui-component",
  type: "react",
  pointer: { componentSpec: {...} }
})

// Vessel discovery finds React-Renderer
loadImpulse("ui-component")
→ Checks local resolvers (MiniBob can't handle)
→ Queries vessel registry (React-Renderer registered for "react" type)
→ Delegates to React-Renderer
→ Returns content
```

**Key insight**: Impulses decouple data access from data location. MiniBob doesn't need to know React-Renderer exists.

### 2. Activities (Executable Templates)

**How it enables composition**:
```typescript
// Activity tasks can execute other activities
{
  "tasks": [
    {
      "id": "stage-1",
      "prompt": {
        "template": "Execute setup via activity tool:\n\nexecute_activity({\n  templateId: 'setup-middleware',\n  variables: {}\n})"
      }
    }
  ]
}
```

**Key insight**: Activities are composable. One activity can delegate to another, building complex workflows from simple parts.

### 3. Execution Traces (Learning Data)

**How it enables learning**:
```typescript
// Every execution records what happened
{
  vessel_id: "minibob-001",
  activity_id: "add-auth",
  composition_sequence: [
    { activity: "setup", success: true },
    { activity: "integrate", success: false },
    { activity: "improvise", success: true }
  ],
  parent_execution_id: null
}

// Backend mines patterns:
- "setup → integrate" often fails (weight = 0.4)
- "setup → improvise" usually succeeds (weight = 0.9)
// Future recommendations will prefer successful paths
```

**Key insight**: Traces are the raw material for learning. Backend doesn't execute, it learns from vessel executions.

### 4. Thompson Sampling (Selection Algorithm)

**How it enables improvement**:
```typescript
// Before: No execution history
alpha = 1, beta = 1 → sampled_value ≈ 0.5 (uncertain)

// After 10 successful executions:
alpha = 11, beta = 1 → sampled_value ≈ 0.92 (confident)

// Recommendations automatically improve
// No manual tuning needed
```

**Key insight**: Thompson Sampling automatically balances exploration (try new things) and exploitation (use what works).

---

## Vessel Roles Summary

| Component | Role | Executes | Resolves | Stores | Learns |
|-----------|------|----------|----------|--------|--------|
| **MiniBob** | Main execution vessel | ✅ Activities | ✅ Local (file, memo) | ❌ | ❌ |
| **React-Renderer** | UI generation vessel | ✅ UI activities | ✅ UI impulses | ❌ | ❌ |
| **Identity-Vessel** | Auth vessel | ✅ Auth flows | ✅ User/API key | ❌ | ❌ |
| **Backend** | Trace store + learner | ❌ | ✅ Historical (traces) | ✅ All traces | ✅ Patterns |

### Principles

1. **Vessels Execute** - They have tools and run activities
2. **Vessels Resolve** - They handle impulses for data they have access to
3. **Backend Stores** - It keeps all traces from all vessels
4. **Backend Learns** - It mines patterns and ranks templates
5. **No Vessel-to-Vessel Direct Calls** - Communication via impulses
6. **Backend Doesn't Execute** - It serves historical data, not live resolution

---

## What Makes This Work

### Decentralized Resolution
```
MiniBob needs file data → Resolves locally
MiniBob needs UI component → Creates impulse → React-Renderer resolves
MiniBob needs execution trace → Creates impulse → Backend resolves
```

### Centralized Learning
```
All vessels send traces to backend
Backend mines patterns across all vessels
Backend serves recommendations to all vessels
```

### Composition via Tools
```
Activities use execute_activity tool
Vessels use loadImpulse for cross-vessel delegation
Everything is an activity or an impulse
```

---

## Conclusion

The required sequence is:

1. **Goal** → MiniBob parses
2. **Recommend** → Backend samples from learned patterns
3. **Load Template** → Backend serves or MiniBob loads locally
4. **Execute** → MiniBob runs (may delegate via impulses to other vessels)
5. **Store Trace** → Backend records for learning
6. **Learn Patterns** → Backend updates Thompson scores, mines compositions
7. **Repeat** → Next goal benefits from learning

This works with existing idioms:
- **Impulses** = Decentralized resolution
- **Activities** = Composable execution units
- **Traces** = Learning data
- **Thompson Sampling** = Automatic improvement

No new mechanisms needed. The architecture already supports this.
