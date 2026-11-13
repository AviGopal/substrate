# walk-learning — credit by enablement

Each requirement names the check that falsifies it. The design contract is concept_8q0HcehfQLij.

## Requirement: credit travels from outcomes along consumption, once per ancestor

Credit SHALL originate only at a closure observation with provenance, at a person's verdict, or at a lapse (r 0, at
its own owner weight). The walk's own described outcome SHALL originate nothing. It SHALL travel
backward only along consumption edges:
- a produced row's schema inputs, and the rows it names in `uses` (held to rows it was shown);
- a call's request (`from`);
- a run's template;
- the closure move's landing hop.

Each selection reached SHALL be credited once per originating success, at w·γᵏ for the shortest path k, to depth D,
with w, γ and D read from the owner's `credits` row when the fold runs. Credit SHALL NOT reach a selection by its row's
presence in a pool, and a move SHALL earn nothing by ending.

**Check:**
- A produce whose row nothing consumes earns nothing.
- A context row not named in `uses` passes nothing.
- A cell whose calls always end and are never consumed keeps its prior mean.
- A described outcome at r 1 originates nothing, and a lapse originates r 0 at w_lapse.
- A diamond credits the shared ancestor once.
- Mutants (the presence chain, credit for ending, credit per path) each fail a check.

## Requirement: no selectable move is held by a hard filter

A refusal SHALL be a debit on the cell that chose what was refused, and a produce superseded on its root while
unconsumed SHALL be a debit on its cell. Neither SHALL remove the move from the options offered. Only a produce of a
target shown to a person (an owner `shape_description` with `words`) SHALL NOT be repeated on unchanged inputs
while ungraded, so a person never sees the same answer twice. Every root with an
open request or gap SHALL have an option on every tick.

**Check:** a root whose only option is refused every time is drawn at a rate that falls over 500 seeded ticks and is
never zero, and it is never without an option. With `refusedOver` restored, the root parks and the check fails.

## Requirement: the root is drawn by its own decayed history

The walk SHALL choose a root by Thompson sampling from one posterior per root. Each origination reaching the root
SHALL count once, undiscounted, as a success at its r. A root selection that no origination reached SHALL count as a
failure only once it is superseded, debited, or older than the owner's `unreached_after_s`. Each debit SHALL count
as a failure at its weight. Trials
SHALL be decayed by age with the half-life from the owner's `credits` row. The number of options a root has now SHALL
NOT enter its posterior. This SHALL apply to a person's ask as to a gap.

**Check:**
- Two roots with equal history and 1 vs 10 options are drawn at rates within 0.5 ± 3σ over 4000 seeds.
- A root whose moves all end with nothing travelling is drawn less than one with a closure.
- A 2-step and a 12-step close give equal root means.
- A root on a 12-step chain reaches git_land within 120 ticks in ≥ 95 of 100 seeds, among 3 roots at 0.167.
- A changed half-life row changes the draw.

## Requirement: closure is re-observed once per landing, with provenance from git

After a landing ends on a gap root, the move `gap_recheck` SHALL be selectable. It SHALL run the gap's own check (from
the gap's latest detector row filed by the generator) at origin's branch tip before the land and at the landed commit.
It SHALL verify that:
- both are on origin's branch, in order;
- the range leaves the check's own files untouched;
- the commit equals the chain's own git_commit hop, with the stamped identity.

Each check SHALL run in an empty network namespace, as the shell user with no readable key. It SHALL answer these
facts as a `gapObservation`, and SHALL NOT close or judge the gap. The fold SHALL:
- originate full credit only when the check failed at the base, passed at the commit, and every fact holds;
- originate a debit when the check still fails at the commit;
- give nothing when the check passes at the base (`not_reproduced`) or cannot run;
- count the first observation per `(call_id, commit)`, and debit a repeat on the recheck's own cell.

Records SHALL refuse `hop`, `selection`, `failure` and `gapObservation` from any write that does not carry the
walk's declared role, and so from every forwarded write. The fold SHALL read an observation only from a gap_recheck
call's ended hop.

**Check:**
- Each fact cleared in turn gives no credit.
- A two-commit land with the fix in the first commit is credited.
- Five rechecks of one landing credit once.
- A forged observation through record_write is refused.
- A forged hop pair and selection carrying an all-true answer are refused.
- A test that tries to write a row from inside the check writes nothing.

## Requirement: a composition is offered by what its chain enabled

A template SHALL be offered when the travelling credit on the selections it replays is at least the owner's
`offer_at`, seeded at two originations on different roots. No rule SHALL require a person's grade to offer a
template.

**Check:** a template whose replayed chain carried a re-observed change is offered with no person grade. A chain of 20
ended calls is not offered. With the person-r1 rule restored, the first check fails.

## Requirement: minting follows fresh, records-written stability

Records SHALL write a `stability` row each window. `cells_reached` counts only cells that received travelling credit
at depth ≥ 1, and `keeps_up = mixing ≥ growth`, a named proxy for λ₁(L) ≳ ρ_grow. A template SHALL be produced only
while the latest stability row says `keeps_up: true` and is younger than the owner's age bound. A stale row SHALL stop
minting. Records SHALL refuse `stability` from any `record_write`. A row older than two windows SHALL file a gap.

**Check:**
- `keeps_up` false, true-and-fresh, or true-and-stale decides the template produce.
- A stability row through record_write is refused.
- Depth-0 credit and debits are not counted.
- A stale row files the gap.
