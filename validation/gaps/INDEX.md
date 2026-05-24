# Substrate-Narration Gaps Index

This directory accumulates gap records produced by the substrate-narration
workflow. Each `<gap_id>.yaml` file is a description-record artifact;
this `INDEX.md` is the bridge-priority list across all of them.

For the methodology and record format, see
[`docs/SUBSTRATE_NARRATION_PROTOCOL.md`](../../docs/SUBSTRATE_NARRATION_PROTOCOL.md).

## Usage

After running `bun run validation/scripts/substrate-narrator.ts` and writing
one or more description records to this directory, update the table below:

- **Increment `recurring_count`** for any gap that matches an existing row
  (same `category` + same load-bearing knowledge).
- **Add a new row** for any gap not yet on the list. `gap_id` is monotonic
  (`g0001`, `g0002`, …); pick the next free id.
- **Sort the bridge-priority list** by `recurring_count × severity_weight`
  (severity weights: `blocking=8, substantive=4, minor=2, none=1`) when
  reviewing what to extract next.

## Index

| gap_id | category | severity | recurring_count | bridge_path | observed_first | last_observed |
|--------|----------|----------|-----------------|-------------|----------------|---------------|
| [gap-001](gap-001-no-concept-db-in-local-substrate.md) | missing_concept | substantive | 1 | deploy concept-db as substrate unit; run extract-concepts | 2026-05-23T23:30Z | 2026-05-23T23:31Z |
| [gap-002](gap-002-ws-auth-rejects-substrate-internal-key.md) | irreducibly_operator | minor | 1 | operator access issue — not substrate self-knowledge | 2026-05-23T23:30Z | 2026-05-23T23:31Z |

## Categories

See [`docs/SUBSTRATE_NARRATION_PROTOCOL.md`](../../docs/SUBSTRATE_NARRATION_PROTOCOL.md) §D for category definitions:
`missing_concept`, `missing_idiom`, `missing_pattern`, `conversation_only`,
`doc_unread`, `training_knowledge`, `irreducibly_operator`.

See §E for the bridge-path enumeration.
| gap-003 | missing_concept | substantive | 1 | extract-concepts (failure-mode taxonomy) + ribosome | 2026-05-24T03:22Z | 2026-05-24T03:26Z |
| gap-004 | missing_idiom | substantive | 2 | ribosome (literal-name-match learning) + concept-extraction | 2026-05-24T03:40:59Z | 2026-05-24T03:41:21Z |
| gap-005 | missing_pattern | substantive | 3 | ribosome + operator clarification of template-removal intent | 2026-05-24T04:01:45Z | 2026-05-24T04:06:20Z |
