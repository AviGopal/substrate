# Round 7 — blocker sweep: what was fixed, what is stale, what needs a hand

A sweep against the standing blocker list. Two real defects fixed and verified, one
root cause closed, three reported blockers refuted as stale, and one item that
cannot proceed without an operator decision. As in round 6, the corrections matter
as much as the fixes.

---

## 1. The applier read a directory nobody writes to — FIXED and VERIFIED

**The defect.** `apply-proposal-as-patch.ts` computed its source directory as
`join(workspaceRoot, "proposals")`, where
`workspaceRoot = process.env["WORKSPACE_ROOT"] ?? "/workspace"`. Read from
`/proc/<pid>/environ`, **`WORKSPACE_ROOT=/workspace/git/super-repo` in every vessel
process**, so the applier scanned `/workspace/git/super-repo/proposals` — which does
not exist. Measured: `cannot read proposals dir: ENOENT … scandir
'/workspace/git/super-repo/proposals'`, **21 times in 24 hours**.

Meanwhile **three sibling modules in the same vessel hardcode the write path**
`/workspace/proposals` — `observe-and-author-from-gaps.ts`,
`code-locality-mining-tick.ts`, `gap-lifecycle-scan.ts`. That directory holds
**4,138 entries, 2,257 of them pending**, with 11 written in the previous two hours.

**Every drafted repair was accumulating in a directory the applier never opened.**
Reader and writers disagreed about one path.

**Checked before acting.** The obvious worry is that fixing this unleashes 2,257
backlogged patches at a live tree. It does not: the apply loop selects a single
proposal and `break`s, so it drains one per invocation through the existing surgical
gate, vessel-path gate and typecheck. A symlink was considered and **rejected** —
`proposals` is not in `ALLOWED_TOPLEVEL_DIRS` and is not gitignored, so an entry at
the super-repo root risks wedging the substrate's own commit lane.

**The fix** was dispatched, not hand-edited: a one-line change anchored on verbatim
text verified to occur exactly once in all three trees. It routed correctly —
`EARLY EDIT-INTENT DETECTED … routing to feature_compose` and
`[fc-anchors] supplied verified-unique anchors`.

```
492:  const proposalsDir = pointer.proposals_dir ?? process.env["PROPOSALS_DIR"] ?? "/workspace/proposals";
```

Deployed into the running process — `file_mtime 08:36:59` precedes
`ExecMainStartTimestamp 08:46:19`.

**Verified functionally, not by absence of errors.** ENOENT went to zero, but zero
errors proves nothing on its own. A `dry_run` invocation now returns
`shape: mitosisStaged` with a concrete selection:

```json
{"proposal":"model-opportunity-gap_landability-report.json",
 "target":"repos/development-vessel/src/resolvers/gap-lifecycle-scan.ts",
 "vessel":"development-vessel","base_sha":"52debf950e70","is_new_file":false}
```

where it previously returned a structuredError. **Proven at n=1 dry-run.** The
population metric is a proposal from that backlog staging and landing with no
operator involvement. Note the next dominant guard is still ahead of it —
`pending mitosis in flight — refusing to clobber` fired 22 times in 24h — though its
30-minute staleness TTL should stop that being permanent.

---

## 2. The container clone had no placement hook — root cause, now closed

`/workspace/git/super-repo` had **`core.hooksPath` unset and
`.git/hooks/pre-commit` absent**. The `ALLOWED_TOPLEVEL_DIRS` rule that forbids
root-level additions was therefore **never enforced in that clone**, which is how a
commit adding 476 root-level files — including a binary `TCG_Card_Prices_2026.pptx`,
`NOTES.txt`, `.gitconfig`, and a file named `activity api schema code` — exists at
all. CLAUDE.md warns exactly this: the hook "only enforces once installed."

Installed via `scripts/git-hooks/install.sh`. Note it sets `core.hooksPath` to the
versioned `scripts/git-hooks/` directory and does **not** write
`.git/hooks/pre-commit` — checking the wrong location reads a working install as a
failure, which happened once here before the config was checked.

---

## 3. pull-sync's self-heal cannot recognise the substrate — FILED, not fixed

