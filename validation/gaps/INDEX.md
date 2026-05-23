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
| _(no observations yet)_ | | | | | | |

## Categories

See [`docs/SUBSTRATE_NARRATION_PROTOCOL.md`](../../docs/SUBSTRATE_NARRATION_PROTOCOL.md) §D for category definitions:
`missing_concept`, `missing_idiom`, `missing_pattern`, `conversation_only`,
`doc_unread`, `training_knowledge`, `irreducibly_operator`.

See §E for the bridge-path enumeration.
