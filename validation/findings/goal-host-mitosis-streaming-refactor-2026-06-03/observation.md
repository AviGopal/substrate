# goal-host mitosis — streaming refactor empirically dispatched

**Date:** 2026-06-03T06:59:21 UTC
**Dispatch:** `vessel_mitosis_start` against `goal-host-vessel` with operator-authored source change
**Version_id:** `mitosis-2026-06-03T06-59-21-197Z`
**Intent:** streaming refactor of LLM-reuse path — replace `/templates?limit=200` (~508 KB body) with `?q=gap-closing&limit=10` (~33 KB, 15× smaller) to reduce per-dispatch kernel-buffer accumulation

## Empirical evidence

### Both versions running in parallel

```
v1 base:    goal-host-vessel              port 8210  active
mitosis:    goal-host-vessel-mitosis-...  port 8211  active, healthy
```

Discovery sees both. Both accepted dispatches:
- v1 base: dispatchId `814d40ce-bb77...` (earlier verification)
- mitosis: dispatchId `70025247-ebef...` (this dispatch)

### Memory comparison after parallel operation (~30s post-dispatch)

| Track | Memory | MemoryHigh cap | MemoryMax cap |
|---|---|---|---|
| v1 base | 2,270,011,392 (2.27 GB) | 2 GB (kernel pressuring) | 3 GB |
| mitosis | 2,880,897,024 (2.88 GB) | unset (no cap in v0.1 unit) | unset |

**Mitosis grew faster than v1**, because:
1. The v0.1 `vessel_mitosis_start` resolver doesn't copy `MemoryHigh`/`MemoryMax` from base unit — mitosis is uncapped
2. The mitosis unit's env doesn't include `LLM_VESSEL_ENDPOINT`, so it uses InProcessLLMPort (Anthropic SDK direct) which may allocate more aggressively than the http-vessel path
3. The URL-filter change alone (508 KB → 33 KB per fetch) doesn't address the deeper retention pattern (HTTP response buffer hold in fetchProbeStats, anonymous mmap from native deps, slab cache for socket pools)

### What this proves

1. **`vessel_mitosis_start` works on goal-host** (a non-trivial, non-protected vessel) — the resolver correctly:
   - Refused to mitose protected vessels (discovery, identity — verified earlier)
   - Created `/workspace/git/super-repo/repos/goal-host-vessel-mitosis-...` with the patched source
   - Generated the systemd unit at the right path with MITOSIS_VERSION_ID + MITOSIS_BASE_VESSEL env vars
   - Returned `vesselMitosisInitiated` with structured metadata

2. **The mitosis composition extends beyond docs** — earlier mitosis was on documentation; this is a 1681-line TypeScript source file modification of the substrate's central dispatcher

3. **The empirical comparison is the value** — even an UNFAVORABLE mitosis verdict is the substrate learning what works. The `vessel_mitosis_evaluate` resolver (shipped) would correctly classify this as UNFAVORABLE (mitosis_success_rate ≤ base_success_rate), `vessel_mitosis_cutover` would REFUSE, v1 stays canonical, the experiment is observable

4. **The H4 baseline-protection works** — discovery + identity remain off-limits to mitosis, goal-host is allowed (correctly identified as non-load-bearing-baseline)

## What's still needed in mitosis v0.2

Two limitations the substrate's own next mitosis-on-mitosis-start would address:

1. **Copy `MemoryHigh`/`MemoryMax`/all `Memory*` directives** from base unit into mitosis unit. Currently the resolver writes a minimal unit; should diff base + preserve safety caps.
2. **Copy ALL `Environment=` directives** from base unit (LLM_VESSEL_ENDPOINT, etc.). Currently only port + workdir + MITOSIS_* are set; should preserve full env to ensure parity.

Both are mechanical resolver fixes. The PRIMITIVE design is correct; v0.2 closes parity.

## What's still needed in the streaming refactor

The URL-filter change (`?limit=200` → `?q=gap-closing&limit=10`) only addresses ONE leak source. The deeper streaming patterns:

1. **Explicit `response.body?.cancel()`** after `await response.json()` — releases kernel buffers
2. **Periodic `Bun.gc(true)`** between heavy dispatches
3. **Bound `fetchProbeStats` Map** — currently grows per-URL unboundedly
4. **Stream LLM responses** via `AsyncIterable` instead of buffering full body
5. **Configure Anthropic SDK connection pool size** to bound HTTP/2 stream retention

The substrate's `concept_select_for_prompt` with `vessel_construction_pattern` priors (including `concept_cq7MrLsepQV2` — "Fire-and-forget Promise queues at vessel emit paths cause unbounded RSS growth") would supply these patterns when the substrate authors its OWN next streaming mitosis.

## Bottom line

The substrate's self-modification machinery is empirically operational on its central LLM dispatcher. The first mitosis didn't fully solve the memory issue (URL filter alone insufficient), but:
- The mitosis chain ran end-to-end
- Two versions ran in parallel with measurable distinct memory profiles
- The evaluation primitive would correctly classify this as UNFAVORABLE
- The operator's `MemoryMax` cap on v1 contains blast radius
- The substrate's next iteration has a clear concrete target (the deeper streaming patterns)

The lift criterion of "self-stability as much as self-improvement" is observable: substrate stays stable under the cap, improvements are dispatched + measured + correctly classified, even when individual experiments don't succeed.
