# Conditional Tasks

**Applies to:** `minibob` commit `6d66c5b` and later (2026-04-22); conditional expression syntax applies to any executor implementing `evaluateTaskCondition`.
**Source (historical):** `repos/minibob/src/activity.ts` — `evaluateTaskCondition`. The expression syntax, pseudo-operators, and `{{impulse:id}}` semantics described here are authoritative for activity template authoring regardless of which executor runs them.

A task can declare a condition that gates whether it runs this invocation. When the condition evaluates to truthy, the task executes; when falsy, the task is skipped (with status `skipped`, not `failed`) and the skip is recorded in the trace.

Before `6d66c5b`, every conditional in every template silently skipped — the evaluator read a field name no template actually wrote (`conditional.if` only), compiled pseudo-operators as JavaScript (`"x contains 'y'"` is a syntax error), and didn't know how to substitute impulse references. The fix below landed a functioning evaluator.

## Declaring a conditional

Either key is accepted; prefer `expression` for new templates since every current built-in template uses it:

```jsonc
{
  "id": "revise_step",
  "description": "Rewrite the proposed step using human guidance",
  "resolver": "llm",
  "conditional": {
    "expression": "{{impulse:confirm_plan}} contains 'revise'"
  }
}
```

Equivalent with the older key:

```jsonc
"conditional": { "if": "{{impulse:confirm_plan}} contains 'revise'" }
```

## What the expression can reference

| Reference | Source | Notes |
|---|---|---|
| `{{variables.<name>}}` | Activity variables | Merged from embedded defaults + `--var` overrides |
| `{{task.<taskId>.<field>}}` | Prior task result | e.g. `{{task.show_state.success}}` |
| `{{impulse:<id>}}` | Impulse store | Sync `store.get` — only impulses already materialized earlier in this execution. Missing ids substitute to `""`. |

`{{impulse:id}}` resolution is synchronous by design — impulses produced by earlier tasks in the same execution are already in memory (see [materializeOutputImpulses](./ACTIVITY_TASK_CONTEXT_PROPAGATION.md#4-materializeoutputimpulses--the-deterministic-llm-output-boundary)), so there's no async load step. Substituting missing ids to `""` means `{{impulse:x}} exists` correctly returns `false` instead of blowing up the eval.

## Pseudo-operators

Rewritten before evaluation so templates don't have to be hand-compiled JavaScript:

| In the expression | Compiled to | Meaning |
|---|---|---|
| `X contains 'Y'` | `X.includes('Y')` | substring / array membership |
| `X not-contains 'Y'` | `!X.includes('Y')` | negated substring / non-membership |
| `{{impulse:X}} exists` | `!!({{impulse:X}})` | truthy impulse content |
| `OR` | `\|\|` | logical or |
| `AND` | `&&` | logical and |

Everything else evaluates as JavaScript via `new Function`, so comparisons (`==`, `!=`, `<`, `>=`), numeric/string literals, and parentheses work as written.

## Examples

```jsonc
// Run only if the human asked to revise
"conditional": { "expression": "{{impulse:confirm_plan}} contains 'revise'" }

// Run unless the assessor declared the goal achieved
"conditional": { "expression": "{{impulse:assess_progress}} not-contains 'achieved'" }

// Two-way gate — either branch can unlock
"conditional": { "expression": "{{variables.applyChanges}} AND {{impulse:decideUpdate}} exists" }

// Loop guard from a counter variable
"conditional": { "expression": "{{variables.iteration}} < 5" }
```

## Evaluation semantics

- **Missing evaluable string.** If `conditional` is present but neither `if` nor `expression` contains a non-empty string, the evaluator **emits a warn and treats the task as always-run** rather than silently skipping. This is a design choice: a malformed conditional is almost always an authoring bug, and silent-skip turns the bug into an invisible one.
- **Eval failure** (syntax error after rewrite, reference error, etc.) → caught, logged as a warn, task is **skipped**. This preserves trace integrity: every execution still produces a coherent record.
- **Truthy** → task runs normally.
- **Falsy** → task is marked `skipped`; its `outputImpulses` are **not** materialized (since it produced nothing); dependent conditions that reference `{{impulse:<thisId>}}` will see empty string.

## Authoring tips

- **Pin references to impulses, not tasks,** when the downstream gate cares about a specific piece of produced text. `{{impulse:propose_next_step}}` is stable; `{{task.propose_next_step.output}}` works but is noisier when the task also emits structured metadata.
- **Always provide a `default` on human-gated predecessors** (per [INTERACTIVE_ACTIVITIES](./INTERACTIVE_ACTIVITIES_AND_HUMAN_RESOLVER.md#non-tty-fallback-semantics)), so off-TTY runs produce a defined value the conditional can branch on rather than an empty impulse that collapses every downstream gate.
- **Favor `exists` and `contains`** over `==` for human-produced strings. Exact-match against free-form human answers is fragile; substring checks survive small rewordings.

## Related

- [`./ACTIVITY_TASK_CONTEXT_PROPAGATION.md`](./ACTIVITY_TASK_CONTEXT_PROPAGATION.md) §4 — how `{{impulse:id}}` references become reliable via `materializeOutputImpulses`.
- [`./INTERACTIVE_ACTIVITIES_AND_HUMAN_RESOLVER.md`](./INTERACTIVE_ACTIVITIES_AND_HUMAN_RESOLVER.md) — every built-in interactive template uses conditionals to branch on human answers.
- `repos/minibob/src/embedded-templates/build-and-execute.json` — canonical multi-conditional template.
- `repos/minibob/src/embedded-templates/human-guided-orchestrator.json` — the other heavy conditional user.
