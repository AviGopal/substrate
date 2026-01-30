# Intent-Driven Dataflow Routing - Visual Summary

## System Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                              │
│            "Add authentication to /api/users"                     │
└────────────────────────────┬──────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│                      INTENT ROUTER (LLM)                          │
│                                                                   │
│  Extracts Intent:                                                │
│    • Primary: "authentication"                                   │
│    • Secondary: ["security", "api"]                              │
│    • Data: ["user_credentials", "jwt_tokens"]                    │
│                                                                   │
│  Queries Both Graphs:                                            │
│    ┌──────────────────────┐    ┌──────────────────────┐         │
│    │  Functional Graph    │    │   Intent Graph       │         │
│    │  (Metabob CPG)       │    │   (Annotations +     │         │
│    │                      │    │    Feedback)         │         │
│    │  • Components        │◄──►│  • Purpose           │         │
│    │  • Dependencies      │    │  • Success rates     │         │
│    │  • Dataflow paths    │    │  • Specialists       │         │
│    │  • Entry points      │    │  • Error patterns    │         │
│    └──────────────────────┘    └──────────────────────┘         │
│                                                                   │
│  Scores Agents:                                                  │
│    devbob-rpc-api:    108 ★★★★★ (specialist, owns components)   │
│    devbob-cli:         15 ★☆☆☆☆                                │
│    devbob-dashboard:    0 ☆☆☆☆☆                                │
│                                                                   │
│  Decision:                                                       │
│    → Target: devbob-rpc-api                                     │
│    → Confidence: 0.92                                            │
│    → Context: [auth-patterns, api-design]                        │
│    → Path: get_user → require_auth → verify_token               │
└────────────────────────────┬──────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│                    ACP DELEGATION                                 │
│                                                                   │
│  acp_delegate({                                                  │
│    target: "docker://devbob-rpc-api",                           │
│    prompt: "Add authentication...",                              │
│    shareImpulses: ["auth-patterns", "api-design"]               │
│  })                                                              │
└────────────────────────────┬──────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│                   DEVBOB-RPC-API AGENT                           │
│                                                                   │
│  1. Receives task with injected context                          │
│  2. Uses Metabob MCP tools:                                      │
│     - metabob_list_file_components                               │
│     - metabob_analyze_change_impact                              │
│     - metabob_search_codebase_issues                             │
│  3. Implements changes:                                          │
│     - Modify routes/users.py::get_user                           │
│     - Update auth.py::require_auth                               │
│  4. Runs tests                                                   │
│  5. Commits changes                                              │
│  6. Returns result                                               │
└────────────────────────────┬──────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│                    FEEDBACK PROCESSOR                             │
│                                                                   │
│  Captures:                                                       │
│    ✓ Success: true                                               │
│    ✓ Cost: $0.15                                                 │
│    ✓ Duration: 5min                                              │
│    ✓ Components: [get_user, require_auth]                        │
│                                                                   │
│  Updates Intent Graph:                                           │
│    • get_user success rate: 0.88 → 0.90                         │
│    • require_auth success rate: 0.92 → 0.93                     │
│    • Cluster specialist confirmed: devbob-rpc-api                │
│                                                                   │
│  Auto-annotates:                                                 │
│    metabob_annotate_component({                                  │
│      component: "routes/users.py::get_user",                     │
│      reason: "Added JWT auth using require_auth decorator.       │
│               Follows established security pattern. Maintains    │
│               backward compatibility with optional auth."        │
│    })                                                            │
└────────────────────────────┬──────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│                        LEARNING                                   │
│                                                                   │
│  Next similar task: "Add auth to /api/posts"                    │
│                                                                   │
│  Router decision:                                                │
│    → Target: devbob-rpc-api (same)                              │
│    → Confidence: 0.95 (↑ from 0.92)                             │
│    → Context: [auth-patterns, users-auth-example] (learned!)     │
│                                                                   │
│  System learned:                                                 │
│    ✓ devbob-rpc-api is best for auth tasks                      │
│    ✓ Success rate improving                                      │
│    ✓ Can reference past examples                                 │
└───────────────────────────────────────────────────────────────────┘
```

---

## Dual Graph System

### Functional Graph (WHAT - Code Structure)

```
┌─────────────────────────────────────────────────────────────┐
│                    FUNCTIONAL GRAPH                         │
│                  (Built from Metabob CPG)                   │
│                                                             │
│  Entry Points (API endpoints, CLI commands):                │
│    • routes/users.py::get_user                             │
│    • routes/posts.py::list_posts                           │
│    • cli/commands.py::run                                  │
│                                                             │
│  Dataflow Paths:                                           │
│                                                             │
│    GET /api/users/:id                                      │
│         ↓                                                   │
│    routes/users.py::get_user ────────────┐                 │
│         ↓                                │                 │
│    auth.py::require_auth ←───────────────┘                 │
│         ↓                                                   │
│    auth.py::verify_token                                   │
│         ↓                                                   │
│    jwt.decode                                              │
│         ↓                                                   │
│    user_model.py::get_by_id                                │
│         ↓                                                   │
│    database.query                                          │
│                                                             │
│  Component Metadata:                                       │
│    • Type: function | class | method                       │
│    • Dependencies: what it calls                           │
│    • Dependents: what calls it                             │
│    • Strength: strong (runtime) | weak (import only)       │
│    • Co-change files: often modified together              │
└─────────────────────────────────────────────────────────────┘
```

### Intent Graph (WHY - Design Decisions)

```
┌─────────────────────────────────────────────────────────────┐
│                      INTENT GRAPH                           │
│            (Built from Annotations + Feedback)              │
│                                                             │
│  Intent Clusters:                                          │
│                                                             │
│    ┌─────────────────────────────────────┐                 │
│    │  Cluster: "Authentication"          │                 │
│    │  Specialist: devbob-rpc-api         │                 │
│    │  Avg Success Rate: 0.93             │                 │
│    │                                     │                 │
│    │  Components:                        │                 │
│    │    • auth.py::verify_token          │                 │
│    │      Purpose: JWT validation        │                 │
│    │      Success: 0.95                  │                 │
│    │      Cost: $0.03                    │                 │
│    │      Tags: [jwt, security]          │                 │
│    │                                     │                 │
│    │    • auth.py::require_auth          │                 │
│    │      Purpose: Auth decorator        │                 │
│    │      Success: 0.92                  │                 │
│    │      Cost: $0.02                    │                 │
│    │      Tags: [decorator, middleware]  │                 │
│    │                                     │                 │
│    │    • routes/users.py::get_user      │                 │
│    │      Purpose: User retrieval        │                 │
│    │      Success: 0.90                  │                 │
│    │      Cost: $0.05                    │                 │
│    │      Tags: [api, users]             │                 │
│    └─────────────────────────────────────┘                 │
│                                                             │
│    ┌─────────────────────────────────────┐                 │
│    │  Cluster: "Data Validation"         │                 │
│    │  Specialist: devbob-rpc-api         │                 │
│    │  Avg Success Rate: 0.88             │                 │
│    │                                     │                 │
│    │  Components:                        │                 │
│    │    • validators/user.py::validate   │                 │
│    │    • validators/common.py::check    │                 │
│    └─────────────────────────────────────┘                 │
│                                                             │
│    ┌─────────────────────────────────────┐                 │
│    │  Cluster: "UI Components"           │                 │
│    │  Specialist: devbob-dashboard       │                 │
│    │  Avg Success Rate: 0.75             │                 │
│    │                                     │                 │
│    │  Components:                        │                 │
│    │    • components/UserList.tsx        │                 │
│    │    • components/AuthForm.tsx        │                 │
│    └─────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Routing Decision Logic

