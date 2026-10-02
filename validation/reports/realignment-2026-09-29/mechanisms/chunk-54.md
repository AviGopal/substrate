# Mechanism verdicts: chunk 54 (syzygy)

Input: `classes/_mech_chunks/54.json`. It holds one collector item in area `syzygy`: the **interactor-log jsonl writer** at `syzygy-local-surface:/workspace/git/super-repo/interactor-log/interactorObservation_write.jsonl`. The collector called it "live-unused, 4 rows, no hub reader".

I verified it read-only on 2026-09-29 against three containers: `syzygy-local-surface` (spoke surface), `substrate-live` (node 1) and `compose2-live` (node 2). Class history checked: `classes/node-locality.json` and `classes/write-read-mismatch.json` (this exact symptom, sourced from `raw/syzygy.md:55-57`).

## What the item actually is (dedupe)

The collector named a *file*. The mechanism behind it is the **human-surface participation journal**, `human-surface-vessel/src/participation-journal.ts` (`appendParticipation` / `readParticipation`). It has one caller per channel in `store.ts`:

| channel | writer (`store.ts`) |
|---|---|
| `uiPanel_write` | :259 |
| `uiFeedback_write` | :353 |
| `interactorObservation_write` (exposure family only) | :433 on the hub clone, :423 in the spoke image |
| `renderPolicy_write` | :949 |

The same corpus directory has a second writer: `development-vessel/src/resolvers/interactor-passthrough.ts:10,38`. It appends `WORKSPACE_ROOT/interactor-log/<shape>.jsonl` in the envelope `{id, shape, visibility, received_at, pointer}`.

The journal was aligned to that envelope in `e78b86b` ("journal envelope"), after the open gap `human-surface-participation-journal-records-unreadable-by-interactor-log-consumers`. So "interactor-log jsonl writer" means one corpus with two writers that share one envelope. It is not a separate syzygy mechanism, and the spoke file is just one node's instance of it.

## Verdict table

