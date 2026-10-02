# Witness evidence bundle — diverged in-container super-repo clone

Captured read-only from container `substrate-live`, clone `/workspace/git/super-repo`.
Capture window opened 2026-09-20 08:54:54 UTC. No write operation of any kind was performed
in either clone; only `docker exec … git <read-only>` and `jq`/`curl` reads.

## Reference state at capture time

| Fact | Value |
|---|---|
| Clone branch | `development-vessel` |
| Clone HEAD | `191afb0012e04bb99aab34cabc422a014f92f619` |
| Clone `origin/dev` | `e289bf8509be858040f20e181d42ac71ad004a30` |
| Host `origin/dev` | `e289bf8509be858040f20e181d42ac71ad004a30` (identical — refs agree, no stale-fetch artifact) |
| `rev-list --left-right --count origin/dev...HEAD` | `24  4` (24 behind, 4 ahead) |
| **merge-base(origin/dev, HEAD)** | **`93c70c5e2b9218fcafb4691c398318f36b7f12a7`** |
| Dirty tree | 103 porcelain lines (10 tracked-modified, 93 untracked) |
| Live panel store | `stateful-ui-vessel` `:8270/health` → `panels: 454` |
| Gap | `pull-sync-has-failed-every-tick-since-the-container-clone-left-dev` — `status: open`, `source: human_reported`, `localized: null`, `edit_site: null`, 0 approach_decisions, 0 failure_lessons |
| Gap store | `/workspace/git/super-repo/gaps/gaps.json`, 1847 entries |

All four local commits are authored AND committed by
`Substrate Autonomous <substrate-autonomous@substrate.local>` — none carries an operator identity.

## The four local-only commits

`git rev-list origin/dev..HEAD` returns exactly these four, newest first.

| SHA | Subject | Parents | AuthorDate (UTC) | Kind |
|---|---|---|---|---|
| `191afb00` | Automated commit of vessel code changes | 1 (`f17a81a0`) | 2026-09-20 02:36:13 | **non-merge, REAL content** |
| `f17a81a0` | Merge origin/dev into development-vessel and resolve conflicts | 2 (`a6fbf4f4`, `93c70c5e`) | 2026-09-20 02:23:39 | **merge, EMPTY** — `show --cc` yields zero diff hunks |
| `a6fbf4f4` | Resolve merge conflicts for merging dev into discovery-vessel | 2 (`fdf197a2`, `9f1d1c98`) | 2026-09-15 03:47:39 | **merge, runtime-state-only** conflict resolution |
| `fdf197a2` | Stash local changes before cutover to origin/dev | 1 (`0c1b27a8`) | 2026-09-15 03:00:24 | **non-merge, real content — but already superseded in `origin/dev`** |

`0c1b27a8`, `9f1d1c98` and `93c70c5e` are all confirmed ancestors of `origin/dev`
(`merge-base --is-ancestor` → YES for each). So every commit below `fdf197a2` is shared history.

## The single most useful judgement: what is genuinely at risk

Because the merge-base is `93c70c5e`, the **entire unique contribution of the four commits** is
`git diff 93c70c5e HEAD`:

```
68 files changed, 969 insertions(+), 2 deletions(-)
67 A (added)   1 M (modified)
```

- **67 added files**, all generated validation/probe artifacts:
  - 12 × `prior-exp-*` and `drain-probe` (probe scratch files at repo root)
  - 54 × `validation/failure-modes/scenarios/*.json` and
    `validation/failure-modes/vessel-scenarios/*.json` (harness scenario captures)
- **1 modified file**: `state/learning-mode-state.json` — runtime state, gitignored-class per
  CLAUDE.md ("a file the substrate rewrites is not a file git should carry").
- **Zero source-code changes.** `grep -c human-surface-vessel local-only-contribution.name-status`
  → `0`. No `repos/*/src/**` file and no `scripts/` file is touched by the four commits relative
  to the merge-base.

### Per-commit verdict on "real changes vs empty/merge-only"

- `191afb00` — **REAL, and the only commit holding content absent from `origin/dev`.** 71 paths,
  972 insertions, 5 deletions. Positive control: `git cat-file -e
  origin/dev:validation/failure-modes/scenarios/route-edit-5fd583ac.json` → `does not exist in
  'origin/dev'`, confirming this content is local-only, not a mis-addressed read. Content class is
  machine-generated harness output, not hand-authored source.
- `f17a81a0` — **EMPTY merge.** `show --cc` = 372 bytes, header only, zero hunks. It contributes
  no content of its own; its value is purely topological (it is what absorbed `origin/dev` up to
  `93c70c5e` into the branch). Nothing to preserve.
- `a6fbf4f4` — **merge, conflict resolution touches only two runtime-state files**:
  `compose-slots/slot-0.slot` (a compose-slot lockfile) and `state/learning-mode-state.json`.
  `show --cc` = 1471 bytes. Nothing of source value to preserve.
