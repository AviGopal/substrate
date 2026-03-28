## ADDED Requirements

### Requirement: Query-to-UI flow via MiniBob activity execution
The system SHALL process all user queries through MiniBob's goal processor, executing activities or improvising, never through direct API calls from the frontend.

#### Scenario: Query triggers goal processing
- **WHEN** user submits a natural language query via the input
- **THEN** the query is sent to MiniBob via WebSocket as `{ type: 'query', text: string }`
- **AND** MiniBob's goal processor analyzes intent and searches for matching activity templates
- **AND** the frontend NEVER calls backend APIs directly for data

#### Scenario: Template found via Thompson Sampling
- **WHEN** MiniBob finds matching templates for a query
- **THEN** Thompson Sampling selects the best template based on Beta distribution samples
- **AND** the selected template is executed with extracted variables
- **AND** execution is recorded for learning feedback

#### Scenario: No template found triggers improvisation
- **WHEN** no template matches the query intent
- **THEN** MiniBob improvises using LLM to generate a tool sequence
- **AND** the improvised execution is recorded
- **AND** on success, Ribosome extracts a new template for future use

#### Scenario: All data retrieval via tools
- **WHEN** MiniBob needs data to answer a query
- **THEN** MiniBob uses tools (query_surrealdb, query_kubernetes, etc.)
- **AND** tool calls are streamed to the UI as progress indicators
- **AND** tool results become data impulses that UI components reference

### Requirement: Streaming activity progress to UI
The system SHALL stream activity execution progress to the frontend in real-time via WebSocket.

#### Scenario: Task start notification
- **WHEN** MiniBob begins executing a task within an activity
- **THEN** WebSocket sends `{ type: 'thinking', text: '<task description>' }`
- **AND** the UI displays the thinking indicator

#### Scenario: Tool call progress
- **WHEN** MiniBob invokes a tool
- **THEN** WebSocket sends `{ type: 'tool_call', tool: string, status: 'started' }`
- **WHEN** the tool completes
- **THEN** WebSocket sends `{ type: 'tool_call', tool: string, status: 'completed', summary: string }`

#### Scenario: Incremental data streaming
- **WHEN** a tool returns large datasets (>20 rows)
- **THEN** data is streamed incrementally via `{ type: 'impulse_update', id: string, append: [...] }`
- **AND** the UI component re-renders as rows arrive

#### Scenario: Activity completion
- **WHEN** all tasks in an activity complete
- **THEN** WebSocket sends `{ type: 'activity_complete', success: boolean, duration: number }`
- **AND** execution trace is stored for Thompson Sampling feedback

### Requirement: UI components created via impulses only
The system SHALL render all dynamic UI content through ui_component impulses created by MiniBob, not through frontend state.

#### Scenario: MiniBob creates table component
- **WHEN** MiniBob has tabular data to display
- **THEN** MiniBob calls `create_ui_component({ type: 'table', dataRef: '<data-impulse-id>', ... })`
- **AND** a ui_component impulse is created and sent via WebSocket
- **AND** the frontend renders a TableComponent based on the impulse

#### Scenario: MiniBob creates graph component
- **WHEN** MiniBob has relationship data (nodes/edges)
- **THEN** MiniBob calls `create_ui_component({ type: 'graph', dataRef: '<data-impulse-id>', ... })`
- **AND** the frontend renders a GraphComponent with interactive visualization

#### Scenario: MiniBob creates narrative explanation
- **WHEN** MiniBob generates explanatory text
- **THEN** MiniBob calls `create_ui_component({ type: 'narrative', data: '<markdown>', ... })`
- **AND** the frontend renders formatted markdown

#### Scenario: MiniBob creates action button
- **WHEN** MiniBob offers an actionable option
- **THEN** MiniBob calls `create_ui_component({ type: 'action', props: { label, action: { tool, args } } })`
- **AND** clicking the button sends the action back to MiniBob for execution

#### Scenario: Component updates via impulse updates
- **WHEN** data changes or user requests refinement
- **THEN** MiniBob calls `update_ui_component({ id, changes })`
- **AND** the frontend re-renders the component without remounting

### Requirement: Action buttons trigger MiniBob tool execution
The system SHALL execute user-initiated actions through MiniBob tool calls, not direct API requests.

#### Scenario: User clicks action button
- **WHEN** user clicks an action button component
- **THEN** WebSocket sends `{ type: 'action', componentId: string, action: { tool, args } }`
- **AND** MiniBob executes the specified tool
- **AND** results update existing components or create new ones

