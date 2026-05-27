# Workbench Chain-Based UX Design

> **Status**: Design complete — implementation shipped as of workbench v0.3.x
> **Version**: 1.0.0
> **Date**: 2026-04-24
> **Purpose**: Transform the workbench into a chain-like interface where user stories, goals, and workflows are treated as executable activities
>
> **Implementation note (2026-05-27):** The features described in this document are now implemented. The workbench ships a trajectory editor (horizontal CSS-Grid drag-reorder, parallel rows, save-as-variant), composition builder (React Flow drag-and-drop with shape-compatibility validation and cycle detection), resolver-first TaskEditor, live execution overlay (WebSocket with backoff + catchup), backward-chaining panel for missing shapes, and goal-completion bar. This document remains the design reference for the chain-based UX intent and the vocabulary it introduced (impulse cards, insertion zones, shape badges, Thompson Δα/Δβ badges). For the current feature inventory see `CLAUDE.md §Workbench`.
>
> **Bus update (2026-05-27):** The workbench's real-time overlay (the `task.*` and `impulse.resolved` events that drive the live execution view) now draws from the substrate-wide neutral broadcast bus rather than a dedicated workbench-only WebSocket channel. Existing subscribers — workbench, ribosome-vessel, concept-db — continue receiving events unchanged; the bus is additive, not a breaking change. The practical consequence is that the workbench shares its event source with every other substrate subscriber: what the workbench sees is exactly what the substrate does, with no filtering layer that could introduce divergence between the UI view and actual execution state.

---

## Vision Statement

The workbench should present activities and impulses as **links in a chain** - a loose DAG where:
- Activities are **state transition nodes**
- Impulses are **data edges** flowing between activities
- User interactions are **activities themselves** (self-referential)
- The entire UI workflow becomes **traceable and learnable**

Instead of forms and buttons, users compose **execution chains** by:
1. Adding impulses (data injection points)
2. Selecting activities (state transformations)
3. Wiring outputs to inputs (shape-based compatibility)
4. Executing and observing the chain
5. Extracting successful chains as reusable templates

---

## Current State Analysis

### What Exists (as of 2026-04-24)

**Composition Builder** (`CompositionPage.tsx`):
- Cytoscape.js graph visualization
- Nodes = activities, Edges = composition relationships
- Filters: success rate, execution count, search
- Node details panel
- Export PNG/JSON
- **Limitation**: Read-only visualization, no authoring

**Type System** (`types/index.ts`):
- `ActivityTemplate`, `ExecutionTrace`, `TaskExecution`
- Thompson Sampling metrics
- WebSocket message types
- **Limitation**: No impulse chain types, no UI workflow trace types

**Documentation**:
- `OPENSPEC.md`: Goal prediction, selection explanation, trace explorer
- `INDEX.md`: Phase 1 (template browsing), Phase 2 (interactive editing)
- **Limitation**: Traditional CRUD interface design, not chain-based

### What's Missing

1. **Chain-based composition interface** (drag-and-drop activities + impulses)
2. **Impulse insertion zones** (add data between activities)
3. **Resolver discovery panel** (find vessels by shape)
4. **Live execution preview** (predict state transitions)
5. **UI workflow tracing** (record user interactions as activities)
6. **Template modification as activity** (meta-activity for template editing)

---

## Core Design Principles

### 1. Activities All the Way Down

Every user action is an activity that can be traced, learned from, and automated:

| User Action | Activity Template | Output Impulse |
|-------------|------------------|----------------|
| Create new activity | `ui_create_activity` | `activityTemplate` |
| Wire activities together | `ui_wire_chain` | `compositionGraph` |
| Find resolver for shape | `ui_discover_resolver` | `vesselCapabilities` |
| Explain selection | `ui_explain_thompson` | `selectionReasoning` |
| Modify template task | `ui_modify_task` | `activityTemplate_updated` |
| Preview execution | `ui_simulate_execution` | `statePrediction` |
| Execute chain | `ui_execute_chain` | `executionTrace` |

**Self-referential loop**: UI workflows produce traces → Traces feed learning → Learning improves UI suggestions → Better UI patterns emerge

### 2. Impulses as First-Class UI Elements

Impulses are not hidden in the backend - they're **visible, draggable, and insertable**:

```
┌─────────────────────────────────────────────────────────────┐
│ Chain: "Debug Production Auth Bug"                          │
│                                                              │
│  [error_log] ───→ (debug-null-pointer:v3) ───→ [patch]     │
│  [source_code] ─────────────────┘                           │
│                                                              │
│  Insert impulse here: [+ previous_fix_attempts] [+ test_r...│
│                                                              │
│  Next activity suggestion: write-tests (78% probability)    │
│  [Add to chain] [Explain why]                               │
└─────────────────────────────────────────────────────────────┘
```

**Key UX elements**:
- Impulse cards with shape badge (visual type indicator)
- Impulse metadata preview (hover for summary)
- Impulse insertion zones (between activities)
- Shape compatibility highlighting (green = match, red = conflict)

### 3. Bidirectional Mapping and Discovery

The UI supports both forward and backward reasoning:

**Forward** (traditional):
- "I have these inputs → What activities can I use?"
- Shape matching, Thompson ranking

**Backward** (novel):
- "I want this output → What impulses do I need?"
- Reverse impulse lookup: `activityTemplate.inputSchema.required`
- Vessel discovery: "Which vessel can resolve this shape?"
- **Example**: User wants `test_results` → UI queries vessels advertising `test_runner` resolver

### 4. Chain Execution as State Space Exploration

Executing a chain isn't just running steps - it's **exploring possible futures**:

```
Before execution:
  State space: { source_code, error_log }
  Possible outcomes: [fix applied, tests pass] OR [fix failed, need more context]

After execution:
  Actual outcome: [fix applied, tests pass]
  New state space: { source_code_patched, test_results }
  Next possibilities: [commit, deploy, refactor]
```

**UI shows**:
- **Before**: Predicted state transitions (from historical traces)
- **During**: Live state updates (WebSocket stream)
- **After**: Actual vs predicted diff (learning feedback)

---

## User Stories Mapped to Activities

### Story 1: Create Activity From Goal

**User flow**:
1. User enters goal: "Fix auth bug in production"
2. System recommends existing activities OR suggests creation
3. User selects "Create new activity"
4. UI launches `ui_create_activity_from_goal` activity

**Activity template**: `ui_create_activity_from_goal`

```typescript
{
  id: "ui_create_activity_from_goal",
  name: "Create Activity Template from User Goal",

  inputSchema: {
    required: ["user_goal", "available_impulse_shapes"]
  },

  outputSchema: {
    produces: ["activityTemplate_draft"]
  },

  tasks: [
    {
      id: "parse_goal_keywords",
      resolver: "keyword_extraction",
      config: {
        patterns: ["fix", "debug", "implement", "refactor", "analyze"]
      }
    },
    {
      id: "infer_input_shapes",
      resolver: "shape_inference",
      config: {
        context: "available_impulse_shapes",
        keywords: "{{parse_goal_keywords.output}}"
      }
    },
    {
      id: "recommend_tasks",
      resolver: "llm_task_decomposition",
      prompt: {
        template: `Given goal: {{user_goal}}
Required inputs: {{infer_input_shapes.output}}
Suggest 3-5 tasks to achieve this goal.`
      }
    },
    {
      id: "create_template",
      resolver: "template_builder",
      config: {
        name: "{{user_goal}}",
        tasks: "{{recommend_tasks.output}}",
        inputShapes: "{{infer_input_shapes.output}}"
      }
    }
  ]
}
```

**UI component**: `CreateActivityFromGoalDialog.tsx`

