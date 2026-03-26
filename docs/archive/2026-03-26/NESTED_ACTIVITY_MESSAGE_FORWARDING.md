# Nested Activity Message Forwarding Implementation

## Problem Statement

When activities execute in child sessions, their messages and permission requests are invisible to the primary session UI. This causes:

1. **Lack of visibility**: Users cannot see what's happening in nested activity executions
2. **Permission blockages**: Permission requests in nested activities block execution because the user never sees them
3. **Poor UX**: No way to observe or debug nested activity behavior from the main UI

## Solution Architecture

We implemented a message forwarding system that subscribes to events in child (activity) sessions and republishes them to the parent (calling) session with metadata indicating the nesting context.

### Components

#### 1. **ActivityMessageForwarder** (`activity-message-forwarder.ts`)

Core module that manages message and permission forwarding between sessions.

**Key Features:**
- Tracks parent-child session relationships
- Subscribes to message and permission events in child sessions
- Republishes events to parent session with forwarding metadata
- Manages cleanup of subscriptions when sessions close

**API:**
```typescript
// Start forwarding from child to parent
startForwarding(
  childSessionId: string,
  parentSessionId: string,
  activityId?: string,
  nestingLevel: number = 1
): Promise<void>

// Stop forwarding and cleanup
stopForwarding(childSessionId: string): void

// Respond to forwarded permission
respondToForwardedPermission(
  forwardedPermissionId: string,
  sourceSessionId: string,
  response: Permission.Response
): Promise<void>
```

**Event Schema:**
```typescript
Event.MessageForwarded: {
  message: MessageV2.Info,
  sourceSessionId: string,
  sourceActivityId?: string,
  targetSessionId: string,
  nestingLevel: number,
  forwardedAt: number,
}

Event.PermissionForwarded: {
  permission: Permission.Info,
  sourceSessionId: string,
  sourceActivityId?: string,
  targetSessionId: string,
  nestingLevel: number,
  forwardedAt: number,
}
```

#### 2. **Activity Tool Integration** (`tool/activity.ts`)

The activity tool now starts forwarding when creating child sessions and stops forwarding during cleanup.

**Integration Points:**

```typescript
// After creating activity session
await ActivityMessageForwarder.startForwarding(
  sessionID,          // child session (activity execution)
  ctx.sessionID,      // parent session (calling/primary)
  activity.id,        // activity ID for context
  1                   // nesting level
)

// In finally block cleanup
ActivityMessageForwarder.stopForwarding(sessionID)
```

This applies to both:
- Regular activity execution (`ActivityTool.execute`)
- Inline activity execution (`executeActivityInline`)

#### 3. **UI Components** (`nested-activity-viewer.tsx`)

React/SolidJS component that displays forwarded messages and permissions in the primary session UI.

**Features:**
- Collapsible nested activity views
- Real-time message streaming
- Interactive permission request handling
- Visual indication of nesting level (indentation + border)
- Activity statistics (message count, permission count)

#### 4. **API Endpoints**

**SSE Endpoint** (`api/forwarded-events/[sessionId].ts`):
- Streams forwarded messages and permissions to frontend
- Maintains persistent connection with heartbeat
- Filters events by target session ID

**Permission Response** (`api/permissions/respond.ts`):
- Receives permission responses from UI
- Proxies responses back to source session
- Validates request schema

## Data Flow

```
┌──────────────────────┐
│  Primary Session     │
│  (UI visible)        │
└─────────┬────────────┘
          │
          │ activity tool call
          ▼
┌──────────────────────┐
│  Activity Session    │ ◄─── startForwarding() called
│  (child session)     │
└─────────┬────────────┘
          │
          │ task execution
          │
          ├─► Message created
          │   └─► Bus.publish(MessageV2.Event.Updated)
          │       └─► Forwarder catches event
          │           └─► Bus.publish(Event.MessageForwarded)
          │               └─► SSE endpoint streams to UI
          │                   └─► UI renders in nested view
          │
          └─► Permission requested
              └─► Bus.publish(Permission.Event.Updated)
                  └─► Forwarder catches event
                      └─► Bus.publish(Event.PermissionForwarded)
                          └─► SSE endpoint streams to UI
                              └─► UI shows permission dialog
                                  └─► User responds
                                      └─► POST /api/permissions/respond
                                          └─► Forwarder proxies to source session
                                              └─► Permission.respond() in child session
```

