# Interactive Activities and the Human Resolver

**Applies to:** `minibob` with `HumanResolver` (April 2026 onward)
**Source:** `repos/minibob/src/resolvers/human-resolver.ts`, `repos/minibob/src/embedded-templates/`

The human at the terminal is just another resolver. This guide explains how `HumanResolver` fits into the resolver hierarchy and how to author activities that ask the user a question at the right moment instead of burning LLM tokens on a guess.

## The idea

In the foundation model, resolvers produce impulses. `BashResolver` produces a `bash_output` impulse; `LLMResolver` produces a `generated_text` impulse; `GitResolver` produces a `gitDiff` impulse. `HumanResolver` produces a `clarification` impulse — same shape contract, different source.

```ts
// resolvers/human-resolver.ts (abbreviated)
export class HumanResolver implements Resolver {
  name = "human";
  enabled: boolean;

  constructor(options: { isInteractive?: boolean } = {}) {
    // TTY check decides whether this resolver is even available
    this.enabled = options.isInteractive ?? (process.stdin.isTTY ?? false);
  }

  async resolve(_refs, config: HumanResolverConfig): Promise<Impulse[]> {
    const { question, options = ["yes", "no"], default: def, timeoutSeconds, allowFreeform = true } = config;
    const result = await askUser({ question, options, default: def, timeoutSeconds, allowFreeform });
    return [{
      pointer: { type: "memo", content: result.response },
      metadata: { shape: "clarification", type: "clarification", question,
                  timedOut: result.timedOut, aborted: result.aborted },
      // ... rest of impulse
    }];
  }
}
```

The output impulse is a `memo` with metadata `shape: "clarification"` — so downstream tasks filter for it the same way they filter for any other shape.

## When it's available

`HumanResolver.enabled` is a boolean set at construction. The default reads `process.stdin.isTTY`, so:

- **REPL** (`minibob` with no args) — TTY, resolver is enabled, questions prompt interactively.
- **`minibob --single "..."`** when invoked from a terminal — TTY, resolver is enabled.
- **`minibob --daemon`** or CI invocations — no TTY, resolver is disabled. Activities that include `resolver: "human"` tasks still run, but `askUser` falls back to the configured `default` or the first option in `options` so execution stays scriptable.

The practical rule: a well-authored interactive activity always provides a `default` so it can degrade gracefully in non-TTY contexts. Don't assume a human is there.

## Config shape

```ts
interface HumanResolverConfig {
  question: string;         // required; the prompt shown to the user
  options?: string[];       // default: ["yes", "no"]
  default?: string;         // fallback for non-interactive or timeout
  timeoutSeconds?: number;  // if set, auto-falls-back after elapsed
  allowFreeform?: boolean;  // default: true; allow typed answer outside `options`
}
```

The resolver emits `metadata.timedOut = true` or `metadata.aborted = true` on the output impulse so downstream tasks can branch. Trace replay can see whether the user answered or the fallback fired.

## Authoring a task that asks

Inside an activity template's `tasks[]`:

```json
{
  "id": "ask_next_action",
  "description": "Ask human which direction to take",
  "resolver": "human",
  "config": {
    "question": "Goal: {{goal}}\n\nWhat would you like to do next?",
    "options": [
      "Search for available activities",
      "Execute a specific activity I'll name",
      "Improvise using tools directly",
      "Goal is complete - stop here"
    ],
    "allowFreeform": true,
    "timeout": 300
  },
  "outputShapes": ["clarification", "memo"]
}
```

`{{goal}}` is templated from the activity's variables, so the question is dynamic. The task's `outputShapes` must include `clarification` (plus `memo` since the content is a memo) for downstream tasks to match against it.

## Built-in interactive templates

Ship in `repos/minibob/src/embedded-templates/`:

- **`interactive-activity-selector.json`** — asks the user to pick from a ranked list of activity templates before committing to one. Useful when Thompson Sampling has several close candidates and the user wants a final say.
- **`human-guided-orchestrator.json`** — the maximal human-in-loop template. A meta-activity that asks the user at every orchestration step: what to do, which activity to run next, whether the goal is complete. Useful for training the system on new domains where the learning loop hasn't yet converged.
- **`build-and-execute.json`** *(v0.8.0, commit `d935064`)* — interactive **template authoring**. Builds a new activity template one task at a time, executing each proposed task against the live impulse state space before committing it to the draft. Seven-step cycle per iteration: `show_state` (bash echo of iteration + template-so-far) → `propose_next_step` (LLM drafts one concrete task) → `confirm_plan` (human: execute / revise / stop) → `revise_step` (LLM, conditional) → `execute_step` (run the approved task live) → `assess_progress` (LLM + impulse-delta → JSON assessment) → `report_and_decide` (human: continue / revise-last / stop). The point is to author templates *by running them*, so every task ships pre-validated against real state.

