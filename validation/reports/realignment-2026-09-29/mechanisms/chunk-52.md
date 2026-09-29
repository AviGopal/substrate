# Mechanisms, chunk 52: relevance-sink-vessel

Input: `classes/_mech_chunks/52.json`, which holds 1 record: "relevance-sink-vessel (plain dir)", source git-super-1.
Evidence was collected read-only on 2026-09-29 from `substrate-live` (hub) and `compose2-live` (node 2).

## Dedupe

There is nothing to dedupe inside the chunk. Across chunks, the same mechanism appears three more times:
- as the `impulseRelevancePenalty_write` shape;
- as `writeImpulseRelevancePenalty` in `activity-api/src/lib/posterior-update.ts:519`;
- as the "legacy /penalty REST route" inside the vessel itself (`index.ts`, `handlePenalty`).

All of these are one mechanism: a single `UPDATE impulse_relevance_metrics SET times_failed += 1`.

## Verdict

| Mechanism | Verdict | Used now | Target |
|---|---|---|---|
| relevance-sink-vessel (`impulseRelevancePenalty_write`) | **broken → merge-into** | **no**. It is called, but it has never landed an observable write | activity-api's existing per-impulse relevance write (`routes/activities.ts:9452–9614`, `utils/impulse-relevancy.ts`) |

## Live evidence

1. **It runs, and its health check is honest.** `relevance-sink-vessel.service` has been active on the hub since 09-26 07:43 with `NRestarts=0`. `/health` returns `{"status":"ok"}` and now round-trips `RETURN 1` to the store. The earlier `/health` was unconditional (`index.ts:111`); `d42910bc` (09-16) made it honest after the 09-15 wiring proof. On node 2 the unit is `inactive`, which is correct: the hub owns the store (node2-runtime.md:23).
2. **Discovery registration is failing.** The journal shows `discovery register error: Unable to connect` at boot on 09-26, then `discovery register failed: 401` on 09-28 02:39, and nothing after that. The one caller does not go through discovery anyway. `posterior-update.ts:517` pins `process.env.RELEVANCE_SINK_ENDPOINT ?? "http://127.0.0.1:8255"`, which breaks two rules: route by shape, and no env-pinned peers (classes endpoint-routing and env-gating). The registry row is absolute and `unverified` (live-resolvers.md:46).
3. **The write is fire-and-forget, and errors are swallowed.** The call is `fetch(...).catch(() => {})` (posterior-update.ts:539–545). It is invoked only on `verifier_negative` or null failure mode (`:1326–1335`). So a failure leaves nothing in the caller's log. The sink's journal also shows **no request lines in the last 24h**.
4. **Zero rows show the effect.** `SELECT count() FROM impulse_relevance_metrics WHERE times_failed > 0` returns **0 of 20,720 rows**, for all time. Over the last day, 133 rows have `times_execution_failed > 0`, so executions are failing and the table is being written. The negative is **not attributed**, because no positive control has been run through the same address, and a positive control would be a write, which this pass could not do. Three explanations fit the evidence:
   - the fetch fails silently;
   - `task.input_impulse_ids` never matches `impulse_id` keys such as `replay:exec_…`;
   - the verifier-failure branch never fires.
   The collector's earlier note, "264/264 penalty writes failing", points the same way.
5. **No code reads the field it writes (hollow_write).** In the live clones, `times_failed` is read only for `tool_argument_pattern` (`activities.ts:9917–10991`). No reader of `impulse_relevance_metrics.times_failed` exists in `activity-api/src/utils/impulse-relevancy.ts`, `routes/impulses.ts`, `ias-executor-ts` or `goal-host-vessel`. Impulse relevance is computed from `times_execution_failed`, `times_loaded` and similar fields, which activity-api already writes itself in `activities.ts:9544/9614`. So even a working sink would add a signal that nothing reads, and that duplicates `times_execution_failed`.
6. **It is outside the authoring loop, and that has cost a lot.** It is a plain directory in the super-repo, not a submodule. `/workspace/git/vessels/` has no `relevance-sink-vessel` clone, while `human-surface-vessel` has since been bootstrapped there. The runtime-drift tick logs it as "NOT COVERED". Its super-repo history:
   - `bc480aa1`/`cf533a9b` (06-20): first feature_compose-authored vessel
   - `c0a61d47` (06-29): the image never copied it
   - `875c9d33`: shaped resolve
   - `6067c25b`: tsc gate
   - `d42910bc` (09-16): committed by the operator under the substrate author name. It then went through a 10,501-byte double-apply corruption loop, the `e76b88c` rollback defect, which was fixed in `88032ab`.

   The gap store today (`/workspace/git/super-repo/gaps/gaps.json`) has **26 gaps that mention it: 12 open and 14 closed**. The open ones are a cluster of self-reproducing variants:
   - `self-fact-divergence-authoring-root-relevance-sink-vessel-clone` and its `-narrowed`, `-step-1` and `-step-2` variants;
   - two `recommit-…-syntax_break` gaps and one `recommit-…-anchor_not_found` gap (09-27 to 09-29);
   - `route-edit-7a536fc9` and `route-edit-ad9fd19a`;
   - `three-fleet-vessels-are-plain-files-…` (09-22).

   The C33 transcript notes that this gap was "reopened 23 times, 6 false lands credited".

## Why merge rather than repair

The substrate has spent weeks on two things: making this directory authorable, and chasing its clone divergence. That is the recurrence failure: the same issue keeps returning for the same reason. What the vessel does is a single-statement UPDATE. The field it updates has no reader, and the data it touches lives in the same SurrealDB that activity-api already writes to for this exact table. Data locality (law 11) gives no reason for a separate vessel: both are on the hub, and node 2 masks the sink. The decoupling it was built for ("decoupled from activity-api trace store", commit bc480aa1) protected nothing, because activity-api still writes `impulse_relevance_metrics` directly.

## Disposition

- **Keep the capability, merge its home.** Make "a verifier-negative outcome penalises the impulses that fed it" one field in activity-api's existing per-impulse relevance write (`activities.ts:9544`). Give it a named reader in `utils/impulse-relevancy.ts`. Otherwise it stays hollow, so the reader has to be cited before anything counts as done.
- **Discoverability after the merge:** the behaviour is reached through activity-api's own registration and its trace store. No separate shape is needed. If the shape `impulseRelevancePenalty_write` is kept for callers, activity-api should advertise it in its registration and serve it through `/v2/impulses/resolve`. Drop the env-pinned endpoint.
- **Archive:** `repos/relevance-sink-vessel/` together with `scripts/substrate/units/relevance-sink-vessel.service`, to `docs/archive/fossils/relevance-sink-vessel/`, or kept only in git history. The same commit should remove it from the image COPY, from the unit list and from runtime-drift "not coverable".
- **Gap disposition:** the 12 open relevance-sink authoring and divergence gaps should close as `superseded_by_merge`, not as landed. Also keep the class-level gap `three-fleet-vessels-are-plain-files-…` open for `clock-vessel`: plain-file vessels can still be created, and nothing detects that. That gap is what should generate the fix.
- **Before merging, run the falsifier:** POST one verifier-negative trace whose `input_impulse_ids` match a known `impulse_relevance_metrics.impulse_id`, then check that `times_failed` goes up. This tells us whether the negative in point 4 came from routing or from the key join. The key join has to be fixed in the merged version anyway.
