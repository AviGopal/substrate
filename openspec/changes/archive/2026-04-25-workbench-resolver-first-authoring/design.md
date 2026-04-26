## Context

The workbench trajectory editor and template creation dialog were built before MiniBob's resolver-first execution model was fully surfaced in the type system. As a result:

1. **`CreateActivityDialog`** stores each task as `{ description, promptTemplate }` and always posts `prompt: { template }` — forcing the activity-api to route every task through the LLM resolver even when the intent is deterministic (bash, git, file).
2. **`ActivityTask`** in `src/types/index.ts` already has `resolver?: string` and `config?: Record<string, unknown>` but neither the dialog nor `TaskEditor` exposes them.
3. **`ActivityCategory`** is deprecated in MiniBob (`@deprecated`, replaced by dot-notation `tags`). The workbench still requires `category: ActivityCategory` and treats `tags` as optional. This causes friction when creating templates via the workbench and causes new templates to carry stale classification data.
4. **Per-task shapes** (`input_shapes`, `output_shapes`) exist at the template level but not per-task in the workbench type. `TaskEditor` shows a read-only `resolver_tier` badge but nothing about shape expectations.

**Stakeholders:** MiniBob developers authoring activity templates; the learning loop (Thompson Sampling sees resolver-tier signals from per-task fields).

**Constraints:**
- No backend changes — activity-api already accepts `tags`, `resolver`, `config`, and per-task shapes.
- No new npm dependencies — use existing shadcn/ui primitives.
- Existing `ActivityTemplate` objects from the API may still have `category` and no `tags`; the UI must degrade gracefully.

## Goals / Non-Goals

**Goals:**
- Allow authors to select the resolver for each task (not just write a prompt)
- Show `config` textarea for non-LLM resolvers; show `prompt` textarea only when resolver is `llm`
- Make `tags: string[]` the primary classification field throughout the workbench
- Add per-task `input_shapes`/`output_shapes` to the type and surface them in `TaskEditor` (read-only in existing tasks; editable in `CreateActivityDialog`)
- Surface the existing `ValidationRulesEditor` inside `CreateActivityDialog` task rows (currently only in `TaskEditor`)
- Update `TemplateFilters` and `TemplateCard` to use tags instead of `category`
- Maintain full backward compatibility with API responses that include `category` but no `tags`

**Non-Goals:**
- Implementing resolver execution or live resolver testing in the workbench
- Adding new resolver types beyond the 7 listed in the spec (no plugin system)
- Migrating existing stored templates to replace `category` with `tags` (data migration is a backend concern)
- Changing the `TaskEditor` used in the trajectory `ActivityCard` beyond adding a shape display — the existing inline prompt/validation/retry editing remains unchanged
- Removing `category` from the API payload entirely (keep sending it as a fallback for now, derived from the first tag segment if tags are present)

## Decisions

### Decision 1: `TaskRow` shape in `CreateActivityDialog`

**Choice:** Extend the local `TaskRow` interface to `{ id, description, resolver, config, prompt, inputShapes, outputShapes, validationRules }` replacing the current `{ id, description, promptTemplate }`.

**Alternatives considered:**
- Keep `promptTemplate` and add resolver alongside it: results in ambiguous UX (prompt shown for bash tasks).
- Separate dialog for non-LLM tasks: adds navigation overhead; single-dialog flow is simpler.

**Rationale:** A single interface per task row lets the form stay in one place. Conditional rendering (`resolver === 'llm'` → show prompt; else → show config) keeps the surface compact.

### Decision 2: Resolver dropdown default and ordering

**Choice:** Default resolver is `llm`. Dropdown order: `llm`, `bash`, `git`, `file`, `human`, `impulse-resolve`, `context-acquisition`. Group with a visual separator between `llm` and the deterministic resolvers.

**Alternatives considered:**
- Default to `bash`: breaks existing mental model; most users will still want LLM for new tasks.
- Alphabetical ordering: obscures the llm/deterministic split.

**Rationale:** Deterministic resolvers cost less and run faster; grouping them visually teaches authors the resolver-tier distinction without requiring documentation.

