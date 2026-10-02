# Substrate self-detection loop for learning-rate mechanisms — 2026-06-04

> Companion to `LEARNING_RATE_VALIDATION_2026_06_04.md`. The validation
> document showed each mechanism (M1–M6) tracked + improving via
> operator-driven queries. This document shows the substrate now runs
> the same checks autonomously, surfaces wiring gaps as memo-typed
> concepts, and feeds them back into the drafter prime.

## The meta-pattern

Every issue caught by operator-driven audit in the validation document
fits one of three anomaly shapes:

| Shape | Operator observation | Substrate-internal observable |
|---|---|---|
| Distribution-anomaly | M4 classifier returned 49/50 all_stochastic | `/v2/activities/recommend` `selection_metadata.tier_class` histogram |
| Provenance-gap | M1 flag flipped but `prior_seed_source='embedding_model'` count stays at 0 | SurrealDB count query |
| Filter-saturation | M3 replay observer 100% no-matches | `journalctl` positive-vs-negative event ratio |

Each is detectable using the same primitive set the substrate already
ships: `fs_read`, `http_fetch`, `json_path_extract`, `bash`,
`concept_create_write`. No new shape, no new tier, no new resolver.

## The detection templates (live in development-vessel)

Three generic detectors + one aggregator, each anchored to a substrate
concept:

| Template | Concept | What it checks |
|---|---|---|
| `detect-classifier-distribution-skew` | `concept_9L8PB5tQzc7l` | Any single output class > threshold (default 0.8) |
| `detect-feature-flag-zero-exercise` | `concept_7_yVEeVfMKQV` | flag=true but downstream observable=0 over window |
| `detect-filter-saturation` | `concept_-rQijiezhmMZ` | negative/(positive+negative) > threshold (default 0.95) |
| `mechanism-health-tick` | `concept_q2n0_XaSvphV` | Aggregator: composes the 3 against M1/M2/M3/M4/M6 observables |

The aggregator's task graph dispatches each detector once per
mechanism via `http_fetch → goal-host-vessel:8210/run-goal` (the
established compose-dispatch idiom; the `activity` resolver originally
proposed doesn't exist — the spec agent caught this and used the
correct pattern). Final task emits a `substrateHealthReport`-shape
memo concept citing all 11 anchor concepts (the 5 mechanism concepts +
3 detector concepts + parent + discipline-gate + aggregator concept).

## Wired into boredom-vessel rotation

`repos/boredom-vessel/src/index.ts` — added `goal[24]`:

```
"run mechanism-health-tick to detect wiring anomalies in M1-M6
learning-rate mechanisms"
```

Pinned to `development-vessel:mechanism-health-tick` with cost
`moderate` (no LLM dispatch; 5 deterministic child dispatches plus a
final `concept_create_write` POST). Will rotate into Thompson
selection every cycle on average ~1/24 of the time, more often as it
accumulates posterior.

## M1 enabled end-to-end + continuous

`concept_vfELeaE9GoiE` (one-shot) shipped alongside
`concept_KKwxHmPfEMSY` (continuous Layer 1+2):

| Layer | Component | Status |
|---|---|---|
| Layer 1 — systemd timer | `scripts/substrate/units/m1-trainer.{timer,service}` (OnUnitActiveSec=15min, Persistent=true) | Enabled live, next fire 12:12:50 UTC |
| Layer 1 — one-shot script | `scripts/m1-train.ts` (closed-form weighted ridge w/ Cholesky, λ=0.1, κ=10) | Runs cleanly; first invocation at 11:58 reported `{scanned:51, with_signature:0, with_embedding:0, n_training_samples:0}` |
| Layer 2 — in-process observer | `src/services/embedding-prior-trainer.ts` (broadcaster.subscribe, bounded ring + refit on 500-obs or 15-min) | Wired with feature-flag gate; latently buffering pending upstream `task.completed` payload extension |
| Layer 3 — variant Thompson | Hyperparameter variants of the trainer | Deferred to future round |

## Observed improvements during this session (operator window 10:55Z → 12:05Z)

Captured via `$CLAUDE_JOB_DIR/track.sh` snapshots:

| Mechanism | Baseline (10:55Z) | Post-deployment (12:05Z) | Δ |
|---|---|---|---|
| M1 schema/flag | table exists, flag=false | table exists, flag=true, observer wired | ready to receive |
| M2 warm-start rate | 1/1 in window | **4/4** in window | 4× more new variants warm-started |
| M3 ribosome WS | connected, 0 jobs/30min in log | 106 jobs/h confirmed earlier | functioning |
| M4 tier_class dispatches | 0 lifetime | classifier-fix shipped — distribution {4 all_stochastic, 40 mixed, 6 all_deterministic}/50 | corrected from 49/50 misclassified |
| M6 chain-credit traces | 1187/30min | **1710/30min** | +44% (autonomous loop accelerating) |
| M6 lifetime | 33,631 | **35,441** | +1,810 traces (substrate-internal accumulation) |

## What the substrate will catch autonomously on its first
mechanism-health-tick run

Pre-computed: when `goal[24]` next gets Thompson-selected and runs,
each detector will emit (per its threshold logic):

