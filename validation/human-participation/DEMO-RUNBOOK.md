# Human-participation demo runbook

Audience: one operator, one laptop, one browser, one terminal. Written to be
executable while tired. Every step carries its own pass/fail command and a
fallback. Nothing here requires a live write except where explicitly marked
OPERATOR-ONLY WRITE.

Read the three headline findings first. They change what you should promise.

---

## 0. Read this before you promise anything

### Finding 1 — the deployed surface is CURRENT, but nothing keeps it current

The unit runs a release clone, not the working tree:

```
WorkingDirectory=/workspace/git/human-surface-release/repos/human-surface-vessel
ExecStart=... src/index.ts
```

That directory is **a git worktree of `/workspace/git/super-repo`**
(`cat .git` → `gitdir: /workspace/git/super-repo/.git/worktrees/human-surface-release`),
checked out **detached**.

Two independent structural reasons it can never auto-update:

1. **`substrate-pull-sync` does not enumerate it at all.** Proven, not inferred:
   `grep -rl human-surface-release /etc/systemd/system /lib/systemd/system /usr/local/bin`
   returns exactly one path — `human-surface-vessel.service`. The pull-sync
   script's vessel loop walks `MITOSIS_PUSH_CLONE_DIR=/workspace/git/vessels`;
   this worktree is not under it.
2. **The parent clone is on the wrong branch, so even the super-repo leg fails
   every tick.** `git worktree list` → `/workspace/git/super-repo 191afb00 [development-vessel]`.
   Every pull-sync run logs:
   `super-repo: clone DIVERGED from origin/dev — refusing (substrateGap)` …
   `done — synced=0 skipped=0 failed=1` (observed at 08:02, 08:13, 08:23, 08:34,
   08:44 — five consecutive ticks). The worktree is additionally detached, which
   pull-sync's own comment says it refuses to pull into.

**Timeline, because it moved under investigation — report both states:**

| Time (UTC) | Clone HEAD | Meaning |
|---|---|---|
| 08:49:03 | `9398425b` | 7 commits behind `origin/dev`; the entire session's vessel work absent |
| 08:49:38 | — | unit `ExecMainStartTimestamp`; process restarted |
| 08:50 → 08:57 | `e289bf85` | == `origin/dev`; `git status --porcelain` empty; every `src/*.ts` blob byte-identical to `origin/dev` |

The commits that were missing at 08:49:03 (`git log --oneline 9398425b..e289bf85`):

```
e289bf85 fix(human-surface): ordinary goal text no longer restyles the surface
fdd5503f fix(substrate): stop quote-doubling persisted secrets on read
cbd134e5 docs(validation): consumption link closes; fidelity probe, corrected fixtures and records
1704850a fix(human-surface): escalation visibility, absence-preserving writes, journal envelope
9afb99ba docs(validation): soak prereg (predictions P1-P8) + durable baseline bundle
af7bba82 docs(validation): soak prereg frozen, host-side recorder running
87f04b59 chore(submodules): bump 5 pointer(s) to latest dev
```

Someone hand-deployed at 08:49:38. `NRestarts=0`, so it was a deliberate
stop/start, not a crash-loop recovery. **The freshness is a manual artifact with
no keeper.** Assume it can go stale again before the demo and re-verify in
preflight (step P1).

**Corollary — the clone's `git log` is not evidence about the running process.**
At 08:49:03 `git log` read `9398425b` while a checkout to `e289bf85` was already
in flight. Verify at the consuming layer: compare blob hashes and check that
`ExecMainStartTimestamp` is *newer* than the checkout (preflight P1 does both).

#### Which demo-critical behaviours are live

As of 08:57 UTC, all five are present in the deployed source:

| Behaviour | Commit | Deployed? |
|---|---|---|
| One-page layout | `81f6394c`, `c0addb25` | Yes — and was live even at 08:49:03 (no `ui/` commits in `9398425b..e289bf85`; `ui/dist` blobs identical: `index-BStMYwKR.js`, `index-CfzbOD-3.css`) |
| Escalation visibility (`isSolicitation`) | `1704850a` | Yes (code). **But see Finding 2 — it has nothing to show.** |
| Accept-guard fix | `1704850a` | Yes |
| Journal envelope | `1704850a` | Yes (code). **But see Finding 3 — the live journal directory is not the shared one.** |
| Type-scale repair | `e289bf85` | Yes |

Verify, don't trust the table: preflight P2.

#### Minimum action if it *is* stale, and its risk

OPERATOR-ONLY WRITE. Two commands:

```bash
docker exec substrate-live sh -lc '
  cd /workspace/git/super-repo && git fetch origin dev &&
  cd /workspace/git/human-surface-release && git checkout --detach origin/dev &&
  git rev-parse HEAD'
docker exec substrate-live systemctl restart human-surface-vessel
```

