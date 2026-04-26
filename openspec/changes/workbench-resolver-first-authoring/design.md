## Context

`TaskEditor` renders a compact summary row (task number, description, tier badge, reorder/delete controls) and a collapsed detail panel. Today the resolver `<Select>` lives in the detail panel. A user authoring a new trajectory must expand each task individually to see or change its resolver — this is error-prone when building multi-step templates with mixed resolver types (e.g., bash → llm → git).

Additionally, `ActivityCard` only PATCHes `output_shapes` to the API on blur. All other task mutations (resolver, config, prompt) are held in local React state and are lost on reload. The learning loop never sees what resolvers the author intended.

## Goals / Non-Goals

**Goals:**
- Resolver select appears in the summary row and is always visible without expanding the panel.
- The detail panel's primary content area (prompt vs config) is driven by the summary-row resolver value — no separate resolver picker inside the panel.
- Task mutations are flushed to `PATCH /v2/activities/templates/{id}` with debounce so the learning loop sees authored resolver intent.
- Dirty-state indicator on the card when tasks have unflushed changes.

**Non-Goals:**
- No changes to `CreateActivityDialog` (covered by existing `resolver-task-authoring` spec and already aligned).
- No changes to the `ConfigEditor` internal sub-components (BashConfig, FileConfig, GitConfig, RawJsonConfig).
- No new API endpoints — the `tasks` field is already accepted in the existing PATCH body.
- No responsive/mobile layout work.
- No E2E tests in this change (deferred, consistent with trajectory-editor precedent).

## Decisions

### Decision 1: Resolver select in summary row, not as a separate column

**Choice**: Inject a compact `<Select>` directly into the existing summary row flex layout, between the description input and the tier badge.

**Rationale**: The summary row already accommodates the tier badge and reorder controls without overflow. A narrow select (`w-20`, `text-[10px]`) fits the monospace grid aesthetic. An alternative (dedicated resolver column in a grid) would require a layout refactor of every task row and risks breakage on narrower cards.

**Trade-off**: The row becomes slightly wider. On very long descriptions it may truncate earlier. Mitigated by keeping `flex-1 min-w-0` on the description input.

### Decision 2: Detail panel content area controlled by summary-row resolver, no redundant picker

**Choice**: Remove the resolver picker row from the detail panel. The detail panel reads `task.resolver` (set by the summary row) to decide between `TaskPromptEditor` (llm) and `ConfigEditor` (all others).

**Rationale**: Having two resolver controls for the same field creates divergence risk. The summary row is the single source of truth. The panel becomes a "configuration area" that adapts to the choice already made.

**Alternative considered**: Keep both pickers in sync via `useEffect`. Rejected — two-way sync is fragile and unnecessary.

### Decision 3: Debounce-then-PATCH for task flushes, not an explicit save button per task

**Choice**: Reuse the existing `setTimeout(500ms)` debounce pattern already in `ActivityCard.handleTaskChange`. Extend the PATCH body to include the full `tasks` array whenever `isDirty` is true. The existing "saving…" indicator in the footer covers the feedback requirement.

**Rationale**: The card already has a 500ms debounce for `onUpdate` callbacks. Extending it to also call `patch(...)` is minimal delta. An explicit per-task save button would clutter the already-dense task row.

**Trade-off**: If the user switches cards before 500ms the task change is lost from the API (though local state in the trajectory store still holds it). Acceptable — the card footer shows "saving…" during the window.

### Decision 4: Include full tasks array in PATCH, not a per-task delta

**Choice**: PATCH sends `{ tasks: updatedTasksArray }` covering all tasks on the card, not just the changed task.

**Rationale**: The activity-api PATCH endpoint replaces the tasks array atomically. Sending a full array is simpler and avoids partial-update conflicts if two tasks are edited in quick succession. The array is small (typically 3–8 tasks).

## Risks / Trade-offs

- **Summary row width on narrow cards** → Mitigated by using a very compact select (`w-20`, truncate).
- **PATCH on every keystroke during debounce window** → Only one PATCH fires per 500ms window; concurrent edits coalesce. Acceptable.
- **resolver_tier badge now doubles with the summary select** → The tier badge can remain as a secondary visual indicator (color semantics) alongside the text resolver name. No removal needed.
- **Existing tests check detail-panel resolver picker** → No unit tests currently cover `TaskEditor` detail panel resolver in the workbench Vitest suite; risk is low.

## Migration Plan

1. Edit `TaskEditor.tsx`: add resolver select to summary row, remove from detail panel body.
2. Edit `ActivityCard.tsx`: extend PATCH body with `tasks` when dirty.
3. Manual smoke-test on canary: open trajectory editor, create card, change resolver in summary row, verify detail adapts and PATCH fires.
4. No rollback complexity — changes are purely additive to the PATCH body; the API already accepts `tasks`.

## Open Questions

- Should `exec` and `pattern` appear in the summary-row select options? The existing `RESOLVER_OPTIONS` array includes `llm, bash, git, file, human, impulse-resolve, context-acquisition` but not `exec` or `pattern`. Keeping parity with `RESOLVER_OPTIONS` for now.
