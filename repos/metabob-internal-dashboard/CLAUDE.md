# metabob-internal-dashboard Development Guidelines

## Foundation Alignment

> **Canonical reference**: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`

This dashboard provides an **impulse-driven content area** within a fixed application shell. MiniBob controls the content through impulse creation.

### Key Principles Applied

| Principle | Application |
|-----------|-------------|
| **Impulses are universal data** | UI components ARE impulses with `ui_component` pointer type |
| **Activities constrain search** | MiniBob uses GoalProcessor with Thompson Sampling |
| **Resolvers live where data lives** | MiniBob runs in dashboard process, has local access |
| **LLMs are tools, not controllers** | LLM used via GoalProcessor/ActivityExecutor |

### Architecture: Fixed Shell + Dynamic Content

**Fixed Application Shell** (always present):
- Query input component
- Connection status indicator
- Impulse container (canvas for rendering)

**Dynamic Content Area** (MiniBob-controlled):
- Creates/updates/deletes impulses
- Composes primitives into visualizations
- Responds to user actions

This is **not unbounded rendering** - it's a **fixed canvas with dynamic composition**.

### The Dashboard Does NOT

- Decide what content to show (MiniBob decides)
- Query data directly (MiniBob does via tools)
- Control MiniBob's decisions

### The Dashboard DOES

- Provide fixed application shell
- Render impulses created by MiniBob
- Forward user queries to GoalProcessor
- Broadcast impulse updates via WebSocket
- Provide UI tools to MiniBob

## Architecture

```
User Query → WebSocket → MiniBob GoalProcessor
                              ↓
                    create_ui_component tool
                              ↓
                        Impulse created
                              ↓
                    WebSocket broadcast
                              ↓
                  React renders impulse
```

## Impulse Types

| Impulse Pointer Type | Resolver | Created By |
|---------------------|----------|------------|
| `ui_component` | React PrimitiveRenderer | MiniBob tools |
| `query_result` | MiniBob (internal) | query_activity_api tool |

## Custom Tools for MiniBob

Located in `src/lib/minibob-integration.ts`:

| Tool | Purpose |
|------|---------|
| `create_ui_component` | Create UI impulse with primitive composition |
| `update_ui_component` | Update existing UI impulse |
| `delete_ui_component` | Remove UI impulse |
| `clear_ui_components` | Clear all UI impulses (except specified) |
| `query_activity_api` | Query backend for traces/templates/metrics |

### query_activity_api Usage

> **Important**: This tool queries the backend for trace-related data only.

**Proper usage:**
- `/v2/activities/templates` - Get activity templates
- `/v2/activities/execution-traces` - Get execution history
- `/v2/activities/recommend` - Thompson Sampling recommendations
- `/health` - System health

**The backend is a trace store**, not a universal resolver.

## Bun Development

Default to Bun for all operations:

```bash
bun run dev        # Development with hot reload
bun run start      # Production mode
bun run build      # Build frontend assets
bun run typecheck  # Type checking
bun test           # Run tests
```

Bun APIs used:
- `Bun.serve()` for HTTP/WebSocket server
- `Bun.build()` for frontend bundling
- Built-in `WebSocket` support

## Key Files

```
src/
├── index.ts                    # Bun server entry point
├── App.tsx                     # Main React app
├── frontend.tsx                # React DOM mount
├── lib/
│   ├── minibob-integration.ts  # MiniBob + UI tools
│   ├── websocket-handler.ts    # WebSocket server + impulse state
│   └── impulse-types.ts        # Impulse type definitions
├── components/
│   ├── ImpulseRenderer.tsx     # Impulse layout rendering
│   ├── PrimitiveRenderer.tsx   # Recursive primitive rendering
│   ├── QueryInput.tsx          # User query input
│   └── ConnectionStatus.tsx    # WebSocket status indicator
└── hooks/
    └── useMiniBobConnection.ts # React WebSocket hook
```

## Trace Recording

Execution traces are recorded by MiniBob internally when MCP is enabled:

```typescript
// In minibob-integration.ts
await initializeMCP({ endpoint: this.config.activityApiUrl })

// GoalProcessor.executeGoal() records traces via MCP
const result = await this.goalProcessor.executeGoal(query.text, {...})
```

Verify trace recording by checking:
```bash
curl http://activity.metabob.local/v2/activities/execution-traces?limit=1
```

## Standard Configuration

### Environment Variables

Following the standard configuration pattern from `docs/STANDARD_CONFIGURATION.md`:

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `PORT` | number | No | `3001` | HTTP server port |
| `HOST` | string | No | `0.0.0.0` | Bind address |
| `NODE_ENV` | string | No | `development` | Environment (development/production) |
| `LOG_LEVEL` | string | No | `info` | Logging level (debug/info/warn/error) |
| `VESSEL_ID` | string | No | `internal-dashboard-${hostname}` | Unique vessel identifier |
| `VESSEL_NAME` | string | No | `Internal Dashboard` | Human-readable vessel name |
| `VESSEL_VERSION` | string | No | `{package.version}` | Vessel version |
| `ANTHROPIC_API_KEY` | string | **Yes** | - | Claude API key for MiniBob |
| `MINIBOB_API_URL` | string | No | `https://activity.metabob.com` | Activity API endpoint |
| `LLM_MODEL` | string | No | `claude-sonnet-4-20250514` | LLM model to use |
| `WORKING_DIRECTORY` | string | No | `process.cwd()` | File operations context |
| `LOCAL_DEV_USER` | string | No | - | User email for local development (bypasses Zero Trust) |

