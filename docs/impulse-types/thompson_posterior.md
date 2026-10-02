# `thompson_posterior` impulse shape

**Owner:** activity-api
**Resolver:** `POST /v2/impulses/resolve` (case `thompson_posterior` in `src/routes/impulses.ts`)
**Advertised via:** discovery-vessel (`config.ts` shapes block)
**Auth:** ApiKey, JWT — same as the rest of `/v2/impulses/resolve`

## Why this shape exists

The α/β/sample_count posterior data lives inside activity-api, and before this shape existed the only way to read it was an improvised REST surface (`variantMetricsSummary`, `GET /v2/activities/:id/variant-scores`). It was not a routable shape, which made the implicit Thompson Sampling vessel an exception to the foundation's "data is reached through impulse → resolver dispatch" rule.

Promoting the posterior to a shape lets:
- selection resolvers (the impulse-binding selection layer, exploration-slot UCB ranking) query α/β through the same path they use for everything else, without bouncing through REST
- surfaces like workbench read posteriors via shape resolution rather than REST
- discovery-vessel route posterior queries to activity-api without hardcoded knowledge of the URL path

The REST handler stays for backward compatibility — no behaviour change for callers of `GET /v2/activities/:id/variant-scores`.

## Pointer fields

```ts
type ThompsonPosteriorPointer = {
  type: "thompson_posterior";
  // The variant-level id. Both names accepted so callers can pass either the
  // historical `activity_id` or the newer `activity_variant_id`.
  activity_variant_id?: string;
  activity_id?: string;
  // Optional filter on (input_shapes, output_shapes) signature.
  shape_signature?: string;
  // Optional filter on goal-context bucketing (UCB-style stratification, used
  // by exploration-slot UCB ranking).
  context_bucket?: string;
  // Signature schema version to read against. Defaults to 1.
  signature_version?: number;
};
```

Either `activity_variant_id` or `activity_id` is required (the resolver accepts whichever name is set).

## Response payload

```ts
type ThompsonPosteriorResponse = {
  loaded: true;
  metadata: {
    activity_variant_id: string;
    shape_signature?: string;
    context_bucket?: string;
  };
  content: {
    activity_variant_id: string;
    alpha: number;          // accumulated posterior α (a float, not a row count)
    beta: number;           // accumulated posterior β
    sample_count: number;   // total executions
    success_count: number;
    failure_count: number;
    signature: string | null;      // the signature filtered, or null when aggregate
    signatures_aggregated: number; // distinct signatures rolled into the answer
    signature_version: number;
    scope: "account" | "org" | "global"; // which fallback path returned the data
  };
};
```

**The posterior is read, never recounted.** `alpha` and `beta` come from the same durable store the selector samples: `context_thompson_scores` when `context_bucket` is set, otherwise `variant_performance_metrics` — org or account scope first, falling back to the global baseline row, with `scope` reporting which one answered. A `count(success) + 1` recount over the `execution` table would ignore the chain-credit fan-out and the decay deltas applied when outcomes land, and would therefore diverge from the α/β the loop actually learns. A posterior resolver that disagrees with the selector is a lying instrument, so this one reads the same rows.

There is no durable per-signature posterior table. A signature-scoped read therefore aggregates at the variant level and reports how many distinct signatures contributed via `signatures_aggregated` — the honest reading is "α aggregated over N signatures", which is what lets a caller tell α=42 under one signature from α=42 averaged over twelve.

The resolver returns the raw posterior — no confidence interval is computed server-side. Selection resolvers downstream apply their own decision rule (a UI computes the 95% CI from α/β client-side; UCB resolvers use the upper bound directly).

## Example

```bash
curl -sX POST "$METABOB_ENDPOINT/v2/impulses/resolve" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "pointer": {
      "type": "thompson_posterior",
      "activity_variant_id": "fix-bug-complete"
    }
  }'
```

Response:

```json
{
  "success": true,
  "content": {
    "loaded": true,
    "metadata": { "activity_variant_id": "fix-bug-complete" },
    "content": {
      "activity_variant_id": "fix-bug-complete",
      "alpha": 14.2,
      "beta": 3.1,
      "sample_count": 15,
      "success_count": 13,
      "failure_count": 2,
      "signature": null,
      "signatures_aggregated": 3,
      "signature_version": 1,
      "scope": "org"
    }
  }
}
```

