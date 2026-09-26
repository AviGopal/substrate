## Context

Three read-only investigations (goal-host; development-vessel; llm-resolver and
activity-api) located every site this change touches. The facts that shape the design:

- **Cost is dropped at five hops.** Providers return token usage (llm-resolver
  `index.ts:696-701` Anthropic, `:808-811` OpenAI/OpenRouter; the credit fallback at
  `:616-619` returns none). No dollar figure is computed. `feature-compose.ts` `llmCall`
  (`:366-445`) keeps only `content`; the compose report writes `cost: 0, tokens:{0,0}`
  (`:6899-6900`); `ias-executor-ts` `vessel-daemon.ts:315` hard-codes `cost_usd: 0`;
  goal-host `llm-router.ts` sums tokens by goal hash and sends `costUsd: 0`
  (`:220,:263,:356`). The `execution` table already has `tokens_in`, `tokens_out`,
  `cost_usd` (`activity-api db/paradigm.ts:170-172`): the columns exist, the values are
  zero. 24 h measured: 38,728 execution rows, 30.7 M tokens_in, $0.
- **Admission runs its deterministic checks in the wrong order and omits the decisive
  ones.** `admitActionableGaps` (`gap-to-feature.ts:1487-1767`) checks ownership and a
  hardcoded protected set, then spawns a blocking `bun run typecheck` before the cheap
  "has a target" test. Push scope (`push-policy.ts gateLanding :453 /
  evaluateLandingScope :366`) is evaluated only at cutover, after draft and verify.
  Falsifier class (`substrate-gap.ts:519-590`) never gates; `edit_site` never gates.
  Proposal-backed gaps are ALWAYS admitted (`:1668`), and the low-confidence route to
  investigation fires once per gap (`investigated_at`).
- **Selection ranks by class posterior before score.** The Thompson rerank
  (`gap-to-feature.ts:1215`) sorts by class theta first, so a score-0 gap in a fresh
  Beta(1,1) class beats a 0.9 runner-up (20:26:28: `model-opportunity-drafter_actionability`
  at score 0). Three landability models exist; none is calibrated against outcomes
  (`landabilityScore :932`; `gap-lifecycle-scan.ts:359-412` writes predictions nobody
  reads; `gap-landability-model.ts` is imported by nothing).
- **Landed dispatches do not terminate.** goal-host's early edit-intent fetch to
  feature_compose (`index.ts:12660`) throws TimeoutError after 220–360 s, well under its
  900 s AbortSignal, so the catch at `:12770` falls through to a walk even when the
  compose later lands. The post-walk path (`:13141+`) sends a second compose whose
  BUSY refusal returns `failed/reached:false` (`:13351-13364`), and the verdict record is
  written once from whatever returns last (`:16301,:16349`). The double-compose guard's
  `landedShaForGoalHash` (`:6119`) misses because the cutover sha and the final sha differ.
- **Negative knowledge is prompt-only.** `goalFailureMemory`
  (`.goal-host-failure-memory.jsonl`, `index.ts:4038-4111`) deliberately drops
  deterministic refusals (`:4053`) and only feeds prompts. `/run-goal` has no rate or
  same-goal check and spends an LLM call (symbol proposal `:15624`) before any admission.
- **Budget and pause are node-local and not money.** Rhythm `budget` is a load fraction
  (`due_score = mean·staleness/max(budget,0.05)`, affordable if `budget ≤ 1 − load/3`); a
  budget above 1 is an undeclared pause. `operator_pause` is read by no code. Readers
  resolve their own node only (`rhythm-conductor-tick.ts:252`, boredom `:36,:78,:2552`).
  Discovery already supports a single authoritative owner (`distribution_policy:
  unique_authoritative`, `discovery-vessel types.ts:77-96`).
- **Posteriors fold cost into success.** `successYield` (`posterior-update.ts:327-346`)
  mixes cost into the alpha/beta update, so P(success) and cost are one number.

## Goals / Non-Goals

**Goals:** measure cost end to end; stop spending on actions a deterministic check can
refuse; end dispatches when their value is realized; bound spend by a federated budget;
select on calibrated value per cost; show improvement against the baselines below.

