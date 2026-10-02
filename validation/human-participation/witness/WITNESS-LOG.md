# Witness log — diverged in-container super-repo clone

Append-only. One entry per observation cycle. Times UTC. Read-only observation throughout.

Watched addresses (the same five each cycle, so silence is attributable):
1. `systemctl show substrate-pull-sync.service -p ExecMainStatus -p ExecMainExitTimestamp` + `journalctl -u substrate-pull-sync`
2. clone: `rev-parse --abbrev-ref HEAD`, `rev-parse HEAD`, `rev-list --left-right --count origin/dev...HEAD`, `cat-file -t` on the four SHAs, `reflog -n 5`
3. gap: `jq` on `/workspace/git/super-repo/gaps/gaps.json` for the gap id
4. compose: `journalctl -u development-vessel` grepped for the gap id / `semantic-gate` / `gap-to-feature pick` / `compose nudge`; `git -C /workspace/git/vessels/* log`
5. host: `git fetch` + `rev-parse origin/dev` in `/home/avi/documents/work/substrate`; `curl :8270/health`

---

## Cycle 1 — 2026-09-20 08:55 UTC (baseline)

- **pull-sync**: `ExecMainStatus=1`, last exit `08:55:53`. Journal identical on the 08:34:06,
  08:45:00 and 08:55:53 ticks: `super-repo: clone DIVERGED from origin/dev — refusing
  (substrateGap)` → `done — synced=0 skipped=0 failed=1` → `exiting non-zero: 1 repo(s) did not
  converge`. Timer `active (waiting)` since 2026-09-19 07:35:52, next trigger 09:06:39.
  Message unchanged. Still `failed=1`.
- **clone**: branch `development-vessel`, HEAD `191afb00`, `24 4`. Merge-base `93c70c5e`.
  All four SHAs reachable.
- **gap**: `status: open`, created `08:50:33.594Z`, `updated_at` equal to created — untouched since
  filing. `localized: null`, `edit_site: null`, `approach_decisions: 0`, `failure_lessons: 0`.
  Gap store 1847 entries.
- **panels**: `{"status":"ok","vessel":"stateful-ui-vessel","port":8270,"panels":454}`.
- **escalation triggers**: none fired.

## Cycle 2 — 2026-09-20 09:07 UTC

- **pull-sync**: tick at 09:06:49 — `ExecMainStatus=1`, `done — synced=0 skipped=0 failed=1`,
  `exiting non-zero: 1 repo(s) did not converge`. **Message byte-identical to baseline. Unchanged.**
- **clone**: branch `development-vessel`, HEAD `191afb00`, `24 4`, container `origin/dev`
  `e289bf85`. All four SHAs `cat-file -t` → `commit`. All four local branch tips unmoved
  (`dev 93c70c5e`, `development-vessel 191afb00`, `discovery-vessel 2890af2a`,
  `obsidian-episode-vessel 6190136a`).
- **porcelain**: `diff` vs baseline = **empty**; 103 lines. No new `repos/human-surface-vessel/**`
  entry.
- **gap**: `status: open`, `updated_at` still `08:50:33.594Z` — **no write to the gap in 17 min**.
  `localized: null`, `edit_site: null`, 0/0.
- **gap store**: 1847 → **1858** (+11). The substrate is actively filing gaps; it just is not
  touching this one.
- **compose**: development-vessel journal is busy — `semantic-gate` verdicts on
  `route-edit-42265768`, `recommit-route-edit-7f975550-verify_failed`, `route-edit-7570c161`, and
  repeatedly `compose nudge skipped for <other gap> — a compose is already in flight`.
  **Zero occurrences of `pull-sync-has-failed-…` in the last 400 journal lines.** Positive control
  for the grep address: the same grep returns 12 matching lines for other gap ids, so the pattern
  and journal unit are correct — the absence is real, not a mis-addressed query.
- **vessel clones**: all 18 still `0 0` and clean.
- **panels**: 454 → **456** (grew; no loss).
- **host `origin/dev`**: `e289bf85`, unmoved.
- **escalation triggers**: none fired.

### New evidence this cycle: HEAD reflog reconstructs the abandoned cutover