#### Scenario: Row selection triggers detail query
- **WHEN** user clicks a table row with a detail action configured
- **THEN** WebSocket sends `{ type: 'action', componentId: string, action: 'select', data: rowData }`
- **AND** MiniBob processes the selection as a follow-up query with context

#### Scenario: Action requires confirmation
- **WHEN** an action is destructive or significant (e.g., resume circuit breaker)
- **THEN** MiniBob first creates a confirmation dialog component
- **AND** only executes the action after user confirms

### Requirement: Follow-up queries maintain context
The system SHALL maintain conversation context for follow-up queries within the same session.

#### Scenario: Pronoun resolution in follow-up
- **WHEN** user asks "Show me more detail on the first one"
- **THEN** MiniBob resolves "the first one" from previously displayed table data
- **AND** executes appropriate detail query with resolved entity

#### Scenario: Visualization change request
- **WHEN** user asks "Show this as a graph instead"
- **THEN** MiniBob identifies the current table component
- **AND** transforms the data and creates a graph component
- **AND** optionally removes or updates the table component

#### Scenario: Filter refinement
- **WHEN** user asks "Only show failures" after viewing a mixed table
- **THEN** MiniBob filters the existing data or re-queries with filter
- **AND** updates the existing table component with filtered data

### Requirement: Improvisation is the primary execution mode
The system SHALL treat improvisation as the default behavior, with templates serving only as learned performance optimizations.

#### Scenario: System works with zero templates
- **GIVEN** no activity templates exist in the database
- **WHEN** user submits any query
- **THEN** MiniBob improvises using LLM reasoning and available tools
- **AND** the query is answered with appropriate visualization
- **AND** no error occurs due to missing templates

#### Scenario: Novel query handled via improvisation
- **WHEN** user asks something never seen before (e.g., "Show cost variance as a histogram")
- **THEN** MiniBob reasons about the query, data needed, and visualization
- **AND** MiniBob composes rendering primitives to create the visualization
- **AND** the frontend renders whatever MiniBob describes

#### Scenario: MiniBob can deviate from template when needed
- **WHEN** a template matches a query pattern BUT context suggests different approach
- **THEN** MiniBob can choose to improvise instead of following the template
- **AND** templates are hints, not constraints

### Requirement: Learning from successful query patterns
The system SHALL record successful query→activity executions and extract templates via Ribosome.

#### Scenario: Improvisation success triggers template creation
- **WHEN** an improvised query execution succeeds
- **THEN** Ribosome analyzes the execution trace
- **AND** extracts tool sequence, query patterns, and output format
- **AND** creates a new activity template with generation_depth = parent + 1
- **AND** new template enters Thompson Sampling pool with α=1, β=0

#### Scenario: Template execution updates Thompson parameters
- **WHEN** a template-based execution completes
- **THEN** Thompson α increments on success, β increments on failure
- **AND** execution trace is stored with impulse relevance data
- **AND** tool usage patterns are recorded

#### Scenario: Failed improvisation does not create template
- **WHEN** an improvised query execution fails
- **THEN** no template is created
- **AND** failure is logged for pattern analysis
- **AND** user receives error explanation via narrative component

### Requirement: MiniBob can create visualizations it wasn't trained on
The system SHALL support MiniBob creating novel visualizations by reasoning about data and intent.

#### Scenario: Unexpected visualization request
- **WHEN** user asks "Show this as a violin plot" (not a supported chart type)
- **THEN** MiniBob reasons about alternatives
- **AND** MiniBob either approximates with available primitives OR explains what it can offer
- **AND** MiniBob does NOT fail silently or ignore the request

#### Scenario: Complex multi-dimensional visualization
- **WHEN** user asks "Show the relationship between cost, duration, and success rate"
- **THEN** MiniBob reasons about how to represent 3 dimensions
- **AND** creates an appropriate visualization (scatter with color, multiple charts, etc.)
- **AND** explains its visualization choice if non-obvious

---

## GENERIC USER FLOW

### Flow: Query Processing Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Input     │────▶│    Goal     │────▶│  Activity   │────▶│     UI      │
│   Query     │     │  Processor  │     │  Executor   │     │  Impulses   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  WebSocket  │     │  Thompson   │     │    Tool     │     │  Frontend   │
│  { query }  │     │  Sampling   │     │   Calls     │     │  Renders    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │                   │
                          │                   │
                          ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Template   │     │  Execution  │
                    │  Selection  │     │   Trace     │
                    │  OR Improv  │     │  Recording  │
                    └─────────────┘     └─────────────┘
