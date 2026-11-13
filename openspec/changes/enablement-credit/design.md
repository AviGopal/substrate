# Design: credit by enablement

Each numbered section answers the item of the same number in the review checklist recorded with concept_8q0HcehfQLij.
Each section ends with its must-fails and with what ends any wait it adds.

Terms, as the rows already carry them:
- **selection S**: a walk row with `cell`, `arm`, `pool_refs`, and for a call `from` (the request row it calls).
- **produced row P**: a described row with `selection_ref` = the produce selection that made it, and `input_refs`.
- **hop H**: a row with `selection_ref`, `call_id` and `phase` (started or ended).
- **failure F**: a row with `selection_ref`, `blames`, and `kind` for the walk's own.
- **producer(X)**: the selection named by `X.selection_ref`.

## 1. Front half: credit reaches a transition from the downstream successes it enabled

**Consumption edge.** A selection Y *consumed* a row X when:
- **(a)** Y is a produce, X is a row of one of its schema's **input** shapes, and X is in P.input_refs (an input is by
  definition what the produce is about); or
- **(b)** Y is a produce and X is in P.uses: rows the producer names as used, held to rows it was shown (the existing
  `x-shown` check, described-shape `shownIn`); or
- **(c)** Y is a call and X is its request (`Y.from`); or
- **(d)** Y is a run and X is the template it runs; or
- **(e)** Y is the closure move and X is the git_land ended hop its pointer names (`call_id`, section 5).

A context row the producer was merely shown is **not** consumed unless P names it in `uses`. That is the difference
from today. `fold.ts` `grades()` builds `chain = [s, ...s.pool_refs]`, every treated selection the answer's selection
saw: presence.

**What succeeds, and what does not.**
- A call or run that ended is a **non-failure**: no debit, and **no credit of its own**. Its cell gains only what
  travels back to it through consumption.
- Credit **originates** only at:
  - a closure observation with provenance (sections 4 and 5), at w_close;
  - a person's verdict r on the answer it judged, at w_person; or
  - a lapse: a person's or owner's request whose first deadline passed unanswered by a verdict, as records counts it
    today, which originates r 0 at **w_lapse**. A lapse is the absence of a verdict, a fact about the clock, not a
    person's r 0, so it has its own weight, separately learnable (law 1).
- **Not an origination: the walk's own described outcome.** Today records counts a described `outcome` (the walk's
  model grading its own answer, "clean" when it saw only the request, owner rows and answers) as a grade that credits
  the chain (`grades()`, `GRADERS = {described, person}`). That is a model judging an outcome, a grader, which the
  contract excludes. It follows the USER's ruling that positive signal is a person's verdict and a check passing
  after a landing. Described outcomes stay as rows but originate nothing. Replacement: closure and person
  originations. The REMOVAL, with every consumer found by resolved references, is in task 1.2's body.
- `land_verdict` rows are a different shape and never pass through `grades()`, which reads only `outcome`. They
  are unaffected: git_land's requires row reads them directly, as before.
- **Cold start, named.** With described outcomes gone and no landing yet, the only originations are person verdicts
  and lapses. Most cells then sit at their prior, and Thompson draws near-uniformly within a root until closures
  arrive. Task 1.2's body states how much evidence remains (the split of today's standing grades into described,
  person and lapse, and person verdicts per day), and task 8.1 watches the share of draws made at the prior.
- From an originating success O, evidence travels backward along consumption edges. A produce, call or run is credited
  only when travelling credit reaches it through a row that a consumer on O's path took.

**Credit flow, once per ancestor.** For one originating success O, the selections it reaches are found by a
breadth-first walk backward along consumption edges from O, to depth D. Each reached selection A is credited **once**
for O: r = O's r, at weight w(O)·γᵏ, where k is the length of the **shortest** path from O to A.
- **No cycles.** Every edge runs from a row to a selection with a higher seq (a consumer comes after what it consumed),
  so the graph is acyclic, and the walk ends.
- **Fan-in does not add up.** A diamond (two consumers of one row, both feeding O) credits the shared ancestor once, at
  its shortest distance, never once per path.
