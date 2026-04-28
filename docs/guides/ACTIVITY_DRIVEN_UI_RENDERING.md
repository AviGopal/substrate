# Activity-Driven UI Rendering Guide

> **Note:** The 12-type enumeration below is `react-renderer` vessel's locally advertised vocabulary, not a system-wide canonical shape registry. Other UI vessels may advertise their own `ui_component`-family shapes; the foundation treats shapes as open-ended and vessel-contributed.

**Complete guide to creating activities that generate terminal UI and React components**

---

## Quick Start: Your First UI Activity

### Step 1: Create Activity Template

```json
{
  "id": "demo-ui-output",
  "name": "Demo: UI Output",
  "description": "Demonstrates creating visual output from activities",
  "category": "demonstration",
  "outputSchema": {
    "produces": [
      { "shape": "ui_component", "collection": true }
    ]
  },
  "tasks": [
    {
      "id": "create-notification",
      "description": "Create a simple notification",
      "prompt": {
        "template": "Create a notification using tui_emit tool.\n\nCall tui_emit with:\n- content: 'Hello from activity!'\n- shape: 'notification'\n- title: 'Demo Output'\n- priority: 700\n\nThis will appear in the terminal UI."
      }
    },
    {
      "id": "create-react-component",
      "description": "Create a React component with primitives",
      "prompt": {
        "template": "Create a UI component using create_ui_component tool.\n\nCall create_ui_component with this primitive structure:\n\n{\n  type: 'container',\n  layout: 'vertical',\n  gap: 4,\n  children: [\n    {\n      type: 'text',\n      content: 'Activity-Generated UI',\n      variant: 'heading'\n    },\n    {\n      type: 'badge',\n      text: 'Success',\n      variant: 'success'\n    },\n    {\n      type: 'text',\n      content: 'This component was created by an activity!'\n    }\n  ]\n}\n\nMake sure to use valid primitive types."
      },
      "validation": {
        "requiredPatterns": ["create_ui_component", "container"]
      }
    }
  ]
}
```

### Step 2: Run the Activity

```bash
# Start MiniBob TUI in embedded mode
cd repos/minibob-tui
bun run start --embedded --dev

# In the TUI, type:
Execute the demo-ui-output activity
```

**What You'll See:**

1. **Terminal UI (minibob-tui)**:
   ```
   ┌────────────────────────────┐
   │ Demo Output                │
   ├────────────────────────────┤
   │ Hello from activity!       │
   └────────────────────────────┘
   ```

2. **React UI (if react-renderer connected)**:
   ```
   Activity-Generated UI
   [Success]
   This component was created by an activity!
   ```

---

## Architecture: Two Rendering Paths

### Path 1: Terminal UI (minibob-tui)

```
Activity Task
  ↓ Uses tui_emit tool
Impulse Created { shape: "notification" }
  ↓ WebSocket/Event
MiniBob-TUI receives impulse
  ↓ Factory decides component
StreamComponent / BlockComponent / ErrorComponent
  ↓ Renders to terminal
Terminal Output (ASCII art boxes)
```

**Key Files:**
- `repos/minibob-tui/src/lib/tools/handlers.ts` - TUI tools (tui_emit, tui_observe)
- `repos/minibob-tui/src/components/factory.ts` - Shape → Component mapping
- `repos/minibob-tui/src/lib/regions.ts` - Region management

### Path 2: React UI (react-renderer)

```
Activity Task
  ↓ Uses create_ui_component tool
Impulse Created { pointer: { type: "ui_component", primitive: {...} } }
  ↓ HTTP/WebSocket
React-Renderer receives impulse
  ↓ Resolver validates primitive
PrimitiveRenderer recursively renders
  ↓ React 19 components
Browser/Electron (Interactive HTML)
```

**Key Files:**
- `repos/react-renderer/src/resolvers/ui-component.ts` - Primitive validation
- `repos/react-renderer/src/components/PrimitiveRenderer.tsx` - Recursive rendering
- `repos/react-renderer/src/primitives/*.tsx` - 12 primitive types

---

## Complete Tool Reference

### Tool 1: tui_emit (Terminal Output)

**Purpose:** Emit text content to terminal UI

