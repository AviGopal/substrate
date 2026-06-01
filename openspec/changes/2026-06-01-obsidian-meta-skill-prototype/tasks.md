# Tasks — Obsidian meta-skill prototype

Phased task list. Each phase has a single acceptance criterion gating
the next.

## Phase 1 — Shipped infrastructure (Layers 0–1 + action-effect probe)

Goal: emit `obsidianEvent` / `obsidianEpisode` impulses and an
`actionEffectModel` per command. No authoring loop yet — Phase 1 is
the observation substrate the loop reads from.

- [ ] **1.1** — Register shapes `obsidianEvent`, `obsidianEpisode`,
  `actionEffectModel`, `recurringPatternCluster`,
  `authoredActivityCandidate`, `intentLabel`, `trajectoryPrediction`,
  `assistanceAction`, `comprehensibilityScore` in the concept-db
  shape catalog (`repos/concept-db/src/shapes/obsidian.ts` — new
  file). Bridge-eligibility: deny for raw `obsidianEvent` and any
  shape that carries hashed payloads of vault content; allow for
  episode-level and aggregate shapes.
- [ ] **1.2** — Seed `observe-obsidian-events` in
  `repos/development-vessel/src/seed/observe-obsidian-events.ts`.
  Subscribes to workspace + vault events, emits `obsidianEvent`
  impulses with payload-hash-only contents.
- [ ] **1.3** — Seed `group-interaction-episodes` in
  `repos/development-vessel/src/seed/group-interaction-episodes.ts`.
  Windowing resolver; emits `obsidianEpisode` with sorted-unique
  class signature.
- [ ] **1.4** — Seed `probe-obsidian-action-effects` in
  `repos/development-vessel/src/seed/probe-obsidian-action-effects.ts`.
  Runs against a probe vault (not the operator's). Emits one
  `actionEffectModel` per `command_id` with pre/post signature
  distribution and observed reversibility class.
- [ ] **1.5** — Add `prediction_disagreement` to the failure-mode
  taxonomy in `repos/metabob-activity-api/src/models/schemas.ts`
  with sub-cases `intent_inconsistency`, `trajectory_divergence`,
  `action_no_effect`. Migration adds the column as `OPTIONAL`.
- [ ] **1.6** — Wire Phase 1 activities into `bun run cli
  seed-templates`.

**Acceptance for Phase 1:** with the Obsidian plugin loaded against a
test vault, an end-to-end traversal emits ≥ 1 `obsidianEvent` per
human action, episodes group correctly, and `probe-obsidian-action-
effects` produces a non-empty `actionEffectModel` catalog. No
authored activities yet.

## Phase 2 — Drafter prompt + comprehensibility check

Goal: an operator-triggered `draft-activity-from-pattern` call can
take a hand-built `recurringPatternCluster` and produce a passing
template. Pattern detection is still manual at this phase; auto-
detection is Phase 3.

- [ ] **2.1** — Implement `draft-activity-from-pattern` in
  `repos/development-vessel/src/seed/draft-activity-from-pattern.ts`.
  Iterative two-step prompt (prune vocabulary → draft against
  pruned set). Inputs per design §7.5.
- [ ] **2.2** — Implement `comprehensibility_check` resolver in
  `repos/metabob-activity-api/src/resolvers/comprehensibility-check.ts`
  (sibling of `convergent_validity_check`). Emits
  `comprehensibilityScore`. Auto-promote refuses templates below the
  configured floor (default 0.6).
- [ ] **2.3** — Add registration-time validations enumerated in
  design §11: input-shape producer-or-seedable check, compose-target
  existence check, `max_composition_depth` budget propagation
  (extends the existing `parent_execution_id` depth=16 guard at
  `activity-api` GET-handler walk).
- [ ] **2.4** — Enforce the comprehensibility discipline in the
  drafter prompt body with worked examples (self-describing names,
  citations, composition rationales, provenance markers,
  substantive descriptions). Reference example for citation form:
  `service_oom_cascade_scan` cites `concept_RYl73llSCGfc`,
  `concept_6RwK5H5F28hT`.
- [ ] **2.5** — Periodic re-check schedule: `comprehensibility_check`
  re-runs each authored template every 7 days using a second model
  provider. Configurable via env; default enabled.

**Acceptance for Phase 2:** given a hand-constructed
`recurringPatternCluster` for the recurring "open file → make small
edit → save" pattern, the drafter produces a passing template that
(a) declares its own input/output shapes, (b) carries provenance
metadata, (c) cites at least one concept-db id when relevant, and
(d) passes `comprehensibility_check` against both Anthropic and
OpenAI models.

## Phase 3 — Detect → verify → refine (closed loop)

Goal: the substrate, with no operator input beyond initial config,
detects a recurring pattern, drafts an activity, verifies it, and
refines via disagreement traces.

- [ ] **3.1** — Implement `detect-recurring-pattern` in
  `repos/development-vessel/src/seed/detect-recurring-pattern.ts`.
  Trace-store query + windowed clustering. Threshold default
  `n_occurrences ≥ 5`. Emits `recurringPatternCluster` with
  contrast examples included.
- [ ] **3.2** — Implement `predict-and-verify` in
  `repos/development-vessel/src/seed/predict-and-verify.ts`.
  Routes verification by activity class per design §6. Emits
  `prediction_disagreement` with sub-case on miss.
- [ ] **3.3** — Implement `refine-on-disagreement` in
  `repos/development-vessel/src/seed/refine-on-disagreement.ts`.
  Reads disagreement traces, drafts a variant, plugs into existing
  `propagateCreditAlongChain`
  (`posterior-update.ts:386-392`) for parent-child credit flow.
- [ ] **3.4** — Wire the three Phase 3 activities into the seed
  registration pipeline.
- [ ] **3.5** — Open-question resolution checklist (design §14)
  closed by operator before this phase merges:
  - multi-action `interactionTriple` shape ratified
  - vault-content denylist policy ratified
  - synthetic n=0 operator-confirmation step installed
  - operator-feedback channel marked opt-in (not required)

**Acceptance for Phase 3 (the transfer test):** with no operator-
curated scenario JSON anywhere in the pipeline, the substrate
identifies a recurring `(observation_signature, action_signature,
post_observation_signature)` triple, mints a candidate activity
whose Thompson posterior beats uniform-random on next-occurrence
prediction over a 7-day window. The first observable milestone is a
single Layer-2 interpretation activity (per design §13) — the
transfer test additionally requires a Layer-4 action activity, but
the milestone gate is the Layer-2 case.

## Gates

| Phase | Gates on | Notes |
|---|---|---|
| 1 | `2026-05-30-obsidian-vessel-concept-db-frontend` shipped | Vessel concept-db client must be live. |
| 2 | Phase 1 acceptance | Drafter needs the observation substrate. |
| 3 | Phase 2 acceptance + design §14 checklist closed | Closed-loop autonomy requires operator-side decisions ratified. |

## Cross-references

- `2026-05-30-obsidian-vessel-concept-db-frontend/` — concept-db
  client surface this proposal writes through.
- `2026-05-30-trace-to-concept-mining/` — contrast-pair read path.
- `2026-05-30-info-gain-bonus-on-success/` — success-discount
  composed against by the refine loop.
- `2026-05-31-display-perception-vessel/` — denylist tiering pattern
  followed here.
- `2026-05-31-display-control-extension/` — reversibility-class
  methodology generalised here.
- `2026-05-31-display-failure-mode-extensions/` — failure-mode
  subtype pattern followed here.