- **Failed re-observation.** An observation with provenance showing the check still fails (the landing did not fix it)
  originates r 0 at w_close along the same edges and weights. It is evidence, not a void of earlier credit.

**Owner row.** w_close, w_person, w_lapse, γ and D are fields of the owner's `credits` row for target `selection`.
Seeded: w_close = 1, w_person = 1, w_lapse = 1 (today's weight for a lapse), γ = 0.7, D = 12. Records reads them at fold time (law 1). A posterior
is Beta(α₀ + Σ w·r, β₀ + Σ w·(1−r)) over the evidence reaching its cell.

**Why not busywork.** No move earns credit by ending. A chain of edits and commits that never lands earns
nothing at all: no travelling credit reaches it, and produces that nothing consumes are debited when superseded
(section 2). A chain that lands but
fixes nothing is debited by the re-observation at full weight. A root of such chains gains a failed trial per selection
(section 3), so its draw share falls. A wrong chain's net decays from its own loops, with no
terminal gate.

**Must-fails.**
- A produce whose row nothing consumes earns nothing, while sitting in the pool of a selection that later succeeds.
  Mutant: `pool_refs` presence restored, which goes red.
- A context row the producer was shown but did not name in `uses` passes no credit.
- A cell whose calls always end and are never consumed keeps its prior mean. Mutant: credit for ending, which goes
  red.
- A diamond credits the shared ancestor once, at w·γ^(shortest k). Mutant: credit per path, which goes red.
- Credit at depth k is w·γᵏ, and nothing passes beyond D.
- A failed re-observation sends r 0 along the chain at the same weights.
- A described outcome at r 1 originates nothing. Mutant: described restored as a grader, which goes red.
- A lapse originates r 0 along consumption at w_lapse, and changing w_lapse changes the posterior.
- git_land's requirement still meets on a land_verdict r 1 (must-pass).

**Waits:** none added.

## 2. Holds become debits

**Removed** (walk `applicable.ts` `pending()`):
- the `refusedOver(...).includes(now)` branch;
- the ungraded-duplicate branch (`.some(... key === now)`).

The judged-gate re-judge (a schema newer than its last judgment re-offers it once) stays. It offers, it does not hold.

**What a person reads is not sent twice (B12).** The ungraded-duplicate rule stays for exactly the targets a person
reads: those the owner's `shape_description` rows give `words` (today `world_changed`, `answer`, `outcome`;
`walk-owner-seed.ts` SHOWN). An answer with the same inputs as one not yet graded is not produced again, so a person
is never shown the same answer twice. This holds no root: an ask root's other moves (its requests, its calls) stay
offered, and a new row it reads (a hop, a person's reply) re-offers the answer. The rule is removed for every other
target, which is where the parks were (a request produce on a gap root). The set is the owner's rows, not a list in
the walk.

**Debits that replace them** (records):
- **Refusal:** unchanged. `moveFailures` gives r 0 to the cell that chose what was refused.
- **Superseded unconsumed:** a produced row P on root R, followed on R by a later row of the same target, while no
  selection consumed P, gives r 0 at weight 1 to producer(P)'s cell. Without it a root would re-produce every tick,
  and the pool itself would become ρ_grow.

**Must-fails.**
- A root whose only option is refused every time is drawn at a falling rate, and the rate never reaches 0 by rule.
  Thompson draws from a Beta, which is never zero. Over 500 seeded ticks the draw rate in the last 100 is below the
  rate in the first 100, and above 0.
- The root never parks: every tick it still has an option.
- Mutant: `refusedOver` restored, which goes red because the root parks.
- A produce superseded while unconsumed debits its cell once. Superseded after being consumed, it does not.
- An answer is not produced again on unchanged inputs while ungraded. A request produce on a gap root is.

**Waits:** none. Removing the holds removes waits. The per-day cost this puts on such a root is in section 9.

## 3. Decay reaches the root draw

**Today:** walk `loop.ts` `choose()` picks the root uniformly (`roots[pick(seed, roots.length)]`), then a move by its
posterior.

**Change:** each root is drawn from **one posterior of the root's own history**, built from facts that are not
discounted by distance (γ is for cell credit only):
- **Success:** each origination (a closure with provenance, or a person's verdict) that reaches any of the root's
  selections adds its r to α and 1 − r to β, **once per origination**, however many of the root's selections it
  reached and however far away.
- **Failure:** a root selection that no origination has reached adds 1 to β only once it is **settled as unreached**:
  - it was superseded (a later selection of the same move on the root);
  - it was debited (section 2); or
  - it is older than `unreached_after_s` (owner `credits` row for target `root`, seeded at 86400) (B11).
  Each debit adds its weight. A selection still inside a running chain therefore costs the root nothing.

This keeps chain length out of the root's mean, before a closure as well as after it. A gap closed through a 12-step chain and an ask answered in 2 steps
each add one success and no failures, while a root that keeps working and never reaches anything accrues failures. A
selection that a later origination reaches stops counting as a failure, because a new fact (it was consumed toward an
outcome) was written. That is evidence updating as rows arrive, not a settle step: nothing is held provisional and no
grade is voided.

Each trial is decayed by age with weight 2^(−age/h). The roots are drawn by Thompson sampling from these posteriors,
from the selection's recorded seed, then the move within the root as today.

- **No max-of-k bias.** The root posterior is the root's history, not a combination over its current options, so the
  number of options does not enter it.
- **No resting at the prior.** A root whose moves all end but from which nothing travels gains a failed trial per
  selection, so it is drawn less than a root whose work reaches a closure or a verdict. This is the root's rate of
  contributing, measured as credit arrives, and nothing is settled. A cell's own posterior is untouched by this: an
  ended, unconsumed call's cell keeps its prior (section 1).
- **Exploration.** A root with no history is Beta(1,1), so a new root is explored.
- **Owner row.** h (`half_life_s`) is a field of the owner's `credits` row for target `root`, seeded at 86400. Records
  answers the root posteriors in the same POSTERIOR read, keyed by root id. Selection rows carry `root` (added where
  missing, read from pool_refs otherwise).
- **Person asks too.** This applies to roots of a person's ask as well as to gap roots. An ask whose moves keep being
  debited, or reach nothing, is drawn less and less until something travels from it (a person's verdict or a
  closure). It is never drawn at zero. A lapse on a person's ask is an origination at r 0 (section 1), so it also
  counts against that ask's root. This changes how a person's asks are served, so the USER is asked to confirm it
  (with its lapse effect) before task 4 is built.

**Must-fails.**
- Two roots with equal history and 1 vs 10 current options are drawn at equal rates: over 4000 seeds, each rate
  within 0.5 ± 3·sqrt(0.25/4000).
- A root whose moves are all debited is drawn at a falling rate.
- A root whose moves all end with nothing travelling is drawn less than one with a closure.
- Two roots that each close once, one through a 2-step chain and one through a 12-step chain, have equal root means
  (R8). Mutant: γ-discounted root trials, which goes red.
- Seeded simulation (B11): with 3 roots at mean 0.167, a root on a 12-step chain of always-allowed moves reaches
  git_land within 120 ticks in at least 95 of 100 seeds. Mutant: every unreached selection counted as a failure at
  once, which goes red.
- Mutant: the uniform pick restored, which goes red on the second.
- The half-life is read from the owner row: changing the row changes the draw (law 1).

**Waits:** none.

## 4. Provenance: from git, never from rows

A landing's closure credit needs the chain from the gap's cause to the landed commit. **Rows are not the
attestation.** Records stamps any declared role under a node's key, so an owner, detector or walk row is no proof of
who wrote it, and a forwarded `record_write` has forged described rows before. The closure move therefore re-derives
everything it credits from git and from the gap's check, at the moment it runs:

| fact | how it is established |
|---|---|
| the gap's cause | the gap's check (`test_file`, `only_tests`) from the gap's latest **detector** row filed by the generator, never a walk-written row and never the episode's first row alone (agf_jmgp5bxlgco6) |
| the repository | the gap row's top-level `repo`; the clone was made of it (git_worktree requires repo = the gap's repo) |
| the range landed | `base..commit`, where `base` is origin's branch tip before the land (git_land's answer) and `commit` the landed tip. Both re-checked: `base` is an ancestor of `commit`, and `commit` is an ancestor of origin's branch HEAD, fetched now |
| it caused the change | the gap's check **fails at `base` and passes at `commit`** (a counterfactual over the whole landed range, law 12). A land of several commits is judged as one range, so a fix in its first commit counts |
| the base reproduces the cause | the check at `base` fails the way the detector saw it fail. If it passes at `base` in the move's scrubbed tree, the gap was red only in the detector's environment (as one gap was): the observation is `before: not_reproduced`, which is **not** read as "fixed by someone else" and credits nothing |
| it did not move the goalposts | `base..commit` touches none of the check's own files (`test_file`, the gap's `protected_files`) (boundary 1) |
| the range is the walk's | `commit` equals the sha in the chain's own git_commit ended hop (consistency), and its committer is the identity git_commit stamps (task 5.1) |

