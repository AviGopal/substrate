## ADDED Requirements

### Requirement: MiniBob controls rendering via primitives, not predefined components
The system SHALL provide low-level rendering primitives that MiniBob can compose arbitrarily, rather than a fixed set of high-level components.

#### Scenario: MiniBob renders a novel visualization
- **WHEN** MiniBob needs to display data in a way not anticipated by developers
- **THEN** MiniBob composes rendering primitives (container, text, list, chart, input) to create the visualization
- **AND** the frontend renders exactly what MiniBob describes
- **AND** no predefined component mapping is required

#### Scenario: MiniBob creates a custom layout
- **WHEN** MiniBob decides data should be displayed in a grid with nested cards
- **THEN** MiniBob emits: `create_ui_component({ type: 'container', layout: 'grid', children: [...] })`
- **AND** the frontend renders a grid with the specified children
- **AND** MiniBob controls all layout decisions

#### Scenario: MiniBob creates an interactive form
- **WHEN** a query requires user input to proceed (e.g., "Filter by date range")
- **THEN** MiniBob creates input primitives: `{ type: 'input', inputType: 'date', label: 'Start', onSubmit: { tool: '...' } }`
- **AND** the frontend renders the form
- **AND** form submission triggers MiniBob tool execution

### Requirement: No query-to-component hardcoding in frontend
The frontend SHALL NOT contain logic that maps query patterns to specific visualizations. All rendering decisions flow through MiniBob.

#### Scenario: Novel query renders correctly
- **WHEN** user asks a query never seen before (e.g., "Show the ratio of bash to edit tool calls as a pie chart")
- **THEN** MiniBob improvises: queries data, reasons about visualization, emits primitives
- **AND** the frontend renders whatever MiniBob describes
- **AND** no frontend code specifically handles "pie chart" or "ratio" keywords

#### Scenario: Frontend is prompt-agnostic
- **WHEN** frontend receives a ui_component impulse
- **THEN** frontend renders based solely on the impulse structure
- **AND** frontend has no knowledge of what query produced the impulse
- **AND** the same impulse structure always renders the same way

### Requirement: Rendering primitives are composable and extensible
The system SHALL provide primitives that can be nested and combined to create any visualization.

#### Primitive: container
```typescript
{
  type: 'container',
  layout: 'vertical' | 'horizontal' | 'grid' | 'absolute',
  gap?: number,
  padding?: number,
  columns?: number,  // for grid layout
  style?: CSSProperties,
  children: UIComponent[]
}
```

#### Primitive: text
```typescript
{
  type: 'text',
  content: string,
  format: 'plain' | 'markdown' | 'code',
  variant?: 'heading' | 'subheading' | 'body' | 'caption' | 'label',
  style?: CSSProperties
}
```

#### Primitive: data-table
```typescript
{
  type: 'data-table',
  columns: Array<{
    key: string,
    label: string,
    sortable?: boolean,
    render?: 'text' | 'number' | 'date' | 'badge' | 'progress' | 'custom'
  }>,
  data: unknown[] | { dataRef: string },
  pagination?: { pageSize: number },
  rowAction?: { tool: string, args: Record<string, string> },
  style?: CSSProperties
}
```

#### Primitive: chart
```typescript
{
  type: 'chart',
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'gauge' | 'sparkline',
  data: unknown[] | { dataRef: string },
  xAxis?: { key: string, label?: string },
  yAxis?: { key: string, label?: string },
  series?: Array<{ key: string, label?: string, color?: string }>,
  style?: CSSProperties
}
```

#### Primitive: graph (nodes/edges)
```typescript
{
  type: 'graph',
  nodes: Array<{ id: string, label: string, data?: unknown }> | { dataRef: string },
  edges: Array<{ source: string, target: string, label?: string, weight?: number }> | { dataRef: string },
  layout: 'force' | 'hierarchical' | 'circular' | 'grid',
  nodeAction?: { tool: string, args: Record<string, string> },
  style?: CSSProperties
}
```

#### Primitive: input
```typescript
{
  type: 'input',
  inputType: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'radio',
  label?: string,
  placeholder?: string,
  options?: Array<{ value: string, label: string }>,  // for select/radio
  defaultValue?: unknown,
  onSubmit?: { tool: string, args: Record<string, string> }
}
```

#### Primitive: button
```typescript
{
  type: 'button',
  label: string,
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost',
  icon?: string,
  action: { tool: string, args: Record<string, unknown> },
  confirm?: { title: string, message: string }
}
```

