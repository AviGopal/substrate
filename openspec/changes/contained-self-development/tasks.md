## 0. Facts (done 2026-09-27)

- [x] 0.1 Landing branch, trigger at landing, leak paths, verification reads, node convergence
  (design.md Context).

## 1. Stage 1: scope containment

- [x] 1.1 LANDED `c110070` (08:38:51, BYTE-EQUAL; goal goals/1.1-1.2-…txt). development-vessel: `autonomyScope` reader (discovery over poolImpulse, newest record,
  30 s cache, fail closed only after a record was seen), exported beside `spendEnvelopeAllows`.
- [x] 1.2 LANDED with 1.1. Admission (autonomous path) refuses an excluded edit site before drafting,
  `stage:autonomy_scope`.
- [x] 1.3 LANDED `c27964b` (08:42:33, BYTE-EQUAL). feature-compose verdict floor: not directed (unknown counts as autonomous) and any
  applied op on an excluded path → withhold FAVORABLE.
- [x] 1.4 WRITTEN 08:43 (pool id `autonomy-scope`, 21 lane-core paths: compose, cutover, pull-cutover, push policy, git push, gap admission, gap store writer, apply-proposal, pool, lease, conductor, router, dev-vessel index/config, goal-host index, posterior update, llm-resolver index, boredom index, discovery/, identity/, scripts/substrate/). Measured on a copy of the live store with the live admission code: 542 of 2,340 open gaps refused `autonomy_scope` (goal-host index 195, feature-compose 105, cutover 78, gap-to-feature 77, …); 164 admitted. Write the `autonomyScope` record (lane-core list) and measure admissible work under it.
- [x] 1.5 PASSED 08:49: admission probe above (scope readable, 21 paths, 542 refusals, no plan call); synthetic undirected exact-edit compose on feature-compose.ts (land:false) → `[feature-compose] autonomy-scope floor: WITHHELD FAVORABLE`, verdict UNFAVORABLE, rolled_back true, runtime file clean, no commit; directed composes on the same files landed all day. Falsifier: an autonomous pick on an excluded file refuses at admission with no plan
  call; a directed goal on the same file lands; a synthetic autonomous compose straying onto an
  excluded file is withheld.

## 2. Reopen under containment (user approval)

- [ ] 2.1 Envelope ≈ $1/h; release the node-1 lease; the Documentation session releases node 2.
- [ ] 2.2 Observe 24–48 h. Pre-registered: autonomous drafted landing 30–50 % (bar 40 %), 1–3
  verified closures/day (bar 5), landing→closure conversion reported; demonstration parts 1–3
  measured; the 2.8/3.5/5.2 falsifiers of value-per-cost-selection read.

## 3. Stage 2: autonomy node (user decision)

- [ ] 3.1 Container (compute profile; bundled with value-per-cost 4.0's P220 publication).
- [ ] 3.2 Convergence ref read from a shape by pull-sync; `setup-git-push` honours it.
- [ ] 3.3 Move `autonomous_pick` ownership to the node; un-defer value-per-cost 5.5 (ii)/(iii).
- [ ] 3.4 Branch landing: trigger threaded to the cutover, ref-parameterised push/rebase/fetch,
  no mirror or host-sync fallback for non-dev targets, clone reset after a branch push.
- [ ] 3.5 Ref-aware verification: `pending_outcome_ref`, ancestor check against `origin/<ref>`,
  Class 1/1b via `git show <sha>:<path>`, Class 2 and behavioural checks delegated to the node.

## 4. Promotion

- [ ] 4.1 Evidence shape and promotion activity; durability grading.
- [ ] 4.2 Falsifier: the first autonomously authored commit promoted to `origin/dev` with no
  operator action.

## 5. Demonstration and debt

- [ ] 5.1 Demonstration parts 4–5 on the autonomy node (adaptation, variant exploration).
- [ ] 5.2 Convert code gates to activities (admission order, envelope read, breaker, verbatim
  edits, closure credit), through the lane, off the critical path.