```
┌───────────────────────────────────────────────────────────────┐
│  STEP 1: INTENT EXTRACTION (LLM)                             │
│                                                              │
│  Input: "Add authentication to /api/users endpoint"         │
│                                                              │
│  Output:                                                     │
│    {                                                         │
│      primary: "authentication",                             │
│      secondary: ["security", "api", "users"],               │
│      dataTypes: ["credentials", "tokens"],                  │
│      constraints: ["backward_compatible"]                   │
│    }                                                         │
└────────────────────────────┬──────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────┐
│  STEP 2: FIND MATCHING INTENT CLUSTERS                       │
│                                                              │
│  Query intent graph:                                         │
│    WHERE intent_tags CONTAINS "authentication"              │
│       OR intent_tags CONTAINS "security"                    │
│                                                              │
│  Matches:                                                    │
│    • Cluster "Authentication" (similarity: 0.95)            │
│      → Specialist: devbob-rpc-api                           │
│      → Components: verify_token, require_auth, get_user     │
│      → Success rate: 0.93                                   │
└────────────────────────────┬──────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────┐
│  STEP 3: FIND DATAFLOW PATHS                                 │
│                                                              │
│  Query functional graph:                                     │
│    WHERE component IN ["verify_token", "require_auth", ...]│
│                                                              │
│  Best path:                                                  │
│    routes/users.py::get_user (entry)                        │
│         ↓                                                    │
│    auth.py::require_auth                                    │
│         ↓                                                    │
│    auth.py::verify_token (terminal)                         │
│                                                              │
│  Path metadata:                                              │
│    • Length: 3 hops                                         │
│    • Repository: metabob-rpc-api (100% in one repo)        │
│    • Entry type: API endpoint                               │
└────────────────────────────┬──────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────┐
│  STEP 4: SCORE AGENTS                                        │
│                                                              │
│  devbob-rpc-api:                                            │
│    + 50 (is specialist for "Authentication" cluster)        │
│    + 30 (owns 3/3 components in dataflow path)             │
│    + 28 (success rate: 0.93 * 30)                          │
│    ─────                                                     │
│    = 108 ★★★★★                                              │
│                                                              │
│  devbob-dashboard:                                          │
│    + 0  (not specialist)                                    │
│    + 0  (owns 0/3 components)                               │
│    + 0  (no relevant history)                               │
│    ─────                                                     │
│    = 0 ☆☆☆☆☆                                                │
│                                                              │
│  devbob-cli:                                                │
│    + 0  (not specialist)                                    │
│    + 10 (owns 1/3 component: get_user CLI wrapper)         │
│    + 5  (success rate: 0.17 * 30)                          │
│    ─────                                                     │
│    = 15 ★☆☆☆☆                                               │
└────────────────────────────┬──────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────┐
│  STEP 5: SELECT CONTEXT (IMPULSES)                          │
│                                                              │
│  For agent: devbob-rpc-api                                  │
│  For intent: "authentication"                               │
│                                                              │
│  Relevant impulses:                                          │
│    1. "auth-design-pattern" (design decisions)              │
│       → Why JWT over sessions                               │
│       → Token expiry handling                               │
│                                                              │
│    2. "api-security-guidelines" (constraints)               │
│       → CORS policies                                        │
│       → Rate limiting                                        │
│                                                              │
│    3. "users-endpoint-history" (past examples)              │
│       → Similar changes to other endpoints                  │
│       → Common pitfalls                                      │
└────────────────────────────┬──────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────┐
│  STEP 6: ROUTING DECISION                                    │
│                                                              │
│  {                                                           │
│    targetAgent: "devbob-rpc-api",                           │
│    confidence: 0.92,                                         │
│    dataflowPath: {                                           │
│      source: "routes/users.py::get_user",                   │
│      hops: ["get_user", "require_auth", "verify_token"]     │
│    },                                                        │
│    contextToShare: [                                         │
│      "auth-design-pattern",                                  │
│      "api-security-guidelines",                              │
│      "users-endpoint-history"                                │
│    ],                                                        │
│    fallbackAgents: ["devbob-opencode", "devbob-cli"],       │
│    reasoning: "devbob-rpc-api is specialist for auth        │
│                (0.93 success). Owns all 3 components in      │
│                dataflow path. High confidence routing."      │
│  }                                                           │
└───────────────────────────────────────────────────────────────┘
```

