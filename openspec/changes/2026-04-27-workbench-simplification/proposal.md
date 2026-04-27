# Workbench Simplification & Trajectory Refocus

**Date**: 2026-04-27
**Status**: Proposed

## Why

The workbench currently has five pages plus a studio dev tool, and the trajectory editor's left panel is unusable: 256px wide, holding vessel selector, goal input, execution history, and activity palette all stacked. The panel cannot be read. ImpulseStatePanel (right side) vanishes below 1280px, which is most laptops. Activity search is wired in the UI but silently ignored by the API. Shapes are 465 lines of hardcoded data that diverges from reality the moment any vessel registers a new shape.

The consequence: users cannot find activities, cannot see what impulses actually contain, and must switch between cramped panels to understand a single execution. The workbench is supposed to be the verification surface for the activity system, but it provides no means to verify anything — because impulse content is never shown, only shape labels.

## What This Change Does

1. **Removes two dead-end pages** — `CompositionBuilderPage` (DAG canvas superseded by trajectory grid) and `StudioPage` (react-renderer dev tool). Routes redirect to `/trajectory`. Navigation entries removed.

2. **Makes Shapes page live** — replaces 465-line static `KNOWN_SHAPES` array in `useShapes.ts` with live queries to discovery-vessel (which vessels currently resolve each shape) and activity-api (recent impulse examples with actual content).

3. **Wires search to FTS** — `GET /v2/activities/templates?q=` added to activity-api; routes to `queryActivitiesByFTS()` when present. Workbench search input updated to use `q` param. Users can describe what they need in plain language.

4. **Restructures trajectory editor layout** — vessel connection and goal input move to a top bar (visible at all viewports); the 256px left sidebar becomes a narrow tab strip toggling between History and Palette (one at a time, not stacked); fixed right panel (`ImpulseStatePanel`) is removed.

5. **Shows impulse content inline** — `OutputLayer` gains an expand-on-click interaction that fetches and shows the actual `content` field of each impulse. This is the core verification surface: users can read what an activity produced without leaving the trajectory view.

## Success Criteria

- Template search at `GET /v2/activities/templates?q=fix+auth+bug` returns FTS results, not a list unrelated to the query.
- Shapes page shows shapes from the live registry, not the static array; each shape shows at least one real impulse example with content.
- Trajectory editor is usable at 1280px without horizontal scroll for 3 activities and without missing panels.
- Each expanded task card shows the actual body content of any produced impulse, loaded on demand.
- `/compositions/builder` and `/studio` routes redirect to `/trajectory` (no 404, no dead navigation items).