## Time decay

**The posterior is not an unbounded accumulator.** Counts decay toward the neutral prior `1` with an exponential half-life, so a variant that succeeded steadily a month ago and has not run since converges back to Beta(1,1) rather than defending a stale lead against a newer arm. `decayedThompsonCounts` in `repos/activity-api/src/lib/posterior-update.ts` is the function:

```
alpha' = 1 + (alpha - 1) * 0.5 ^ (elapsed / halfLife)
beta'  = 1 + (beta  - 1) * 0.5 ^ (elapsed / halfLife)
```

`elapsed` is clamped at zero, so a `last_updated_at` in the future decays nothing rather than amplifying.

Decay is applied in two places. On the **write** path the same expression runs in SQL, so a variant's stored counts are decayed by their staleness before the new delta is added — an old lead is discounted at the moment the next outcome lands. On the **selection** path the recommend query decays each candidate row at read time, which is what lets a posterior poisoned during a transient outage heal even though it is never selected and therefore never re-written. A row with no usable timestamp is left untouched rather than blindly zeroed.

**The half-life is resolved at use time, not frozen at process start.** `resolveThompsonDecayHalfLifeDays` reads the `THOMPSON_DECAY_HALFLIFE_DAYS` row from the `substrate_tuning_param` table (behind a short in-process cache), defaulting to 3 days. It passes **no env fallback**, deliberately: decay is runtime behaviour the substrate must be able to steer without a restart, and a process-start-frozen variable would be invisible to traces and unlearnable. A non-finite or non-positive value falls back to the default with a warning rather than corrupting the posterior.

The practical consequence for a reader of this shape: α/β are a decayed accumulation, not a lifetime tally, and a variant with a long-ago winning streak does not defend a strong posterior forever. This resolver returns the stored counts as they are, without applying a further read-time decay, so what it reports is the value as of the variant's last update — which is the same value the write path will discount when the next outcome arrives. A caller that wants the selection-time view should decay by row staleness itself, the way the recommend path does.

## Multi-tenant scoping

The query uses `accountIdScopedWhere()`, exported from `src/routes/activities.ts`, so the posterior is scoped to the caller's `(account_id || org_id)` per the standard dual-tenant pattern. The global-baseline fallback matches only rows with no `org_id` at all, so cross-tenant posterior leakage is not possible.

## Design directions, not behaviour

The following are recorded here because they shape how the posterior model is expected to grow. **None of them is implemented** — no vessel source carries any of these symbols. Do not write code that assumes them.

**Confidence-weighted observations (design).** A per-trace confidence weight would multiply into the α/β update — `alpha += weight` instead of `alpha += 1` — so that a marginally-verified or weakly-attested observation contributes less than a fully corroborated one, and a weight of zero leaves an observation in the trace store for audit while contributing nothing to the posterior. This is the natural hook for attestation strength, cross-substrate federation and oracle-corpus calibration. No such field exists on traces.

**Cost-weighted selection (design).** The selection rule would move from "maximize marginal α" to "maximize marginal α per dollar" — a joint posterior over (success, cost) rather than the current `P(success | activity)`. Activities with high α at high cost are structurally different from activities with the same α cheaply, and once infrastructure cost is near zero, per-activity model spend dominates. Executions already record `cost_usd`, so the missing piece is a parallel cost distribution per variant that the selection rule weights against the Thompson sample. The posterior schema would not change.

**Per-model sub-resolvers (design).** LLM-tier resolvers would advertise per-model identifiers, each accruing its own α/β posterior and cost distribution, making "which model" a first-class Thompson key rather than a fact buried in the trace. That would let routine work — keyword extraction, format validation, slot filling — converge to cheaper models while novel work converges to more capable ones, because cheaper models fail more often and accumulate β faster. Mechanically these would be ordinary resolver variants distinguished by their `resolver_id` string, so no new infrastructure is implied.

## Compatibility

The REST endpoint `GET /v2/activities/:id/variant-scores` predates this shape, still exists, and is not deprecated. `variantMetricsSummary` remains the cross-variant aggregate; `thompson_posterior` is the variant-precise read.
