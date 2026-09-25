# Program check-ins

One row per hourly check. Reach (adj) excludes pre-admission pinned refusals and empty declarative runs.

| UTC | CPU / mem (container) | trace store | retention fails/h | dispatches/h, reach (adj) | gaps opened/closed per h, open | landings/h dev·gh | surface probe | audited gaps |
|---|---|---|---|---|---|---|---|---|
| 02:45 | ~5 cores / 23.8 GB | 42 GB | ~42 | —, 14% raw over 24h | 469/36 per 24h, 1766 | — | R2 fail (43 vs 178) | filed |
| 04:30 | ~5 cores / 21.6 GB | 43 GB (+1 GB in ~2h) | 52 | 100, 20% (34 pinned refusals, 15 empty) | 62/6, 1678 | 3·3 | R1 pass after probe fix; R2 fail; runs visible 3.7% | 4 substrate attempts: 3 lane BUSY, 1 inferred shellResult |

## Landing verifications

| UTC | Gap | Landing | Verdict |
|---|---|---|---|
| 04:50 | `goal-target-inference-picks-shellresult-…` | goal-host `e9ee9b4` (strip trailing punctuation in goal normalization) | **failed**: falsifier re-run `e658c2a7` still infers `[shellResult]` and fails; recorded `BEHAVIORAL VERIFICATION FAILED`, `regressed_by: e9ee9b4` |
| 04:45 | `the-substrate-cannot-see-its-own-human-surface-…` (operator hold) | development-vessel `030b224` (scan tries `human_surface:ui_view`, falls back to obsidian) | **hollow**: human-surface rejects `human_surface:ui_view`, so behaviour is unchanged; recorded as failed. The gap was held and was composed anyway, so filed `operator-hold-only-guards-closing-…` |
| 05:00 | `operator-hold-only-guards-closing-…` (filed 04:35) | development-vessel `31ce2f7` (pick predicate skips `operator_hold`; pick log counts exclusions), live 04:51 | **passing (provisional)**: 1 pick since live, `operator_hold_excluded=7`, 0 of 38 held gaps picked; full falsifier is 24h, re-check at next check-ins. Filed-to-landed 13 min |
