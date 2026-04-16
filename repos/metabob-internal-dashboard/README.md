# Metabob Internal Dashboard

MiniBob-controlled internal observability dashboard with unbounded rendering capabilities.

## Overview

This dashboard provides a query-driven interface where MiniBob controls all UI rendering via composable primitives. Key features:

- **Unbounded Rendering**: MiniBob can create any visualization by composing primitives
- **Improvisation First**: Works with zero templates - creates templates from successful improvisations
- **WebSocket Communication**: Real-time updates via impulse-based architecture
- **System-Scope Access**: Cross-org read access for internal observability

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Dashboard (Browser)                       │
│  ┌────────────┐  ┌──────────────────────────────────────┐   │
│  │ QueryInput │  │        ImpulseLayout                 │   │
│  │            │  │  ┌────────────────────────────────┐  │   │
│  │  "Show     │  │  │   PrimitiveRenderer            │  │   │
│  │   pods"    │  │  │   (container > text > table)   │  │   │
│  └─────┬──────┘  │  └────────────────────────────────┘  │   │
│        │         │                                       │   │
└────────┼─────────┴───────────────────────────────────────────┘
         │ WebSocket
         ▼
┌──────────────────────────────────────────────────────────────┐
│                  Dashboard Server (Bun)                      │
│  ┌────────────────┐  ┌─────────────────────────────────┐    │
│  │ WebSocketHandler│  │  MiniBob (embedded)            │    │
│  │ - message route │  │  - query → goal processor      │    │
│  │ - impulse state │  │  - improvisation               │    │
│  │ - broadcast     │  │  - UI tool calls               │    │
│  └─────────────────┘  └─────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│              metabob-activity-api + SurrealDB               │
│   (templates, metrics, execution traces, multi-tenant data) │
└──────────────────────────────────────────────────────────────┘
```

## Primitives

MiniBob composes these primitives to create any UI:

| Primitive | Description |
|-----------|-------------|
| `container` | Layout container (vertical, horizontal, grid, absolute) |
| `text` | Text with variants (heading, body, caption) and formats (plain, markdown, code) |
| `data-table` | Dynamic table with any columns, pagination, row actions |
| `chart` | Charts (bar, line, pie, scatter, area, gauge, sparkline) |
| `graph` | Node/edge visualization with layout modes |
| `input` | Form inputs (text, number, date, select, checkbox, radio) |
| `button` | Clickable actions with variants and confirm dialogs |
| `badge` | Status indicators (success, warning, error, info) |
| `progress` | Progress indicators (bar, circle, gauge) |
| `code` | Syntax-highlighted code with line numbers |
| `image` | Images from URLs or base64 |

## Security Model

**For security details, see [CLAUDE.md](./CLAUDE.md#security-model)**

This dashboard is designed for internal use only. Production deployment will use Cloudflare Zero Trust for authentication. Current development version has no authentication (local dev only).

## Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Build
bun run build

# Type check
bun run typecheck
```

## Environment Variables

**For complete configuration details, see [CLAUDE.md](./CLAUDE.md#standard-configuration)**

Key variables:
- `ANTHROPIC_API_KEY` - Required: Claude API key for MiniBob
- `MINIBOB_API_URL` - Activity API endpoint (default: `https://activity.metabob.com`)
- `PORT` - Server port (default: `3001`)

See CLAUDE.md for full list of standard vessel configuration.

## Deployment

**Production endpoint** (when deployed): `https://internal.metabob.com`

**Local Kubernetes** (for development):

```bash
# Build image
./scripts/build-vessels.sh metabob-internal-dashboard

# Deploy
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync
```

Local access: `http://internal.metabob.local`

**For complete deployment details, see [CLAUDE.md](./CLAUDE.md#cicd-integration)**

## WebSocket Protocol

### Client → Server

```typescript
// Query
{ type: 'query', text: 'Show unhealthy pods', context?: { ... } }

// Action (button click, row select)
{ type: 'action', action: 'expand_row', componentId: 'table-1', payload: { rowIndex: 0 } }

// Viewport
{ type: 'viewport', width: 1920, height: 1080 }
{ type: 'viewport_resize', width: 1920, height: 1080 }

// Ping
{ type: 'ping' }
```

### Server → Client

```typescript
// Connection established
{ type: 'connected', sessionId: '...', capabilities: [...] }

// Processing indicators
{ type: 'thinking', queryId: '...', content: 'Looking up pod status...' }
{ type: 'tool_call', queryId: '...', tool: 'query_kubernetes', status: 'started' }

// UI updates
{ type: 'impulse_create', impulse: { id, primitive, position, ... } }
{ type: 'impulse_update', impulseId, patch: { ... } }
{ type: 'impulse_delete', impulseId }

// State sync (on reconnection)
{ type: 'state_sync', impulses: [...] }

// Completion
{ type: 'activity_complete', queryId: '...', success: true, duration: 1234 }
```

## Query Examples

- "Show unhealthy pods" → table of pods with Ready=false
- "What's the template success rate by category?" → bar chart
- "Show me MiniBob boredom activity" → timeline or list
- "Compare templates A and B" → side-by-side comparison
- "Is the system healthy?" → gauges and status badges

## License

MIT
