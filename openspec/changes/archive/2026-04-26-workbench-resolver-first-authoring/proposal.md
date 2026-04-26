## Why

`CreateActivityDialog` (new-activity creation) already has a resolver picker and `ConfigEditor`, but `TaskEditor` (inline editing of tasks inside the trajectory grid) does not — it always shows the prompt template editor regardless of the declared resolver. This means users who set a task to `bash` or `git` in the creation dialog can never change or inspect that selection in the trajectory editor without recreating the activity.

## What Changes

- Add a compact resolver `<Select>` to the expanded detail panel in `TaskEditor`, mirroring the options already in `CreateActivityDialog` (`llm`, `bash`, `git`, `file`, `human`, `impulse-resolve`, `context-acquisition`)
- When resolver is non-`llm`: replace `TaskPromptEditor` with `ConfigEditor` (structured fields for bash/file/git, JSON fallback for others)
- When resolver is `llm`: keep existing `TaskPromptEditor` behavior
- On resolver change: reset `task.config` to `undefined` and call `onChange` with updated `resolver`, `resolver_tier`, and `config`
- The existing `ResolverTierBadge` in the task summary row already displays the tier — it will update automatically as `resolver_tier` changes

## Capabilities

### New Capabilities
- `resolver-task-authoring`: (existing spec — delta) Extends requirement coverage to `TaskEditor` inline editing, not just `CreateActivityDialog`

### Modified Capabilities
- `resolver-task-authoring`: resolver picker and ConfigEditor conditional rendering now applies to TaskEditor expanded detail panel in addition to CreateActivityDialog

## Impact

- `src/components/trajectory/TaskEditor.tsx` — adds resolver Select + conditional ConfigEditor/TaskPromptEditor
- `src/types/index.ts` — no changes required (fields already exist)
- `src/components/trajectory/ConfigEditor.tsx` — no changes (already handles all resolvers)
- `src/components/trajectory/TaskEditor.test.tsx` — new test cases for resolver picker rendering
