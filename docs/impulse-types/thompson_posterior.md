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

## Multi-tenant scoping

The query uses `accountIdScopedWhere()` from `src/routes/activities.ts`, so the posterior is scoped to the caller's `(account_id || org_id)` per the standard dual-tenant pattern. Cross-tenant posterior leakage is not possible.

## Versioning

This shape was added in activity-api 1.16.0 (Phase 9 of `2026-04-26-impulse-activity-loop`). Prior to 1.16.0, the only way to read per-variant posteriors was the REST endpoint `GET /v2/activities/:id/variant-scores` (which still exists; nothing has been deprecated).