### Decision 3: Config field format

**Choice:** `config` is a free-form JSON textarea for non-LLM resolvers. Parse errors show inline without blocking submission (submit sends config as raw string with a parse warning). On submit, if `config` is valid JSON it is sent as an object; otherwise omitted with a warning toast.

**Alternatives considered:**
- Resolver-specific structured fields (bash gets a "command" input, git gets "args" input): too much upfront schema work; config shapes are open-ended and evolve.
- Always send config as a string and let the backend parse: the backend already expects an object.

**Rationale:** Free-form JSON is flexible and aligns with how `config: Record<string, unknown>` is typed. Inline parse feedback is sufficient for power users authoring templates.

### Decision 4: Tags-first classification with category fallback

**Choice:** In the workbench type system, change `ActivityTemplate.category` to `category?: string` (optional). In display components (`ActivityCard`, `TemplateCard`), show the first `tags` entry if present, else fall back to `category`. In `CreateActivityDialog`, remove the category `<Select>` and replace with a `TagInput`. In the POST payload, send `tags` always; also send `category` derived from `tags[0]?.split('.')[0]` if tags are non-empty (for API backward compat), otherwise omit.

**Alternatives considered:**
- Remove `category` from the payload entirely: activity-api still uses `category` in some query paths; keeping it as a derived field avoids a backend-side regression.
- Keep the category dropdown alongside the tags input: redundant UI; authors should not have to set both.

**Rationale:** Graceful fallback means old API data still renders correctly. The derived `category` from `tags[0]` ensures new templates remain filterable by old category-based queries until the backend fully migrates.

### Decision 5: Per-task shapes scope

**Choice:** Add `input_shapes?: string[]` and `output_shapes?: string[]` to `ActivityTask` in `src/types/index.ts`. Expose them as compact `TagInput` rows inside each task row in `CreateActivityDialog`. In `TaskEditor` (used in `ActivityCard`), show them as read-only comma-separated badge rows in the detail panel, between the prompt section and validation section.

**Alternatives considered:**
- Only template-level shapes (current state): loses signal about which specific task produces/consumes which shapes — needed for co-occurrence learning.
- Full shape editor in `TaskEditor`: editing shapes on existing live-traced tasks is risky (may contradict backend records); read-only is safer for v1.

**Rationale:** Creating new templates is the right place to set per-task shapes. Viewing them in `TaskEditor` on existing templates is informational and supports the learning loop analysis.

## Risks / Trade-offs

- **[Risk] Malformed JSON in config textarea** → Mitigation: parse on blur and on submit; show inline error badge; omit `config` from payload if invalid (with toast warning).
- **[Risk] Existing `ActivityCard.handleSaveVariant` sends `category` to `createTemplate`** → Mitigation: the save-variant path reads from `template.category` which remains on the type; update it to also pass `tags` from the template; both fields accepted by the API.
- **[Risk] `TemplateFilters` category quick-filter row currently maps hardcoded `categories` array** → Mitigation: replace with a tag-prefix filter approach (typing `feature` in the tag filter is equivalent); the category quick-filter row is replaced, not removed, so no filter capability is lost.
- **[Risk] `useTemplates.CreateTemplateRequest` and `lib/api.CreateTemplateRequest` are separate duplicate types** → Mitigation: update both; they are not yet unified. A future cleanup task should deduplicate them, but that is out of scope here.

## Migration Plan

1. All changes are purely frontend — no API migration required.
2. Existing templates in the API with `category` but no `tags` will still render (fallback display logic).
3. New templates authored after this change will carry `tags` as primary; `category` derived.
4. No feature flag needed — the dialog is an authoring surface, not a read path; the change is purely additive from the user perspective (replaces one form layout with another).

## Open Questions

- Should `TemplateFilters` continue to surface the hardcoded `popularTags` list in the expanded panel, or derive tags dynamically from loaded templates? (Recommendation: keep the hardcoded list for v1; dynamic discovery is a separate initiative.)
- Should `TaskEditor`'s per-task shape display also allow inline editing for existing trajectory tasks? (Recommendation: no for v1 — read-only is safer and sufficient.)
