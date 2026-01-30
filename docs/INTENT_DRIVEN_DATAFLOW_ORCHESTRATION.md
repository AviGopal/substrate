# Intent-Driven Dataflow Orchestration Architecture

**Status**: Design Phase  
**Created**: January 27, 2026  
**Version**: 1.0.0

## Executive Summary

This document describes an architecture for **intent-driven dataflow orchestration** across DevBob agents, where:

1. **Functional Dataflow Graph**: Built using Metabob CPG (Code Property Graph) to track how data flows between components
2. **Intent Graph**: Built from activity templates, annotations, and execution feedback to capture "why" decisions are made
3. **LLM-Based Router**: Uses both graphs to intelligently route data and tasks between agents based on intent alignment
4. **Feedback Loop**: Activity execution outcomes update component annotations, continuously improving routing decisions

This creates a **self-organizing multi-agent system** where agents learn their specializations through execution feedback.

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestration Layer                          │
│                                                                 │
│  ┌─────────────────┐         ┌──────────────────┐            │
│  │  Intent Router  │◄────────┤  Activity        │            │
│  │  (LLM-Driven)   │         │  Execution       │            │
│  │                 │         │  Feedback        │            │
│  └────────┬────────┘         └──────────────────┘            │
│           │                                                    │
│           ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐     │
│  │         Dual Graph System                           │     │
│  │                                                       │     │
│  │  ┌──────────────────┐    ┌──────────────────┐      │     │
│  │  │ Functional Graph │    │  Intent Graph    │      │     │
│  │  │ (CPG Dataflow)   │◄──►│  (Annotations)   │      │     │
│  │  │                  │    │                  │      │     │
│  │  │ • Components     │    │ • Why exists     │      │     │
│  │  │ • Dependencies   │    │ • Design intent  │      │     │
│  │  │ • Data flow      │    │ • Constraints    │      │     │
│  │  │ • Call chains    │    │ • Alternatives   │      │     │
│  │  └──────────────────┘    └──────────────────┘      │     │
│  └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Layer                                │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ devbob-rpc-  │  │ devbob-      │  │ devbob-      │        │
│  │ api          │  │ dashboard    │  │ cli          │        │
│  │              │  │              │  │              │        │
│  │ • Metabob MCP│  │ • Metabob MCP│  │ • Metabob MCP│        │
│  │ • CPG access │  │ • CPG access │  │ • CPG access │        │
│  │ • Annotate   │  │ • Annotate   │  │ • Annotate   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Functional Dataflow Graph (CPG)

Built using Metabob MCP tools:

**Tools Used**:
- `metabob_list_file_components` - Discover components in files
- `metabob_analyze_change_impact` - Understand dependencies (calls/called-by)
- `metabob_assess_deletion_safety` - Identify live entry points and dead code
- `metabob_suggest_related_changes` - Find co-change patterns

**Graph Structure**:
```typescript
interface FunctionalNode {
  id: string;                    // "file.py::ComponentName"
  type: "function" | "class" | "method" | "module";
  file: string;
  line: number;
  
  // Dataflow edges
  callsComponents: string[];     // Dependencies (outgoing)
  calledByComponents: string[];  // Dependents (incoming)
  
  // Metadata
  isLiveRoot: boolean;           // Entry point?
  strength: "strong" | "weak";   // Runtime vs import-only
  coChangeFiles: string[];       // Files that change together
}

interface DataflowGraph {
  nodes: Map<string, FunctionalNode>;
  entryPoints: string[];         // Live roots (API endpoints, CLI commands)
  dataFlowPaths: DataPath[];     // End-to-end data journeys
}

interface DataPath {
  id: string;
  source: string;                // Entry component
  sink: string;                  // Terminal component
  hops: string[];                // Intermediate components
  dataType?: string;             // What data flows (if known)
}
```

**Construction Algorithm**:

```typescript
async function buildFunctionalGraph(repo: Repository): Promise<DataflowGraph> {
  const graph = new DataflowGraph();
  
  // Step 1: Discover all components
  for (const file of repo.trackedFiles) {
    const components = await metabob_list_file_components({ file_path: file });
    for (const comp of components) {
      graph.addNode({
        id: comp.component_id,
        type: comp.type,
        file: file,
        line: comp.line,
        ...
      });
    }
  }
  
  // Step 2: Build dependency edges
  for (const node of graph.nodes.values()) {
    const impact = await metabob_analyze_change_impact({
      file_path: node.file,
      component_name: node.id,
      max_depth: 3
    });
    
    node.callsComponents = impact.dependencies.map(d => d.component_id);
    node.calledByComponents = impact.dependents.map(d => d.component_id);
  }
  
  // Step 3: Identify entry points (live roots)
  for (const node of graph.nodes.values()) {
    const safety = await metabob_assess_deletion_safety({
      file_path: node.file,
      component_name: node.id
    });
    
    node.isLiveRoot = safety.liveness === "live" && safety.live_paths?.length > 0;
  }
  
  // Step 4: Trace dataflow paths from entry points
  graph.dataFlowPaths = traceDataFlowPaths(graph.nodes, graph.entryPoints);
  
  return graph;
}
```

---

### 2. Intent Graph (Annotations)

Built from Metabob annotations and activity execution feedback:

**Tools Used**:
- `metabob_annotate_component` - Document WHY components exist
- `metabob_search_codebase_issues` - Find related patterns
- Activity execution metadata - Success/failure, cost, duration

**Graph Structure**:
```typescript
interface IntentNode {
  componentId: string;           // Links to FunctionalNode
  
  // Intent metadata
  purpose: string;               // Why this exists
  designDecisions: string[];     // Alternatives considered
  constraints: string[];         // Must-preserve properties
  tradeoffs: string[];           // What was sacrificed
  
  // Execution feedback
  successRate: number;           // 0-1, from activity outcomes
  avgCost: number;               // $ per execution
  avgDuration: number;           // ms per execution
  errorPatterns: string[];       // Common failure modes
  
  // Intent tags (for routing)
  intentTags: string[];          // ["authentication", "validation", "api"]
  dataProcessed: string[];       // ["user_data", "auth_tokens"]
  
  // Cross-references
  messageForComponents: string[]; // Components that depend on this intent
  learnsFromComponents: string[]; // Components with similar patterns
}

interface IntentGraph {
  nodes: Map<string, IntentNode>;
  intentClusters: IntentCluster[]; // Group by similar purpose
  learningFeedback: FeedbackLog[];
}

interface IntentCluster {
  id: string;
  intent: string;                // High-level purpose
  components: string[];          // Components in cluster
  specialist: string;            // Best agent for this intent (learned)
}
```

**Construction Algorithm**:

```typescript
async function buildIntentGraph(
  functionalGraph: DataflowGraph,
  repo: Repository
): Promise<IntentGraph> {
  const intentGraph = new IntentGraph();
  
  // Step 1: Extract annotations from Metabob
  const annotations = await metabob.getAnnotations({ file_path: repo.path });
  
  for (const ann of annotations) {
    const node = intentGraph.getOrCreate(ann.component_id);
    node.purpose = ann.reason;
    node.intentTags = extractIntentTags(ann.message); // NLP/LLM
    
    // Parse MESSAGE_FOR: annotations
    if (ann.message.includes("MESSAGE_FOR:")) {
      node.messageForComponents = parseMessageFor(ann.message);
    }
  }
  
  // Step 2: Merge execution feedback from activities
  const activityResults = await metabob.getActivityExecutions({ 
    project_id: repo.projectId 
  });
  
  for (const result of activityResults) {
    const affectedComponents = result.metadata.componentsModified;
    for (const compId of affectedComponents) {
      const node = intentGraph.nodes.get(compId);
      if (node) {
        node.updateFeedback({
          success: result.success,
          cost: result.cost,
          duration: result.duration,
          errors: result.errors
        });
      }
    }
  }
  
  // Step 3: Cluster by intent similarity
  intentGraph.intentClusters = clusterByIntent(intentGraph.nodes);
  
  return intentGraph;
}
```

---

### 3. Intent-Driven Router (LLM Glue)

The router uses both graphs to make routing decisions:

**Input**:
- Task description (natural language intent)
- Current data state (what data needs processing)
- Available agents (devbob containers)

**Output**:
- Target agent(s) to handle the task
- Dataflow path to use
- Context to share (impulses)

**Algorithm**:

```typescript
interface RoutingDecision {
  targetAgent: string;           // "devbob-rpc-api"
  dataflowPath: DataPath;        // Components to touch
  intentAlignment: number;       // 0-1 confidence
  contextToShare: string[];      // Impulse IDs
  fallbackAgents: string[];      // Alternatives
}

async function routeTask(
  task: TaskDescription,
  functionalGraph: DataflowGraph,
  intentGraph: IntentGraph,
  availableAgents: Agent[]
): Promise<RoutingDecision> {
  
  // Step 1: Extract intent from task
  const taskIntent = await extractIntent(task.description); // LLM call
  
  // Step 2: Find matching intent clusters
  const matchingClusters = intentGraph.intentClusters.filter(cluster =>
    similarIntent(cluster.intent, taskIntent) > 0.7
  );
  
  // Step 3: Find dataflow paths that touch those components
  const candidatePaths = functionalGraph.dataFlowPaths.filter(path =>
    path.hops.some(hop => 
      matchingClusters.some(c => c.components.includes(hop))
    )
  );
  
  // Step 4: Score each agent based on:
  //   - Specialization (learned from past executions)
  //   - Component ownership (which repo has the components)
  //   - Success rate (execution feedback)
  const agentScores = availableAgents.map(agent => ({
    agent,
    score: scoreAgent(agent, matchingClusters, candidatePaths, intentGraph)
  }));
  
  const bestAgent = agentScores.sort((a, b) => b.score - a.score)[0];
  
  // Step 5: Decide what context to share
  const contextImpulses = selectRelevantContext(
    taskIntent,
    bestAgent.agent,
    matchingClusters,
    intentGraph
  );
  
  return {
    targetAgent: bestAgent.agent.name,
    dataflowPath: candidatePaths[0], // Highest confidence path
    intentAlignment: bestAgent.score,
    contextToShare: contextImpulses,
    fallbackAgents: agentScores.slice(1, 3).map(a => a.agent.name)
  };
}

function scoreAgent(
  agent: Agent,
  intentClusters: IntentCluster[],
  dataflowPaths: DataPath[],
  intentGraph: IntentGraph
): number {
  let score = 0;
  
  // Factor 1: Specialization (learned)
  for (const cluster of intentClusters) {
    if (cluster.specialist === agent.name) {
      score += 50; // Strong signal
    }
  }
  
  // Factor 2: Component ownership
  const agentComponents = dataflowPaths.flatMap(p => p.hops).filter(compId =>
    compId.startsWith(agent.codebasePath)
  );
  score += agentComponents.length * 10;
  
  // Factor 3: Success rate
  const agentIntentNodes = Array.from(intentGraph.nodes.values()).filter(node =>
    agentComponents.includes(node.componentId)
  );
  const avgSuccessRate = agentIntentNodes.reduce((sum, n) => sum + n.successRate, 0) / 
                         agentIntentNodes.length;
  score += avgSuccessRate * 30;
  
  return score;
}
```

---

### 4. Feedback Loop (Self-Organization)

After each activity execution, update the intent graph:

**Flow**:

```
Activity Execution
    ↓
Capture Outcome (success/failure, cost, duration, errors)
    ↓
Identify Components Modified
    ↓
Update IntentGraph nodes with feedback
    ↓
Annotate Components (metabob_annotate_component)
    ↓
Re-cluster IntentClusters (update specialists)
    ↓
Next routing decision uses updated scores
```

**Implementation**:

```typescript
async function processFeedback(
  activityResult: ActivityResult,
  functionalGraph: DataflowGraph,
  intentGraph: IntentGraph
): Promise<void> {
  
  // Step 1: Identify affected components
  const modifiedFiles = activityResult.metadata.filesChanged;
  const affectedComponents = [];
  
  for (const file of modifiedFiles) {
    const components = await metabob_list_file_components({ file_path: file });
    affectedComponents.push(...components.map(c => c.component_id));
  }
  
  // Step 2: Update intent nodes
  for (const compId of affectedComponents) {
    const node = intentGraph.nodes.get(compId);
    if (node) {
      node.updateFeedback({
        success: activityResult.success,
        cost: activityResult.cost,
        duration: activityResult.duration,
        errors: activityResult.errors || []
      });
    }
  }
  
  // Step 3: Annotate key components with outcome
  const keyComponents = identifyKeyComponents(affectedComponents, activityResult);
  
  for (const compId of keyComponents) {
    const node = functionalGraph.nodes.get(compId);
    if (node) {
      await metabob_annotate_component({
        file_path: node.file,
        component_name: compId,
        component_type: node.type,
        reason: generateAnnotation(activityResult, node) // LLM-generated
      });
    }
  }
  
  // Step 4: Re-cluster and update specialists
  intentGraph.intentClusters = clusterByIntent(intentGraph.nodes);
  
  for (const cluster of intentGraph.intentClusters) {
    // Update specialist based on success rates
    const agentScores = computeAgentScoresForCluster(cluster, intentGraph);
    cluster.specialist = agentScores[0].agent;
  }
  
  // Step 5: Persist learning to Metabob backend
  await metabob.postActivityResult({
    activityId: activityResult.id,
    result: {
      success: activityResult.success,
      duration: activityResult.duration,
      cost: activityResult.cost,
      tokens: activityResult.tokens
    }
  });
}
```

