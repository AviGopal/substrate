# `thompson_posterior` impulse shape

**Owner:** activity-api
**Resolver:** `POST /v2/impulses/resolve` (case `thompson_posterior` in `src/routes/impulses.ts`)
**Advertised via:** discovery-vessel (`config.ts` shapes block)
**Auth:** ApiKey, JWT — same as the rest of `/v2/impulses/resolve`
**Phase:** 9 of `2026-04-26-impulse-activity-loop`

## Why this shape exists

The α/β/sample_count posterior data already lives inside activity-api as an improvised REST surface (`variantMetricsSummary`, `GET /v2/activities/:id/variant-scores`). It just wasn't a routable shape, which made the implicit Thompson Sampling vessel an exception to the foundation's "data is reached through impulse → resolver dispatch" rule.

Promoting the posterior to a shape lets:
- selection resolvers (impulse-binding-selection-layer, exploration-slot-ucb-ranking) query α/β through the same path they use for everything else, without bouncing through REST
- workbench read posteriors via shape resolution where it currently uses REST
- discovery-vessel route posterior queries to activity-api without hardcoded knowledge of the URL path

The existing REST handler stays for backward compatibility — no behaviour change for callers of `GET /v2/activities/:id/variant-scores`.

## Pointer fields

```ts
type ThompsonPosteriorPointer = {
  type: "thompson_posterior";
  // The variant-level id post v1.8.0 normalization. Both names accepted so
  // legacy callers can keep using `activity_id`.
  activity_variant_id?: string;
  activity_id?: string;
  // Optional filter on (input_shapes, output_shapes) signature. When present,
  // restricts the posterior to executions whose first task's input/output
  // shapes match.
  shape_signature?: string;
  // Optional filter on goal-context bucketing (UCB-style stratification, used
  // by exploration-slot-ucb-ranking).
  context_bucket?: string;
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
    alpha: number;          // count(success=true) + 1 (Beta(1,1) prior)
    beta: number;           // count(success=false) + 1
    sample_count: number;   // total executions
    success_count: number;
    failure_count: number;
  };
};
```

The resolver returns the raw posterior — no confidence interval is computed server-side. Selection resolvers downstream apply their own decision rule (e.g. workbench computes the 95% CI from α/β client-side; UCB resolvers use the upper bound directly).

## Example

```bash
curl -sX POST https://activity.metabob.com/v2/impulses/resolve \
  -H "Authorization: ApiKey $API_KEY" \
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
      "alpha": 14,
      "beta": 3,
      "sample_count": 15,
      "success_count": 13,
      "failure_count": 2
    }
  }
}
```

## Signal confidence weight

Traces carry a `signal_confidence_weight: number` field (default `1.0`). This weight multiplies into the α/β update rather than treating every observation as equally trustworthy:

- `weight = 1.0` — in-substrate default under a shared trust root. Full credit or penalty applied.
- `weight < 1.0` — the observation is down-weighted. Example sources: a vessel with lower attestation strength; a cross-substrate trace that lacks full corroboration; an execution whose verifier confidence was marginal.
- `weight = 0.0` — observation is present in the trace store (for audit) but contributes nothing to the posterior.

The formula for a success observation becomes `alpha += weight` instead of `alpha += 1`. For failures, `beta += weight`. This field is the substrate's hook for all future confidence-related machinery — attestation strength (H2), cross-substrate federation, oracle-corpus calibration — without requiring schema changes to the posterior model itself.

## Cost-weighted selection

The Thompson selection rule is evolving from "maximize marginal α" to "maximize marginal α per dollar". The current Beta posteriors model `P(success | activity)`. The direction is a joint posterior over (success, cost) — a knapsack bandit formulation.

Activities with high α but high cost are structurally different from activities with the same α at low cost. Under local substrate development where infrastructure cost is near zero, per-activity LLM API spend becomes the dominant variable. The selection layer learns the cost distribution alongside the success distribution: each execution records `cost_usd`, and the recommendation path will sample from a (success_rate, expected_cost) joint to favour cheaper activities when their success probability is statistically indistinguishable from a more expensive alternative.

This does not change the posterior schema — `alpha`, `beta`, `sample_count` remain — but adds a parallel cost distribution (mean, variance) per variant that the selection rule weights against the Thompson sample.

## LLM model sub-resolvers

LLM-tier resolvers are on a path to advertising per-model sub-resolver identifiers: `llmText@haiku`, `llmText@sonnet`, `llmText@opus` (and equivalent per-provider variants when configured). Each sub-resolver accrues its own α/β posterior, cost distribution, and resolver-tier metadata. Traces already record which model was used; the sub-resolver identifier makes that fact a first-class Thompson key.

This enables the substrate to learn model-to-problem-class mappings rather than using a single hardcoded model for all LLM tasks. Routine resolvers — keyword extraction, simple format validation, template slot filling — converge to cheaper models as their posteriors accumulate. Novel resolvers — decomposition, compliance checking, cross-domain reasoning — converge to more capable ones because cheaper models fail more often and accumulate β faster.

These are ordinary resolver variants that happen to differ by model; the selection mechanism is identical to activity variant selection. No new infrastructure is required — sub-resolver ids are strings in the existing `resolver_id` field.

## Multi-tenant scoping

The query uses `accountIdScopedWhere()` from `src/routes/activities.ts`, so the posterior is scoped to the caller's `(account_id || org_id)` per the standard dual-tenant pattern. Cross-tenant posterior leakage is not possible.

## Versioning

This shape was added in activity-api 1.16.0 (Phase 9 of `2026-04-26-impulse-activity-loop`). Prior to 1.16.0, the only way to read per-variant posteriors was the REST endpoint `GET /v2/activities/:id/variant-scores` (which still exists; nothing has been deprecated).
