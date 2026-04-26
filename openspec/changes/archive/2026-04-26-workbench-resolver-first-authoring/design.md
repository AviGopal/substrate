## Approach

Extend `TaskEditor`'s expanded detail panel with a resolver `<Select>` + conditional `ConfigEditor` / `TaskPromptEditor`, mirroring the pattern already used in `CreateActivityDialog`. No new components are needed — `ConfigEditor` and `TaskPromptEditor` already exist and are reusable.

## Component Changes

### `TaskEditor` (`src/components/trajectory/TaskEditor.tsx`)

**Resolver Select** — added to the expanded detail panel, before the prompt/config section:

```tsx
<Select
  value={task.resolver ?? 'llm'}
  onValueChange={(v) => {
    const tier = resolverToTierMap[v] ?? 'llm';
    onChange({ ...task, resolver: v, resolver_tier: tier, config: undefined });
  }}
>
  <SelectTrigger ...><SelectValue /></SelectTrigger>
  <SelectContent>
    {['llm','bash','git','file','human','impulse-resolve','context-acquisition'].map(r => (
      <SelectItem key={r} value={r}>{r}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Conditional prompt vs. config** — replaces the existing unconditional `TaskPromptEditor`:

```tsx
{(task.resolver ?? 'llm') === 'llm' ? (
  <TaskPromptEditor ... />
) : (
  <ConfigEditor
    key={task.resolver}
    resolver={task.resolver!}
    onChange={(cfg) => onChange({ ...task, config: cfg })}
    value={task.config}
  />
)}
```

**`resolverToTierMap`** — a local lookup mapping resolver name → `ResolverTier`:

```ts
const resolverToTierMap: Record<string, ResolverTier> = {
  llm: 'llm',
  bash: 'deterministic', git: 'deterministic', file: 'deterministic', exec: 'deterministic',
  pattern: 'pattern',
};
```

Resolvers not in the map (e.g. `human`, `impulse-resolve`) default to `'llm'` tier (they are LLM-assisted human/impulse flows).

## `ConfigEditor` value prop

`ConfigEditor` currently receives no `value` prop (write-only). Add an optional `value?: Record<string, unknown>` prop so it can be seeded with the existing `task.config` when the panel opens. Internal state initializes from `value` on mount.

## Data flow

```
User picks resolver → onChange({ ...task, resolver, resolver_tier, config: undefined })
User edits bash command → ConfigEditor.onChange({ command }) → onChange({ ...task, config })
User switches back to llm → onChange({ ...task, resolver: 'llm', resolver_tier: 'llm', config: undefined })
```

All changes propagate through the existing `onChange` → store `updateActivity` path. No new store actions or API calls are needed (PATCH on save-as-variant already includes the full template).

## Files Changed

| File | Change |
|---|---|
| `src/components/trajectory/TaskEditor.tsx` | Add resolver Select, conditional ConfigEditor/Prompt |
| `src/components/trajectory/ConfigEditor.tsx` | Add optional `value` prop for seeding |
| `src/components/trajectory/TaskEditor.test.tsx` | New test cases for resolver picker |