---

## Implementation Plan

### Phase 1: Graph Construction (Week 1)

**Goal**: Build functional and intent graphs from existing codebases

**Tasks**:
1. Implement `buildFunctionalGraph()` for each DevBob codebase
   - Use Metabob MCP tools to discover components
   - Trace dependencies and dataflow paths
   - Identify entry points (API endpoints, CLI commands)

2. Implement `buildIntentGraph()` from annotations
   - Extract existing Metabob annotations
   - Parse MESSAGE_FOR: patterns
   - Initialize with zero execution feedback

3. Create visualization tools
   - Graph export (JSON, GraphViz)
   - Dashboard view of dataflow paths
   - Intent cluster visualization

**Deliverables**:
- `DataflowGraphBuilder` service
- `IntentGraphBuilder` service
- Graph storage schema (SurrealDB)
- Visualization dashboard

---

### Phase 2: Intent Router (Week 2)

**Goal**: LLM-based routing decisions using both graphs

**Tasks**:
1. Implement intent extraction from task descriptions
   - LLM prompt to extract intent tags
   - Map to existing intent clusters
   - Handle multi-intent tasks

2. Implement routing algorithm
   - Score agents based on specialization, ownership, success rate
   - Select optimal dataflow path
   - Choose fallback agents

3. Implement context selection
   - Identify relevant impulses to share
   - Include related annotations
   - Budget-aware context sharing

4. Build routing API
   - REST endpoint: `POST /route-task`
   - ACP integration for delegation
   - Logging and observability

**Deliverables**:
- `IntentRouter` service
- Routing API endpoints
- Integration with `acp_delegate`
- Routing decision logs

---

### Phase 3: Feedback Loop (Week 3)

**Goal**: Update graphs based on execution outcomes

**Tasks**:
1. Implement activity result capture
   - Hook into activity execution lifecycle
   - Extract affected components
   - Compute success metrics

2. Implement feedback processing
   - Update IntentGraph nodes
   - Re-cluster by intent
   - Update specialist assignments

3. Implement auto-annotation
   - LLM-generated annotations from outcomes
   - Include error patterns
   - Document design decisions from fixes

4. Build learning dashboard
   - Show intent cluster evolution
   - Track specialist changes over time
   - Success rate trends per component

**Deliverables**:
- `FeedbackProcessor` service
- Auto-annotation pipeline
- Learning metrics dashboard
- Specialist evolution log

---

### Phase 4: Multi-Agent Orchestration (Week 4)

**Goal**: Coordinate work across multiple agents based on dataflow

**Tasks**:
1. Implement multi-hop routing
   - Break complex tasks into dataflow stages
   - Route each stage to optimal agent
   - Handle inter-agent data passing

2. Implement parallel execution
   - Identify independent dataflow paths
   - Delegate to multiple agents concurrently
   - Merge results

3. Implement cross-repo coordination
   - Use MESSAGE_FOR: annotations for dependencies
   - Ensure consistent changes across repos
   - Validate integration tests

4. Build orchestration templates
   - Activity templates for common multi-agent workflows
   - Parameterized routing strategies
   - Error recovery patterns

**Deliverables**:
- Multi-agent orchestrator
- Cross-repo activity templates
- Integration test suite
- Coordination patterns library

---

## Data Schemas

### Functional Graph Storage (SurrealDB)

