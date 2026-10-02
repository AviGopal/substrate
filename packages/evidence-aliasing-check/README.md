# evidence-aliasing-check

A field that one mechanism **computes from** must not be written by another
mechanism for its own bookkeeping.

## Why this exists

The substrate's laws guard the *compute* step. Gates are computation-time checks
over fresh inputs, and they are reliably correct. Nothing guards the *evidence*
step — law 1 makes every field addressable and therefore rewritable, with no
ownership discipline. The result is a recurring, silent class:

| field | consumed as | also written by | measured effect |
|---|---|---|---|
| `variant_performance_metrics.updated_at` | decay's elapsed clock | counter upserts, chain-credit's ancestor write | decay under-applied **~281×** — `auth_resolve_v1` β went 401,383 → 401,710 over ten days where a live 30-day half-life should have left ~318,578 |
| `activity_composition_graph.created_at` | edge age | upsert | 254 rows looked "created today"; only **67** were new edges |
| `gaps.detected_at` | law-7 latency | TTL expiry | latency uncomputable |
| `<gap>-compose-report.json` | the goal-host reconciler's evidence | the next attempt on the same gap id | a correctly-written reconciler cannot work: its input is destroyed before it reads it |

Hand inspection of the first row found 3 writers. This check found **8**,
including the chain-credit path in `posterior-update.ts` — which is what keeps a
common ancestor's decay clock permanently fresh, so its posterior never drains.

## Why it is static

Every *runtime* detector for these defects would consume the same reach/trace
evidence the defects corrupt. This check reads source only, so **it cannot be
starved by what it detects.** That is the whole reason it is worth having.

## Usage

```
bun check.ts <vessel-root>
```

Exit `0` when all findings are in known files; exit `1` when an aliasing writer
appears in a file outside the rule's `baselineFiles`.

Wired per-vessel via `scripts/check-evidence-aliasing.ts`, mirroring
`shape-dispatch-check`. A standalone vessel checkout without the super-repo
**skips** rather than fails — a check that looks flaky gets disabled.

## Baselining by file, not by count

Running an earlier version against two checkouts of the same repo minutes apart
gave 8 and 9, because line numbers and statement layout differed. A file set is
stable under refactoring within a file and still catches the thing worth
catching: aliasing appearing somewhere new.

## Adding a rule

Rules are explicit, not inferred. An inferred rule set would have to decide what
counts as "an elapsed-time computation", and a wrong guess produces noise that
gets the whole check ignored. Add `{ table, field, consumer, baselineFiles }`.

## The check's own first bug

`\b(UPDATE)\b` matched the word "update" inside the import path
`../lib/posterior-update`, because a hyphen is a word boundary. That anchored the
statement window on an import line and discarded the scope lookback that would
have found the consumer — flagging a *correct* file. **The check committed the
defect class it exists to detect.** Caught by a negative-control fixture, not by
review. Both controls are worth keeping in mind when editing the matcher: a file
that applies the consumer must pass, and a file that does not must fail.
