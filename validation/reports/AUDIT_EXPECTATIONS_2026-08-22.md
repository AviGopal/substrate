# What to expect from a full audit of learning, database, and architecture

This is not a fifth audit. It is the **prior** — what a full pass over the
learning mechanism, the store, and the architecture should be expected to
produce, calibrated against the four rounds that already ran, plus five fresh
read-only probes taken today to timestamp the expectation rather than assert it.

Layer order matters. Where `LEARNING_DB_ARCHITECTURE_AUDIT_2026-08-22.md`
disagrees with the later same-day `SEAM_CLOSURE_2026-08-22.md` and
`NEEDLE_MOVERS_2026-08-22.md`, the later documents win and the supersession is
marked.

---

## 1. Expectations per plane

**In code.** Expect the machinery to be *present and correct*, and the joins
between pieces to be *wrong*. Four rounds have not found a single learning
component that was unimplemented. They found: a sampler that reads the right
table and binds the wrong key (`getCanonicalPosteriors` stripping the
`organizations:` prefix — 0 rows instead of 3,275); a credit branch gated on an
empty table (`activity_template`, 0 firings against a 7,261 positive control); a
fallback guarded by a `catch` that could never fire because SurrealDB reports a
missing view as an empty one. Expect the next finding to have this shape too.
Do **not** expect to find missing code.

**In traces.** Expect the trace record to answer questions about *arms* and to
be structurally unable to answer questions about *decisions*. Credit reaches
activities; it never reaches the choice to select them. Expect any question of
the form "was choosing X right?" to be unanswerable, and expect at least one
finding to be a phantom-column read that looked like an answer.

**In intent.** Expect a wide, honest gap against CLAUDE.md, and expect the size
of that gap to depend entirely on the denominator you pick. Reach against the
execution expectation's ~90% measures 37–42% on the defensible denominators and
0.08% on the firehose. The laws with real teeth here are 3 (76% of non-retired
activities sit in a duplicate shape family), 4 (1.2% of activities carry
execution provenance), 7 (the gap triple is computed nowhere), and 12 (no
counterfactual is recorded at decision time, because decisions are unjoinable).

---

## 2. Meta-expectations — the base rates this system's audits actually have

These are the most useful numbers in this document, because they say how much of
a fifth pass to believe.

| expectation | measured base rate |
|---|---|
| A finding's **observational** leg survives adversarial review | ~7 of 7 |
| A finding's **causal** leg survives | **1 of 7** |
| A deployed fix produces a measurable change | **1 of 4** |
| A finding is a rediscovery of one already catalogued | 3 of 7 |

The dominant failure signature across all four rounds is one class: **the system
cannot distinguish absent from empty from zero from capped.** A missing view
returns OK + empty. A stripped `org_id` returns 0 matches. A `RecordId` bound
against a `string` column returns 0 matches. A boolean composite index returns
0. A silently capped `limit` returns fewer rows than asked with no signal. Each
one is invisible until someone counts requested-versus-matched at the seam.

Two corollaries for how to run the pass:

- **Measure the denominator before optimising the numerator.** Rounds 1–3 chose
  their path from architecture diagrams and fixed real defects on a path
  carrying ~5% of executions. Round 4 asked what the traffic actually runs and
  found a larger defect in minutes.
- **Every zero is a claim about your filter until proven otherwise.** Run the
  positive control. Today one of my own probes read 0 `validator-dispatch`
  selections in the boredom journal; the positive control found 1,247 mentions
  in activity-api, so the zero measured the journal's logging, not the pool.

---

## 3. Unused wiring — expect a long tail, and expect it not to be the cause

The adversarial pass killed the causal leg of nearly every dead-table finding
(`routing_trace`, `activity_metrics`, `circuit_breaker_trace` all refuted and two
of them *inverted*). Expect the inventory to be long and the impact to be small.
Treat it as a symptom tail.

Complete-but-unconnected: `execution_sequences`, `execution_state_snapshot`,
`relevance_feedback`, `impulse_usage_history`, `composite_sequence_patterns`,
`execution_pattern`, `discovered_state_pattern`, `shape_gap_resolution` (no
writer), `code_modification_proposal` (writer, reader, registry shape, activity
arm — zero rows). Dead schema: `activity.thompson_alpha/beta/total_executions`,
identical on all 3,856 rows, while the live plane is
`variant_performance_metrics`. Legacy sink: `activity_templates` (plural),
untouched since 2026-04-02 — **not** the live extraction path.

The two that *are* load-bearing: `activity_template` (singular, 0 rows) gates a
shape-weighted credit branch that has never once executed, so every Thompson
credit update in this system's history was unweighted; and `refusal_events`
(5,378 rows) is read only by an audit endpoint, so the shape-gap demand signal
has no consumer.

## 4. Incorrect attribution — expect this to be the real finding

- **All 26,529 Thompson selections are unjoinable to their outcomes.**
  `thompson_selection_log.execution_id` holds a `recommend-<ts>-<idx>`
  placeholder minted at recommendation time; zero `execution` rows match, against
  6,970 `exec_` rows as positive control. Credit reaches arms, never decisions.
  This is the law-12 gap and nothing else in the audit is close to it in size.
- **The `consumedInChain=0` abstention withholds both α and β**, which makes the
  entire satisfier class learning-inert — failures in that class teach nothing.
- **The prefilter is pure recency.** `activity.ev` is identically `0.5` on
  3,856/3,856 rows and `discover-by-shapes.ts:235` orders by it, truncating
  *before* the Thompson draw. The selector sees the newest unearned arms first.
