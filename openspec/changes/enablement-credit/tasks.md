# Tasks

Each task is one commit (one concern), reviewed by qa against concept_8q0HcehfQLij and the design section it names.
Every MUST-FAIL is proven red on the parent or on a named mutant, and every body cites concept_8q0HcehfQLij. Every
removed branch gets a REMOVAL line in its commit body:
- `refusedOver`;
- the ungraded duplicate;
- the person-r1 rule;
- `gapClosures`.

The order keeps each step safe on its own: measurement first, debits before the holds go, and the closure path before
`gapClosures` is retired.

## 0. Before any of it

- [ ] 0.1 The per-tick timing on the selection row (agf_4ozotydifpdj, concept_LvR-iNAvIjwp) lands first (design §11).
      Then the fold is timed at D = 12 (design §11), then task 1.
- [ ] 0.2 Widen/tighten check: the database fork counts live owner `requires` rows on each node by `for`. Any row whose
      `for` names a produce target starts to bite once task 7.2 extends the requires rule to produces. Each one is
      listed with what it tightens, in task 7.2's body.
- [x] 0.3 The USER confirmed three things before the tasks that depend on them (all yes):
      - person-ask roots are drawn by their decayed history too (design §3; before task 4);
      - asks are re-observed only by a person's verdict, never by re-running change_wanted (design §5);
      - templates are offered by enablement (`offer_at` = 2 closures on different roots) instead of a person's r 1
        (design §6, before task 6).
      The USER also confirmed that a lapse on a person's ask counts r 0 against that ask's root, and granted the
      local-tools exception for task 5.2 (the check in its own network namespace, conditions a–f, no host fallback),
      for that one change only.

## 1. Consumption edges, travelling credit (records; design §1)

- [ ] 1.1 Owner `credits` row for target `selection`: w_close, w_person, w_lapse, γ, D. Seeder writes them; the fixture judges
      the row.
- [ ] 1.2 `fold.ts`:
      - the consumption edges (a)–(e);
      - credit originating only at a closure observation, a person's verdict, or a lapse (at w_lapse); described
        outcomes originate nothing;
      - a backward breadth-first walk crediting each reached selection once, at the shortest path;
      - ending earns nothing.
      This replaces the `pool_refs` presence chain in `grades()`. Before install: the fold is timed at D = 12 on a
      hub-sized copy, off the hub's host (design §11), and the time goes in the body.
      The body also carries:
      - a REMOVAL line for described outcomes as originations, with every consumer of their credit found by resolved
        references (fold posteriors, earned(), the tally and its reports, any surface view);
      - the database fork's split of today's standing grades (described / person / lapse) and person verdicts per day.
- [ ] 1.3 Must-fails:
      - an unconsumed produce earns nothing;
      - a context row not in `uses` passes nothing;
      - a cell whose calls always end and are never consumed keeps its prior mean;
      - a described r 1 originates nothing; a lapse originates r 0 at w_lapse; git_land still meets on land_verdict r 1;
      - a diamond credits the shared ancestor once;
      - weight at depth k; nothing past D.
      Mutants: the presence chain, credit for ending, credit per path, and described restored as a grader.

## 2. Schemas name what a produce used (walk-owner-seed, described-shape; design §1 (b))

**Order: task 2 installs before task 1.2, or with it.** On a node's store today every origination credits depth 0
only (77 of 77, the longest consumption chain 2, no row with `uses`). Produces consume only rows no selection made
(an ask, a gap), and nothing consumes a hop except through `uses`. So 1.2 without task 2 leaves every step before
the answer at its prior. `uses` appears only on rows produced after task 2 installs: historical originations stay at
depth 0.

**The producer writes this part of the credit graph.** `uses` is the only edge that carries credit back past an answer,
and the producer that names it is often a model. The x-shown check (2.2) stops it naming a row it never saw. It does
not stop it naming everything it saw, which would be presence again. The watch is 8.1's share of shown rows named in
`uses`, per target. Trigger: when a target's median share is 0.9 or more over a week, the database fork's weekly 8.1
read files the gap (no detector is built for it: that is a gap of its own, law 6).

