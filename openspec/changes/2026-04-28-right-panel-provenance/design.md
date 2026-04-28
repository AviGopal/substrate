# Right Panel — Provenance, Weight Influence, Readability

**Date**: 2026-04-28  
**Status**: In Progress  
**Components**: `ImpulseStatePanel.tsx`, `ImpulsePoolView.tsx`, `ShapeProvenanceTree.tsx`

---

## Current State

The right panel (`w-80`, always visible) shows:

1. **Goal impulse card** — green-tinted card `border-green-500/20 bg-green-500/5` with the goal text. Title uses `text-green-600 dark:text-green-400` (readable). Body text is `text-[11px] font-mono text-foreground/80` (slightly low presence). Exec ID is `text-muted-foreground/40` (critically low contrast at 40% opacity on `bg-green-500/5`).

2. **Impulse Pool card** — hosts `ImpulsePoolView`. Header count badge is `text-muted-foreground/50` (low). Pool summary line `text-muted-foreground/40` (critically low). Group count badge inside each group header is `text-muted-foreground/40` (too dim). Shape badges use `text-[8px]` — below comfortable legibility on most monitors. Pointer hint uses `text-[8px] font-mono text-muted-foreground/50` — two compounding legibility issues (size + opacity). Content preview button `text-primary/60` — adequate. Resolver tier badge on colored background (`bg-green-500/20 text-green-400`) — the text is `text-[7px]`, minimum readable size is 9px for colored badge text.

3. **Bindable Slots card** — only shown when `bindableSlots` prop is non-empty. Generally readable; `text-[10px]` used throughout which is acceptable.

4. **Task Validation card** — shows per-task validator results. Failed: `bg-red-50 dark:bg-red-950/30` with `text-xs font-mono` (readable). Passed: `bg-green-50 dark:bg-green-950/30` with `text-xs font-mono` (readable). The `text-muted-foreground` label in the "no validators" row — adequate.

5. **Shape Provenance card** — `ShapeProvenanceTree`. Shows activity → shapes list with `border-l-2 border-muted` tree lines. "Initial Context (Column 0)" uses `text-xs font-medium text-muted-foreground` — adequate. Shape badges use `text-xs` — fine. Tree lines `border-muted` on `bg-muted/30` background — low contrast. No feedback mechanism for recalled traces.

---

## Readability Issues Found

| Location | Class | Issue |
|---|---|---|
| Goal impulse card — exec ID | `text-muted-foreground/40` | 40% opacity → effectively invisible |
| Goal impulse card — goal text | `text-[11px]` | Slightly below comfortable reading size |
| Impulse Pool header — shapes count | `text-muted-foreground/50` | Low contrast |
| ImpulsePoolView — pool summary | `text-muted-foreground/40` | Critically low contrast |
| ImpulsePoolView — group count | `text-muted-foreground/40` | Low contrast |
| ImpulsePoolView — shape badge text | `text-[8px]` | Sub-legible; min comfortable is 9px |
| ImpulsePoolView — pointer hint | `text-[8px] ... /50` | Both size and opacity compound |
| ImpulsePoolView — resolver tier badge | `text-[7px]` | Below minimum; especially on colored bg |
| ImpulsePoolView — ID suffix | `text-muted-foreground/30` | Critically low (30% opacity) |
| ImpulsePoolView — content "no content" | `text-muted-foreground/40` | Low contrast |
| ShapeProvenanceTree — border-l tree | `border-muted` | Tree lines blend into muted background |

---

## Desired State

### Goal Impulse Card
- Goal text: `text-xs font-mono text-foreground/90` — more presence, still monospace
- Exec ID: `text-muted-foreground/60` — from `/40`, perceptible without competing

### Impulse Pool Section Header
- Shapes count: `text-muted-foreground/70` — from `/50`
- Pool summary: `text-muted-foreground/60` — from `/40`

### ImpulsePoolView
- Shape badge: `text-[9px]` — from `text-[8px]`
- Pointer hint: `text-[9px] ... /65` — from `text-[8px] ... /50`
- Resolver tier badge: `text-[8px]` — from `text-[7px]`; minimum for colored badge text
- Group count: `text-muted-foreground/60` — from `/40`
- Impulse ID suffix: `text-muted-foreground/50` — from `/30`
- "no content" fallback: `text-muted-foreground/60` — from `/40`
- Content preview button: `text-primary/70` — from `/60`

### ShapeProvenanceTree — Weight Influence UI
For each activity entry (non-initial producers), add inline relevance feedback row below the shapes list. Buttons are `text-[8px] font-mono` inline. No new API wiring yet — POST to `impulse-relevance` is a follow-up (F-NN-B). The UI captures intent; wiring lands when activity_variant_id is available in context.

Tree line: `border-border/50` — from `border-muted` for slightly more definition.

---

## Weight Influence Interaction (Human-in-the-Loop)

When reviewing a recalled trace, the user sees a Shape Provenance entry like:

```
● my-activity (Col 2)
  └→ [source_code] [git_diff]
     ↑ useful  ↓
```

- **↑ useful** (green tinted): calls `POST /v2/activities/impulse-relevance` with positive `alpha` delta for this (activity_id, shape) pair. In the current stub, logs intent to console. Full wiring deferred.
- **↓** (neutral/red on hover): calls the same endpoint with negative signal (`beta` delta). Stub behavior same.

The interaction is deliberately minimal — two small inline text buttons, no modal. The goal is low-friction signal capture during trace review.

---

## Tasks

- [x] T1: Create OpenSpec design doc (this file)
- [x] T2: Improve goal impulse card readability — goal text `/90`, exec ID `/60`
- [x] T3: Improve Impulse Pool header — shapes count `/70`, pool summary `/60`
- [x] T4: ImpulsePoolView readability pass — badges `[9px]`, pointer hint `[9px]/65`, resolver tier `[8px]`, group count `/60`, ID suffix `/50`, no-content `/60`, content preview `/70`
- [x] T5: ShapeProvenanceTree — add weight influence buttons per activity entry
- [x] T6: ShapeProvenanceTree — tree line contrast `border-border/50`, ID suffix contrast
- [x] T7: typecheck + commit