```

### Flow: Activity Task Execution

```
FOR each task in activity.tasks:
  1. SEND thinking notification
  2. LOAD task impulses (context)
  3. EXECUTE task with LLM + tools
     - ON tool_call: SEND tool progress
     - ON tool_result: CREATE data impulse
  4. VALIDATE task output
  5. IF validation fails AND retries remain:
     - RETRY with error context
  6. SEND task complete notification

ON activity complete:
  1. STORE execution trace
  2. UPDATE Thompson parameters
  3. IF improvised AND success:
     - TRIGGER Ribosome extraction
  4. SEND activity_complete
```

### Flow: UI Component Lifecycle

```
CREATE:
  MiniBob calls create_ui_component(spec)
    → Impulse created with id, pointer, metadata
    → WebSocket sends impulse_create
    → Frontend mounts React component
    → Component resolves dataRef if present

UPDATE:
  MiniBob calls update_ui_component(id, changes)
    → Impulse updated
    → WebSocket sends impulse_update
    → Frontend re-renders component (no remount)
    → Metadata updated to reflect new state

DELETE:
  MiniBob calls delete_ui_component(id)
    → Impulse removed
    → WebSocket sends impulse_delete
    → Frontend unmounts component
    → (Query input is protected, cannot delete)
```

---

## SPECIFIC USER FLOWS

### Flow 1: Learning System - "Show high-performers we're missing"

**Query:** "Show templates with high success rate but low selection count"

**Activity Template:** `internal-dashboard/hidden-high-performers`

| Step | Task | Tool | Output |
|------|------|------|--------|
| 1 | Parse query parameters | - | Extract: success_threshold=0.8, selection_threshold=10 |
| 2 | Query template metrics | `query_surrealdb` | Data impulse: template metrics array |
| 3 | Create results table | `create_ui_component` | UI impulse: table with name, success_rate, selections |
| 4 | Generate insight | - | Narrative: "Found N underutilized templates..." |
| 5 | Create narrative | `create_ui_component` | UI impulse: narrative explanation |

**WebSocket Stream:**
```
→ { type: 'thinking', text: 'Searching for high-performing templates...' }
→ { type: 'tool_call', tool: 'query_surrealdb', status: 'started' }
→ { type: 'tool_call', tool: 'query_surrealdb', status: 'completed', summary: '7 templates found' }
→ { type: 'impulse_create', impulse: { id: 'data-001', pointer: { type: 'memo', content: [...] } } }
→ { type: 'impulse_create', impulse: { id: 'table-001', pointer: { type: 'ui_component', componentType: 'table', dataRef: 'data-001' } } }
→ { type: 'thinking', text: 'Generating insights...' }
→ { type: 'impulse_create', impulse: { id: 'narrative-001', pointer: { type: 'ui_component', componentType: 'narrative', data: '...' } } }
→ { type: 'activity_complete', success: true, duration: 2340 }
```

---

### Flow 2: Kubernetes - "Are all pods healthy?"

**Query:** "Show me pods that are not ready in activity-system"

**Activity Template:** `internal-dashboard/unhealthy-pods`

| Step | Task | Tool | Output |
|------|------|------|--------|
| 1 | Query Kubernetes pods | `query_kubernetes` | Data impulse: pod list with status |
| 2 | Filter unhealthy | - | Filter: status != 'Running' OR ready != true |
| 3 | Create results table | `create_ui_component` | UI impulse: table with name, status, restarts, age |
| 4 | Add log action buttons | `create_ui_component` | UI impulse: action buttons per row |
| 5 | Generate summary | `create_ui_component` | UI impulse: narrative or system_health |

**Rendered UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Pod Health - activity-system                        [3 unhealthy]│
├──────────────────┬──────────┬──────────┬───────┬───────────────┤
│ Name             │ Status   │ Restarts │ Age   │ Actions       │
├──────────────────┼──────────┼──────────┼───────┼───────────────┤
│ minibob-abc123   │ CrashLoop│ 5        │ 2h    │ [Logs] [Desc] │
│ surrealdb-0      │ Pending  │ 0        │ 10m   │ [Logs] [Desc] │
│ activity-api-xyz │ Running  │ 3        │ 1d    │ [Logs] [Desc] │
└──────────────────┴──────────┴──────────┴───────┴───────────────┘

3 pods require attention. minibob-abc123 is in CrashLoopBackOff
with 5 restarts. surrealdb-0 is pending, likely waiting for PVC.
```

