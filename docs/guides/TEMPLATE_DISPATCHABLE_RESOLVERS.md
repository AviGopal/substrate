# Template-Dispatchable Resolvers

**Applies to:** `minibob` commit `70a722b` and later (2026-04-23); the resolver-dispatch pattern applies to any executor (goal-host-vessel, ias-executor-ts) that maintains a name→resolver registry.
**Source (historical):** `repos/minibob/src/activity.ts` resolver registry; `repos/minibob/src/resolvers/`. Phase 26+ executors: `repos/goal-host-vessel/` + `@avigopal/ias-executor-ts`.
**Note (2026-05-27):** MiniBob is on a deprecation path. The resolver-dispatch mechanism (`"resolver": "<name>"` in task JSON), the resolver registry pattern, and the goal-processing-activity-driven PoC described here are still the canonical approach. The specific resolver file paths are minibob-historical; the same named resolvers are registered in the substrate-hosted goal-host-vessel.

An activity template's task can invoke a resolver by name via `"resolver": "<name>"` in the JSON — no runtime object passing, no custom executor change. This note lists the resolvers currently wired into the registry for template dispatch and the two new classes of resolvers introduced in `70a722b` (bootstrap context chain and selection-as-resolver).

The larger direction is **vessels driven solely by activities**: anything a template author might want to do — analyze the current impulse state, acquire missing context, narrow a candidate pool before an LLM call — should be reachable as a named resolver in task JSON, rather than hardcoded inside `goal-processor.ts` or `activity.ts`. Every such resolver is traced like any other, so selection decisions participate in the learning loop on equal footing with tool calls and write resolvers.