- `fdf197a2` — **REAL but ALREADY IN `origin/dev`.** 12 paths, 683 insertions. Its substantive
  payload is `scripts/substrate/federation-relay/federation-transport-server.ts` (+681 lines) plus
  8 submodule-pointer bumps and 2 runtime-state files. **Proved superseded by content, not by
  count**: that file at clone `HEAD` and at `origin/dev` are byte-identical —
  `md5 4ce7cc26f0281e4e1a0209feda101f0e` for both (`fts-at-clone-HEAD.ts`,
  `fts-at-origin-dev.ts`, 91468 bytes each), while the `fdf197a2` snapshot is 90718 bytes
  (`md5 a6702853…`, 985 bytes of diff). `origin/dev` therefore already carries this work, evolved
  further. Nothing at risk.

**Bottom line for the recovery question:** if the substrate rejoins `dev` by discarding all four
commits, the loss is 67 generated harness artifacts and one runtime-state file. No autonomous
source-code work is at stake. This is materially different from the prior incident in which a sync
path destroyed autonomous commits — here the only irreplaceable-looking commit
(`fdf197a2`) is provably already merged, and the only local-only commit (`191afb00`) contains
regenerable harness output.

## Dirty working tree

`clone-status-porcelain.txt` — 103 lines.

Tracked-modified (10; `dirty-tracked-worktree.diff`, 12205 bytes):
`Substrate/Projects/MyProject.md`, `Substrate/Projects/my_temp_project.md`,
`Substrate/Projects/projectThreadScanReport.json` (−424 lines),
`Substrate/Projects/temp_test_open_todo.md`, `state/learning-mode-state.json`, `test_file.txt`,
plus 4 submodule-pointer moves (`repos/boredom-vessel`, `repos/development-vessel`,
`repos/goal-host-vessel`, `repos/stateful-ui-vessel`).

Untracked (93) are dominated by `validation/failure-modes/scenarios/*.json`, probe scratch files
(`trendcheck-*`, `alphaprobe-u3`, `runtime-drift-discovery-vessel`, `type-scale-values`,
`path/to/your/`, `path_to_file`), `compose-slots/`, and
`docs/architecture/CONCURRENT_COMPOSE.md`. Full contents of the non-generated ones captured under
`dirty-untracked/`.

The vault files under `Substrate/Projects/` are small test/scratch notes (112–165 bytes each);
`projectThreadScanReport.json` is now 22 bytes, down from ~424 lines — i.e. already truncated in
the working tree before this capture.

## Files in this bundle

| File | Bytes | What |
|---|---|---|
| `MANIFEST.md` | this | judgement + index |
| `WITNESS-LOG.md` | append-only | one entry per observation cycle |
| `log-fuller-head6.txt` | 2.0K | `log --format=fuller -n 6` |
| `commitobj-<sha>.txt` | 306–377 | raw `cat-file -p` per commit (parents, identities, verbatim) |
| `stat-<sha>.txt` | 1136 / 4940 / 5685 / 145717 | `show --format=fuller --stat` per commit |
| `patch-191afb00.diff` | 121968 | full patch (non-empty ✓) |
| `patch-fdf197a2.diff` | 78894 | full patch (non-empty ✓) |
| `patch-a6fbf4f4.diff` | 1471 | merge — `show -p` default |
| `patch-f17a81a0.diff` | 372 | merge — `show -p` default |
| `patch-cc-a6fbf4f4.diff` | 1471 | `show --cc` combined (the conflict resolution) |
| `patch-cc-f17a81a0.diff` | 372 | `show --cc` combined — **empty by measurement, cross-checked** |
| `diff-parent1-191afb00.diff` | 121644 | `diff <sha>^ <sha>` cross-check |
| `diff-parent1-fdf197a2.diff` | 78561 | `diff <sha>^ <sha>` cross-check |
| `diff-parent1-a6fbf4f4.diff` | 11630025 | first-parent diff of a merge — spans the whole other branch; **misleading as "the commit's change", kept for completeness** |
| `diff-parent1-f17a81a0.diff` | 10437831 | same caveat |
| `local-only-contribution.diff` | 120795 | **`diff 93c70c5e HEAD` — the authoritative at-risk set** |
| `local-only-contribution.name-status` | — | 67 A + 1 M |
| `local-only-contribution.stat` | — | 68 files, 969+/2− |
| `tree-delta-dev-vs-HEAD.diff` | 5475072 | `diff origin/dev HEAD` (192 files; 101 A / 63 D / 28 M — the D and most M are *behind-ness*, not local work) |
| `tree-delta-name-status.txt` | — | classification of the above |
| `tree-delta-dev-vs-HEAD.stat` | — | stat form |
| `clone-status-porcelain.txt` | 7242 | dirty tree |
| `dirty-tracked-worktree.diff` / `.stat` | 12205 | worktree diff of tracked files |
| `dirty-untracked/` | 8 files | contents of non-generated dirty files |
| `clone-reflog.txt` | 16703 | 200 reflog entries — the discard-vs-merge oracle |
| `clone-for-each-ref.txt` | 9111 | all refs |
| `clone-revparse.txt`, `clone-remotes.txt` | — | HEAD/origin-dev SHAs, remote URL |
| `ancestry.txt` | — | `is-ancestor` checks, merge-base, local-only list |
| `fts-at-{fdf197a2,origin-dev,clone-HEAD}.ts` + `fts-diff-fdf-vs-dev.txt` | 90718 / 91468 / 91468 / 985 | the byte-level proof that `fdf197a2`'s payload is already in `dev` |