---

### Flow 3: Multi-tenant - "Which orgs are over seat limit?"

**Query:** "Show organizations over their seat limit"

**Activity Template:** `internal-dashboard/orgs-over-limit`

| Step | Task | Tool | Output |
|------|------|------|--------|
| 1 | Query orgs with subscriptions | `query_surrealdb` | Data impulse: org + subscription join |
| 2 | Filter over-limit | - | WHERE seat_usage > seat_limit |
| 3 | Create results table | `create_ui_component` | UI impulse: table with org, usage, limit, plan |
| 4 | Add upsell indicators | - | Flag orgs close to limit |
| 5 | Create action buttons | `create_ui_component` | UI impulse: "Contact" action per row |

**SurrealQL Generated:**
```sql
SELECT
  org.name,
  org.seat_usage,
  org.seat_limit,
  sub.plan,
  org.seat_usage - org.seat_limit AS over_by
FROM organizations AS org
JOIN subscriptions AS sub ON sub.org_id = org.id
WHERE org.seat_usage > org.seat_limit
ORDER BY over_by DESC
```

---

### Flow 4: Observation - "Why did boredom pause?"

**Query:** "Why did the boredom system pause this morning?"

**Activity Template:** `internal-dashboard/explain-circuit-breaker`

| Step | Task | Tool | Output |
|------|------|------|--------|
| 1 | Get circuit breaker state | `get_circuit_breaker_state` | Data impulse: status, reason, timestamp |
| 2 | Get metrics at pause time | `query_system_health` | Data impulse: metrics snapshot |
| 3 | Analyze root cause | - | LLM correlates metrics to threshold |
| 4 | Create system health card | `create_ui_component` | UI impulse: system_health with status |
| 5 | Create explanation | `create_ui_component` | UI impulse: narrative with analysis |
| 6 | Create resume button | `create_ui_component` | UI impulse: action (if authorized) |

**Rendered UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│ System Health                                       [🔴 PAUSED] │
├─────────────────────────────────────────────────────────────────┤
│ Success Rate:  ████░░░░░░  28%  (threshold: 30%)               │
│ Paused Since:  8:23 AM today                                    │
│ Triggered By:  Automatic (low success rate)                     │
│ Correlation:   0.72 (failures are related)                      │
└─────────────────────────────────────────────────────────────────┘

The boredom system automatically paused at 8:23 AM because the
24-hour success rate dropped to 28%, below the 30% threshold.
The failure correlation of 0.72 indicates these are systematic
failures, not random exploration.

[Resume Boredom System]
```

---

### Flow 5: Composition - "Show reliable multi-step patterns"

**Query:** "Which activity chains have the highest success rates?"

**Activity Template:** `internal-dashboard/composition-patterns`

| Step | Task | Tool | Output |
|------|------|------|--------|
| 1 | Query composition graph | `query_surrealdb` | Data impulse: edges with weights |
| 2 | Filter by execution count | - | WHERE execution_count >= 5 |
| 3 | Build graph structure | - | Transform to nodes/edges format |
| 4 | Create graph component | `create_ui_component` | UI impulse: graph visualization |
| 5 | Create summary table | `create_ui_component` | UI impulse: table of top chains |

**Graph Component Data:**
```json
{
  "nodes": [
    { "id": "analyze-code", "label": "Analyze Code", "success_rate": 0.92 },
    { "id": "generate-fix", "label": "Generate Fix", "success_rate": 0.78 },
    { "id": "apply-patch", "label": "Apply Patch", "success_rate": 0.95 }
  ],
  "edges": [
    { "source": "analyze-code", "target": "generate-fix", "weight": 0.85, "count": 47 },
    { "source": "generate-fix", "target": "apply-patch", "weight": 0.91, "count": 38 }
  ]
}
```

---

### Flow 6: Tool Patterns - "Which tools fail most often?"

**Query:** "Show tool usage patterns and failure rates"

**Activity Template:** `internal-dashboard/tool-patterns`

| Step | Task | Tool | Output |
|------|------|------|--------|
| 1 | Query tool patterns | `query_tool_patterns` | Data impulse: tool metrics |
| 2 | Calculate failure rates | - | success_count / total_count |
| 3 | Sort by failure rate | - | Highest failures first |
| 4 | Create table | `create_ui_component` | UI impulse: table with tool, calls, success% |
| 5 | Highlight problems | - | Conditional styling for low success |

**Rendered UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Tool Usage Patterns (7 days)                                    │
├──────────────────┬───────────┬───────────┬─────────────────────┤
│ Tool             │ Calls     │ Success   │ Trend               │
├──────────────────┼───────────┼───────────┼─────────────────────┤
│ query_surrealdb  │ 1,247     │ 94%       │ ████████████████░░  │
│ bash             │ 892       │ 71%       │ ██████████████░░░░  │ ⚠️
│ edit             │ 654       │ 89%       │ ████████████████░░  │
│ query_kubernetes │ 423       │ 98%       │ ██████████████████  │
│ read             │ 2,103     │ 99%       │ ██████████████████  │
└──────────────────┴───────────┴───────────┴─────────────────────┘

⚠️ bash has a lower success rate (71%). Common failure: permission
denied on /workspace paths. Consider checking volume mounts.
```