Do **not** try to fix pull-sync before the demo; the parent clone's branch is
someone else's working state.

**Risk of the restart, verified rather than quoted:**

- **Surface intents are lost.** `intents` is a plain in-memory array
  (`src/store.ts:519`), capped at `MAX_HISTORY`, with no journal call site.
  Observed empirically: health reported `intents:23` at 08:50 and `intents:3` at
  08:51 — which also proves a **second** restart happened around 08:51. Someone
  else is touching this vessel today.
- **Panels and feedback replay from the journal — wired, and observed working.**
  Replay is `src/store.ts:274` (`uiPanel_write`) and `src/store.ts:281`
  (`uiFeedback_write`). I did not take this from the commit message; I rehearsed
  it (step D5 below): seeded 6 fixture panels into a disposable instance, killed
  the process, restarted it, and health returned `panels:6` with
  `/api/questions` → `total:6`.
- **Today, however, a restart drops panels anyway** — because the live journal
  holds zero panel records (Finding 3). `panels:0` before and after.

### Finding 2 — SAY THIS FIRST AND LOUDEST: the demo-killer is emptiness, not staleness

The brief assumes a human pointed at the corpus sees ~425 solicitations. **That
is false at both ends.**

- **At `:18310` the human sees ZERO.** `curl -s http://localhost:18310/health`
  → `"store":{"panels":0,...}`. `curl -s http://localhost:18310/api/questions`
  → 102 bytes, `{"questions":[],"total":0,"unanswered":0}`.
  The reason is structural, not transient: `/api/questions` is strictly local —
  `src/routes/participation.ts:14` forwards to the local `uiQuestion` case, which
  reads `listPanels()` (`src/routes/impulses.ts:271`) from this vessel's own
  in-memory map. **There is no fan-out to any other vessel.**
- **The 450-panel corpus lives on `stateful-ui-vessel`**, which is
  container-only (`curl http://localhost:18270/` and `:8270` both return
  `000` — no host port mapping) and whose `src/**` is GATED for this work.
  Its health: `{"vessel":"stateful-ui-vessel","port":8270,"panels":450}`.
  It serves `uiQuestion` at `/resolve`, **not** `/v2/impulses/resolve`.
- **And the visibility repair is NOT applied there.** Its `uiQuestion` returns
  `total: 250` — `gap_needs_human 236`, `question 11`, `code_change 3`. Against
  the documented corpus (`gap_needs_human 236`, `gap_pending_verification 101`,
  `gap_needs_localization 65`, `info 19`, `gap_reland_needs_human 14`,
  `question 11`, `code_change 3`, `pulse 1`), the denylist-correct answer is
  ~430 and it returns 250. **180 solicitations are still hidden on the vessel
  that actually holds them**, and that vessel is gated.

**So frame the demo honestly:** the visibility repair is demonstrated on
`:18310` **against seeded frozen fixtures**, with the stateful-ui numbers cited
as the *unrepaired live contrast* — the same defect class, still open, on a
vessel this work was not permitted to touch. Do not point a browser at `:18310`
and say "this is the live corpus." It is not, and the audience's first click
will show an empty list.

### Finding 3 — the live journal is not the shared directory the code documents

`src/participation-journal.ts:5` resolves
`join(process.env.WORKSPACE_ROOT ?? "/workspace", "interactor-log")`, and the
comment at lines 15-16 asserts *"human-surface's unit sets no WORKSPACE_ROOT (so
it defaults to /workspace) and development-vessel sets WORKSPACE_ROOT=/workspace,
so both append to the same file."*

**That is false in this deployment.** `/etc/substrate/env` sets
`WORKSPACE_ROOT="/workspace/git/super-repo"`, and systemd gives `EnvironmentFile=`
precedence over `Environment=` regardless of order (the unit file says so
itself). Read from the running process:

```
/proc/<MainPID>/environ → WORKSPACE_ROOT=/workspace/git/super-repo
```

So the live journal is `/workspace/git/super-repo/interactor-log/`, while
development-vessel's shared file is `/workspace/interactor-log/`. Both exist and
they diverge:

| Directory | `uiPanel_write.jsonl` | `uiFeedback_write.jsonl` |
|---|---|---|
| `/workspace/interactor-log/` (documented shared) | **absent** | 20 lines, last write Sep 7 |
| `/workspace/git/super-repo/interactor-log/` (actually used) | **absent** | 15 lines, growing today |

Two consequences for what you may claim:

1. **The envelope repair's cross-vessel purpose is not exercised live.** The
   three-way tolerant read is real and proven by test — but the two writers are
   not sharing a file, so "development-vessel's records are now readable by
   human-surface" is a *code* claim today, not a *deployment* claim.
2. **`uiPanel_write.jsonl` does not exist in either directory.** No panel has
   ever been journalled on this deployment. Panel replay is correct and restores
   nothing.

