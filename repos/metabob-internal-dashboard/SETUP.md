# Internal Dashboard Setup Guide

## Overview

The Internal Dashboard is an impulse-driven admin interface where MiniBob controls all UI rendering through composable primitives. It provides system-wide observability and admin operations.

## Prerequisites

1. **Bun** >= 1.0.0
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Anthropic API Key**
   Get your API key from: https://console.anthropic.com/

3. **Activity API** running
   The dashboard requires metabob-activity-api to be running for MiniBob to fetch templates and record traces.

## Quick Start

### 1. Install Dependencies

```bash
cd repos/metabob-internal-dashboard
bun install
```

### 2. Configure Environment

Create `.env` from the example:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
PORT=3001
ANTHROPIC_API_KEY=sk-ant-your-key-here
MINIBOB_API_URL=http://localhost:8080  # or http://activity.metabob.local
```

### 3. Run Development Server

```bash
bun run dev
```

The dashboard will be available at: `http://localhost:3001`

## Usage

### Query Interface

The dashboard uses natural language queries to generate UI:

**Example Queries:**
- "Show unhealthy pods in activity-system namespace"
- "What's the template success rate by category?"
- "Show me recent MiniBob boredom activities"
- "Compare templates A and B"
- "Is the system healthy?"

### How It Works

1. **User enters query** → Sent via WebSocket to server
2. **MiniBob processes** → GoalProcessor creates activity
3. **Activity executes** → Uses UI tools to create impulses
4. **Impulses rendered** → React renders primitives
5. **Real-time updates** → WebSocket broadcasts changes

### UI Primitives

MiniBob composes these primitives to create any UI:

| Primitive | Purpose | Example |
|-----------|---------|---------|
| `container` | Layout | Vertical/horizontal/grid containers |
| `text` | Display text | Headings, paragraphs, captions |
| `data-table` | Tabular data | Pod lists, template metrics |
| `chart` | Visualizations | Bar/line/pie charts, sparklines |
| `graph` | Network viz | Dependency graphs, relationships |
| `input` | Form fields | Text, number, date, select |
| `button` | Actions | Trigger operations, confirmations |
| `badge` | Status | Success/warning/error indicators |
| `progress` | Loading | Progress bars, spinners, gauges |
| `code` | Code blocks | Syntax-highlighted code |
| `image` | Images | From URLs or base64 |

## Development

### Scripts

```bash
bun run dev        # Development with hot reload
bun run start      # Production mode
bun run build      # Build frontend assets
bun run typecheck  # Type checking
bun test           # Run unit tests
bun test:e2e       # Run Playwright e2e tests
```

### Project Structure

```
repos/metabob-internal-dashboard/
├── src/
│   ├── index.ts                    # Bun server entry point
│   ├── App.tsx                     # Main React app
│   ├── frontend.tsx                # React DOM mount
│   ├── lib/
│   │   ├── minibob-integration.ts  # MiniBob + UI tools
│   │   ├── websocket-handler.ts    # WebSocket server + impulse state
│   │   └── impulse-types.ts        # Impulse type definitions
│   ├── components/
│   │   ├── ImpulseRenderer.tsx     # Impulse layout rendering
│   │   ├── PrimitiveRenderer.tsx   # Recursive primitive rendering
│   │   ├── QueryInput.tsx          # User query input
│   │   └── ConnectionStatus.tsx    # WebSocket status
│   ├── hooks/
│   │   └── useMiniBobConnection.ts # React WebSocket hook
│   └── store/
│       └── impulse-store.ts        # Impulse state management
├── public/
│   └── assets/                     # Built frontend assets
├── tests/
│   └── basic.spec.ts               # Playwright tests
├── CLAUDE.md                       # Development guidelines
├── README.md                       # Project overview
└── package.json                    # Dependencies
```

## Architecture

### Impulse-Driven UI

The dashboard renders impulses created by MiniBob:

```
┌─────────────────────────────────────────────┐
│  User Query: "Show unhealthy pods"          │
└──────────────────┬──────────────────────────┘
                   │ WebSocket
                   ▼
┌─────────────────────────────────────────────┐
│  MiniBob GoalProcessor                      │
│  1. Receives query                          │
│  2. Creates/finds activity                  │
│  3. Executes with UI tools                  │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  UI Tools                                   │
│  create_ui_component({                      │
│    primitive: 'data-table',                 │
│    data: [pods],                            │
│    columns: [...]                           │
│  })                                         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Impulse Created                            │
│  {                                          │
│    id: 'imp-123',                           │
│    pointer: { type: 'ui_component' },       │
│    metadata: { primitive: 'data-table' },   │
│    content: { ... }                         │
│  }                                          │
└──────────────────┬──────────────────────────┘
                   │ WebSocket broadcast
                   ▼
┌─────────────────────────────────────────────┐
│  React PrimitiveRenderer                    │
│  Renders impulse as table component         │
└─────────────────────────────────────────────┘
```

