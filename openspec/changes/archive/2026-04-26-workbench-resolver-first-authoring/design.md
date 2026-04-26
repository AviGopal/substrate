## Context

`CreateActivityDialog` (`repos/workbench/src/components/trajectory/CreateActivityDialog.tsx`) already has:
- Resolver dropdown (`llm`, `bash`, `git`, `file`, `human`, `impulse-resolve`, `context-acquisition`)
- Conditional prompt textarea (LLM) or raw JSON config textarea (non-LLM)
- Per-task shape tag inputs and collapsible validation section
- Correct submission payload — `resolver`, `config` (parsed JSON), `prompt` (LLM only), `input_shapes`, `output_shapes`, `validation`

The only gap is UX: the raw JSON textarea for `bash`/`file`/`git` requires users to know the expected JSON schema. This change extracts the config section into a `ConfigEditor` component that renders structured fields for the three most common deterministic resolvers.

## Goals / Non-Goals

**Goals:**
- Replace the inline raw JSON textarea in `CreateActivityDialog` task rows with a `<ConfigEditor resolver={…} onChange={…} />` call
- `ConfigEditor` renders structured fields for `bash` (command + timeout), `file` (path + operation + content), `git` (operation)
- `ConfigEditor` falls back to the existing raw JSON textarea for all other resolvers
- Resolver change resets `ConfigEditor` internal state
- Submission payload is byte-for-byte identical to what the raw JSON path produced — no API contract change

**Non-Goals:**
- Structured editors for `human`, `impulse-resolve`, `context-acquisition` (raw JSON fallback is sufficient)
- Validation of bash command syntax, file path existence, or git operation preconditions
- Persisting partial config state to localStorage across dialog open/close cycles
- Any change to the resolver dropdown list or the available resolver options

## Decisions

### Decision: Extract ConfigEditor as a separate file, not an inline function

`CreateActivityDialog` is already 525 lines. Adding per-resolver form logic inline would push it past the 200-line component guideline from `workbench/CLAUDE.md`. A separate `ConfigEditor.tsx` keeps the task row readable and makes ConfigEditor independently testable.

**Alternative considered**: Inline switch/case in `CreateActivityDialog`. Rejected because it bloats the file and makes future resolver additions require touching two concerns.

### Decision: ConfigEditor owns its own internal state; calls onChange with derived config object

`ConfigEditor` maintains its own `useState` for each resolver's fields (command, timeout, path, operation, content, rawJson). On any field change it derives the config object and calls `onChange(config)`. The parent (`CreateActivityDialog`) stores the opaque `config` in `TaskRow` as it does today — no change to `TaskRow` shape.

**Alternative considered**: Lifting all field state into `TaskRow` (adding `bashCommand`, `bashTimeout`, `filePath`, etc.). Rejected because it pollutes the `TaskRow` interface with resolver-specific concerns and makes future resolvers require interface changes.

### Decision: Reset ConfigEditor state on resolver change via useEffect + key prop

When the parent changes the `resolver` prop, `ConfigEditor` must reset. We use a `useEffect` watching `resolver` to clear internal state. The parent additionally passes `key={task.resolver}` on `<ConfigEditor>` to guarantee a fresh mount on resolver switch — this is the simplest and most reliable reset mechanism in React.

**Alternative considered**: Imperative `ref.reset()` method. Rejected — more complex and unnecessary given that a key change achieves the same result declaratively.

### Decision: Timeout field accepts empty string (no constraint) or positive integer

Rather than defaulting to a hardcoded timeout (e.g., 5000ms), the field is optional. When empty, `timeout` is omitted from the config object. This matches how minibob resolvers treat a missing `timeout` — they apply their own default. Forcing a value would add noise to templates that don't need a custom timeout.

## Risks / Trade-offs

- [Risk] ConfigEditor raw JSON fallback diverges from structured editors in styling → Mitigation: use the same `font-mono text-xs` class and border/bg styling as existing textareas; visually uniform.
- [Risk] `key={task.resolver}` causes ConfigEditor to unmount/remount on every resolver change, discarding partial input → Mitigation: this is intentional per the reset requirement; acceptable trade-off given that resolver changes are infrequent and stale field values would cause confusion.
- [Risk] Structured git editor only exposes `operation` — commit message, push remote, etc. are not captured → Mitigation: git tasks in practice delegate detail to minibob's GitResolver which infers context; the `operation` key is the only required discriminator. Advanced users can switch to the raw JSON fallback if needed (but `git` would need to fall through to the JSON path — acceptable to leave as structured-only for now).

## Migration Plan

No data migration needed. The change is additive at the UI layer only. Existing templates are unaffected. The submission payload is identical to the raw JSON path.

Deployment: ship as a single PR to `repos/workbench`. No backend changes required.

## Open Questions

- Should `git` resolver also expose a `message` field for commit operations, or is the bare `{ operation: "commit" }` sufficient for the initial cut? Current decision: bare operation only, revisit if users request it.