---

## Feedback Loop (Learning)

```
┌─────────────────────────────────────────────────────────────┐
│  EXECUTION COMPLETE                                         │
│                                                             │
│  Activity Result:                                           │
│    ✓ Success: true                                          │
│    ✓ Cost: $0.15                                            │
│    ✓ Duration: 300s (5min)                                  │
│    ✓ Files Changed:                                         │
│      - routes/users.py                                      │
│      - auth.py                                              │
│    ✓ Tests Passed: 15/15                                    │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  IDENTIFY AFFECTED COMPONENTS                               │
│                                                             │
│  Files Changed → Components:                                │
│    routes/users.py → get_user                              │
│    auth.py → require_auth, verify_token                    │
│                                                             │
│  Key Components (modified or heavily used):                │
│    • routes/users.py::get_user                             │
│    • auth.py::require_auth                                 │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  UPDATE INTENT GRAPH NODES                                  │
│                                                             │
│  routes/users.py::get_user:                                │
│    Before: success_rate = 0.88, count = 25                 │
│    After:  success_rate = 0.90, count = 26 (↑)             │
│    avg_cost: $0.045 → $0.047                                │
│    avg_duration: 280s → 285s                                │
│                                                             │
│  auth.py::require_auth:                                    │
│    Before: success_rate = 0.92, count = 50                 │
│    After:  success_rate = 0.93, count = 51 (↑)             │
│    avg_cost: $0.020 → $0.021                                │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  AUTO-ANNOTATE COMPONENTS                                   │
│                                                             │
│  LLM generates annotation from activity result:             │
│                                                             │
│  metabob_annotate_component({                               │
│    file: "routes/users.py",                                 │
│    component: "get_user",                                   │
│    type: "function",                                        │
│    reason: "Added JWT authentication using require_auth     │
│             decorator. Follows established security pattern │
│             in auth.py. Maintains backward compatibility    │
│             with optional auth parameter. Tested with 15    │
│             test cases including edge cases."               │
│  })                                                         │
│                                                             │
│  Annotation includes:                                       │
│    ✓ What changed                                           │
│    ✓ Why (design decision)                                  │
│    ✓ How (pattern followed)                                 │
│    ✓ Outcome (tests passed)                                 │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  RE-CLUSTER BY INTENT                                       │
│                                                             │
│  Recompute intent embeddings for updated components         │
│  Re-run clustering algorithm (cosine similarity > 0.7)      │
│                                                             │
│  Cluster "Authentication":                                  │
│    Before: 12 components, specialist: devbob-rpc-api       │
│    After:  12 components, specialist: devbob-rpc-api (✓)   │
│    Avg success rate: 0.92 → 0.93 (↑)                       │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  UPDATE SPECIALISTS                                         │
│                                                             │
│  For cluster "Authentication":                              │
│                                                             │
│    Agent scores:                                            │
│      devbob-rpc-api:  0.93 ★★★★★ (confirmed specialist)   │
│      devbob-cli:      0.17 ★☆☆☆☆                           │
│      devbob-dashboard: 0.00 ☆☆☆☆☆                          │
│                                                             │
│    Specialist remains: devbob-rpc-api ✓                    │
│    Confidence increased: 0.92 → 0.95                       │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  NEXT TASK BENEFITS                                         │
│                                                             │
│  Task: "Add authentication to /api/posts endpoint"         │
│                                                             │
│  Router now knows:                                          │
│    ✓ devbob-rpc-api is best for auth (higher confidence)   │
│    ✓ Use require_auth decorator pattern                    │
│    ✓ Reference get_user as example                         │
│    ✓ Expect ~$0.15 cost, ~5min duration                    │
│                                                             │
│  Routing decision:                                          │
│    Target: devbob-rpc-api (same, faster decision)          │
│    Confidence: 0.95 (↑ from 0.92)                          │
│    Context: includes "users-auth-example" impulse (new!)    │
└─────────────────────────────────────────────────────────────┘
```