```sql
-- Components table
DEFINE TABLE component SCHEMAFULL;
DEFINE FIELD id ON TABLE component TYPE string;
DEFINE FIELD type ON TABLE component TYPE string; -- function | class | method | module
DEFINE FIELD file ON TABLE component TYPE string;
DEFINE FIELD line ON TABLE component TYPE int;
DEFINE FIELD repository ON TABLE component TYPE string;
DEFINE FIELD is_live_root ON TABLE component TYPE bool;
DEFINE FIELD strength ON TABLE component TYPE string; -- strong | weak
DEFINE INDEX idx_component_id ON TABLE component COLUMNS id UNIQUE;
DEFINE INDEX idx_component_file ON TABLE component COLUMNS file;

-- Dataflow edges
DEFINE TABLE dataflow SCHEMAFULL;
DEFINE FIELD from ON TABLE dataflow TYPE record(component);
DEFINE FIELD to ON TABLE dataflow TYPE record(component);
DEFINE FIELD type ON TABLE dataflow TYPE string; -- calls | called_by | co_change
DEFINE FIELD strength ON TABLE dataflow TYPE float; -- 0-1 confidence

-- Dataflow paths
DEFINE TABLE dataflow_path SCHEMAFULL;
DEFINE FIELD id ON TABLE dataflow_path TYPE string;
DEFINE FIELD source ON TABLE dataflow_path TYPE record(component);
DEFINE FIELD sink ON TABLE dataflow_path TYPE record(component);
DEFINE FIELD hops ON TABLE dataflow_path TYPE array;
DEFINE FIELD data_type ON TABLE dataflow_path TYPE string;
```

### Intent Graph Storage (SurrealDB)

```sql
-- Intent nodes
DEFINE TABLE intent_node SCHEMAFULL;
DEFINE FIELD component_id ON TABLE intent_node TYPE string;
DEFINE FIELD purpose ON TABLE intent_node TYPE string;
DEFINE FIELD design_decisions ON TABLE intent_node TYPE array;
DEFINE FIELD constraints ON TABLE intent_node TYPE array;
DEFINE FIELD tradeoffs ON TABLE intent_node TYPE array;
DEFINE FIELD success_rate ON TABLE intent_node TYPE float;
DEFINE FIELD avg_cost ON TABLE intent_node TYPE float;
DEFINE FIELD avg_duration ON TABLE intent_node TYPE int;
DEFINE FIELD error_patterns ON TABLE intent_node TYPE array;
DEFINE FIELD intent_tags ON TABLE intent_node TYPE array;
DEFINE FIELD data_processed ON TABLE intent_node TYPE array;
DEFINE FIELD message_for_components ON TABLE intent_node TYPE array;
DEFINE FIELD learns_from_components ON TABLE intent_node TYPE array;
DEFINE INDEX idx_intent_component ON TABLE intent_node COLUMNS component_id UNIQUE;
DEFINE INDEX idx_intent_tags ON TABLE intent_node COLUMNS intent_tags;

-- Intent clusters
DEFINE TABLE intent_cluster SCHEMAFULL;
DEFINE FIELD id ON TABLE intent_cluster TYPE string;
DEFINE FIELD intent ON TABLE intent_cluster TYPE string;
DEFINE FIELD components ON TABLE intent_cluster TYPE array;
DEFINE FIELD specialist ON TABLE intent_cluster TYPE string; -- agent name
DEFINE FIELD avg_success_rate ON TABLE intent_cluster TYPE float;
DEFINE FIELD created_at ON TABLE intent_cluster TYPE datetime;
DEFINE FIELD updated_at ON TABLE intent_cluster TYPE datetime;

-- Feedback logs
DEFINE TABLE feedback_log SCHEMAFULL;
DEFINE FIELD activity_id ON TABLE feedback_log TYPE string;
DEFINE FIELD component_id ON TABLE feedback_log TYPE string;
DEFINE FIELD success ON TABLE feedback_log TYPE bool;
DEFINE FIELD cost ON TABLE feedback_log TYPE float;
DEFINE FIELD duration ON TABLE feedback_log TYPE int;
DEFINE FIELD errors ON TABLE feedback_log TYPE array;
DEFINE FIELD timestamp ON TABLE feedback_log TYPE datetime;
```

---

## API Endpoints

### Routing API