> **Foundation alignment.** In the corrected model, the minimum self-stable set is **Impulse, Pointer, Resolver, Vessel** (working hypothesis — the system is not yet self-stable). Activities are derived: an activity is an impulse-of-shape `activity_template` consumed by an activity-resolver. Resolver dispatch via `"resolver": "<name>"` is the literal mechanism by which a task instantiates that primitive. Any vessel can contribute resolvers; the registry below is minibob-local, not authoritative for the system as a whole.
>
> Top-level activity execution today is invoked via `executor.execute(template)` from `goal-processor.ts`. The unified execution path is the chosen direction (see [`IMPULSE_ACTIVITY_FOUNDATION.md`](../architecture/IMPULSE_ACTIVITY_FOUNDATION.md#unified-execution-path) → "Unified Execution Path"); the MiniBob refactor that routes goal-shaped and activity-template-shaped pointers through the standard impulse → resolver dispatch is pending.

## How registration works

`ActivityExecutor` builds a name → resolver `Map` at construction and threads it through task dispatch. Any task whose `resolver` field matches a registered name gets routed to that instance, with the task's `config` object forwarded as `ResolverConfig`.

```ts
// activity.ts, simplified
registry.set("llm", llmResolver);
registry.set("bash", bashResolver);
registry.set("ribosome", new RibosomeResolver(mcpClient));
registry.set("impulse-resolve", new ImpulseResolveResolver(mcpClient));
registry.set("impulse_state_analysis", new ImpulseStateAnalysisResolver());
registry.set("llm_impulse_selector", new LLMImpulseSelectorResolver(llmResolver));
registry.set("tool_selector", new ToolSelectorResolver(llmResolver));
registry.set("failure_penalty", new FailurePenaltyResolver());
registry.set("goal_satisfaction_checker", new GoalSatisfactionCheckerResolver(workingDir));
registry.set("goal_verification", new GoalVerificationResolver());       // 96f8533
registry.set("goal_enrichment", new GoalEnrichmentResolver(llmResolver)); // 755ba4d
registry.set("variant_selection", new VariantSelectionResolver());        // 529994c
registry.set("impulse_preparation", new ImpulsePreparationResolver());    // 1262c1b
registry.set("goal_decomposition", new GoalDecompositionResolver(llmResolver)); // fb28d32
registry.set("activity_recommendation", new ActivityRecommendationResolver()); // f0301ba
registry.set("orchestration_goal_detector", new OrchestrationGoalDetectorResolver()); // 19dbce8
registry.set("context_acquisition", new ContextAcquisitionResolver());    // b289508
registry.set("keyword_extractor", new KeywordExtractorResolver());        // 02094ba
// ...
```

**Invariant:** template-dispatchable resolvers must be constructible without runtime-only objects, or must fall back to a process-wide singleton when the runtime-only dependency is absent. `ImpulseStateAnalysisResolver.impulseStateManager` is optional for exactly this reason — it reaches for `getImpulseStateManager()` when the template's JSON config doesn't (and can't) pass one.

## Bootstrap context chain (`70a722b`)

Two resolvers that together answer "what shapes do I already have in scope, and what should I load before the next LLM call?" Registered by name so templates can chain them.

### `impulse_state_analysis`

**Location:** `repos/minibob/src/resolvers/impulse-state-analysis-resolver.ts`.

Given a `goal` (required) and optional `sessionId` / `availableImpulses` / `executionCount`, returns an impulse describing the current state space: which shapes are already resolved, which are missing, and which would most likely unblock the next step. Falls back to the singleton `ImpulseStateManager` when `impulseStateManager` is not supplied in config — which is the template-dispatched case.

**Config:**
```ts
interface ImpulseStateAnalysisResolverConfig {
  goal: string;                        // required
  sessionId?: string;
  impulseStateManager?: ImpulseStateManager; // optional; falls back to singleton
  availableImpulses?: Impulse[];
  executionCount?: number;
}
```

The `70a722b` fix completes the previously stubbed `parseAnalysisResult()` path that used to silently break the handoff to downstream resolvers — so the chain actually propagates structured shape/id lists, not free-form text.

### `context_acquisition`

**Location:** `repos/minibob/src/resolvers/context-acquisition-resolver.ts`.

Consumes the analysis output from `impulse_state_analysis` and resolves the missing shapes it recommended, producing concrete loaded impulses. Intended to run as the second task in a bootstrap chain:

```jsonc
{
  "tasks": [
    {
      "id": "analyze",
      "resolver": "impulse_state_analysis",
      "config": { "goal": "{{goal}}" },
      "outputShapes": ["impulse_state_analysis"]
    },
    {
      "id": "acquire",
      "resolver": "context_acquisition",
      "config": { "fromAnalysis": "{{impulse:analyze}}" },
      "outputShapes": ["acquired_context"]
    }
  ]
}
```

Both are stateless with respect to runtime-only objects; everything they need is either in the config or reachable via the process-wide singletons, so the chain composes inside any activity without bespoke wiring.

## Selection-as-resolver (`70a722b`)

Two LLM-backed selectors that narrow a candidate pool to the subset a downstream step actually needs. Thin wrappers over `LLMResolver` so model and cost config stay consistent, and both short-circuit when `candidates.length <= maxSelected` — no LLM call when selection is a no-op.

### `llm_impulse_selector`

**Location:** `repos/minibob/src/resolvers/llm-impulse-selector-resolver.ts`.

Given a `goal` and a candidate set, picks the ≤ `maxSelected` most relevant impulses and emits a single impulse with shape `selected_impulses` whose content is JSON `{ selected: string[], rejected: string[], reasoning: string }`.

**Config:**
```ts
interface LLMImpulseSelectorConfig {
  goal: string;               // required
  candidateIds?: string[];    // falls back to every impulse in the store
  maxSelected?: number;       // default 5
  contextNote?: string;       // e.g. "these will feed a debugging LLM call"
}
```

The LLM is shown only each candidate's id, shape, and summary metadata — never full content — so selection cost is independent of per-impulse budget. Goal-processor no longer owns this decision; templates that want "narrow the pool before the next LLM call" just add a `llm_impulse_selector` task.

### `tool_selector`

**Location:** `repos/minibob/src/resolvers/tool-selector-resolver.ts`.

Same pattern for tool definitions instead of impulses. Given `availableTools: ToolDefinition[]` plus a goal, returns `selected_tools` — `{ selected: string[], rejected: string[], reasoning: string }` where `selected` are tool names.

**Config:**
```ts
interface ToolSelectorConfig {
  goal: string;                      // required
  availableTools: ToolDefinition[];  // required; description improves selection
  maxSelected?: number;              // default 5
  contextNote?: string;
}
```

**Why this matters:** passing every registered tool to every LLM call bloats prompts, invites hallucinated invocations, and makes trace extraction noisy. A template that runs an LLM task can first dispatch `tool_selector` and pass only the narrowed set to the next step, so the tool surface scales with the learning loop rather than with the registry size.

## State-in-impulses resolvers (`afe9b8d`, `690247a`)

Two resolvers that previously lived as in-process classes (`FailurePenaltyTracker`, goal-satisfaction check methods on `GoalProcessor`) and have been migrated into the resolver registry, with their state moved into the shared impulse store. The motivation in both cases is the same: nested activity executors need to see each other's state, and the impulse store is the existing singleton that already survives the nesting invariant (see `test/impulse-sharing-across-nesting.test.ts`).

### `failure_penalty`

**Location:** `repos/minibob/src/resolvers/failure-penalty-resolver.ts`.

Cross-goal failure state that decays over time and feeds the `shouldAvoid` filter in activity selection. Lives as one impulse per activity id — shape `failure_penalty`, stable id `failure-penalty-<activityId>`. Single resolver with a `config.operation` discriminator:

| `operation` | Effect |
|---|---|
| `record_failure` | Bumps penalty on the activity's impulse |
| `record_success` | Partial or full recovery (configurable) |
| `get_multiplier` | Reads current multiplier (decays to 1.0 after ~25h) |
| `get_record` | Reads the full penalty record |

Lookups became async because the impulse store is hit via the shared singleton — `ExecutionAdapter.selectActivity` and related call sites now `await Promise.all(...)` the penalty reads. Hot-path impact is negligible (in-memory `Map`).

**Why this is an improvement:** the old `FailurePenaltyTracker` singleton only worked when every consumer lived in the same process and the same import graph. A nested ActivityExecutor could mint its own instance and never see the parent's writes. Moving state into the impulse store makes cross-executor visibility automatic.

### `goal_satisfaction_checker`

**Location:** `repos/minibob/src/resolvers/goal-satisfaction-checker-resolver.ts`.

Deterministic "is this goal already done?" probe — runs four checks in sequence against the filesystem and subprocess tooling in the configured working directory:

1. **File check** — does a required file exist / contain a pattern?
2. **Git check** — is the working tree clean / does HEAD contain a mentioned commit?
3. **Code check** — does `bun run typecheck` / a lint command exit 0?
4. **Action check** — is the goal's intent clearly action-type (vs. introspection)?

Emits one `goal_satisfaction_result` impulse per `resolve()` with JSON content `{satisfied, determined, reason, evidence, checkUsed}`. Each check is deterministic — **no LLM** — so templates can use this as a cheap early-exit gate before dispatching expensive reasoning steps.

**Config:**
```ts
interface GoalSatisfactionCheckerConfig {
  goal: { message: string; intent?: string };  // required
  // other fields threaded to the individual checks
}
```

`goal-processor.ts` still owns the ambiguity fallback (the LLM-backed check when all four deterministic checks come back `determined: false`), since the resolver is deterministic-only per spec. The `checkGoalSatisfactionDeterministic()` helper gives existing callers the same ergonomics as before the extraction.

## Goal-lifecycle resolvers (`96f8533`, `755ba4d`, `fb28d32`)

Three LLM-backed extractions from `goal-processor.ts` landed the same day — the companions to the deterministic `goal_satisfaction_checker`. Together they span the lifecycle: enrichment and (optional) decomposition run *before* execution, verification runs *after*.

### `goal_enrichment`

**Location:** `repos/minibob/src/resolvers/goal-enrichment-resolver.ts`.

Pre-execution semantic enrichment: raw goal string → `GoalEnrichment` shape with `category`, `clarifiedIntent`, `understanding`, `expectedOutcomes`, `requiredCapabilities`, and `successCriteria`. One LLM call, anti-expansion prompt (the inline version's byte-for-byte prompt is preserved and guarded by a test so drift fails loudly). Registered under the same conditional block as `llm_impulse_selector` / `tool_selector` since all three wrap an injected `LLMResolver`.

Also exports an imperative helper `enrichGoalViaResolver(goal, context, llmClient, model)` that bridges the project's `LLMClient` interface to the resolver's prompt + parse. `GoalProcessor.parseGoal()` now calls the helper rather than re-wiring itself to construct an `LLMResolver`.

**Distinct from `GoalAnalysisResolver`** (which sits next door): `GoalAnalysisResolver` handles post-enrichment routing analysis (complexity, recommendedApproach) and actually consumes `GoalEnrichment` as input. `goal_enrichment` is the step that produces the input.

### `goal_verification`

**Location:** `repos/minibob/src/resolvers/goal-verification-resolver.ts` (existed pre-`96f8533` but was orphaned — no `initializeResolvers()` entry; `GoalProcessor` carried a duplicate inline implementation).

Post-execution answer to "did the goal actually get achieved?" Three strategies: `llm`, `state_based`, `hybrid`. Stateless — LLM client injected per-call via `config.llmClient` for template-task dispatch. Returns `GoalVerification` shape `{verified, reason, confidence}`.

The `96f8533` commit wires the resolver up (adds `registry.set("goal_verification", …)`), deletes the duplicate in `goal-processor.ts`, and lifts two private helpers into static methods on the class so the convenience wrapper can reuse the canonical prompt:

- `GoalVerificationResolver.gatherFactsFromExecutions(executions)` — dedup + outputSummary aggregation.
- `GoalVerificationResolver.verifyFromFactsOnly(facts)` — deterministic fallback when the LLM path fails.

Wrapper `verifyGoalAchievementViaResolver(goal, executions, llm, model)` mirrors the Step-5a pattern: bridge the project's `LLMClient.complete()` to the resolver's prompt/parse, tolerate both fenced JSON and bare `{...}` output (the legacy `goal-processor` prompt asked for the latter).

### `goal_decomposition`

**Location:** `repos/minibob/src/resolvers/goal-decomposition-resolver.ts`.

Takes a complex goal (plus optional git-context) and returns 2–4 ordered sub-goals as a `string[]`. LLM-backed. Registered under the same conditional block as `goal_enrichment` / `llm_impulse_selector` / `tool_selector` (wraps an injected `LLMResolver`). Emits a single impulse with shape `decomposed_goals` and content `{subGoals, reasoning}`.

**Fallback contract preserved byte-for-byte.** On any failure — LLM outage, missing JSON in the response, parse error — logs `[Decompose] Failed: …` and returns `[goal.intent]`. Not a throw, not an empty array. Two tests lock this contract (malformed JSON + LLM client error), and a prompt-guard test asserts every literal phrase in `buildDecompositionPrompt` so drift fails loudly. `maxTokens: 400` locked by the same suite.

Imperative helper `decomposeGoalViaResolver(goal, gitContext, llmClient, model)` is what `GoalProcessor.decomposeGoal()` now calls — same legacy `string[]` return, same fallback semantics. The 300-char truncation on `recentCommits` and the conditional `"Expected outcomes: ..."` prompt line are both preserved.

The inline `decomposeGoal()` method in `GoalProcessor` is currently orphaned — no live call site — but kept as a thin delegation for the test suite and any downstream consumer that imports it. Future cleanup candidate once the delegation layer proves stable.

**Pattern emerging:** every extraction from `goal-processor.ts` this week ships three things in the same commit — the resolver registration, an imperative helper that bridges the legacy `LLMClient` interface, and an inlined-to-static lift of private helpers. The extraction rule is *don't change resolver semantics; bridge at the wrapper instead.* Preserves legacy behavior exactly while opening each capability to template dispatch.

## Selection + state-space prep resolvers (`529994c`, `1262c1b`)

Two deterministic extractions that complete the `goal-processor.ts` Step-5 series. Both are `config.operation`-discriminated (same ergonomics as `git` / `bash` / `failure_penalty`) and preserve byte-for-byte the statistical semantics of the inlined versions.

### `variant_selection`

**Location:** `repos/minibob/src/resolvers/variant-selection-resolver.ts`.

The deterministic side of variant selection: Thompson Sampling math, variant-family grouping, backend family-score lookup, and multi-family orchestration. (Note: Thompson posteriors are currently a known-unshaped primitive — they should be a shape advertised by activity-api's implicit Thompson Sampling vessel and resolvable via the standard impulse-resolve path; today they are reachable only through dedicated REST endpoints. This is the one real shape gap in the foundation model.) The executor-coupled meta-activity branch (`tryMetaActivitySelection` + `parseVariantSelectionResult`) stays inline in `GoalProcessor` because it runs a meta-activity template through `this.executor`; the resolver accepts a `MetaActivityCallback` config field so it doesn't need to know about `ActivityExecutor`.

**Statistical equivalence:** `sampleBeta(α, β)` is migrated byte-for-byte — Kumaraswamy CDF inverse, identical clamping, identical `Math.random()` consumption order. Reproducibility for the learning loop is preserved.

**Side effects preserved:**
- Backend `getVariantFamilyScores` call shape unchanged.
- Selection-context shapes unchanged (`method`, `variants_considered`, `selection_reason`, `base_activity_id`, `used_meta_activity`, `timestamp`).
- Single-rec families still skip the backend (no extra HTTP).
- Final sort by `sampled_value` descending unchanged.

**Public `GoalProcessor` signatures preserved** via thin delegations: `selectBestVariantFromFamily(baseActivityId, goalContext)` and `applyVariantAwareSelection(recommendations, goalContext)` both forward to the resolver.

### `impulse_preparation`

**Location:** `repos/minibob/src/resolvers/impulse-preparation-resolver.ts`.

Three state-space pre-flight helpers, now dispatchable by name. `config.operation` selects one of:

| `operation` | Effect |
|---|---|
| `infer_expected_shapes` | Keyword-to-shape mapping; used for pre-flight matching, sparse-template scoring, and relevance assessment |
| `create_goal_impulse` | Builds and parks a `goal`-shape impulse in the singleton store — byte-for-byte preserves pointer layout, default budget (4000), ID pattern, and loaded-impulse context extraction |
| `prepare_impulses_for_goal` | Bridge to `ImpulseStateManager.predictRequiredInputs` → per-suggestion `addImpulse`; inner errors logged + swallowed, outer errors return `[]` |

No LLM dependency — `predictRequiredInputs` forwards the caller's `apiKey` to `SessionMemoryAgent` (the state-space's concern), so the resolver itself stays in the deterministic tier.

**Singleton-store invariant preserved:** `create_goal_impulse` continues to call the shared `createImpulse()` that places the impulse in `getImpulseStore()`. Callers that rely on "after this call the goal impulse is resolvable by id" see identical behaviour.

**Complement to `impulse_state_analysis`:** where `impulse_state_analysis` asks "what do we have vs. what do we need?", `impulse_preparation` is the companion that actually mints the goal-shape impulse and primes the state-space with predicted inputs. Natural to call `impulse_preparation` (pre-flight) → `impulse_state_analysis` (gap assessment) → `context_acquisition` (fill gaps) in a template.

## Composing selectors with bootstrap

The natural pattern for a general-purpose activity is:

1. `impulse_preparation` (`create_goal_impulse` + `prepare_impulses_for_goal`) — mint the goal impulse and prime the state-space.
2. `impulse_state_analysis` — see what shapes are already in scope.
3. `context_acquisition` — resolve missing shapes the analysis flagged.
4. `llm_impulse_selector` — narrow the resulting pool to the ≤ N impulses the next step actually needs.
5. `tool_selector` — narrow the tool surface likewise.
6. `llm` — run the focused call.

Steps 3 and 4 short-circuit when nothing needs narrowing, so the pattern degrades cleanly for simple cases. Every step is one traced resolver call — the learning loop can reason about which combinations work, which selectors are worth their latency, and which goals short-circuit most often.

### `orchestration_goal_detector` (`19dbce8`)

**Location:** `repos/minibob/src/resolvers/orchestration-goal-detector-resolver.ts`.

Pure regex classifier: does this goal need the orchestration path (test-creation / test-execution / refactor-to-pattern / restructure / reorganize / improve / apply-pattern-to-X), and if so, what sub-class (pattern / dependency-injection / extract-module / rename / performance)? Emits a single impulse with shape `orchestration_detection_result` and content `{isOrchestration, subClassification, target, executionTraceId, testFramework, requireTests, scopePath, ...}`.

The regex patterns, target extractors, and refactor sub-classification keywords are **preserved byte-identical** from the deleted `GoalProcessor.detectOrchestrationGoal` method — this is a storage/shape migration, not a classifier change. A 36-test suite locks keyword clusters, sub-classification, context passthroughs, negative cases, classifier/resolver parity, and registry registration.

Imperative helper `detectOrchestrationGoalDeterministic` is the drop-in replacement used at the one `GoalProcessor` call site, which unpacks the resolver's `{isOrchestration, …}` result into the legacy `{shouldOrchestrate, …}` branch predicate. Net shrink on `goal-processor.ts`: 6305 → 6184 LOC (−121, −1.9%).

## Proof-of-concept: all-resolver goal processing (`110f6d8`)

The payoff for the 8-commit extraction series. Embedded template [`goal-processing-activity-driven`](https://github.com/MetabobProject/minibob) drives goal processing purely through resolver dispatch — every task is `resolver: "<name>"`, no god-object TypeScript orchestrating flow:

```
analyze_state         → impulse_state_analysis    → impulse_state_result
enrich_goal           → goal_enrichment           → goal_enrichment_result
select_variant        → variant_selection         → variant_selection_result
dispatch_activity     → activity (inline bash)    → bash_output
verify_goal           → goal_verification         → goal_verification
decompose_on_failure  → goal_decomposition        → decomposed_goals (conditional)
```

Additive — `goal-processing-standard.json` is untouched and still loads the legacy `GoalProcessor`-orchestrated flow. The PoC proves the resolver chain is executable end-to-end; the legacy flow stays as the fallback while the resolver chain is hardened.

### Honestly-documented short-circuits (and their resolution)

The PoC template's header originally listed three deliberate simplifications. Two have since been closed:

- ~~**`context_acquisition` registered but not dispatched.**~~ **Resolved in `e16f73c`** (propagation fix, described below) — `acquire_context` is now chained between `analyze_state` and `enrich_goal` by shape-based input matching.
- ~~**`variant_selection` short-circuits with a hardcoded `dispatchActivityId`.**~~ **Resolved in `f0301ba`** (Gap 2 closure). The `ActivityRecommendationResolver` file had always existed but was orphaned: not registered in `initializeResolvers()`, and its `extractGoalEnrichment` / `extractImpulseState` extractors carried "Placeholder" stubs that always returned null — so even had the template dispatched to it, the production path would have silently fallen through to an empty recommendations impulse. The fix (a) registered the resolver, (b) replaced the placeholder extractors with id-prefix-matched `loadImpulse + JSON.parse` (byte-identical to Step 2's `parseAnalysisResult` pattern), (c) swapped the strict `throw on missing mcpClient` for the auto-resolve `getMCPClient()` fallback used by `VariantSelectionResolver`, so template-dispatched tasks (which can't carry a live client through JSON) gracefully degrade with `metadata.empty=true` when the backend is unreachable, and (d) added `goalEnrichment` / `impulseState` to the resolver config so imperative callers can skip the impulse round-trip. The PoC template now calls `recommend_activity` (Thompson-Sampling-backed) with `fallbackActivityId` wired for the unreachable-backend case.
- **`goal_verification` uses `state_based` strategy** (still open) so the PoC doesn't spend LLM tokens. The regression test accepts `achieved=false` at low confidence when no evidence impulse is present — the PoC's job is to prove the chain dispatches, not that every resolver's happy path fires. Swapping to `hybrid` or `llm` is a one-line template change when that evidence appears.

The pattern of both closed gaps is the same: the resolver file existed, but one small plumbing issue (output propagation / missing registration + placeholder extractor) kept it from participating in the chain. That's consistent with the broader extraction story — the resolver surface is largely in place; what the shrink is really doing is *wiring it up* so templates can compose it.

### Resolver output propagation fix (`e16f73c`)

The `loaded && content` short-circuit above was Gap 1 of Step 6: resolver-produced impulses were losing `metadata.shape`, `content`, and `loaded: true` on the way through the store, so downstream tasks declaring `inputShapes: [<shape>]` saw an empty pool.

**Root cause:** `executeWithResolver` registered outputs via `createImpulse({id, pointer, budget, priority})` — only four fields, dropping `content` / `metadata` / `loaded`. `ImpulseStore.create` then hardcoded `loaded: false`, so the propagation path couldn't recover `metadata.shape` (the `memo` resolver returns a string, not `{content, metadata}`).

**Fix:** new `ImpulseStore.registerLoaded(impulse)` (plus the `registerLoadedImpulse()` module export) upserts a fully-formed resolver output as-is — preserving `loaded`, `content`, `metadata` — while still firing backend sync + event emission. Only `executeWithResolver` was switched to it; no public API signatures changed. `test/resolver-task-output-propagation.test.ts` locks both invariants: single resolver task's output survives in the store with shape/content/loaded intact, and two resolver tasks chain correctly with the downstream task seeing the upstream's output via `inputShapes`.

The PoC template's `context_acquisition` gap is unblocked by this — it's no longer a propagation issue, just the follow-up of actually dispatching it from the template.

## Additional extractors (`b289508`, `02094ba`)

### `context_acquisition` resolver (`b289508`)

**Location:** `repos/minibob/src/resolvers/context-acquisition-resolver.ts`.

Extracted from `GoalProcessor.detectContextAcquisition()`. Given the current `impulseState` (from `impulse_state_analysis`), identifies which shapes are missing and would unblock progress, then synthesizes or fetches them. Returns a list of acquired shapes as a `memo` impulse.

**Config:**
```ts
interface ContextAcquisitionResolverConfig {
  impulseState: string;      // id of the impulse_state_analysis output
  maxNewShapes?: number;     // default: 3; max shapes to acquire in one call
}
```

**Output:** `memo` impulse with shape `context_acquisition_result`, containing:
```json
{
  "acquired": ["shape1", "shape2"],
  "count": 2,
  "method": "synthesis | fetch | hybrid"
}
```

### `keyword_extractor` resolver (`02094ba`)

**Location:** `repos/minibob/src/resolvers/keyword-extractor-resolver.ts`.

Extracted from `GoalProcessor.extractKeywords()`. Given a goal or goal enrichment result, identifies domain-specific keywords and phrases that could be used for relevance filtering, concept lookup, or impulse disambiguation. Returns structured keyword data.

**Config:**
```ts
interface KeywordExtractorResolverConfig {
  sourceText: string;        // goal or enrichment result to analyze
  keywordCount?: number;     // default: 5; number of keywords to extract
  includeNounPhrases?: boolean;  // default: true
}
```

**Output:** `memo` impulse with shape `keyword_extraction_result`, containing:
```json
{
  "keywords": ["keyword1", "keyword2"],
  "nounPhrases": ["phrase 1", "phrase 2"],
  "confidenceScores": [0.95, 0.87],
  "extractedAt": "2026-04-23T11:53:59Z"
}
```

**Why extracted separately:** The original `extractKeywords()` method was small (< 50 LOC) and highly reusable — many activity types benefit from keyphrase extraction before impulse selection or concept lookup. Making it a named resolver lets templates use it without hardcoding, and traces reveal whether keyword-based filtering is actually improving outcome quality.

## Authoring notes

- **Stateless is load-bearing.** If a resolver needs runtime-only state, give it a singleton fallback so it can be registered once without runtime objects. Otherwise it can't be template-dispatched.
- **Selector outputs are one impulse each.** Downstream tasks reference `{{impulse:<taskId>}}` and parse the JSON content (see [`./CONDITIONAL_TASKS.md`](./CONDITIONAL_TASKS.md) for the substitution contract).
- **Short-circuit guards protect cost.** Selectors check `candidates.length <= maxSelected` before calling the LLM. Downstream code should not rely on a selector *always* invoking the model.
- **Disabled when LLM is disabled.** Both selectors honor `LLMResolver.enabled` — no API key → `enabled = false` → the resolver refuses to run and surfaces a clear error rather than hanging.

## Related

- [`./ACTIVITY_TASK_CONTEXT_PROPAGATION.md`](./ACTIVITY_TASK_CONTEXT_PROPAGATION.md) — how later tasks see the impulses these resolvers produce.
- [`./CONDITIONAL_TASKS.md`](./CONDITIONAL_TASKS.md) — `{{impulse:id}}` and `exists` pseudo-operator for gating on selection output.
- [`./TEMPLATE_UPKEEP.md`](./TEMPLATE_UPKEEP.md) — the `impulse-resolve` primitive and the broader "every capability is a resolver" pattern.
- [`../architecture/ADVANCED_IMPULSE_PATTERNS.md`](../architecture/ADVANCED_IMPULSE_PATTERNS.md) §1.2 — resolver composition at the conceptual layer.
