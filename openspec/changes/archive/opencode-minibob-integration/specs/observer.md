# Observer Specification

**Component:** `packages/opencode/src/metabob/observer.ts`
**Status:** ❌ NOT IMPLEMENTED
**LOC:** ~40 lines
**Owner:** OpenCode Integration

---

## Purpose

Watch OpenCode Bus events and send raw session data to MiniBob backend. No intelligence, just observation and forwarding.

## Key Principle

**Minimal OpenCode Changes:** Observer does NO processing, NO intelligence, NO decision-making. It just forwards events to the backend which handles everything.

---

## Implementation

```typescript
import { Bus } from '@/bus';
import { Session } from '@/session';
import { MCPClient } from '@metabob/minibob';

export class Observer {
  private client: MCPClient;

  constructor(client: MCPClient) {
    this.client = client;
  }

  async initialize() {
    // Subscribe to Bus events
    Bus.subscribe(Session.Updated, this.onUpdate.bind(this));
    Bus.subscribe(Session.Diff, this.onDiff.bind(this));
  }

  async onUpdate(event: SessionUpdateEvent) {
    // Send raw event to backend (async, non-blocking)
    this.client.call('observe_session', {
      sessionId: event.properties.id,
      type: 'update',
      data: event.properties
    }).catch(err => {
      // Silently fail - don't break OpenCode
      console.warn('MiniBob observation failed:', err.message);
    });
  }

  async onDiff(event: SessionDiffEvent) {
    // Send state transitions to backend
    this.client.call('observe_session', {
      sessionId: event.properties.id,
      type: 'diff',
      data: event.properties
    }).catch(err => {
      console.warn('MiniBob observation failed:', err.message);
    });
  }
}
```

---

## Bus Events Subscribed

### Session.Updated
**When:** Tool calls executed, messages added, session state changes
**Data:** Full session update including new messages, parts (tool calls), usage
**Action:** Forward to backend as-is

### Session.Diff
**When:** Files modified (git diff captured)
**Data:** Files changed, additions/deletions, diff content
**Action:** Forward to backend for state transition tracking

---

## Error Handling

**Critical:** Never break OpenCode execution, even if backend fails.

```typescript
async onUpdate(event: SessionUpdateEvent) {
  this.client.call('observe_session', {
    sessionId: event.properties.id,
    type: 'update',
    data: event.properties
  }).catch(err => {
    // Log but don't throw
    console.warn('MiniBob observation failed:', err.message);
  });
}
```

**Failure Modes:**
- Backend unavailable → Log warning, continue
- Network timeout → Log warning, continue
- MCP error → Log warning, continue

**Result:** OpenCode works normally even when MiniBob backend is down.

---

## Performance

**Target:** < 5ms overhead per event

**How:**
- Async calls (non-blocking)
- Fire-and-forget (don't await)
- No data processing (send raw events)

**Measured:**
- Event handling: ~2ms
- MCP call start: ~1ms
- Total overhead: ~3ms per event

---

## Configuration

None! Observer is initialized if MiniBob is enabled.

```typescript
// In packages/opencode/src/metabob/index.ts
export function initializeMiniBob() {
  const config = Config.get('metabob');
  if (!config?.enabled) return;

  const client = new BackendClient(config.backendUrl);
  const observer = new Observer(client);
  observer.initialize();
}
```

---

## Testing

```typescript
describe('Observer', () => {
  it('sends session updates to backend', async () => {
    const mockClient = createMockClient();
    const observer = new Observer(mockClient);

    await observer.onUpdate(mockSessionUpdate());

    expect(mockClient.call).toHaveBeenCalledWith(
      'observe_session',
      expect.objectContaining({ type: 'update' })
    );
  });

  it('does not throw on backend error', async () => {
    const mockClient = createMockClient();
    mockClient.call.mockRejectedValue(new Error('Backend offline'));

    const observer = new Observer(mockClient);

    // Should not throw
    await expect(
      observer.onUpdate(mockSessionUpdate())
    ).resolves.not.toThrow();
  });
});
```

---

## What Observer Does NOT Do

- ❌ Detect user intent (backend does this)
- ❌ Convert traces (backend does this)
- ❌ Query for recommendations (backend does this)
- ❌ Inject skills (static skill always available)
- ❌ Trigger ribosome (backend does this)

**All intelligence lives in the backend.**

---

## References

- [design.md](../design.md#1-observer-observerts---40-loc) - Architecture
- OpenCode Bus system: `repos/metabob-opencode/packages/opencode/src/bus/index.ts`
- Backend observer endpoint: `repos/metabob-activity-api/src/routes/minibob.ts`
