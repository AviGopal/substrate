## 1. ConfigEditor value prop

- [x] 1.1 Add optional `value?: Record<string, unknown>` prop to `ConfigEditor` component interface
- [x] 1.2 Initialize ConfigEditor internal state from `value` prop on mount (use as initial state, not controlled)

## 2. TaskEditor resolver picker

- [x] 2.1 Add `resolverToTierMap` local constant in `TaskEditor.tsx` mapping resolver names to `ResolverTier` (`llm→llm`, `bash/git/file/exec→deterministic`, `pattern→pattern`)
- [x] 2.2 Import `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` from `@/components/ui/select` in `TaskEditor.tsx`
- [x] 2.3 Import `ConfigEditor` from `./ConfigEditor` in `TaskEditor.tsx`
- [x] 2.4 Add resolver `<Select>` to the expanded detail panel in `TaskEditor`, before the prompt/config section, reading `task.resolver ?? 'llm'` as value
- [x] 2.5 In the resolver `onValueChange` handler, call `onChange({ ...task, resolver: v, resolver_tier: resolverToTierMap[v] ?? 'llm', config: undefined })`
- [x] 2.6 Replace the unconditional `<TaskPromptEditor>` with conditional rendering: render `TaskPromptEditor` when resolver is `llm`, render `<ConfigEditor key={task.resolver} resolver={task.resolver} value={task.config} onChange={...} />` otherwise

## 3. Tests

- [x] 3.1 Add test: TaskEditor expanded panel renders resolver select with current resolver pre-selected
- [x] 3.2 Add test: TaskEditor resolver select defaults to `llm` when `task.resolver` is undefined
- [x] 3.3 Add test: changing resolver in TaskEditor calls onChange with updated resolver, resolver_tier, and config: undefined
- [x] 3.4 Add test: TaskEditor shows ConfigEditor (not TaskPromptEditor) when resolver is `bash`

## 4. Typecheck and Smoke

- [x] 4.1 Run `npx tsc --noEmit` in `repos/workbench` — zero new errors
- [x] 4.2 Run `npx vitest run` in `repos/workbench` — no regressions (192 passing vs 187 baseline, 78 failing unchanged)