`/workspace/git/super-repo` sat **ahead 2, behind 72** on `dev`, logging
`super-repo: ff-only pull failed — skipping` every ten minutes.

The divergence self-heal rebases and pushes only when every local-only commit is
substrate-authored. It builds that identity from two scalars: `SELF_ID` from
`SUBSTRATE_GIT_AUTHOR_NAME` (**unset**, so the `"Substrate Autonomous"` fallback) and
`SYS_ID` from `git config user.name` (**also** `"Substrate Autonomous"`). The
substrate's other identity is **`"Substrate Bot"`**, which matches neither — so its
own commit is classified FOREIGN and the self-heal aborts, permanently.

Filed as `pull-sync-self-heal-does-not-recognise-the-substrate-bot-identity`.

**Ordering constraint, stated in the gap:** do **not** fix the identity check first.
The rebase path would then push the 476 junk files to `origin/dev`. The clone must be
cleaned before the recognition check is widened.

---

## 4. Three reported blockers were stale — refuted

| reported | actual |
|---|---|
| "Rhythm registry is EMPTY" | **4** `timeShapedRhythm` impulses exist |
| "Rhythm registry is UNMAPPABLE — all 4 skipped `no_goal_mapping`" | **4** matching `rhythmFamilyGoal` impulses; `no_goal_mapping` fired **0** times in 24h |
| "boredom timer dead — last trigger 1d8h ago, no next elapse" | `boredom-vessel` is a long-lived `--daemon` (`NRestarts=0`); a stale `LastTriggerUSec` and empty `NextElapse` are **expected** for a oneshot-launched daemon. Its log shows live work: `gap-goal-supply candidates=5 raw_gaps=100 admitted=100` |

The rhythm *conductor* is nonetheless stale — all four rhythms last updated
2026-08-09 — which is a smaller, separate issue than "nothing has a cadence."

**Lesson: check for a daemon before reading a timer as broken.**

---

## 5. Fleet state

| | before | after |
|---|---|---|
| host load (1 min) | 41–46 | **15.3** |
| `substrate-live` CPU | 2075% | **353%** |
| SurrealDB CPU | 1043% | **252%** |
| failed units | 0 | **0** (15/15 vessels running) |
| SurrealDB dir | 32 GB | **17 GB** |

Earlier in the session: an orphaned runaway `awk` (8h27m of CPU, infinite by
construction, reparented to init) was killed, a 15 GB stale `data.db.bak-reap` was
deleted after confirming zero open file descriptors, and a reversible
`StartLimitIntervalSec=0` drop-in was applied to `activity-api`.

**I did not establish causation for the SurrealDB drop.** The awk accounts for about
one core; query load varies independently and I never identified the query mix. The
improvement is observed, not attributed.

`activity-api` still restarts roughly every five minutes on external SIGTERMs
(`Result=success`, `NRestarts=0`). The cause is gated code and belongs to the
substrate; it is filed, not hand-fixed.

---

## 6. Not done — needs an operator decision

Resetting the wedged clone to `origin/dev` was **denied by the permission
classifier** as a destructive action, which is the correct default.

Safety was established before attempting it: **5 of 6 submodule pointers in the local
commits are identical to `origin/dev`**, and for the sixth, origin's `activity-api`
pointer is a **descendant** of the local one — 4 commits newer, so it already
contains it. Nothing of value is lost. The remainder is the junk described in §2, and
pull-sync's own doctrine states that "no legitimate edit ever lives only in a clone."

Until this runs, the clone stays 72 commits behind and pull-sync keeps failing every
ten minutes.

---

## Status

**Fixed and verified:** the proposals path (functionally, at n=1 dry-run); the
missing placement hook.

**Filed:** the pull-sync identity defect, with its ordering constraint; the
shell-tool orphan-on-timeout class; the `activity-api` churn cause.

**Refuted:** three stale rhythm/boredom blockers, and — from round 6 — my own
duplicate trace-window gap, folded into the substrate's stronger version and closed.

**Blocked:** the clone reset, pending operator approval.

**Out of scope for this sweep:** the standing hub-security blocker (unauthenticated
`:18210` and `:18260`, container `uid=0`, PAT in most process environments). It
predates this session and needs a credential rotation decision.