### Custom Tools for MiniBob

Located in `src/lib/minibob-integration.ts`:

**UI Manipulation:**
- `create_ui_component` - Create new UI impulse
- `update_ui_component` - Update existing UI impulse
- `delete_ui_component` - Remove UI impulse
- `clear_ui_components` - Clear all (except specified)

**Data Access:**
- `query_activity_api` - Query backend for traces/templates/metrics

### WebSocket Protocol

**Client → Server:**
```typescript
{ type: 'query', text: 'Show unhealthy pods' }
{ type: 'action', action: 'expand_row', componentId: 'table-1', payload: {...} }
{ type: 'viewport', width: 1920, height: 1080 }
```

**Server → Client:**
```typescript
{ type: 'connected', sessionId: '...', capabilities: [...] }
{ type: 'thinking', content: 'Looking up pod status...' }
{ type: 'impulse_create', impulse: {...} }
{ type: 'impulse_update', impulseId: '...', patch: {...} }
{ type: 'activity_complete', success: true, duration: 1234 }
```

## Testing

### Unit Tests

```bash
bun test
```

### E2E Tests

```bash
# Run all e2e tests
bun test:e2e

# Run specific test
bunx playwright test tests/basic.spec.ts

# Run with UI
bunx playwright test --ui

# Show report
bunx playwright show-report
```

## Deployment

### Local Development

Already covered in Quick Start above.

### Kubernetes (Production)

The dashboard is deployed via Helm:

```bash
# Build Docker image
cd /home/avi/documents/work/exp-repo/metabob-devbob
./scripts/build-vessels.sh metabob-internal-dashboard

# Deploy
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync
```

**Access:** `http://internal.metabob.local`

### Cloudflare Zero Trust (Future)

For production, the internal dashboard should be protected by Cloudflare Zero Trust:

1. Configure Cloudflare Tunnel for `internal.metabob.com`
2. Set up Zero Trust policies (email domain, SAML, etc.)
3. Only allow authenticated internal users

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3001` | No |
| `HOST` | Bind address | `0.0.0.0` | No |
| `MINIBOB_API_URL` | Activity API endpoint | `http://localhost:8080` | No |
| `ANTHROPIC_API_KEY` | Claude API key | - | **Yes** |
| `LLM_MODEL` | LLM model | `claude-sonnet-4-20250514` | No |
| `WORKING_DIRECTORY` | File ops context | `process.cwd()` | No |
| `INTERNAL_DASHBOARD_CREDENTIAL_ID` | Auth credential ID | - | No (dev) |
| `INTERNAL_DASHBOARD_SECRET` | Auth secret | - | No (dev) |
| `LOG_LEVEL` | Logging level | `info` | No |

## Troubleshooting

### "Cannot connect to WebSocket"
- Verify server is running: `curl http://localhost:3001/health`
- Check CORS settings if accessing from different origin
- Ensure no firewall blocking port 3001

### "MiniBob not responding"
- Verify `ANTHROPIC_API_KEY` is set correctly
- Check Activity API is reachable: `curl $MINIBOB_API_URL/health`
- Look at server logs for errors

### "Templates not executing"
- Verify Activity API has templates seeded
- Check: `curl http://activity.metabob.local/v2/activities/templates`
- Run template creation script: `bun run create-dashboard-templates.ts`

### Type Errors
```bash
bun run typecheck
```

If errors persist, try:
```bash
rm -rf node_modules bun.lock
bun install
```

## Development Workflow

1. **Make changes** to src/ files
2. **Hot reload** applies changes automatically (dev mode)
3. **Type check** frequently: `bun run typecheck`
4. **Test** changes: Query the dashboard and verify UI
5. **Commit** when feature complete

## Next Steps

- Add authentication/authorization
- Implement admin operations (rollback, snapshot, etc.)
- Add more UI primitives as needed
- Create dashboard-specific activity templates
- Set up Cloudflare Zero Trust for production access

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guidelines
- [README.md](./README.md) - Project overview
- [Impulse Activity Foundation](../../docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
- [Deployment Guide](../../helm/README.md)