```typescript
tui_emit({
  content: string,        // Text to display
  shape: string,          // Determines component type
  title?: string,         // Optional heading
  priority?: number       // Layout priority (default: 500)
})
```

**Available Shapes:**

| Shape | Terminal Component | Use Case |
|-------|-------------------|----------|
| `notification` | BlockComponent | General messages |
| `log_stream` | StreamComponent | Streaming output |
| `info` | BlockComponent | Informational |
| `success` | BlockComponent | Success messages |
| `warning` | BlockComponent | Warnings |
| `error` | ErrorComponent | Error messages |
| `code_generation` | CodeComponent | Code blocks |
| `diff` | DiffComponent | File diffs |

**Example Activity:**
```json
{
  "tasks": [{
    "id": "show-status",
    "prompt": {
      "template": "Show build status.\n\nUse tui_emit:\n{\n  content: 'Build completed successfully in 2.3s',\n  shape: 'success',\n  title: 'Build Status',\n  priority: 700\n}"
    }
  }]
}
```

### Tool 2: create_ui_component (React Output)

**Purpose:** Create React components with primitives

```typescript
create_ui_component({
  primitive: Primitive,    // Component tree
  position?: PositionMode, // Layout positioning
  layer?: number,          // Z-index
  animation?: string       // Entry animation
})
```

**Primitive Types (12 total):**

#### 1. Container - Layout Wrapper
```javascript
{
  type: 'container',
  layout: 'vertical' | 'horizontal' | 'grid' | 'absolute',
  gap?: number,
  padding?: number | string,
  children: Primitive[]
}
```

#### 2. Text - Typography
```javascript
{
  type: 'text',
  content: string,
  variant: 'heading' | 'body' | 'caption' | 'code'
}
```

#### 3. Button - Interactive Element
```javascript
{
  type: 'button',
  text: string,
  variant: 'primary' | 'secondary' | 'destructive' | 'ghost',
  action: string,        // Action ID to trigger
  disabled?: boolean
}
```

#### 4. Badge - Status Indicator
```javascript
{
  type: 'badge',
  text: string,
  variant: 'success' | 'warning' | 'error' | 'info'
}
```

#### 5. Progress - Progress Indicator
```javascript
{
  type: 'progress',
  progressType: 'bar' | 'circle' | 'gauge',
  value: number,         // 0-100
  label?: string,
  color?: string
}
```

#### 6. Data Table - Tabular Data
```javascript
{
  type: 'data-table',
  columns: [
    { key: 'name', label: 'Name', width?: string },
    { key: 'status', label: 'Status', width?: string }
  ],
  data: [
    { name: 'Item 1', status: 'Complete' },
    { name: 'Item 2', status: 'Pending' }
  ],
  pagination?: { pageSize: number, currentPage: number }
}
```

#### 7. Chart - Data Visualization
```javascript
{
  type: 'chart',
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'gauge',
  data: [...],
  options?: { title, xAxis, yAxis, legend }
}
```

#### 8. Code - Code Block
```javascript
{
  type: 'code',
  code: string,
  language: 'typescript' | 'python' | 'javascript' | 'bash',
  showLineNumbers?: boolean,
  highlightLines?: number[]
}
```

#### 9. Graph - Network Visualization
```javascript
{
  type: 'graph',
  nodes: [{ id: string, label: string, x?: number, y?: number }],
  edges: [{ source: string, target: string, label?: string }]
}
```

#### 10. Input - Form Input
```javascript
{
  type: 'input',
  inputType: 'text' | 'number' | 'date' | 'select' | 'checkbox',
  label?: string,
  placeholder?: string,
  value?: any,
  options?: string[]  // For select
}
```

#### 11. Image - Image Display
```javascript
{
  type: 'image',
  src: string,
  alt: string,
  width?: string | number,
  height?: string | number
}
```

#### 12. Custom - Custom Component
```javascript
{
  type: 'custom',
  componentId: string,
  props: Record<string, any>
}
```

**Example Activity:**
```json
{
  "tasks": [{
    "id": "create-dashboard",
    "prompt": {
      "template": "Create a dashboard with stats.\n\nUse create_ui_component:\n{\n  type: 'container',\n  layout: 'grid',\n  children: [\n    { type: 'text', content: 'Dashboard', variant: 'heading' },\n    { type: 'badge', text: '5 items', variant: 'info' },\n    { type: 'progress', progressType: 'bar', value: 75, label: 'Progress' }\n  ]\n}"
    }
  }]
}
```

