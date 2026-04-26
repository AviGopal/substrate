# tags-first-classification Specification

## Purpose
TBD - created by archiving change workbench-resolver-first-authoring. Update Purpose after archive.
## Requirements
### Requirement: ActivityCategory type is removed; ActivityTemplate.category is optional
The `ActivityCategory` type SHALL be removed from `src/types/index.ts`. `ActivityTemplate.category` SHALL become `category?: string`. `ActivityTemplate.tags` SHALL become `tags: string[]` (required, default `[]`).

#### Scenario: ActivityTemplate with only tags renders without error
- **WHEN** an API response returns an ActivityTemplate with `tags: ["feature.vessel.state"]` and no `category`
- **THEN** the template renders without TypeScript errors or runtime exceptions

#### Scenario: ActivityTemplate with only category renders without error
- **WHEN** an API response returns an ActivityTemplate with `category: "feature"` and `tags: []`
- **THEN** the template renders the category value as a fallback classification display

### Requirement: ActivityCard displays first tag as classification badge with category fallback
The `[category]` badge in `ActivityCard` SHALL display `template.tags[0]` when `tags` is non-empty. When `tags` is empty or absent, it SHALL fall back to `template.category`. When both are absent, the badge SHALL be omitted.

#### Scenario: Tags present — first tag shown
- **WHEN** a template has `tags: ["feature.vessel.state", "utility.code"]`
- **THEN** the ActivityCard badge shows `[feature.vessel.state]`

#### Scenario: No tags, category present — category shown
- **WHEN** a template has `tags: []` and `category: "bugfix"`
- **THEN** the ActivityCard badge shows `[bugfix]`

#### Scenario: Neither tags nor category — badge omitted
- **WHEN** a template has `tags: []` and no `category`
- **THEN** no classification badge is rendered

### Requirement: CreateActivityDialog uses TagInput for classification instead of category dropdown
The `CreateActivityDialog` SHALL replace the `category` `<Select>` dropdown with a `TagInput` component for entering `tags`. Tags SHALL be submitted as the `tags` field in the POST payload. A derived `category` value SHALL be computed from `tags[0]?.split('.')[0]` and included in the payload for backward compatibility when tags are non-empty.

#### Scenario: Tags entered are included in payload
- **WHEN** the user enters tags `["feature.vessel.state"]` and submits
- **THEN** the payload includes `tags: ["feature.vessel.state"]` and `category: "feature"`

#### Scenario: No tags entered omits category from payload
- **WHEN** the user submits with no tags entered
- **THEN** the payload includes `tags: []` and no `category` field

#### Scenario: TagInput accepts dot-notation tags
- **WHEN** the user types `meta.develop.activity` and presses Enter
- **THEN** `"meta.develop.activity"` is added as a tag chip in the dialog

### Requirement: TemplateFilters replaces category quick-filter buttons with tag-prefix filter
The hardcoded category quick-filter buttons (`Feature`, `Bugfix`, `Refactor`, etc.) in `TemplateFilters` SHALL be replaced with a free-form tag filter input. The new input SHALL filter templates using the `tags` query parameter. The existing expanded-panel tag section (popular tags) SHALL remain.

#### Scenario: Tag filter input sends tags query param
- **WHEN** the user types a tag prefix in the tag filter input
- **THEN** the `onFiltersChange` callback receives `{ tags: ["<value>"] }` after debounce

#### Scenario: Clearing tag filter resets tags param
- **WHEN** the tag filter input is cleared
- **THEN** the `onFiltersChange` callback receives `{ tags: undefined }`

### Requirement: TemplateCard displays first tag as primary classification badge
The `TemplateCard` in `src/components/templates/TemplateCard.tsx` SHALL prefer `template.tags[0]` over `template.category` for the primary classification badge. The badge SHALL use the same color-mapping lookup, falling back to a neutral style for unknown tag prefixes.

#### Scenario: Tag-based badge shown when tags present
- **WHEN** a template has `tags: ["refactor.cleanup"]` and `category: "feature"`
- **THEN** the TemplateCard shows the badge for `"refactor.cleanup"` (first tag)

#### Scenario: Category badge shown as fallback
- **WHEN** a template has `tags: []` and `category: "infrastructure"`
- **THEN** the TemplateCard shows the `infrastructure` badge

### Requirement: useTemplates CreateTemplateRequest sends tags not category
The `CreateTemplateRequest` in `src/hooks/useTemplates.ts` SHALL have `tags: string[]` as required and `category?: string` as optional. The `Task` interface in `useTemplates.ts` SHALL add `resolver?: string`, `config?: Record<string, unknown>`, `input_shapes?: string[]`, `output_shapes?: string[]`.

#### Scenario: CreateTemplateRequest type accepts tags without category
- **WHEN** a CreateTemplateRequest is constructed with `tags: ["meta.develop"]` and no `category`
- **THEN** TypeScript compilation succeeds without type errors

### Requirement: lib/api.ts CreateTemplateRequest has optional category and required tags
The `CreateTemplateRequest` in `src/lib/api.ts` SHALL have `category?: string` (optional) and `tags: string[]` (required). The `createTemplate` function SHALL not require a `category` argument.

#### Scenario: createTemplate called with only tags succeeds
- **WHEN** `createTemplate` is called with `{ name, description, tasks, tags: ["feature.auth"] }`
- **THEN** no TypeScript compilation error is raised