```typescript
// POST /api/v1/route-task
interface RouteTaskRequest {
  task: {
    description: string;        // Natural language
    dataContext?: any;          // Current data state
    constraints?: string[];     // Required properties
  };
  availableAgents: string[];    // ["devbob-rpc-api", ...]
}

interface RouteTaskResponse {
  targetAgent: string;
  dataflowPath: {
    source: string;
    sink: string;
    hops: string[];
  };
  intentAlignment: number;
  contextToShare: string[];     // Impulse IDs
  fallbackAgents: string[];
  reasoning: string;            // LLM explanation
}
```

### Graph Query API

```typescript
// GET /api/v1/graphs/functional/:repository
// Returns functional graph for a repository

// GET /api/v1/graphs/intent/:repository
// Returns intent graph for a repository

// GET /api/v1/dataflow-paths?from=X&to=Y
// Find all dataflow paths from component X to component Y

// GET /api/v1/intent-clusters?intent=authentication
// Find intent clusters matching query
```

### Feedback API

```typescript
// POST /api/v1/feedback/activity-result
interface ActivityFeedbackRequest {
  activityId: string;
  success: boolean;
  cost: number;
  duration: number;
  errors?: string[];
  componentsModified: string[];
}

// GET /api/v1/feedback/learning-metrics
// Returns learning metrics over time
```

---

## Example Workflow

### Scenario: Add Authentication to API

**Step 1: User submits task**

```typescript
const task = {
  description: "Add JWT authentication to the /api/users endpoint",
  constraints: ["Must maintain backward compatibility"]
};

const agents = ["devbob-rpc-api", "devbob-dashboard", "devbob-cli"];
```

**Step 2: Router analyzes intent**

```typescript
const intent = extractIntent(task.description);
// → { primary: "authentication", secondary: ["security", "api"] }

const matchingClusters = findIntentClusters(intent);
// → [
//   { intent: "authentication", components: ["auth.py::verify_token", ...], specialist: "devbob-rpc-api" },
//   { intent: "api", components: ["routes/users.py::get_user", ...], specialist: "devbob-rpc-api" }
// ]
```

**Step 3: Router finds dataflow path**

```typescript
const dataflowPath = findDataflowPath(
  source: "routes/users.py::get_user",  // Entry point
  sink: "auth.py::verify_token"         // Auth component
);
// → { hops: ["get_user", "require_auth", "verify_token"] }
```

**Step 4: Router selects agent**

```typescript
const decision = routeTask(task, functionalGraph, intentGraph, agents);
// → {
//   targetAgent: "devbob-rpc-api",
//   intentAlignment: 0.92,
//   contextToShare: ["auth-design-impulse", "api-patterns-impulse"],
//   fallbackAgents: ["devbob-opencode"]
// }
```

**Step 5: Delegate to agent**

```typescript
const result = await acp_delegate({
  target: "docker://devbob-rpc-api",
  taskDescription: "Add JWT authentication to users endpoint",
  prompt: `${task.description}
  
  Context:
  - Follow the authentication pattern established in auth.py::verify_token
  - Dataflow path: get_user → require_auth → verify_token
  - Maintain backward compatibility (constraint)
  
  Expected outcome:
  - Update routes/users.py::get_user to require JWT
  - Add tests for authenticated and unauthenticated requests
  - Update API documentation`,
  shareImpulses: decision.contextToShare,
  timeout: 600
});
```

**Step 6: Process feedback**

```typescript
await processFeedback({
  activityId: result.activityId,
  success: true,
  cost: 0.15,
  duration: 300000,
  componentsModified: [
    "routes/users.py::get_user",
    "auth.py::require_auth"
  ]
});

// Updates intentGraph:
// - routes/users.py::get_user now has successRate += 0.1
// - auth.py cluster specialist confirmed as "devbob-rpc-api"
// - New annotation: "Added JWT auth to get_user endpoint. Required by security audit."
```

**Step 7: Next task benefits from learning**

```typescript
const nextTask = {
  description: "Add authentication to /api/posts endpoint"
};

const nextDecision = routeTask(nextTask, functionalGraph, intentGraph, agents);
// → {
//   targetAgent: "devbob-rpc-api",  // ← Learned from previous success
//   intentAlignment: 0.95,          // ← Higher confidence now
//   contextToShare: ["auth-design-impulse", "users-auth-example-impulse"]
// }
```

