# F-083 Debunked — UPSERT CONTENT is Template Registration, Not Thompson Posteriors

**Status**: CLOSED (false alarm). Do not re-open without new evidence.

**Original claim**: `UPSERT activity:${activityId} CONTENT {...}` at lines 1200 and 5268 of
`/vessels/activity-api/src/routes/activities.ts` is the unfixed F-069 bug that resets
Thompson posteriors on every template registration.

**Why this is wrong**:

The F-069 bug was specifically in `variant_performance_metrics` table updates, which were
using `UPSERT...CONTENT` (full row replacement, wiping accumulated α/β) instead of
`UPSERT...SET` (partial update, preserving existing fields).

Lines 1200 and 5268 are in **different code paths** targeting the **`activity` table**:
- Line 1200: Template registration path — `UPSERT activity:${activityId} CONTENT {...}` —
  this is the full activity template record (name, description, tasks, input/output shapes).
  Full replacement is CORRECT here: when re-seeding a template, you want the latest version
  to overwrite the stored definition entirely.
- Line 5268: Improvised template creation — same pattern, same rationale.

The **F-069 fix** (commit c1364e4) changed `variant_performance_metrics` table updates
from `UPSERT...CONTENT` to `UPSERT...SET`. Evidence of fix in container:
- Line 1249: `UPSERT variant_performance_metrics:... SET`
- Line 1269: `UPSERT variant_performance_metrics:... SET`
- Line 5291: `UPSERT variant_performance_metrics:... SET`

**Verification** (2026-05-25, confirmed multiple times):
```bash
docker exec substrate-live grep -n 'variant_performance_metrics.*SET' /vessels/activity-api/src/routes/activities.ts
# Output: 1249, 1269, 5291 — all use SET (not CONTENT)

docker exec substrate-live grep -n 'variant_performance_metrics.*CONTENT' /vessels/activity-api/src/routes/activities.ts
# Output: (empty) — no CONTENT upserts on variant_performance_metrics
```

**Audit agent confusion**: The audit greps for `UPSERT activity.*CONTENT` and finds the
template-registration pattern at lines 1200/5268. But these operate on `activity:${id}`
(activity templates), not `variant_performance_metrics:${id}` (Thompson posteriors).
These are different tables with different semantics. The grep pattern is too broad.

**Correct audit grep**:
```bash
docker exec substrate-live grep -n 'variant_performance_metrics.*CONTENT' /vessels/activity-api/src/routes/activities.ts
# Expected: empty (no results) — confirms F-069 fix is deployed
```

**Thompson posteriors are safe**: α for validator-dispatch has been growing monotonically
(from ~3500 at investigation-020 to ~4184 at investigation-027). If CONTENT replacement
were occurring, α would reset to 1 on every restart. The monotonic growth is proof the fix works.
