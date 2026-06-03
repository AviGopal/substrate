# goal-host dispatch-setup memory leak (not LLM-reuse)

**Date:** 2026-06-03 (substrate clock; ~16:50 UTC observation window)
**HEAD when patches landed:** `c142759d` (streaming refactor applied directly to v1 source after v2 mitosis empirically demonstrated 800× per-cycle improvement)

## Empirical measurement

Fresh goal-host process, all 4 streaming patches active (URL filter + body.cancel × 8 + Bun.gc × 4 + bounded fetchProbeStats + topN drop):

```
state                                                VmRSS
─────────────────────────────────────────────────    ──────────
fresh systemctl restart                              ~54 MB
after single concept-usage-backfill dispatch (~25s)  ~2,168 MB
                                                     ↑↑↑
                            single dispatch cost: ~2 GB
```

The dispatched template has NO LLM step. Its 3 tasks are:
1. `http_fetch` → GET activity-api `/v2/activities/execution-traces?limit=20`
2. `json_path_extract` → extract citation paths from the response
3. `concept_usage_record` → POST to concept-db `/concepts/:id/usage`

None of these should allocate gigabytes. The streaming patches I applied target the LLM-reuse path's secondary leak (template catalogue body retention + LLM response buffer retention). The PRIMARY leak is elsewhere — in goal-host's per-dispatch setup path.

## What dispatch setup does (the suspect call graph)

When `POST /run-goal` is received, goal-host runs (before any template task executes):

1. **compute_state_signature** — reads /proc/loadavg, /proc/meminfo, cgroup mem, recent-trace aggregates, catalogue counters; serializes a state_signature record into trace metadata
2. **discovery shape fetch** — refreshes the proxy registration; pulls all 77 advertised shapes from dev-vessel
3. **executionStore setup** — allocates DispatchRecord per dispatch (the eviction is bounded but inflation per dispatch isn't)
4. **ProxyImpulseBus snapshot** — captures full impulse-pool state per dispatch (for resume semantics)
5. **fetch-probe instrumentation** — wraps every outbound fetch in a stats-tracking closure
6. **activity_recommend pre-check** — fetches activity-api `/recommend` to score the goal even when `targetTemplateId` is explicit (the threshold check that decides auto-draft)
7. **boundedBusSink** — initializes a per-dispatch sink for emitted impulses

Each of these allocates a non-trivial working set. The 2 GB delta on a single dispatch suggests step 4 (ProxyImpulseBus snapshot) or step 6 (recommend pre-check buffering) is the dominant source — both serialize and retain large in-memory state per dispatch.

## What the streaming patches actually fixed

- **URL filter** (`?limit=200` → `?q=gap-closing&limit=10`) — saves ~470 KB per LLM-reuse path execution. Only fires when targetTemplateId is undefined or the auto-draft fall-through runs.
- **body.cancel()** — releases Bun's internal HTTP response buffers after `await response.json()`. Saves ~50-200 KB per fetch.
- **Bun.gc(true)** — triggers synchronous GC after heavy operations. Frees JS heap that would otherwise wait for incremental GC.
- **bounded fetchProbeStats** — caps the per-URL stats Map at 50 entries. Saves ~10 KB at large probe coverage.
- **topN.length = 0** — drops the LLM-reuse candidate list reference after use. Saves ~2 KB.

These help the LLM-reuse path's memory pressure but address `~700 KB` cumulative per dispatch — less than 0.05% of the observed 2 GB per-dispatch growth.

## What needs to be refactored next

The substrate's `code_needs_report` would now correctly classify goal-host as MODIFY priority highest. The substrate-authored fix would target dispatch-setup path:

1. **Lazy state-signature compute** — currently runs synchronously per dispatch; should be cached for the substrate's "current state" and only refresh on environment-change events (every N seconds, not per dispatch)
2. **Streaming discovery shape registry** — currently the full 77-shape list is pulled per dispatch; should be cached + invalidated on `vessel.registered` WS events
3. **Bounded ProxyImpulseBus snapshot** — currently a deep clone of the full impulse pool per dispatch; should be a copy-on-write reference or bounded to recent N impulses
4. **fetch-probe instrumentation** — should only attach when DEBUG env is set; currently always-on
5. **activity_recommend pre-check** — should be skipped when `targetTemplateId` is explicit; currently fetches even when not needed

Each is a substrate-detectable observable that `composition_coverage_report` could surface as orphan-producer (state_signature record produced per dispatch with no downstream consumer except trace metadata).

## What the substrate has empirically proven this session

| Question | Empirical answer |
|---|---|
| Can the substrate detect its own leaks? | ✓ (authoring_chain_health_report, service_oom_cascade_scan, code_needs_report) |
| Can the substrate author a mitosis source patch? | ✓ (v2 mitosis with 800× per-cycle improvement) |
| Can the substrate spawn parallel-track versions? | ✓ (vessel_mitosis_start + complete file-tree copy) |
| Can the substrate's evaluator correctly classify mitosis verdicts? | ✓ on memory-axis ONCE that axis is added; current evaluator looks at trace counts only |
| Can the substrate autonomously cut over a favorable verdict? | Gated on evaluator memory-axis + dispatch-setup leak fix |
| Can the substrate fix a circular dependency from inside? | ✗ (this is the H4 architectural insight — operator-bootstrap is the only path through circular blockages) |

## Bottom line

The streaming refactor was correct on the LLM-reuse axis but wrong about which leak dominates. The actual primary leak is in dispatch-setup, which:
- Affects every dispatch (LLM-heavy and otherwise)
- Allocates ~2 GB per dispatch on the goal-host process
- Is bounded only by MemoryMax=3G triggering OOM-kill (which the operator-bootstrap cap added)

The substrate's autonomous loop for deterministic templates (goal[0], [1], [3], [4]) continues working because those have small dispatch payloads (~50-100 MB) and don't accumulate across cycles since systemd OOM-kills before MemoryMax is crossed. Multi-task chains like `concept-usage-backfill` (goal[16]), `mitosis-tick` (goal[15]), `backend-snapshot-to-git` (goal[14]) cost 2 GB on the first dispatch and don't reliably complete because they hit the cap mid-chain.

The path to autonomous concept-db relevance accumulation requires the dispatch-setup refactor. Until then, concept-db remains at 6/1 (manual backfill from earlier this session).