A row claiming any of these (a forged hop, a forged gitDiff) changes nothing. The move reads git and runs the check
itself, so a forgery can at most make it check a range that then fails the table.

**Not attestation, named.** The committer identity is a string any process in the container can set, and the sha
consistency is a row check, forgeable too. Together they raise the bar but are **not** attestation. The counterfactual
is what carries weight: the check fails before and passes after, over a range on origin's branch that leaves the check
untouched. Crediting a range that truly fixed the gap, under a forged identity, would at worst credit a real fix.

**Must-fails.**
- Credit only when every row of the table holds. Each is cleared in turn:
  - not on the branch;
  - `base` not an ancestor;
  - the check passing at `base` (`not_reproduced`, no credit);
  - failing at `commit`;
  - the range touching the test file;
  - a test list from a walk-written gap row;
  - `commit` ≠ the git_commit hop's sha.
  Each clearing gives no closure credit.
- A two-commit land whose fix is in the first commit is credited.
- A forged hop naming an operator's commit gives no credit.

**Waits:** none. Section 5 bounds the move.

## 5. The closure activity

**Reuse (law 3).** No live shape re-observes a gap's check on a landed tree. The registry has `codeTypecheckResult`,
`code_verify_typecheck` and `interactorObservation`, none of which runs a check. `test_suite`, which gaps name in
`evidence_resolve`, was served by development-vessel, retired. local-tools already runs exactly the gap's check on a
tree: git-land.ts `gapCheck()`, used by git_diff before landing. The closure move exposes that code as one call
shape, with no new runner and no new store:

- **`gap_recheck`** (local-tools), pointer `{call_id}`: the git_land call whose landing it re-observes.
  - It reads that call's ended hop for `base` and `commit`, and the root's gap row for the check (section 4's rules).
  - It fetches origin and runs `gapCheck` at `base` and at `commit`, each in its own scrubbed tree, each under
    gapCheck's existing time bound.
  - **Isolation (B10).** The tests at `commit` are code the walk wrote. Each check runs:
    - as the shell user (`asShellUser`, as runCheck does today), with the scrubbed environment (no key in it);
    - with no readable key file;
    - in a **network namespace of its own**: its own loopback is up, so a test that serves and connects on 127.0.0.1
      inside the check still works, but no host service is reachable: no records, no discovery, no identity.
    So nothing a test runs can write a row, under any role.
    - Dependencies are installed before the namespace is entered, and only the test runs inside it, so module
      resolution never needs the network.
    - If the namespace cannot be entered (an unprivileged namespace refused in the container), the check is
      `not_runnable`. It never falls back to the host network.
    - **Assumption, with a reader:** a network namespace does not isolate filesystem unix sockets. Today the shell
      user can reach no vessel through one (the host has only systemd, dbus and a rootless-port socket, none a
      vessel's). A vessel that adds a unix-socket listener reachable by the shell user breaks this. The must-fail
      that tries a write through a socket path is the reader. Today runCheck isolates the user and the environment but
    not the network, and git_diff's pre-land check has the same exposure. The namespace applies to both (task 5.2).
  - It answers **`gapObservation`**: `{gap_id, repo, call_id, base, commit, on_branch, range_is_walks, before, after,
    check_files_untouched, named}`, where `before` is `failed`, `passed`, `not_reproduced` or `not_runnable`, and
    `after` is `failed`, `passed` or `not_runnable`. Facts only, no verdict.
- **Selectable** like any call. The owner requires row: `{for: "gap_recheck", needs: "hop", where: {pointer_type:
  "git_land", phase: "ended", call_id: {"x-pointer": "call_id"}}, latest_by: "call_id"}`.
- **Counted once per landing (B4).** The fold counts the **first** `gapObservation` for each `(call_id, commit)`. A
  later one for the same pair, with no newer gap row on the root since the last, is a repeat:
  - it credits nothing;
  - it gives r 0 at weight 1 to the recheck's own cell (the same rule as section 2's supersession).
  So rechecking one landing again and again earns nothing and decays the recheck's cell, with no hold. A new landing
  (a new `call_id`) or a new gap row (a re-filed check, the detector reopening it) is new information, and its next
  observation counts.
- **Accepted only on the call path (B9, R9).** The fold reads one row: the ended `hop` of a `gap_recheck` call. Its
  `answer` is the gapObservation, its `call_id` matches a started hop, and that started hop's `selection_ref` is a
  walk selection whose move is `call/gap_recheck`. Every row on that path must be unforgeable by a forwarded write:
  - Since 535a503, a call the walk forwards for a request (a request naming `record_write`) reaches records with no
    declared writer or role, so records can tell it from the walk's own bookkeeping write.
  - Records **refuses** shapes `hop`, `selection`, `failure`, `gapObservation` and `stability` from any write
    that does not carry the walk's (or, for `stability`, records' own) declared role. So a forwarded write, which
    carries none, can never create a started/ended hop pair, a selection, or an observation.
  - An LLM-produced request cannot write any of them, since its write is forwarded and so refused.
  - The walk's own code writes the hop only with what local-tools answered.
  - **Residual, named:** a process holding the node key can still declare the walk's role (a node-key owner row is not
    attestation). That is the node-key class, outside this change. It is reviewed code, not model output.
  - The refusal lives beside records' owner-shape write rules (`store.ts`, where OWNER_SHAPES are kept owner-only),
    as a rule of authorship for a records-only shape, not a per-failure guard.
