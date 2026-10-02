# Run 0 (dry run, not graded) — seeded regression R0

- Landing: `24807da` (development-vessel), canary `intact` → `broken`, dispatch `552ec8f4…`.
- Registration: `att-mueixlmo-nood0hg`, `authoring_execution_id` = the dispatch id (plumbing works).
- Outcome (19:59:16): `intended: met`, `unexpected_flips: []`, `surprise: true` (only because
  the fixture is a check-definition file), 1 lesson written.
- Settlement (20:02:20, 2-minute window): **`held`** — a FALSE NEGATIVE.

## Why

The pre-snapshot (19:56:47.542) already read `ledger_canary: fail`. feature_compose's staging
loop copies each staged file into the live runtime tree (`preLiveSync`, logged as
`[fc-stage]` at 19:56:16) before the cutover runs, and the cutover registered the attempt
afterwards at its commit step. Pre and post both saw the change, so no flip existed.

Refuted on the way (recorded so they are not re-tried): the canary check logic (correct);
the tree-swap cutover path (not taken with staged files); the push clone aliasing
`/vessels` (separate inodes); hidden earlier commits (clone reflog shows none).

## Repair (dispatched)

feature_compose registers the attempt (pre-snapshot) before the live copy and passes
`attempt_id` to the cutover; the cutover's `registerAttempt` is idempotent on that id and
reuses the early intent. The graded runs start only after both land and a rerun of R shows
`ledger_canary` pass → fail as an unexpected flip.
