# Learning architecture review — intended mechanism vs. observed wiring

Thirteen agents, six questions, code-level adjudication with an adversarial citation audit.
Everything below is **code, not behaviour**: this deployment is a spoke that masks `activity-api`,
so no distributional claim here was measured live, and none of the "fixed in commit X" claims were
observed firing. Where a claim rests on a comment in source rather than a measurement, it is marked.

---

## 0. The one-sentence finding

**The positive half of the learning loop is intact end to end; the negative half is severed for
precisely the arm classes the walk actually picks.** The substrate can raise its estimate of an
option and has no working path to lower it. Every other mechanism — decay, exploration bonuses,
retirement, composition preference — then operates on a monotonically non-decreasing signal.

The positive path, verified line by line:

```
reached  →  classifyReach            (activity-api/src/lib/reach-classify.ts:44-63)
         →  stratified (αΔ,βΔ)       (posterior-update.ts:301-375)
         →  variant_performance_metrics UPDATE  (posterior-update.ts:869-880)
         →  SELECT thompson_alpha/beta          (discover-by-shapes.ts:219)
         →  betaSample                          (discover-by-shapes.ts:279)
         →  draw-sort                           (discover-by-shapes.ts:370)
```

The negative path is cut in four independent places. Fixing any one does not restore it.

---

## 1. What "learning" means here

Learning is the fan-out of one graded trace into keyed durable cells. `applyOutcomeToPosteriors`
(`activity-api/src/lib/posterior-update.ts:741`) is the single entry point, and `classifyReach`
(`:762`) makes `reached` — not exit status — the credit signal. That is the right design decision
and it is really implemented. Around it: TD(λ=0.7) chain credit to depth 4, sibling-averaged
(`:553`); cold cells seeded from concept neighbours (`prior-seed.ts:68`); a decayed, 200-bucket-capped
context-conditioned upsert (`:920-960`).

**The defect is that the contextual layer writes and reads different keys.** Every
`context_thompson_scores` *write* hashes the trace's own shape set (`execution-traces.ts:2207-2216`).
Every *read* hashes `impulse_shapes ∪ extractImpliedShapes(task_description)` (`activities.ts:5691`,
`:5967-5975`) — and `extractImpliedShapes` is a **regex over goal prose**
(`utils/semantic-tags.ts:341-370`): the word "test" adds `test_suite`+`source_code`, "error" adds
`error`+`trace`. So the contextual cell key is a function of how a goal is *worded*.

Worse, `recommendExcluding` (`goal-host-vessel/src/index.ts:5265-5268`) sends **no `impulse_shapes`
at all**, so on that path the key is derived from wording alone. And the caller-supplied
`state_signature` that would have made the key explicit is rejected by a `/^[0-9a-f]{16}$/` guard at
`activities.ts:5962`, while the producer emits 8 hex (`development-vessel/src/resolvers/compute-state-signature.ts:225-227`).
**The C6 read-back path has never consumed a live value.**

Net: the unconditional per-variant Beta genuinely accumulates and is genuinely read. Almost every
mechanism layered on top to make learning *contextual* is written into keys its own reader cannot
address.

*Refuted along the way:* the cell key is **not** keyed on step count — `computeStateSpaceSignature`
(`utils/session-context.ts:154-183`) hashes only sorted shapes, provenance, missing shapes and a
version token. The wording defect is real; the step-count one is not.

---

## 2. Learned-durable vs. authored-durable

The doctrine (`docs/architecture/SUBSTRATE_AS_SOFTWARE.md:253-268`) splits state by who may write it:
Authored-durable (template definitions, changed by deploy) vs Learned-durable (posteriors, edges,
goal-paths, changed by the loop), and states nothing in the normal loop writes Authored-durable.

**In the implementation that boundary does not exist.** Both origins enter through one door into one
table. The seed corpus is `SHARED_TEMPLATES` (`ias-executor-ts/src/templates/index.ts:101-133`),
POSTed to `/v2/activities/templates` by `scripts/bootstrap-seeder.ts:56-65`. The learned corpus is
minted by `mintReachedTrace` (`goal-host-vessel/src/index.ts:5410`), which dispatches
`ribosome-extract` whose fifth task writes `activityTemplate_write` — and that handler
(`activity-api/src/routes/impulses.ts:2630`) does `delegateWriteToRouter(c, activitiesRouter, '/templates', …)`.
**Literally re-entering the seeder's endpoint.** The loop writes Authored-durable on every grounded
mint. The doctrinal lift is structurally complete and undeclared.

