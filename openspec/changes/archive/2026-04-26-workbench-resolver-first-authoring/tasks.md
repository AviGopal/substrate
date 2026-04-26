## 1. Create ConfigEditor component

- [x] 1.1 Create `repos/workbench/src/components/trajectory/ConfigEditor.tsx` with a `ConfigEditorProps` interface: `{ resolver: string; onChange: (config: Record<string, unknown> | undefined) => void }`
- [x] 1.2 Implement the `bash` branch: render a `command` textarea (required) and a `timeout` number input (optional); call `onChange` with `{ command, timeout? }` on every field change, omitting `timeout` when the input is empty
- [x] 1.3 Implement the `file` branch: render a `path` text input, an `operation` Select (read/write/edit/append, default `read`), and a `content` textarea hidden when `operation === 'read'`; call `onChange` with `{ path, operation, content? }`
- [x] 1.4 Implement the `git` branch: render an `operation` Select (diff/log/commit/push/status, default `diff`); call `onChange` with `{ operation }`
- [x] 1.5 Implement the fallback branch for all other resolvers: render the existing raw JSON textarea with `onBlur` JSON validation (mirrors current inline textarea in `CreateActivityDialog`); call `onChange` with the parsed object or `undefined` on invalid JSON

## 2. Reset state on resolver change

- [x] 2.1 Add a `useEffect` inside `ConfigEditor` watching the `resolver` prop; reset all internal field `useState` values to their defaults when `resolver` changes
- [x] 2.2 Verify via manual test: switch resolver from `bash` to `git` in the dialog — command and timeout fields should be gone and the git operation picker should start at `diff`

## 3. Wire ConfigEditor into CreateActivityDialog

- [x] 3.1 Import `ConfigEditor` into `CreateActivityDialog.tsx`
- [x] 3.2 Remove the inline raw JSON textarea block (the `else` branch of the `task.resolver === 'llm'` conditional) and replace it with `<ConfigEditor key={task.resolver} resolver={task.resolver} onChange={(cfg) => updateTask(task.id, { config: cfg ? JSON.stringify(cfg) : '' })} />`
- [x] 3.3 Remove the `handleConfigBlur` handler and the `configError` field from `TaskRow` — JSON validation responsibility now lives inside `ConfigEditor` for the raw JSON fallback branch; structured branches produce valid objects by construction

## 4. Adjust submission payload

- [x] 4.1 In `handleSubmit`, update the config-parsing block for non-LLM tasks: instead of `JSON.parse(t.config)`, use `t.config` as the pre-parsed object directly (since `ConfigEditor` now stores a `Record<string, unknown>` reference). Update `TaskRow.config` type from `string` to `Record<string, unknown> | undefined` to match
- [x] 4.2 Verify the submission payload for a bash task is `{ id, description, resolver: "bash", config: { command: "bun test", timeout: 5000 } }` with no `prompt` field — check via browser network tab against a local dev API or canary

## 5. Export and tests

- [x] 5.1 Add `ConfigEditor` to `repos/workbench/src/components/trajectory/index.ts` exports
- [x] 5.2 Write unit tests in `ConfigEditor.test.tsx` covering: bash config onChange output, file config with read operation omits content, git config onChange output, raw JSON fallback parses valid JSON and calls onChange, raw JSON fallback calls onChange with undefined for invalid JSON
