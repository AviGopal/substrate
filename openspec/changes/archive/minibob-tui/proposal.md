# minibob-tui: Impulse-Driven Terminal Interface

## Summary

Build a terminal user interface for MiniBob that renders impulses as visual regions. The TUI is a window into the process-of-becoming, not a traditional control panel.

## Problem

Currently, MiniBob can only be interacted with via CLI commands or HTTP requests. There's no way to observe the continuous flow of activities and impulses in real-time. We need a TUI that:

1. Shows the becoming as it happens
2. Allows users to inject intent by typing
3. Can be tested programmatically without visual inspection

## Solution

An **impulse renderer** built on OpenTUI that:

- Is empty by default (no predefined screens or views)
- Renders impulses as regions when they arrive
- Removes regions when impulses complete
- Materializes user input as an impulse when typing starts
- Provides a control socket for external testing/interaction

## Key Design Decisions

1. **Input is an impulse** - User input materializes as an impulse with high priority (1000+), appears at top, disappears after submission
2. **Priority determines layout** - Regions stack vertically by priority, not by arrival time
3. **Control interface** - Unix socket enables testing without visual inspection
4. **Shape-specific components** - Impulse metadata.shape determines which component renders it

## Foundation Alignment: Resolver Mapping

> **Principle**: "The shape describes what it is. The resolver knows how to access it."

Each impulse shape has a corresponding resolver that knows how to access/render its content:

| Shape | Resolver | Location | Lifecycle |
|-------|----------|----------|-----------|
| `user_input` | `tui_input` | Local terminal (stdin) | Until submit/cancel |
| `log_stream` | `websocket` | MiniBob server | Until completion |
| `code_generation` | `minibob` | Vessel execution | Until written to file |
| `error` | `system` | stderr capture | Until cleared by user |
| `confirmation` | `tui_dialog` | Local terminal | Until user responds |
| `execution_trace` | `backend` | metabob-activity-api | Persistent (for replay) |
| `activity_progress` | `websocket` | MiniBob server | Until activity completes |

### Resolver Implementation

```typescript
// TUI impulse resolution
const resolvers: Record<string, ImpulseResolver> = {
  tui_input: {
    // Resolve by reading terminal input
    async resolve(impulse) {
      return {
        content: await readInput(),
        loaded: true
      }
    }
  },
  websocket: {
    // Resolve by subscribing to WebSocket stream
    async resolve(impulse) {
      const ws = connectToMiniBob()
      return {
        content: ws.createStream(impulse.pointer.streamId),
        loaded: true,
        streaming: true
      }
    }
  },
  backend: {
    // Resolve by querying activity-api
    async resolve(impulse) {
      const trace = await api.get(`/v2/traces/${impulse.pointer.traceId}`)
      return {
        content: trace,
        loaded: true
      }
    }
  }
}
```

## Critical Path

The **control interface** (Milestone 1.1) must be built first because it enables testing all subsequent features without requiring visual inspection.

## Success Criteria

1. Control socket can query TUI state and inject events
2. User can type, submit intent, and see results
3. MiniBob execution streams to TUI in real-time
4. All features testable via control socket

## References

- [Impulse-Driven TUI Spec](../../docs/architecture/IMPULSE_DRIVEN_TUI.md)
- [Impulse Activity Foundation](../../docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
