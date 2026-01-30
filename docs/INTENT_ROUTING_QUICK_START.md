# Intent-Driven Dataflow Routing - Quick Start

**Goal**: Intelligently route tasks to DevBob agents based on dual-graph analysis (functional dataflow + intent)

---

## Core Concept

```
User Task → Intent Router → Best Agent → Execution → Feedback → Learning
              ↓                                         ↓
     [Functional Graph]                        [Update Intent Graph]
     [Intent Graph]                            [Improve Routing]
```

---

## The Two Graphs

### 1. Functional Graph (WHAT)
**Built from**: Metabob CPG  
**Shows**: How data flows through code

```
Entry Point (API endpoint)
    ↓
Component A (validation)
    ↓
Component B (business logic)
    ↓
Component C (data storage)
```

**Key Tools**:
- `metabob_list_file_components` - discover components
- `metabob_analyze_change_impact` - find dependencies
- `metabob_assess_deletion_safety` - identify entry points

### 2. Intent Graph (WHY)
**Built from**: Annotations + Execution Feedback  
**Shows**: Why code exists and how well it works

```
Component: auth.py::verify_token
  Purpose: "Validate JWT tokens for API requests"
  Success Rate: 0.92
  Avg Cost: $0.03
  Specialist: devbob-rpc-api
  Intent Tags: [authentication, security, api]
```

**Key Tools**:
- `metabob_annotate_component` - document intent
- Activity execution metadata - success/cost/duration
- LLM - extract intent tags

---

## Routing Decision Flow

```
1. User submits task: "Add authentication to /api/users endpoint"
                            ↓
2. Extract intent: {primary: "authentication", secondary: ["security", "api"]}
                            ↓
3. Find matching intent clusters:
   - Cluster: "authentication" → Specialist: devbob-rpc-api (0.92 success)
                            ↓
4. Find dataflow path:
   - Entry: routes/users.py::get_user
   - Path: get_user → require_auth → verify_token
                            ↓
5. Score agents:
   - devbob-rpc-api: 90 (owns components, high success rate)
   - devbob-dashboard: 20 (no relevant components)
                            ↓
6. Route to: devbob-rpc-api
   - Share context: [auth-design-impulse, api-patterns-impulse]
   - Confidence: 0.92
                            ↓
7. Delegate via ACP
                            ↓
8. Capture feedback: success ✓, cost $0.15, duration 5min
                            ↓
9. Update intent graph:
   - auth.py::verify_token success rate: 0.92 → 0.93
   - Specialist confirmed: devbob-rpc-api
   - New annotation: "Added JWT auth to get_user. Follows established pattern."
                            ↓
10. Next similar task routes with higher confidence (0.95)
```

---

## Agent Scoring Algorithm

```typescript
function scoreAgent(agent: Agent, task: Task): number {
  let score = 0;
  
  // Factor 1: Specialization (50 points)
  if (agent === intentCluster.specialist) {
    score += 50;
  }
  
  // Factor 2: Component Ownership (10 points per component)
  const componentsInAgentRepo = dataflowPath.hops.filter(
    comp => comp.startsWith(agent.repository)
  );
  score += componentsInAgentRepo.length * 10;
  
  // Factor 3: Success Rate (30 points max)
  const avgSuccessRate = computeAvgSuccessRate(agent, intentCluster);
  score += avgSuccessRate * 30;
  
  return score;
}
```

**Example**:
- devbob-rpc-api: 50 (specialist) + 30 (3 components) + 28 (0.93 success) = **108**
- devbob-dashboard: 0 + 0 + 0 = **0**
- devbob-cli: 0 + 10 (1 component) + 5 (0.17 success) = **15**

Winner: **devbob-rpc-api** (confidence: 0.92)

---

## Feedback Loop

Every execution improves future routing:

```
Execution Result
    ↓
Update Component Success Rates
    ↓
Re-cluster by Intent Similarity
    ↓
Update Specialist Assignments
    ↓
Auto-annotate Key Components
    ↓
Better Routing Decisions Next Time
```

---

## API Usage

### Route a Task

```bash
curl -X POST http://localhost:8080/api/v1/route-task \
  -H "Content-Type: application/json" \
  -d '{
    "task": {
      "description": "Add JWT authentication to /api/users endpoint",
      "constraints": ["Must maintain backward compatibility"]
    },
    "availableAgents": ["devbob-rpc-api", "devbob-dashboard", "devbob-cli"]
  }'
```

