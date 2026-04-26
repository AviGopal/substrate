## Why

`CreateActivityDialog` already supports resolver selection and a raw JSON config textarea for non-LLM tasks. When a user picks `bash`, `file`, or `git`, they must manually type a JSON object with no guidance on required fields — a friction point that leads to malformed configs and omitted payloads. Structured per-resolver config editors eliminate guesswork and make resolver-first authoring a first-class workflow.

## What Changes

- **MODIFIED**: The raw JSON config textarea shown for non-LLM resolvers is replaced by resolver-specific structured editors:
  - `bash` → `command` textarea + `timeout` number input
  - `file` → `path` text input + `operation` picker (read/write/edit/append) + optional `content` textarea
  - `git` → `operation` picker (diff/log/commit/push/status)
  - `human` / `impulse-resolve` / `context-acquisition` / any unknown → raw JSON textarea (existing fallback, kept as is)
- **MODIFIED**: The config field shown for `llm` tasks gains an optional `model` input alongside the existing prompt textarea (non-blocking — existing `llm` behavior unchanged for the empty-model case).
- **ADDED**: A `ConfigEditor` sub-component encapsulates all resolver-specific forms and the JSON fallback. It is imported into the existing `CreateActivityDialog` task row in place of the inline textarea block.
- No change to the submission payload shape — structured editors produce the same `config: { … }` object that the raw JSON path produces today.

## Capabilities

### New Capabilities

- `resolver-config-editor`: Structured per-resolver config editor component shown inside `CreateActivityDialog` task rows for `bash`, `file`, and `git` resolvers; falls back to raw JSON for unknown resolvers.

### Modified Capabilities

- `resolver-task-authoring`: The existing spec covers resolver selection, prompt/config switching, output shapes, and validation rules. This change modifies the config field requirement for `bash`, `file`, and `git` resolvers — structured inputs replace the raw JSON textarea for those three resolvers.

## Impact

- **Files changed**: `repos/workbench/src/components/trajectory/CreateActivityDialog.tsx` (replace inline config textarea with `<ConfigEditor>` call), new file `repos/workbench/src/components/trajectory/ConfigEditor.tsx`
- **No API changes** — payload shape is unchanged
- **No new dependencies** — uses existing shadcn/ui primitives (`Select`, `Input`, `Textarea`)
- **No breaking changes** — raw JSON fallback preserved for resolver types not in the structured set