- **Not a close and not a verdict.** The detector still opens and closes the gap row. The observation is a fact the
  fold reads (section 1). The fold reads it as follows:
  - with the section 4 table met, `before: failed` and `after: passed` originate r 1 at w_close;
  - `before: failed` and `after: failed` originate r 0;
  - anything else originates nothing.
- **check_runnable false** (the test file is gone, the check cannot run): `after: not_runnable`. No credit and no
  debit beyond the repeat rule, and the move ended, so nothing waits.
- **`gapClosures` is retired** from the fold in the same commit as this credit (task 5.4). The detector's close stops
  being a credit path: it credited a presence chain and could not tell an operator's fix from the walk's. The
  observation's counterfactual can.
- **Asks: excluded.** Re-running change_wanted on the landed tree would be a model's judgment of the outcome, setting
  credit at full weight: a grader under item 8, even with the same schema (qa's reading; the judge also read 34 of 35
  person asks as not wanted). An ask's back half is the person's verdict on the answer (already an originating
  success at w_person) and the consumption chain. Nothing re-observes an ask by model. The USER is asked to confirm
  this.

**Must-fails.**
- `gap_recheck` is offered only after a git_land ended on the root.
- Five rechecks of one landing credit the chain once, and debit the recheck's cell four times.
- A forged `gapObservation` with every fact true, written through record_write, is refused by records. One placed
  without a gap_recheck hop is not read. Neither credits anything.
- A forged started/ended hop pair and a `call/gap_recheck` selection with an embedded all-true answer, written
  through a forwarded record_write, are refused and credit nothing (R9).
- `not_runnable` and `not_reproduced` credit nothing.
- A test at `commit` that tries a record_write with the walk's role, or any connection to a loopback port, writes
  nothing, and its gap_recheck credits nothing (B10). Mutant: the check run with the host network, which goes red.
