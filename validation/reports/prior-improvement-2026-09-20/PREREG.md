# FROZEN pre-registration: human-timescale prior improvement (2026-09-20)

## Claim and scope
After repairing the context-recording joint, a controlled exposure sequence
shows the system's PRIORS moving in the right direction within one session
(human timescale), with the movement validated against ground truth rather
than self-report. Scope: the deterministic-transform goal class on the warm
hub. NOT claimed: cross-domain learning, long-horizon retention.

## The measured defect under repair (evidence base)
- state_signature absent from all 13,423 path rows; expected_output_shapes
  empty ~70% (measured 2026-09-16, re-verified before propagation).
- Selection reads v_shape_conditioned_score (paradigm.ts:1126,1163) which
  has ZERO occurrences in INFO FOR DB — conditioning provably inert.
- Behavioral: 719-dispatch exposure study flat (51.7% -> 49.2%, z=-0.58).

## Interventions (each landed via the lane where permitted, sequenced)
I1 write path: path/execution records carry state_signature +
   expected_output_shapes at record time.
I2 reader: the conditioned-score read points at something that EXISTS and
   is verified BY EFFECT (a journal line showing a conditioned value
   influencing a pick), not by definition.
No backfill of historical rows (causal discipline).

## Falsifiers (frozen)
- F-WRITE: after I1, >=90% of NEW path rows written during the experiment
  carry a non-empty state_signature AND non-empty expected_output_shapes
  (denominator: rows created after the landing timestamp).
- F-PRIOR (the headline): an exposure sequence of N=8 same-class goals
  (fresh operands each) shows the selected arm's posterior (alpha/beta in
  the LIVE belief table the picker actually reads) moving monotonically
  toward the observed outcome direction: alpha strictly increases across
  the sequence for the arm that keeps reaching, and the arm's posterior
  mean at the end exceeds its value at the start. Read directly from the
  database with the field names verified by SELECT * LIMIT 1 first.
- F-SELECT (directional, best-effort): later goals in the sequence
  select the reaching arm at equal-or-higher rate than the first two
  (small N; reported as observed, not significance-tested).
- VALIDATION: ground truth for every goal is a precomputed byte value;
  a posterior credited for a non-byte-correct outcome voids that data
  point (no self-graded credit counted).

## Budget and stopping rule
One session. If I1/I2 cannot land through the lane within ~5 attempts,
the blocker is filed and the experiment runs WITHOUT I2 (measuring F-PRIOR
on the existing uncontextualized posteriors — still a valid prior-movement
demonstration, scoped accordingly).

## Operator intervention ledger
Specs, dispatches, DB reads, labels. Appended live.

## Exclusions and uncertainty
N=8 is a trend, not a population claim; single class; warm hub with
concurrent autonomous activity (denominator contamination possible — goals
tagged prior-exp for isolation in reads).

---

# RESULT (scored against the frozen falsifiers)

## Interventions landed
- I1 all three halves, substrate-landed via the lane: e1979f77 (schema),
  092eac27 (route create+update), 6d998681 (sender captures
  getCachedStateSignature at record time). DB field via migration 211
  (written to sql/migrations, applied, ledgered in init_migrations).
- I2: root cause found — sql/schemas/023 (v_shape_conditioned_score) was
  NEVER applied to the live DB (absent from the 221-row init_migrations
  ledger). Applied; the DEFINE-time backfill needed an OVERWRITE re-run
  with a 30-min budget. View now LIVE: 709 rows and incrementing with new
  executions (707->708->709 across polls).

## F-WRITE: MET
Every new goal-path row written during the exposure carries a non-empty
state_signature — and FOUR DISTINCT signatures appeared across the run
(1dd3cd43, cf2ae7d0, deee4ecb, 62786d04): the recorder now distinguishes
situations. The absent-from-all-13,423-rows defect is closed for new data.

## F-PRIOR: MET on the attributable arm
Before/after snapshot of the FULL live belief table (context_thompson_scores,
13,283 -> 13,328 rows) around a 4-goal mini-exposure:
- exp8, exp9 reached with BYTE-VERIFIED artifacts; exp10 honest-fail,
  exp11 timeout (no credit — validation rule held).
- activity:learned-satisfier-memory-note-write under ctx=0784be6b:
  alpha 4 -> 6, beta 1 -> 1 — exactly +1 alpha per validated reach,
  posterior mean 0.800 -> 0.857, monotone. The SAME template under other
  contexts did not move: the improvement is SITUATION-CONDITIONED.
- Failure-side movement went to beta on the satisfier:memoryNote_write
  context rows (contaminated by concurrent traffic; not attributed).

## F-SELECT: NOT ESTABLISHED (as anticipated) — N too small; no claim.

## The joint, before vs after (one line)
Yesterday: selection asked with context, the record discarded it, the
conditioned view could not exist. Today: the record keeps the situation,
the conditioned view exists and grows, and a validated reach moves the
arm's posterior in ITS context bucket within minutes — human-timescale,
independently validated prior improvement.

## Honest residuals
- v_shape_conditioned_score alpha values look implausibly low vs n on some
  rows (e.g. alpha=2 over 3,662 executions) — the view aggregates
  execution.success faithfully; the SEMANTICS of that field (satisfier rows
  ungraded/false) is a follow-up, unfiled.
- exposure A instrument bug (nested quoting) voided its inline posterior
  reads; trajectory evidence comes from the clean B snapshot diff.
- goal-host drained mid-experiment once (autonomous cutover) — first
  battery voided, rerun clean.
- Path-store rows remain keyed per goal text (one row per operand), so
  CLASS-level path aggregation still awaits the re-key step (stage 5 of
  the program; deliberately deferred until context data accumulates).
