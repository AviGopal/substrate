## 1. Type System Updates

- [x] 1.1 In `repos/workbench/src/types/index.ts`: remove the `ActivityCategory` type alias
- [x] 1.2 In `repos/workbench/src/types/index.ts`: change `ActivityTemplate.category` from `category: ActivityCategory` to `category?: string`
- [x] 1.3 In `repos/workbench/src/types/index.ts`: change `ActivityTemplate.tags` from `tags?: string[]` to `tags: string[]` (default `[]` at call sites)
- [x] 1.4 In `repos/workbench/src/types/index.ts`: add `input_shapes?: string[]` and `output_shapes?: string[]` to the `ActivityTask` interface

## 2. API Client Type Updates

- [x] 2.1 In `repos/workbench/src/lib/api.ts`: change `CreateTemplateRequest.category` from `category: string` to `category?: string`
- [x] 2.2 In `repos/workbench/src/lib/api.ts`: add `tags: string[]` as a required field to `CreateTemplateRequest`
- [x] 2.3 In `repos/workbench/src/hooks/useTemplates.ts`: change `CreateTemplateRequest.category` to `category?: string` and add `tags: string[]`
- [x] 2.4 In `repos/workbench/src/hooks/useTemplates.ts`: add `resolver?: string`, `config?: Record<string, unknown>`, `input_shapes?: string[]`, `output_shapes?: string[]` to the `Task` interface

## 3. CreateActivityDialog — Tags-First Classification

- [x] 3.1 In `repos/workbench/src/components/trajectory/CreateActivityDialog.tsx`: remove the `CATEGORIES` constant and the `category` state variable
- [x] 3.2 In `repos/workbench/src/components/trajectory/CreateActivityDialog.tsx`: add a `tags: string[]` state variable (default `[]`) and replace the category `<Select>` block with a `<TagInput label="Tags" tags={tags} onChange={setTags} />` row
- [x] 3.3 In `repos/workbench/src/components/trajectory/CreateActivityDialog.tsx`: remove the `ActivityCategory` import from `@/types`
- [x] 3.4 In `repos/workbench/src/components/trajectory/CreateActivityDialog.tsx`: in `handleSubmit`, set `tags` in the payload (always); derive and include `category` as `tags[0]?.split('.')[0]` only when `tags` is non-empty

## 4. CreateActivityDialog — TaskRow and Resolver-First Authoring

- [x] 4.1 In `repos/workbench/src/components/trajectory/CreateActivityDialog.tsx`: extend the `TaskRow` interface to `{ id, description, resolver, config, prompt, inputShapes, outputShapes, validationRules }` and update default state for new tasks
- [x] 4.2 In `repos/workbench/src/components/trajectory/CreateActivityDialog.tsx`: replace the `promptTemplate` textarea in each task row with a resolver `<Select>` dropdown listing `llm`, `bash`, `git`, `file`, `human`, `impulse-resolve`, `context-acquisition`; default to `llm`
- [x] 4.3 In `repos/workbench/src/components/trajectory/CreateActivityDialog.tsx`: add conditional rendering — when resolver is `llm`, show a prompt textarea; when resolver is not `llm`, show a config textarea (JSON) instead
- [x] 4.4 In `repos/workbench/src/components/trajectory/CreateActivityDialog.tsx`: add `onBlur` JSON parse validation on the config textarea; show an inline error badge when the value is non-empty and invalid JSON
- [x] 4.5 In `repos/workbench/src/components/trajectory/CreateActivityDialog.tsx`: add per-task `TagInput` rows for `input_shapes` and `output_shapes` beneath the resolver/config/prompt fields
- [x] 4.6 In `repos/workbench/src/components/trajectory/CreateActivityDialog.tsx`: add an expandable validation section per task row (toggle button + collapsed by default) containing `requiredPatterns` and `forbiddenPatterns` `TagInput` controls
- [x] 4.7 In `repos/workbench/src/components/trajectory/CreateActivityDialog.tsx`: update `updateTask` helper to handle the new `TaskRow` fields (resolver, config, prompt, inputShapes, outputShapes, validationRules)
- [x] 4.8 In `repos/workbench/src/components/trajectory/CreateActivityDialog.tsx`: update `handleSubmit` to build each task payload as `{ id, description, resolver, config (parsed JSON object when valid), prompt (when resolver is llm and non-empty), input_shapes, output_shapes, validation }` — show a warning toast when config JSON is invalid and omit config from that task