- Its observation reports the table's facts.

**Waits:** two suite runs, each under gapCheck's existing bound. `not_runnable` ends the move. A fetch that fails is
a failure row blaming the callee: no debit, and the move stays selectable.

## 6. One mechanism for moves and compositions

- A template's run is a selection like any other. The credit that reaches it from downstream follows section 1, and
  it earns nothing by ending. Its own cell learns from its runs.
- **`earned()`'s person-r1 gate is removed.** A template is offered when the selections it replays carried
  **travelling** credit: the summed credit on them, counting only credit that originated at a closure or a person's
  verdict (section 1), is at least `offer_at`. `offer_at` is a field of the owner's `credits` row for target
  `activity_template`, seeded at **2**: two originations on different roots.
- **The risk this carries (C2).** A landing that passes its check by weakening the source (the class of a mapPath
  change that once passed a stale test) gets full closure credit, and nothing before git_land is a security gate. At
  `offer_at` = 1 one such landing would make a reusable template of the weakening. At 2, from two different roots, a
  single weakening is not enough, though two would be. This lowers the risk, it does not remove it: the land_verdict
  and boundary (1) are what stand before git_land. The removal of the person-r1 gate is the USER's to confirm (task
  0.3). Law 4 holds: earned by doing, now measured by
  what the doing enabled rather than by a person's grade.
- Templates that are never offered stay in the store, unread by the walk, as today.

**Must-fails.**
- A template whose replayed chain carried a re-observed change is offered with no person grade.
- A chain of 20 ended calls, with no closure and no verdict, is not offered.
- A chain with one closure is not offered. Two closures on different roots are.
- Mutant: the person-r1 rule restored, which goes red on the first.

**Waits:** none.

## 7. Stability, measured by rows and read where minting is chosen

**Writer.** Records writes a `stability` row each window (`window_s`, owner `credits` row for target `stability`,
seeded at 3600), as its own fact:

    {window_end_seq, window_end_t, cells_new, templates_new, cells_reached, mixing, growth, keeps_up}

- `cells_new`: cells first selected in the window.
- `templates_new`: templates minted in the window.
- `cells_reached`: distinct cells that **received travelling credit at depth ≥ 1** in the window, credit that
  originated at a closure or a person's verdict (B6). It does not count:
  - a success's own cell (depth 0);
  - debits;
  - refusals;
  - a lapse's r 0. A lapse is an origination, but at r 0. Stability counts only credit that travelled from a closure
    or a person's verdict.
- `mixing = cells_reached / window`, `growth = (cells_new + templates_new) / window`, `keeps_up = mixing ≥ growth`.