- [ ] 2.1 Owner schemas for request, answer and land_verdict gain `uses`: an array of row ids held to the rows shown
      (`x-shown`).
- [ ] 2.2 Must-fail: `uses` naming a row not shown is refused by schema.

## 3. Superseded-unconsumed debit (records; design §2)

- [ ] 3.1 `fold.ts`: a produced row superseded on its root while unconsumed gives r 0 at weight 1 to its producer's
      cell, once.
- [ ] 3.2 Must-fails: debit once if superseded unconsumed; none if consumed first.

## 4. Holds removed, root drawn by its history (walk + records; design §2, §3)

- [ ] 4.1 Records POSTERIOR answers per-root posteriors, decayed by h from the owner `credits` row for target `root`:
      - success: once per origination reaching the root, undiscounted;
      - failure: each root selection no origination reached once it is superseded, debited or older than
        `unreached_after_s`, plus debits.
      Selection rows carry `root`.
- [ ] 4.2 Walk `choose()`: Thompson over root posteriors, then the move as today.
- [ ] 4.3 Walk `pending()`: remove `refusedOver`. **Not installed before the stale-test fact (agf_b6a2e6slqshv):** a
      gap whose check a correct source change cannot pass carries a fact the walk reads, and its change calls are not
      offered. Today the refusal hold is the only thing that stops the walk from going back to a stale-test gap's
      source (a secret-read seam among them). Remove it without the fact, and the walk returns there. Keep the ungraded-duplicate rule only for targets that an owner
      `shape_description` gives `words` (shown to a person); remove it for every other target.
- [ ] 4.4 Must-fails:
      - an always-refused single option draws at a falling rate, never 0, never parks;
      - 1 vs 10 options with equal history draw at equal rates (4000 seeds, 3σ);
      - a root of ended-but-unconsumed moves is drawn less than one with a closure;
      - a 2-step and a 12-step close give equal root means;
      - the B11 simulation: a 12-step chain reaches git_land within 120 ticks in ≥ 95 of 100 seeds;
      - an unchanged ungraded answer is not re-produced, while a gap root's request produce is;
      - h is read from the row.
      Mutants: the uniform pick, and `refusedOver` restored.

## 5. The closure move (local-tools, records, walk-owner-seed; design §4, §5)

- [ ] 5.1 local-tools `git_commit` stamps a fixed committer identity on every walk commit. Must-fail: a commit made by
      git_commit carries it.