| # | mechanism | verdict | used now | live evidence (2026-09-29) | discoverable via / archive at |
|---|---|---|---|---|---|
| 1 | **Participation journal / interactor-log corpus**: `participation-journal.ts` plus `interactor-passthrough.ts`; collector item "interactor-log jsonl writer" | **keep-general** (the corpus is the evidence store for surface learning). **Broken at the node seam**: it is node-local, the same failure as the rest of `node-locality`. | yes on node 1; spoke instance holds residue only | **Node 1** (`substrate-live`): `interactorObservation_write.jsonl` has 65,792 lines (about half are blank separators). 16,563 records have `candidates_total>0`. Last write 09-27 13:39. Sibling files: `uiFeedback_write` 220,765 lines (51 MB), `renderPolicy_write` 36,946 lines (**138 MB**, last write 09-27 09:16), `uiPanel_write` 20,726. **Readers exist**: `importance-learn.ts:108,270` (`readExposureCorpus` → `readParticipation("interactorObservation_write")`, falsifier (f) "learned weight survives a fresh process"); `development-vessel` `solicitation-outcome-scan.ts:71` and `escalation-disposition-apply.ts:102` read `uiFeedback_write`; `orphaned-capability-scan.ts:99` lists the `interactorObservation` shape. **Spoke** (`syzygy-local-surface`): same code in the image (`/vessels/human-surface-vessel/src/importance-learn.ts`, `participation-journal.ts`), so an in-process reader **does** exist there. The collector's "no reader" holds only for the hub. The file has 4 records (8 lines): 09-22 18:12, 20:05, 09-23 02:07, 09-25 02:48. All 4 are `tick_seq:1` with `candidates_total:0` and `visible_in_viewport_count:0`, so they carry zero information. **Node 2** (`compose2-live`): only `uiFeedback_write` (136) and `uiPanel_write` (680), last written 09-26 21:42, and no hub reader. | **Discoverable today:** the shapes `interactorObservation`, `uiFeedback`, `uiPanel` and `renderPolicy` are advertised by `human-surface-vessel/src/config.ts:66`. The *durable corpus* is not discoverable: it is a file at `process.env.WORKSPACE_ROOT ?? "/workspace"` + `/interactor-log`, which is the node-locality anti-pattern `raw/`/`git-super-2` names ("stores are local JSON files at process.env[X] ?? '/workspace/…' constants"). **To make it discoverable:** serve the corpus read as a shaped resolve (for example `interactorObservation` with a `since`/`kind` pointer) at the node holding the trace store. Readers (`importance-learn`, `solicitation-outcome-scan`, `escalation-disposition-apply`) should resolve by shape through discovery instead of `Bun.file(root + …)`, so spokes write through and do not fork. This is the same fix already applied to spend (`gap-to-feature.ts:4084` sums across discovery producers, 09-27, `node-locality` attempt "worked") and calibration (`5d0788b`, holder measures). Record it as a concept on `write-read-mismatch`/`node-locality` so the drafter recalls it. |
| 1a | spoke instance: `syzygy-local-surface:/workspace/git/super-repo/interactor-log/interactorObservation_write.jsonl` (4 empty exposure ticks) | **fossil** (data residue, not code) | no | Last write 09-25 02:48, four days ago. All records have `candidates_total:0`: the browser exposure reporter ticked on an empty board (this is the "green but empty" inventory surface in `raw/syzygy.md`). The hub corpus already holds 16.5k non-empty exposures of the same type, so nothing is lost. | Leave the file in place (the container volume is runtime state and gitignored). If it is kept as evidence, copy it under `validation/reports/realignment-2026-09-29/evidence/syzygy/interactor-log/`. Do **not** hand-merge it into the hub corpus, because four zero-candidate ticks would add empty-slice noise to `importance-learn`. |
| 1b | `renderPolicy_write.jsonl` growth on node 1 (138 MB, 36,946 lines, unbounded append) | keep-general, **needs retention** | yes (replay source for learned render weights) | The size comes from `stat` and `wc -l` on node 1. No GC or compaction reader was found in `participation-journal.ts`. The same unbounded-growth class as the trace store (`trace-store-db`) applies here. | Discoverable via the `renderPolicy` shape. Retention should become an activity that the maintenance lease governs (reuse `maintenanceLease`, law 3), not a new timer. |

## Class-history check (never call it new)

- `write-read-mismatch` already records this exact symptom: "Interactor exposure observations are written to the spoke's local interactor-log jsonl (4 rows, 9-22 to 9-25), and nothing on the hub reads them."
- `node-locality` has recurred at least 6 times since 07-13 for this root cause: "state held in per-node files … rather than one discovery-routed authoritative shape" (`git-super-2`, `memory-2`, `openspec-7`, `validation-other-3`, `transcripts-4`). The interactor log is one more member of that family, not a new finding.
- The earlier escalation incident was a human-surface corpus that no human reads. Memory `reference-248-gap-escalations-…` records 248 `needs-human-*` escalations to a pinned `:8270` with 0 answered. That failure was a pinned peer; this one is a pinned filesystem path. The class is the same, only the address differs.
- The route that worked for this class twice is to sum or read across discovery producers (spend relay `e6f07a0`/`55c0649`/`c3c4041`) or to measure at the holder (`76bf256`, `094c230`, `5d0788b`). Reuse that route. Do not mint a new sync mechanism (law 3).

## Summary

The chunk collapses to one general mechanism: the interactor-log participation corpus.

- **Keep it.** It is live on node 1, with 16.5k informative exposures and real readers in `importance-learn` and two development-vessel scans. It has two problems: the corpus is a per-node file, and `renderPolicy_write` grows without bound.
- **The syzygy spoke file is a zero-information fossil.** Its 4 records are all `candidates_total:0`.
- **The collector's "no reader" is half-true.** The spoke image carries an in-process reader. What the spoke lacks is federation: nothing it learns reaches the hub.
- **Fix at the known node-locality seam.** Reads and writes should resolve the corpus by shape through discovery, the same fix spend and calibration already received, rather than through `WORKSPACE_ROOT` files.
