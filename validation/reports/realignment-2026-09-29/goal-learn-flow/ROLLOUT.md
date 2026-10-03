# ROLLOUT: slice P (pinned judge)

P = `scripts/substrate/gate/` (gate-runner.sh, candidate.sh, shadow-eval.sh, gate-policy.json),
the gated mode in `substrate-pull-sync.sh`, the unit's new ExecStart, `InaccessiblePaths=-/workspace/.gate`
in `units/vessel.d/10-secrets-out-of-reach.conf`, the entrypoint `mkdir`, and the
`validation/scripts/gate-*.test.sh` rows plus the corpus in `validation/scripts/gate/fixtures/`.

**Gate set.** `gate-policy.json` gates `scripts/substrate/*` and `validation/scripts/*` (the
harness), minus an explicit `non_root_paths` list of four host-only tools. Every root-run glue
file (render-secret-scope.sh, secrets-manifest.json, gen-env.sh, entrypoint.sh, vessel-ctl.sh,
secrets.env.sh, units/*, the active-scripts seeds) is therefore installed or run only from the
accepted copy. A candidate policy may only ADD gate globs and only REMOVE exclusions; the
reverse is a widening.

**Bootstrapped** means ANY of `accepted.sha`, `accepted/`, `history/`, `ledger.jsonl` or the
`bootstrapped` marker exists. The directory itself is no signal: entrypoint pre-creates it. A
node with `accepted.sha` missing but other state present REFUSES every tick (exit 3,
`GAP gate-state-partial`, a `gate_state_partial` notice), and so does the unit when the runner
is also missing. The only ways out are explicit host CLI commands, each one recorded:
`gate-runner rollback-gate --to <sha>` or `gate-runner rebootstrap --confirm`.

Order (H5): **node 2 (`compose2-live`) → node 1 (`substrate-live`) → pubspoke → hub (syzygy)**.
Each step needs N = `gate-policy.json soak_ticks.default` (3) clean ticks on the previous node.

## 0. What happens on arrival (read first)

1. P lands on `dev` and arrives on a node through the **old run-on-arrival path** (`847025e2`).
   The pre-P pull-sync installs P's pull-sync and execs it. **That is the last self-judged
   step, and it is stated, not hidden.**
2. P's pull-sync runs **ungated** (no `PULLSYNC_ACCEPTED_DIR`). On that tick it:
   - installs `/usr/local/libexec/substrate/gate-runner`;
   - creates `/workspace/.gate` (0700);
   - then converges `substrate-pull-sync.service`, whose ExecStart is now
     `/bin/sh -c '… gate-runner tick …'`.

   The runner is installed before the unit that names it. If the runner is absent and the gate
   was never bootstrapped, the unit runs the pre-gate pull-sync once more. If the gate **was**
   bootstrapped and the runner is missing, the unit refuses with `GAP gate-runner-missing`
   (exit 3). It never falls back to the self-judging path.
3. **Next timer fire** (≤10 min): `gate-runner tick` **bootstraps**. It runs `git archive` of
   the clone's committed HEAD into `/workspace/.gate/accepted/` (origin/dev if HEAD carries
   local commits), writes `accepted.sha` and the MANIFEST, and appends one `bootstrap` L12
   record. From then on, only `accepted/` executes.
4. Every lane commit that touches a gate path is now a **candidate**:
   - its gate files are never installed or run;
   - the accepted `candidate.sh` classifies it;
   - `shadow-eval.sh` runs the accepted corpus against it;
   - a pass that soaks N ticks writes `promote.request`, and the runner promotes it on the
     next tick.

   Non-gate paths in the same commit keep converging. Editing or removing an accepted fixture,
   or dropping a policy glob, is a **widening**. P has no criterion, so P never promotes a
   widening; it files an `authority_widening` gap.

## 1. Before pushing P to `dev`

P reaches every canary node within one tick of landing. Lane nodes must stay `canary`
(gen-env refuses `hold` with landing on), so the ordering is done by **pausing the timer** on
the later nodes. This is a reversible operator step:

```
# on node 1, pubspoke and the hub (each one's own docker host)
docker exec <container> systemctl stop substrate-pull-sync.timer
docker exec <container> systemctl is-active substrate-pull-sync.timer   # expect: inactive
```

The hub (syzygy) is NOT exempt: its substrate-pull-sync.timer is enabled and ticks ~10 min on
canary (MDP=0 disables landing, not convergence), so it takes P on its next tick like any node.
Pause it too (the user does this; operator remote writes there are blocked) and confirm
`inactive` BEFORE pushing. Its pending secrets pass-2 strip then runs as a manual tick folded
into its P step, last.

## 2. Node 2 (`compose2-live`)

1. Push P to `origin/dev` (qa review first).
2. Wait for the arrival tick:

   ```
   docker exec compose2-live journalctl -u substrate-pull-sync -n 200 --no-pager | grep -E 'gate:|self:'
   ```

   Expect `gate: installed /usr/local/libexec/substrate/gate-runner`.
3. Wait one more tick. Confirm the **bootstrap**:

   ```
   docker exec compose2-live cat /workspace/.gate/accepted.sha
   docker exec compose2-live tail -n 3 /workspace/.gate/ledger.jsonl
   ```

   Expect exactly one `"kind":"bootstrap"` record whose sha equals `accepted.sha`, and a
   journal line `[gate …] bootstrap: accepted.sha=…`.
4. **MANDATORY: restart the lane units** so the drop-in binds, *after* `/workspace/.gate` exists. A `-`
   path absent at namespace build is skipped, and these units were started before P. Check that
   nothing is mid-flight first (no authoring markers in `/workspace/authoring-inflight`).

   ```
   docker exec compose2-live systemctl daemon-reload
   docker exec compose2-live systemctl restart development-vessel local-tools-vessel
   ```

5. **J1 live** (must-fail, plus a positive control through the same path):

   ```
   P=$(docker exec compose2-live systemctl show -p MainPID --value development-vessel)
   docker exec compose2-live nsenter -t "$P" -m -- sh -c 'test -e /workspace/.gate/accepted.sha && echo VISIBLE || echo HIDDEN'   # expect HIDDEN
   docker exec compose2-live sh -c 'test -e /workspace/.gate/accepted.sha && echo VISIBLE || echo HIDDEN'                         # control: VISIBLE
   ```

   Repeat for `local-tools-vessel`. While the lane is still root, this binds plain opens only.
   Resistance to remounting arrives with S1c's capability drop.
6. **J9 live**:
   - Land any commit touching a gate path. A comment-only change to
     `scripts/substrate/gate/gate-policy.json`'s `_doc` is enough.
   - Confirm that the next tick logs `gate: gate paths changed`, then
     `gate: verdict soaking 1/3`.
   - Confirm that `accepted.sha` is unchanged and that `/usr/local/bin/substrate-pull-sync` is
     not the candidate.
   - After 3 ticks, confirm `verdict promote`. On the tick after that, confirm a
     `"kind":"promote"` record and that `accepted.sha` equals the candidate.
7. **Integrity live** (non-destructive):

   ```
   docker exec compose2-live sh -c 'cd /workspace/.gate/accepted && jq -r ".files|to_entries[]|\"\(.value)  \(.key)\"" MANIFEST.json | sha256sum -c --quiet && echo INTACT'
   ```

   Corrupting a file is for the scratch tests only, never a live node.
8. Soak: N = 3 ticks with no `GAP gate-` lines and no `integrity_fallback` records.

   ```
   docker exec compose2-live journalctl -u substrate-pull-sync --since -40min --no-pager | grep -c 'GAP gate-'   # expect 0
   ```

## 3. Node 1 (`substrate-live`), then pubspoke, then the hub

For each node in order:
1. `docker exec <container> systemctl start substrate-pull-sync.timer`.
2. Repeat §2 steps 2–5 and 7–8 on that node. Repeat step 6 only if no gate candidate has
   promoted fleet-wide yet.
3. Pubspoke goes after node 1 because external joiners see it. On pubspoke, also confirm that
   `substrate-status` is unchanged for a joiner.
4. The hub goes last, by user-run pull, after N clean ticks on all three.

## 4. Rollback

| Situation | Action | Notes |
|---|---|---|
| A promoted gate is bad but parses | `docker exec <c> /usr/local/libexec/substrate/gate-runner rollback-gate --previous` (or `--to <sha>`) | Restores from `history/` (the last 5), or stages that sha from the mirror. Writes a `rollback` record. |
| `accepted/` fails integrity | Automatic: newest valid `history/` version, plus an `integrity_fallback` record | The corrupted copy is kept in `/workspace/.gate/rejected/`. |
| The body exits ≥2 on 3 consecutive ticks | Automatic, same fallback | |
| Nothing valid is left (journal: `GAP gate-no-valid-accepted-version`) | `gate-runner rollback-gate --image`, then once the mirror is healthy `rollback-gate --to <a known-good sha>` | The image copy has no `validation/` tree, so its corpus is empty. Shadow evaluation then refuses every gate candidate (fail closed) until `--to` restores a version with fixtures. `--image` is **manual only**: the image is built unjudged on every dev push. **After an `--image` break-glass, the refusal of gate changes is reported to humans**: the runner writes a `gate_from_image` notice, and every refused candidate adds a `candidate_refused` notice to `/workspace/.gate/notices.jsonl`. |
| `accepted.sha` lost, other gate state present (journal: `GAP gate-state-partial`) | Look at `ledger.jsonl`, then `gate-runner rollback-gate --to <the last promoted sha>`. Use `gate-runner rebootstrap --confirm` only when you mean to re-trust the clone's HEAD. | The runner never re-bootstraps on its own. `rebootstrap` writes a `rebootstrap` record before the new `bootstrap` record. |
| Back out P itself on a node | 1. `systemctl stop substrate-pull-sync.timer`. 2. Install the pre-P unit (`ExecStart=/usr/local/bin/substrate-pull-sync`) into `/usr/lib/systemd/system`, then `daemon-reload`. 3. Move `/workspace/.gate` aside (do not delete; it holds the ledger). 4. Revert P on dev. 5. Start the timer. | This is the operator's break-glass. Back up `/workspace/.gate` first. |

The break-glass test (`validation/scripts/gate-break-glass.test.sh`) runs on a scratch layout
only, never on a live node.

## 5. What P does not do (stated)

- **The runner itself** (`/usr/local/libexec/substrate/gate-runner`) is bootstrap tier. A
  runner change in `accepted/` is promoted as data but is not installed. It reaches a node only
  by an image rebuild and container recreate, or on a node not yet bootstrapped.
- **Soak is shadow-only.** N consecutive ticks of a shadow pass on this node. A runtime canary
  of the candidate gate (H5 "soaked on node 1") needs the candidate to *run*, which P never
  allows before promotion. That arrives with the criterion (slice L).
- **Holds** (`quarantine`), workbench delivery of notices with read receipts (J7) and the
  **criterion** (widening promotion) are slice L. In P, humans read the gate's own store,
  which does not depend on the lane:
  - `/workspace/.gate/ledger.jsonl`: L12 records for bootstrap, promote, rollback and
    integrity_fallback;
  - `/workspace/.gate/notices.jsonl`: every candidate verdict (widening, refused, soaking,
    promote), one line per change;
  - the journal's `GAP gate-` lines.

  Gaps for candidates are also POSTed through development-vessel, so they are lost while the
  lane is down. The notices are not.
- **S2's FIRST item: federation-transport runs from accepted/.** `federation-transport-vessel`
  runs `scripts/substrate/federation-relay` FROM the super-repo working tree, as root, and it is
  network-facing. The overlay covers only staged trees, so a lane-pushed edit there runs on its
  next restart, unjudged. S2 starts by moving its ExecStart/WorkingDirectory to the accepted copy.
- **Code that runs straight from the clone's working tree is outside the overlay.**
  `federation-transport-vessel` (scripts/substrate/federation-relay) and the super-repo-hosted
  vessels under `repos/` run from `/workspace/git/super-repo`, not from a staged tree. They are
  vessel code in a lane-writable directory, so placing them is S2/S3 scope.
- **Every glue change now waits for promotion.** Because the whole of `scripts/substrate`
  is gated, a unit or script change converges only after shadow pass, N ticks of soak and
  promotion (about 30 minutes at N=3). Staging the gate set is about 800 files and 7.7 MB
  (about 4.5 s per bootstrap or promotion); `history/` keeps 5 copies.
- **A node with no super-repo clone** (offline, no PAT, no git checkout) cannot bootstrap. The
  runner exits 3 with `GAP gate-bootstrap-failed` every tick and no body runs. Before P, the
  body ran a no-op and wrote the convergence record that `substrate-status` reads. This is a
  known regression for such nodes.

## 6. NEXT ITEMS after P

### 6a. A fresh node trusts an unjudged dev-HEAD image

Gap `a-fresh-node-trusts-an-unjudged-dev-head-image-as-its-first-accepted-version`.

**The problem: a trust-on-first-use bypass.** A fresh node has no `/workspace/.gate` state:
a new install, an acceptance run, or a wiped volume. Its first accepted version is whatever
HEAD its clone or image carries, and that image was built unjudged from dev HEAD.

**The fix, as the next slice:**
- CI builds release and install images only from a **fleet-accepted** sha. The gate-runner
  publishes `accepted.sha` as a record or tag.
- Install paths refuse dev-HEAD images.
- A fresh node bootstraps from an accepted-sha image, recorded as its L12 bootstrap.
- A `TODO(<gap id>)` marks the hook in `gate-runner.sh` `bootstrap()`.

| J-row | Case | Expected result |
|---|---|---|
| Must fail | A fresh node from a non-accepted dev-HEAD image | The runner holds and files a gap |
| Control | An accepted-sha image | It bootstraps |

### 6b. An image upgrade replaces the judge without shadow evaluation (qa a2)

The runner binary at `/usr/local/libexec/substrate/gate-runner` comes from the image, and the
image is built from unjudged dev HEAD. On an EXISTING, already-bootstrapped node, an image
upgrade (container recreate) therefore replaces the judge with code no accepted gate evaluated.
The accepted state in `/workspace/.gate` survives, but the runner that reads it does not.

**The real fix:** build images only from the fleet-accepted sha (the same pipeline as 6a), so
the runner an image carries has itself been promoted through the shadow path. Until then, an
image upgrade on a bootstrapped node is an operator act and is stated as such. Not built in P.

## 6a. TOFU fix, FIRST after this rollout (qa, 2026-10-02 17:15Z)
bootstrap() (gate-runner l.105-108) accepts the clone's committed HEAD (or origin/dev) at bootstrap time, NOT P's sha. origin/dev had already moved to 0a6f3d25 (scripts/substrate/substrate-status.sh, +72, a gate path) before any node bootstrapped, so every node's first accepted version includes a commit no gate judged (qa reviewed 0a6f3d25 after the fact: read-only status reporting, acceptable for this rollout). H1 ("the initial accepted.sha = P's commit") is NOT met by the mechanism. Fix: bootstrap takes an EXPLICIT sha (host-CLI argument, or `bootstrap_sha` pinned in P's own gate-policy/MANIFEST) and refuses with a gap if the clone's HEAD differs from it on any gate path; later commits become ordinary candidates. Record each node's actual bootstrap sha in the rollout intervention note.

## Intervention note: slice P rollout, 2026-10-02 (L12)
- Push: user ran `git push origin HEAD:dev` (fe941b61..a3e74a06) at ~17:00Z after the coordinator's push was blocked by its permission classifier.
- Canary order NOT held: self-repair-operational re-enabled the paused substrate-pull-sync.timer on the hub 17:01:27, pubspoke 17:07:43, node 1 17:08:33 (gap self-repair-re-enables-a-deliberately-paused-timer-so-no-maintenance-hold-exists). The coordinator's own re-stop was blocked by its classifier; the user chose re-pause, but it reached deployment at 17:28, after the bootstraps.
- Bootstrap shas (each node's first accepted version): node 2 a3e74a06 (17:12:57, P itself); node 1, pubspoke, hub 0a6f3d25 (a later gate-path commit, accepted unjudged; reviewed after the fact by qa and deployment as read-only status reporting). Recorded on gap a-fresh-node-trusts-an-unjudged-dev-head-image-as-its-first-accepted-version.
- Node 2: candidate 0a6f3d25 judged as designed (overlay installed the accepted copy, shadow 2 fixtures pass, soaking). dev-vessel + local-tools restarted 17:35:23/27; /workspace/.gate mode 0 from both MainPID namespaces.
- Lesson for the next staged rollout: a pause must be a shaped hold self-repair reads (updateHold), or also stop self-repair-operational.timer; and bootstrap must take an explicit sha (6a).

## Correction (2026-10-02 18:25Z, measured by deployment on pubspoke)
S2 item 1's premise was wrong: federation-transport does NOT run from the super-repo working tree. Its unit runs `bun /usr/local/share/substrate/super-repo/scripts/substrate/federation-relay/federation-transport-server.ts` from the IMAGE's baked copy (a real directory from the image build; on pubspoke dated 2026-09-30, blob = a123f648), by design ("Relay self-modification therefore requires an image rebuild — deliberate for the reachability anchor", vessels.manifest.json). Consequences: (1) a restart does NOT apply a transport change; (2) the transport is updated only by an image rebuild, which is built unjudged from dev HEAD, so the transport's real gate is item 6b (images built from the accepted sha), not S2 item 1. S2 item 1 is restated: decide whether the transport stays image-pinned (then 6b gates it) or runs from the gated accepted copy (P).

## Decision (qa + coordinator, 2026-10-02 18:30Z): transport stays image-pinned; 6b raised
- federation-transport stays image-pinned: the reachability anchor must survive a broken pull-sync or judge (it is the recovery path); running it from P's accepted/ would couple reachability to gate-runner health. S2 item 1 is withdrawn as "move the transport"; its intent moves to 6b.
- 6b (images built from the accepted sha) is RAISED to immediately after 6a, ahead of S1a: it is the single gate for everything image-borne (the gate-runner binary, the federation transport, the baked super-repo copy at /usr/local/share/substrate/super-repo that bootstrap-seeder and migrations treat as verified). Today any push that reaches an image build changes all of these unjudged.
- Image-borne canaries verify by EFFECT at the running address first: the running file's hash equals the intended commit's blob, THEN the functional check (a restart-and-check without the hash would pass on old code).
- Hub reinstall (user, container recreated 2026-10-02T20:18:07Z on :dev 90e82dc2): /workspace/.gate SURVIVED (volume-resident, recreate-safe); no re-bootstrap. Ledger: bootstrap 0a6f3d25 (17:12:27Z, HEAD-at-the-time, already recorded) then promote 90e82dc2 (19:29:45Z, normal candidate soak). accepted.sha = 90e82dc28e23. Secrets (A + mask), P and the egress fix are live on all four nodes; node 1 is excepted on image parity only.