### Tool 3: tui_observe (Inspect State)

**Purpose:** Query terminal UI state for debugging

```typescript
tui_observe({
  query: 'all' | 'regions' | 'input' | 'layout'
})
```

**Returns:**
```javascript
{
  regions: [
    {
      impulseId: "emit-123",
      componentType: "BlockComponent",
      state: "complete",
      layout: { preferred: "block", priority: 700 }
    }
  ],
  input: { buffer: "", cursor: 0 },
  scrollPosition: 0,
  dimensions: { width: 80, height: 24 }
}
```

### Tool 4: tui_render (Get Visual Output)

**Purpose:** Get rendered terminal output as text

```typescript
tui_render({
  format: 'text' | 'json'
})
```

### Tool 5: tui_wait_for (Wait for Condition)

**Purpose:** Wait for UI state changes

```typescript
tui_wait_for({
  condition: 'region_appears' | 'input_ready' | 'render_complete',
  regionId?: string,
  timeout: number  // milliseconds
})
```

### Tool 6: tui_snapshot (Full State Capture)

**Purpose:** Capture complete UI state

```typescript
tui_snapshot({
  includeRender: boolean,
  includeHistory: boolean
})
```

---

## Activity Patterns for UI

### Pattern 1: Simple Status Update

```json
{
  "id": "status-update",
  "tasks": [{
    "id": "show-status",
    "prompt": {
      "template": "Show operation status: {{status}}\n\nUse tui_emit with:\n- content: 'Operation: {{status}}'\n- shape: '{{shape}}'\n- title: 'Status'\n- priority: 600"
    }
  }]
}
```

**Variables:**
- `status`: "Complete" / "Failed" / "In Progress"
- `shape`: "success" / "error" / "notification"

### Pattern 2: Multi-Step Progress

```json
{
  "id": "multi-step-progress",
  "tasks": [
    {
      "id": "step-1",
      "prompt": "Step 1: Initialize\n\nUse tui_emit: { content: 'Initializing...', shape: 'log_stream' }"
    },
    {
      "id": "step-2",
      "prompt": "Step 2: Process\n\nUse tui_emit: { content: 'Processing data...', shape: 'log_stream' }"
    },
    {
      "id": "step-3",
      "prompt": "Step 3: Complete\n\nUse tui_emit: { content: 'Done!', shape: 'success' }"
    }
  ]
}
```

### Pattern 3: Data Visualization

```json
{
  "id": "visualize-metrics",
  "tasks": [
    {
      "id": "fetch-metrics",
      "resolver": "bash",
      "config": {
        "command": "curl -s http://api/metrics | jq"
      }
    },
    {
      "id": "create-chart",
      "inputShapes": ["stdout"],
      "prompt": {
        "template": "Create a chart showing metrics from:\n{{impulses.stdout.content}}\n\nUse create_ui_component:\n{\n  type: 'container',\n  layout: 'vertical',\n  children: [\n    { type: 'text', content: 'Metrics Dashboard', variant: 'heading' },\n    { type: 'chart', chartType: 'bar', data: [...parsed from stdout] }\n  ]\n}"
      }
    }
  ]
}
```

### Pattern 4: Interactive Form

```json
{
  "id": "interactive-form",
  "tasks": [{
    "id": "create-form",
    "prompt": {
      "template": "Create a form for user input.\n\nUse create_ui_component:\n{\n  type: 'container',\n  layout: 'vertical',\n  children: [\n    { type: 'text', content: 'Configuration', variant: 'heading' },\n    { type: 'input', inputType: 'text', label: 'Project Name', placeholder: 'my-project' },\n    { type: 'input', inputType: 'select', label: 'Framework', options: ['React', 'Vue', 'Svelte'] },\n    { type: 'button', text: 'Submit', variant: 'primary', action: 'submit_form' }\n  ]\n}"
    }
  }]
}
```

### Pattern 5: Code Generation Display