---

### Flow 7: Improvisation Example - Novel Query

**Query:** "Show me the cost per successful execution by template category"

**No matching template exists - MiniBob improvises:**

| Step | Action | Output |
|------|--------|--------|
| 1 | LLM analyzes query | Intent: aggregate cost metrics by category |
| 2 | LLM plans tool sequence | [query_surrealdb, create_ui_component] |
| 3 | LLM generates SurrealQL | Complex aggregation query |
| 4 | Execute query | Data retrieved |
| 5 | Create visualization | Table or bar chart |
| 6 | On success: Ribosome | New template extracted |

**Generated SurrealQL:**
```sql
SELECT
  template.category,
  count() AS executions,
  math::sum(execution.cost_usd) AS total_cost,
  count() FILTER (WHERE execution.success = true) AS successes,
  math::sum(execution.cost_usd) / count() FILTER (WHERE success = true) AS cost_per_success
FROM activity_executions AS execution
JOIN activity_template AS template ON execution.template_id = template.id
GROUP BY template.category
ORDER BY cost_per_success DESC
```

**Ribosome Extraction:**
```json
{
  "id": "auto/cost-per-success-by-category",
  "name": "Cost Per Success By Category",
  "generation_depth": 1,
  "extracted_from": "execution:abc123",
  "tasks": [
    {
      "id": "query",
      "tools": ["query_surrealdb"],
      "prompt": { "template": "Query cost per successful execution grouped by category" }
    },
    {
      "id": "render",
      "tools": ["create_ui_component"],
      "prompt": { "template": "Create table showing category, executions, cost_per_success" }
    }
  ],
  "thompson_alpha": 1,
  "thompson_beta": 0
}
```

---

## REQUIRED TOOLS

### Data Retrieval Tools

| Tool | Purpose | Returns |
|------|---------|---------|
| `query_surrealdb` | Query any SurrealDB table | Array of records |
| `query_kubernetes` | Query K8s resources | Pods, services, events, etc. |
| `query_system_health` | Get observation metrics | Health aggregate object |
| `query_tool_patterns` | Get tool usage stats | Tool pattern array |
| `query_composition_patterns` | Get activity chains | Composition edge array |
| `query_peer_anomalies` | Get anomaly flags | Anomaly array |
| `check_service_health` | Ping service health | Status + latency per service |
| `get_circuit_breaker_state` | Get boredom system state | Status, reason, timestamp |

### UI Control Tools (Primitive-Based)

| Tool | Purpose | Accepts |
|------|---------|---------|
| `create_ui_component` | Create new UI impulse | ANY primitive composition (container, text, chart, table, graph, input, button, etc.) |
| `update_ui_component` | Modify existing UI impulse | Partial updates, append children, stream data |
| `delete_ui_component` | Remove UI impulse | Component ID |
| `clear_ui_components` | Remove all except input | Optional `except` list |

**Note:** `create_ui_component` accepts arbitrary primitive trees, NOT a fixed enum of component types. MiniBob decides how to compose primitives based on the query and data.

### Action Tools

| Tool | Purpose | Effect |
|------|---------|--------|
| `set_circuit_breaker` | Pause/resume boredom | System state change |
| `kubectl_logs` | Get pod logs | Log content for display |
| `kubectl_describe` | Describe resource | Detailed resource info |

---