- **Blame attribution remains open.** Round 4 measured 0 of 96 `execution_error`
  rows carrying a `reason` post-deploy. I could not settle this today: the
  executions endpoint does not project `failure_mode` or `reached` at all
  (`reached: null` on 100/100 rows, no `failure_mode` key), so a read there is a
  filter zero, not evidence. **Still open, still unmeasured through this
  surface.** One lead worth the next probe: 102 of 543 `execution_error` lines in
  activity-api's 6h journal carry a `reason` nearby, against round 4's 0 of 96
  *rows*. Journal lines are not rows, so this settles nothing — but it is a
  cheap, specified next step, and it points at round 4's own open question
  (*which* poster produced the reason-less rows).
- **Superseded:** the "69% of executions never receive a reach tag" figure was
  withdrawn — it measured over the firehose rather than the gradable set. The
  "sampler/store disagreement, mechanism undetermined" entry was determined: the
  `organizations:` prefix strip, closed in `SEAM_CLOSURE_2026-08-22.md` §2.

## 5. What is preventing growth, ranked by traffic share

1. **Whatever the ~95% boredom-pool path reads.** The pool bypasses
   `recommend()` entirely and scores from `GET /v2/activities/templates`. Round 4
   found that endpoint delivering no metrics at all; fixing it put a 3.7× success
   spread in front of the dominant path. Any further growth work should start by
   asking what *that* path reads next.
2. **Extraction lands almost nothing.** ~96 dispatches/day, and the corpus grew
   by 2 templates in 3 weeks. The gate is correct and starving; 90 of 102
   extraction dispatches end `reached: false` while reporting `status: success`.
3. **The proposal/earned mint ratio** — 51% of activities minted by the
   gap-closing path against 1.2% carrying execution provenance, feeding a
   recency-ordered prefilter. **Superseded as a *current* dynamic by today's
   probe** (§6): both mint paths stopped around 2026-08-01, so the ratio
   describes the corpus's composition, not live competition for selection.
4. **Trace-store pressure.** `execution` is a 150,000-row FIFO ring at cap; an
   auth storm at ~20,000/hr flushed ~2 months of history, enabled by composite
   indexes ending in `success` that return zero rows so the stratified retention
   sweep deletes nothing.
5. **`validator-dispatch` runs 1 of its 5 tasks** — never executing a validator,
   never recording a learning signal, reporting success — and is one of only two
   templates on the ribosome's eligibility list.

## 6. Fresh probes, 2026-08-22 — what changed and what is new

**The round-4 fix is live and delivering.** `template_metrics_fetched` emits 442
times in 6h with non-zero matches (`requested:200, matched:50`;
`requested:120, matched:29`). Previously `matched: 0` by construction.

**The pool may have concentrated on its best arm.** The executions endpoint
shows 93 of 100 rows on `gap-to-scenario-bridge-tick` (mean 0.756) against 2 on
`validator-dispatch` (mean 0.205); round 4's window was 29% / 18%. Single leg,
short window, and the endpoint's ordering is unstable — treat as suggestive, not
established. I originally offered the boredom journal as a second leg (484
bridge-tick, 0 `validator-dispatch`); the positive control shows that journal
logs `validator-dispatch` zero times in *any* window while activity-api shows
1,247 mentions, so that leg is uninformative and is withdrawn.

**New — the templates endpoint silently caps its page size.** `limit=200`
returns 100 rows with no signal to the caller. Round 4's instrument therefore
overstates its own denominator: `requested: 200, matched: 50` was only ever 100
rows offered, so the match rate is 50%, not 25%. Ordering is also unstable —
offset=0 and offset=100 **overlap by 48 of 100 ids**, the same non-unique
`ORDER BY` + LIMIT/START defect recorded on a different endpoint on 08-21, now
reproduced on the endpoint the dominant traffic path uses to score candidates.

> **Corrected before publication.** An earlier draft of this section claimed
> "49% of the corpus is unreachable." That was an artifact of my own paging loop
> stepping by 200 against pages capped at 100 — half the offsets were never
> requested. Re-paged at step 100: **2,592 unique of a reported 2,640, 98.2%
> reachable.** The residual 1.8% is attributable to the ordering instability.
> This report committed the exact error its §2 preaches against; the base rate
> in §2 is not a claim about other people's audits.

**New — minting has essentially stopped across *both* sources.** Measured over
2,592 of 2,640 activities (98.2% of the corpus): **79 mints in the 7 days to
2026-08-01, then 4 in the 21 days since** (08-01 ×1, 08-21 ×2, 08-22 ×1). Both
the earned path and the proposal path stopped at the same time. The audit's
framing of proposal-minting "filling the gap daily" describes a lifetime share,
not a current rate — growth is not currently being out-competed by its own
backlog, it has halted on both sides. **What happened around 2026-08-01 is the
most specific open question this pass produced**, and it is not the extraction
gate, because the gate does not govern the proposal path.

---

## 7. What no audit can measure yet

- **The middle tier has never fired.** Zero first-mile or last-mile adaptation
  markers in the entire goal-host journal. This is the tier by which learning
  compounds.
- **The ceiling is n=1.** 17 accepted pathway reuses, every one borrowing from a
  single goal hash on a 1/1 record.
- **Three correct fixes are unfalsifiable until goal traffic exists.** Blame
  attribution, `correlation_id`, and the 30-day decay all govern the goal-walk
  path, which is 283 of 150,056 executions (0.19%). **Generating goal traffic is
  a prerequisite for the next audit, not an afterthought** — without it, a fifth
  pass re-measures housekeeping.

**The single highest-value thing a fifth pass could do** is not find another
seam. It is to add a counted requested-versus-matched log at every
cross-component read. Every defect in four rounds was an absent/empty/zero
confusion, and the only two seams where a dead join was self-evident rather than
requiring an audit (`cts_lookup`, `cts_sig_lookup`) are the two that already log
it.