**A proxy, named.** λ₁(L) is the rate at which credit spreads across the cell complex (`SUBSTRATE_AS_DYNAMICS.md`
§3), and ρ_grow is the rate at which uninformed cells are minted. `cells_reached` per window counts how many cells a
window's credit actually spread to, from outcomes, so it moves with λ₁ without being it. `cells_new + templates_new`
counts new uninformed cells, so it is ρ_grow's own count. `keeps_up` is a **proxy** for the inequality, and task 8.4
checks it against the doc's reading: while `keeps_up` holds over a day, the share of draws made at the prior (`from:
none`) falls; while it fails, that share rises.

**Freshness and authorship.**
- **Fail closed (B7).** The requires row on minting is `{for: "activity_template", needs: "stability", where:
  {keeps_up: true, window_end_t: {"x-max-age-s": 7200}}, latest_by: "shape"}`. The walk's `meets()` gains one where
  operator, `x-max-age-s` (the field is a time, at most that many seconds before now). The age is the owner's to
  write. A row older than two windows does **not** meet the requirement, so when records stops writing, minting
  stops.
- **Authorship (B8).** `stability` is written only by records itself. Records refuses shape `stability` from any
  `record_write`, from any caller and declared role, beside the same owner-shape write rules (`store.ts`) as
  `gapObservation`. The walk reads only rows records produced (its read of `stability` comes from records' own
  episode answer, which carries no externally written rows of this shape, since none can exist).

**Readers.**
- The walk's requires rule, today for calls only, extends to produces of the targets an owner row names (so the
  `activity_template` produce is offered only while the requirement is met). This is condition-driven selection from
  a shaped row (law 5), not a timer.
- pull-sync's detector files a gap when the latest `stability` row is older than two windows, so a stopped measurement
  is reported as well as stopping minting.

**Must-fails.**
- `keeps_up: false` makes the template produce not offered; `true` and fresh offers it; `true` but older than the
  owner's age does not.
- A `stability` row through record_write is refused by records.
- A cell credited only at depth 0, or only debited, is not counted in `cells_reached`.
- No stability row for two windows files the gap.

**Waits:** minting waits on a fresh stability row. What ends it: records writes one each window. Under a persistent
fault minting stays off (fail-closed: a stale row does not meet the requirement), and the detector's gap says so.

## 8. Not built, by the contract

- No grader or judge: no new shape grades an outcome. The closure move reports facts, and the fold applies one rule
  to them. A re-run of change_wanted as an ask's closure is excluded for that reason (section 5).
- No provisional→settled credit: every piece of evidence is applied when it is written, and nothing later voids it.
  A root trial's success rises as credit reaches it; nothing settles it.
- No person-only template gate.
- No detector in EXO_ROLES and no gap-variant outcome: gap-root requests do not lapse. Their end is the holds'
  removal and the root draw.

## 9. Every wait under a persistent fault, and what it costs

| wait | what ends it |
|---|---|
| a refused or duplicate produce | nothing waits; the holds are gone |
| a root whose moves never help | its draw rate decays and never reaches zero |
| `gap_recheck` suite runs | gapCheck's time bound; `not_runnable`; a fetch failure is a callee failure |
| repeated rechecks of one landing | the repeat debit decays the recheck's cell |
| template minting | a fresh `stability` row; otherwise off, and the detector's gap |
| the root posterior read | the walk's existing bounded read (60 s, then exit non-zero), and section 11 |

**The cost a refused-only root bears (law 5: a rhythm reading, not a clamp).** With the holds gone, each draw of a
root whose only option is a produce the model keeps refusing costs one model call and one failed trial.

Under the seeded values (h = 1 day):
- Such a root's posterior holds about the trials of the last day or two. Its draw share falls until its mean
  1/(n+2), for n failed trials, is below the other roots' means.
- With other roots near the measured 0.167, it settles near n ≈ 4: on the order of 4 to 6 draws, and as many model
  calls, per half-life (a day) per such root.
- At the 3 parked roots measured, that is on the order of 15 model calls a day.

A change of h or of the other roots' means moves it, and task 8.2 reads the real number.

**What a person sees (B12).** No repeated answers. The duplicate rule stays for the shapes a person reads, so an
answer is re-produced only on new inputs: one per change in what the ask's root holds, as today.

**A chain in progress (B11).** A root's selections cost it nothing until they are superseded, debited, or a day old.
Under a persistent fault (a chain stuck mid-way), its draw rate starts falling a day after each step and keeps falling
until something reaches it. It never reaches zero.

## 10. Boundaries kept

- A change cannot edit the check that verifies it: closure credit needs the check's files untouched by the landed
  diff (section 4).
- The install gate stays hard. Nothing here touches gate fixtures.
- Person keys still mark person rows. A person's verdict is still evidence, and still the only thing that closes a
  request.

## 11. Cost, and the walk's read bound

The fold gains edge walks to depth D and root sums. It is still a full fold per read (agf_xgxdr4i155s0): 7 to 9 s
today on a hub-sized store. A POSTERIOR read that grew past the walk's 60 s read bound would stop the walk with a
non-zero exit on every tick. So:
- The per-tick timing (agf_4ozotydifpdj) lands **before** task 1, so the cost of each step is measured, not guessed.
- Before task 1.2 is installed, the fold is timed at D = 12 on a copy of a hub-sized store, off the hub's host and not
  during a pace study. It installs only if a read stays well inside the bound (the measured time is reported with the
  commit).
- The rule is written per row and per edge, so an incremental fold can apply it as rows arrive. That is the cure for
  the full-fold cost, and it follows this change rather than freezing today's rule.
