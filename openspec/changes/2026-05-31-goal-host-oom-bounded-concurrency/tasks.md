# Tasks — goal-host-vessel OOM bounded concurrency

Phases ordered by smallest-blast-radius first. Layer 1 (substrate-side
goal-host wrapper) unblocks observation; Layer 3 (detection template)
catches regressions; Layer 2 (framework fix) is the durable answer
once the ias-executor-ts publish path resolves.

## L1 — goal-host-side `BoundedBusSink` wrapper

- [ ] L1.1 Read `repos/goal-host-vessel/src/index.ts` end-to-end. Confirm
  the `busSink = new BusForwardingEventSink({...})` construction site
  (~line 78-83) and that nothing else references the bare `busSink`
  outside the `GoalHost` constructor.

- [ ] L1.2 Author `BoundedBusSink` class in the same file (close to
  the `busSink` construction). Wraps an inner `BusForwardingEventSink`
  and implements `emit(event)` with:
  - In-memory FIFO queue (max length 100)
  - Worker loop draining queue with `Promise.all` capped at
    `MAX_INFLIGHT` (default 32; env `BUS_MAX_INFLIGHT` override)
  - Backlog drop policy: when push to queue would exceed 100, drop
    the oldest entry first
  - Byte-budget guard: estimate bytes via `JSON.stringify(event).length`;
    skip the forward path when total in-flight estimated bytes > 50 MB
    (env `BUS_MAX_INFLIGHT_BYTES` override)
  - Stats line emitted every 30 s with `in_flight`, `dropped_since_last`,
    `bytes_in_flight`
  - Drops never throw; logs only

- [ ] L1.3 Wire `host = new GoalHost({eventSink: new BoundedBusSink({inner: busSink}), ...})`.

- [ ] L1.4 Add WS listener cleanup at reconnect point (line ~497).
  Current: `busWsClient = null` without closing. Add:
  ```ts
  if (busWsClient) {
    try { busWsClient.close(); } catch {}
    busWsClient = null;
  }
  ```
  immediately before the `setTimeout(connect, ...)` call.

- [ ] L1.5 `bun run typecheck` clean.

- [ ] L1.6 Sync to substrate-live: `docker cp src/index.ts
  substrate-live:/vessels/goal-host-vessel/src/index.ts` →
  `docker exec substrate-live systemctl restart goal-host-vessel.service`.

- [ ] L1.7 **Acceptance probe** (the 30-minute observation window):
  - Wait 30 minutes after deploy
  - `docker exec substrate-live journalctl -u goal-host-vessel
    --since "30 min ago" --no-pager | grep -E "Started|Stopped|killed"`
    — expect 0 restart entries
  - `docker exec substrate-live systemctl show goal-host-vessel.service
    -p MemoryCurrent` — expect MemoryCurrent < 2 GB
  - Inspect the periodic stats line: in_flight should plateau, not
    grow monotonically

- [ ] L1.8 **Live verification dispatch**:
  - `mcp__metabob__run_goal target_template_id=development-vessel:draft-gap-closing-activity`
    against a real scenario file
  - Should complete end-to-end within 60 s
  - Proves L1 + the F25 fix (b413a99 + 5cb2d59) compose correctly

## L3 — `detect-service-oom-cascade` detection template

Sized between L1 and L2 because the detector needs Layer 1's
stabilization to run cleanly itself.

- [ ] L3.1 Author `repos/development-vessel/src/resolvers/service-oom-cascade-scan.ts`.
  Resolver shape:
  ```ts
  async function scan(config) {
    const services = config.services ?? DEFAULT_SERVICES;
    const cache = await readCache("/workspace/.oom-detector/state.json");
    const findings = [];
    for (const svc of services) {
      const stats = await dockerExec(`systemctl show ${svc} -p ActiveEnterTimestamp,MemoryCurrent,NRestarts`);
      const parsed = parseSystemctlShow(stats);
      const prior = cache[svc];
      const delta = prior ? parsed.MemoryCurrent - prior.MemoryCurrent : 0;
      const restartsLastHour = prior ? parsed.NRestarts - (prior.NRestartsAtT - 3600s_ago) : 0;
      if (restartsLastHour > 3 || parsed.MemoryCurrent > 4e9 || delta > 500e6) {
        findings.push({svc, restartsLastHour, memoryMB: parsed.MemoryCurrent / 1e6, deltaMB: delta / 1e6});
      }
      cache[svc] = parsed;
    }
    await writeCache("/workspace/.oom-detector/state.json", cache);
    return findings;
  }
  ```