```
191afb00 HEAD@{2026-09-20 02:36:13}: commit: Automated commit of vessel code changes
f17a81a0 HEAD@{2026-09-20 02:23:39}: commit (merge): Merge origin/dev into development-vessel …
a6fbf4f4 HEAD@{2026-09-20 02:22:36}: checkout: moving from 93c70c5e… to development-vessel
93c70c5e HEAD@{2026-09-20 02:01:36}: checkout: moving from dev to origin/dev
93c70c5e HEAD@{2026-09-20 00:47:32}: pull --ff-only origin dev: Fast-forward
```

The sequence is: converge `dev` by fast-forward (00:47) → detach onto `origin/dev` (02:01) →
**check out `development-vessel` and merge `origin/dev` into it (02:22–02:23)** → autocommit
(02:36). The cutover moved *away* from `dev` and never moved back, and no destructive
`reset`/force-update appears anywhere in the reflog.

## Cycle 3 — 2026-09-20 09:15 UTC — structural cause located (read-only source reading)

State unchanged from cycle 2 (branch `development-vessel`, HEAD `191afb00`, `24 4`, four SHAs
reachable, gap `updated_at` still `08:50:33.594Z`). No escalation trigger fired.

Three findings, all from read-only inspection.

### (a) The substrate DID detect this itself, 6.5 hours before the operator gap

`gaps.json` holds `pull-sync-diverged-super-repo`:
`status: open`, `source: substrate_detected`, `category: source_divergence`,
`created_at: 2026-09-20T02:44:20.812Z` (the first tick after the 02:36 autocommit),
`updated_at: 2026-09-20T09:06:48.788Z` (re-touched by the most recent tick),
`closed_at: null`, `localized: null`, `edit_site: null`, `approach_decisions: 0`,
`failure_lessons: 0`.

So the detector is not missing and the signal is not missing. The gap has been refiled/re-touched
on roughly every one of ~37 ticks for 6.5 h and has **never been localized or composed against**.
`EMIT_GAPS`-style hypotheses are refuted by this row.

### (b) The repair capability EXISTS in the same script — at the sibling call site only

`scripts/substrate/substrate-pull-sync.sh`. All three copies are byte-identical
(`md5 f049267b56b196115e6cbb29f294e636`: host, image copy at
`/usr/local/share/substrate/super-repo/…`, and the clone copy), so the code read is the code
running. Unit `ExecStart=/usr/local/bin/substrate-pull-sync`.

