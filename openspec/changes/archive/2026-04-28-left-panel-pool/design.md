# Left Sidebar: Live Pool Snapshot + Readability

**Status**: implementing  
**Date**: 2026-04-28  
**Scope**: `repos/workbench` — TrajectoryEditorPage, ExecutionHistoryPanel, ActivityPalette

---

## Current State

The left sidebar (`w-64`) has two tabs:

- **History tab** — shows `ExecutionHistoryPanel` which is a collapsible accordion
  listing past execution traces with failure-mode filter. Auto-switches here when
  `activeExecutionId` or `loadedTrace` is set.
- **Palette tab** — shows `ApplicableActivitiesPanel` (shape-filtered suggestions)
  plus `ActivityPalette` (draggable template list).

Neither tab answers the question: *"What is minibob doing right now and what
data is in the pool?"*

### Readability Issues Found (code audit)

**ExecutionHistoryPanel.tsx:**
- `TraceRow`: `text-muted-foreground/80` on the duration/cost line is reasonable
  but the load/B buttons use `text-[10px]` — acceptable.
- `FailureSummary`: `text-[10px]` on failure lines — acceptable, already readable.
- The panel header badge uses `text-[10px]` for the counter — fine.
- No severe contrast issues, but the overall palette items are worse (see below).

**ActivityPalette.tsx (composition/ActivityPalette.tsx):**
- Category tag: `text-[9px]` with CATEGORY_COLORS like `text-blue-400` (fine
  on dark, low on light) — bump to `text-[10px]`.
- Task count (`{n}t`): `text-[9px] text-muted-foreground/30` — extremely low
  contrast, bump to `text-muted-foreground/50` and `text-[10px]`.
- Description line: `text-[10px] text-muted-foreground/50` — fine.
- Palette section divider: `text-[9px] text-muted-foreground/40` — bump to `/50`.

**ImpulsePoolView.tsx:**
- `ContentPreview`: `text-[9px]` for "show content" button — bump to `text-[10px]`.
- Content pre block: `text-[8px]` — readable enough in its expanded niche, leave.
- `ImpulseGroup` label: `text-[9px]` — bump to `text-[10px]`.
- Count badge: `text-[8px] text-muted-foreground/40` — bump to `text-[9px] /60`.
- Pointer hint: `text-[8px] text-muted-foreground/50` — bump to `text-[9px] /60`.
- Impulse ID suffix: `text-[8px] text-muted-foreground/30` — bump to `text-[9px] /45`.

---

## Desired State

### History Tab: Live State First

When `activeExecutionId` is set OR `isLive` is true, add a compact "live state"
section **above** the `ExecutionHistoryPanel` accordion in the History tab content.

The section is 6-8 lines of JSX inline in `TrajectoryEditorPage.tsx`. It renders:

1. **Vessel + status line** — reuse the same dot/name logic from the omnibar vessel
   picker (1 line, no new components).
2. **Goal line** — if `goalText` is set, show `● goal: {goalText.slice(0,40)}` in
   green/muted text.
3. **Pool summary line** — if `currentShapes.size > 0`, show
   `{currentShapes.size} shapes in pool` as compact monospace text.
4. **Active task** — if `activeTaskId` is non-null, show a live indicator with the
   task ID suffix.

This gives a human-readable "what is happening" glance without needing a new
component — it is plain JSX with existing state variables already in scope.

### No New Components

Per the task constraints, all changes are inline JSX edits to existing files.
No new files, no new components, no new hooks.

---

## Structural Changes

### File 1: `src/pages/TrajectoryEditorPage.tsx`

- **Location**: inside `{activeTab === 'history' && (...)}` block, above
  `<ExecutionHistoryPanel .../>`.
- **Change**: add a `{(activeExecutionId || isLive) && (<div>...</div>)}` block
  with vessel status, goal, shape count, and active task.

### File 2: `src/components/trajectory/ExecutionHistoryPanel.tsx`

- **No changes required** — readability is already adequate (`text-[10px]`,
  `text-muted-foreground/80`). The component is fine.

### File 3: `src/components/composition/ActivityPalette.tsx`

- Category tag: `text-[9px]` → `text-[10px]`
- Task count text: `text-muted-foreground/30` → `text-muted-foreground/50`,
  `text-[9px]` → `text-[10px]`
- Section divider: `text-muted-foreground/40` → `text-muted-foreground/50`

### File 4: `src/components/trajectory/ImpulsePoolView.tsx`

- `ContentPreview` button: `text-[9px]` → `text-[10px]`
- `ImpulseGroup` label span: `text-[9px]` → `text-[10px]`
- `ImpulseGroup` count span: `text-[8px] /40` → `text-[9px] /60`
- Pointer hint div: `text-[8px] /50` → `text-[9px] /60`
- Impulse ID suffix span: `text-[8px] /30` → `text-[9px] /45`

---

## Non-Goals

- No new components.
- No API calls in the sidebar section.
- No changes to `ExecutionHistoryPanel` internals (readability is acceptable).
- No changes to `ApplicableActivitiesPanel`.
- Responsive breakpoints out of scope.
