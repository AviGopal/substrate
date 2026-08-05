# Shape→Action→Evidence Expectations

> **What this document is.** A set of falsifiable expectations the substrate holds about its
> own shape→action→evidence mapping, written where the closure loop can see them (the
> docs-align scan watches `docs/**`). Each expectation names its metric, its floor, and the
> source that would falsify it. An expectation contradicted by its own source is documentation
> drift, and the docs-as-expectation loop — the `docs-align-scan` and `doc_drift_fix`
> resolvers in development-vessel — is expected to flag it.
>
> **These are expectations, not readings.** A measurement belongs in a trace, in a report
> under `validation/results/`, or in a commit message — never inlined here. Sections of
> `docs/architecture/**` are ingested as `architecturePrinciple` concepts and dense-searched
> into the code-authoring prompt, so a number pinned in this file would be fed to a drafter as
> the current state of the world long after it stopped being true. Query the running substrate
> for the value; this document tells you what value to expect and what it means when you do
> not get it.

## The condition being proven

The substrate consistently works on tasks that improve its ability to map **shapes → action →
evidence**: every natural-language goal gets a shape-lattice entry point, walks toward it,
passes the reach gate, records evidence keyed by state signature, and the substrate's own
authored commits measurably improve this loop — including on the implicit human channel
(obsidian-vessel), where the human's observed interaction is the verification signal and
unmet interaction-expectations are real failures rather than noise to be dropped.

## Claim 1 — Target-shape seeding rate

**Expectation:** at least 0.8 of fresh natural-language goals dispatched to goal-host
`/run-goal` with neither an explicit `expected_output_shapes` nor a `targetTemplateId` carry
a non-empty `inferred_target_shapes` in the walk log.

**Why the floor exists:** a goal with no target leaves the shape-graph walk in opportunistic
mode, where it selects the highest-Thompson activity irrespective of goal relevance and fails
hollow. Inference (`repos/goal-host-vessel/src/goal-target-inference.ts`) is constrained to
discovery's advertised producible-shape vocabulary and its output is filtered against that
vocabulary, so a hallucinated shape is dropped rather than walked toward, and inference
returns empty on model-down or parse failure. A rate below the floor therefore reads as the
walk being starved of a target, not as it being pointed at a wrong one.

**Source:** goal-host journal lines carrying `inferred_target_shapes`, over the dispatch count
in the same window; `goal_execution_paths` rows for the same goals, keyed by the deterministic
`goal_hash` that also backs the inference cache.

## Claim 2 — Reach rate rises, hollow completions decline

**Expectation:** a change that claims to improve goal seeding raises the reach-gated success
fraction of completed dispatches by at least 15 points against the baseline window recorded
before it landed, and hollow completions — `status = completed` with empty `completion_shapes`
— decline week over week.

**Why the floor exists:** `status` is only the template exit status, while `reached` is the
honest verdict. Hollow completion and satisfier reaches both occur, so a success fraction
computed from exit status measures the wrong thing and will rise while the system gets worse.

**Source:** `goal_execution_paths.success`; hydrated `goal_status` produced-shape views; the
`reached` and `completion_shapes` fields on `execution`.

**Precondition on the reading:** verify the telemetry before trusting the number. A partly
blind limiter or a null sample rate makes the fraction unfalsifiable, and an unfalsifiable
number is worse than a missing one because it will be cited.

## Claim 3 — Frontier closure velocity

**Expectation:** the `learning_mode` frontier — shapes that are necessary and not yet
available — is non-increasing while the shape vocabulary grows, and every frontier shape that
closes has a reach-gated producing trace behind it rather than a hollow mint.

**Why the floor exists:** a frontier that shrinks through declaration rather than production
is the failure mode this claim exists to catch. A shape counts as closed only when something
actually produced it in an execution that passed the reach gate; a template asserting the
shape in its outputs closes nothing.

**Source:** the development-vessel `learning_mode` resolver's frontier size per snapshot; the
`shape_closure_demand` queue depth; producing traces read through `goal_execution_paths` and
execution-trace reads.

## Claim 4 — Signature discrimination

**Expectation:** growth in `context_thompson_scores.n_observations` is concentrated rather
than uniform across signatures, posterior-mean spread per template is non-flat, and selection
entropy on repeated identical goals decreases.

**Why the floor exists:** these three together are what distinguishes a learner that
discriminates between contexts from one that accumulates observations without changing
behavior. Flat spread means the signature is not conditioning selection, and non-decreasing
entropy on an identical repeated goal means nothing was learned from the previous run.