This also fully explains an apparent anomaly: health said `feedback:2` while
`/workspace/interactor-log/uiFeedback_write.jsonl` holds 20 lines. It reads the
*other* directory. For completeness, the 20-line file decomposes as 5 genuine
`dismiss` records and 15 foreign records written by another producer into the
shared file (pointer keys like `dispatch_id, path, orphaned_capability_scan` —
not feedback at all). Replaying that exact file into a disposable instance
restored **5 of 5** genuine records and silently skipped the 15 foreign ones, so
the predicate is right; the live count differs only because of the directory.

---

## Preflight — 6 minutes

Run all of it before the audience arrives. Measure exit codes with
**redirection, never a pipe** (a pipe reports the last stage's status).

### P1 — deployment truth (2 min)

```bash
docker exec substrate-live sh -lc 'cd /workspace/git/human-surface-release && git rev-parse HEAD'
git -C /home/avi/documents/work/substrate ls-remote origin dev
docker exec substrate-live systemctl show human-surface-vessel \
  -p ExecMainStartTimestamp -p NRestarts -p ActiveState
```

- **PASS**: the two SHAs are equal, `ActiveState=active`, and
  `ExecMainStartTimestamp` is at or after the moment of the checkout.
- **FAIL**: run the two-command redeploy in §0, then re-run P1.
- **FAIL, unequal and you dare not restart**: skip demo steps D1 and D4 and
  present them from the committed evidence instead (each step names its
  fallback).

### P2 — the running process carries the code, not just the repo (1 min)

```bash
cd /home/avi/documents/work/substrate
for f in store.ts surface-intent.ts participation-journal.ts routes/impulses.ts; do
  a=$(docker exec substrate-live sh -lc "cd /workspace/git/human-surface-release && git hash-object repos/human-surface-vessel/src/$f" | tr -d '\r')
  b=$(git hash-object repos/human-surface-vessel/src/$f)
  [ "$a" = "$b" ] && echo "OK   $f" || echo "STALE $f  live=$a  tree=$b"
done
```

- **PASS**: four `OK` lines. (Captured at 08:57 and re-confirmed at 09:06: all
  four OK.)
- **FAIL**: any `STALE` → redeploy per §0.
- Add `importance.ts` to the loop once it is committed; a file that exists only
  in the working tree reports `STALE` with an empty `live=` and that is correct,
  not a bug in this check.
- Also compare the served UI bundle, because `src/` and `ui/dist/` go stale
  independently:
  `curl -s http://localhost:18310/ | grep -o 'index-[A-Za-z0-9_-]*\.\(js\|css\)'`
  against `ls repos/human-surface-vessel/ui/dist/assets/`. At 08:57 both were
  `index-BStMYwKR.js` / `index-CfzbOD-3.css`; by 09:05 the tree had moved to
  `index-DjLioLd6.js` while the deployment had not.

### P3 — suite and typecheck (2 min)

```bash
cd /home/avi/documents/work/substrate/repos/human-surface-vessel
~/.bun/bin/bun test --preload ./test/setup.ts ./test/*.test.ts > /tmp/suite.txt 2>&1; echo "SUITE RC=$?"
~/.bun/bin/bun x tsc --noEmit > /tmp/tsc.txt 2>&1; echo "TSC RC=$?"
tail -4 /tmp/suite.txt
```

- **PASS**: `SUITE RC=0` and `TSC RC=0`. **Do not pin the counts** — they moved
  under me during this session: `53 pass / 263 expect() / 8 files` at 08:52
  became `104 pass / 412 expect() / 10 files` at 09:05 when the concurrent
  importance/exposure work added `test/importance.test.ts` and
  `test/exposure.test.ts`. The pass/fail criterion is **`0 fail` and both
  RC=0**, with the count at or above whatever you record here in your own
  preflight. A *dropping* count is the alarm, not a rising one.
- **FAIL**: do not demo any behavioural claim. Say "the suite is red, so I will
  only show recorded evidence" and run D3 and D6 only (both read committed
  artifacts).

### P4 — browser harness (1 min)

```bash
export PLAYWRIGHT_MODULE=/home/avi/.bun/install/cache/playwright-core/1.62.1@@@1
export CHROMIUM_EXECUTABLE=/home/avi/.cache/ms-playwright/chromium-1224/chrome-linux64/chrome
```

- **PASS**: both paths exist (`ls -d "$PLAYWRIGHT_MODULE" "$CHROMIUM_EXECUTABLE"`).
- **FAIL**: without these, every probe dies with
  `Executable doesn't exist at .../chromium_headless_shell-1243/...` — the
  default resolution picks a browser that is not installed. **Export them in the
  same shell you run the probes from.** This is the single most likely
  five-minutes-before-the-demo failure.