```tsx
function CreateActivityFromGoalDialog() {
  const [goal, setGoal] = useState("");
  const [availableShapes, setAvailableShapes] = useState<string[]>([]);

  const { mutate: createActivity } = useMutation({
    mutationFn: async () => {
      // Execute ui_create_activity_from_goal activity
      const trace = await executeActivity("ui_create_activity_from_goal", {
        user_goal: goal,
        available_impulse_shapes: availableShapes
      });

      // Extract output impulse (activityTemplate_draft)
      return trace.output_impulses.find(i => i.shape === "activityTemplate_draft");
    },
    onSuccess: (draft) => {
      // Show draft in editor
      navigate(`/templates/edit/${draft.id}`);
    }
  });

  return (
    <Dialog>
      <DialogContent>
        <h2>Create Activity from Goal</h2>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Describe what you want to accomplish..."
        />

        <ShapeSelector
          selected={availableShapes}
          onChange={setAvailableShapes}
        />

        <Button onClick={createActivity}>
          Generate Activity Template
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

**Key insight**: The UI interaction itself is an activity execution, producing a traceable output.

---

### Story 2: Wire Activities Together

**User flow**:
1. User drags activity onto canvas
2. System shows output shapes as connection points
3. User drags connection from output to another activity's input
4. System validates shape compatibility
5. UI executes `ui_wire_chain` activity to record composition

**Activity template**: `ui_wire_chain`

```typescript
{
  id: "ui_wire_chain",
  name: "Wire Activity Chain",

  inputSchema: {
    required: ["source_activity_id", "target_activity_id", "shape_mapping"]
  },

  outputSchema: {
    produces: ["compositionGraph", "validation_result"]
  },

  tasks: [
    {
      id: "validate_shapes",
      resolver: "shape_compatibility_check",
      config: {
        sourceOutputs: "{{source_activity_id.outputSchema}}",
        targetInputs: "{{target_activity_id.inputSchema}}",
        mapping: "{{shape_mapping}}"
      }
    },
    {
      id: "check_cycles",
      resolver: "graph_cycle_detection",
      config: {
        existingGraph: "current_composition",
        newEdge: {
          from: "{{source_activity_id}}",
          to: "{{target_activity_id}}"
        }
      }
    },
    {
      id: "record_composition",
      resolver: "composition_recorder",
      config: {
        edge: {
          parentActivityId: "{{source_activity_id}}",
          childActivityId: "{{target_activity_id}}",
          shapeMapping: "{{shape_mapping}}"
        }
      }
    }
  ]
}
```

**UI component**: `ChainComposer.tsx`

```tsx
function ChainComposer() {
  const [nodes, setNodes] = useState<ChainNode[]>([]);
  const [edges, setEdges] = useState<ChainEdge[]>([]);

  const handleConnect = useCallback(async (
    source: string,
    target: string,
    shapes: Record<string, string>
  ) => {
    // Execute ui_wire_chain activity
    const trace = await executeActivity("ui_wire_chain", {
      source_activity_id: source,
      target_activity_id: target,
      shape_mapping: shapes
    });

    const validation = trace.output_impulses.find(
      i => i.shape === "validation_result"
    );

    if (validation.content.valid) {
      setEdges([...edges, { source, target, shapes }]);
    } else {
      toast.error(validation.content.reason);
    }
  }, [edges]);

  return (
    <div className="chain-composer">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onConnect={handleConnect}
        nodeTypes={{
          activity: ActivityNode,
          impulse: ImpulseNode
        }}
      />

      <ImpulseInsertionPanel />
      <ActivityPalette />
    </div>
  );
}
```

---

### Story 3: Find Resolver for Shape

**User flow**:
1. User selects an impulse shape (e.g., `test_results`)
2. System queries discovery-vessel for vessels with `test_runner` resolver
3. UI shows vessel list with capabilities and health
4. User selects vessel to use for this chain

**Activity template**: `ui_discover_resolver`

```typescript
{
  id: "ui_discover_resolver",
  name: "Discover Resolver for Impulse Shape",

  inputSchema: {
    required: ["impulse_shape"]
  },

  outputSchema: {
    produces: ["vesselCapabilities", "resolver_recommendations"]
  },

  tasks: [
    {
      id: "query_discovery",
      resolver: "discovery_vessel_query",
      config: {
        shape: "{{impulse_shape}}",
        includeHealth: true
      }
    },
    {
      id: "rank_by_performance",
      resolver: "resolver_performance_scorer",
      config: {
        vessels: "{{query_discovery.output}}",
        shape: "{{impulse_shape}}"
      }
    },
    {
      id: "format_recommendations",
      resolver: "ui_formatter",
      config: {
        vessels: "{{rank_by_performance.output}}",
        format: "capability_list"
      }
    }
  ]
}
```

**UI component**: `ResolverDiscoveryPanel.tsx`

```tsx
function ResolverDiscoveryPanel({ shape }: { shape: string }) {
  const { data: vessels } = useQuery({
    queryKey: ['discover-resolver', shape],
    queryFn: async () => {
      const trace = await executeActivity("ui_discover_resolver", {
        impulse_shape: shape
      });

      return trace.output_impulses.find(
        i => i.shape === "vesselCapabilities"
      ).content;
    }
  });

  return (
    <Sheet>
      <SheetContent>
        <h3>Resolvers for: {shape}</h3>

        {vessels?.map(vessel => (
          <VesselCard
            key={vessel.id}
            vessel={vessel}
            onSelect={() => {/* wire to chain */}}
          />
        ))}
      </SheetContent>
    </Sheet>
  );
}
```

---

### Story 4: Explain Activity Selection

**User flow**:
1. Chain executes, selects activity variant based on Thompson Sampling
2. User clicks "Why this variant?" button
3. UI executes `ui_explain_thompson` activity
4. System shows selection reasoning with interactive what-if analysis

**Activity template**: `ui_explain_thompson`

```typescript
{
  id: "ui_explain_thompson",
  name: "Explain Thompson Sampling Selection",

  inputSchema: {
    required: ["execution_trace_id"]
  },

  outputSchema: {
    produces: ["selectionReasoning", "alternative_scenarios"]
  },

  tasks: [
    {
      id: "fetch_trace",
      resolver: "trace_loader",
      config: {
        traceId: "{{execution_trace_id}}"
      }
    },
    {
      id: "compute_thompson_scores",
      resolver: "thompson_calculator",
      config: {
        activityId: "{{fetch_trace.output.activity_id}}",
        context: "{{fetch_trace.output.input_shapes}}"
      }
    },
    {
      id: "explain_selection",
      resolver: "llm_explainer",
      prompt: {
        template: `Explain why variant {{fetch_trace.output.variant_id}} was selected.

Thompson scores:
{{compute_thompson_scores.output}}

Historical success rates:
{{fetch_trace.output.shape_conditioned_success}}

Random sample value: {{fetch_trace.output.random_sample}}`
      }
    },
    {
      id: "simulate_alternatives",
      resolver: "what_if_simulator",
      config: {
        variants: "{{compute_thompson_scores.output.all_variants}}",
        changeInputShapes: true
      }
    }
  ]
}
```

**UI component**: `ThompsonExplainer.tsx`

```tsx
function ThompsonExplainer({ executionId }: { executionId: string }) {
  const { data: explanation } = useQuery({
    queryKey: ['explain-thompson', executionId],
    queryFn: async () => {
      const trace = await executeActivity("ui_explain_thompson", {
        execution_trace_id: executionId
      });

      return {
        reasoning: trace.output_impulses.find(i => i.shape === "selectionReasoning"),
        alternatives: trace.output_impulses.find(i => i.shape === "alternative_scenarios")
      };
    }
  });

  return (
    <Card>
      <CardHeader>
        <h3>Why was this variant selected?</h3>
      </CardHeader>

      <CardContent>
        <ThompsonScoreChart scores={explanation.reasoning.content.scores} />

        <div className="reasoning">
          {explanation.reasoning.content.explanation}
        </div>

        <Accordion>
          <AccordionItem value="alternatives">
            <AccordionTrigger>What if inputs were different?</AccordionTrigger>
            <AccordionContent>
              <WhatIfSimulator scenarios={explanation.alternatives.content} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
```

---

### Story 5: Modify Activity Template

**User flow**:
1. User opens activity template editor
2. Modifies task prompt or validation rules
3. UI executes `ui_modify_task` activity
4. System creates variant and records modification rationale

**Activity template**: `ui_modify_task`

```typescript
{
  id: "ui_modify_task",
  name: "Modify Activity Template Task",

  inputSchema: {
    required: ["activity_template_id", "task_id", "modifications"]
  },

  outputSchema: {
    produces: ["activityTemplate_updated", "modification_trace"]
  },

  tasks: [
    {
      id: "fetch_template",
      resolver: "template_loader",
      config: {
        templateId: "{{activity_template_id}}"
      }
    },
    {
      id: "apply_modifications",
      resolver: "template_mutator",
      config: {
        template: "{{fetch_template.output}}",
        taskId: "{{task_id}}",
        changes: "{{modifications}}"
      }
    },
    {
      id: "validate_template",
      resolver: "template_validator",
      config: {
        template: "{{apply_modifications.output}}"
      }
    },
    {
      id: "create_variant",
      resolver: "variant_creator",
      config: {
        baseTemplate: "{{activity_template_id}}",
        modifiedTemplate: "{{apply_modifications.output}}",
        rationale: "{{modifications.rationale}}"
      }
    }
  ]
}
```

**UI component**: `TaskEditor.tsx`

```tsx
function TaskEditor({
  templateId,
  taskId
}: {
  templateId: string;
  taskId: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [rationale, setRationale] = useState("");

  const { mutate: saveChanges } = useMutation({
    mutationFn: async () => {
      const trace = await executeActivity("ui_modify_task", {
        activity_template_id: templateId,
        task_id: taskId,
        modifications: {
          prompt: { template: prompt },
          rationale
        }
      });

      return trace.output_impulses.find(
        i => i.shape === "activityTemplate_updated"
      );
    }
  });

  return (
    <div className="task-editor">
      <MonacoEditor
        value={prompt}
        onChange={setPrompt}
        language="markdown"
      />

      <textarea
        placeholder="Why are you making this change?"
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
      />

      <Button onClick={saveChanges}>
        Save as Variant
      </Button>
    </div>
  );
}
```

---

### Story 6: Preview Execution

**User flow**:
1. User builds a chain but hasn't executed yet
2. Clicks "Preview execution"
3. UI executes `ui_simulate_execution` activity
4. System shows predicted state transitions based on historical traces

**Activity template**: `ui_simulate_execution`

```typescript
{
  id: "ui_simulate_execution",
  name: "Simulate Chain Execution",

  inputSchema: {
    required: ["composition_graph", "input_impulses"]
  },

  outputSchema: {
    produces: ["statePrediction", "confidence_intervals"]
  },

  tasks: [
    {
      id: "fetch_historical_traces",
      resolver: "trace_query",
      config: {
        activityIds: "{{composition_graph.nodes.map(n => n.id)}}",
        limit: 50
      }
    },
    {
      id: "predict_duration",
      resolver: "duration_predictor",
      config: {
        traces: "{{fetch_historical_traces.output}}",
        chainLength: "{{composition_graph.nodes.length}}"
      }
    },
    {
      id: "predict_cost",
      resolver: "cost_predictor",
      config: {
        traces: "{{fetch_historical_traces.output}}",
        inputShapes: "{{input_impulses.map(i => i.shape)}}"
      }
    },
    {
      id: "predict_success",
      resolver: "success_predictor",
      config: {
        traces: "{{fetch_historical_traces.output}}",
        composition: "{{composition_graph}}"
      }
    },
    {
      id: "simulate_state_transitions",
      resolver: "state_space_simulator",
      config: {
        initialState: "{{input_impulses}}",
        activities: "{{composition_graph.nodes}}",
        historicalPatterns: "{{fetch_historical_traces.output}}"
      }
    }
  ]
}
```

**UI component**: `ExecutionPreview.tsx`

```tsx
function ExecutionPreview({
  chain
}: {
  chain: CompositionGraph;
}) {
  const { data: prediction } = useQuery({
    queryKey: ['simulate-execution', chain.id],
    queryFn: async () => {
      const trace = await executeActivity("ui_simulate_execution", {
        composition_graph: chain,
        input_impulses: chain.inputs
      });

      return trace.output_impulses.find(
        i => i.shape === "statePrediction"
      ).content;
    }
  });

  return (
    <Card>
      <CardHeader>
        <h3>Execution Preview</h3>
      </CardHeader>

      <CardContent>
        <div className="metrics-grid">
          <MetricCard
            label="Expected Duration"
            value={`${prediction.duration_ms}ms`}
            confidence={prediction.confidence_intervals.duration}
          />

          <MetricCard
            label="Expected Cost"
            value={`$${prediction.cost_usd}`}
            confidence={prediction.confidence_intervals.cost}
          />

          <MetricCard
            label="Success Probability"
            value={`${prediction.success_rate * 100}%`}
            confidence={prediction.confidence_intervals.success}
          />
        </div>

        <StateTransitionTree
          transitions={prediction.state_transitions}
        />
      </CardContent>
    </Card>
  );
}
```

---

## UI Component Architecture

### Chain Composer (Core Interface)

```
┌───────────────────────────────────────────────────────────────┐
│ Chain: "Debug Production Auth Bug"                [Execute]   │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐                                             │
│  │ Activity     │  Drag activities from palette               │
│  │ Palette      │  • debug-null-pointer                       │
│  │              │  • analyze-stack-trace                      │
│  │ [Search...]  │  • write-tests                              │
│  │              │  • commit-changes                           │
│  │ Categories:  │                                             │
│  │ ☑ feature    │  ┌────────────────────────────────┐        │
│  │ ☑ bugfix     │  │ Canvas                         │        │
│  │ ☐ refactor   │  │                                │        │
│  └──────────────┘  │  [error_log] ───┐             │        │
│                     │                  │             │        │
│  ┌──────────────┐  │  [source_code] ──┼──→ (debug) │        │
│  │ Impulse      │  │                  │             │        │
│  │ Library      │  │                  └──→ [patch]  │        │
│  │              │  │                                │        │
│  │ Available:   │  │  Insert here: [+]              │        │
│  │ • error_log  │  │                                │        │
│  │ • test_rslt  │  │  Suggested: write-tests (78%)  │        │
│  │ • git_diff   │  └────────────────────────────────┘        │
│  │              │                                             │
│  │ [+ Create]   │  ┌────────────────────────────────┐        │
│  └──────────────┘  │ State Preview                  │        │
│                     │                                │        │
│  ┌──────────────┐  │ Before: { source_code, error } │        │
│  │ Resolver     │  │ After:  { patched, tests }     │        │
│  │ Discovery    │  │                                │        │
│  │              │  │ Duration: ~45s (±12s)          │        │
│  │ Find vessels │  │ Cost: $0.12 (±0.03)            │        │
│  │ for shape... │  └────────────────────────────────┘        │
│  └──────────────┘                                             │
└───────────────────────────────────────────────────────────────┘
```

**Key components**:

1. **ActivityPalette** (`ActivityPalette.tsx`)
   - Searchable list of activity templates
   - Category filters
   - Thompson score badges
   - Drag-to-canvas interaction

2. **ImpulseLibrary** (`ImpulseLibrary.tsx`)
   - Available impulse shapes
   - Create new impulse
   - Shape metadata preview

3. **ChainCanvas** (`ChainCanvas.tsx`)
   - React Flow based
   - Activity nodes with input/output ports
   - Impulse nodes with shape indicators
   - Connection validation (shape compatibility)
   - Insertion zones between activities

4. **StatePreview** (`StatePreview.tsx`)
   - Before/after state visualization
   - Confidence intervals
   - Cost/duration estimates

5. **ResolverDiscoveryPanel** (`ResolverDiscoveryPanel.tsx`)
   - Query vessels by shape
   - Health indicators
   - Performance metrics

---

## Self-Referential UI Tracing

### Recording UI Workflows

Every UI interaction produces a trace that feeds the learning loop:

```typescript
// User drags activity onto canvas
const uiTrace = {
  trace_id: "ui-abc123",
  activity_id: "ui_compose_chain",

  tasks: [
    {
      task_id: "select_activity",
      resolver: "ui_interaction",
      input: { activityId: "debug-null-pointer:v3" },
      output: { selected: true }
    },
    {
      task_id: "position_on_canvas",
      resolver: "ui_interaction",
      input: { x: 340, y: 120 },
      output: { positioned: true }
    },
    {
      task_id: "validate_composition",
      resolver: "composition_validator",
      input: { newNode: "debug-null-pointer:v3", existingGraph: {...} },
      output: { valid: true }
    }
  ],

  outcome: {
    success: true,
    duration_ms: 1240,
    cost_usd: 0.0
  }
};

// Send to backend for learning
await backend.recordTrace(uiTrace);
```

### Learning from UI Patterns

Backend analyzes UI traces to discover patterns:

```sql
-- Which activity compositions do users create most often?
SELECT
  parent_activity_id,
  child_activity_id,
  COUNT(*) as times_composed
FROM ui_composition_traces
WHERE success = true
GROUP BY parent_activity_id, child_activity_id
ORDER BY times_composed DESC
LIMIT 10;

-- Which impulses do users insert most frequently?
SELECT
  impulse_shape,
  activity_id,
  insertion_position,
  COUNT(*) as times_inserted
FROM ui_impulse_insertion_traces
GROUP BY impulse_shape, activity_id
ORDER BY times_inserted DESC;
```

### Auto-Suggesting Based on UI History

```typescript
// After user adds debug-null-pointer to canvas
const suggestions = await backend.suggestNextActivity({
  currentActivity: "debug-null-pointer",
  context: "ui_composition",
  limit: 3
});

// Backend returns:
// [
//   { activityId: "write-tests", probability: 0.78 },
//   { activityId: "commit-changes", probability: 0.15 },
//   { activityId: "deploy", probability: 0.07 }
// ]

// UI shows:
<SuggestionPanel>
  Users typically add these activities next:
  • write-tests (78%)
  • commit-changes (15%)
  • deploy (7%)
</SuggestionPanel>
```

---

## Phase 1 Implementation Plan

### Week 1-2: Core Chain Composer

**Goals**:
- Horizontal activity sequence editor
- Drag-and-drop from palette
- Basic impulse nodes
- Shape compatibility validation

**Deliverables**:
- `ChainComposer.tsx` (main container)
- `ActivityPalette.tsx` (searchable list)
- `ChainCanvas.tsx` (React Flow integration)
- `ActivityNode.tsx` (custom node type)
- `ImpulseNode.tsx` (custom node type)

**Activities to implement**:
- `ui_add_activity_to_chain`
- `ui_wire_chain` (shape validation)
- `ui_remove_activity_from_chain`

### Week 3-4: Impulse Management

**Goals**:
- Impulse insertion zones
- Impulse library panel
- Create custom impulses
- Shape discovery

**Deliverables**:
- `ImpulseLibrary.tsx`
- `ImpulseInsertionZone.tsx`
- `CreateImpulseDialog.tsx`
- `ShapeSelector.tsx`

**Activities to implement**:
- `ui_insert_impulse`
- `ui_create_custom_impulse`
- `ui_discover_shape_sources`

### Week 5-6: Execution Preview & Live Monitoring

**Goals**:
- State space prediction
- Cost/duration estimates
- Live execution streaming
- Before/after comparison

**Deliverables**:
- `StatePreview.tsx`
- `ExecutionPreview.tsx`
- `LiveChainMonitor.tsx`
- WebSocket integration for chain execution

**Activities to implement**:
- `ui_simulate_execution`
- `ui_execute_chain`
- `ui_compare_prediction_actual`

### Week 7-8: Meta-Activities & Self-Improvement

**Goals**:
- UI workflow tracing
- Pattern discovery
- Auto-suggestions
- Template extraction from UI patterns

**Deliverables**:
- `UITraceRecorder.tsx` (HOC for tracing)
- `SuggestionPanel.tsx`
- `UIPatternExplorer.tsx`
- Backend endpoints for UI pattern queries

**Activities to implement**:
- `ui_record_workflow`
- `ui_suggest_next_step`
- `ui_extract_workflow_template`

---

## Technical Implementation Details

### Shape-Based Port System

Activities expose input/output ports based on their schemas:

```typescript
interface ActivityPort {
  id: string;
  shape: string;
  required: boolean;
  direction: "input" | "output";
  metadata: {
    description: string;
    examples: string[];
  };
}

function ActivityNode({ data }: { data: ActivityTemplate }) {
  const inputPorts = data.input_shapes?.map(shape => ({
    id: `in-${shape}`,
    shape,
    required: true,
    direction: "input"
  }));

  const outputPorts = data.output_shapes?.map(shape => ({
    id: `out-${shape}`,
    shape,
    required: false,
    direction: "output"
  }));

  return (
    <div className="activity-node">
      <div className="input-ports">
        {inputPorts.map(port => (
          <Port key={port.id} port={port} />
        ))}
      </div>

      <div className="node-body">
        {data.name}
      </div>

      <div className="output-ports">
        {outputPorts.map(port => (
          <Port key={port.id} port={port} />
        ))}
      </div>
    </div>
  );
}
```

### Connection Validation

Before allowing a connection, validate shape compatibility:

```typescript
function validateConnection(
  sourcePort: ActivityPort,
  targetPort: ActivityPort
): ValidationResult {
  // 1. Shape must match
  if (sourcePort.shape !== targetPort.shape) {
    return {
      valid: false,
      reason: `Shape mismatch: ${sourcePort.shape} → ${targetPort.shape}`
    };
  }

  // 2. Direction must be output → input
  if (sourcePort.direction !== "output" || targetPort.direction !== "input") {
    return {
      valid: false,
      reason: "Connection must be from output to input"
    };
  }

  // 3. No cycles
  if (wouldCreateCycle(sourceNode, targetNode, existingEdges)) {
    return {
      valid: false,
      reason: "Connection would create a cycle"
    };
  }

  return { valid: true };
}
```

### UI Workflow Trace Schema

```typescript
interface UIWorkflowTrace extends ExecutionTrace {
  ui_metadata: {
    sessionId: string;
    userId: string;
    startedAt: string;
    completedAt: string;
  };

  interactions: Array<{
    type: "click" | "drag" | "input" | "hover";
    target: string;
    timestamp: string;
    data: Record<string, unknown>;
  }>;

  workflow_category: "compose" | "edit" | "explore" | "debug";

  extracted_pattern?: {
    templateId: string;
    confidence: number;
    timesObserved: number;
  };
}
```

---

## Success Metrics

### Phase 1 Success Criteria

1. **User can compose a 3-activity chain** in < 2 minutes
2. **Shape validation** catches incompatible connections 100% of the time
3. **Execution preview** predicts duration within ±20%
4. **UI workflows are traced** with < 100ms overhead
5. **Auto-suggestions** appear within 500ms of adding an activity

### Learning Loop Metrics

1. **UI pattern extraction rate**: > 70% of successful workflows become templates
2. **Suggestion accuracy**: > 60% of suggested activities are accepted
3. **Workflow efficiency**: Users complete chains 30% faster after suggestions
4. **Self-improvement**: UI suggestions improve by 10%/week based on traces

---

## Open Questions & Future Work

### Open Questions

1. **How to handle concurrent chain editing?** (Multi-user collaboration)
2. **Should impulses be ephemeral or persistent?** (Lifetime management)
3. **How to version chain templates?** (Git-like branching?)
4. **What's the rollback mechanism?** (Undo/redo for chain composition)

### Future Work (Post-Phase 1)

1. **Chain Templates Library**: Save and share common patterns
2. **Visual Diff for Chains**: Compare two chain versions side-by-side
3. **Time-Travel Debugging**: Replay historical chain executions
4. **Collaborative Editing**: Real-time multi-user chain composition
5. **AI Chain Optimization**: LLM suggests chain improvements
6. **Cost Optimization Hints**: Replace expensive activities with cheaper variants
7. **Chain Versioning**: Git-style branches and merges
8. **Export to Code**: Generate MiniBob script from chain

---

## Appendix: Example User Workflow

### Complete End-to-End Scenario

**Goal**: User wants to debug a production auth bug

**Step 1: Create Chain**
```
User: [New Chain] → enters "Debug production auth bug"
System: Executes ui_create_chain
Output: Empty chain canvas with suggested starting activities
```

**Step 2: Add Input Impulses**
```
User: Drags "error_log" from impulse library to canvas
User: Drags "source_code" from impulse library to canvas
System: Validates impulses, shows green "ready" indicator
```

**Step 3: Add Activity**
```
User: Searches for "debug" in activity palette
System: Shows debug-null-pointer:v3 (93% success rate)
User: Drags debug-null-pointer:v3 to canvas
System: Auto-connects error_log + source_code to inputs
```

**Step 4: Preview Execution**
```
User: Clicks "Preview Execution"
System: Executes ui_simulate_execution
Output:
  - Expected duration: 45s (±12s)
  - Expected cost: $0.12
  - Success probability: 93%
  - Predicted outputs: patched_source_code, fix_summary
```

**Step 5: See Suggestion**
```
System: "Users typically add write-tests next (78%)"
User: Clicks "Add to chain"
System: Adds write-tests activity, wires patched_source_code → test input
```

**Step 6: Execute Chain**
```
User: Clicks "Execute Chain"
System: Executes ui_execute_chain activity
  → Invokes debug-null-pointer:v3
  → Streams live updates via WebSocket
  → Invokes write-tests
Output: Complete execution trace with before/after state
```

**Step 7: Compare Prediction**
```
System: Shows actual vs predicted:
  - Duration: 42s (predicted 45s) ✓
  - Cost: $0.11 (predicted $0.12) ✓
  - Success: true ✓
User: Sees confidence in predictions increase for next time
```

**Step 8: Save as Template**
```
User: Clicks "Save as Template"
System: Executes ui_extract_workflow_template
Output: New activity template "debug-and-test-production-bug"
  - Input: error_log, source_code
  - Steps: debug-null-pointer, write-tests
  - Thompson: α=1, β=0
Next time similar goal arrives, this template is available
```

---

**End of Design Document**

This design transforms the workbench into a self-improving, chain-based interface where:
- Every user action is an activity
- Every workflow becomes a template
- Every trace feeds the learning loop
- The UI itself gets smarter over time