---

## Benefits

### 1. Self-Organizing Specialization
- Agents learn which tasks they're best at
- No manual role assignment needed
- Adapts to changing codebase structure

### 2. Intent-Aware Routing
- LLM understands "why" not just "what"
- Routes based on design intent, not just function signatures
- Preserves architectural decisions

### 3. Continuous Learning
- Every execution improves routing decisions
- Error patterns inform future routing
- Success rates guide specialization

### 4. Cross-Repo Coordination
- Dataflow paths span repositories
- MESSAGE_FOR: annotations guide coordination
- Intent clusters identify shared responsibilities

### 5. Explainable Decisions
- Routing decisions include reasoning
- Dataflow paths show data journey
- Intent alignment score shows confidence

---

## Metrics & Observability

### Key Metrics

1. **Routing Accuracy**: Did the chosen agent successfully complete the task?
2. **Intent Alignment**: Confidence score from LLM router
3. **Specialist Stability**: How often do specialist assignments change?
4. **Dataflow Coverage**: % of components mapped in functional graph
5. **Annotation Coverage**: % of components with intent annotations
6. **Learning Rate**: How quickly do success rates improve?

### Dashboards

1. **Routing Dashboard**
   - Recent routing decisions
   - Intent alignment distribution
   - Fallback usage rate
   - Agent utilization

2. **Learning Dashboard**
   - Intent cluster evolution over time
   - Specialist change log
   - Success rate trends per agent
   - Error pattern frequency

3. **Dataflow Dashboard**
   - Visualize dataflow paths
   - Highlight high-traffic components
   - Show cross-repo dependencies
   - Identify bottlenecks

---

## Implementation Checklist

### Phase 1: Graph Construction
- [ ] Implement `DataflowGraphBuilder` service
- [ ] Implement `IntentGraphBuilder` service
- [ ] Create SurrealDB schema
- [ ] Build graph visualization dashboard
- [ ] Add Metabob MCP integration
- [ ] Test on all 4 DevBob repositories

### Phase 2: Intent Router
- [ ] Implement intent extraction (LLM)
- [ ] Implement agent scoring algorithm
- [ ] Implement context selection
- [ ] Create routing API endpoints
- [ ] Integrate with `acp_delegate`
- [ ] Add routing decision logging

### Phase 3: Feedback Loop
- [ ] Hook activity execution lifecycle
- [ ] Implement feedback processing
- [ ] Build auto-annotation pipeline
- [ ] Create learning metrics dashboard
- [ ] Test feedback → routing improvement cycle

### Phase 4: Multi-Agent Orchestration
- [ ] Implement multi-hop routing
- [ ] Add parallel execution support
- [ ] Build cross-repo coordination
- [ ] Create orchestration activity templates
- [ ] Add integration test suite

### Documentation
- [ ] API documentation
- [ ] Architecture diagrams
- [ ] Usage examples
- [ ] Troubleshooting guide
- [ ] Performance tuning guide

---

## Next Steps

1. **Review and Refine Design**
   - Validate with stakeholders
   - Identify missing components
   - Prioritize features

2. **Prototype Phase 1**
   - Build functional graph for metabob-rpc-api
   - Extract intent graph from annotations
   - Visualize in dashboard

3. **Validate Approach**
   - Test routing decisions manually
   - Compare LLM routing vs. manual routing
   - Measure intent alignment accuracy

4. **Scale to Multi-Agent**
   - Extend to all 4 DevBob containers
   - Implement feedback loop
   - Measure learning rate

---

## Related Documents

- [MULTI_CONTAINER_DEVBOB_ARCHITECTURE.md](./MULTI_CONTAINER_DEVBOB_ARCHITECTURE.md)
- [DATAFLOW_TRACKING.md](./DATAFLOW_TRACKING.md)
- [DEVBOB_ACTIVITY_WORKFLOWS.md](./DEVBOB_ACTIVITY_WORKFLOWS.md)
- [AGENT_PROGRAMMING_SYSTEM_DESIGN.md](./AGENT_PROGRAMMING_SYSTEM_DESIGN.md)

---

**Status**: Design Complete - Ready for Implementation  
**Estimated Effort**: 4-6 weeks (4 engineers)  
**Dependencies**: Metabob CPG, Activity Execution System, ACP Delegation
