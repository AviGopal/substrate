## 0. Facts (done 2026-09-27)

- [x] 0.1 Landing branch, trigger at landing, leak paths, verification reads, node convergence
  (design.md Context).

## 1. Stage 1: scope containment

- [ ] 1.1 development-vessel: `autonomyScope` reader (discovery over poolImpulse, newest record,
  30 s cache, fail closed only after a record was seen), exported beside `spendEnvelopeAllows`.
- [ ] 1.2 Admission (autonomous path) refuses an excluded edit site before drafting,
  `stage:autonomy_scope`.
- [ ] 1.3 feature-compose verdict floor: not directed (unknown counts as autonomous) and any
  applied op on an excluded path → withhold FAVORABLE.
- [ ] 1.4 Write the `autonomyScope` record (lane-core list) and measure admissible work under it.
- [ ] 1.5 Falsifier: an autonomous pick on an excluded file refuses at admission with no plan
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