Also export a scratch workspace for every probe so nothing touches live state:

```bash
export WORKSPACE_ROOT=$(mktemp -d)
```

---

## The demonstrable story — 22 minutes

Order matters: it builds from "a human's bytes survive" to "a human's answer is
read by a machine" to "a human's complaint became a landed repair."

### D1 — the surface is one page and does not scroll (2 min)

```bash
cd /home/avi/documents/work/substrate/repos/human-surface-vessel
WORKSPACE_ROOT=$(mktemp -d) ~/.bun/bin/bun run test/one-page-probe.ts > /tmp/onepage.txt 2>&1; echo "RC=$?"
tail -2 /tmp/onepage.txt
```

**Audience sees** (captured verbatim, RC=0):

```
PASS one-page: no page scroll at 1440x900 and 1280x800 (and 125% zoom),
all five regions in view, long material scrolls internally, no JS errors
```

**Say**: two viewports plus 125% zoom, five regions simultaneously in view, and
long material scrolls *inside its region* rather than pushing the page. That is
the whole v2 adoption argument, and it is a layout claim — not a comprehension
claim.

**Fallback**: open `http://localhost:18310/` in the browser at 1440x900 and show
no vertical page scrollbar by hand. If the probe fails, say so and show the
browser; do not re-run hoping.

### D2 — a coercing store is distinguishable from a sound one (4 min)

```bash
cd /home/avi/documents/work/substrate
WORKSPACE_ROOT=$(mktemp -d) ~/.bun/bin/bun run validation/human-participation/fidelity-probe.ts > /tmp/fid.txt 2>&1; echo "RC=$?"
cat /tmp/fid.txt
```

**Audience sees** (RC=0): three PASS blocks, and these are the lines to read out:

- `F1 NO COERCION` — a 659-byte string round-trips byte-identical; an object
  body deep-equals; the DOM contains **zero** occurrences of `[object Object]`
  across 2217 scanned characters; the collapsed preview still carries the tail
  sentinel `END-SENTINEL-7f3a`, so nothing was truncated.
- `F2 NO DEFAULTING` — a body-only second write preserves the title; a
  title-only write preserves the body; revision advances 1 → 3, so partial
  writes are revisions and not silent no-ops.
- `F3 ORIGINAL REACHABLE` — the probe asserts the verbatim block was **not**
  already visible, *then* clicks the disclosure, *then* asserts byte-exactness.
  The click is what reveals it.

**Say**: the probe also prints its own limits, which is the point —
`NOT COVERED: F2 is asserted at the write path only` and
`NOT ESTABLISHED: orientation, comprehension, appeal`.

**Fallback**: `test/store.test.ts` and the fidelity assertions are in the suite
from P3; cite the `0 fail` line you recorded in your own P3 run (not a number
from this document — see P3) and show `/tmp/fid.txt` from the preflight run.

### D3 — a human contribution reaches a consumer that reads it (5 min)

This is the strongest step. The consumption link **HOLDS** as of this session.

```bash
cd /home/avi/documents/work/substrate
export PLAYWRIGHT_MODULE=/home/avi/.bun/install/cache/playwright-core/1.62.1@@@1
export CHROMIUM_EXECUTABLE=/home/avi/.cache/ms-playwright/chromium-1224/chrome-linux64/chrome
WORKSPACE_ROOT=$(mktemp -d) ~/.bun/bin/bun run validation/human-participation/stage4-trace.ts > /tmp/stage4.txt 2>&1; echo "RC=$?"
cat /tmp/stage4.txt
```

**Audience sees** (RC=0). Verdict line, captured verbatim:

```
5/9 links held; every MISSING link names its cause and the open gap that owns it.
VERDICT: PASS — all 5 expected-HELD links held.
```

The two links to read out loud:

```
[HELD] contribution → durable journal + receipt
        receipt shown in browser; journal line (envelope with `record`):
        id=dd5c7c39-... panelId=needs-human-orphaned-capability-mcp:tool_call
        rev=1 ...; original content preserved verbatim

[HELD] consumption by a subsequent activity
        solicitation_outcome_scan (the REAL resolver, same workspace) recognized
        the answer: {"shape":"solicitationOutcomeReport","body":{"authored":true,
        "outcomes":[{"solicitation_id":"needs-human-orphaned-capability-mcp:tool_call",
        "outcome":"answered"}],"answered":1,"unanswered":0,...}}
```

**Say**: a human typed into a browser, the answer landed in a durable journal
with a receipt, and then **the real downstream resolver — not a stub — read it
back and scored it `answered`**. Rendered in Chromium 1440x900; screenshot at
`/tmp/stage4-presentation.png`.

**Then immediately read the MISSING links** — the trace prints its own
shortfalls and that is the honest part of the story:

```
[MISSING] consequence (artifact/decision changed)
        ... nothing acted on it ... Scoring is not consequence, and a readable
        journal line does not create one.
[MISSING] learning (posterior/template/concept update)
        ... solicitation-outcome-scan's only learned-state write,
        recordOperatorEngagement("landed_commit"), fires solely for an answered
        panel whose id starts with "reland-needs-human-" ...
[MISSING] presentation assignment   (owned by Track B item B-5)
[MISSING] later reuse               (stage-1 matrix, transition 7)
```

**Fallback**: the trace is committed at
`validation/human-participation/TRACE-2026-09-20.md`. Read it from there. If the
probe fails at the browser stage, P4 was not exported.

### D4 — the escalation-visibility repair, on seeded fixtures (4 min)

**Do not use the live corpus** (Finding 2). Run a disposable instance so you are
never one keystroke from writing live panels.

First define the stop helper — **paste this once per terminal**:

```bash
stop8399() {
  P=$(ss -ltnp 2>/dev/null | grep ':8399 ' | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
  [ -n "$P" ] && kill "$P"; sleep 1
  ss -ltn 2>/dev/null | grep -q ':8399 ' && echo "STILL LISTENING - FAIL" || echo "8399 free"
}
```

**Why not `kill %1` / `kill %%`.** `~/.bun/bin/bun` is a shim: `$!` is the shim's
pid, not the server's. In rehearsal `kill %1` printed
`kill: (937481) - No such process` while the real server (pid 938306) kept
listening on 8399 — and then every "restarted" instance silently failed to bind
and I went on interviewing the *old* process. That is a silent skip reading as a
pass, and it would have made D5's restart claim a lie. **Kill by port owner and
assert the port is free.** Then run this block (`&` at the top level, not in a
subshell):

```bash
stop8399
cd /home/avi/documents/work/substrate/repos/human-surface-vessel
W=$(mktemp -d); echo "W=$W"
WORKSPACE_ROOT=$W PORT=8399 ~/.bun/bin/bun src/index.ts > /tmp/demo-inst.log 2>&1 &
sleep 3
ss -ltnp 2>/dev/null | grep ':8399 ' >/dev/null && echo "LISTENING ok" || echo "NOT LISTENING - FAIL"
cd /home/avi/documents/work/substrate
jq -c '.questions[]' validation/human-participation/fixtures/live-escalation-panels-2026-09-20.json |
while read -r q; do
  curl -s -o /dev/null -w "%{http_code} " -X POST http://localhost:8399/v2/impulses/resolve \
    -H 'Content-Type: application/json' \
    -d "$(jq -cn --argjson q "$q" '{impulse:{pointer:($q + {type:"uiPanel_write"})}}')"
done; echo
curl -s http://localhost:8399/api/questions |
  jq -c '{total:.body.total, unanswered:.body.unanswered,
          kinds:(.body.questions|map(.kind)|group_by(.)|map("\(.[0]):\(length)"))}'
```

**Do NOT use `pkill -f 'bun src/index.ts'` to stop it.** The pattern matches the
shell that is running the block and kills your own terminal — I did exactly that
during rehearsal (exit 144, output lost mid-step). Use `stop8399`.

Verified verbatim: `200 200 200 200 200 200` then
`{"total":6,"unanswered":6,"kinds":["gap_needs_human:6"]}`, against a process
proven fresh by the `LISTENING ok` assertion.

**Audience sees** (captured):

```
200 200 200 200 200 200
{"total":6,"unanswered":6,"kinds":["gap_needs_human:6"]}
```

**Say**: all six frozen panels are `kind: "gap_needs_human"` — the kind no
autonomous escalation ever wrote as `"question"`. Before `1704850a` the reader
filtered on `kind === "question"`, so `total` here would have been **0**: six
escalations written to the surface and then filtered back out of the only read
path the browser has. Now the store has one exported `isSolicitation` denylist
(`info`, `pulse`) consumed at all three previously-disagreeing sites, so the
vocabulary stays open at runtime — a human can dismiss noise but cannot see
silence.

**Then give the honest contrast**: on the vessel that actually holds the 450
live panels, this repair is not applied and 180 solicitations remain hidden
(Finding 2). That vessel's source was out of scope for this work.

**Fallback**: `test/solicitation-reader.test.ts` and
`test/solicitation-store.test.ts` are in the green suite from P3.

Leave the instance running for D5; D5 stops and restarts it with `stop8399`.

### D5 — panels survive a restart; intents do not (2 min)

Continue in the same disposable instance from D4.

```bash
jq -c . $W/interactor-log/uiPanel_write.jsonl | wc -l   # -> 6 journalled panel records
stop8399                                                # -> "8399 free"  (MUST say free)
cd repos/human-surface-vessel
WORKSPACE_ROOT=$W PORT=8399 ~/.bun/bin/bun src/index.ts > /tmp/demo-inst2.log 2>&1 &
sleep 3
curl -s http://localhost:8399/health | jq -c '.store'
curl -s http://localhost:8399/api/questions | jq -c '{total:.body.total}'
stop8399
```