#### Primitive: badge
```typescript
{
  type: 'badge',
  text: string,
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral',
  icon?: string
}
```

#### Primitive: progress
```typescript
{
  type: 'progress',
  value: number,
  max?: number,
  label?: string,
  variant?: 'bar' | 'circle' | 'gauge'
}
```

#### Primitive: code
```typescript
{
  type: 'code',
  content: string | { dataRef: string },
  language?: string,
  lineNumbers?: boolean,
  highlightLines?: number[]
}
```

#### Primitive: image
```typescript
{
  type: 'image',
  src: string | { dataRef: string },  // base64 or URL
  alt?: string,
  style?: CSSProperties
}
```

### Requirement: Improvisation is the primary execution mode
The system SHALL treat improvisation as the default behavior, with templates as learned optimizations.

#### Scenario: System works with zero templates
- **GIVEN** no activity templates exist in the database
- **WHEN** user submits any query
- **THEN** MiniBob improvises using LLM reasoning and available tools
- **AND** the query is answered with appropriate visualization
- **AND** successful improvisation creates a template via Ribosome

#### Scenario: Templates are performance optimization, not capability gates
- **WHEN** a template matches a query pattern
- **THEN** the template provides a pre-reasoned tool sequence
- **AND** MiniBob can still deviate from the template if context requires
- **AND** the template does NOT limit what MiniBob can render

#### Scenario: LLM has full rendering control
- **WHEN** MiniBob's LLM decides how to visualize data
- **THEN** the LLM can emit any valid primitive composition
- **AND** the LLM is not constrained to predefined "component types"
- **AND** the LLM can create novel layouts, charts, and interactions

### Requirement: Tool provides full rendering API
The `create_ui_component` tool SHALL accept any valid primitive composition, not a fixed enum of component types.

#### Tool Definition
```typescript
create_ui_component({
  // Unique ID for this component (for updates/deletes)
  id?: string,

  // The primitive or composition to render
  component: UIComponent,  // Any primitive or nested structure

  // Position in the viewport
  position?: 'below-input' | 'center' | 'float' | { x: number, y: number },

  // Z-index for layering
  layer?: number,

  // Animation on mount
  animation?: 'fade' | 'slide' | 'scale' | 'none'
})
```

#### Example: Novel Dashboard
```typescript
// MiniBob creates a custom monitoring dashboard not predefined anywhere
create_ui_component({
  id: 'custom-monitor',
  component: {
    type: 'container',
    layout: 'grid',
    columns: 3,
    gap: 16,
    children: [
      {
        type: 'container',
        layout: 'vertical',
        children: [
          { type: 'text', content: 'Success Rate', variant: 'label' },
          { type: 'chart', chartType: 'gauge', data: [{ value: 0.73 }] },
          { type: 'badge', text: 'Below Target', variant: 'warning' }
        ]
      },
      {
        type: 'container',
        layout: 'vertical',
        children: [
          { type: 'text', content: 'Executions/Hour', variant: 'label' },
          { type: 'chart', chartType: 'sparkline', data: [...last24hrs] }
        ]
      },
      {
        type: 'container',
        layout: 'vertical',
        children: [
          { type: 'text', content: 'Top Errors', variant: 'label' },
          { type: 'data-table', columns: [...], data: [...topErrors] }
        ]
      }
    ]
  },
  position: 'below-input'
})
```

### Requirement: MiniBob can generate visualizations it wasn't trained on
The system SHALL support MiniBob creating visualizations by reasoning about data shape and user intent, not by pattern matching.

#### Scenario: Unexpected chart type request
- **WHEN** user asks "Show the distribution as a violin plot"
- **AND** violin plots are not a predefined chart type
- **THEN** MiniBob reasons: "A violin plot shows distribution. I can approximate with a combination of area charts or describe the distribution textually with statistics"
- **AND** MiniBob either composes primitives to approximate OR explains what it can offer instead
- **AND** MiniBob does NOT fail silently or ignore the request

#### Scenario: Complex multi-dimensional data
- **WHEN** user asks "Show the relationship between cost, duration, and success rate"
- **THEN** MiniBob reasons about how to visualize 3 dimensions
- **AND** MiniBob might create: scatter plot with color encoding, multiple charts, or a table with derived metrics
- **AND** MiniBob explains its visualization choice

#### Scenario: Request for comparison
- **WHEN** user asks "Compare template A vs template B side by side"
- **THEN** MiniBob creates a layout with two parallel visualizations
- **AND** the specific comparison format is decided by MiniBob based on available data
- **AND** no "comparison component" needs to be predefined

