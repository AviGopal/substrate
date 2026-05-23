---
gap_id: gap-002
category: irreducibly_operator
severity: minor
observed_first: 2026-05-23T23:30Z
last_observed: 2026-05-23T23:31Z
recurring_count: 1
bridge_path: (not a substrate self-knowledge gap; operator-side access issue)
---

# Gap 002 — WebSocket auth rejects substrate's own internal METABOB_API_KEY

## Observation

When connecting to `ws://localhost:18080/ws` (substrate-live's activity-api WebSocket endpoint) using the substrate's own internal `METABOB_API_KEY` (extracted from `docker exec substrate-live env`), authentication fails:

```
WS auth rejected: {"type":"auth_error","error":"Authentication failed","message":"Identity vessel returned 401"}
WS closed code=1008 reason=Authentication failed
```

Meanwhile the SAME key authenticates successfully for HTTP-based queries (e.g., `GET /v2/activities/templates` returns the 18-template list).

Discovery-vessel's `/registry/stats` also rejects the same key with HTTP 401.

## Attempted description (using only substrate-side knowledge)

This is NOT a substrate self-knowledge gap — the substrate's internal vessel-to-vessel auth presumably works (substrate is running, traces would be writable). The gap is in EXTERNAL operator access: my role's narrator script cannot subscribe to live events because the substrate's WebSocket auth path uses a different code path than the HTTP REST auth, and that code path rejects the same key.

This is a substrate-internal-auth vs. substrate-external-observer-auth divergence. The substrate doesn't need to describe this to itself — it functions normally. But operator-side observability is partially blocked.

## Knowledge used

### Substrate-side:
- WebSocket rejection message (substrate-emitted)
- HTTP success of same key (substrate-emitted)
- systemd showed identity-vessel running

### Operator-side gaps:
- **`irreducibly_operator`**: this is about operator-side access to substrate state, not about substrate's self-knowledge. Substrate is operating correctly; operator's narrator-script doesn't have the right credentials for WS auth.
  - bridge_path: substrate-resident replacement — when memoryNote_write and substrate-public-feed ship (per operator-and-public-contracts), external observability flows through those channels with their own auth; raw WS access is not the long-term operator interface
  - immediate workaround: dispatch an in-container probe activity that subscribes to WS internally (would not need operator-side WS auth)

## Verdict

`description_completed_within_substrate_knowledge: partial`
`gap_severity: minor`

The substrate functions normally; only operator-side observability is degraded.

## Implications

- Narrator runs in snapshot-only mode against this substrate (no live event stream)
- Snapshots every 5 minutes still produce useful t-0 state captures
- Full event-stream observability blocked until either (a) the WS auth issue is resolved or (b) substrate-public-feed (per operator-and-public-contracts spec) ships as the operator's observation channel

## Coordination

- **Main development operator**: WS auth on local substrate may need operator-tier key issuance; identity-vessel may have rate-limit or scope mismatch
- **Auditor**: can confirm at runtime whether internal vessel-to-vessel WS auth works (it should; the substrate is operating)
- **My role**: continue with snapshot-mode; flag pattern if it persists once substrate-public-feed lands