**Non-goals:** changing the drafter's prompts or models; the trace-store rebuild; the
submodule conversion of plain-file vessels; pricing accuracy beyond per-model
`cost_per_mtok` (OpenRouter's reported `usage.cost` is preferred where present).

## Decisions

1. **Measurement first.** Phase 1 lands cost accounting before any behavioural lever, so
   every later lever has a before/after in the same units. Alternative (gate first,
   measure later) rejected: improvements would be unfalsifiable in cost terms.
2. **One currency: value per cost.** Selection scores are `sampled P(value) / max(E[cost], ε)`.
   P(value) is a success-only posterior (cost removed from `successYield`); E[cost] is a
   separate running mean (`cost_sum_usd / cost_n`). Value is a gap closed by its
   falsifier; landed/reached are intermediate evidence, not the objective.
3. **Cheapest-first admission.** Order: owned → protected (imported `PROTECTED_VESSELS`)
   → push scope resolves (memoised per vessel per pass) → actionable (edit site present,
   falsifier class1/class2) → LLM producer advertised (short-TTL probe) → budget → site
   cap and history → typecheck spawn last. Each exclusion carries a reason in the
   admission log. The cutover push-scope gate stays as the final authority.
4. **Non-actionable gaps are not compose work.** No edit site and a falsifier that is not
   class1/class2 routes to `needs_information` (investigation), regardless of a proposal
   report, and repeats do not bypass it.
5. **Negative facts with invalidation.** A deterministic refusal (push scope, pinned
   posterior refusal, no producer, protected) is stored with the condition that would
   change it: head sha of the target clone, the discovery producer set, the posterior
   count, or a TTL. It is checked before spend and dropped when its condition changes.
6. **A landing is terminal and sticky.** On any compose exception or non-favourable
   return, goal-host probes git for a commit carrying the goal's route-edit id before
   falling back; a landed verdict latches and no later step may downgrade it; the
   post-walk compose is skipped when the latch or the probe shows a landing.
7. **Budget is a single authoritative shape.** `spendEnvelope` is served by one owner
   (discovery `unique_authoritative`) and debited from `llmSpend` impulses emitted by
   llm-resolver. Selection on every node resolves it through discovery at use time. An
   unreachable envelope blocks composes and allows cheap ticks. `paused:true` replaces
   budget>1 as the way to pause.
8. **Breaker before spend.** `/run-goal` and `/resolve` check a per-goal-hash and global
   dispatch rate over a window, computed on the raw goal before any LLM call.

## Measures

All measured the same way before and after; queries are read-only.

- **Self-development reach** (per day): gaps whose `closed_reason` is a verified landing
  with a passed falsifier, from `/workspace/git/super-repo/gaps/gaps.json` (jq query in
  tasks 0.2). Baseline: 17 ever; per-day rate to be computed at 0.2. Also the directed
  code-change reach: operator exact-edit dispatches that landed byte-equal ÷ dispatched.
- **Selection quality**: `SELECT success, count() FROM execution WHERE
  activity_id="feature_compose" AND created_at > time::now()-7d GROUP BY success`.
  Baseline 297 / 1,826 = 16% landed; plus the share of autonomous picks excluded or
  refused for a structural reason (baseline ≈ 60% on node 1, 2026-09-26).
- **Cost per outcome** (after phase 1): Σ `llmSpend.cost_usd` and tokens per compose,
  per landing, per verified closure, per walk reached.
- **Waste**: composes refused after drafting (push scope, BUSY after draft), walks after
  a landing, repeated identical failures.

## Risks / Trade-offs

- A too-strict actionable rule starves real work → the investigation route produces the
  missing edit site or falsifier; the needs-information count is watched.
- Envelope owner unreachable blocks composes → fail-closed for composes only; cheap ticks
  continue; the owner is a single resolver pair on the hub.
- Cost estimates from `cost_per_mtok` are approximate → prefer provider-reported cost;
  the ranking only needs relative costs to be right.
- Removing cost from `successYield` shifts existing posteriors → the change is recorded
  (law 12) and posteriors are compared a day before and after.

## Migration Plan

Autonomous picks stay held on every node (operator leases) until phases 1–4 are live.
Tasks land one at a time as pre-validated exact edits (anchors unique, tsc before/after,
no `$` patterns), each byte-compared after landing, runtime compared to clone, and its
falsifier read. Reopen autonomy with the budget live and a small envelope; widen it as
cost per verified closure is observed.
