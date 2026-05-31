# 2026-05-31 — goal-host-vessel OOM bounded concurrency + self-detection

## Motivation

`goal-host-vessel` is OOM-killing every ~3 minutes, growing to ~10GB
before kill. Restart pattern observed today (UTC): 06:18, 06:21:59,
06:22, 06:26:06, 06:32:15. By the time the diagnose-and-fix agent
attempted root-cause via `docker exec` probes, the cumulative cascade
had wedged the docker daemon itself — substrate fully unreachable,
container-level distress.

This blocks **all live verification** of the substrate's autonomous
loop. R2's F25 fix (activity-api `b413a99` + dev-vessel `5cb2d59`)
cannot be confirmed end-to-end. The drafter's auto-mint pipeline
(`concept_jrpy3zt2YjK-` proved correct yesterday) cannot be exercised.
No run_goal dispatch survives long enough to complete an LLM-heavy
goal. The substrate is structurally repairable but observationally
blocked.

### Static-analysis hypothesis ranking

Per the diagnose agent's read of `repos/goal-host-vessel/src/index.ts`
and `@avigopal/ias-executor-ts/src/adapters/bus-forwarder.ts`:

1. **`BusForwardingEventSink.forward()` unawaited Promise queue** —
   every engine lifecycle event (`task.started`, `task.completed`,
   `lifecycle:task:preBinding`, `lifecycle:execution:succeeded`,
   `lifecycle:gap:classified`, `lifecycle:llm:dispatched`, etc.)
   spawns `void (async () => { await fetchFn(publishUrl, {body}) })()`.
   Each Promise retains the full event body in memory until activity-api
   responds. If activity-api is slow OR the engine emits hundreds of
   events per multi-task execution, in-flight Promise count grows
   unboundedly. ~50MB/sec growth math fits LLM-completion event bodies
   × hundreds of concurrent in-flight POSTs.
2. **WS listener leak across reconnects** — `busWsClient = null`
   (line 497) discards the reference without `.close()` or
   `removeEventListener`. Old socket retains listener closures
   referencing captured `busSink`, `host`, etc. Multiplier on (1) but
   not enough alone to reach 10GB in 3 minutes.
3. Dev-vessel proxy resolver re-registration cycle — less likely;
   debounce mostly handles it.
4. `executionStore` Map — well-bounded (cap 100, prune to 80). Not
   the leak.

The cascade also surfaces the absence of a **substrate-self-detection
template for this class**. If `detect-service-oom-cascade` existed,
it would have been emitting substrateGap impulses continuously since
06:18 UTC — and the operator would have known to address the cascade
before the docker daemon wedged.

## Proposal

Three layered changes, smallest first. Layer 1 + Layer 3 are scoped
to substrate-side files (no published-package publish required).
Layer 2 is the durable framework fix and requires
`@avigopal/ias-executor-ts` publish.

### Layer 1 — goal-host-side bounded-concurrency wrapper (smallest)

Add a `BoundedBusSink` wrapper class to
`repos/goal-host-vessel/src/index.ts` that wraps `BusForwardingEventSink`
and enforces:

- **Max in-flight forwards**: bounded queue (default 32, env-tunable
  via `BUS_MAX_INFLIGHT`). New events while at cap drop oldest.
- **Backlog drop policy**: if pending queue length > 100, drop the
  oldest enqueued event before pushing the new one. Log dropped count
  per minute (single line, suppressed thereafter).
- **Memory ceiling on serialized bodies**: each Promise's body string
  is computed lazily; if total estimated bytes in-flight > 50 MB, new
  events drop until backlog clears.
- **Periodic stats line**: emit one log line per 30s with current
  in-flight count, dropped-since-last count, queue-bytes estimate.

This wrapper sits between `host = new GoalHost({eventSink: busSink, ...})`
and the actual `busSink`. The inner sink is unchanged; the wrapper
gates the forward path.

### Layer 2 — Framework fix to `BusForwardingEventSink` (durable)

Patch `repos/ias-executor-ts/src/adapters/bus-forwarder.ts` so the
bounded-concurrency semantics live in the framework, not at every
caller. Same backpressure rules as Layer 1, but applied to all
consumers (goal-host-vessel, future vessels). Layer 1 becomes
redundant once Layer 2 ships.

Requires `@avigopal/ias-executor-ts` publish + consumer bumps. Same
operator-publish caveat as `8f1343c` (lifecycle), `01dfc54` (mapTask),
`402ecdd` (dispatch-target) — all three commits sit local-only because
the GitHub remote `AviGopal/ias-executor-ts` returns "Repository not
found". Layer 2 blocks on resolving the publish path.

### Layer 3 — `detect-service-oom-cascade` substrate citizen

Mirrors the canonical immunity pattern (`inputShapes: []`,
`variables: []`, single server-side resolver, no LLM, no iteration —
confirmed across `detect-stale-pointer`, `detect-phantom-success-trace`,
`detect-precondition-rejection`, `audit-dispatch-target-drift`).

The resolver (`service_oom_cascade_scan`) does:

1. For each service in `[goal-host-vessel, development-vessel,
   activity-api, concept-db, analysis-vessel, llm-resolver-vessel,
   discovery-vessel, ribosome-vessel, boredom-vessel]`:
   - Run `systemctl show <svc>.service -p ActiveEnterTimestamp,
     MemoryCurrent,RestartCount` inside substrate-live
   - Parse output
