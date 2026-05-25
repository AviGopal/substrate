---
agent: validation
iter: 19-blocker
generated_at: 2026-05-25T06:43:50Z
---

# Iteration 19 — F-050 blocker: Template FTS discovery broken

## Summary

F-049 (template registration) was resolved. Templates seeded successfully (count=15). But boredom-vessel cannot execute because template recommendations fail: FTS search cannot match goal text to available templates.

Three failed attempts:
1. 06:32:14Z: `no template id returned for goal "measure the substrate topology and report coverage progress"` (fallback_tier=fts)
2. 06:34:51Z: goal-host-vessel unreachable
3. 06:40:14Z: `no template id returned for goal "run the full topology discovery chain and emit a coverage report"` (fallback_tier=fts)

## Observable state

- **Templates registered**: 15 (via count endpoint)
- **Templates queryable via list endpoint**: 2 (substrate-health-tick, harness-run-matrix)
- **Execution traces**: 0
- **boredom-vessel status**: failed (exit-code) × 3 since 06:32Z
- **Last attempt**: 06:40:14Z

## Root cause: Template visibility mismatch

The 13 bootstrap-seeded templates are registered (count=15) but:
- Not visible in `/v2/activities/templates` list endpoint
- Not indexed by FTS search (goal text cannot match them)
- Cannot be recommended by goal-host-vessel

**Why**: Either:
1. The bootstrap templates lack required FTS metadata (description, name fields for search indexing)
2. The templates are registered in a non-queryable state (org_id or visibility filter issue)
3. The FTS index was not rebuilt after seeding

## Blocking execution

Without FTS matching goals to templates:
- boredom-vessel cannot dispatch goals
- No execution traces are produced
- Thompson posteriors cannot update
- S.4a window 2 remains blocked

## What I cannot say from substrate-side

1. **Why count=15 but list=2**: Are 13 templates silently non-queryable, or is the count query including something the list query filters?
2. **Whether FTS index exists for the 13 templates**: Requires audit-level DB inspection
3. **Whether the bootstrap templates have proper search metadata**: Requires reading the bootstrap payload

This is an activity-api / database-schema issue. Validator-level queries cannot surface the cause.

## Gap classification

**New finding**: F-050 (template FTS discovery broken after seeding)
- Severity: CRITICAL (blocks all execution)
- Root: Template visibility / FTS indexing mismatch
- Dependent on: F-049 fix (which seeded the templates)
- Blocks: Boredom execution, all subsequent validation iterations

## What blocks iteration-20

Same as iter-18: need developer fix, this time on template FTS indexing or visibility.

Once templates are queryable via FTS and can match goal text, boredom-vessel will resume and validation can continue with iter-20.