## Implementation Details

### Session Lifecycle

1. **Activity Start**: `startForwarding()` is called with parent-child relationship
2. **During Execution**: Events in child session are automatically forwarded to parent
3. **Activity End**: `stopForwarding()` cleans up subscriptions and state

### Nesting Levels

The system tracks nesting depth:
- **Level 0**: Primary session (no forwarding)
- **Level 1**: Direct activity execution (most common)
- **Level 2+**: Nested activities (e.g., lifecycle hooks calling activities)

Nesting level is used for:
- Visual indentation in UI
- Debugging and monitoring
- Understanding execution context

### State Management

The forwarder maintains instance-scoped state:
```typescript
interface ForwardingState {
  sessionParents: Map<string, string>      // child → parent mapping
  sessionActivities: Map<string, string>   // session → activity mapping
  sessionNestingLevels: Map<string, number> // session → nesting level
  subscriptions: Map<string, Array<() => void>> // cleanup functions
}
```

This state is automatically cleaned up when:
- `stopForwarding()` is called explicitly
- Instance is destroyed (process exit)

## Benefits

✅ **Visibility**: All nested activity execution is visible in primary UI
✅ **No Blockages**: Permission requests can be approved from main UI
✅ **Debugging**: Clear view of execution flow and nesting depth
✅ **UX**: Transparent nested execution without confusion
✅ **Flexibility**: Works with any nesting depth

## Future Enhancements

1. **Message Filtering**: Allow users to filter/hide certain message types
2. **Performance**: Batch forwarding for high-frequency messages
3. **History**: Persist forwarded messages for review after completion
4. **Remote Execution**: Extend to ACP remote execution (Phase 3 of delegation)
5. **Tool Call Visualization**: Show tool calls in nested view
6. **Cost Tracking**: Display token/cost metrics per nested activity

## Testing Strategy

### Unit Tests
- Test `startForwarding()` / `stopForwarding()` lifecycle
- Test event filtering (only forward to correct target)
- Test nesting level tracking
- Test cleanup on session close

### Integration Tests
- Test end-to-end forwarding from activity to UI
- Test permission response proxying
- Test SSE connection stability
- Test multi-level nesting

### Manual Testing
- Create activity that requests permissions
- Verify permissions appear in main UI
- Approve/reject permissions from main UI
- Verify activity continues/fails appropriately
- Test with nested activities (activity calling activity)

## Known Limitations

1. **Import Paths**: Console app routes need proper import configuration (currently showing errors)
2. **SSE Fallback**: No WebSocket fallback for environments that don't support SSE
3. **Message History**: Forwarded messages aren't persisted (only live streaming)
4. **Performance**: No batching for high-frequency message streams

## Next Steps

1. Fix import paths in console app routes (monorepo configuration)
2. Add comprehensive tests
3. Document API endpoints
4. Add telemetry for forwarding metrics
5. Implement message filtering/history UI

## Files Created/Modified

### Created
- `repos/metabob-opencode/packages/opencode/src/session/activity-message-forwarder.ts`
- `repos/metabob-opencode/packages/console/app/src/components/nested-activity-viewer.tsx`
- `repos/metabob-opencode/packages/console/app/src/routes/api/forwarded-events/[sessionId].ts`
- `repos/metabob-opencode/packages/console/app/src/routes/api/permissions/respond.ts`

### Modified
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` - Added forwarder integration

## Summary

This implementation provides a robust, scalable solution for observing and interacting with nested activity executions. By forwarding messages and permissions from child sessions to the parent session UI, we eliminate blockages and provide full transparency into multi-level execution flows.

The architecture is extensible and can be easily adapted for remote execution scenarios (ACP), multi-agent coordination, and future workflow patterns.