**Source:** the `context_thompson_scores` distribution; the κ posterior-spread limiter
reported by `scripts/substrate/autonomy-status.ts` (`dec_limiters.kappa_posterior_spread`);
the development-vessel `selection-entropy` resolver, read per success bucket.

## Claim 5 — Coverage-matrix fill

**Expectation:** stratified-harness cells below the success floor decrease run over run, and
at least one cell carries the `closing` trend flag on the following run.

**Why the floor exists:** a coverage matrix that never moves is measuring goal difficulty
rather than substrate capability. The run-over-run comparison, not any single run, is the
evidence — a single report can be made to look good by choosing the goals.

**Source:** `validation/scripts/stratified-harness.ts`, whose report lands under
`validation/results/` and whose per-cell fields include `floor_pass` and `passable_cell_count`;
compared against a prior report with
`bun run validation/scripts/compare-reports.ts --stratified <before> <after>`, or against a
pinned baseline under `validation/baselines/`. Per-cell optimality trend is one of `closing`,
`stable`, or `regressing`, computed only when a prior report is supplied via `--baseline`.

## Claim 6 — Substrate-authored improvement commits

**Expectation:** substrate-authored commits land on `origin/dev` with no operator
intervention, and at least one is causally tied to a measured delta in the expectations above
— the commit's change being the enabling mechanism of the delta, verified by measurement
taken before and after its landing.

**Why the floor exists:** "it fired" is not success. A landing with no measured delta
satisfies nothing, and a landing credited by correlation over the system's own traces is
partly effect-as-cause; the tie must come from a measurement bracketed around the landing.

**Source:** `git log origin/dev` filtered by the substrate git author, cross-referenced to
mitosis-cutover traces. Verify against origin rather than a local mirror or a submodule
pointer — a staged-but-unlanded change reads as landed from the working tree.

## Claim 7 — Human-interaction closure (implicit channel)

**Expectation:** (a) human interaction episodes are durable, solicitation-attributed evidence,
each episode traceable via `solicitation_id` to the substrate output that solicited it;
(b) the solicitation→response rate and the novel-episode-class rate are measured and
non-declining; (c) unmet interaction-expectations are recorded as failures — a
verifier-negative β on the soliciting activity — and never silently dropped, because **the
failure is being unable to reliably get the human to interact in the ways we expect or in ways
that generate novelty**; (d) a substrate-authored obsidian-vessel change beats its own
pre-deploy interaction baseline after deployment.

**Scoring condition:** expectations are scored only when the operator-presence bit in the
environmental state signature was set during the horizon. An absent human is not a surface
failure, and scoring one as a failure poisons the posterior of every soliciting activity.

**Source:** interaction episode records carrying `solicitation_id` and `solicitation_ids`
(obsidian-vessel observation types and episode grouping); `interactionExpectation` verdicts
from the development-vessel interaction-expectation-verify resolver; the `obsidian-behavior-scan`
resolver for behavior drift, and `forward_model_strength` from the `implicit-vessel-scan`
resolver — the sample-weighted mean consistency of the operator forward model, which emits a
gap when it falls below its floor or any unpredictable transition remains.

## Standing invariants (falsifiable now)

These are claims about the present system that the closure loop can verify at any time:

- The reach gate (`verifyGoalReached`, goal-host) runs after execution and β-penalises hollow
  completions; the reward is reaching the goal, not exiting cleanly.
- Failed traces receive a failure-conditioned `repair_signature` at ingest, computed at
  state-space signature version `1f` (shape + provenance + missing + failure mode).
- Per-`(signature, template)` posterior deltas write through to a cluster posterior in the
  same table under a `cluster:<id>` bucket; the write is advisory, so a dropped cluster write
  leaves the leaf posterior fully correct.
- Cold leaves — fewer observations than `SIGNATURE_CLUSTER_N_MIN` (default 5) — read the
  cluster posterior instead of an uninformed Beta(1,1), unless the cluster is contaminated.
  A cluster is contaminated when the spread between its members' success rates exceeds 0.4,
  and a contaminated cluster is never written to and never read from.
- Successor-feature cells (ψ, discounted shape-occupancy) are learned at trace ingest and
  blended into recommend ranking when enabled.
- The learner self-tunes: the `learning_policy` resolver recomputes `TD_LAMBDA` and
  `YIELD_FLOOR` from live posterior statistics, and `learning_policy_writeback` actuates them
  through activity-api's `POST /v2/tuning-params` write seam.
- Only `discovery-vessel` and `identity-vessel` are protected from substrate-authored cutover
  (the mitosis-cutover resolver refuses on those two names); obsidian-vessel is
  substrate-modifiable.