- [ ] 5.2 local-tools `gap_recheck` (pointer `{call_id}`), answering `gapObservation`:
      - gapCheck at `base` and at `commit`;
      - on-branch and ancestry checks;
      - `not_reproduced` when the check passes at `base`;
      - the check's files untouched over `base..commit`;
      - `commit` = the chain's git_commit hop sha, and the committer.
      The test list comes from the gap's latest detector row filed by the generator (agf_jmgp5bxlgco6's condition).
      runCheck runs every check in a network namespace of its own, as the shell user with no readable key. That
      covers both gap_recheck and git_diff's pre-land check. Conditions (qa, B10):
      - a. Its own loopback is up: must-pass, a test that serves and connects on 127.0.0.1 inside the check passes.
        Must-fail: a connection to records' or discovery's port writes nothing.
      - b. Dependencies are installed before the namespace is entered; only the test runs inside it.
      - c. Before install, the full local-tools suite runs at its current head in the new namespace on the node the walk runs on and
        stays green apart from the known baseline names. Any test that needs the network is listed in the body
        (git_diff's check must not change red/green except by intent).
      - d. Unix sockets are not isolated by a network namespace: the assumption and its reader are stated. Must-fail:
        a write attempted through a socket path writes nothing.
      - e. A local-tools push: it needs the USER's per-push lt exception.
      - f. It is proven to work inside the container as the shell user (an unprivileged network namespace may be
        refused there). If it cannot be entered, the check is not_runnable and the change stops: there is never a
        fallback to the host network.
      git_land's answer carries `base` (added if it does not).
- [ ] 5.3a Writer inventory (C1): every current writer of `hop`, `selection` and `failure`, found by resolved
      references (the walk, records' own writes, any detector or pull-sync, test fixtures), each shown to carry the
      role the refusal accepts. It goes in 5.3's body; a writer that does not carry it is changed first.
- [ ] 5.3 Records refuses `hop`, `selection`, `failure`, `gapObservation` and `stability` from any write that
      does not carry the walk's (for `stability`, records' own) declared role, beside the owner-shape write rules. A
      forwarded write carries none (535a503). The fold reads an observation only from a gap_recheck call's ended hop.
      Before this lands, the database fork confirms that no live writer other than the walk writes those shapes (a
      widen/tighten check), and the result goes in the body.
- [ ] 5.4 Owner requires row for `gap_recheck`; schema and shape description for `gapObservation`.
- [ ] 5.5 `fold.ts`: the observation's credit (design §5), counted once per `(call_id, commit)`, with the repeat debit.
      `gapClosures` is retired in the same commit. Its body lists every reader of `gapClosures` and of what it fed
      (fold, the tally and its reports, any surface view, pull-sync), found by resolving references, not by name.
- [ ] 5.6 Must-fails:
      - one per row of the §4 table;
      - a two-commit land with the fix in commit 1 is credited;
      - five rechecks of one landing credit once;
      - a forged `gapObservation` through record_write is refused, and one without a gap_recheck hop is not read;
      - a forged started/ended hop pair and selection with an all-true answer, through a forwarded write, are refused;
      - `not_runnable` and `not_reproduced` credit nothing;
      - a test that tries a record_write, or a loopback connection, from inside the check writes nothing and credits
        nothing. Mutant: the host network.
- Asks are **not** re-observed by model (design §5). There is no task for change_wanted re-runs.

## 6. Templates offered by enablement (records; design §6)

- [ ] 6.1 `earned()`: travelling credit on the replayed selections ≥ `offer_at` (owner `credits` row for target
      `activity_template`), replacing the person-r1 rule.
- [ ] 6.2 Must-fails: offered by two closures on different roots with no person grade; one closure is not enough; a
      chain of 20 ended calls is not offered.
      Mutant: the person-r1 rule.

## 7. Stability row and its readers (records, walk, walk-owner-seed, pull-sync; design §7)

- [ ] 7.1 Records writes `stability` per window (`window_s` from the owner `credits` row for target `stability`):
      `cells_reached` counts only depth ≥ 1 travelling credit.
- [ ] 7.2 The walk's requires rule extends to produces, and `meets()` gains `x-max-age-s`. Owner requires row for
      `activity_template` on fresh `keeps_up`. The body lists task 0.2's live rows and what each tightens.
- [ ] 7.3 pull-sync detector: a gap when the latest stability row is older than two windows.
- [ ] 7.4 Must-fails:
      - `keeps_up` false, true-and-fresh, or true-and-stale decides the template produce;
      - a stability row through record_write is refused;
      - depth-0 credit and debits are not counted;
      - a stale row files the gap.

## 8. By-effect checks after install (database fork; no code)

- [ ] 8.1 After 1–3: cells reached by travelling credit per day rises from zero. Produce cells' means are reported
      weekly, to see that the superseded-unconsumed debit (weight 1) does not drive produce cells to the floor while
      Thompson re-picks them before their consumer runs. The share of shown rows each target's produces name in
      `uses` is reported weekly too (C3: a producer naming everything it was shown would be presence again). When a
      target's median share is 0.9 or more over a week, the database fork's weekly 8.1 read files the gap. That an
      agent files it means the detector for this class is not built: the missing detector is itself a gap (law 6).
      From task 2's install on, it also reports the share of new produces with a non-empty `uses`, and the depth
      distribution of credit per day.
- [ ] 8.2 After 4: no open root has zero candidates (the agf_kj751u9hu5ry count goes to 0); the model calls spent on
      refused-only roots per day are against design §9's estimate.
- [ ] 8.3 After 5: each landing on a gap root is followed by a `gapObservation`. Reported:
      - the share of `before: failed`, `not_reproduced` and `not_runnable`;
      - credit paid only when the §4 table holds.
- [ ] 8.4 After 7: a `stability` row each window, and `keeps_up` over a day. The share of draws made at the prior
      (`from: none`) falls while `keeps_up` holds (the proxy check of design §7).
