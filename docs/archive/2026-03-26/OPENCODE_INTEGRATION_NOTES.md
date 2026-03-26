# OpenCode + MiniBob Integration Notes

## Current Setup (Development)

**Package dependency**: `file:../minibob` (local path)

**TODO after integration complete**: Change to proper package registry reference in `repos/metabob-opencode/package.json`:
```json
{
  "dependencies": {
    "@metabob/minibob": "^0.1.0"  // or appropriate version
  }
}
```

## Integration Architecture

### Pattern: Non-Invasive Event-Driven Learning

OpenCode's execution is observed via its Bus system and converted into MiniBob activity traces without modifying core execution logic.

### Three Phases (All implemented together)

1. **Observe**: Subscribe to Bus events, capture tool calls and sessions
2. **Learn**: Convert sessions → activity templates via ribosome pattern
3. **Recommend**: Suggest learned patterns for similar goals

### Configuration

OpenCode config (`~/.opencode/config.json`):
```json
{
  "metabob": {
    "enabled": true,
    "config": {
      "backendUrl": "http://api.minibob.local",
      "apiKey": "optional"
    }
  }
}
```

### Implementation Location

`repos/metabob-opencode/packages/opencode/src/metabob/`:
- `observer.ts` - Bus event subscription
- `trace-converter.ts` - Session → MiniBob trace conversion
- `backend-client.ts` - metabob-activity-api communication
- `ribosome.ts` - Template extraction from successful sessions
- `recommender.ts` - Query backend for similar goal patterns

### What Gets Tracked

- User intents (potential goals)
- Tool sequences (inputs/outputs)
- State transitions (file hashes before/after)
- Execution metadata (duration, cost, tokens, success)
- Execution context (working dir, environment, available files)

### What Gets Learned

- Tool sequences that achieve specific goals
- File patterns that indicate activity types
- Tool combinations that succeed/fail
- Template success rates over time

### Backend Integration

MiniBob delegates to `metabob-activity-api` for:
- Persistent storage (SurrealDB)
- Thompson Sampling (template selection)
- Pattern recognition
- Impulse resolution (all types beyond local memo/file)

### Key Principle

**Zero changes to OpenCode execution flow**. Pure observation → learning → improvement loop.

---

**Status**: Fork prep complete, ready for integration implementation
