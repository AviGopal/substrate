# MiniBob CLI Execution Tree

**Applies to:** `minibob` commit `d8b15d2` and later (April 2026)
**Source:** `src/cli/progress.ts`, wired from `src/cli/processor.ts`

Every goal execution now renders as a nested DAG — activities, tasks, and impulse events — in stdout, without a `-v` flag. Users can see *what is running, under which parent, and how the impulse state space is changing* as work happens.

REPL streams the tree as work progresses; `--single` accumulates silently and renders the final tree on completion.

## What the output looks like

```
> fix the login bug
  ├─ ◌ debug-api
  │  ├─ ✓ Analyze error logs
  │  ├─ ◌ Identify root cause
  │  │   ├─ ~ loaded gitDiff (312 tokens)
  │  │   └─ + created error_summary (memo)
  │  └─ ○ Apply fix
  └─ ✓ achieved (2 activities, 3 tasks, $0.05)
```

Status icons: `○` pending, `◌` running, `✓` completed, `✗` failed, `–` skipped.

## Nested activities

When an activity spawns another activity (via the `activity_executor` resolver), the child renders under its caller. The renderer tracks the relationship by `executionId → parentExecutionId`, so any depth of nesting is visible. An activity with no recorded parent becomes a root in the tree.

This is the same `composition_chain` data the backend persists on execution traces — the CLI now surfaces it live.

## Verbosity gating

Output detail scales with verbosity (set via `-q` / default / `-v` / `-vv` / `-vvv`):

| Level | What you see |
|---|---|
| `quiet` | Errors only. No tree. |
| *default* | Tree with activity + task status. Per-activity impulse **counts** (e.g. `5 created, 3 loaded`). |
| `-v` (info) | Per-impulse lines under each running task (`+ created <id> (<shape>)`, `~ loaded <id> (<tokens> tokens)`). |
| `-vv` (debug) | Adds resolver attribution on loaded impulses (`~ loaded <id> via <resolver>`). |
| `-vvv` (trace) | Everything above plus internal tracer events. |

The pre-existing raw `console.log` banners from `src/activity.ts` are now gated behind `-v+`, so the default view is owned by the DAG renderer and stays legible.

## `--single` vs REPL

- **REPL:** `streamMode: true`. The renderer redraws the tree on every event using clear-lines escape codes when stdout is a TTY, so the tree animates in place.
- **`--single`:** `streamMode: false`. Events accumulate silently and the full tree renders once on goal completion (or failure). Prevents interleaved output when scripts pipe minibob's stdout.

TTY detection (`process.stdout.isTTY`) auto-disables in-place redraws when piping, so CI logs stay linear even in REPL mode.

## Under the hood

The store singleton in `src/impulse.ts` exposes `setImpulseEventListener`, which the processor wires at the start of each goal and clears in `finally`. The executor threads `parentExecutionId` through `onActivityStarted`, and the impulse listener attaches the active `executionId` to each emitted event. Listener errors never break execution — a throw inside a subscriber is caught so a UI bug can't kill a goal.

## Related

- [`../architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](../architecture/IMPULSE_ACTIVITY_FOUNDATION.md) §Composition tracking — how `parent_execution_id` / `composition_chain` are persisted on the trace side
- [`../architecture/RUNTIME_ACTIVITY_TRACING.md`](../architecture/RUNTIME_ACTIVITY_TRACING.md) — the L1/L2/L3 trace levels that back the rendered tree