---

## Metabob MCP Tool Chain

```
┌─────────────────────────────────────────────────────────────┐
│  BUILD FUNCTIONAL GRAPH                                     │
│                                                             │
│  1. metabob_list_file_components(file_path)                │
│     → Discover all functions, classes, methods             │
│                                                             │
│  2. metabob_analyze_change_impact(file_path, component)    │
│     → Get dependencies (calls) and dependents (called-by)  │
│                                                             │
│  3. metabob_assess_deletion_safety(file_path, component)   │
│     → Identify entry points (live_paths > 0)               │
│                                                             │
│  4. metabob_suggest_related_changes(changed_files)         │
│     → Find co-change patterns                              │
│                                                             │
│  Result: Complete dataflow graph                           │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│  BUILD INTENT GRAPH                                         │
│                                                             │
│  1. metabob.getAnnotations()                               │
│     → Extract existing annotations                         │
│                                                             │
│  2. Parse annotations for:                                  │
│     • Purpose (reason field)                               │
│     • Design decisions                                      │
│     • Constraints                                           │
│     • MESSAGE_FOR: dependencies                            │
│                                                             │
│  3. Merge activity execution feedback                       │
│     • Success rates                                         │
│     • Cost/duration metrics                                 │
│     • Error patterns                                        │
│                                                             │
│  4. Cluster by intent similarity (LLM embeddings)          │
│                                                             │
│  Result: Intent graph with specialists                     │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│  DURING EXECUTION                                           │
│                                                             │
│  Agent uses Metabob tools:                                  │
│                                                             │
│  1. metabob_search_codebase_issues(query)                  │
│     → Find similar patterns in codebase                    │
│                                                             │
│  2. metabob_get_priority_issues()                          │
│     → Get relevant issues to fix                           │
│                                                             │
│  3. metabob_mark_problem_complete(problem_id, resolution)  │
│     → Record fixes                                          │
│                                                             │
│  Result: High-quality implementation                       │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│  AFTER EXECUTION                                            │
│                                                             │
│  1. metabob_annotate_component(file, component, reason)    │
│     → Document what/why/how (3-5 key components)           │
│                                                             │
│  2. metabob_suggest_related_changes(changed_files)         │
│     → Find other files that may need updates               │
│                                                             │
│  Result: Knowledge captured for future routing             │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Metrics

### Routing Quality
- **Intent Alignment**: 0.92 average (should be > 0.7)
- **Agent Utilization**: devbob-rpc-api 65%, devbob-dashboard 20%, devbob-cli 10%, devbob-opencode 5%
- **Fallback Rate**: 5% (routing to fallback agent)

### Learning Rate
- **Specialist Stability**: 85% (specialists change infrequently)
- **Success Rate Improvement**: +0.15 per 10 executions
- **Confidence Improvement**: +0.08 per similar task

### System Health
- **Dataflow Coverage**: 92% of components mapped
- **Annotation Coverage**: 78% of key components annotated
- **Graph Staleness**: < 24h (graphs rebuild daily)

---

## Example: Multi-Hop Routing

```
Task: "Implement full-stack user profile feature"