2. Compute per-service: restarts in the last hour, current memory in
   MB, memory delta since last scan (requires per-service mtime cache
   under `/workspace/.oom-detector/`)
3. Emit substrateGap per affected service:
   - `gap_class: "service_oom_cascade"`, `gap_id: "oom-cascade-${svc}"`
   - Triggers: restarts > 3 in an hour OR memory > 4 GB OR
     memory_delta > 500 MB since last scan
   - `fix_priors`: cite this openspec's resulting commit and the
     bounded-concurrency-pattern concept once minted

The detector is itself memory-light (single shell-out per service,
no LLM, no large payloads). Pre-flight-immune by construction.

## Out of Scope

- **Direct fix of activity-api `/v2/events/publish` slowness** if
  that's part of the upstream cause. The bounded-concurrency fix
  protects goal-host regardless of why activity-api is slow; making
  activity-api faster is a separate change. Static analysis suggests
  the slowness may itself be downstream of activity-api's trace-store
  INSERT (Agent A's secondary finding that `failure_mode`/`tasks`/
  `metadata` are dropped silently) — but that's a different bug.

- **Universal bounded-concurrency wrapper at the engine layer**.
  Layer 1 + Layer 2 cover the BusForwardingEventSink path specifically.
  Other unbounded-concurrency points in the engine (e.g.
  `LifecycleSubscriberVessel.dispatchSubscribers` void-async pattern
  from `concept_KAQEz-Xq5FwT`) are separate. They MAY also need
  bounding, but only if measurement (post-OOM-fix) shows continued
  memory pressure.

- **Multi-vessel OOM coverage**. Layer 3 detects cascade per service
  but doesn't bound any other vessel's emissions. If concept-db starts
  cascading, the detector emits the gap; the FIX class shape would
  need to mirror Layer 1/2 at that vessel.

- **Operator-publish workflow for `@avigopal/ias-executor-ts`**. Three
  framework fixes currently stack local-only (`8f1343c`, `01dfc54`,
  `402ecdd`). Resolving the publish path is a separate operator-side
  spec; this proposal accepts the local-docker-cp workaround until
  that lands.

## Success Criteria

1. **Layer 1 shipped + verified**: after deploy, goal-host-vessel
   stays alive for ≥ 30 minutes under boredom-vessel's normal goal
   rotation. Peak memory ≤ 2 GB. Restart count over the window: 0.
2. **Verification dispatch**: `mcp__metabob__run_goal target_template_id=
   development-vessel:draft-gap-closing-activity` against a known
   scenario file completes end-to-end within 60 s (was previously
   either OOM-killed mid-flight or fast-failing at pre-flight).
   This also proves the F25 fix (`b413a99` + `5cb2d59`) lands.
3. **Layer 3 ships + emits its first gap**: `detect-service-oom-cascade`
   dispatched runs cleanly under the immunity pattern. Initial pass
   emits 0 gaps (post-Layer-1 healthy state); if Layer 1 regresses,
   it emits at least 1 gap per affected service.
4. **A substrate concept describes the response pattern**:
   `concept_response_pattern_oom_cascade` (vessel_construction_pattern)
   linking `derived_from concept_9ldsmRgqSTd5` and
   `contradicts(0.3)` to the OOM-cause hypothesis the data confirmed.
5. **Layer 2 deferred but spec'd**: this proposal accepts that the
   durable framework fix sits behind the publish-path resolution.
   Layer 1 is sufficient operational guard until then.

## References

- `concept_9ldsmRgqSTd5` — substrate_self_detection_principle (the
  constitutional framing this work embodies)
- `concept_KAQEz-Xq5FwT` — substrate lifecycle subscriber fix (the
  void-async pattern that bounds dispatchSubscribers; Layer 1 of this
  proposal applies the SAME pattern at one layer up, BusForwardingEventSink)
- `concept_4FLJHLJ9mgV7` — MCP run_goal timeout cap (background on
  the dispatch upstream pressure that compounds the OOM symptoms)
- `concept_Y2zGpFNBrcgb` — detect-phantom-success-trace pattern
  (canonical immunity pattern for detection templates; Layer 3
  follows this shape)
- `concept_pFSLV6s5s3lQ` — detect-precondition-rejection pattern
  (same immunity reference)
- `concept_t2jHO8I-LxD3` — audit-dispatch-target-drift pattern
  (third reference for immunity shape)
- `concept_r2qErOKA5gWR` — phantom-trace-scan ground-truth pattern
  (anti-pattern: detection-without-ground-truth-verification; Layer 3
  must NOT repeat this — its measurements come directly from
  systemctl, which is ground truth)
- `concept_UTA8pOt--Oi9` — dispatch-target instrumentation pattern
  (accumulated-audit-capability; Layer 3's first emission against a
  newly-bounded goal-host would itself be valuable signal)
- Local commits stacked behind ias-executor-ts publish: `8f1343c`,
  `01dfc54`, `402ecdd` — Layer 2 would join the stack
- Diagnose agent's static analysis output (transcript-only,
  unpushed): in `/tmp/claude-1000/<session>/tasks/aa5ab146c4d67c988.output`