Two traps this block defuses, both of which caught me:

- **`stop8399` must print `8399 free` before the restart.** If it prints
  `STILL LISTENING - FAIL`, the second `bun` cannot bind and every answer you get
  afterwards comes from the *old* process — the replay claim becomes unfalsifiable.
- **`wc -l` on the journal reports 12, not 6** — the append path emits a blank
  line between records. `jq -c . | wc -l` gives the record count. Cosmetic, but
  it will confuse you at 9am.

**Audience sees** (captured):

```
{"panels":6,"feedback":0,"observations":0,"events":0,"assertions":0,"attachments":0,"intents":0}
{"total":6}
```

**Say**: panel replay is real and observed, not asserted — `store.ts:274`. And
note what did *not* survive: `intents:0`. Surface intents are an in-memory array
(`store.ts:519`) with no journal call site, which is why the live surface's
intent history vanishes on every restart.

**Say plainly**: on the *live* deployment a restart drops panels too, because
`uiPanel_write.jsonl` does not exist in either candidate journal directory
(Finding 3). The mechanism is correct; the deployment has never fed it.

**Fallback**: `test/journal-envelope.test.ts` proves the fresh-process replay in
the suite.

### D6 — a human reported a defect through the surface and it was repaired (5 min)

No live write needed; this stages entirely from committed evidence plus one
read-only call.

**Step 1 — the defect, from live evidence.**

```bash
cd /home/avi/documents/work/substrate
jq . validation/human-participation/evidence-text-scale-collapse-2026-09-20.json
```

Audience sees all six type-scale tokens collapsed to the same value:

```
--sf-text-xs .. --sf-text-2xl : all "10.44px"   (revision 12)
note: "typed instruction: Change this surface itself: make the labels on the
       human surface bigger. ..."
```

**Say**: the human's complaint was *"every interact with the goal execution box
results in the text size decreasing."* The surface shares **one input box**
between goal dispatch and typed surface instructions. The parser treated any
clause carrying a digit plus any of `text/font/type/size/letters` as an absolute
type-scale instruction — and `type` occurs in "type-scale", "typecheck" and
"prototype". So ordinary goal text silently restyled the page, and the hierarchy
flattened to one size.

**Step 2 — the diagnosis, in the source.**

```bash
sed -n '450,470p' repos/human-surface-vessel/src/surface-intent.ts
```

The measured examples are recorded in the guard's own comment: *"resolve impulse
type 3 and report the result"* drove the base to the 9px floor; *"Fix the type
error in store.ts line 174"* drove it to the 40px ceiling; *"Reduce the size of
the payload to 2 items"* drove it to 9px. The repair: a number is a size only
when it carries a unit, or when an explicit setter binds it to the size word.

**Step 3 — the falsifier.**

```bash
~/.bun/bin/bun test --preload ./test/setup.ts ./test/surface-intent-type-scale.test.ts
```

Seven tests, including `leaves the type scale untouched: "<goal text>"` over the
measured goal strings, `an explicit unit sets the base and KEEPS the hierarchy`,
`relative bigger scales every step and keeps the hierarchy`, and
`a flattened policy REPAIRS itself on the next instruction`. Note the last one:
the repair is not only preventive, it un-flattens an already-collapsed policy.

**Step 4 — the live policy is clean.**

```bash
curl -s -X POST http://localhost:18310/v2/impulses/resolve \
  -H 'Content-Type: application/json' \
  -d '{"impulse":{"pointer":{"type":"renderPolicy"}}}' | jq .
```

Captured:

```json
{"resolved":true,"success":true,"shape":"renderPolicy",
 "body":{"tokenOverrides":{},"formByShape":{},"maxPreviewChars":null,
         "ledgerDefaultExpanded":true,"presentation":"onepage","revision":2,
         "note":"reset to defaults by a typed instruction"}}
```

**Say**: overrides empty, presentation `onepage`, and the note records that a
*typed instruction in plain English* cleared it — which is itself the reset
grammar working (§Reset).

**Fallback**: steps 1-3 are files and a test; they work with no substrate at
all. Only step 4 needs `:18310`.

---

## What we will NOT claim

State this section out loud. It is the part that makes the rest credible.

1. **No comprehension evidence and no appeal evidence exists.** Three of the
   seven scorecard dimensions — orientation, comprehension, appeal — are
   **blocked on a non-author participant**. Every probe here observes bytes and
   DOM. The fidelity probe prints this itself:
   `NOT ESTABLISHED: orientation, comprehension, appeal. This probe observes
   bytes and DOM only.` Nobody who did not write this code has used it.
