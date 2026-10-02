## Context (measured 2026-09-27)

- The landing branch is the literal `"dev"` at every layer (cutover :1916, :2045, :2056/2060,
  :2444, :2471/2477; admission pre-check gap-to-feature :1562). The autonomous/directed trigger
  does not reach the cutover (`isDirected` exists only in feature-compose :3748).
- A branch push today would leak onto live: step 9 mirrors into node 1's `/vessels` on any
  `pushed`; the land-time runtime sync is only rolled back when nothing was pushed; pull-sync's
  divergence self-heal pushes `HEAD:$BRANCH`; the non-fast-forward retry rebases onto
  `origin/dev` and falls back to a host-sync intent that pushes to dev.
- Verification reads the live tree: Class 1/1b read `/vessels`, Class 3 and the sweep's
  ancestor check read clone HEADs, Class 2 and behavioural verification query the running fleet.
  A branch-only landing could never verify from the dev node.
- `gateLanding` sees remote URL and branch, not paths. `push-policy.json` is node-local.
- Admissible work: 61 of 2,340 open gaps have an edit site and a class1/class2 falsifier; ~53 are
  workable (development-vessel 29, goal-host 24).
- 97% of open gaps are not fixable as filed; the gap-class posterior has α = 1 on essentially
  every class; landing → verified closure converted at ~5% on 2026-09-24.

## Decisions

1. **Containment by scope first, by branch later.** Branch landing needs ~12 edits across the
   landing core plus a verification rewrite, on the path every repair must land through; its
   first failure mode is the lane refusing its own repair (the 2026-09-24 deadlock class). Scope
   containment is one shape and two readers, reversible by editing a record.
2. **`autonomyScope` is a pool shape read through discovery**, like `spendEnvelope`, not a
   push-policy field: push-policy is a node-local file and the scope must bind every node.
   Body: `{excluded_paths: string[] (repo-relative prefixes), reason}`. No record → no scope
   (behaviour unchanged). Unreadable after a record was seen → autonomous work refused.
3. **Two readers, cheapest first.** Admission (gap-to-feature, autonomous path only) refuses a
   gap whose edit site is excluded, before drafting. The compose verdict (feature-compose, the
   final authority on touched paths) withholds FAVORABLE when `!isDirected` and any applied op
   touched an excluded path; an unknown trigger counts as autonomous.
4. **Branch landing waits for the node that runs the branch.** Class 1/2 verification needs a
   runtime running the branch, so ref-aware landing and verification belong to stage 2.
5. **Shapes, not env, configure nodes.** pull-sync's convergence ref is read from a shape (it
   already reads `maintenanceLease` over HTTP); `BRANCH` env remains only a bootstrap fallback.
6. **Promotion is an activity**, never an operator approval; its grade is durability (law 7).
7. **Crystallization is measured, never seeded**: ribosome extraction and reuse on system-filed
   work, with the 2026-09-18 proof's measures.

## Refused patterns (and the law each would break)

Copying volumes into a sandbox (11: forks learning state); operator-approved promotion
(operator load-bearing); a flag or env var enabling autonomy (1); operator-written templates or
seeded posteriors for the demonstration (4); new code gates on the critical path (1, 2);
operator exact-edit goals as the demonstration workload (13).

## Risks

- Scope too wide starves autonomy of work: the excluded list is exactly the lane core; the
  admissible count under scope is measured before reopening.
- Scope does not stop a bad commit on the periphery: 3.5 (all-edits floor), 2.2 (actionable
  only), the envelope and the breaker still apply, and pull-sync reverts are unchanged.
- Posterior bias (α = 1): reuse is measured on templates/variants, not the gap-class file,
  until 5.5 lands on the autonomy node.
