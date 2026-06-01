# Display signature partitioning (cardinality lift + display tier + EB prior)

## Why

The signature-conditioned posterior path
(`repos/metabob-activity-api/src/lib/posterior-update.ts:~486`,
`v_shape_conditioned_score` consumer) has a hard ceiling:

```ts
const CARDINALITY_CAP = parseInt(process.env.SIGNATURE_CARDINALITY_CAP ?? '200', 10);
// ... in the LET/IF/CREATE block ~lines 487-533:
// ELSE IF $cardinality < $cap THEN CREATE context_thompson_scores ...
```

Once a template has 200 distinct signature buckets, **new signatures silently
fail to create a row** — the `ELSE IF $cardinality < $cap` branch is the only
CREATE path, and there is no fallback. UPDATEs against existing buckets keep
firing; UPDATEs against the would-be-new bucket don't fire because there's no
row. The signature-conditional channel goes dark for the long tail.

For activity templates that operate over **display traces** (an operator's
desktop is a stream of new windows, modals, animation frames), each fresh
window produces a distinct shape signature via
`computeStateSpaceSignature` (`src/utils/session-context.ts:~141`). 200
buckets is one workday. After that:

- New windows contribute only to variant-level posterior
  (`variant_performance_metrics`), losing per-context conditioning entirely.
- The selector's `v_shape_conditioned_score` falls back to the variant-class
  prior, which is the across-context policy — the wrong policy for a high-
  cardinality input class.

Two further problems compound this for display:

1. **Wrong default prior on fresh buckets.** Today the CREATE branch starts at
   `(alpha: 1.0 + Δα, beta: 1.0 + Δβ)` — a flat Beta(1,1). The
   `2026-05-30-info-gain-bonus-on-success` proposal already discounts redundant
   successes via `1/(1+n)`, but on the *first* success of a fresh display
   signature, n=0 and the bonus is 1.0 — a full step against a flat prior.
   Most fresh display signatures are noise (transient modals, animation
   frames, hover popovers). A flat prior treats them as as-likely-to-be-good
   as a fresh signature for a load-bearing UI affordance.

2. **PII / adversarial conflation via free-text concatenation.** Display
   signatures derived from raw OCR text mix functional content ("Submit",
   "Cancel") with identifying content (account names, document titles).
   `computeStateSpaceSignature` is shape-only today, but the upcoming
   display-perception work needs to feed *what is on screen* into the
   signature without becoming a PII sink, and without letting a
   Firefox-impersonator window inherit Firefox's learning by spoofing
   identical OCR text.

3. **Reversibility-class conflation.** A "click Submit on a draft
   composer" and a "click Submit on a wire transfer form" share most of
   their signature inputs (the same icon, same caption-class) but have
   wildly different reversibility properties. Bucketing them together would
   pollute Thompson on the irreversible side with the reversible side's
   forgiving feedback. The wrong fix is to scale β by reversibility (breaks
   Beta interpretability); the right fix is to **partition** the signature
   so the irreversible case accrues its own bucket.

## Empirical motivation

- 8-cycle controlled probe (concept `concept_WikGVLa5d6kp`,
  `selector_anchor_vocabulary_gate`) showed per-`(signature, template)`
  posteriors remained near-uniform — sparse signature growth was the
  symptom, but the underlying state-aggregation layer is already too coarse
  even at low cardinality. At display cardinality (1000s/day), the existing
  cap turns the channel off entirely.
- `concept_HKlz4FAc2cpf` (`substrate_self_fix_pattern`) — the substrate
  already detects and reasons about its own state asymmetries; this
  proposal removes one of the asymmetries it cannot self-fix because the
  cap is enforced server-side in SurrealQL.

## What changes

### Phase A — Lift the cardinality cap

- Convert `SIGNATURE_CARDINALITY_CAP` (`posterior-update.ts:~486`) from a
  constant-per-process env to a **per-template setting** read from
  `activity_template.signature_cardinality_cap` (column added in migration).
  Default 200 stays for general templates; display-tagged templates default
  to 5000.
- Add an **LRU eviction** path at write time: when `$cardinality >= $cap`
  and we are about to skip a CREATE, instead evict the
  oldest-`last_updated_at` row whose `n_observations` is below a configured
  floor (default 3 — i.e. evict only never-confirmed signatures). The CREATE
  then proceeds.
- Emit a `signature_bucket_evicted` log event per eviction so the
  selection layer can mine sink-evictions later.

### Phase B — Coarsening tier for display

Add an optional `tier` parameter to `computeStateSpaceSignature`
(`src/utils/session-context.ts:~141`):

```ts
type SignatureTier = 'default' | 'display' | 'display+source_app';
```

- `default` — today's behavior (`v1` or `v1c`).
- `display` — projects raw display-derived shapes through a coarsener
  before hashing: shapes are reduced to the **sorted unique set of
  icon-label-classes and functional-caption-classes** (the latter derived
  from a `functional_caption_classifier` impulse that maps "Submit",
  "Send", "Confirm" → `submit_action`; "Cancel", "Back" → `cancel_action`;
  etc.). Raw OCR text never enters the hash input. PII risk reduced to
  the cardinality of the classifier output.
- `display+source_app` — adds the discrete `source_app_id` token to the
  hash input (NOT concatenated to caption text — separate field). A
  Firefox-impersonator that produces identical icon-label-classes still
  hashes to a different bucket because `source_app_id` is signed by the
  display-vessel and unforgeable client-side.

Selector callers pass `tier` based on the template's
`signature_tier` field (added to `activity_template` in the migration).

### Phase C — Hierarchical empirical-Bayes prior

Replace the flat `(1.0, 1.0)` prior on the CREATE branch
(`posterior-update.ts:~516-517`) with a per-template aggregate prior:

- New SurrealDB view / materialized roll-up
  `template_signature_aggregate { template_id, alpha_0, beta_0,
   n_signatures_observed, last_recomputed_at }` keyed on `template_id`.
- Recomputed on a periodic tick (every 15 min) as
  `alpha_0 = mean(alpha across signatures of that template)`,
  `beta_0 = mean(beta)`. Bootstrap value `(1.0, 1.0)` for templates with
  fewer than 5 observed signatures.
- The CREATE branch reads `(alpha_0, beta_0)` from the roll-up and starts
  the fresh bucket at `(alpha_0 + Δα, beta_0 + Δβ)`.
- Composed with the info-gain bonus from
  `2026-05-30-info-gain-bonus-on-success`: fresh display signature gets a
  full info-gain step but against an informed prior, not a flat one.

### Phase D — Partition dimensions

Add three discrete signature dimensions to the bucket key, NOT free-text
concatenation:

- `source_app_id` — already covered by Phase B for the
  `display+source_app` tier; also surfaced as a separate column on
  `context_thompson_scores` for query-side partitioning.
- `source_window_id` — finer-grained than source-app (a Firefox window
  with a banking tab is partitioned from a Firefox window with a YouTube
  tab). Optional; templates opt in via `signature_partitions` field.
- `reversibility_class` — `reversible | reversible_with_confirmation |
  hard_irreversible | unknown`. Templates that act on irreversible
  surfaces (file deletion, wire transfer, message send) emit this
  partition so the irreversible bucket accrues its own posterior. β is
  NOT scaled by reversibility — partitioning is the only mechanism.

Migration adds the columns with `OPTIONAL` so existing rows remain valid.
The WHERE clause in the LET/IF/CREATE upsert (`posterior-update.ts:~487`)
extends to include the three new dimensions when present.

## Out of scope

- The actual display peer-vessel (`display-vessel` openspec, separate).
- OmniParser / detection-model details (`display-perception` openspec).
- Operator-hotkey consent-revocation mechanism (`display-control` openspec).
- Changes to `propagateCreditAlongChain`'s ancestor-signature handling —
  ancestor signatures inherit the tier of the ancestor template, not the
  leaf, and that path is unchanged by this proposal.

## Dependencies

- Ships before any display-vessel posterior writes. Without Phase A,
  display-derived writes silently drop after bucket 200. Without Phase B,
  raw display content enters the hash and becomes a PII sink. Without
  Phase C, fresh display signatures over-update against a flat prior.
- Builds on `2026-05-30-info-gain-bonus-on-success` — that proposal
  introduces the `1/(1+n)` success-discount; this proposal adds the
  partition dimensions and informed prior that the discount composes with.
- Builds on `2026-05-30-event-driven-novelty-surface` — novelty events
  consume the per-tier signature so a novel display signature surfaces as
  a novelty impulse without firing for every transient modal.

## Risk

- **Storage pressure from lifted cap.** A 5000-bucket display template
  consuming roughly 200B/row is 1MB/template. LRU eviction floors the
  steady-state at the configured cap. Mitigation: eviction emits a log
  event so over-aggressive caps surface as observable noise.
- **EB prior under-weights genuinely-good fresh signatures.** A template
  with mostly-bad population mean would inherit a low α₀ prior, biasing
  fresh-bucket exploration toward β. Mitigation: composed with the info-
  gain bonus, which gives a full +1 α-step on the first success
  regardless of prior. The prior only sets the *baseline*, not the
  *step size*.
- **Tier misconfiguration drift.** A template tagged `default` but
  consuming display shapes would still hash raw shapes and recreate the
  PII conflation problem. Mitigation: shape-dispatch-check
  (`packages/shape-dispatch-check/`) extended to assert templates
  consuming display-typed shapes carry a `signature_tier` of `display`
  or finer.
- **Partition explosion.** All three Phase D dimensions enabled
  simultaneously on a template can multiplicatively explode bucket
  cardinality (apps × windows × reversibility-classes). Mitigation:
  per-template `signature_partitions` opt-in list; default empty.

## Companion concepts

- `concept_WikGVLa5d6kp` — `selector_anchor_vocabulary_gate` (8-cycle
  finding: sparse posteriors when state-aggregation is too coarse).
- `concept_HKlz4FAc2cpf` — `substrate_self_fix_pattern` (substrate-side
  detection of the asymmetries this proposal closes).
- `concept_MNYEq7xc_46U` — `architectural_asymmetry` (F25 root cause
  framing).

## Related openspecs

- `2026-05-30-info-gain-bonus-on-success/` — the success-discount this
  proposal composes against.
- `2026-05-30-event-driven-novelty-surface/` — novelty channel that
  consumes per-tier signatures.
- `2026-05-30-trace-to-concept-mining/` — supplies the trace history the
  Phase C EB roll-up draws from.
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` — the
  Functional→Vessel arrow this proposal indirectly unblocks for
  display-handling vessels.

## Graph-RL framing

- **Cap lift = correctness of the state-aggregation function.** Today's
  fixed cap is an arbitrary cutoff on the partition function; replacing
  with LRU + per-template tuning restores correctness.
- **EB prior = informative shrinkage.** Frequentist count-based bonuses
  alone (info-gain `1/(1+n)`) shrink toward the *uniform* prior; pairing
  with EB α₀/β₀ shrinks toward the *template-class population mean* —
  the standard hierarchical-Bayes correction for the small-sample-fresh-
  bucket regime.
- **Partition dimensions = action-class-aware Q-table.** Reversibility
  as a partition dimension reframes the bucket key as
  `(state, action-class)` rather than `(state)` alone — closer to the
  actor-critic factorization the eventual display-control work needs.
