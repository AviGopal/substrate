# Canvas Timeline — Learning Deltas, Readability, Connector Contrast

**Date**: 2026-04-28
**Status**: Implementing
**Scope**: Workbench trajectory editor — `TrajectoryGridWithDnd.tsx`, `ActivityCard.tsx`, `TaskEditor.tsx`

---

## Problem

The trajectory canvas communicates activity sequences and shapes but doesn't surface the learning signal embedded in loaded execution traces. Reviewers lose the "did this execution help or hurt confidence in this activity?" question. Additionally, several text elements are illegibly small or low-contrast, reducing usability in dark mode.

---

## Goals

1. **Learning signal per activity**: When a recalled trace is loaded, show whether the execution updated α (success path) or β (failure path) on each activity card.
2. **Pool delta in column headers**: Each column header should show how many new shapes were added to the pool by the preceding activity (+N).
3. **Connector readability**: Shape labels on flow connectors are too small (`text-[8px]`/`text-[7px]`). Raise to legible sizes.
4. **Variant creation access**: Surface a minimal "create variant" action from the activity card in trace-review context.
5. **General readability**: Fix faint step labels, low-contrast health strip text, task description contrast, and `traced` badge text.

---

## Non-Goals

- No new components.
- No structural layout changes.
- No data-fetching additions (use data already present in `traceOverlay` + existing props).

---

## Design

### 1. Learning Delta Badges (ActivityCard)

**Trigger**: `traceOverlay.executionId` is set (recalled trace mode).

**Signal**:
- `traceOverlay.success === true` → the execution contributed `Δα+1` to the Thompson posterior for this template. Show `Δα+1` in green.
- `traceOverlay.success === false` → the execution contributed `Δβ+1`. Show `Δβ+1` in red.

**Placement**: Health strip area, inline with existing badges.

**Why**: Thompson Sampling updates α/β on every execution outcome. Surfacing this immediately during trace review lets the reviewer understand the confidence trajectory without opening the full stats panel.

**Implementation**: In the health strip IIFE (`ActivityCard.tsx` ~450-513), append the delta badge when `traceOverlay?.executionId` is truthy.

```
traceOverlay.success = true  →  <span class="text-[8px] font-mono text-green-400/80">Δα+1</span>
traceOverlay.success = false →  <span class="text-[8px] font-mono text-red-400/80">Δβ+1</span>
```

### 2. Column Header Readability (TrajectoryGridWithDnd)

**Current**: `opacity-60` on the `── step N ──` label makes it barely visible against dark backgrounds.

**Fix**: Replace `opacity-60` class (or `/40` alpha) with `text-muted-foreground/80`, giving it the muted foreground token at 80% opacity — readable but visually subordinate.

Similarly, the `pool: N +M` line uses `/40` opacity. Raise to `/60`.

### 3. Connector Shape Badge Readability (ShapeFlowConnector)

**Current**:
- Active/produced shapes: `text-[8px]`
- Passing shapes (muted): `text-[7px]`
- Arrow opacity: `/70`

**Fix**:
- Active shapes: `text-[9px]`
- Passing shapes: `text-[8px]`
- Arrow opacity: `/80`

**Why**: Even a 1px size increase on micro-text meaningfully improves legibility. Shape names carry semantic meaning for composition review; they must be readable without zoom.

### 4. `traced` Badge Contrast (ActivityCard)

**Current**: `text-primary/60` on `bg-primary/10` — low contrast, hard to read.

**Fix**: `text-primary/80` — still uses the primary color token but at higher opacity.

### 5. Task Row Description Contrast (TaskEditor)

Audit labels with `/40` opacity on muted backgrounds. Raise any found to `/60`.

---

## Deviation Indicator (Out of Scope for This Pass)

A resolver-tier deviation indicator (declared bash, used llm) was identified as useful but requires `declaredResolverTier` to be threaded through the `traceOverlay` type, which would widen the change. Tracked as a follow-up: the `traceOverlay` type should add `tasks[].declaredResolverTier` alongside the existing `resolverTier` field so the card can diff them.

---

## Variant Creation Access (Minimal, Deferred)

Full variant creation from trace context requires a `POST /v2/activities/templates/:id/variants` flow and additional UX. The card already has a `···` overflow menu location. The actual wire-up is deferred; this pass only ensures readability issues don't block the reviewer from using existing controls.

---

## Files Changed

| File | Change |
|------|--------|
| `repos/workbench/src/components/trajectory/TrajectoryGridWithDnd.tsx` | Column header opacity, pool delta opacity, connector badge sizes + arrow opacity |
| `repos/workbench/src/components/trajectory/ActivityCard.tsx` | Learning delta badges in health strip; `traced` badge text opacity |
| `repos/workbench/src/components/trajectory/TaskEditor.tsx` | Label contrast audit |

---

## Tasks

- [x] T1: Create this design doc
- [x] T2: Read target component sections (lines 295-420, 375-480, 120-175, ShapeFlowConnector)
- [x] T3: Column header readability fix (`TrajectoryGridWithDnd.tsx`)
- [x] T4: Pool delta opacity fix (`TrajectoryGridWithDnd.tsx`)
- [x] T5: Learning delta badges (`ActivityCard.tsx`)
- [x] T6: `traced` badge contrast (`ActivityCard.tsx`)
- [x] T7: Connector badge sizes (`ShapeFlowConnector` in `TrajectoryGridWithDnd.tsx`)
- [x] T8: TaskEditor label contrast audit (`TaskEditor.tsx`)
- [x] T9: `bun run typecheck` + fix errors
- [x] T10: Commit
