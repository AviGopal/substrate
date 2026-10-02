# @metabob/shape-dispatch-check

Zero-dependency lint check enforcing vessel invariant 2: every shape advertised
in `src/config.ts` must have a matching `case '...':` in `src/routes/impulses.ts`,
and every dispatch case must have a matching advertised shape.

## Usage

```bash
# Check a specific vessel
bun packages/shape-dispatch-check/check.ts repos/metabob-activity-api/

# Check the current directory
bun packages/shape-dispatch-check/check.ts
```

Exit 0 on success, exit 1 on any unsuppressed violation.

## What it checks

Given a vessel with:

- `src/config.ts` — contains a `shapes: [...]` or `advertised_shapes: [...]` array
- `src/routes/impulses.ts` — contains a `switch (pointer.type)` dispatch block

The check computes:

1. **Unhandled advertised shapes** — shape in config.ts has no `case '...'` in impulses.ts.
   Fix: add the case, or remove the shape from the advertised list.

2. **Orphan handlers** — `case '...'` in impulses.ts has no matching advertised shape in config.ts.
   Fix: add the shape to config.ts, or annotate the case as private (see below).

## Suppressing an orphan handler

If a case is intentionally internal (not routable via discovery), suppress it with:

```typescript
// @shape-dispatch:private
case 'internalShape': {
  // ...
}
```

The annotation must be on the line immediately preceding the `case` keyword
(blank lines between the annotation and the case are ignored).

## Mapping shapes to different case labels

Some vessels advertise shapes whose names differ from the `pointer.type` literals
in the dispatch switch (e.g. `identity-vessel` advertises `authentication` but
dispatches on `apiKey`, `session`, `jwtToken`).

Create `shape-dispatch.config.json` in the vessel root:

```json
{
  "mappings": {
    "authentication": ["apiKey", "session", "jwtToken"]
  }
}
```

Any advertised shape in the mappings block is considered handled when at least
one of its mapped labels has a dispatch case.

## Integration into a vessel

Add to the vessel's `package.json` `lint` script:

```json
{
  "scripts": {
    "lint": "bun run lint:types && bun packages/shape-dispatch-check/check.ts ."
  }
}
```

Or as a standalone script:

```json
{
  "scripts": {
    "check-shapes": "bun ../../packages/shape-dispatch-check/check.ts ."
  }
}
```
