# Cross-vessel wiring repair: the decomposition the composer lacks

**Date:** 2026-08-29
**Vessels:** development-vessel (`feature-compose.ts`, `gap-to-feature.ts`), goal-host-vessel
**Stage:** SPEC — the procedure was executed by hand on 2026-08-29 and is specified here from that run
**Lever:** the best-supported explanation of `orphaned_capability` at **346 attempts / 0 lands**

## Problem

A wiring defect is **inherently multi-surface**: a producer writes in one vessel, an intended
consumer reads in another, and the two disagree about key, tree, file or window. The composer is
**single-file by design** — CLAUDE.md states plainly that "multi-file asks drop parts silently."

So the system structurally cannot repair its own wiring defects. That is a better explanation of
346 attempts with zero lands than incapacity, and it is testable: every wiring repair verified this
session required an ordered pair of changes in two repositories.

Three instances, all repaired by hand, all two-sided:

| defect | producer side | consumer side |
|---|---|---|
| reuse lineage unstorable | goal-host transmits `reused_from_*` | activity-api route + schema + migration 204 |
| escalation answers unreadable | stateful-ui writes `panel_id` | dev-vessel `solicitation_outcome_scan` |
| cutover freshness | staging records base from runtime tree | cutover commits into the push clone |

## Why the obvious decomposition fails

Splitting into "add the receiving field" then "send it" makes step one an unreachable write-only
addition. The reachability gate refuses exactly that, and correctly — it rejected such a split three
times this session with *"a write-only hollow addition; wire it, export it for a real consumer, or
drop it."* The gate is right; the decomposition is wrong.

The ordering constraint is real and asymmetric: **sender-before-receiver destroys data.** Measured —
a reused walk sending `parent_*` to a receiver that asserted CC1 did not merely lose the lineage, it
lost the whole goal-path record with a 400.

## Change

A **cross-vessel repair** composition: an ordered pair of single-file changes with a deploy gate
between them, and a degradation path so the window between them is safe.

1. **Receiver first.** Land the accepting side — field, route, schema, and the `DEFINE FIELD`
   migration if the table is SCHEMAFULL. Verified by a round-trip test at the *consumer*, not the
   producer: `POST → 200 → GET → field present`.
2. **Deploy gate.** Do not proceed on `origin/dev`. Proceed on the **running** copy: artifact
   present in `/vessels/<v>` and `MainPID` moved. Pull-sync lags 10–20 minutes and reports
   `Result=success` while skipping vessels — observed doing exactly that this session.
3. **Sender second**, carrying a **retry that drops the new fields once** on a non-ok response, so
   deploy skew loses the field rather than the record.
4. **Verify by consequence at the consumer**, with both failure modes pinned separately:
   *accepted but not stored* (SCHEMAFULL silently drops undefined fields — how `walk_tier` was null
   on every row until migration 181) and *stored but not returned* (a response schema strips unknown
   keys). A test of the request schema alone passes under both and is therefore not the test.

## Scope

**In scope:** the repair shape, its ordering, the deploy gate, the degradation retry, the
verification standard.

**Out of scope:** relaxing the reachability gate (it is correct); the composer's single-file limit
itself (this composes around it rather than removing it); automatic detection of which side is the
producer — the orphan scan's `candidate_consumers` (added 2026-08-29) is the input to that and is a
separate increment.

## Verification

- One two-vessel wiring repair lands through the system with the deploy gate observed between
  halves, and no operator hands on either commit.
- `orphaned_capability` records a land — the category's first, against 346 attempts.
- Counter-check: a deliberately mis-ordered run (sender first, against an old receiver) loses the
  field and **not** the record, proving the degradation path.

## Provenance

Executed by hand on 2026-08-29 for reuse lineage: activity-api `4e0d27a` (receiver, migration 204,
round-trip test) → deploy gate observed on the running copy → goal-host `d45aa3d` (sender, with the
drop-once retry) → verified at the consumer. This document specifies that run as a capability rather
than leaving it as an operator habit — which is the point, since an operator habit is precisely what
law 6 says should become substrate structure.
