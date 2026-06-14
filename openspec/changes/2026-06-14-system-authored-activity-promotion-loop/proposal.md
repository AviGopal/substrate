# Generalize the author→exercise→promote loop to ALL system-authored activities

## Why

We demonstrated (2026-06-14) the substrate **authoring a composable activity for
its own gap**: a curated `recurringPatternCluster` describing the concept-priming
alignment gap → `draft-activity-from-pattern` → `proposed_pattern_authored_prime_context`
(input `goalDescriptor` → output `conceptPromptPriors`, task `concept_select_for_prompt`).
It executes (4/4 success producing `conceptPromptPriors`). That proves "use the
system to build activities for gaps" and "send goals that describe gaps and have
them filled."

But the activity cannot complete the **learn-when-to-do-it** loop autonomously: it
gets authored but never exercised/promoted, because the loop special-cases
`gap-closing:` prefix. To align concept-db (and any capability) to the core
mechanism, the author→exercise→promote→applicable(s) loop must treat every
system-authored proposed activity identically.

## What changes (four interlocking gaps)

- **A. Generalize the exercise picker.** `boredom-vessel/src/index.ts:705-734`
  (goal[9]) only picks `gap-closing:` proposed templates to exercise and build
  the Thompson posterior. Generalize to ANY proposed authored activity so
  non-gap-closing capability (concept-prime, etc.) accrues evidence.
- **B. [IMPLEMENTED] Evidence from the trace store.** Reframed: the real cause is
  that DETERMINISTIC activities never get a vpm posterior (the UPDATE is skipped
  for degenerate posteriors, `posterior-update.ts:49-53`), and out-of-band execs
  under-credit vpm — so evidence-gated `auto-promote` could never graduate them.
  FIXED in `activities.ts` auto-promote handler: a trace-store evidence fallback
  (one `GROUP BY activity_id` aggregate, normalized id) that augments the vpm
  posterior when vpm samples < min_samples and the trace store carries more
  observations. Live-verified: graduated 62 previously-stuck activities including
  the system-authored concept-priming activity, which then appeared in
  discover-by-shapes (`applicable(s)`). LIVE on substrate-live (uncommitted /
  baked-image hot-deploy — needs commit + image rebake).
- **C. Fix the vpm join for underscore-heavy ids.** `auto-promote` normalizes
  `vpm_key` via `replace(/_/g, ':')` (`activities.ts:3501`); authored ids like
  `proposed_pattern_authored_prime_context` are all underscores → the join breaks.
  Use exact-id matching (or normalize both sides consistently).
- **D. Input-shape exercisability.** An authored activity declaring
  `input_shapes:[goalDescriptor]` fails standalone (precondition reject). For
  always-available priming, `input_shapes:[]` is correct (query is a variable);
  otherwise its input must be producible in the loop so backward-chaining can
  satisfy it. The curated cluster's `expected_inputs` should reflect this.

## Done when

- A system-authored, non-gap-closing activity (e.g. prime-context) is
  autonomously exercised, accrues vpm evidence, and `auto-promote` graduates it
  (`proposed: true → false`) so it enters `applicable(s)` for its output shape.
- Then composition-chain credit (`propagateCreditAlongChain`) learns WHEN to
  insert it — closing "the whole system learns when to do what" for all authored
  capability, concept management included.

## Already proven (no change needed)

- The system authors genuine composable activities from curated gaps (not
  scaffold-clones).
- `auto-promote` is already general over proposed templates (not prefix-scoped).
- Iterative gap refinement improves the authored output (v1 incomplete config →
  refined gap → v3 working config).
