## Why

The resolver picker in `TaskEditor` lives inside a collapsed detail panel, so the user has no idea which resolver is assigned to a task without clicking expand on every row. Worse, when a user edits a task's resolver, prompt, or config, those changes never reach the API — only `output_shapes` is PATCHed today, leaving task-level mutations invisible to the learning loop.

## What Changes

- Move the resolver `<Select>` from the collapsed detail panel into the TaskEditor **summary row**, visible at all times next to the task description.
- When the resolver shown in the summary row is `llm`, the detail panel's primary content area is the prompt template editor. For any other resolver (`bash`, `git`, `file`, `exec`, `pattern`) it shows the `ConfigEditor` instead. The panel adapts automatically when the summary-row resolver changes.
- Add a flush-to-API path so that task-level changes (resolver, resolver_tier, config, prompt) are sent to `PATCH /v2/activities/templates/{id}` — either on debounce/blur or via an explicit save button on the card. The existing `output_shapes` PATCH path continues unchanged.
- The resolver options available in the summary row are the same set already in `RESOLVER_OPTIONS`: `llm`, `bash`, `git`, `file`, `human`, `impulse-resolve`, `context-acquisition`.
- `resolver_tier` continues to be derived from resolver choice via the existing `resolverToTierMap`.

## Capabilities

### New Capabilities

- `resolver-first-task-row`: Resolver select promoted to always-visible summary row; detail panel content adapts (prompt vs config) based on summary-row resolver value.
- `task-patch-flush`: Task-level mutations (resolver, config, prompt) included in PATCH to `/v2/activities/templates/{id}` with debounce/blur trigger and dirty-state indicator.

### Modified Capabilities

- `resolver-task-authoring`: Existing spec covers resolver selection in the expanded detail panel and `CreateActivityDialog`. This change promotes the resolver to the summary row and aligns `TaskEditor` behavior with that spec's intent. The requirement "TaskEditor expanded panel exposes resolver selection" is superseded by the summary-row requirement.

## Impact

- `repos/workbench/src/components/trajectory/TaskEditor.tsx` — summary row gains a resolver Select; detail panel loses the resolver picker row; content area switches on resolver.
- `repos/workbench/src/components/trajectory/ActivityCard.tsx` — PATCH body extended to include `tasks` array when any task has been edited.
- No changes to `ConfigEditor.tsx`, `TaskPromptEditor.tsx`, or any non-workbench vessels.
- No API schema changes — `tasks` is already part of the template body accepted by `PATCH /v2/activities/templates/{id}`.
