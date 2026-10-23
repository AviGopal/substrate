# Conditional Tasks

**Applies to:** the execution engine in `ias-executor-ts` (`evaluateConditionalGate` in `src/engine.interpolation.ts`, called from `src/engine.ts` before a task's resolver runs).

A task can declare a condition that gates whether it runs this invocation. When the condition evaluates to true, the task executes; when false, the task is skipped (with status `skipped`, not `failed`) and the skip is recorded in the trace.

## Declaring a conditional

`conditional` may be a boolean, a string expression, or an object whose `expression` is a string or a boolean. Prefer the object form, which the built-in templates use:

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

Any other form (an object with no `expression`, a number) is a malformed gate: the task is recorded as failed and the execution fails with `UNRESOLVABLE_GATE`.

## What the expression can reference

| Reference | Source |
|---|---|
| `{{impulse:<slot>}}` | The content of an impulse already in this execution's store |
| `{{lifecycle.<path>}}` | The data of the lifecycle impulse that triggered the execution |
| `{{variables.<path>}}` or `{{<path>}}` | Accumulated variables: request-level variables plus projections of prior tasks |

A reference that cannot be resolved fails the gate loudly (`UNRESOLVABLE_GATE`): the task is recorded as failed and the execution fails. An unresolvable gate never silently runs or silently skips.

## Operators

An expression is one or more clauses joined by ` AND `; the first false clause makes the whole gate false. A clause is either a comparison or a bare operand:

| Clause | Meaning |
|---|---|
| `X contains 'Y'` | X includes the substring Y |
| `X not-contains 'Y'` | X does not include Y |
| `X == Y`, `X === Y` | string equality after substitution |
| `X != Y`, `X !== Y` | string inequality after substitution |
| `X` | true unless X is empty, `false`, `0`, `null`, `undefined` or `[]` |

Operands are compared as strings after substitution, with one layer of matching quotes stripped. There is no `OR`, no numeric comparison and no JavaScript evaluation.

## Examples

```jsonc
// Run only if the human asked to revise
"conditional": { "expression": "{{impulse:confirm_plan}} contains 'revise'" }

// Run unless the assessor declared the goal achieved
"conditional": { "expression": "{{impulse:assess_progress}} not-contains 'achieved'" }

// Both must hold: a variable flag and a produced decision
"conditional": { "expression": "{{variables.applyChanges}} AND {{impulse:decideUpdate}}" }
```

## Evaluation semantics

- **True** → the task runs normally.
- **False** → the task is recorded as skipped with reason `conditional_false`. A later task that lists it in `dependencies` is skipped too (`dependency_skipped`), since its own gate would reference slots the skipped task never filled.
- **Malformed or unresolvable** → the task is recorded as failed and the execution fails with `UNRESOLVABLE_GATE`, so the fault is measured rather than hidden.

## Authoring tips

- **Pin references to impulses** when the downstream gate cares about a specific piece of produced text: `{{impulse:propose_next_step}}` is stable.
- **Favor `contains`** over `==` for human-produced strings. Exact-match against free-form human answers is fragile; substring checks survive small rewordings.
- **Declare `dependencies`** on tasks whose gates read a predecessor's output, so a skipped predecessor skips them instead of failing the execution on an unresolvable reference.

## Related