2. **v2's adoption rests on the one-page requirement, not on any measured
   comprehension benefit.** D1 shows no page scroll at two viewports with five
   regions in view. That is a geometry result. It is not evidence that anyone
   understood anything faster.
3. **The consequence and learning links of the trace are MISSING, and we know
   exactly why.** Consequence: the live path (goal-host `human_input` retry,
   `escalation_disposition_apply`) was not exercised, and the latter **has no
   scheduler at all**. Scoring is not consequence. Learning:
   `solicitation-outcome-scan`'s only learned-state write,
   `recordOperatorEngagement("landed_commit")`, fires **solely** for an answered
   panel whose id starts with `reland-needs-human-`; an ordinary
   `needs-human-` escalation is scored and writes nothing learnable. Closing it
   needs a learned-state write reachable from an ordinary answered escalation —
   not a wider journal fix.
4. **Nothing here demonstrates importance ORDERING, and it is not deployed.**
   The `uiQuestion` read path (`src/routes/impulses.ts:269-293`) filters and maps;
   it does not rank. The operator's directive — *show what is most important, and
   learn importance from what was shown* — is **not satisfied by anything in this
   runbook**.

   Ordering work is **in flight and uncommitted** as of 09:05: `src/importance.ts`,
   `test/importance.test.ts`, `test/exposure.test.ts`, `ui/src/lib/exposure.ts`
   and a rebuilt `ui/dist/assets/index-DjLioLd6.js` are all untracked or modified
   in the working tree, and `impulses.ts` still has no sort. **Until that lands,
   is pushed, and the release worktree is re-checked-out, a browser at `:18310`
   serves `index-BStMYwKR.js` and cannot show it.** Check before promising:

   ```bash
   git -C /home/avi/documents/work/substrate log --oneline -3 -- repos/human-surface-vessel/src/importance.ts
   curl -s http://localhost:18310/ | grep -o 'index-[A-Za-z0-9_-]*\.js'
   ```

   If the first command is empty, or the second still prints `index-BStMYwKR.js`,
   say plainly that ordering is not in this demo.
5. **The escalation-visibility repair is shown on six frozen fixtures, not on
   the 450-panel live corpus.** The live corpus is on a gated, host-unreachable
   vessel where the repair is not applied and 180 solicitations remain hidden.
6. **The journal envelope's cross-vessel readability is a code claim, not a
   deployment claim** — the two writers are pointed at different directories
   (Finding 3).
7. **Attention is not claimed anywhere.** The trace's exposure link says so
   verbatim: `ATTENTION IS NOT CLAIMED — visibility only`.

---

## Reset procedure between runs

### Reset the live surface to a legible state

The grammar is a *deterministic parse*, not an LLM call
(`src/surface-intent.ts:352-356`): a clause matching
`reset|undo|revert|restore|clear` **and** one of
`default|defaults|normal|original|everything|all|it` (or a bare
`reset`/`undo`/`revert`) clears every token override and form pin, sets
`maxPreviewChars` to null, and restores `ledgerDefaultExpanded`. The published
grammar line is `"reset to defaults (undo every override)"`.

OPERATOR-ONLY WRITE. Exact call:

```bash
curl -s -X POST http://localhost:18310/v2/impulses/resolve \
  -H 'Content-Type: application/json' \
  -d '{"impulse":{"pointer":{"type":"surfaceIntent","text":"reset to defaults"}}}' | jq .
```

Confirm with the `renderPolicy` read from D6 step 4. **PASS**: `tokenOverrides`
is `{}` and `note` is `"reset to defaults by a typed instruction"`. (The live
policy already shows exactly this, which is how the collapsed type scale was
cleared.) This is the one live write in the runbook, and it is idempotent.

### Re-seed the frozen fixtures

**Standing hazard: any walk touching `ui` shapes can overwrite live panels by
id.** Fixture ids are the real escalation ids (e.g.
`needs-human-orphaned-capability-mcp:tool_call`), so a concurrent autonomous
write lands on the same key. **Re-seed immediately before each run — never
assume a previous seed persisted**, and prefer the disposable instance in D4 so
a collision is impossible.

Re-seed = re-run the D4 loop against a **fresh** `mktemp -d` and a fresh
process. Do not reuse `$W` between runs; a reused journal replays the previous
run's answers and the panels come back at revision 2, which will make the
accept-guard's stale-revision message appear during D4 and look like a bug.

Fixtures, for reference:

| File | Contents |
|---|---|
| `fixtures/live-escalation-panels-2026-09-20.json` | 6 panels, all `gap_needs_human`; keys `frozen_at, questions, source` |
| `fixtures/seed-panels-v1.json` | the frozen scenario set (used by `asks-contract-probe.ts`) |
| `fixtures/incident-handoff-v1.json` | multi-ask handoff scenario |
| `fixtures/disputed-trace-exec_0pjz9wt6.json` | disputed-trace scenario |