### Requirement: Streaming supports incremental composition
The system SHALL support MiniBob building up complex visualizations incrementally via updates.

#### Scenario: Progressive disclosure
- **WHEN** MiniBob is building a complex visualization
- **THEN** MiniBob can create a container first, then add children via updates
- **AND** the UI renders progressively as components are added
- **AND** user sees the visualization building up in real-time

#### Example: Progressive Build
```typescript
// Step 1: Create container skeleton
create_ui_component({ id: 'dashboard', component: { type: 'container', layout: 'grid', children: [] } })

// Step 2: Add first panel
update_ui_component({ id: 'dashboard', changes: {
  component: { children: [{ type: 'chart', chartType: 'gauge', data: [] }] }
}})

// Step 3: Stream data into chart
update_ui_component({ id: 'dashboard', changes: {
  component: { children: [{ type: 'chart', data: [{ value: 0.73 }] }] }
}})

// Step 4: Add second panel
update_ui_component({ id: 'dashboard', changes: {
  component: { children: [...existing, { type: 'data-table', columns: [...], data: [] }] }
}})

// Step 5: Stream table rows
update_ui_component({ id: 'dashboard', changes: {
  component: { children: [..., { data: [...rows] }] }
}})
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Component Type Enum
```typescript
// BAD: Fixed enum limits what MiniBob can create
type ComponentType = 'table' | 'graph' | 'narrative' | 'system_health'

// GOOD: Open primitive system
type UIComponent = Container | Text | DataTable | Chart | Graph | Input | Button | ...
```

### Anti-Pattern 2: Query Pattern Matching in Frontend
```typescript
// BAD: Frontend decides visualization
if (query.includes('health')) {
  return <SystemHealthDashboard />
}

// GOOD: Frontend renders whatever MiniBob sends
return <PrimitiveRenderer component={impulse.component} />
```

### Anti-Pattern 3: Template as Capability Gate
```typescript
// BAD: No template = no capability
if (!findTemplate(query)) {
  return "I don't know how to do that"
}

// GOOD: No template = improvise
if (!findTemplate(query)) {
  return improvise(query, availableTools)
}
```

### Anti-Pattern 4: Hardcoded Data→Visualization Mapping
```typescript
// BAD: Array always becomes table
if (Array.isArray(data)) {
  return createTable(data)
}

// GOOD: LLM decides based on context
// "Show this as a pie chart" → pie chart
// "Show this as a table" → table
// "Summarize this" → narrative
// Same data, different visualization based on intent
```

---

## Implementation Notes

### Frontend Renderer
The frontend implements a single recursive renderer:

```typescript
function PrimitiveRenderer({ component }: { component: UIComponent }) {
  switch (component.type) {
    case 'container':
      return (
        <div style={layoutStyles(component)}>
          {component.children.map((child, i) => (
            <PrimitiveRenderer key={i} component={child} />
          ))}
        </div>
      )
    case 'text':
      return <TextPrimitive {...component} />
    case 'data-table':
      return <DataTablePrimitive {...component} />
    case 'chart':
      return <ChartPrimitive {...component} />
    // ... other primitives
    default:
      // Unknown primitive - render debug info, don't fail
      return <UnknownPrimitive component={component} />
  }
}
```

### Extensibility via Custom Primitives
If MiniBob needs a primitive that doesn't exist, it can:

1. Compose existing primitives to approximate
2. Use a `custom` primitive with raw HTML/SVG (if enabled)
3. Describe what it wants in narrative and request the primitive be added

```typescript
{
  type: 'custom',
  html: '<svg>...</svg>',  // Only if explicitly enabled
  fallback: { type: 'text', content: 'Custom visualization not supported' }
}
```

### LLM Prompt for Rendering Decisions
MiniBob's system prompt includes:

```
You have access to UI rendering primitives:
- container: layout wrapper (vertical, horizontal, grid, absolute)
- text: formatted text (plain, markdown, code)
- data-table: tabular data with sorting/pagination
- chart: visualizations (bar, line, pie, scatter, area, gauge, sparkline)
- graph: node/edge visualizations
- input: user input fields
- button: action triggers
- badge: status indicators
- progress: progress bars/gauges
- code: syntax-highlighted code

You can compose these arbitrarily to create any visualization.
You are NOT limited to predefined layouts or dashboard types.
Reason about what visualization best serves the user's query.
If they ask for something you can't render exactly, explain what you can offer.
```
