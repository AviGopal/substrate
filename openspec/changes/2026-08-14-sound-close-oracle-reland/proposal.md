# Sound the close-oracle: a re-landed commit is not condition-absent

**Date:** 2026-08-14
**Vessel:** development-vessel (`src/resolvers/gap-to-feature.ts`)
**Stage:** SPEC (investigation complete — hole localized, before-bracket measured)
**Lever:** Step 1 of the validation-integrity program (§12.6). The oracle is the gate on
everything downstream; trials/diversity/promotion all amplify whatever it certifies.

## Problem

Gap closure is certified by `verifyGapCondition` / `verifyGapConditionAsync`, whose
**Class 3 (landed-commit evidence)** returns `'absent'` whenever a non-reverted
substrate-authored commit *references the gap id* in the target vessel's history
(`git log --grep <gapId> --fixed-strings -1`). This treats a **producer-authored string**
(the commit message names the gap) as proof the condition is gone — the landed-sha-as-closure
violation §12.6 warns of ("measurement against the un-authorable referent", not a landed sha).

**Demonstrated live (before-bracket, this session):** gap `gap-env-gated-write-allowlist`
(condition: `WRITE_ALLOWLIST` read-and-unset at `fs-write.ts:27`) was "closed" by commit
`bafd83d`, which merely renamed the local `WRITE_ALLOWLIST` → `WRITE_ALLOWLIST_ENV` — leaving
`process.env["WRITE_ALLOWLIST"]` untouched, so the condition **still holds**. Class 3 returned
`'absent'` (a non-reverted commit names the gap), the sweep closed it `landed_verified`, and
the gap's own detector had already **re-detected and re-landed** it once before (`69d680b` at
05:39, `bafd83d` at 07:34 — **2 non-reverted commits** reference this gap).

The authors previously closed the *reverted*-commit sub-case (1283-1301) but not the
*inert re-landed* sub-case. And the Class-3 block is **duplicated in three sites**
(sync 1167, async 1255, pick-time 1403), one of which is neither vessel-scoped nor
revert-aware — the same duplication the authors were burned by (1170-1177: "a fix applied to
one site is not a fix").

## Why not abstain-on-unknown

Considered and rejected by measurement. Of 30 `landed_verified` closures, **0** carry a
surgical file+literal condition Class 1/2 can positively check (categories: `edit_intent_route`
15, `systematic_failure` 10, `architectural_pattern` 3). Flipping `unknown`→escalate would
route ~every landing-closure to the human — breaking autonomous closure and maximizing operator
load, the opposite of the end state. The hole is not unknown-fail-open; it is Class-3 counting a
single re-landed commit as absence.

## Change

Centralize Class 3 into one re-land-aware helper `landedCommitVerdict(gapId, editSite)` (using
the existing `vesselsCloneRoot()` + `shaWasRevertedInAnyClone()`), replacing the `-1` with a
**count of non-reverted commits** referencing the gap id in the target vessel:

- **0** → `null` (no landed evidence; caller falls through, unchanged)
- **1** → `'absent'` (first landing — benefit of the doubt; preserves current behavior, no flood)
- **≥2** → `'present'` (the gap landed, was **re-detected**, and re-landed → the prior landing did
  not resolve the condition → refuse close). Both callers already refuse close on `'present'`.

This certifies against the referent's *persistence signal* (re-detection) rather than a landed
sha, closes the demonstrated hole precisely, and does not flood: single-landing gaps still close.

## Scope (one change, one measurement)

In-scope: the three Class-3 sites only. Out-of-scope (separate increments): Site A goal-host
reach gate; the `e691e25e:3` reverted-pending limbo; escalation wiring (`uiQuestion_write` for
re-land — the *next* increment if the after-bracket shows re-composition churn).

## Verification (after-bracket)

- Per-resolver test: gap with 2 non-reverted commits → `verifyGapCondition` = `'present'`;
  gap with 1 → `'absent'`; 0 → `null`; a reverted commit does not count toward the ≥2.
- Live, after convergence: `gap-env-gated-write-allowlist` re-opens and does **not** re-close
  `landed_verified` on an inert re-land; `landed_verified`-on-re-land events/day → 0.
- Watch: escalation/re-composition churn (a spike means the condition-checker needs
  strengthening — the *next* increment, not evidence this one is wrong).