Optional extra evidence step, 2 min, RC=0 captured:

```bash
WORKSPACE_ROOT=$(mktemp -d) ~/.bun/bin/bun run validation/human-participation/asks-contract-probe.ts
```

Ends with `GREEN: every frozen fixture pointer carries its declared ask ids; a
per-part contribution lands at the current revision; answering all parts reports
answered=true`, and prints the accept-guard hoist result verbatim:
`ASK-ID VALIDATION WITHOUT A REVISION (expect 409 — was 200 before the guard
hoist): HTTP 409`.

---

## Timing

| Step | Minutes |
|---|---|
| P1 deployment truth | 2 |
| P2 running code matches tree | 1 |
| P3 suite + typecheck | 2 |
| P4 browser harness env | 1 |
| D1 one page, no scroll | 2 |
| D2 fidelity: coercion vs sound | 4 |
| D3 contribution → consumption (the strong one) | 5 |
| D4 escalation visibility on fixtures | 4 |
| D5 restart survival | 2 |
| D6 human-reported defect → repair | 5 |
| "What we will NOT claim" | 3 |
| Reset | 1 |
| **Preflight** | **6** |
| **Demo** | **25** |
| **Total with slack** | **~35** |

If the slot is 20 minutes, cut D5 and D2 (both are covered by the green suite)
and keep D1, D3, D4, D6 plus the NOT-claiming section. Never cut the NOT
section.

---

## Top three things that will break this demo

### 1. The deployed build going stale again — and nothing will tell you

**Loudest version, say it first if it happens**: *the deployed build is stale and
nothing in this session is visible to a browser pointed at `:18310`.* That was
literally true at 08:49:03 today. It is currently false only because someone
hand-checked-out and restarted at 08:49:38. There is **no keeper**: pull-sync
does not enumerate the worktree (only the unit file mentions it), and pull-sync's
super-repo leg has failed on every observed tick because the parent clone sits on
branch `development-vessel`.

**Cheapest mitigation**: run preflight P1 and P2 immediately before the demo —
30 seconds, and P2 compares the *running clone's blobs* rather than believing
`git log`. If stale, the two-command redeploy in §0 fixes it; budget one minute
and accept losing the in-memory intent history (nothing else is lost, because
the panel journal is empty anyway).

### 2. Pointing the browser at `:18310` and finding an empty list

`:18310` holds **0 panels**, `/api/questions` returns 102 bytes of emptiness, and
the reader is strictly local with no fan-out — so the 450-panel corpus on
`stateful-ui` (container-only, gated, `/resolve` not `/v2/impulses/resolve`,
still hiding 180 solicitations) will never appear there. A demo that opens the
browser and gestures at "the wall" dies on the first click.

**Cheapest mitigation**: never demo visibility from the live corpus. Run D4's
disposable instance on port 8399 with the 6 frozen fixtures, seeded in the 20
seconds before you speak, and cite the stateful-ui numbers verbally as the
unrepaired contrast. Have `curl -s http://localhost:8399/api/questions` already
in your shell history.

### 3. The Playwright environment, which silently picks a browser that is not installed

Every browser-backed step — D1, D2, D3 — dies instantly without
`PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE`. The failure is a 40-line
Playwright banner ending in `Executable doesn't exist at
.../chromium_headless_shell-1243/...`, which reads like a broken machine rather
than a missing export. I hit exactly this on the first stage4 run today.

**Cheapest mitigation**: export both in the demo shell during P4, then prove the
harness end-to-end once by running D1 during preflight — it takes 20 seconds and
converts the riskiest dependency into a known-good. Keep `/tmp/onepage.txt`,
`/tmp/fid.txt` and `/tmp/stage4.txt` from that preflight run on screen as the
fallback, so a live probe failure costs you nothing but a sentence.

**Honorable mention — a concurrent agent is editing this vessel today, and the
UI bundle is being rebuilt.** The restart at ~08:51 (`intents` 23 → 3) was not
mine. Between 08:52 and 09:05 the suite grew from 53 to 104 tests,
`src/importance.ts` and two exposure/importance test files appeared untracked,
`ui/dist/index.html` was modified, and a new bundle `index-DjLioLd6.js` replaced
`index-BStMYwKR.js` in the tree — while the deployed worktree still serves
`index-BStMYwKR.js`. Every probe capture in this document names its renderer
bundle (`renderer index-BStMYwKR.js @ 1440x900`); if a probe prints a *different*
bundle than the browser at `:18310` is serving, the tree and the deployment have
diverged again. If any step behaves unlike this document, re-run P1/P2 and P3
before debugging anything: the most likely explanation is that the code under you
changed.
