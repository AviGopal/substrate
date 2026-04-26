## Why

The workbench activity authoring UI forces every task to go through an LLM prompt, but MiniBob's executor already supports deterministic resolvers (`bash`, `git`, `file`, `human`, `impulse-resolve`, etc.) that are faster, cheaper, and more predictable. At the same time, `category` is deprecated in MiniBob's `ActivityTemplate` type in favour of dot-notation `tags`, yet the workbench still requires `category` everywhere and exposes no way to set `tags` as the primary classification signal.

## What Changes

- **Remove `ActivityCategory` enum** from `repos/workbench/src/types/index.ts`; make `category` optional (backward-compat with old API data); make `tags: string[]` required with a default of `[]`
- **Add `input_shapes` / `output_shapes` per-task** to `ActivityTask` in the workbench type system
- **Replace category dropdown with tags input** in `CreateActivityDialog`; replace `promptTemplate` textarea per task with a resolver dropdown + conditional config/prompt fields
- **Update `ActivityCard`** to display first tag (or fall back to legacy `category`) instead of the hard-coded `[category]` badge
- **Update `TaskEditor`** detail panel: add read-only per-task shape display; keep existing validation section; no change to retry section
- **Update `TemplateFilters`** category quick-filter buttons to tag-based filtering
- **Update `useTemplates` / `CreateTemplateRequest`** to send `tags` (not `category`) in the POST payload
- **Update `lib/api.ts` `CreateTemplateRequest`** to make `category` optional and add `tags: string[]`

## Capabilities

### New Capabilities

- `resolver-task-authoring`: Per-task resolver selection (dropdown), JSON config textarea for non-LLM resolvers, and an optional LLM prompt textarea when resolver is `llm`. Includes per-task `input_shapes`/`output_shapes` tag inputs in `CreateActivityDialog`.
- `tags-first-classification`: Replace `ActivityCategory` type + required `category` field with `tags: string[]` as primary classification. Update `ActivityCard` badge, `TemplateFilters` quick-filter row, `CreateActivityDialog` form, and API payload builder.

### Modified Capabilities

- `task-shape-contributions`: Extend the existing per-task shape tracking spec — `ActivityTask` now carries `input_shapes` and `output_shapes` arrays; `TaskEditor` renders them as read-only compact tag displays in the detail panel.

## Impact

**Frontend (`repos/workbench/src/`):**
- `types/index.ts`: type changes (`ActivityCategory` removed, `ActivityTemplate.category` optional, `ActivityTask` gains `input_shapes`/`output_shapes`)
- `components/trajectory/CreateActivityDialog.tsx`: replace category dropdown + promptTemplate textarea; add resolver dropdown, config/prompt conditional fields, per-task shape tag inputs, expandable validation section
- `components/trajectory/ActivityCard.tsx`: replace `[category]` badge with first-tag or fallback display; update `handleSaveVariant` to omit `category` from payload when tags present
- `components/trajectory/TaskEditor.tsx`: add per-task shape display section in detail panel
- `components/templates/TemplateFilters.tsx`: replace category quick-filter row with tag-based filter chips
- `components/templates/TemplateCard.tsx`: prefer `tags[0]` over `category` for the classification badge
- `hooks/useTemplates.ts`: `CreateTemplateRequest` uses `tags`, `category` optional; `Task` type gains `resolver`, `config`, `input_shapes`, `output_shapes`
- `lib/api.ts`: `CreateTemplateRequest.category` optional; `tags` required

**No backend changes** — the activity-api already accepts `tags`, `resolver`, `config`, and `input_shapes`/`output_shapes` per task.

**No new dependencies** — uses existing shadcn/ui `Select`, `Badge`, and inline `<textarea>` primitives.