What was supposed to distinguish them is provenance, and **provenance is decorative**:

| marker | written at | readers |
|---|---|---|
| `extracted_from` | `activities.ts:677-678` | none — in no SELECT projection, no predicate |
| `metadata.author` / `bootstrapTemplate` | mint | none fleet-wide |
| `metadata.goalSignature` | `impulses.ts:2618-2628` | none (only writes; the one goal-host read at `:7885` is of pool-impulse metadata, not a template row) |

The one flag selection *does* consult is `proposed`, which partitions exploration from exploitation
(`activities.ts:6639-6643`) — **and the ribosome does not set it.** `proposed` appears nowhere in
`impulses.ts` or `ribosome-extract.json`, contradicting the comment at `activities.ts:433-437`
claiming "substrate-authored writes flip this on". Only the *declared*-authoring path sets it
(`development-vessel/src/resolvers/activity-create-variant.ts:592-595`). **Ribosome mints land
exploitation-eligible on first contact.**

---

## 3. How you fail the same way twice

Four independent cuts, each verified:

**(a) The M4 all-deterministic exemption is symmetric.**
`const skipVariantUpdate = tierClass === 'all_deterministic'` (`posterior-update.ts:804`) suppresses
the `variant_performance_metrics` write (`:817-820`) *and* the `context_thompson_scores` write
(`:898`). Its stated justification is about credit propagation — but it suppresses **blame**
identically. A shell-only arm keeps its untried prior forever regardless of how many `reached:false`
verdicts it earns. This is the strongest single explanation for a shell satisfier surviving hundreds
of failed executions.

**(b) Retirement's only trigger is on a route the fleet never calls.**
`checkAndRetireTemplate` (`variant-creator.ts:368`; window 20, `successRate < 0.3` at `:417`) has
exactly one live call site: `activities.ts:2477`, inside `POST /v2/activities/executions`. Grepping
`repos/*/src`, `packages/*/src`, `scripts/` for that route returns only tests, one GET from the
workbench (`workbench/src/lib/api.ts:212`), and prompt text handed to an LLM
(`goal-host-vessel/src/index.ts:5989`). The walk's traces go to `/v2/activities/execution-traces`
(`ias-executor-ts/src/adapters/activity-api-trace-sink.ts:244`). **Commit `f2857fc` repaired an
`UPDATE` that has no live caller — correct and inert.**

**(c) The feedback plane's beta lands in a table no selector reads.**
`provide_feedback` and the walk's own `penaliseHollowTemplate` both POST `/v2/activities/feedback`,
whose only posterior write is `impulse_shape_activity_score` (`activities.ts:5355`, `:5386`). Every
SELECT on that table (`activities.ts:5246/:5288/:5337`, `paradigm.ts:1774-1783`,
`activities.scoring.ts:181-190`) is a read-modify-write internal of its own UPSERT. Shape-conditioned
*selection* reads a different object entirely — the view `v_shape_conditioned_score` over `execution`
(`paradigm.ts:1068-1073`). Meanwhile `penaliseHollowTemplate` returns a hard-coded `{dAlpha:0,dBeta:2}`
(`goal-host-vessel/src/index.ts:4896`) after a fetch whose failure is only a `console.warn` (`:4834`),
and that constant is surfaced to the operator as decision transparency. **The penalty number shown is
a literal, independent of whether the POST landed or whether anything reads the table it wrote.**

**(d) A poisoned reached-command is resurrected on every restart.**
`persistReachedCommand` only appends to `/workspace/.goal-host-reached-commands.jsonl`
(`goal-host-vessel/src/index.ts:3268`); `loadReachedCommandCache` (`:3271-3282`) replays last-N-wins
with no tombstone concept. The sole eviction (`:6492`) is an in-memory `Map.delete` **hardcoded inside
the `parseProducerLookup` branch** — one goal phrasing. `POST /reach` with `reached=false` calls it
never. A fabricated command marked wrong is replayed byte-identical after the next boot.

**Two further holes found that nobody had named:**

- `posterior-aggregator.ts:103-119` flushes with `UPDATE variant_performance_metrics … WHERE variant_id = $activity_id`
  and **no UPSERT/CREATE**. A zero-row UPDATE does not throw, so the catch at `:120-137` does not
  re-queue: an arm with no VPM row has its coalesced δ **silently discarded**. The synchronous fallback
  (`posterior-update.ts:869-880`) has the identical hole. Blame is lost for exactly the newly-minted arms.