## 5. ActivityCard — Tags Badge

- [x] 5.1 In `repos/workbench/src/components/trajectory/ActivityCard.tsx`: change the `[category]` badge span to display `activity.template.tags?.[0] ?? activity.template.category` (omit span when both are absent)
- [x] 5.2 In `repos/workbench/src/components/trajectory/ActivityCard.tsx`: update `categoryColors` lookup to accept the full first-tag string as well as the legacy category values (colour by prefix segment: `tag.split('.')[0]`)
- [x] 5.3 In `repos/workbench/src/components/trajectory/ActivityCard.tsx`: update `handleSaveVariant` to pass `tags: template.tags ?? []` in the `createTemplate` call alongside the existing `category` field

## 6. TemplateCard — Tags Badge

- [x] 6.1 In `repos/workbench/src/components/templates/TemplateCard.tsx`: replace the `{template.category && <Badge ...>{template.category}</Badge>}` block with logic that uses `template.tags?.[0] ?? template.category` as the badge label, falling back gracefully when both are absent

## 7. TemplateFilters — Tag-Based Quick Filter

- [x] 7.1 In `repos/workbench/src/components/templates/TemplateFilters.tsx`: remove the hardcoded `categories` array constant and the category quick-filter button row (the `<div className="flex flex-wrap...">` block that maps over `categories`)
- [x] 7.2 In `repos/workbench/src/components/templates/TemplateFilters.tsx`: add a debounced tag filter `<Input>` below the search bar that calls `onFiltersChange({ ...filters, tags: [value] })` when non-empty and `onFiltersChange({ ...filters, tags: undefined })` when cleared
- [x] 7.3 In `repos/workbench/src/components/templates/TemplateFilters.tsx`: update `hasActiveFilters` and `activeFilterCount` calculations to reflect removal of `filters.category` (which is no longer a primary filter) and the new inline tag input value

## 8. TaskEditor — Per-Task Shape Display

- [x] 8.1 In `repos/workbench/src/components/trajectory/TaskEditor.tsx`: in the detail panel, after the `── prompt ──` divider line and before `<TaskPromptEditor>`, add a read-only shape display row: when `task.input_shapes` is non-empty, render a compact `in:` label followed by monospace badge chips for each shape
- [x] 8.2 In `repos/workbench/src/components/trajectory/TaskEditor.tsx`: in the detail panel, after `<TaskPromptEditor>` and before the `── validation ──` divider, add a read-only shape display row: when `task.output_shapes` is non-empty, render a compact `out:` label followed by monospace badge chips for each shape
- [x] 8.3 In `repos/workbench/src/components/trajectory/TaskEditor.tsx`: ensure the new shape rows are conditionally rendered (not rendered when the respective array is absent or empty) so existing tasks without shape data are not affected

## 9. Fix Downstream TypeScript Errors

- [x] 9.1 In `repos/workbench/src/components/trajectory/ApplicableActivitiesPanel.tsx`: update any references to `ActivityCategory` or required `category` field to use the optional form
- [x] 9.2 In `repos/workbench/src/components/trajectory/VariantCreationDialog.tsx`: update the `parentTemplate` / `modifiedTemplate` typed props to accept `category?: string` (not required)
- [x] 9.3 In `repos/workbench/src/stores/trajectoryStore.ts`: if `ActivityTemplate` is referenced with required `category`, update to use optional form; ensure default-constructed templates initialise `tags: []`
- [x] 9.4 In `repos/workbench/src/pages/TemplatesPage.tsx`: update any `category` filter state or pass-through to `TemplateFilters` to remove references to the old category quick-filter interface

## 10. Test Updates

- [x] 10.1 In `repos/workbench/src/hooks/useTemplates.test.tsx`: update any test fixtures that set `category: ActivityCategory` to use `category?: string` and add `tags: string[]` to fixture objects
- [x] 10.2 In `repos/workbench/src/components/trajectory/TaskEditor.test.tsx`: add a test case that renders a task with `input_shapes: ["file_content"]` and `output_shapes: ["test_result"]` and asserts the shape badge rows are present in the expanded detail panel
- [x] 10.3 In `repos/workbench/src/components/trajectory/TaskEditor.test.tsx`: add a test case that renders a task without shape fields and asserts no shape rows are rendered