### Production Endpoints

**Use these** (not .local):
- Activity API: `https://activity.metabob.com`
- Internal Dashboard: `https://internal.metabob.com` (when deployed)

**Local Kubernetes fallback**:
- Activity API: `http://activity.metabob.local`
- Internal Dashboard: `http://internal.metabob.local`

### Configuration Priority

Configuration is loaded in order (highest to lowest priority):

1. **Environment variables** (e.g., `PORT=3001`)
2. **Project config** (`.metabob/config.json` in project root)
3. **User config** (`~/.metabob/config.json`)
4. **Defaults** (hardcoded in vessel)

## Testing

```bash
# Run all tests
bun test

# Run Playwright e2e tests
bunx playwright test
```

## CI/CD Integration

This vessel is deployed via the deployment repository CI/CD pipeline.

### Before Push

```bash
bun test        # Tests must pass
bun run lint    # Linting must pass (if script exists)
```

### Deployment Flow

1. Push changes to main workspace
2. Sync to `repos/deployment/vessels/metabob-internal-dashboard/`
3. Push to `dev` branch triggers canary deployment
4. Health endpoint validated before promotion

## Composition Learning

### Activity Lifecycle

1. **User Query** → Sent via WebSocket to server
2. **Goal Processor** → Finds matching activity or improvises new one
3. **Activity Execution** → Uses tools (`query_activity_api`, `create_ui_component`)
4. **Trace Recording** → Full execution trace stored in Activity API
5. **Ribosome Extraction** → Successful patterns extracted as templates
6. **Thompson Sampling** → Learns which templates work best over time

### Deterministic Activities

Dashboard activities should be **deterministic** and **composable**:

- Activities receive **impulse sets** (query text, context metadata)
- Activities produce **impulse sets** (UI components as impulses)
- Activities record **all tool calls** for learning
- **No LLM reasoning in production activities** (only in improvisation phase)

### Improvisation Flow

When no template matches the user query:

1. **MiniBob improvises** using LLM + available tools
2. **Execution trace is recorded** with full state transitions
3. **Successful improvisation** extracted as reusable template
4. **Template enters Thompson Sampling pool** for future selection

This creates a **continuous learning loop** where the system gets better at handling similar queries over time.

## Discovery Integration

**Status**: NOT IMPLEMENTED

This vessel does not currently integrate with discovery-vessel.

### Future Enhancement

Add discovery integration following `STANDARD_CONFIGURATION.md`:

**Benefits:**
- Register vessel with shapes: `internal_dashboard_ui`, `admin_operations`
- Enable service discovery for vessel-to-vessel communication
- Report health status to discovery system
- Allow other vessels to discover dashboard capabilities

**Implementation:**
See [DISCOVERY_MIGRATION.md](./DISCOVERY_MIGRATION.md) for detailed migration guide.

## Security Model

### Current Implementation

**Production**: Not yet deployed with authentication

**Local Development**:
- Checks Zero Trust header: `CF-Access-Authenticated-User-Email`
- Fallback to: `LOCAL_DEV_USER` environment variable
- Last resort: `anonymous@metabob.com`

**Access Control**: None (assumes all users are internal admins)

**Audit Logging**: All operations logged to stdout (JSON format) with user email

### Future: Cloudflare Zero Trust

When deployed to production at `https://internal.metabob.com`:

1. **Cloudflare Tunnel** protects endpoint
2. **Email-based authentication** via Zero Trust policies
3. **User identity** from `CF-Access-Authenticated-User-Email` header
4. **Audit logging** tracks all operations by user email

**No application-level authentication** is implemented - infrastructure handles it.

## Health Endpoint

**GET** `/health`

**Response** (200 OK):
```json
{
  "service": "metabob-internal-dashboard",
  "version": "0.1.0",
  "status": "healthy",
  "uptime": 3600,
  "checks": {
    "minibob": {
      "status": "healthy",
      "connected": true
    },
    "activityApi": {
      "status": "healthy",
      "endpoint": "https://activity.metabob.com",
      "latency_ms": 45
    }
  }
}
```

**Response** (503 Service Unavailable):
```json
{
  "service": "metabob-internal-dashboard",
  "status": "unhealthy",
  "checks": {
    "activityApi": {
      "status": "unhealthy",
      "error": "Connection refused"
    }
  }
}
```

## Related Documentation

- [Impulse Activity Foundation](../../docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md) - Canonical reference
- [Standard Configuration](../../docs/STANDARD_CONFIGURATION.md) - Vessel configuration patterns
- [Discovery Integration](../../docs/DISCOVERY_INTEGRATION.md) - Service discovery guide
- [README](./README.md) - Project overview and deployment
- [DISCOVERY_MIGRATION.md](./DISCOVERY_MIGRATION.md) - Migration guide for discovery integration
- [DEPLOYMENT_WORKFLOW.md](../deployment/DEPLOYMENT_WORKFLOW.md) - CI/CD workflow
- [Root CLAUDE.md](../../CLAUDE.md) - System-wide development guidelines
