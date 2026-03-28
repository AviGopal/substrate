# Shared Impulse State Space (Revised)

## Problem

The minibob-tui displays minimal "Hello / Completed" boxes instead of rich activity state because:

1. **ActivityExecutor has no lifecycle callbacks** - No way to emit events during task/tool execution
2. **WebSocket broadcast incomplete** - Types defined but implementation missing
3. **TUI not subscribed to impulse events** - WebSocket/EmbeddedMiniBob events don't reach RegionManager

## Solution

**Wire existing infrastructure together**. Most components exist; they just aren't connected.

### Architecture (Stigmergy Pattern)

Vessels modify a shared trace field rather than communicating directly:

```
        Shared Trace Field (ImpulseStore)
              ↑ write       ↑ write
              │             │
          MiniBob          TUI
         (executor)      (renderer)
              │             │
              ↓ read        ↓ read
         [file, bash]    [visual components]
```

### Key Findings (Mar 2026 Re-analysis)

**Already Working:**
- `minibob/src/impulse.ts` - Full ImpulseStore with 5-level resolver dispatch
- `minibob-tui/src/lib/regions.ts` - RegionManager with state lifecycle
- `minibob-tui/src/lib/resolver-registry.ts` - NEW: Priority-based resolver registry
- `minibob-tui/src/lib/tools/*` - NEW: 6 TUI tools fully implemented

**Critical Gaps:**
- `minibob/src/activity.ts` - No lifecycle callbacks
- `minibob/src/websocket.ts` - Broadcast functions not implemented
- TUI event wiring - WebSocket events don't create regions

**New Paradigm Tables:**
- Backend now uses unified 4-table structure (impulse, activity, execution, vessel)
- Computed views replace stored aggregations
- Full RBAC via SurrealDB PERMISSIONS

## Revised Milestones

| # | Commit | Focus | Testable |
|---|--------|-------|----------|
| M1 | `feat(minibob): add executor callbacks` | ActivityExecutor lifecycle | Events logged |
| M2 | `feat(minibob): implement websocket broadcast` | Broadcast implementation | WS clients receive |
| M3 | `feat(tui): wire websocket to regions` | Remote mode wiring | TUI renders from server |
| M4 | `feat(tui): wire embedded to regions` | Embedded mode wiring | Activity progress shows |
| M5 | `feat(impulse): add shape constants` | Type-safe shapes | Shared constants |
| M6 | `feat(tui): streaming support` | LLM streaming | Real-time output |

## Alignment Check

**No breaking changes** from previous spec. Architecture documents are internally consistent:
- Stigmergy pattern adds biological grounding to trace field approach
- Metadata-first principle still applies
- Resolvers live where data lives

**Key refinement:** Focus on wiring existing infrastructure rather than creating new packages.

## References

- [Design Document](./design.md) - Full architecture and data flow
- [Task List](./tasks.md) - Detailed implementation tasks with dependencies
- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` - Canonical reference