┌─────────────────────────────────────────────────────────────┐
│  ROUTER DECOMPOSES TASK                                     │
│                                                             │
│  Sub-tasks:                                                 │
│    1. Backend API endpoint                                  │
│    2. Frontend UI component                                 │
│    3. CLI command                                           │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  ROUTE EACH SUB-TASK                                        │
│                                                             │
│  Sub-task 1: "Backend API endpoint"                        │
│    Intent: api, backend, data                              │
│    Route to: devbob-rpc-api (confidence: 0.95)             │
│                                                             │
│  Sub-task 2: "Frontend UI component"                       │
│    Intent: ui, frontend, react                             │
│    Route to: devbob-dashboard (confidence: 0.88)           │
│                                                             │
│  Sub-task 3: "CLI command"                                 │
│    Intent: cli, command, user                              │
│    Route to: devbob-cli (confidence: 0.82)                 │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  EXECUTE IN SEQUENCE WITH CONTEXT PASSING                   │
│                                                             │
│  Step 1: devbob-rpc-api implements backend                 │
│    → Returns: API contract, endpoint URL                    │
│                                                             │
│  Step 2: devbob-dashboard implements frontend               │
│    → Receives: API contract from Step 1                     │
│    → Returns: Component path                                │
│                                                             │
│  Step 3: devbob-cli implements CLI                         │
│    → Receives: API contract from Step 1                     │
│    → Returns: Command name                                  │
│                                                             │
│  Orchestrator validates integration                         │
└─────────────────────────────────────────────────────────────┘
```

---

**Status**: Design Complete  
**Next**: Implement Phase 1 (Graph Construction)  
**Est. Duration**: 4 weeks (4 engineers)
