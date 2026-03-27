# metabob-internal-dashboard Development Guidelines

## Foundation Alignment

> **Canonical reference**: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`

This dashboard is an **impulse-driven vessel** where MiniBob controls all UI through impulse creation. The dashboard does not decide what to show - it renders what MiniBob creates.

### Key Principles Applied

| Principle | Application |
|-----------|-------------|
| **Impulses are universal data** | UI components ARE impulses with `ui_component` pointer type |
| **Activities constrain search** | MiniBob uses GoalProcessor with Thompson Sampling |
| **Resolvers live where data lives** | MiniBob runs in dashboard process, has local access |
| **LLMs are tools, not controllers** | LLM used via GoalProcessor/ActivityExecutor |

### The Dashboard Does NOT

- Decide what UI to show
- Have fixed screens or views
- Query data directly (MiniBob does via tools)
- Control MiniBob's decisions

### The Dashboard DOES

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

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `MINIBOB_API_URL` | Activity API endpoint | `http://localhost:8080` |
| `ANTHROPIC_API_KEY` | Claude API key | (required) |
| `LLM_MODEL` | LLM model | `claude-sonnet-4-20250514` |
| `WORKING_DIRECTORY` | File operations context | `process.cwd()` |

## Testing

```bash
# Run all tests
bun test

# Run Playwright e2e tests
bunx playwright test
```

## Related Documentation

- [Impulse Activity Foundation](../../docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
- [README](./README.md) - Overview and deployment
