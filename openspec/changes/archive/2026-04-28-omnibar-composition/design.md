# Omnibar Composition Readability — Design

**Date**: 2026-04-28  
**Status**: implementing  
**Scope**: `repos/workbench/src/pages/TrajectoryEditorPage.tsx`, `GoalSubmissionPanel.tsx`

---

## Current state

The omnibar is a single `h-11` row with:
- Left: vessel picker button (status dot + name + chevron)
- Center: `<input>` with full-width placeholder
- Right: action group (Run, Run Trajectory, Save, Clear) with `gap-1`

**Problems found:**

1. **Placeholder opacity is too low** — `placeholder:text-muted-foreground/30` renders at ~12% opacity in dark mode, nearly invisible against `bg-card`. Minimum usable opacity is `/60`.

2. **No vessel activity signal** — when `isLive`, the button just says `"live"` in blue. The user cannot see which goal is executing without scrolling down to the canvas.

3. **Placeholder text is misleading** — `"describe a goal — preview updates automatically · Ctrl+Enter to run"` conflates two separate intents: (a) freeform goal text that seeds a `goal`-shape impulse and (b) explicit impulse pointer targets (e.g. `source_code @ /path/to/file`). Nothing signals that the input accepts impulse pointers.

4. **Right-side action group gap** — `gap-1` (4px) between Run, Run Trajectory, Save, Clear is too tight. Run Trajectory has `text-muted-foreground` label on a `variant="outline"` button — acceptable but tight.

5. **Run Trajectory button in compact mode** — `text-muted-foreground` class applies to label text inside an outline button. In dark mode this is subtle but readable; no change needed.

6. **ViewModeStrip separators** — `text-muted-foreground/30` on `│` characters is cosmetic; acceptable since they are decorative.

---

## Desired state

1. **Placeholder at `/60` minimum** — visible, useful hint text in all themes.

2. **Vessel button shows executing activity** — when `isLive` and `goalText` is set, render a secondary `text-[9px]` line inside the button showing `executing: <goal truncated to 30 chars>…`. This is purely additive.

3. **Placeholder dual-purpose hint** — `"describe a goal or set an impulse target — Ctrl+Enter to run"` removes the incorrect "preview updates automatically" claim and adds "impulse target" signal.

4. **Action group spacing** — `gap-1` → `gap-2` (8px) on the right-side action container.

---

## Changes

| File | Change |
|------|--------|
| `TrajectoryEditorPage.tsx` L1027 | `placeholder:text-muted-foreground/30` → `placeholder:text-muted-foreground/60` |
| `TrajectoryEditorPage.tsx` L1028 | Update idle placeholder string |
| `TrajectoryEditorPage.tsx` L1008–1013 | Add `<span>` with `text-[9px]` executing status below vessel name when `isLive && goalText` |
| `TrajectoryEditorPage.tsx` L1039 | `gap-1` → `gap-2` on right-side action group |

No new components. No new files. All changes are additive or cosmetic string/class tweaks.

---

## Out of scope

- Impulse pointer parse UI (drag-to-add, autocomplete) — deferred
- AUM / security hardening — tracked separately in `2026-04-26-security-hardening-findings`
- Mobile responsive breakpoints — deferred