**Per-vessel-clone path, lines 461–506 — has a divergence self-heal:**
its own comment names this exact class ("the stranded-cutover class — previously a forever-refiled
pull-sync-diverged gap an operator resolved by hand"). When every local-only commit's `%an` AND
`%cn` is the substrate identity (`SELF_ID="${SUBSTRATE_GIT_AUTHOR_NAME:-Substrate Autonomous}"`,
line 470), it runs `reset --hard HEAD` + `clean -fd` (cruft only; commits survive the rebase),
then `pull --rebase` + `push HEAD:$BRANCH`, logging `DIVERGED with only substrate-authored local
commits — rebased onto origin/$BRANCH and pushed`. Any foreign author, rebase conflict, or push
rejection → `rebase --abort` and fall back to the gap.

**Super-repo path, lines 1506–1510 — has none:**
```sh
else
  log "super-repo: clone DIVERGED from origin/$BRANCH — refusing (substrateGap)"
  emit_gap "…pull-sync-diverged-super-repo…"
  failed=$((failed+1))
fi
```
No author check, no rebase attempt, no push — a bare log + gap + counter.

**Our case satisfies the self-heal precondition exactly.** All four local-only commits are
authored AND committed by `Substrate Autonomous <substrate-autonomous@substrate.local>`
(`commitobj-*.txt`), so `FOREIGN` would be empty and the vessel-path branch would have rebased and
pushed. The super-repo simply never reaches that code. The observed journal text confirms which
branch runs: the message is the hardcoded `— refusing (substrateGap)` of line 1507, **not** any of
the three computed `$REASON` strings of lines 497–501.

This is a producer/consumer divergence: one call site was taught the repair and its sibling was
not.

Two adjacent observations on the same block, stated as observations:
- The super-repo *behind* path (1484–85) does `checkout -q "$BRANCH" || true` with **no**
  preceding `reset --hard`/`clean`, unlike the vessel path — with this clone's 103-line dirty
  tree a `checkout dev` would be expected to fail, and the `|| true` would swallow it.
- The whole super-repo block is gated at 1480 on `[ "$SREMOTE" != "$SLAST" ]` — origin having
  advanced past the last-converged marker. `$SUPER_MARKER` is only written on a successful
  converge (1519), so it currently stays stale and the block does keep firing.

### (c) Why the filed gap never reaches a compose

`repos/development-vessel/src/services/gap-drain-observer.ts`. On a
`devvessel.gap.written` event for a non-`dispatchable` gap, `nudgeComposableDrain()` posts
`{impulse:{type:"gap_to_feature", flow:"gap-compose"}}` — **a generic nudge carrying no gap id**.
The nudge asks the picker to choose; by its own comment "the picker would select the same
highest-scoring gap each time". With 1858 gaps in the store, a `source_divergence` row with
`localized: null` competes against the whole backlog. Two guards suppress most nudges anyway —
one compose in flight (`__composeDrainInflight`) and a 90 s floor
(`COMPOSE_DRAIN_MIN_INTERVAL_MS`) — and `compose nudge skipped … a compose is already in flight`
is exactly what the journal shows, repeatedly, for other gaps.

Journal control for the pickup claim: our gap id appears **4 times** across all units since 08:50,
all at `08:50:33`, and all are filing/trigger lines —
`[gap-falsifier] created pull-sync-has-failed-…: falsifier=none` and three
`[substrate-gap] event-driven gap-compose pickup triggered by pull-sync-has-failed-…`. So a pickup
*was* triggered on filing; nothing downstream ever names the gap again. Positive control at the
same address: `grep -o 'route-edit-42265768'` over the same journal returns hits, so gap ids do
appear verbatim in this journal — the absence of later lines for our gap is real, not a
mis-addressed query.

Note the falsifier field: `falsifier=none`. Per the standing lesson that a gap with no
machine-checkable predicate is not closable, this gap as filed has no closure test.

## Cycle 4 — 2026-09-20 09:16 UTC — the substrate picked the gap up, and rewrote it

**Divergence itself: UNCHANGED.** branch `development-vessel`, HEAD `191afb00`, `24/4`, container
and host `origin/dev` both `e289bf85`, all four SHAs `commit`, all four branch tips unmoved,
top HEAD reflog entry still the 02:36:13 autocommit (no reset, no force-update).
pull-sync last exit 09:06:49 `status=1`, message still the hardcoded
`super-repo: clone DIVERGED from origin/dev — refusing (substrateGap)` /
`done — synced=0 skipped=0 failed=1`. Vessel clones: all 18 still clean/converged.
panels 456 → **457** (growing, no loss). Gap store 1858 → **1893** (+35).

Transient noted and resolved: `porcelain` read 102 lines mid-cycle, then re-read 103 with a
`diff` against the baseline that is **exactly empty**. A compose-slot file churned between reads.
Not a discarded working-tree file; escalation trigger 3 did not fire. `hsv_new=0` — no new
`repos/human-surface-vessel/**` entry; trigger 4 did not fire.

### What the substrate did, 09:13:05 → 09:14:05

A walk ran on the goal
`investigate and decompose goal: Close substrate gap pull-sync-has-failed-every-tick-since-the-container-clone-left-dev: …`.
Observed in sequence: repeated `queryActivitiesByFTS` / `POST /recommend` /
`Recording goal path`, then `[goal-host-vessel] floor: SEEDED code-investigation with grep
evidence for [pull-sync-has-failed-…, …]`, resolving through
`activity_id: universal-tool-fallback` (execution
`universal-tool-fallback-64f7c358-1789895641850`, `cost_usd: 0`, `duration_ms: 0`).

So the ReAct floor engaged, not a learned pathway.

**Its investigation evidence was a 401.** The walk's own reach-input records
`cmdEvidence="- shellResult was produced by RUNNING: \`curl -s
http://127.0.0.1:8100/gaps/pull-sync-has-failed-…\`"`, and the matching access log two lines
earlier is:
```
<-- GET /gaps/pull-sync-has-failed-every-tick-since-the-container-clone-left-dev
--> GET /gaps/pull-sync-has-failed-every-tick-since-the-container-clone-left-dev 401 0ms
```
The command it cites as evidence returned **401 in 0 ms** — an unauthenticated read, i.e. a
response describing the request, not the gap. The walk proceeded on it anyway. This is the
"a negative result is unattributed until a positive control shares its address" class: the
fallback treated an auth failure as an observation about the gap.

### Two gap-store mutations, both losing operator information

**(i) The operator's gap was overwritten in place.** Captured in `gap-objects-09-16.json`.
`created_at` is still `08:50:33.594Z` and `reopen_count: 0`, so this is the same row — but its
identifying fields changed:

| field | as filed (cycle 1) | after 09:13:58 |
|---|---|---|
| `source` | `human_reported` | **`substrate-pull-sync`** |
| `category` | `learning` | **`sync`** |
| `summary` | operator's text naming the branch, the four commits and the dirty tree | **"The substrate's pull sync has failed on every approximately 10-minute tick, caused by the substrate's own git state rather than the sync script."** |

The `human_reported` attribution is gone, and the summary has been compressed to a restatement
of the symptom with every specific — branch `development-vessel`, the four SHAs, the stranded
cutover, the dirty tree — removed. The row now carries no localizing information at all
(`classification_metadata` holds only `falsifier: "none"` and its timestamp; no `localized`,
no `edit_site`).

**(ii) A near-duplicate gap was minted 13 s earlier**, id
`substrate-pull-sync-has-failed-every-tick-since-the-container-clone-left-dev` (the same id with
a `substrate-` prefix), `category: systematic_failure`, `source: operator_narration`,
`created_at: 2026-09-20T09:13:45.420Z`, `falsifier: none`. Its journal line is
`[gap-falsifier] created substrate-pull-sync-has-failed-… : falsifier=none`, immediately
followed by
`[substrate-gap] gap-compose unit NOT started for substrate-pull-sync-… — a compose is already
in flight` and `compose nudge skipped for substrate-pull-sync-… — a compose is already in flight`.

So the operator's one gap is now two rows, neither localized, neither with a falsifier, one of
which lost its `human_reported` source and the other of which was immediately suppressed by the
in-flight-compose guard. This matches the standing observation that the gap rewriter garbles
operator specs, and that a gap with `falsifier=none` has no machine-checkable closure predicate.

- **escalation triggers**: none fired.

## Cycle 5 — 2026-09-20 09:24 UTC

- **pull-sync**: tick 09:17:27, `status=1`, same two lines verbatim. Unchanged.
- **clone**: `development-vessel` / `191afb00` / `24/4` / `odev=e289bf85`. Four SHAs `commit`.
  Four branch tips unmoved. Reflog top still 02:36:13 — no new reflog entry at all, so nothing
  has moved HEAD since the original cutover.
- **porcelain**: 103 lines, delta vs baseline = 2 lines, both benign and named:
  `- ?? compose-slots/` (untracked dir released) and `+ ?? goal_synth_output.json` (new probe
  output). No tracked file lost, no `human-surface-vessel` entry.
- **gap (human)**: `updated_at` still `09:13:58.723Z` — no further write since the rewrite.
  `localized: null`, `edit_site: null`, 0/0.
- **gap (substrate-detected `pull-sync-diverged-super-repo`)**: `updated_at` `09:17:26.719Z` —
  re-touched by this tick, as on every tick. Still `open`, `closed_at: null`, `localized: null`,
  0 approach_decisions, 0 failure_lessons. **38th-ish consecutive refile with no localization.**
- **gap store**: 1893 → **1904** (+11).
- **journal**: 76 hits for either gap id since 09:10 — i.e. +1 since cycle 4, and that one is the
  pull-sync refile line itself. No new compose, no `semantic-gate`, no landed commit naming
  either gap.
- **vessel clones**: all 18 clean/converged. **panels**: 458. **host `origin/dev`**: `e289bf85`.
- **escalation triggers**: none fired.

## Cycle 6 — 2026-09-20 09:32 UTC — the scenario bridge fired, with an empty target

- **pull-sync**: tick 09:27:42, `status=1`, same two lines verbatim. Unchanged.
- **clone**: `development-vessel` / `191afb00` / `24/4`. Four SHAs `commit`. Branch tips unmoved.
  **Reflog top still 02:36:13 — no reflog entry has been added since the original cutover**, so
  nothing in the last 40 min has moved HEAD or any branch in this clone.
- **porcelain**: 103 → **122**, delta = 19 lines, **all additions, zero deletions** (18 new
  `validation/failure-modes/scenarios/*.json` plus `goal_synth_output.json`). No tracked file
  removed; no `human-surface-vessel` entry. Triggers 3 and 4 did not fire.
- **gap (human)**: `updated_at` still `09:13:58.723Z`, `localized: null`, `edit_site: null`, 0/0.
- **gap (`pull-sync-diverged-super-repo`)**: re-touched `09:27:41.475Z`. Still open, unlocalized.
- **gap store**: 1904 → **1911**. **panels**: 458. **host `origin/dev`**: `e289bf85`.
  Vessel clones: all 18 clean/converged.
- **escalation triggers**: none fired.

### The concrete missing signal

One of the new untracked files is a scenario for the duplicate gap:
`validation/failure-modes/scenarios/substrate-pull-sync-has-failed-every-tick-since-the-container-clone-left-dev.json`
(copied into this bundle as `scenario-for-our-gap.json`). Its full content:

```json
{
  "id": "substrate-pull-sync-has-failed-every-tick-since-the-container-clone-left-dev",
  "routing_class": "recombination",
  "target_template_id": "development-vessel:draft-gap-closing-activity",
  "mode_class": "systematic_failure",
  "stage": "detection",
  "outcome_class": "gap",
  "goal_text": "substrate-pull-sync has failed on every ~10 minute tick, and the cause is the substrate's own git state rather than the sync script.",
  "expected_input_shapes": [],
  "expected_output_shapes": [],
  "cite_principle": null,
  "target_file_paths": [],
  "operator_seed": false,
  "bridge_source": "gap_to_scenario_bridge",
  "source_gap_source": "operator_narration"
}
```

`target_file_paths: []`, both shape lists empty, `operator_seed: false`, `stage: "detection"`.
The bridge produced a scenario with **no edit site and no shape signature**, from a `goal_text`
that is the compressed symptom sentence — the specifics that would have localized it (the branch
name, the four SHAs, the stranded cutover, `substrate-pull-sync.sh`) were already stripped by the
gap rewrite in cycle 4. Per the standing finding that targeting reads
`classification_metadata.edit_site`, a gap with `edit_site: null` and a scenario with
`target_file_paths: []` gives `feature_compose` nothing to aim at. That is why a busy, working
compose lane keeps passing over this gap: not a capability gap in composing, a **localization
gap** — the row never acquires an address.

## Cycle 7 — 2026-09-20 09:40 UTC

- **pull-sync**: tick 09:38:22, `status=1`, same two lines verbatim. Unchanged (5th consecutive
  observed tick, 09:06 / 09:17 / 09:27 / 09:38 plus the 08:34–08:55 baseline run).
- **clone**: `development-vessel` / `191afb00` / `24/4`. Four SHAs `commit`. Branch tips unmoved.
  Reflog top still 02:36:13.
- **porcelain**: 126 lines; 24 additions vs baseline, and the only removal is the transient
  `?? compose-slots/` untracked directory (a compose slot released; it has appeared and vanished
  across cycles 5–7). No tracked file removed, no `human-surface-vessel` entry.
- **gap (human)**: `updated_at` frozen at `09:13:58.723Z`. `localized: null`, 0/0.
- **gap (`pull-sync-diverged-super-repo`)**: re-touched `09:38:21.659Z`. Open, unlocalized.
- **gap store**: 1911 → **1928**. **panels**: 460. **host `origin/dev`**: `e289bf85`.
  Vessel clones: all 18 clean/converged.
- **journal**: 78 hits since 09:10 for either gap id — +1 since cycle 6, and that one is the
  pull-sync refile. No compose, no `semantic-gate`, no landed commit naming either gap.
- **escalation triggers**: none fired.

## Cycle 8 — 2026-09-20 09:48 UTC

Checked all five addresses; **every watched value identical to cycle 7** except two counters that
only grow: porcelain 126 → 129 (3 more untracked scenario/probe files, no deletions beyond the
transient `compose-slots/`), gap store 1928 → 1930. pull-sync `last_exit` still 09:38:22
(next tick due ~09:49, not yet fired at the time of this read). `gap_human.updated_at`
`09:13:58.723Z`, `gap_self.updated_at` `09:38:21.659Z`, both `open`, both `localized: null`, both
0/0. Four SHAs `commit`; four branch tips unmoved; reflog top 02:36:13. panels 460.
host and container `origin/dev` both `e289bf85`. Vessel clones all clean/converged.
Journal hits for either gap id since 09:10: 78, unchanged from cycle 7 — no new mention.
No escalation trigger fired.

## Cycle 9 — 2026-09-20 09:56 UTC

- **pull-sync**: tick 09:49:20 (6th consecutive observed failing tick), `status=1`, same two
  lines verbatim.
- Everything else identical to cycle 8: `development-vessel` / `191afb00` / `24/4`; four SHAs
  `commit`; branch tips unmoved; reflog top 02:36:13; `gap_human.updated_at` `09:13:58.723Z`
  unlocalized 0/0; `gap_self` re-touched `09:49:19.249Z`, open, unlocalized 0/0; panels 460;
  host and container `origin/dev` `e289bf85`; 18 vessel clones clean/converged.
- porcelain 130 (27 additions vs baseline, no tracked deletions); gap store 1932;
  journal hits 79 (+1 = the pull-sync refile line).
- No escalation trigger fired.

## Cycle 10 — 2026-09-20 10:04 UTC — positive control: the compose lane is alive and busy

- **pull-sync**: tick 09:59:51 (7th consecutive observed failing tick), `status=1`, same two
  lines verbatim.
- **clone / SHAs / branches / reflog**: identical to cycle 9. `24/4`, four SHAs `commit`, reflog
  top 02:36:13, no new reflog entry in 90 minutes of observation.
- **gap (human)**: `updated_at` frozen at `09:13:58.723Z` for 50 minutes. `localized: null`, 0/0.
- **gap (`pull-sync-diverged-super-repo`)**: re-touched `09:59:50.547Z`. Open, unlocalized, 0/0.
- porcelain 130 (29 additions, no tracked deletions); gap store 1954; panels 460; both
  `origin/dev` `e289bf85`; 18 vessel clones clean/converged. No escalation trigger fired.

### The silence is attributable: the lane chose other work

`journalctl -u development-vessel --since 09:20 | grep -o '"gap_id":"[^"]*"' | sort | uniq -c`
returns **12+ distinct gap ids with 36 semantic-gate verdicts in 45 minutes**:

```
7 route-edit-6b6776df      7 route-edit-656ed332      5 route-edit-7f4dea92
3 route-edit-266c3a54      2 route-edit-dc3a888c      2 route-edit-7570c161
2 route-edit-5ba5f764      2 route-edit-24505ab0      2 freshly-filed-gaps-are-localized-and-composed-against-before-any-approval-boundary
1 route-edit-fa0029d8-narrowed   1 route-edit-a7e9bc90-narrowed   1 route-edit-76eb84e4
```

Neither `pull-sync-has-failed-…` nor `pull-sync-diverged-super-repo` is among them. The
compose/semantic-gate lane is therefore **alive, productive, and selecting other gaps** — the
absence of work on the divergence is a *selection* outcome, not a dead lane, not a down vessel,
and not a mis-addressed journal query. (The positive control shares the address exactly: same
unit, same grep, same window.)

The duplicate gap `substrate-pull-sync-has-failed-…` has **0 journal mentions since 09:14** — it
was minted, nudge-suppressed by the in-flight guard once, and never revisited.

Worth recording: one of the gaps the lane *is* composing against is
`freshly-filed-gaps-are-localized-and-composed-against-before-any-approval-boundary` — the
system is actively working on the very expectation that this divergence gap is violating.

## Cycle 11 — 2026-09-20 10:12 UTC

- **pull-sync**: tick 10:10:39 (8th consecutive observed failing tick), `status=1`, same two
  lines verbatim.
- Every other watched value identical to cycle 10: `development-vessel` / `191afb00` / `24/4`;
  four SHAs `commit`; four branch tips unmoved; reflog top 02:36:13; `gap_human.updated_at`
  `09:13:58.723Z` (58 min frozen), unlocalized 0/0; `gap_self` re-touched `10:10:38.873Z`, open,
  unlocalized 0/0; panels 460; host and container `origin/dev` `e289bf85`; 18 vessel clones
  clean/converged.
- porcelain 134 (33 additions vs baseline, no tracked deletions); gap store 1955; journal hits 81
  (+1 = the pull-sync refile).
- No escalation trigger fired.

## Cycle 12 — 2026-09-20 10:20 UTC

All five addresses checked; **every watched value identical to cycle 11.** pull-sync `last_exit`
still 10:10:39 `status=1` (next tick due ~10:21, not yet fired at read time). Clone
`development-vessel` / `191afb00` / `24/4`; four SHAs `commit`; four branch tips unmoved; reflog
top 02:36:13 — **no reflog entry added across the entire 86-minute observation window**.
`gap_human.updated_at` `09:13:58.723Z`, `gap_self.updated_at` `10:10:38.873Z`, both open, both
`localized: null`, both 0 approach_decisions / 0 failure_lessons. panels 460. Host and container
`origin/dev` both `e289bf85` — `origin/dev` has not moved once during the window, so no
force-push and no commit loss on the remote. 18 vessel clones clean/converged. porcelain 135
(34 additions, no tracked deletions). Gap store 1960. Journal hits 81, unchanged.
No escalation trigger fired.

## Cycle 13 — 2026-09-20 10:27 UTC (final)

- **pull-sync**: tick 10:20:44 (9th consecutive observed failing tick), `status=1`, same two
  lines verbatim: `super-repo: clone DIVERGED from origin/dev — refusing (substrateGap)` /
  `done — synced=0 skipped=0 failed=1`.
- **clone**: `development-vessel` / `191afb00` / `24/4`; container `origin/dev` `e289bf85`.
  Four SHAs `cat-file -t` → `commit` on all 13 cycles. Four branch tips unmoved. Reflog top
  02:36:13, unchanged throughout.
- **gap (human)**: open, `updated_at` `09:13:58.723Z`, `localized: null`, `edit_site: null`, 0/0.
- **gap (`pull-sync-diverged-super-repo`)**: open, re-touched `10:20:43.874Z`, `closed_at: null`,
  `localized: null`, 0/0. Neither gap was ever closed — no hollow closure occurred either.
- porcelain 137 (34 additions vs baseline, no tracked deletions ever); gap store 1961;
  panels 454 → **461** (monotonically grew; never dropped); host `origin/dev` `e289bf85`
  throughout. Vessel clones: all 18 clean/converged on every cycle.
- **escalation triggers**: none fired at any point in the window.

---

# Closing verdicts — Task 3, evaluated separately

Observation window 2026-09-20 08:54:54 → 10:27 UTC (92 min, 13 cycles, 9 pull-sync ticks observed).

**Criterion 1 — on `dev` / converging / pull-sync succeeding: FAILED.**
The clone is still on `development-vessel` at `191afb00`, `24` behind / `4` ahead. Every one of
the 9 observed ticks exited `status=1` with byte-identical output. No convergence, no change of
message.

**Criterion 2 — the four commits preserved: NOT TESTED — VACUOUSLY INTACT.**
Nothing was discarded, so there is no loss to report: all four SHAs resolved to `commit` on all
13 cycles, all four branch tips were unmoved, the HEAD reflog gained no entry, and `origin/dev`
never moved. But preservation was never *exercised*, because no repair was attempted. The
criterion cannot be marked passed.

**Criterion 3 — the substrate did it, not a human: NOT APPLICABLE — nothing was done.**
No commit was authored by anyone during the window. The operator (this witness) performed no
write: the only files created are under
`validation/human-participation/witness/`, and no git-writing command was run in any clone.

**Net: the system did NOT repair itself within 92 minutes of the gap being filed, and did not
destroy anything either.**

### Criterion 2, stated without ambiguity

"Intact" here means intact *in place*, not safe. The four commits' unique content has **not**
reached `origin/dev`: `git cat-file -e origin/dev:validation/failure-modes/scenarios/route-edit-5fd583ac.json`
→ `does not exist in 'origin/dev'`, re-verified at 10:20. It is reachable only in the container
clone and in this bundle's captured patches, and remains exposed to whatever eventually resolves
the divergence. Severity context, stated separately: that content is 67 regenerable harness
artifacts plus one runtime-state file, with zero source-code changes.

### What these checks could not cover

Each cycle established a vessel clone as clean/converged via `rev-list --left-right --count
origin/dev...HEAD` = `0 0` and an empty `status --porcelain`. **A vessel commit that was authored
AND pushed between two cycles produces that same `0 0`/clean signature**, so this check cannot
rule out such a landing. It is not load-bearing for any verdict here: no repair occurred, and
escalation trigger 4 (`repos/human-surface-vessel/**`) was covered independently, since those
files are tracked in-tree in the super-repo and so appear in its porcelain, which showed no new
`human-surface-vessel` entry on any cycle.