```json
{
  "id": "show-generated-code",
  "tasks": [
    {
      "id": "generate-code",
      "prompt": "Generate a React component..."
    },
    {
      "id": "display-code",
      "prompt": {
        "template": "Display the generated code.\n\nUse create_ui_component:\n{\n  type: 'container',\n  layout: 'vertical',\n  children: [\n    { type: 'text', content: 'Generated Component', variant: 'heading' },\n    { type: 'code', code: '{{generated_code}}', language: 'typescript', showLineNumbers: true },\n    { type: 'button', text: 'Copy Code', variant: 'secondary', action: 'copy_code' }\n  ]\n}"
      }
    }
  ]
}
```

### Pattern 6: Error Display with Recovery

```json
{
  "id": "error-with-recovery",
  "tasks": [{
    "id": "show-error",
    "prompt": {
      "template": "Show error and recovery options.\n\nUse create_ui_component:\n{\n  type: 'container',\n  layout: 'vertical',\n  gap: 4,\n  children: [\n    { type: 'badge', text: 'Error', variant: 'error' },\n    { type: 'text', content: 'Failed to connect to service' },\n    { type: 'code', code: '{{error_stack}}', language: 'text' },\n    { type: 'container', layout: 'horizontal', gap: 2, children: [\n      { type: 'button', text: 'Retry', variant: 'primary', action: 'retry' },\n      { type: 'button', text: 'Cancel', variant: 'ghost', action: 'cancel' }\n    ]}\n  ]\n}"
    }
  }]
}
```

---

## WebSocket Protocol (Real-Time Updates)

### Client → Server Messages

```typescript
// Query - request information
{
  type: 'query',
  id: 'query-1',
  text: 'Show database statistics',
  timestamp: Date.now()
}

// Action - trigger operation
{
  type: 'action',
  id: 'action-1',
  componentId: 'comp-123',
  action: 'export_data',
  payload: { format: 'csv' },
  timestamp: Date.now()
}

// Viewport - report visible area
{
  type: 'viewport',
  width: 1920,
  height: 1080,
  impulseIds: ['imp-1', 'imp-2'],  // Currently visible
  timestamp: Date.now()
}
```

### Server → Client Messages

```typescript
// Connected - handshake
{
  type: 'connected',
  sessionId: 'sess-abc123',
  capabilities: ['query', 'action', 'impulse_create', 'impulse_update'],
  timestamp: Date.now()
}

// Impulse Create - new component
{
  type: 'impulse_create',
  impulse: {
    id: 'imp-456',
    pointer: { type: 'ui_component', primitive: {...} },
    priority: 'high',
    content: {...},
    metadata: { shape: 'notification', summary: '...' },
    createdAt: Date.now()
  },
  timestamp: Date.now()
}

// Impulse Update - change data
{
  type: 'impulse_update',
  id: 'imp-456',
  patch: { content: {...}, updatedAt: Date.now() },
  timestamp: Date.now()
}

// Impulse Delete - remove component
{
  type: 'impulse_delete',
  id: 'imp-456',
  timestamp: Date.now()
}

// State Sync - full state reset
{
  type: 'state_sync',
  impulses: [{...}, {...}],  // All impulses
  timestamp: Date.now()
}

// Thinking - activity in progress
{
  type: 'thinking',
  queryId: 'query-1',
  status: 'processing',
  timestamp: Date.now()
}

// Activity Complete
{
  type: 'activity_complete',
  queryId: 'query-1',
  success: true,
  impulseIds: ['imp-1', 'imp-2'],  // Created impulses
  timestamp: Date.now()
}
```

---

## Testing Activities with TUI

### Method 1: Embedded Mode (Development)

```bash
cd repos/minibob-tui
bun run start --embedded --dev --vessel minibob-tui-dev

# In TUI prompt:
> Execute the my-activity activity
> Show database statistics
> Visualize project structure
```

**Benefits:**
- Hot reload on code changes
- Immediate feedback
- All logging visible

### Method 2: Remote Mode (Production)

```bash
# Terminal 1: Start MiniBob daemon
cd repos/minibob
bun run index.ts --daemon --port 8080

# Terminal 2: Connect TUI
cd repos/minibob-tui
bun run start --endpoint http://localhost:8080

# Terminal 3: Send commands via HTTP
curl -X POST http://localhost:8080/goal \
  -H "Content-Type: application/json" \
  -d '{"goal": "Execute the my-activity activity"}'
```