All three templates tag themselves with `human.resolver` and `interactive` (per the dot-separated tag hierarchy normalized in `3e20d8f`, 2026-04-22) so they can be filtered out of autonomous (`--daemon`, boredom) runs.

## Entering an embedded template: `minibob -t`

Embedded activity templates used to only be reachable via the recommender picking them up for some goal. The `-t <template-id>` flag (commit `d935064`, v0.8.0) makes them first-class CLI entry points:

```bash
minibob -t build-and-execute --var goal="activity that audits route handlers for hardcoded URLs"
minibob -t human-guided-orchestrator --var goal="refactor auth middleware"
```

Semantics:

- **TTY-aware.** The CLI sets `isInteractive` from `process.stdin.isTTY`, so `HumanResolver` activates under a real terminal and auto-disables (per non-TTY fallback rules above) when piped or run in CI.
- **Progress rendering.** Under a TTY, the same DAG renderer as the REPL streams live (activities, tasks, impulse events); off-TTY, the tree prints once at completion, matching `--single`.
- **Wiring.** `src/cli/run-activity.ts` registers `onActivityStarted/Completed/Failed/TaskStarted/TaskCompleted` callbacks into the renderer, and bridges the global impulse-store singleton into the same event stream. The store listener is cleared in a `finally` so a second `-t` invocation in the same process starts clean.
- **Variable defaults honored** *(`5817d4d` + `d01d946`, 2026-04-22)*. After the required-vars check, the loader builds `effectiveVariables` by merging `template.variables[].default` for every variable not passed via `--var`. This relies on the template having its top-level `variables` array — which the backend strips, so the `-t` loader also runs `mergeEmbeddedTaskFields` after the backend resolve to graft `variables`, `inputSchema`, `outputSchema`, and per-task declarative fields back from the embedded JSON. See [`./ACTIVITY_TASK_CONTEXT_PROPAGATION.md`](./ACTIVITY_TASK_CONTEXT_PROPAGATION.md) §2 for the full graft contract.

Off-TTY use (CI, `--daemon`, piped stdin) still works because every interactive template in the bundle provides a `default` on its human tasks — the activity degrades to its default branch rather than blocking.

**On conditionals in these templates.** Every built-in interactive template uses `conditional.expression` on most tasks to branch on human answers and LLM verdicts. The evaluator (fixed in `6d66c5b`, same day) supports pseudo-operators (`contains`, `not-contains`, `exists`, `AND`, `OR`) and `{{impulse:id}}` substitution — see [`./CONDITIONAL_TASKS.md`](./CONDITIONAL_TASKS.md) for the authoring contract.

## Composition pattern: human as a gate

A common pattern is LLM-drafts-then-human-confirms:

```
task_1: "draft_fix"           resolver: llm         output: code_patch
task_2: "review_patch"        resolver: human       input: code_patch
                                                    output: clarification (accept/reject/revise)
task_3: "apply_or_revise"     resolver: bash        branches on task_2 output
```

The trace records which branch was taken and what the user said. Over time the learning loop can identify cases where the human almost always accepts (candidate for automation) vs. cases where the human frequently revises (the LLM prompt or activity template needs work).

## Cost accounting

Human resolution is free in dollars and expensive in latency. The trace records `latency_ms` honestly — a 90-second human deliberation is a 90-second resolver call. That's fine for learning: "this task's p95 is 2 minutes because it's gated on a human" is useful signal. Don't try to mask it.

## Non-TTY fallback semantics

When `isInteractive === false`:

1. If `config.default` is provided → use it.
2. Else if `config.options` non-empty → use `options[0]`.
3. Else → use empty string (and emit a `memo` with `aborted: true`).

Activities that truly require human input in production — not just development — should fail loudly in (1) by omitting `default` and having the resolver error. Better to refuse than to silently degrade a gated decision.

## Related

- `IMPULSE_ACTIVITY_FOUNDATION.md` — resolvers, impulses, shapes
- `ADVANCED_IMPULSE_PATTERNS.md` — composition and gating patterns
- [`./CONDITIONAL_TASKS.md`](./CONDITIONAL_TASKS.md) — authoring contract for `conditional.expression`
- [`./ACTIVITY_TASK_CONTEXT_PROPAGATION.md`](./ACTIVITY_TASK_CONTEXT_PROPAGATION.md) — variable defaults, field graft, deterministic output impulses
- `repos/minibob/src/embedded-templates/interactive-activity-selector.json` — canonical selector
- `repos/minibob/src/embedded-templates/human-guided-orchestrator.json` — canonical meta-orchestrator
- `repos/minibob/src/embedded-templates/build-and-execute.json` — interactive template authoring (entered via `minibob -t build-and-execute`)
