## ADDED Requirements

### Requirement: Viewport-aware layout management
MiniBob SHALL have awareness of viewport dimensions and component positions to make intelligent layout decisions.

#### Scenario: MiniBob knows viewport size
- **WHEN** a dashboard session starts
- **THEN** MiniBob receives viewport dimensions via `{ type: 'viewport', width: number, height: number }`
- **AND** MiniBob can reason about available space when creating components

#### Scenario: MiniBob tracks component positions
- **WHEN** MiniBob creates or updates components
- **THEN** MiniBob maintains a mental model of where components are placed
- **AND** can avoid overlapping components
- **AND** can arrange components in logical groups

#### Scenario: Viewport resize notification
- **WHEN** the browser viewport is resized
- **THEN** the dashboard sends `{ type: 'viewport_resize', width: number, height: number }`
- **AND** MiniBob can re-layout components if needed

### Requirement: Flexible positioning system
Components SHALL support multiple positioning modes for different layout needs.

#### Position Mode: flow (default)
- **WHEN** position is `'flow'` or omitted
- **THEN** component is placed in document flow below previous components
- **AND** respects container layout direction

#### Position Mode: below-input
- **WHEN** position is `'below-input'`
- **THEN** component is placed directly below the query input
- **AND** pushes other flow components down

#### Position Mode: absolute
- **WHEN** position is `{ x: number, y: number }`
- **THEN** component is positioned at exact pixel coordinates
- **AND** can overlap other components (uses z-index)

#### Position Mode: anchor
- **WHEN** position is `{ anchor: 'component-id', offset: { x: number, y: number } }`
- **THEN** component is positioned relative to another component
- **AND** moves when the anchor component moves

#### Position Mode: region
- **WHEN** position is `{ region: 'top' | 'bottom' | 'left' | 'right' | 'center' }`
- **THEN** component is docked to that region of the viewport
- **AND** other components avoid that region

### Requirement: Component sizing
Components SHALL support explicit and automatic sizing.

#### Scenario: Auto size (default)
- **WHEN** size is omitted or `'auto'`
- **THEN** component sizes to fit its content
- **AND** respects max-width constraints

#### Scenario: Explicit size
- **WHEN** size is `{ width: string, height: string }`
- **THEN** component uses the specified dimensions (px, %, vh, vw)

#### Scenario: Fill available
- **WHEN** size is `'fill'`
- **THEN** component expands to fill available space in its container

### Requirement: Z-index layering
Components SHALL support explicit layering for overlapping scenarios.

#### Scenario: Default layer
- **WHEN** layer is omitted
- **THEN** component uses layer 0 (base layer)

#### Scenario: Overlay layer
- **WHEN** layer is 1 or higher
- **THEN** component renders above base layer components
- **AND** useful for modals, tooltips, floating panels

#### Scenario: Query input always on top
- **WHEN** any component is created
- **THEN** the query input remains visible (highest z-index)
- **AND** input is protected from being obscured

### Requirement: Layout operations
MiniBob SHALL have tools to reorganize existing components.

#### Scenario: Move component
- **WHEN** MiniBob calls `update_ui_component({ id, changes: { position: newPosition } })`
- **THEN** the component animates to the new position
- **AND** other flow components reflow if needed

#### Scenario: Resize component
- **WHEN** MiniBob calls `update_ui_component({ id, changes: { size: newSize } })`
- **THEN** the component animates to the new size

#### Scenario: Reorder components
- **WHEN** MiniBob calls `update_ui_component({ id, changes: { order: number } })`
- **THEN** the component moves to that position in the flow order

#### Scenario: Group components
- **WHEN** MiniBob creates a container with existing component IDs as children
- **THEN** those components become children of the container
- **AND** move together when the container moves

---

## MINIMAL TOOL SET (80% Coverage)

### Tool 1: create_ui_component
```typescript
create_ui_component({
  id?: string,                    // Auto-generated if omitted
  component: UIComponent,         // Primitive or composition
  position?: Position,            // Where to place it
  size?: Size,                    // How big
  layer?: number,                 // Z-index
  animation?: Animation           // Mount animation
})
```

### Tool 2: update_ui_component
```typescript
update_ui_component({
  id: string,                     // Component to update
  changes: {
    component?: Partial<UIComponent>,  // Content changes
    position?: Position,               // Move it
    size?: Size,                       // Resize it
    layer?: number,                    // Change layer
    order?: number                     // Reorder in flow
  }
})
```

