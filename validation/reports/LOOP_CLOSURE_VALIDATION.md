# Loop closure: a goal through the human surface whose credit persisted

## What was broken

The trace-list default window was `now - 30d` on a table holding 473k rows spanning
TWENTY-FIVE days. The predicate excluded zero rows, so every request materialised the
whole `v_paradigm_execution_traces` view into a sort before applying LIMIT (SurrealDB
2.3.3 `MemoryOrderedLimit`). All 8 DB workers pinned at ~96% with 0.0% iowait, query
latency 30s, and the substrate's own learning writes timed out and were lost.

**The failure mode is the point.** The guard did not break, throw, or log. It crossed a
threshold — somewhere between 111k and 473k rows — after which it was a no-op that still
read as protection, with its own comment asserting a bound it no longer provided.

## Measured recovery (process start postdates the fix; not inferred)

| | before | after |
|---|---|---|
| surrealdb self-reported latency | 30263 ms | 23 ms |
| surreal CPU | 780% | 125% |
| load | 12.64 | 1.93 |
| activity-api restarts | ~7/hr | 1 per 30 min |
| hub `/health` from operator box | timeout @35s | 200 in 0.167s |

## The validated chain

Dispatch `60b0c5c7` — "Report the total number of distinct impulse shapes currently
advertised in the discovery registry" — entered through the human surface at :18310 on a
federated spoke with `activity-api` masked locally, so credit could only land on the hub.

1. reached, `deterministic:verified-registry-count`, answer `318`
2. HAND-GRADED VALID. 318 is this spoke's own registry count (`/registry/shapes`
   confirms). The 385 in the pre-capture is the federated union (local + hub, deduped);
   the hub alone reports 382. All three numbers are real and answer different questions.
3. credit `dAlpha:2` on `satisfier:shellResult`
4. PERSISTED — `satisfier:shellResult` does not appear in any
   `posterior_delta_dropped_no_row` line over 6h. Negative control: the string occurs 204
   times in the same corpus, so its absence from drop lines is signal, not a failed grep.

## Two findings this validation produced

### 1. The deterministic fast path's verifier is self-confirming

The walk log states the field was "chosen by the same rule the verifier applies", while
the reach reason claims it "independently queried" the registry. Both cannot hold. The
producer and verifier share the field-choice rule and hit the same endpoint, so the check
confirms the answer is what the rule produces — never that the rule chose the right field.

This is the shape of the `shapes/vessels` false reach graded by hand on 2026-08-17, which
took alpha+2 for the wrong field. THIS GATE COULD NOT HAVE CAUGHT THAT. It passed here
because the field choice happened to be correct, which is luck, not verification.

### 2. Posterior deltas are being dropped on live arms

23 dropped in 6h across `ribosome-extract` (11), `auth_resolve_v1` (11), and one
composition. A zero-row UPDATE returns empty rather than throwing, so the delta was
neither applied nor re-queued. Those arms are executing and learning nothing. The loss was
invisible until the drop counter was added; it is now countable.

## Also found

`human-surface-vessel` is `manifest: true`, and `apply-inventory`'s `manageable_units()`
skips manifest entries entirely — so its `role: ui` membership in the spoke group is real
but INERT. No boot path installs it; it exists only after a separate `vessel-ctl install`.
The surface requires an undocumented manual step after every boot.