## IMPULSE PATTERNS (Primitive-Based)

### Data Impulse (Backend Data)
```typescript
{
  id: 'data-001',
  pointer: {
    type: 'memo',
    content: [/* query results */]
  },
  metadata: {
    shape: 'array',
    rowCount: 47,
    summary: 'Activity execution traces from last 24h'
  }
}
```

### UI Component Impulse (Composed Primitives)
```typescript
{
  id: 'ui-001',
  pointer: {
    type: 'ui_component',
    position: 'below-input',
    component: {
      type: 'container',
      layout: 'vertical',
      gap: 16,
      children: [
        {
          type: 'text',
          content: 'Activity Executions (Last 24h)',
          variant: 'heading'
        },
        {
          type: 'data-table',
          dataRef: 'data-001',
          columns: [
            { key: 'name', label: 'Template', sortable: true },
            { key: 'status', label: 'Status', render: 'badge' },
            { key: 'duration', label: 'Duration', render: 'number' },
            { key: 'cost', label: 'Cost', render: 'number' }
          ],
          pagination: { pageSize: 20 },
          rowAction: { tool: 'query_surrealdb', args: { id: '$row.id' } }
        }
      ]
    }
  },
  metadata: {
    primitives: ['container', 'text', 'data-table'],
    dataShape: 'array[47]',
    summary: 'Activity executions table with heading'
  }
}
```

### UI Component Impulse (Novel Composition)
MiniBob can create visualizations not anticipated by developers:
```typescript
{
  id: 'ui-dashboard',
  pointer: {
    type: 'ui_component',
    position: 'below-input',
    component: {
      type: 'container',
      layout: 'grid',
      columns: 3,
      gap: 16,
      children: [
        // Gauge showing success rate
        {
          type: 'container',
          layout: 'vertical',
          children: [
            { type: 'text', content: 'Success Rate', variant: 'label' },
            { type: 'chart', chartType: 'gauge', data: [{ value: 0.73 }] },
            { type: 'badge', text: 'Below Target', variant: 'warning' }
          ]
        },
        // Sparkline showing trend
        {
          type: 'container',
          layout: 'vertical',
          children: [
            { type: 'text', content: 'Executions/Hour', variant: 'label' },
            { type: 'chart', chartType: 'sparkline', dataRef: 'hourly-data' }
          ]
        },
        // Mini table of errors
        {
          type: 'container',
          layout: 'vertical',
          children: [
            { type: 'text', content: 'Top Errors', variant: 'label' },
            { type: 'data-table', dataRef: 'error-data', columns: [...] }
          ]
        }
      ]
    }
  },
  metadata: {
    primitives: ['container', 'text', 'chart', 'badge', 'data-table'],
    summary: 'Custom 3-column dashboard with gauges and tables'
  }
}
```

### UI Component Impulse (Action with Confirmation)
```typescript
{
  id: 'action-001',
  pointer: {
    type: 'ui_component',
    position: 'below-input',
    component: {
      type: 'button',
      label: 'Resume Boredom System',
      variant: 'primary',
      action: {
        tool: 'set_circuit_breaker',
        args: { action: 'resume' }
      },
      confirm: {
        title: 'Resume Autonomous Activities?',
        message: 'This will restart boredom task polling.'
      }
    }
  },
  metadata: {
    primitives: ['button'],
    summary: 'Button to resume circuit breaker'
  }
}
```

---

## LEARNING REQUIREMENTS

### Requirement: All successful queries recorded
- **WHEN** a query execution succeeds (template or improvised)
- **THEN** execution trace is stored with full state snapshots
- **AND** Thompson parameters are updated (α++ for success)
- **AND** tool usage patterns are recorded
- **AND** impulse relevance is tracked

### Requirement: Improvisation triggers Ribosome
- **WHEN** an improvised query succeeds
- **THEN** Ribosome extracts: tool sequence, query patterns, variable slots
- **AND** creates new template with generation_depth = 1
- **AND** template enters Thompson Sampling pool

### Requirement: Failures inform learning
- **WHEN** a query execution fails
- **THEN** Thompson β++ for the template
- **AND** failure pattern is recorded (error type, failed task, context)
- **AND** no template is created from failed improvisation

### Requirement: Template decay and pruning
- **WHEN** templates are unused for extended periods
- **THEN** Thompson parameters decay (score decreases)
- **AND** very low-scoring templates are archived
- **AND** generation_depth > 5 requires higher score to be selected