- `activities.ts:3596-3616` — the auto-promote prune's "trace-store viability guard" **actively rescues
  hollow-green arms**: it refuses to prune a draft when the trace store shows `trRate >= min_success_rate`
  over as few as **one** trace, computed from raw `status`/`success` (`:3500-3503`). Written to defend
  real executions against relevance contamination; against hollow completion it inverts.

And the reason (b)+(c) can coexist with an apparently healthy row: `POST /reach` patches `tags` but
**never updates `execution.success`** (`execution-traces.ts:4096-4260`). Every consumer reading raw
success is permanently blind to the reach verdict on the same record. The honest verdict and the exit
status live in one row and disagree; the older field wins everywhere except `classifyReach`.

---

## 4. Correct information at the correct time

**Delivery is largely solved. Uptake is not.**

The pull-at-prompt-build channel is real and well-built: a reduced, stop-worded, longest-first query
(`goal-host-vessel/src/index.ts:10136-10139`) because concept-db's lexical path is AND-matched, issued
serially at 3 then 1 terms (`:10186-10189`) under a shaped budget (`:10172`), unioned to 5 rows at
1600 chars (`:10207-10231`), prepended to target inference (`:10394`) and threaded into argument
synthesis (`:6013-6014`). The server honours it — BM25 ladder first, dense/ONNX only on a lexical miss
(`concept-db/src/resolvers/concept.ts:449-531`).

Then the channel terminates in an LLM reproduction step whose measured fidelity on the artifact that
matters is zero: a verified working command, delivered intact (`chars=1687 via=opts`), reproduced
correctly **0 times in 45 dispatches** (`index.ts:6019-6021` — a comment recording a measurement, not
a measurement I made). The deterministic bypass written for exactly that failure — verbatim execution
(`:6038-6052`) — fails closed to OFF (`:1092-1125`). **See §5: it is off in every deployment.**

This is the session's asymmetry stated structurally: the one channel that works by construction is
`index.ts:4183-4196`, which *runs* the earned recipe and injects the measured output as a fact.
Everywhere a deterministic signal is available but demoted to advice for an LLM judge
(`feature-compose.ts:1039`, `:1287`), the same failure recurs.

Three unclosed key mismatches of the producer-key ≠ consumer-key class:

- The walk queries **goal** tokens, but the writeback stores the goal only in unindexed
  `conceptData.metadata` (`index.ts:9469-9475`) while the only FTS indices are on `content` and
  `summary` (`concept-db/sql/core/004-bm25-search.surql:33,35`). Retrieval succeeds only when the
  *answer* text happens to share the new goal's rare tokens.
- The disjoint-hash bug was patched but not removed: `:6012`, `:6013`, `:6040` still fall back to
  `_recalledLessons.get(goalHashOf(goal))`, and the log reports `via=hash-fallback` as a normal
  outcome rather than a known-broken path.
- **The ReAct floor is outside every law-8 channel.** `universalToolFallback` (`:4157`; callers
  `:10795`, `:11022`) has no lessons parameter — neither `walkConceptContext` nor `_dispatchLessons`
  reaches the component that actually runs the commands. Recall stops one hop short in the component
  with the widest blast radius.

---

## 5. Shape flow

The mechanism is exactly as designed and every load-bearing claim survives inspection. A shape is
`impulse.metadata.shape` (`IMPULSE_ACTIVITY_FOUNDATION.md:147`); the pointer *is* the shape and all
resolution and learning key on it (`:63`); the vocabulary is learned, not declared (`:67`). Two indices
over different populations — discovery's in-memory `shapeIndex: Map<string, Set<vesselId>>`
(`discovery-vessel/src/registry.ts:32`, `:260-265`, read at `:343`) and activity-api's
`input_shapes`/`output_shapes CONTAINSANY` with `retired = false`
(`discover-by-shapes.ts:178-190`). The walk's medium is `producedShapes`/`poolImpulses` with
shape-keyed dedupe on add (`index.ts:5800-5802`) and `{{shape}}` interpolation on bind (`:5804-5812`);
true backward chaining is the `target.add(s)` recursion at `:8608-8618`.

**The law-1 remediation is itself a reader with no writer.** `walkBudget` and `lessonExecutionPolicy`
occur nowhere in the tree except the single file that reads them (`grep -rln` over `repos/*/src`,
`packages`, `scripts` returns only `goal-host-vessel/src/index.ts`), and the live discovery registry
advertises neither. So:

- every walk-geometry and floor-depth knob still comes from process-frozen literals (`index.ts:4037-4040`)
  and env vars (`:5746`, `:8460`, `:10566`);
- `lessonVerbatimAllowed` (`:1092-1125`) fails closed on an unresolvable shape, so **verbatim lesson
  execution is permanently OFF in every deployment** — the deterministic answer to the 0/45
  reproduction failure cannot ever fire.

The shaped-impulse channel was built end to end on the read side and left dark on the write side. The
violation it was written to remove is still the live behaviour on every dispatch. *(This is my own
change from the previous session. The reader shipped; the producer did not.)*

Other law-1 violations still live, worst on the learning plane itself: `GRADED_YIELD_SUCCESS`,
`SF_BLEND`, `SUCCESSOR_FEATURES`, `EMBEDDING_PRIOR_ENABLED`, `PRIOR_SEED_ENABLED` silently change how
posteriors update while no trace records which way they were set; `EMPIRICAL_BADNESS_MIN_OBS` / `_MIN_RATE`
(`activities.ts:5921-5923`, defaults 20 / 0.02) gate a selection-critical predicate from `process.env`;
`CONCEPT_DENSE_BUDGET_MS` (`concept.ts:513`) does the same on the law-8 hot path.

**And a counterfeit posterior in the middle of pathway reuse.** `readCandidateShapes`
(`index.ts:5636`) fabricates a Thompson draw when a row carries α/β but no server score:

```js
(Math.random() ** (1 / alpha)) / (Math.random() ** (1 / beta))
```

That is not a Beta sample — Jöhnk's method is `X/(X+Y)`, not `X/Y`, and is valid only for α,β < 1. The
expression is unbounded above 1 and exceeds 0.5 for most draws even on an untried `Beta(1,3)` arm. It
feeds `scaffoldRank`'s `sampledScore > 0.5` gate (`producer-pick.ts:34`) — the "earned posterior
evidence" test for the −1 learned-pathway reuse bonus. It is live on the `/v2/activities/recommend`
path, which never emits a top-level `sampled_score` (its Beta draw is under `selection_metadata.score`,
`activities.ts:6488`, which the normaliser does not read). **The reuse bonus is granted on a counterfeit
posterior.** The same expression also accepts `composition_score` — a success/execution ratio over a
different denominator — as a substitute.

Finally: the ReAct floor is excluded for edit-intent goals (`index.ts:11021`,
`&& !goalIsEditIntent`). The execution expectation's floor does not cover the code-change class — the
class self-development depends on.

---

## 6. Continuity of state

Physically two Docker volumes: `substrate-workspace:/workspace` and `substrate-surreal:/var/lib/surrealdb`
(`scripts/substrate/docker-compose.yml:82-84`); valkey is explicitly scratch (`--save ""`).

**Durable learning state is append-only in practice.** Every store that decides what to do next
accumulates positive evidence and has no working path to "stop selecting this":

- **Decay is conditional on the writes that are severed.** Decay *is* applied — but on **write**
  (`posterior-aggregator.ts:102`, `posterior-update.ts:820-830`), not on read; `discover-by-shapes.ts`
  contains no `decay` at all. An arm that never receives another VPM write never ages — which is
  exactly the M4-exempt shell arms and the rows the zero-row UPDATE silently skips.
  *(This corrects a report claim that decay is absent from the main path; it is conditional, not absent.)*
- **The pool never forgets.** `'consumed'` / `'retired'` exist as a union member
  (`development-vessel/src/resolvers/pool-impulse.ts:14`) with **zero writers**, and the read defaults
  to `status='open'` (`:48`). The confidence-gated consumption the design describes is not merely
  unenforced — it is unreachable. `saveImpulses` (`:31-38`) rewrites the entire `standing.json` on
  every write with no compaction or TTL, so write cost grows linearly with total history.
- **Gap ordering rewards chronic failure.** `SubstrateGapReadPointer` has no `sort` field
  (`substrate-gap.ts:111-126`) and the resolver hard-sorts `updated_at desc` (`:267`), so boredom's
  `sort:"disposition_scored"` (`boredom-vessel/src/goal-generation.ts:107`) — law 7's "learned
  disposition" made concrete — is **silently dropped on arrival**. Meanwhile `gap-to-feature.ts:1960-1972`
  rewrites the parent on each failed attempt, refreshing its `updated_at`. A gap is promoted for
  failing. And the narrowed child drops the parent's `severity`/`priority_hint` (`:1985-1997`), so the
  decomposed successor of a critical gap scores at the 1.0 floor.