**Response**:
```json
{
  "targetAgent": "devbob-rpc-api",
  "dataflowPath": {
    "source": "routes/users.py::get_user",
    "sink": "auth.py::verify_token",
    "hops": ["get_user", "require_auth", "verify_token"]
  },
  "intentAlignment": 0.92,
  "contextToShare": ["auth-design-impulse", "api-patterns-impulse"],
  "fallbackAgents": ["devbob-opencode", "devbob-cli"],
  "reasoning": "devbob-rpc-api is the specialist for authentication intent (0.93 success rate). Dataflow path requires 3 components in rpc-api repository. High confidence routing."
}
```

### Delegate with Routing

```typescript
// Automatic routing + delegation
const result = await routeAndDelegate({
  task: {
    description: "Add authentication to /api/users endpoint"
  },
  availableAgents: ["devbob-rpc-api", "devbob-dashboard", "devbob-cli"]
});

// Result:
// - Routed to: devbob-rpc-api
// - Context injected: auth patterns, design decisions
// - Execution successful
// - Feedback captured automatically
```

---

## Key Benefits

### 1. Self-Organizing Specialization
- Agents discover their strengths through execution
- No manual role assignment
- Adapts to code changes

### 2. Intent-Aware Routing
- Understands "why" not just "what"
- Preserves architectural decisions
- Routes based on design intent

### 3. Continuous Learning
- Every execution improves routing
- Error patterns inform future decisions
- Success rates guide specialization

### 4. Explainable Decisions
- Routing includes reasoning
- Shows dataflow path
- Confidence score

---

## Metabob MCP Tool Usage

### Discover Components
```typescript
const components = await metabob_list_file_components({
  file_path: "src/auth.py"
});
// → [
//   { component_id: "auth.py::verify_token", type: "function", line: 42 },
//   { component_id: "auth.py::require_auth", type: "function", line: 88 }
// ]
```

### Analyze Dependencies
```typescript
const impact = await metabob_analyze_change_impact({
  file_path: "src/auth.py",
  component_name: "verify_token",
  max_depth: 3
});
// → {
//   dependencies: ["jwt.decode", "user_model.get"],
//   dependents: ["routes.get_user", "routes.get_posts"]
// }
```

### Identify Entry Points
```typescript
const safety = await metabob_assess_deletion_safety({
  file_path: "src/routes/users.py",
  component_name: "get_user"
});
// → {
//   liveness: "live",
//   live_paths: [["api_router", "get_user"]]
// }
// This is an entry point!
```

### Document Intent
```typescript
await metabob_annotate_component({
  file_path: "src/auth.py",
  component_name: "verify_token",
  component_type: "function",
  reason: "Validates JWT tokens for API authentication. Chose JWT over sessions for stateless scaling. Handles token expiry and refresh. MESSAGE_FOR:routes - all authenticated endpoints should use require_auth decorator."
});
```

---

## Implementation Roadmap

### Week 1: Graph Construction
- [ ] Build functional graph from Metabob CPG
- [ ] Build intent graph from annotations
- [ ] Visualize graphs in dashboard

### Week 2: Intent Router
- [ ] Implement routing algorithm
- [ ] Create routing API
- [ ] Test on sample tasks

### Week 3: Feedback Loop
- [ ] Hook activity execution
- [ ] Update intent graph from feedback
- [ ] Auto-annotate components

### Week 4: Multi-Agent Orchestration
- [ ] Multi-hop routing
- [ ] Parallel execution
- [ ] Cross-repo coordination

---

## Quick Test

```bash
# 1. Start DevBob containers
docker compose -f docker-compose.devbob.yaml --env-file .env.devbob up -d

# 2. Build functional graph
curl -X POST http://localhost:8080/api/v1/graphs/functional/build \
  -d '{"repository": "metabob-rpc-api"}'

# 3. Build intent graph
curl -X POST http://localhost:8080/api/v1/graphs/intent/build \
  -d '{"repository": "metabob-rpc-api"}'

# 4. Route a task
curl -X POST http://localhost:8080/api/v1/route-task \
  -d '{
    "task": {"description": "Add authentication to /api/test"},
    "availableAgents": ["devbob-rpc-api", "devbob-dashboard"]
  }'

# 5. View routing decision
# Should show: devbob-rpc-api, confidence > 0.7, dataflow path
```

---

## Related Docs

- [Full Architecture](./INTENT_DRIVEN_DATAFLOW_ORCHESTRATION.md)
- [Metabob MCP Tools](./API_DOCUMENTATION.md)
- [DevBob Setup](./DEVBOB_MULTI_CONTAINER_QUICKSTART.md)
- [Activity Templates](./DEVBOB_ACTIVITY_WORKFLOWS.md)

---

**Next Step**: Run the implementation activity template:

```bash
opencode activity execute implement-intent-driven-dataflow-orchestration \
  --variable repository=metabob-rpc-api
```