### Capture-integrity notes

- Every patch capture was byte-sized; none of the four came back zero. The two small ones
  (`f17a81a0` 372 B, `a6fbf4f4` 1471 B) are small **because they are merges**, and that reading was
  cross-checked three ways — `cat-file -p` (two parents each), `show --stat`, and `show --cc` —
  rather than inferred from one empty-looking output.
- The known repository hazard "`git log --` prints an empty diff for a commit that genuinely
  changed files" was guarded against: for each commit both `show -p` and `diff <sha>^ <sha>` were
  captured independently, and the non-merge pair agree (121968 vs 121644; 78894 vs 78561 — the
  delta is the `--format=fuller` header).
- `diff-parent1-*` for the two merges is *not* "the commit's change" and must not be read as such;
  it is the first-parent diff and therefore spans the entire merged-in branch.

## Second, separate divergence observed (not the filed gap)

`pull-sync` also reports on every tick:

```
fleet: vessels.inventory.json was modified locally — leaving it alone (git version NOT applied;
delete /workspace/substrate/fleet/.vessels.inventory.json.converged to accept git)
fleet: vessels.manifest.json was modified locally — leaving it alone …
```

Two fleet-definition files are likewise pinned to local edits and not converging. These do not
contribute to the non-zero exit (`failed=1` is the super-repo alone) but are a second stuck
convergence surface on the same service.

## Addendum (same capture window, 09:0x UTC) — three follow-up captures

**1. The four "submodule pointer moves" are NOT pointer moves.** `grep 'Subproject commit'
dirty-tracked-worktree.diff` shows all four as `<sha>` → `<sha>-dirty` — same SHA, `-dirty` suffix.
The submodule *working trees* are dirty; no submodule pointer was bumped in the worktree, so there
is no unpushed-pointer class of loss there.

**2. All 18 vessel clones under `/workspace/git/vessels/` are clean and converged.**
`vessel-clones-state.txt`: every one is on branch `dev`, `rev-list --left-right --count
origin/dev...HEAD` = `0 0`, `status --porcelain` = 0 lines. There is **no unpushed autonomous
vessel commit at risk anywhere in the container.** This is also the positive control for the
divergence being *isolated*: the sync surface works for 18 clones and refuses on exactly one.

**3. A second, older abandoned cutover exists on the same clone.** `clone-for-each-ref.txt` shows
four local branches:

| Branch | Tip | behind/ahead of `origin/dev` |
|---|---|---|
| `dev` | `93c70c5e` | 24 / **0** (stale but strictly behind — safe) |
| `development-vessel` | `191afb00` | 24 / **4** (the current divergence, checked out) |
| `discovery-vessel` | `2890af2a` | 80 / **0** (stale, strictly behind — safe) |
| `obsidian-episode-vessel` | `6190136a` | 86 / **13** (**a second stranded branch**) |

`obsidian-episode-vessel` carries 13 local-only commits whose tip subject is
*"Save local changes before checking out development-vessel"* — the same
stash-before-cutover shape as `fdf197a2`. Its unique contribution vs its merge-base
`bf58a721` is small: 13 files, 35 insertions, 19 deletions (1 A, 1 D, 11 M — mostly submodule
pointers and `state/learning-mode-state.json`). Captured as
`stale-branch-obsidian-episode.name-status` and `.log`.

This makes the failure a **recurring class, not an incident**: at least three per-vessel branch
cutovers were begun on this clone and abandoned mid-flight, each leaving a stash-commit behind,
and the local `dev` branch was left parked at an old tip rather than being the checked-out branch.

Note also that the clone's own `dev` branch reflog has 369 entries while
`reflog show development-vessel` has **0** — the current branch was created/updated without ever
being recorded in a branch reflog, which is why HEAD's reflog (`clone-reflog.txt`, 1554 entries,
now captured untruncated) is the only discard-vs-merge oracle available for it.
