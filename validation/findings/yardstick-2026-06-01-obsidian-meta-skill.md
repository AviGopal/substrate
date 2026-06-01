# Yardstick — operator-fan-out vs substrate's own drafter on detect-recurring-pattern

**Date:** 2026-06-01
**Operator hypothesis:** Phase 2's `draft-activity-from-pattern` template plus the
permissive-scope invariants enable the substrate to author activities equivalent to
what the operator-fan-out just produced.
**Test:** dispatch the substrate's actual drafter against a hand-curated
`recurringPatternCluster` describing `detect-recurring-pattern`, the Phase 3
template that operator-fan-out shipped at `repos/development-vessel/src/seed/detect-recurring-pattern.ts`.
**Result:** Substrate's drafter **failed at task 3 of 8** with no `failure_mode`
populated. The meta-skill the Phase 2 commits claim to encode is not currently
reachable end-to-end on the running substrate.

## Yardstick comparison

| Metric | Operator-fan-out (commit `be4cd9d`) | Substrate's own drafter (exec_ewrxfjth) |
|---|---|---|
| Template produced | `DETECT_RECURRING_PATTERN_TEMPLATE` (5 tasks, 7 KB) | None |
| Tests passing | 8/8 | n/a — never ran |
| Trace status | n/a (compile-time work) | `failure` after 510 ms, 2 of 8 tasks completed |
| `failure_mode` recorded | n/a | `{}` (empty — silent failure) |
| Comprehensibility score | unmeasured | n/a |
| Thompson posterior movement | none | none |
| `loadAttribution` row | none | none |

## Trace evidence

Drafter execution `exec_ewrxfjth`:
- task 1 `prime_vocabulary` (`http_fetch` activity-api): **success**, 272 ms, output `dev:http_fetch_nrwrcvad` carrying `activityVocabulary`
- task 2 `prime_concepts` (`http_fetch` concept-db): **success**, 160 ms, output `dev:http_fetch_6jfujkzo` carrying `substrateConceptIndex`
- task 3 `prune_vocabulary` (`llm_completion_dispatch`): **never started**
- tasks 4–8: **never reached**

Total wall-clock: 510 ms. The 78 ms gap between task 2 completing and the trace
status reaching `failure` is consistent with the engine binding task 3's variables
and dispatching the resolver, then receiving an error response that wasn't translated
into a `failure_mode`.

## Root cause (two compounded issues, both substrate-side)

**Issue 1 — llm-resolver-vessel discovery heartbeat starvation.** When I first probed
`llm-resolver-vessel`'s journal, it had failed discovery heartbeats **480 consecutive
times** over the prior eight hours:

```
Jun 01 09:34:54  [DiscoveryRegistrationLoop] heartbeat HTTP 404 (failure #478)
Jun 01 09:34:54  [VesselDaemon:llm-resolver-vessel] discovery heartbeat failed 3×; vessel may be unreachable
```

The vessel was running and answering on `127.0.0.1:8220` but discovery-vessel did
not have an entry for it. Restarting `llm-resolver-vessel.service` re-registered it
cleanly. Why heartbeats failed for 8 hours uninterrupted is its own substrate-citizen
question — the substrate should have had a `service_oom_cascade_scan`-style detector
emit a `substrateGap` for any vessel whose heartbeat failure count exceeded a threshold.
There is no such detector today; the silent-degradation was invisible until manually
probed.

**Issue 2 — `llm_completion_dispatch` body-format contract mismatch.** After restart,
a direct probe of `llm-resolver-vessel`'s `POST /resolve` endpoint showed it expects
the request body with `prompt` at the top level alongside `impulse.pointer.type`:

```bash
# Works:
curl POST /resolve --data '{"impulse":{"pointer":{"type":"llm_completion"}},"prompt":"...","model":"...","max_tokens":20}'
# {"resolved":true,"shape":"llmCompletion","content":"OK","usage":{...}}

# Fails:
curl POST /resolve --data '{"impulse":{"pointer":{"type":"llm_completion","prompt":"...","model":"...","max_tokens":20}}}'
# {"resolved":false,"shape":"llmCompletion","error":"Request body must include a non-empty 'prompt' string field"}
```

But `repos/development-vessel/src/resolvers/llm-completion-dispatch.ts` constructs the
second form. The dev-vessel resolver and the llm-resolver-vessel disagree on where the
`prompt` field lives. The drafter — and probably every other template that uses
`llm_completion_dispatch` — silently fails its LLM tasks.

This mismatch isn't fresh. It explains a class of "completed=success but output empty"
traces that the existing `phantom_trace_scan` likely already counts as phantoms when
trace-side accounting catches them.

## What the yardstick reveals about the recursive principle

The user's stated guidance going into this iteration was *"use this implementation as
a yardstick and get substrate's version."* The substrate's version did not arrive.
Three substrate-citizen observations emerge from the attempt:

1. **The implementation I shipped through operator-fan-out is unfalsifiable by the
   substrate today.** The fan-out produced code that passes lint and tests. The
   substrate's drafter cannot produce a comparable output, so the fan-out's
   "this is what the meta-skill would author" claim has no substrate-side check.
2. **The substrate has degraded silently across at least two surfaces** (the
   8-hour heartbeat starvation and the body-format mismatch) and the existing
   substrate-self-detection family did not catch either. Both are within scope of
   the principle — heartbeat starvation is structurally identical to
   `service_oom_cascade_scan`'s cascade signature; format mismatch is the same
   class as F13 ghost-success but routed through a different layer.
3. **Phase 2 shipped without a transfer-test pre-flight.** The transfer test in
   the umbrella spec says the substrate must author an activity whose Thompson
   posterior beats uniform-random. The substrate didn't even reach `draft_via_llm`.
   That outcome should have been observable from the boredom-cycle smoke test
   the operator-fan-out version did not run before declaring done.

## What "the substrate's version" requires before this test can actually run

In the order needed:

1. Fix `llm-resolver-vessel` discovery-heartbeat reliability. Either the vessel
   reuses a stale `vessel_id` after restart that discovery rejects, or there is
   an auth issue invisible from outside. The 404 response code suggests a
   `vessel_id` lookup miss on discovery's side, not auth.
2. Fix the `llm_completion_dispatch` body-format mismatch. Either move the
   `prompt`/`model`/`max_tokens` to the body root in the dev-vessel resolver, or
   change the llm-resolver-vessel to read them from `pointer`. The minimal change
   is whichever is referenced by fewer callers.
3. Add a substrate-citizen detector for *vessel-heartbeat starvation*. The existing
   `service_oom_cascade_scan` watches `MemoryCurrent`; the sibling watches
   `DiscoveryRegistrationLoop` failure count and emits `substrateGap` after N
   consecutive failures. This is a one-resolver addition that would have surfaced
   today's degradation as a substrate gap on the previous boredom cycle.
4. Add a substrate-citizen detector for *trace-level silent task failures* —
   traces where a task did not run but `failure_mode` is `{}`. This is its own
   class of phantom that `phantom_trace_scan` does not currently catch because
   the trace's *task count* is non-zero (2 of 8); it's only the *successor task*
   that didn't fire.

Only after (1) and (2) ship can the yardstick comparison actually be made. Until
then the operator-fan-out is the entire delivery and the meta-skill remains a
hypothesis. The Phase 2 acceptance criterion ("substrate authors at least one
activity from a Phase 1 episode cluster") has not been demonstrated against
running substrate; it was only demonstrated against `bun test`.

## Status

- Operator-fan-out implementation: durable on `origin/dev` at `9bfe3e07`.
- Substrate's version: blocked on the two operational issues above.
- This finding committed to validation/findings/ for the next cycle to consume.