**Benefits:**
- Mirrors production setup
- Multiple clients can connect
- WebSocket streaming

### Method 3: React Renderer (Browser)

```bash
# Terminal 1: Start react-renderer
cd repos/react-renderer
bun run src/index.ts

# Terminal 2: Start MiniBob
cd repos/minibob
bun run index.ts --daemon

# Terminal 3: Execute activity
curl -X POST http://localhost:8080/goal \
  -d '{"goal": "Create a dashboard visualization"}'

# Open browser: http://localhost:3000
# Watch components appear in real-time
```

---

## Debugging UI Activities

### 1. Inspect Impulse Creation

```typescript
// In activity task prompt
"After creating the UI component, use tui_observe to verify:
1. The impulse was created
2. The region manager added it
3. The component type is correct

Call tui_observe({ query: 'all' })"
```

### 2. Validate Primitive Structure

```typescript
// Common primitive errors
❌ { type: 'containers' }              // Wrong: plural
✅ { type: 'container' }

❌ { type: 'text' }                    // Missing required field
✅ { type: 'text', content: 'Hello' }

❌ { type: 'container', children: { type: 'text' } }  // Wrong: not array
✅ { type: 'container', children: [{ type: 'text', content: 'Hi' }] }
```

### 3. Check WebSocket Connection

```bash
# Monitor WebSocket traffic
websocat ws://localhost:8080/ws

# Should see:
# {"type":"connected","sessionId":"..."}
# {"type":"impulse_create","impulse":{...}}
```

### 4. Trace Activity Execution

```bash
# Get execution traces
curl http://localhost:9137/v2/activities/execution-traces?activity_id=my-activity

# Check for:
# - tool_calls: Did create_ui_component get called?
# - success: Did task complete?
# - output_impulses: Were impulses created?
```

---

## Common Patterns Reference

### Dashboard Layout

```javascript
{
  type: 'container',
  layout: 'grid',
  gap: 4,
  children: [
    // Header row
    { type: 'text', content: 'Dashboard', variant: 'heading' },

    // Stats row
    { type: 'container', layout: 'horizontal', gap: 2, children: [
      { type: 'badge', text: 'Active', variant: 'success' },
      { type: 'badge', text: '12 items', variant: 'info' }
    ]},

    // Main content
    { type: 'data-table', columns: [...], data: [...] },

    // Footer actions
    { type: 'container', layout: 'horizontal', gap: 2, children: [
      { type: 'button', text: 'Refresh', variant: 'primary', action: 'refresh' },
      { type: 'button', text: 'Export', variant: 'secondary', action: 'export' }
    ]}
  ]
}
```

### Card Layout

```javascript
{
  type: 'container',
  layout: 'vertical',
  padding: 16,
  gap: 3,
  children: [
    { type: 'text', content: 'Card Title', variant: 'heading' },
    { type: 'text', content: 'Description text goes here' },
    { type: 'progress', progressType: 'bar', value: 60, label: 'Completion' },
    { type: 'button', text: 'View Details', variant: 'ghost', action: 'view_details' }
  ]
}
```

### Split Layout

```javascript
{
  type: 'container',
  layout: 'horizontal',
  children: [
    // Left sidebar
    { type: 'container', layout: 'vertical', children: [
      { type: 'text', content: 'Menu', variant: 'heading' },
      { type: 'button', text: 'Option 1', variant: 'ghost' },
      { type: 'button', text: 'Option 2', variant: 'ghost' }
    ]},

    // Main content area
    { type: 'container', layout: 'vertical', children: [
      { type: 'text', content: 'Content', variant: 'heading' },
      { type: 'text', content: 'Main content goes here' }
    ]}
  ]
}
```

---

## Next Steps

1. **Create Your First UI Activity** - Follow the Quick Start above
2. **Explore Examples** - Check `repos/metabob-proto/activities/dashboard/`
3. **Test with TUI** - Run embedded mode for rapid iteration
4. **Add to React Renderer** - Connect browser for rich UI
5. **Learn Composition** - Chain activities that produce/consume UI impulses

The power of this architecture is that **activities describe what to render**, not how. The system handles the rest - creating impulses, routing to renderers, and displaying in both terminal and browser contexts.