### Tool 3: delete_ui_component
```typescript
delete_ui_component({
  id: string                      // Component to remove
})
```

### Tool 4: clear_ui_components
```typescript
clear_ui_components({
  except?: string[]               // IDs to keep (always keeps input)
})
```

### Tool 5: get_layout_state
```typescript
get_layout_state()
// Returns: {
//   viewport: { width, height },
//   components: Array<{ id, position, size, bounds: { x, y, width, height } }>
// }
```

---

## MINIMAL PRIMITIVE SET (80% Coverage)

Based on analysis of the 28 user queries, these 6 primitives cover 80%+ of use cases:

### 1. container
```typescript
{
  type: 'container',
  layout: 'vertical' | 'horizontal' | 'grid',
  gap?: number,
  padding?: number,
  columns?: number,       // For grid
  children: UIComponent[]
}
```
**Covers:** Any layout composition, grouping, spacing

### 2. text
```typescript
{
  type: 'text',
  content: string,
  format?: 'plain' | 'markdown',
  variant?: 'heading' | 'body' | 'caption' | 'code'
}
```
**Covers:** Titles, explanations, labels, code snippets

### 3. data-table
```typescript
{
  type: 'data-table',
  columns: Array<{ key: string, label: string, sortable?: boolean }>,
  data: unknown[] | { dataRef: string },
  pagination?: { pageSize: number },
  rowAction?: { tool: string, args: object }
}
```
**Covers:** Any tabular data, lists, records

### 4. chart
```typescript
{
  type: 'chart',
  chartType: 'bar' | 'line' | 'pie' | 'gauge' | 'sparkline',
  data: unknown[] | { dataRef: string },
  xAxis?: { key: string },
  yAxis?: { key: string }
}
```
**Covers:** Metrics, trends, distributions, comparisons

### 5. button
```typescript
{
  type: 'button',
  label: string,
  variant?: 'primary' | 'secondary' | 'danger',
  action: { tool: string, args: object },
  confirm?: { title: string, message: string }
}
```
**Covers:** All user actions, confirmations

### 6. input
```typescript
{
  type: 'input',
  inputType: 'text' | 'select',
  label?: string,
  options?: Array<{ value: string, label: string }>,
  onSubmit: { tool: string, args: object }
}
```
**Covers:** Filters, parameters, user input

### Coverage Analysis

| Use Case Category | Primitives Used | % of Queries |
|-------------------|-----------------|--------------|
| Data exploration | data-table, text | 40% |
| Metrics/dashboards | chart, container, text | 25% |
| Actions/controls | button, input | 15% |
| Explanations | text (markdown) | 10% |
| Relationships | data-table, container | 10% |

**Total coverage with 6 primitives: ~80%**

### Additional primitives for remaining 20%:
- `graph` - Node/edge visualizations (composition graphs)
- `badge` - Status indicators
- `progress` - Progress bars
- `code` - Syntax-highlighted code blocks
- `image` - Screenshots, diagrams

---

## IMPULSE STATE FOR LAYOUT

MiniBob needs to track layout state to make good decisions:

```typescript
interface LayoutState {
  viewport: {
    width: number
    height: number
  }
  components: Array<{
    id: string
    position: Position
    size: Size
    bounds: {
      x: number
      y: number
      width: number
      height: number
    }
    layer: number
    order: number
  }>
  inputBounds: {
    x: number
    y: number
    width: number
    height: number
  }
  availableRegions: {
    belowInput: { y: number, height: number }
    fullWidth: number
  }
}
```

### Layout State as Impulse
```typescript
{
  id: 'layout-state',
  pointer: {
    type: 'layout',
    viewport: { width: 1920, height: 1080 },
    components: [...]
  },
  metadata: {
    componentCount: 3,
    summary: '3 components: table below input, 2 charts in grid'
  }
}
```

### LLM Context for Layout Decisions
```xml
<impulse_ref id="layout-state" type="layout"
  viewport="1920x1080"
  components="3"
  summary="table below input, 2 charts in grid" />
```

MiniBob can reason: "There's a table below input and 2 charts. I should add this new component to the right of the charts, or below the table."