- **Retention is detect-only.** `db-admin-repair.ts:170-190` has working soft and hard prune SQL that
  no caller ever authorizes — `db-maintenance-tick.ts:96` never passes `apply:true` (contrast the
  repair call at `:88`).
- **The one artifact by which rhythms inject concrete work is both undrained and non-durable.**
  `boredom-enqueue.ts:5-8` defaults to `$HOME/.minibob/boredom-queue.json` — **inside the container
  filesystem, on neither named volume** — and the only reader in the fleet is the conductor's own
  self-dedup, gated on an optional pointer (`rhythm-conductor-tick.ts:185-190`).
- **The one path that reacts to repeated failure has no scoring gate.** Chronic gap failure fires a
  direct `POST /run-goal` (`gap-to-feature.ts:1999-2005`) bypassing boredom's entire condition-folding
  selection — priority weights, UCB, cold-pick damping, in-flight caps.

What *does* close: `boredomSelectionSnapshot` is genuinely resolved into goal-host's feed
(`index.ts:213-219`) along with rhythm due-state (`:216-236`). That observability loop works.

Law 5 is otherwise not honoured: FTS rebuild, signature clustering, accelerator flagging, trace
replication and the learning-track classifier are all `*_INTERVAL_MS` env vars read at process start
(`activity-api/src/index.ts:633, 680, 689, 726, 1001`; `jobs/learning-track-classifier.ts:21`).

---

## 7. The recurring defect class

Every question landed on one shape: **a half-wired channel — a field written with nobody reading it,
or a policy read with nobody writing it.**

| written, no reader | read, no writer |
|---|---|
| `extracted_from`, `metadata.author`, `metadata.goalSignature` | `walkBudget`, `lessonExecutionPolicy` |
| `impulse_shape_activity_score` (feedback beta) | satisfier posteriors the walk consults to condemn |
| `boredom-queue.json` | `ancestor_signatures` override field |
| `lessons.json` (`lessons-updater.ts` has no importer) | `sort:"disposition_scored"` |
| `_sf_successor_value` (`activities.ts:6597`, read only by its own log counter) | `state_signature` (rejected by a length regex) |

A single detector closes most of this class and does not exist: **for every field a resolver writes,
assert at least one non-test, non-self SELECT/read exists on the read path.** That is law 6's third
question — what activity would detect this class without me — and the answer is currently nothing.

---

## 8. Ranked repair order

1. **Restore the sign of learning.** Make `reached:false` reach a store selection reads, for shell
   satisfiers specifically: make M4's exemption asymmetric (suppress credit, keep blame), or move the
   feedback beta into `variant_performance_metrics`.
2. **Give retirement a live caller.** Invoke `checkAndRetireTemplate` from the `execution-traces`
   ingest path, where the walk's traces actually land.
3. **Make eviction durable and class-wide.** Tombstone the reached-command JSONL on `reached=false`,
   not a single-phrasing in-memory delete.
4. **Ship the producers for `walkBudget` and `lessonExecutionPolicy`** — the readers are already
   deployed and correct, and one of them gates the only non-persuasive fix for the 0/45 reproduction
   failure.
5. **Fix the counterfeit Beta draw** at `index.ts:5636`, or drop the reuse bonus until a real
   `sampled_score` is available on the recommend path.
6. **Make the cts read key the write key** — either send `impulse_shapes` from `recommendExcluding`,
   or accept the 8-hex `state_signature` the producer actually emits.
7. **Add the written-with-no-reader detector** (§7). Without it this class regenerates.

---

## 9. What this review did not establish

- No behaviour was observed. Every claim is static. The spoke masks `activity-api`.
- Several load-bearing figures are **comments in source asserting measurements** — the 0/45
  reproduction count, "3,849 activities", "202 executions and 0 successes", "~4% of traces carry
  `input_impulse_shapes`", "132 consecutive composes got the same eight rows". The line numbers are
  real; the numbers are uncorroborated.
- **The relevance plane is entirely unaudited.** CLAUDE.md names three learning channels — Thompson
  grades activities, *relevance scores grade impulses*, the ribosome extracts templates. Six reports
  covered Thompson exhaustively and produced **not one citation** into a relevance-score writer or
  reader. Given this document's base rate, the prior that it is also half-wired is high.
- **Nobody opened the ribosome vessel's own extractor source** — the component law 4 names as the
  proper origin of every activity.
- `metadata.goalSignature: "null"` (the four-character string) was observed on a real mint and not
  chased.
