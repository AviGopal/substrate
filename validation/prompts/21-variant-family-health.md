# Prompt 21: Variant family health — Thompson differentiation check

This prompt verifies that activity variant families exist, that their Thompson Sampling priors are meaningfully differentiated, and that the learning loop is not stuck at uniform initial priors.

**What to verify:**
- `load_impulse({"type": "variantMetricsSummary"})` routes to activity-api via vessel discovery
- At least one template family has ≥2 variants with distinct α/β values
- `[Impulse] Resolved via vessel discovery` appears in stderr for the metrics shape
- The written report contains real variant IDs from the backend (not placeholders)

---

You are auditing the Thompson Sampling state of the activity registry. Your goal is to find a variant family with meaningful differentiation — evidence that the learning loop has actually updated priors beyond the uniform starting point.

## Step 1 — Fetch variant metrics

Use `load_impulse` with pointer `{"type": "variantMetricsSummary"}` to retrieve Thompson Sampling state for all tracked template families.

You MUST use `load_impulse` for this step — do NOT use bash, curl, or any direct HTTP call. The `variantMetricsSummary` shape is owned by activity-api and resolved through vessel discovery.

If `variantMetricsSummary` is not available or returns empty, try `load_impulse({"type": "activityTemplatesByMetrics", "limit": 30})` as an alternative — it also carries per-template α/β fields.

## Step 2 — Identify a variant family with ≥2 members

From the returned data, look for templates that share a common root template id or family grouping. A variant family is a set of templates derived from the same base (they typically share a name prefix or a `parent_template_id` / `root_template_id` field).

Pick the family that has:
- At least 2 variants (members)
- At least one variant with `sample_count > 0` (it has actually been executed)

If multiple qualifying families exist, choose the one with the most variants.

## Step 3 — Check differentiation

For the chosen family, compute for each variant:
- `alpha` (α) — successes + 1 (or the raw field if named differently)
- `beta` (β) — failures + 1
- `sample_count` — total executions
- `expected_value` = α / (α + β)
- `thompson_sample` — if present in the data, record it; otherwise compute expected_value

Determine:
- Are all variants identical (same α, same β)? If so, the family is **undifferentiated** — the learning loop has not yet acted on this family.
- Do at least two variants differ by any amount in α or β? If so, the family is **differentiated**.

## Step 4 — Write /workspace/family-report.md

Write a markdown file at `/workspace/family-report.md` containing:

### Section 1: Family Overview
- Root template id (or family identifier)
- Number of variants found
- Total combined sample_count across the family

### Section 2: Variant Table
A table with columns: `variant_id | alpha | beta | sample_count | expected_value | is_leading`

Mark the variant with the highest expected_value as `is_leading = yes`.

### Section 3: Differentiation Verdict
State clearly:
- `DIFFERENTIATED` if at least two variants have different α or β values
- `UNDIFFERENTIATED` if all variants share identical α and β (still at the prior)
- The specific α/β values that differ (or confirm they are identical)
- Which variant currently has the highest Thompson expected value

### Section 4: Data Source
Confirm that all data was retrieved via `load_impulse`, not bash or curl. Record which shape type was used (`variantMetricsSummary` or `activityTemplatesByMetrics`).

## Acceptance criteria

1. `/workspace/family-report.md` exists and contains real variant IDs from the backend (IDs must not be placeholders like `<variant_id>`)
2. At least one family is identified with ≥2 variants
3. The report states whether the family is DIFFERENTIATED or UNDIFFERENTIATED with specific α/β values for each variant
4. `[Impulse] Resolved via vessel discovery` appears in stderr for the metrics shape fetch
