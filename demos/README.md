# Meta-Loop Demonstration

This directory contains demonstrations of the complete self-improving system - showing how activities create, optimize, and improve other activities.

## Files

### `meta-loop-demonstration.sh`

Interactive demonstration showing the complete becoming process:

1. **Virgin Goal** → No template exists, system improvises
2. **Ribosome Extraction** → Successful execution becomes template
3. **Thompson Sampling** → Template recommended with increasing confidence
4. **Variant Creation** → Failures trigger intelligent mutations
5. **Cross-Vessel Execution** → Shape-based routing via discovery
6. **Progressive Determinism** → LLM patterns become fast resolvers
7. **Meta-Loop** → Complete autonomous improvement cycle

**Usage:**
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
./demos/meta-loop-demonstration.sh
```

The script walks through each step with explanations, pausing for user interaction. It shows:
- Execution traces with metrics
- Thompson Sampling evolution
- Variant creation logic
- Cross-vessel resolution
- Cost/performance improvements

## Bootstrap Activities

The demonstration references four bootstrap activities created in `repos/minibob/activities/meta/`:

### 1. `register-shape.json`
**Purpose**: Register new impulse shapes with activity-API

**Tasks**:
- Validate JSON Schema
- Check for name conflicts
- POST to `/v2/shapes`
- Confirm registration

**When to use**: After creating new data types through activity execution

### 2. `register-resolver.json`
**Purpose**: Register resolver capabilities with discovery-vessel

**Tasks**:
- Test resolver health endpoint
- POST registration to discovery
- Verify registration succeeded
- Initialize heartbeat schedule

**When to use**: After creating new vessel or adding resolver capabilities

### 3. `optimize-composition.json`
**Purpose**: Analyze and improve activity composition chains

**Tasks**:
- Fetch composition graph from backend
- Analyze bottlenecks (duration, cost, success rate)
- Generate optimized templates
- Register variants for Thompson Sampling
- Create optimization report

**When to use**: When activity chains are slow or expensive

### 4. `extract-deterministic-resolver.json`
**Purpose**: Convert LLM operations to fast deterministic resolvers (progressive determinism)

**Tasks**:
- Fetch tool usage patterns for impulse shape
- Identify consistent deterministic patterns
- Generate TypeScript resolver code
- Create extraction report

**When to use**: When LLM operations show consistent tool call patterns

## Running the Bootstrap Activities

### Example 1: Register a New Shape

```bash
cd repos/minibob

# After activity creates new data type "ui_component"
bun run index.ts --activity system:register-shape --vars '{
  "shapeName": "ui_component",
  "shapeSchema": {
    "type": "object",
    "properties": {
      "primitive": {"type": "object"},
      "position": {"type": "object"},
      "layer": {"type": "number"}
    }
  },
  "shapeExample": {
    "primitive": {"type": "chart", "data": []},
    "position": {"type": "flow"},
    "layer": 0
  }
}'
```

### Example 2: Optimize Slow Compositions

```bash
# Find and optimize slow activity chains
bun run index.ts --activity system:optimize-composition --vars '{
  "targetMetric": "duration",
  "minExecutions": 5
}'
```

### Example 3: Extract Deterministic Resolver

```bash
# Convert LLM-based source_code resolution to fast bash resolver
bun run index.ts --activity system:extract-deterministic-resolver --vars '{
  "impulseShape": "source_code",
  "minExecutions": 10,
  "minSuccessRate": 0.90
}'
```

## The Complete Meta-Loop

```
┌─────────────────────────────────────────────────────────────┐
│              SELF-IMPROVING SYSTEM LOOP                     │
└─────────────────────────────────────────────────────────────┘

User Goal
  ↓
Execute Activity (improvise or use template)
  ↓
Capture Trace (steps, impulses, metrics)
  ↓
Extract Template (ribosome if successful)
  ↓
Thompson Update (α++ or β++)
  ↓
Create Variant (if 3+ failures)
  ↓
Optimize Composition (periodically)
  ↓
Extract Resolver (when patterns emerge)
  ↓
Register Shape (when new types emerge)
  ↓
LOOP CLOSES → Continuous improvement
```

## Key Principles

1. **Activities All The Way Down**
   - Template extraction is an activity
   - Variant creation is an activity
   - Composition optimization is an activity
   - Resolver extraction is an activity
   - Shape registration is an activity

2. **Shapes Enable Composition**
   - Activities declare input_shapes and output_shapes
   - System learns which activities can chain together
   - Composition graph tracks successful sequences

3. **Thompson Sampling Provides Selection Pressure**
   - Better activities get higher α
   - Worse activities get higher β
   - System explores (tries new) and exploits (uses proven)

4. **Traces Enable Learning**
   - Every execution captured with full state
   - Patterns extracted from successful traces
   - Failures analyzed for variant creation

5. **Progressive Determinism**
   - LLM operations that show consistent patterns
   - Become fast, free, deterministic resolvers
   - System learns to avoid expensive operations

6. **Cross-Vessel Collaboration**
   - Discovery-vessel enables dynamic routing
   - Shape-based resolution (no hardcoded endpoints)
   - Activities execute across multiple vessels seamlessly

## Observing the Meta-Loop

### Activity Dashboard

Watch the becoming process in real-time:
- Template performance metrics (Thompson α/β)
- Composition graph visualization
- Execution trace timeline
- Variant genealogy

### Backend Queries

```bash
# View Thompson Sampling scores
curl https://activity.metabob.com/v2/activities/templates

# View composition graph
curl https://activity.metabob.com/v2/activities/composition/graph

# View tool usage patterns
curl https://activity.metabob.com/v2/activities/tool-usage

# View execution traces
curl https://activity.metabob.com/v2/activities/execution-traces?limit=10
```

### Logs

```bash
# MiniBob logs show activity selection
tail -f ~/.minibob/minibob.log | grep "Thompson"

# Activity-API logs show learning updates
kubectl logs -n activity-system -l app=activity-api | grep "alpha"
```

## Next Steps

1. **Run the demonstration** - See the complete meta-loop in action
2. **Execute bootstrap activities** - Register shapes, optimize compositions
3. **Observe autonomous improvement** - Watch Thompson Sampling learn
4. **Add new meta-activities** - Create activities that improve activities
5. **Visualize in dashboard** - See the process-of-becoming continuously

The system is now **completely self-describing and self-improving** through activity execution.