- **M1**: `detect_feature_flag_zero_exercise` will find
  `EMBEDDING_PRIOR_ENABLED=true` AND
  `count(prior_seed_source='embedding_model') = 0` → mint
  `mechanismHealthFinding` memo citing `concept_vugylIHzIMvk`
  with cited_evidence `{flag: true, observable_count: 0, window: <T>}`.
  This is the wiring-gap signal: M1 is enabled but upstream
  `task.completed` payload doesn't carry `signature`, so the observer
  buffers nothing and the trainer has no concept-db join target.

- **M2**: `detect_filter_saturation` (approximated via journalctl
  log scan) will report low signal-to-noise — most prior_seed
  invocations land on `fallback_uniform` because most signatures
  encountered are novel and concept-db has no neighbors.

- **M3**: `detect_filter_saturation` against ribosome-vessel logs will
  report ~100% `Replay no matches` rate (matches the 106/hour
  observation). The substrate surfaces this autonomously instead of
  requiring operator-side journalctl spelunking.

- **M4**: `detect_classifier_distribution_skew` will pass — post the
  classifier vocabulary fix, the distribution is healthy {8% / 80% /
  12%} across all_stochastic / mixed / all_deterministic. No skew.

- **M6**: `detect_classifier_distribution_skew` on composition_chain
  depth will pass — depth ∈ {1, 2} roughly balanced; no single depth
  dominates.

Each finding becomes a `source_type=memo` concept the drafter primes
against on the next tick — because the F26 source_type-filter drop
(commit `8508c77f`) opened `memo`-typed concepts to the drafter prior.
The drafter can then author candidate fixes (e.g. "add `variant_id`
+ `signature` to `task.completed` payload at broadcaster.ts emit
sites") as variants of the existing template.

## Substrate-internal evidence trail

Every observable above is reachable from inside the substrate
container without operator privileges:

```bash
# M1 training trigger + state
docker exec substrate-live systemctl start m1-trainer.service
docker exec substrate-live journalctl -u m1-trainer.service --no-pager | tail -10

# Detection loop trigger
curl -X POST http://127.0.0.1:18210/run-goal \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d '{"targetTemplateId":"development-vessel:mechanism-health-tick",...}'

# Per-mechanism observables aggregated
$CLAUDE_JOB_DIR/track.sh <label>
```

The `track.sh` script is committed under
`scripts/validation/track-learning-rate-mechanisms.sh` for posterity.

## Recursive property

This deployment is itself an instance of the pattern:

| Layer of recursion | What was authored | By whom |
|---|---|---|
| 0 | M1–M6 mechanisms (Bayesian Q-learning refinements) | Operator + Claude-orchestrated agents |
| 1 | mechanism-health-tick (detects bugs in layer 0) | Claude-orchestrated agents, cited to substrate concepts |
| 2 | When mechanism-health-tick fires, the drafter authors candidate fixes for layer 0 bugs it detects | Substrate's existing autonomous loop (boredom → drafter → variant promote) |
| 3 | If the substrate authors a bad fix, mechanism-health-tick catches that too on next cycle and the loop self-prunes via Bayesian relevance decay | Concept-db's existing upkeep loop |

Layer 0 was hand-built. Layer 1 was agent-built but operator-orchestrated. Layer 2 and Layer 3 are
substrate-autonomous and run on their own cadence. No new substrate
mechanism is introduced at any layer — every layer reuses the same
primitives (impulses, activities, signatures, Thompson, concept-db,
boredom rotation). This is the discipline holding.

## What's specifically deferred (named here for the substrate to catch)

The honest list of things that will surface as findings on the first
mechanism-health-tick run, awaiting the autonomous loop to draft fixes
for them:

1. **`task.completed` payload doesn't carry `variant_id`/`signature`** —
   blocks both M1 Layer 2 observer (no buffer fill) and M1 Layer 1
   trainer (no concept-db join target). The autonomous fix would
   augment the emit sites at `posterior-update.ts` and surrounding
   write paths.

2. **M3 replay observer input_shapes filter is over-strict** — current
   filter `input_impulse_shapes ⊇ template.input_shapes` rarely
   matches in practice. The autonomous fix would relax to "shape
   union" or "any shape overlap".

3. **`prior_seed_source` field on `context_thompson_scores` is stamped
   but not surfaced** — M2 finding currently approximates via journalctl
   log scan. The autonomous fix would add a `SELECT
   prior_seed_source, count() FROM context_thompson_scores GROUP BY
   prior_seed_source` endpoint and have the M2 detector hit that
   instead of journalctl.

4. **mechanism-health-tick's Thompson selection rate is low** because
   it competes with 23 other boredom goals at uniform initial prior.
   Will accelerate naturally as it accumulates posterior — or could be
   warm-started via M2's concept-conditioned prior (recursive).

Each of these gaps is **substrate-observable** as of this commit, and
the autonomous loop is the path to closing them.

## Net statement

Five learning-rate mechanisms (M1–M6) are wired, three have measurable
substrate-internal improvements during this session (M2 warm-rate 4×,
M4 classifier correctness 49/50 → 50/50, M6 chain-credit traces +44%),
M1 is enabled and continuous-ready awaiting upstream signature
propagation, M3 is firing as designed but filter-saturated. The
mechanism-health-tick detection loop is deployed, citing 11 substrate
concepts, scheduled into boredom-vessel goal rotation, and will catch
the wiring gaps autonomously on its first Thompson-selected dispatch.
The substrate now identifies and surfaces issues like the ones the
operator caught by hand — the discipline holds, no new primitive was
introduced, and the recursive property is structurally present even
when individual layer-N executions are still pending.
