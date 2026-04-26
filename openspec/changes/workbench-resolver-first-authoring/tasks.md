## 1. TaskEditor — Resolver Select in Summary Row

- [x] 1.1 Add a compact resolver `<Select>` to the `TaskEditor` summary row flex layout, positioned between the description input and the tier badge; use `RESOLVER_OPTIONS` for options and stop-propagation on click so the detail panel does not expand
- [x] 1.2 Bind the summary-row select to `task.resolver ?? 'llm'` and call `onChange({ ...task, resolver: v, resolver_tier: resolverToTierMap[v] ?? 'llm', config: undefined })` on value change
- [x] 1.3 Add `e.stopPropagation()` to the select's container/trigger click handler so clicking it does not trigger the card's `onSelect` or the panel expand
- [x] 1.4 Verify the summary row does not overflow on cards with long task descriptions (description input must keep `flex-1 min-w-0`)

## 2. TaskEditor — Remove Resolver Picker from Detail Panel

- [x] 2.1 Delete the "resolver" `<div>` block (label + `<Select>`) from inside the `{isDetailOpen && ...}` detail panel in `TaskEditor`
- [x] 2.2 Verify that the detail panel still renders `TaskPromptEditor` when `(task.resolver ?? 'llm') === 'llm'` and `ConfigEditor` otherwise (this logic already exists; confirm it is driven solely by `task.resolver`)
- [x] 2.3 Confirm `ConfigEditor` retains its `key={task.resolver}` prop so it remounts when the resolver changes via the summary row

## 3. ActivityCard — Task PATCH Flush

- [x] 3.1 In `ActivityCard.handleTaskChange`, extend the debounced `setTimeout` callback to call `patch(`/v2/activities/templates/${activity.templateId}`, { tasks: updated.template.tasks })` after `onUpdate?.(updated)` and `setIsDirty(false)`
- [x] 3.2 Wrap the PATCH call in try/catch; on failure log with `console.warn('[ActivityCard] PATCH tasks failed:', err)` and do not re-throw or show a toast
- [x] 3.3 Confirm the `isDirty` flag is set to `true` at the start of `handleTaskChange` (it already is) and cleared to `false` inside the debounce callback after both `onUpdate` and `patch` resolve

## 4. ActivityCard — Merge Tasks into Existing PATCH (output_shapes)

- [x] 4.1 Audit `handleOutputShapesBlur` to confirm it PATCHes only `{ output_shapes }` — no change needed there; the two PATCH paths (shapes on blur, tasks on debounce) are intentionally independent
- [x] 4.2 Confirm the footer "saving…" indicator (`isDirty`) is shown while task changes are debouncing and disappears after the debounced callback runs (existing behavior — verify no regression)

## 5. Smoke Test on Canary

- [x] 5.1 Open the trajectory editor on canary, add an activity card, change a task resolver in the summary row, confirm the detail panel adapts (prompt ↔ config) when expanded
- [x] 5.2 Change a task's bash command in `ConfigEditor`, wait 500ms, confirm a PATCH request appears in the browser Network tab with `{ tasks: [...] }`
- [x] 5.3 Confirm changing the resolver in the summary row does not collapse the detail panel when it is already open
- [x] 5.4 Confirm the resolver-tier badge in the summary row updates to reflect the new tier after a resolver change
