# WebSocket Real-Time Dashboard Updates - Trace Complete ✅

**Specification**: WebSocket-Real-Time-Dashboard-Updates  
**Status**: TRACED  
**Priority**: MEDIUM (Phase 2)  
**Date**: March 19, 2026

---

## Summary

The trace is **complete**. WebSocket real-time dashboard updates specification has been fully analyzed with current vs desired state documented.

### Key Findings

**60% Complete** - Dashboard WebSocket client is fully implemented and ready, server implementation missing.

**Implementation is backend-only** (4-5 hours) - No dashboard changes needed beyond connecting the existing WebSocket hook.

---

## Components Status

| Component | File | Status | Gap |
|-----------|------|--------|-----|
| WebSocket Client | repos/activity-dashboard/src/lib/api-client.ts:274 | ✅ COMPLETE | None |
| React Hook | repos/activity-dashboard/src/hooks/useWebSocket.ts | ✅ COMPLETE | None |
| Message Types | repos/activity-dashboard/src/lib/types.ts:252 | ✅ COMPLETE | None |
| WebSocket Server | repos/metabob-activity-api/src/index.ts:155 | ❌ NOT IMPLEMENTED | Add Bun WebSocket config |
| Event Broadcasting | repos/metabob-activity-api/src/routes/activities.ts:599 | ⚠️ PARTIAL | Add broadcaster.emit() calls |

---

## Data Flow

### Current State (Polling)
```
MiniBob → POST /executions → DB update → Dashboard polls every 5s
```

### Desired State (WebSocket)
```
MiniBob → POST /executions → WebSocket broadcast → Dashboard instant update (<100ms)
```

---

## Implementation Plan (4-6 hours)

1. **Create WebSocket Infrastructure** (1-2 hours)
   - repos/metabob-activity-api/src/websocket/broadcaster.ts
   - WebSocketBroadcaster singleton for event emission

2. **Integrate with Bun Server** (1 hour)
   - Update repos/metabob-activity-api/src/index.ts:155
   - Add websocket config to Bun.serve()

3. **Emit Events from Execution Handler** (30 minutes)
   - Update repos/metabob-activity-api/src/routes/activities.ts:599
   - Call broadcaster.emit() at 3 trigger points:
     - execution_started (before DB insert)
     - execution_completed (after Thompson update)
     - template_metrics_updated (after metrics update)

4. **Update Dashboard to Use WebSocket** (1-2 hours)
   - Connect useWebSocket hook in Dashboard.tsx
   - Handle 3 event types and update UI

5. **Test End-to-End** (1 hour)
   - Verify real-time updates without polling
   - Test multiple clients, reconnection

---

## Event Types

### execution_started
```json
{
  "type": "execution_started",
  "timestamp": "ISO8601",
  "data": {
    "execution_id": "string",
    "variant_id": "string",
    "pod_name": "string?"
  }
}
```

### execution_completed
```json
{
  "type": "execution_completed",
  "timestamp": "ISO8601",
  "data": {
    "execution_id": "string",
    "variant_id": "string",
    "success": "boolean",
    "duration_ms": "number",
    "cost": "number"
  }
}
```

### template_metrics_updated
```json
{
  "type": "template_metrics_updated",
  "timestamp": "ISO8601",
  "data": {
    "variant_id": "string",
    "metrics": {
      "success_rate": "number",
      "avg_duration_ms": "number",
      "avg_cost_usd": "number",
      "thompson_alpha": "number",
      "thompson_beta": "number"
    }
  }
}
```

---

## Dependencies

### Blocking
- Execution history endpoint (GET /executions) must exist for events to reference

### Non-Blocking
- WebSocket is enhancement, dashboard works with polling until server ready

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Broadcast overhead | Limit clients per session |
| Reconnection storms | Exponential backoff |
| Auth bypass | Validate token on connect |
| Multi-tenant leak | Filter events by session.orgId |

---

## Trace Outputs

**Full Analysis**: TRACE_WebSocket-Real-Time-Dashboard-Updates.md (17KB)  
**JSON Summary**: TRACE_WebSocket-Real-Time-Dashboard-Updates.json (4KB)  
**Impulse**: trace-WebSocket-Real-Time-Dashboard-Updates (5000 token budget)

---

## Next Actions

**For downstream tasks**:
1. Use impulse `trace-WebSocket-Real-Time-Dashboard-Updates` for enforcement
2. Implement Step 1 (broadcaster infrastructure)
3. Implement Step 2 (Bun WebSocket integration)
4. Implement Step 3 (event emission)
5. Implement Step 4 (dashboard integration)
6. Run E2E validation

**Priority**: Execute after HIGH priority gaps (impulse storage, execution history endpoint)

---

## Context for Calling Agent

**Phase 1 Complete** (90%):
- ✅ Execution history endpoint
- ✅ Impulse backend storage

**Phase 2 Next** (WebSocket real-time updates):
- Status: TRACED ✅
- Ready for: Enforcement/Implementation
- Estimated: 4-6 hours
- Impact: Eliminates polling, enables live monitoring of autonomous learning loop