- [ ] L3.2 Author seed template `repos/development-vessel/src/seed/detect-service-oom-cascade.ts`.
  Single-task graph per immunity pattern:
  - `inputShapes: []`, `variables: []`, single server-side resolver
    task
  - Output shapes: `[substrateGap, serviceOomReport]`
  - One substrateGap per affected service via `substrateGap_write`
    direct REST POST (flat form per `concept_SypUVsRKP622`)

- [ ] L3.3 Wire shape registration in `src/config.ts` and dispatch
  case in `src/routes/impulses.ts` (the three-place rule). Add seed
  template to `src/seed/index.ts` SEED_TEMPLATES.

- [ ] L3.4 Per-template test
  `test/resolvers/service-oom-cascade-scan.test.ts` covering:
  - Mock systemctl-show output → parsed correctly
  - Above-threshold service → finding emitted
  - Below-threshold service → finding skipped
  - Empty cache (first run) → no false-positive findings

- [ ] L3.5 `bun run lint` + `bun run typecheck` clean.

- [ ] L3.6 Sync via `docker cp` of resolver + seed + config + routes
  (Makefile target doesn't cover `src/seed/` per `concept_QZoLiNrE2NkC`).
  Restart dev-vessel + re-seed templates.

- [ ] L3.7 **Acceptance probe**: `mcp__metabob__run_goal
  target_template_id=development-vessel:detect-service-oom-cascade`.
  - Post-L1: expect 0 substrateGaps emitted (healthy state)
  - If L1 regresses or another vessel cascades: expect 1+ gaps with
    structured `restartsLastHour` / `memoryMB` evidence
  - Re-dispatch 5 minutes later: cache-driven delta should be
    measurable (small positive delta during healthy operation)

- [ ] L3.8 Add `detect-service-oom-cascade` to boredom-vessel's goal
  rotation at a low-frequency slot (every 30 min, not every 5 min —
  the substrate doesn't need second-by-second OOM granularity).

## L2 — Framework fix (BLOCKED on ias-executor-ts publish path)

Layer 2 ports the BoundedBusSink semantics from L1 into the framework
`BusForwardingEventSink` so all future vessels inherit the
backpressure without re-implementing.

- [ ] L2.1 Patch `repos/ias-executor-ts/src/adapters/bus-forwarder.ts`
  with the bounded queue + worker drain.
- [ ] L2.2 Patch tests under `repos/ias-executor-ts/test/adapters/`
  covering: backlog drop, byte cap, in-flight cap, recovery after
  drain.
- [ ] L2.3 `bun run build` to regenerate dist.
- [ ] L2.4 BLOCKED: `git push` to `AviGopal/ias-executor-ts` returns
  "Repository not found". Coordinate publish path with operator.
- [ ] L2.5 Once published: bump consumer `package.json` versions in
  goal-host-vessel, development-vessel, ribosome-vessel,
  llm-resolver-vessel, local-tools-vessel. Remove L1's BoundedBusSink
  wrapper (becomes redundant).

## Substrate concept

- [ ] X.1 Mint `concept_response_pattern_oom_cascade`
  (vessel_construction_pattern) summarizing:
  - Root cause (per L1 acceptance: which hypothesis the in-flight
    Promise counter confirmed)
  - Fix shape (BoundedBusSink at L1; bus-forwarder.ts framework patch
    at L2)
  - Detection template shape (L3, immunity-pattern-compliant)
- [ ] X.2 Link `derived_from concept_9ldsmRgqSTd5`,
  `description_of concept_KAQEz-Xq5FwT` (same void-async pattern at a
  different layer), `related_to concept_Y2zGpFNBrcgb` (immunity
  pattern for L3).

## Done criteria

L1 fully shipped + verified (substrate observable for 30+ min, dispatch
verification passes). L3 ships + acceptance probe runs. L2 sits as a
follow-up tracked task with the publish-path block called out.
Substrate concept minted (X.1, X.2). The autonomous gap-consumer loop
is now observable end-to-end and the OOM detection class becomes a
substrate citizen.
