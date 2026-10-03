# Authority boundaries: the steward, the lane uid, and the unit-control helper

DESIGN ONLY. No code, commits or container writes were made producing this. Plan of record:
REALIGNMENT §7 integration step 4 ("settle authority boundaries before any protected
modification") and §7 step 9's acceptance ("an unauthorized operation stays refused despite
high confidence"). It folds three HIGH gaps into one design:

1. `every-vessel-process-env-carries-the-admin-and-api-key-secrets-so-lane-code-can-unlock-containment`.
   Part (A), env scoping, is built in super-repo `3ae57990` (not pushed). This document is its part (B).
2. `the-trust-root-policy-store-is-written-by-the-lane-process-itself`.
3. `secret_set`: secretset/PLAN.md, with qa's changes C1–C6.

Sources: development-vessel and local-tools-vessel at **origin/dev** (the local dev-vessel checkout
is 28 commits behind), plus read-only inspection of node 1 (`substrate-live`). Only names, modes,
counts and keys were read. No secret values were read, and no `/proc/*/environ` or env file was
opened.

---

## 0. Measured facts the design rests on

### Process and kernel facts (node 1)
- **The kernel boundary.** systemd 252 (no `PrivatePIDs`), yama `ptrace_scope=1`, git 2.39.5.
  No polkit is installed, so a non-root caller on the system bus cannot invoke systemd's
  mutating methods, but can read unit properties.
- **Every vessel runs as root.** `development-vessel`, `local-tools-vessel`, `llm-resolver-vessel`
  and `goal-host-vessel` all show:
  - no `User=`;
  - a full `CapabilityBoundingSet`;
  - `NoNewPrivileges=no`, `ProtectProc=default`, `ProcSubset=all`, `PrivateTmp=no`;
  - `ExecStart=/root/.bun/bin/bun …`.
- **bun is unreachable for any other uid.** `/root` is `0700`.
- **The systemd sockets.** `/run/systemd/private` is `srwx------ root`. `/run/dbus/system_bus_socket`
  is `srw-rw-rw-`.
- **The journal** is in `/var/log/journal` (`root:systemd-journal`, setgid, ACL).
  - The retained journal has **0** lines matching `issued self-admin key`, the line `3ae57990`
    removed from `seed-identity.ts`.
  - There are 2 boots in retention.
- **The live pool is not where the unit says.**
  - The unit has `Environment=WORKSPACE_ROOT=/workspace`, but `/etc/substrate/env` sets
    `WORKSPACE_ROOT=/workspace/git/super-repo`, and EnvironmentFile wins.
  - So the live pool is `/workspace/git/super-repo/pool/standing.json`: 4.9 MB, `root:root 0644`,
    written 15:31 today.
  - `/workspace/pool/standing.json` (9.7 MB, last written 09-07) is a **fossil**, together with a
    stale `standing.json.tmp.*` from 07-29. *Finding to file:* the unit's
    `Environment=WORKSPACE_ROOT` is a dead declaration.
- **The function-level trust-root refusal is deployed on node 1.** `TRUST_ROOT_POOL_SHAPES`
  appears 3 times in `/vessels/development-vessel/src/resolvers/pool-impulse.ts`. It stops a
  credential-less *in-process call* to `resolvePoolImpulseWrite`. It does not stop
  `fs.writeFileSync(standing.json)` from any lane code, because the file is `root 0644` and the
  lane is root.
- **Part (A) is not live.** The node-1 dev-vessel unit still loads `/workspace/.substrate-secrets`.
  This design **assumes (A) is landed and deployed first** (slice S0).
- **Discovery identity is advisory.** The registration signature is "recorded, never enforced"
  (discovery-vessel `types.ts:121`, `registry.ts:158`), so any process holding the fleet key can
  register a producer under any vessel id.
- **Where the lane vessels run.** `standalone` (role `full`), `hub` (the `autonomy` role lists
  development-vessel and local-tools-vessel explicitly) and `compute`/`compute_node`. On node 2
  (`compose2-live`) and `pubspoke-live`, `development-vessel` and `local-tools-vessel` are active
  and `identity-vessel` is inactive.

### Units that run model-directed tools (the "lane"), with evidence
| Unit | What runs model- or impulse-controlled | Evidence (origin/dev) |
|---|---|---|
| **local-tools-vessel** :8230 | `bash -c <pointer.command>` with `cwd` from the pointer; `bounded_shell`; `code_verify_typecheck` joins `bun_cmd`/`script` into a shell string; `fs_write`/`fs_edit`/`code_*` write model-chosen paths | `src/index.ts:202,239,266-273,446,696-701,325,366,375,619-690` |
| **development-vessel** :8090 | `http_fetch(pointer.url)`, which adds `METABOB_API_KEY` for localhost; in-process `fs_write`/`fs_edit` (`fs-edit.ts:36` has no containment); `apply_proposal_as_patch` writes model-drafted content; feature_compose/patch_with_tools route shell to local-tools; **autonomously landed code runs here** | `http-fetch.ts:36-60,96`, `fs-write.ts:54-101`, `apply-proposal-as-patch.ts:1063`, `feature-compose.ts:197,241,572,2521,3166` |
| llm-resolver-vessel :8220 | runs a tool loop but **executes nothing itself**: it dispatches to discovery-resolved producers, with a caller-set fallback endpoint | `src/index.ts:475,480-551,742,873` |
| goal-host-vessel :8210 | chooses tool arguments (`llmExtractPointerArgs` `:7834`) and executes on local-tools; its own spawns are fixed git/grep | `index.ts:13000-13020`, `floor-tools.ts:15-30` |

Lane uids are therefore needed for **development-vessel** (+ `development-vessel-seed`) and
**local-tools-vessel**. llm-resolver and goal-host direct tools but do not execute them.
They are covered by the fleet-wide confine step (S5), not by a lane uid.
`ias-executor-ts` has an unscrubbed `bash` resolver (`adapters/bun-process.ts:13`) but no unit;
it must not get one without joining the lane uid.

---

## (a) The steward unit

### Why a separate unit, and why not root
The trust root is the policy that decides what the lane may do (`autonomyScope`), what it may
spend (`spendEnvelope`), and whose policy is accepted (`substrateNodes`). It cannot be held by a
process that runs lane code, whatever checks that code contains, because lane code can be
replaced by a landing. The steward:
- holds the trust-root records;
- serves them read-only to anyone;
- accepts writes only with an operator credential **it validates itself**;
- signs every record it stores;
- never holds a secret value.

It is a small Bun service. Its code lives under `scripts/substrate/steward/`, inside the
autonomyScope-excluded `scripts/substrate/`. It is installed to
`/usr/local/libexec/substrate/steward/` by the image and by pull-sync **from the git object**
(see S2), never from a working tree.

- **uid:** a static system user `substrate-steward` (not DynamicUser, because it owns a
  persistent store on the volume).
- **Unit:** `secret-steward.service`.
  - `HOST=127.0.0.1`, `PORT=8095`.
  - `ProtectSystem=strict`, `ReadWritePaths=/workspace/steward`.
  - `ProtectProc=invisible`, `ProcSubset=pid`, `NoNewPrivileges=yes`, `CapabilityBoundingSet=` (empty).
  - `PrivateTmp=yes`, `RestrictSUIDSGID=yes`.
  - `InaccessiblePaths=` both systemd sockets, `/etc/substrate/env.d`, `/etc/substrate/admin.env`
    and the secret stores.
  - `Before=development-vessel.service local-tools-vessel.service boredom-vessel.service`.
    This is safety, not convenience: the policy readers fail CLOSED when unreadable
    (`autonomyScope` → closed, `spendEnvelope` → `allow:false`; `gap-to-feature.ts:5336,5425-5459`).
  - It runs on every profile that runs development-vessel: standalone, hub, compute, node 2 and
    pubspoke. The trust root lives with the pool it governs (law 11).
- **Owns these paths** (on the volume, so they survive reboots and upgrades):
  - `/workspace/steward/` — `substrate-steward:substrate-steward 0755`.
  - `/workspace/steward/trust-root.json` — `0644`. It is policy, not secret, and must be readable
    by every policy reader.
  - `/workspace/steward/signing.key` — `0600`, an ed25519 private key minted on first start.
  - `/workspace/steward/signing.pub` — `0644`. Readers verify against it.
  - `/workspace/steward/audit.jsonl` — `0644`. Who, shape, id, sha12 of the body before and after,
    outcome. Never a credential.
  - `/workspace/steward/secret-status.json` — `0644`, **written by the host CLI, not by the
    steward**. It holds name, consumers, the sha12 of the live and retained versions, and
    timestamps. It never holds a value.
- **Does not own:** `/workspace/.substrate-secrets{,.d}`, `/etc/substrate/env.d/*`,
  `/etc/substrate/admin.env`. Those stay `root 0600` and are written only by gen-env /
  `render-secret-scope.sh` and the host-run `secret_set` CLI (C1). A value-blind steward cannot
  leak a value, and it has no reason to be able to read one.

### Interfaces (minimal, value-blind; no generic exec, no "run as root")
| Shape | Who | Semantics |
|---|---|---|
| `trustRootPolicy` (read) | anyone with a fleet key | Returns `{id, shape, body, updated_at, authority, steward_sig}` for `substrateNodes`/`autonomyScope`/`spendEnvelope` (plus `jointBinding`/`humanAskRoute` if the operator rules them trust-root, below). |
| `trustRootPolicy_write` | **operator only** | Requires `Authorization: ApiKey …`, which the steward checks itself against identity `/v1/auth/resolve` (the same contract as `pool-impulse.ts:98`) at the **bootstrap-pinned** `IDENTITY_VESSEL_URL`, never a discovery-resolved one, requiring the `admin` scope. Requires **compare-and-set**: `if_updated_at` for an existing id, `if_absent:true` for a new one. On success: signs, writes atomically (temp + rename + fsync), appends audit, emits an execution trace. A refusal carries an error code and reason, never the presented key. |
| `secret_status` (read) | anyone | Serves `secret-status.json`: names, sha12, versions and times. Satisfies C2. |
| `secretRotationProposal` | lane-writable, authority-free | **Not a steward write.** It is an ordinary lane-pool record ("rotate NAME because …") that a human acts on through the host CLI. A proposal confers nothing, so it needs no trust root. |

**`secret_set` phase 1 is the host-run CLI (C1)**, run with `docker exec -i <c> substrate-secret
{stage|set|rollback|status}` as container root. It is outside every vessel's reach:
- the value arrives on stdin, never argv;
- C3: the push-permission validator, and the per-name validator in a scrubbed env with the value
  passed on an fd;
- compare-and-set on sha12;
- C5: versioned with `keep` N, revocable;
- C6: per-node rotation, atomic render through `render-secret-scope.sh`, restart of only the
  manifest consumers;
- C4: a **required** post-apply check that the consumer's env sha12 matches, read by the CLI as
  root from the consumer's environ and *compared, never printed*.

After each apply it rewrites `secret-status.json`. No HTTP path can set a secret in phase 1.
A later phase may let the steward accept an operator-approved `secret_set` **request**, but the
apply always stays in the root CLI.

**Future authority (§7 step 9).** Each record carries `authority: "operator" | "criterion:<name>"`.
Phase 1 accepts only `operator`. Later, a named criterion evaluator, with its own identity and a
narrower scope, may write records in the *earned-modification* and *temporary-restriction*
categories, never in the *human-governed* category. The steward enforces this per category,
which is where "a weakened evaluator cannot certify its own promotion" gets a writer that
refuses it.

### The standing.json split, measured (node 1, live file, 10-02 ~15:35Z)
| shape | rows (open) | writer(s) | reader(s) | disposition |
|---|---|---|---|---|
| `boredomSelectionSnapshot` | 2921 (2921) | boredom-vessel over HTTP `poolImpulse_write` (`index.ts:96` family) | goal-host `index.ts:310` | **stays** in the lane pool |
| `substrateGap` | 2013 (954) | `substrate-gap.ts:1760` (gap mirror) | `gap-drain-observer.ts:286` (all open) | stays |
| *(empty shape)* | 16 (16) | unknown: written without `shape` (`body` is null for 13 rows, one has id `"string"` and one has body key `if_updated_at`, a pointer passed as body) | none | stays; **finding**: a malformed writer. Refuse `shape:''` on write. |
| `timeShapedRhythm` | 12 | `rhythm-conductor-tick.ts:391`, `rhythm-reality-sync.ts:131,153,180`, boredom `index.ts:96`, the seed tick, and operator rows (`operator-hold`, `operator-rebaseline-*`) | boredom `index.ts:78,2552`, conductor `:270`, reality-sync `:46,75` | stays: the conductor writes alpha/beta into the same rows. The *operator holds* inside it are authority-like; §7 step 9 re-expresses holds as a C20 TTL quarantine shape, which would be a steward category later. |
| `rhythmFamilyGoal` | 3 | rhythm-seed-tick | conductor `:474` | stays |
| `jointBinding` | 5 | operator only (`operator:claude-avi`); **no in-process writer** | `scripts/substrate/joint-liveness-tick.ts:115` | **operator decision: proposed trust-root.** Its body carries `sql` and `reader` and *is* the joint-liveness evaluator's expectation set. §2.1 item 6 makes evaluator paths human-governed, so a lane that rewrites the `sql` can make the evaluator pass. |
| `humanAskRoute` | 1 | operator only | `ui-write-passthrough.ts:72` | **operator decision: proposed trust-root.** It routes escalations to humans (cf. the 248 escalations to an unread vessel), so a lane able to rewrite it can silence its own escalations. |
| `substrateNodes` | 1 | operator; seed | `gap-to-feature.ts:5208-5236` via `readNewestPoolRecord` (HTTP, own producers) | **moves** |
| `autonomyScope` | 1 | operator; `bootstrap-seeder.ts:101` | `gap-to-feature.ts:840,2114,5417-5461`; `feature-compose.ts:6954`; `gap-lifecycle-scan.ts:813`; `self-fact-reconcile.ts:330` (all through `autonomyScope()`, HTTP) | **moves** |
| `spendEnvelope` | 1 | operator; `bootstrap-seeder.ts:102` | `gap-to-feature.ts:5327,5390`; `feature-compose.ts:4154`; `apply-proposal-as-patch.ts:1386`; `rhythm-conductor-tick.ts:313`; boredom `index.ts:4215` (HTTP) | **moves** |

**Readers that touch the file in-process today:**
- `self-fact-reconcile.ts:380`, `pool_record_pin` (`resolvePoolImpulse` directly). This is the
  fact that pins *the policy copy the policy readers trust*.
- `gap-drain-observer.ts:286` (all open records).

Both move to the shape route (`readNewestPoolRecord` / `trustRootPolicy`). No trust-root reader
may open `standing.json` after S1b.

### How existing readers keep working (compatibility, then hardening)
- **S1b compatibility shim.**
  - development-vessel's `resolvePoolImpulse`, when the asked `shape` is a trust-root shape,
    answers from `/workspace/steward/trust-root.json`, which is read-only in its namespace. It
    **filters every trust-root shape out of the lane file** on read, so a raw `writeFileSync` of
    `{shape:"autonomyScope"}` into `standing.json` is never served.
  - `poolImpulse_write` for a trust-root shape is *forwarded* to the steward with the caller's
    `Authorization` header unchanged (the `impulses.ts:1117-1126` branch). The steward re-validates,
    so dev-vessel's own check stops being load-bearing.
    - **Contract change for operators:** compare-and-set becomes mandatory on these writes. A
      cockpit `resolve_impulse poolImpulse_write` without `if_updated_at` (or without
      `if_absent:true` for a new record) is refused with `current_updated_at`, the same shape as
      the existing CAS conflict. The operator re-reads and resends.
  - Result: boredom, gap-to-feature, ui-write-passthrough, joint-liveness and the cockpit's
    `resolve_impulse poolImpulse_write` all work unchanged.
- **The residual this leaves open, until S4.** `readNewestPoolRecord` takes the newest
  `updated_at` across *own* producers, and discovery registration is unauthenticated per vessel
  id. A lane process could therefore register a second `poolImpulse` producer serving a forged,
  newer `autonomyScope`.
- **S4 closes it with signatures.** Every trust-root record carries `steward_sig`: ed25519 over
  the canonical JSON of `{id, shape, body, updated_at, authority}`. Readers verify against
  `/workspace/steward/signing.pub` (read-only). A record that fails verification is
  **unreadable**, so the read fails closed. This also makes the transport irrelevant: a relayed
  or federated copy verifies or it doesn't.
  - Phase-in: observe first (log `[policy-read] … sig=ok|bad|absent`), then enforce once two
    consecutive days show `ok` on every node.

---

## (b) The lane uids, and the narrow privileged helper

### Uids
- **`substrate-lane`** for `development-vessel` and `development-vessel-seed`. It holds the push PAT.
- **`substrate-tools`** for `local-tools-vessel`. It runs arbitrary model-directed shell.
- Both are in the shared group **`substrate-lanerw`**, used for the trees they both write.

These are two uids, not the one `3ae57990`'s draft proposed. Under `ProtectProc=invisible`, a
model-directed shell must not be able to see or ptrace the process holding the PAT. With one uid,
the two units could read each other's `/proc/<pid>/environ` and `/proc/<pid>/root`.

### Every permission they need today, with evidence

**Filesystem writes.** These become `ReadWritePaths=` under `ProtectSystem=strict`. There is no
blanket `/workspace`.
| Root | Evidence (dev-vessel unless stated) | Grant |
|---|---|---|
| `WORKSPACE_ROOT` data dirs: `pool/`, `gaps/`, `memory/`, `compose-slots/`, `leases/`, `state/`, `interactor-log/`, `refusals/`, `validation/`, `substrate-heartbeat.json`, `mitosis-pending.json`, `mitosis-applied*.jsonl` | `pool-impulse.ts:32-37`; `substrate-gap.ts:392-399`; `gap-lifecycle-scan.ts:454,894`; `memory-note.ts:88-91`; `compose-slots.ts:30,258,348`; `maintenance-lease.ts:102-112`; `learning-mode.ts:79`; `interactor-passthrough.ts:110`; `intervention-evaluate.ts:222`; `substrate-health-tick.ts:441`; `patch-with-tools.ts:1603`; `vessel-mitosis-cutover.ts:3265,3344`; `failure-mode-matrix-score.ts:160-166`; `gap-to-scenario-bridge.ts:165` | per-dir RW, group `substrate-lanerw`, setgid plus default ACL `g:substrate-lanerw:rw`. **Mixed writers:** root units (gap-store-census, boredom via HTTP) also write `gaps/` and `pool/`, and a root-created `0644` file would lock the lane out. Default ACLs make new files group-writable regardless of the writer's umask. |
| Hardcoded `/workspace/*`: `proposals{,/.applied,/.rejected}`, `observations`, `patterns`, `snapshots`, `locality`, `vault-render`, `post-land-baseline`, `quiesce`, `restart-requests`, `authoring-inflight`, `state`, `validation`, `.oom-detector`, plus the files `push-policy.json`, `doc-fix-policy.json`, `gap-class-posteriors.json`, `close-oracle-calibration.json`, `expectation-calibration.json`, `obsidian-intake-deferrals.jsonl` | `apply-proposal-as-patch.ts:492,827,1356`; `feature-compose.ts:3723,7813`; `failure-credit-observer.ts:42`; `trace-recurring-pattern-scan.ts:37`; `surrealdb-export.ts:81`; `code-locality-mining-tick.ts:44`; `obsidian-reflect.ts:22`; `vessel-mitosis-cutover.ts:2893-2894,3140`; `self-interference-scan.ts:140-177`; `vessel-arrival-scan.ts:53-54`; `service-oom-cascade-scan.ts:94`; `push-policy.ts:32`; `doc-fix-policy.ts:4`; `gap-to-feature.ts:4197,4291`; `substrate-gap.ts:48`; `obsidian-request-scan.ts:277` | per path. **Finding:** `push-policy.json` and `doc-fix-policy.json` are policy files written by the lane. Classify them, same question as `jointBinding`. |
| `/workspace/keys/development-vessel.ed25519.pem` | `discovery-registration.ts:17,30` (it is `0644` today: world-readable private key, a finding) | owned by `substrate-lane`, `0600` |
| `/workspace/git/vessels/<v>` push clones | `pull-cutover.ts:195-222`; `vessel-mitosis-cutover.ts:317,2487` | group RW. **Except** the trust-root vessels' clones (see S2). |
| `/workspace/git/compose`, `/tmp/fc-*` worktrees (created by local-tools' shell for dev-vessel) | `compose-workspace.ts:38-132`; `feature-compose.ts:6216,6439,6995` | group RW. **`PrivateTmp=no` is required** while dev-vessel and local-tools share `/tmp/fc-*`; or move them to `/workspace/tmp/fc` and use `PrivateTmp=yes`. |
| `/vessels/<v>` runtime (mitosis staging, cutover renames, live source overwrite) | `vessel-mitosis-start.ts:88-98,394,408`; `vessel-mitosis-cutover.ts:1774,1794`; `prune-stale-mitosis.ts:81`; `patch-with-tools.ts:629,699-734`; `vessel-mitosis-evaluate.ts:607` | group RW on `/vessels`, **except** `/vessels/{identity-vessel,discovery-vessel,federation-transport-vessel}`, which stay root-owned and are `ReadOnlyPaths` (see S2). |
| `/workspace/active-scripts` | `activate-substrate-script.ts:46,182` | **denied.** About 19 root units execute `/workspace/active-scripts/*.ts` (for example `db-maintenance.service`, `self-development-trend.service`, the `*.service.d/run-dir.conf` drop-ins). A lane write there is root code execution. Activation becomes a helper verb that copies the **git-object** blob `origin/dev:scripts/substrate/<name>.ts`. |
| `/var/tmp/solicited_gaps.log` | `gap-to-feature.ts:1623,1653` | RW, or move under the workspace |
| bun cache, HOME | `bun install`, `bun run typecheck` (`feature-compose.ts:5503`, `gap-to-feature.ts:2055`, `pull-cutover.ts:143`) | `StateDirectory=substrate-lane` (`HOME`), `CacheDirectory=substrate-lane` (`BUN_INSTALL_CACHE_DIR`) |
| caller-supplied absolute paths: `unit_dir`, `log_path`, `queue_path`, `out_path`, `output_dir`, `mitosis_root`, `target_path`, `proposals_dir`, `pending_path`, `pending_pointer_path`, `applied_log_path`, `host_repo_root` | `vessel-mitosis-cutover.ts:1725-1726,1844,1848`; `residual-shape-discovery.ts:452`; `boredom-enqueue.ts:45`; `rhythm-conductor-tick.ts:84,459`; `failure-mode-matrix-score.ts:156`; `surrealdb-export.ts:81`; `vessel-mitosis-start.ts:342,386`; `apply-proposal-as-patch.ts:492` | No grant. They become DAC- and namespace-contained, so `unit_dir=/etc/systemd/system` gets EROFS. |

**bun binary.** Every hardcoded `/root/.bun/bin/bun` must become `/usr/local/bin/bun`, installed
by the image as a real copy, not a link into `/root`:
- the unit `ExecStart=` lines;
- `vessel-mitosis-evaluate.ts:259,263,1472`;
- `patch-with-tools.ts:219`;
- `vessel-mitosis-start.ts:428` (it emits unit text);
- local-tools `agent-shell-env.ts` (PATH);
- pull-sync `run_suite` (`HOME=/root`).

**Ports.** `8090` (`index.ts:221`), `8230`, and an ephemeral loopback port
(`self-fact-reconcile.ts:219`) are all ≥1024, so neither unit needs `CAP_NET_BIND_SERVICE`.

**Signals.** The units SIGKILL only their own spawned process groups (`process-group.ts:63`,
`self-fact-reconcile.ts:356`). The liveness probes `kill(pid,0)` on PIDs read from marker files
(`compose-slots.ts:150`, `obsidian-request-scan.ts:138`, `self-interference-scan.ts:154,172`)
will get **EPERM** against other-uid PIDs. That must read as *alive/unknown*, never as *dead*.
This is a code change in S3, and a test.

**No chown, chmod or setuid** anywhere in development-vessel. That is the evidence for an empty
capability set.

**/proc and /sys.** The units read `/proc/loadavg` (`compute-state-signature.ts:61`,
`rhythm-conductor-tick.ts:197`), `/proc/meminfo` (`compute-state-signature.ts:73`) and
`/proc/cpuinfo` (`system-load-report.ts:64`), and cgroup files (`system-load-report.ts:124-139`).
**`ProcSubset=pid` would hide all three `/proc` files**, so development-vessel gets
`ProtectProc=invisible` *without* `ProcSubset=pid`. `ProcSubset=pid` is applied only after those
reads move to a load-report shape served by a non-lane unit; that is a separate gap, not this
design. local-tools gets `ProcSubset=pid`.

**Journal.** journalctl reads at `systemd-unit-health-observer.ts:110`,
`composer-interruption-sweep.ts:84`, `prior-seed-efficacy-scan.ts:38`,
`vessel-write-error-scan.ts:66` and `self-fact-reconcile.ts:355` need
`SupplementaryGroups=systemd-journal` (lane only, not tools). That group reads **every** unit's
journal, so it is granted only after:
1. a per-node count shows 0 retained lines matching `issued self-admin key` and
   `ghp_|github_pat_|sk-ant-|sk-or-`. Counts only; node 1 = 0 and 0 on 10-02;
2. `SUBSTRATE_ADMIN_KEY` is rotated through `secret_set` once.

**Credentials.**
- `SUBSTRATE_GIT_PAT` arrives in dev-vessel's scoped env file (PID 1 reads it before dropping
  privileges). Consumers: `push-health-observer.ts:95-115` (inline helper),
  `vessel-mitosis-cutover.ts:302-307` (the credential helper in-process).
- `GITHUB_TOKEN` is used by `gh-pr-*.ts`.
- local-tools gets **no** PAT.
- `env-gate-scan.ts:39,48,69` reads `/etc/substrate/env` **for variable names**. After S1c it is
  denied, so it must read a names-only manifest instead (`secrets-manifest.json` plus a rendered
  names list).

### systemd use: inventory of every call site, the verbs needed, and the helper
| Call site (dev-vessel unless stated) | Verb |
|---|---|
| `attempt-checks.ts:64` | `show <v>.service -p LoadState` |
| `gap-to-feature.ts:3767,3768,3800` | `is-active <v>`; `show <v> -p ActiveEnterTimestamp` |
| `self-fact-reconcile.ts:126` | `show <unit> -p WorkingDirectory` |
| `self-fact-reconcile.ts:189,515-519` | `is-active <unit>[.timer]`; `show <unit> -p ExecMainStartTimestamp` |
| `substrate-health-tick.ts:70` | `is-active <v>.service` |
| `systemd-unit-health-observer.ts:57-58` | `show <unit> -p ActiveState -p ActiveEnterTimestamp …` |
| `systemd-unit-health-observer.ts:91` | `list-timers --all` |
| `service-oom-cascade-scan.ts:145` | `show <unit> -p …` (OOM and restart properties) |
| `vessel-mitosis-cutover.ts:32,2811` | `list-units 'mitosis-self-restart-*'` / `<tsUnit>.timer` |
| `substrate-gap.ts:1655,1722` | `start --no-block gap-compose.service` |
| `systemd-restart.ts:17,42` | `restart <unit>`; `is-active <unit>` |
| `pull-cutover.ts:149,212,224` | `restart <unit>` |
| `pull-cutover.ts:96`; `vessel-mitosis-cutover.ts:2948,2988-3011` | `systemd-run --on-active=Ns … systemctl restart <unit>` (deferred self-restart; the 2948 form wraps `/bin/sh -c` with curl/mkdir/printf) |
| `perf-canary-resolve.ts:186,210` (through the local-tools shell) | `restart <unit>` |
| `seed/index.ts:42` | `systemctl --user restart` (no user manager in the container; dead) |
| `vessel-mitosis-cutover.ts:1758-1878` (promote path) | `stop`, `disable`, `daemon-reload`, `start`, plus **writing unit files into a caller-supplied `unit_dir`** |

**The helper: `substrate-unit-ctl`.**
- It is a socket-activated **root** unit on `/run/substrate/unit-ctl.sock` (`0660`, group
  `substrate-lanerw`), with `Accept=no`.
- Code: `scripts/substrate/unit-ctl/`, installed from the git object.
- **Peer check:** `SO_PEERCRED`.
  - Before S3, while the lane is still root, the peer pid's `/proc/<pid>/cgroup` must be
    `development-vessel.service` or `local-tools-vessel.service`.
  - After S3, the uid must be `substrate-lane` or `substrate-tools`.
- **Request:** one JSON line `{verb, unit, props?, delay_s?}`. The arguments are validated and
  passed to `systemctl` as an argv array. There is no shell.

The verb allowlist is exactly the inventory:
- **reads:**
  - `is-active <unit>`;
  - `show <unit> -p` limited to `{LoadState, ActiveState, SubState, ActiveEnterTimestamp,
    ExecMainStartTimestamp, WorkingDirectory, NRestarts, Result, MemoryCurrent, MemoryPeak,
    OOMPolicy}`;
  - `list-units <glob ∈ {mitosis-self-restart-*}>`;
  - `list-timers`.
- **mutations:**
  - `restart <unit>` and `restart-after <1..600> <unit>` for units in `vessels.inventory.json`,
    **excluding** `secret-steward`, `substrate-unit-ctl`, `identity-vessel`, `surrealdb` and
    `substrate-pull-sync`;
  - `start-no-block gap-compose.service`;
  - `activate-script <name>`, which copies the blob `origin/dev:scripts/substrate/<name>.ts`
    using git with `-c core.hooksPath=/dev/null -c core.fsmonitor=false` and the repo's
    `.git/config` read-only to the lane (S1c).

Refused: `set-property`, `edit`, `daemon-reload`, `enable`, `disable`, `stop` of anything outside
the inventory, `systemd-run`, any `--property`, and any unit not listed. Every call is traced
`{verb, unit, peer, outcome}`.

**Restart-after** replaces both `systemd-run` call sites. The helper itself runs
`systemd-run --on-active=<n> --unit=mitosis-self-restart-<unit> --collect systemctl restart <unit>`,
with fixed argv. The `/bin/sh -c` curl/mkdir/printf wrapper at `vessel-mitosis-cutover.ts:2948`
becomes the helper writing the same `restart-requests` breadcrumb. Its content is fixed, so it is
not a passthrough.

**The mitosis promote path** (`vessel-mitosis-cutover.ts:1725-1878`) gets **no helper verb**. It
writes unit files to a caller-supplied directory and runs `daemon-reload`. Node 1 has 0
`mitosis-*` units, 0 `/vessels/*mitosis*` dirs and 0 matching journal lines in retention. File
it as a gap ("the promote path needs a deploy-side owner") and do not absorb it: after S1c it
fails with EROFS/EACCES and that failure is reported.

### Hardening properties per unit (end state after S3)
| Property | development-vessel | local-tools-vessel | why |
|---|---|---|---|
| `User=` / `Group=` | `substrate-lane` / `substrate-lane` + `SupplementaryGroups=substrate-lanerw systemd-journal` | `substrate-tools` / `substrate-tools` + `substrate-lanerw` | distinct uids, so ProtectProc separates them |
| `ProtectProc=` | `invisible` | `invisible` | binds across uids: other units' `/proc/<pid>/{environ,root,mem}` disappear |
| `ProcSubset=` | `all` (evidence above) | `pid` | |
| `NoNewPrivileges=` | `yes` | `yes` | no setuid escape back to root |
| `CapabilityBoundingSet=` | empty | empty | no cap is exercised (no chown/chmod/setuid, no port <1024, signals only to own children) |
| `RestrictSUIDSGID=`, `LockPersonality=`, `RestrictNamespaces=`, `ProtectKernelTunables/Modules/Logs=`, `ProtectControlGroups=`, `PrivateDevices=` | yes | yes | |
| `ProtectSystem=` | `strict` + the ReadWritePaths above | `strict` + its tool roots | |
| `ReadOnlyPaths=` | `/workspace/steward`; `/workspace/active-scripts`; `/workspace/git/super-repo/scripts`; `/workspace/git/super-repo/.git/config` (a single-file bind; systemd path settings take no globs, so the per-clone `.git/config` files are handled by S2's mechanism, not here); `/vessels/identity-vessel`, `/vessels/discovery-vessel`, `/vessels/federation-transport-vessel` | same | see S1c and S2 |
| `InaccessiblePaths=` | `/run/systemd/private`; `/run/dbus/system_bus_socket`; `/etc/substrate/env.d`; `/etc/substrate/admin.env`; `/workspace/.substrate-secrets{,.d}`; `/workspace/steward/signing.key` | same, plus `/etc/substrate` (already present) | E1, and the secret files |
| `ExecStartPre=` | root-requiring steps keep the `+` prefix (the pool-policy step `3ae57990` mentions; today's pre-step is `/usr/bin/timeout …`, ignore-errors). Any `+` step must take no lane-writable input. | | |

**D-Bus after S3.** With no polkit, a non-root caller cannot mutate units over D-Bus, so the
system bus *could* be reopened for reads. It is kept inaccessible anyway: one path for both reads
and writes (the helper), so there is one place to audit.

---

## (c) Migration and upgrade path

### Volumes
Nothing is deleted.
- **Who does the migration.** Migration and seeding are **modes of the steward itself**,
  running as the steward uid, because only the steward holds the signing key. The key is minted
  on first start.
  - *Changed on review:* an earlier draft had root bootstrap scripts writing signed records,
    which they cannot do.
- **When `trust-root.json` is absent at start:**
  1. *Migrate.* The steward reads the newest open `substrateNodes`/`autonomyScope`/`spendEnvelope`
     rows from the live pool file. The pool path is passed read-only in its unit as
     `ReadOnlyPaths`, plus a bind of the one file.
  2. **Verify before signing.** Today's pool file is lane-writable, so a forged newer row could
     already be sitting in it. Each migrated body is compared against the committed
     `scripts/substrate/autonomy-scope.json`, read from the image copy at
     `/usr/local/share/substrate/super-repo/…`, the same source `bootstrap-seeder.ts:61` uses.
     - A body that differs is staged **unsigned** with
       `{sha12, excluded_paths count, require_falsifier_classes, cap}`, and printed for operator
       confirmation. `substrate-steward confirm <sha12>`, run from the host CLI, signs it.
     - Until then, readers see it as unreadable, which fails closed.
     - `substrateNodes` (not in the committed file) always takes the confirm step.
  3. Writes are stamped `authority:"operator"` and `migrated_from:<sha12 of the row>`.
- **Fresh volumes.** The steward seeds itself from the image's `autonomy-scope.json`, verified by
  construction. `bootstrap-seeder.ts:101-102` stops writing trust-root rows into the pool
  (bootstrap tier, stated).
- The originals stay in `standing.json` until S1d, so rollback is a drop-in revert.
- **The node-1 fossil** `/workspace/pool/standing.json`: the migration ignores it and logs that it
  exists. It is filed as a finding; it is not deleted by this work.

### Ownership change (S3 only)
A `+` ExecStartPre on dev-vessel runs `substrate-lane-perms`, an idempotent root script with no
lane-writable input. It:
- creates the users and groups (`systemd-sysusers` drop-in shipped by the image);
- runs `chgrp -R substrate-lanerw` and setgid plus default ACLs on the RW roots in (b);
- runs `chown substrate-lane` on the key file;
- leaves the trust-root vessels' `/vessels` dirs and clones `root`.

It reports counts. It never follows symlinks out of the roots (`-P`).

### Order across nodes (canary)
**node 1 → node 2 (`compose2-live`) → pubspoke → hub.** Each slice soaks ≥24h on a node with its
acceptance replays green before the next node gets it. The hub goes last because its
development-vessel serves the network's policy reads.
- **Spokes without identity** (node 2 and pubspoke show `identity-vessel` inactive): the steward
  validates admin against an identity endpoint **pinned at bootstrap** (`IDENTITY_VESSEL_URL`,
  the same pin `pool-impulse.ts:98` uses; identity is a law-1 bootstrap carve-out). On a spoke
  that pin is the hub's identity.
  - *Changed on review:* an earlier draft resolved identity by shape through discovery. Discovery
    identity is advisory (§0), so a lane-registered fake identity producer answering `admin:true`
    would pass row 9 for the wrong reason.
  - A later hardening step verifies identity responses against a pinned identity public key.
- **Partition behaviour:** if the hub is unreachable, writes fail closed (operator locked out,
  never an outside write). Reads keep serving the local signed file.

### Restart plan
pull-sync converges unit files and runs `daemon-reload`, but **never restarts a unit because its
file changed**. The gap for that is filed. So every slice that changes a unit carries an explicit
restart step:
1. Pre-check:
   - `goal_status` shows no running dispatch on the lane;
   - the `maintenance-lease` is free;
   - `CUTOVER_LEASE_WAIT_MS` is honoured;
   - there is a volume backup of `/workspace/git/super-repo/{pool,gaps,memory}` and
     `/workspace/steward`.
2. Install the units and run `daemon-reload` (pull-sync or `vessel-ctl`).
3. Run `systemctl restart secret-steward` (for S1b and later), then `substrate-unit-ctl.socket`,
   then `development-vessel`, then `local-tools-vessel`, from **outside the lane**:
   `docker exec <c> vessel-ctl restart …`. The lane must not restart itself into a new sandbox
   through the old one.
4. Verify that `systemctl show <unit> -p User -p CapabilityBoundingSet -p ProtectProc
   -p InaccessiblePaths` matches the slice. Do not accept "active" as the check.
5. Run the slice's must-fail replays (d).

### Rollback
Every slice is a removable drop-in or an additive unit:
- Remove `/usr/lib/systemd/system/<unit>.service.d/50-authority-*.conf`, run `daemon-reload`,
  restart.
- **S1b:** the shim reads the steward file. Reverting it re-reads the untouched pool rows.
- **S3:** the files keep group ACLs, which root ignores, so nothing needs reverting.
- **S4** (signatures) reverts to observe-only.

The rollback is itself replayed once on node 1 before node 2 gets the slice.

### Interaction with pull-sync
Slices S1c and S2 change what pull-sync may do: install units **from git objects**, and run
`bun test` and git in lane trees as the lane uid. pull-sync itself stays root and unsandboxed.
It must therefore never *execute* or *source* a byte the lane can write. That is S2's
invariant, tested.

---

## (d) Acceptance: must-fail replays, run by effect, error codes only

**The probe lives in the real context.** The probe is a **fixed-list resolver compiled into
development-vessel** (`authority_probe`, no arguments). The same probe ships in local-tools as
`authority_probe` (fixed, no command argument). It runs inside the unit's own process: same
uid, same capabilities, same mount namespace. It returns only `{probe, errno, ok}`.
- An `nsenter` or `docker exec` probe carries root's full capabilities and would false-pass E2,
  so it is not acceptable.
- **The positive control** is the identical probe binary run once as
  `systemd-run --wait --uid=0 --pipe` from the host (container root, full capabilities, PID 1's
  namespace) through the same paths. If the control cannot do what the must-fail row refuses,
  the row is uninformative.
- The probe set is registered as §2.1 evaluator rows. Each row has its must-fail control, and the
  rows sit under the steward's *human-governed* category.

| # | From the lane unit (expected) | Positive control (expected) | Closes |
|---|---|---|---|
| 1 | `open("/workspace/steward/trust-root.json", O_WRONLY)` → **EROFS** (S1c) / **EACCES** (S3) | root control → ok | in-process trust-root write |
| 2 | `rename(tmp, trust-root.json)` from a sibling file → **EROFS/EXDEV** | ok | atomic-rename variant |
| 3 | `poolImpulse_write {shape:"autonomyScope"}` straight into `standing.json` with `writeFileSync`, then `resolvePoolImpulse({shape:"autonomyScope"})` → returns the **steward** record (sha12 equal to the steward's) | n/a | lane-file forgery is not served |
| 4 | `open("/proc/<identity MainPID>/environ")` → **EACCES/ENOENT** (S3; ProtectProc) | ok (root control reads it but only `stat`s it; the content is never read) | secret reach across units |
| 5 | `open("/proc/1/root/workspace/steward/trust-root.json", O_WRONLY)` and `/proc/<steward pid>/root/…` → **EACCES** (S1c; cap subset rule) | ok | E2. *Discriminates only against full-cap targets: a target whose capability set is no larger than the lane's passes the ptrace check, and S3's distinct uids are what close that case.* |
| 6 | `connect("/run/systemd/private")`, `connect("/run/dbus/system_bus_socket")` → **ENOENT/EACCES**; `systemd-run --wait true` → non-zero; `systemctl set-property development-vessel CPUQuota=1%` → non-zero | `systemd-run --wait true` → 0 | E1 |
| 7 | helper `restart local-tools-vessel` → ok; helper `set-property …` / `restart secret-steward` / `restart foo.service` → **refused** | | narrow helper (positive and negative) |
| 8 | `open("/etc/substrate/admin.env")`, `open("/etc/substrate/env.d/identity-vessel.env")`, `open("/workspace/.substrate-secrets")` → **ENOENT/EACCES** | `stat` ok | secret files |
| 9 | `trustRootPolicy_write` with the **lane's own fleet key** (`http_fetch` to the steward, the SSRF path at `http-fetch.ts:40-60`) at **maximal confidence** (a body claiming `authority:"criterion:x"`, `confidence:1.0`, and a citation) → **403** `operator_credential_required`; record sha12 unchanged | the same write with the operator admin key → 200, sha12 changed, audit row present | §7 step 9 "stays refused despite high confidence" |
| 10 | write to `/workspace/git/super-repo/scripts/substrate/units/development-vessel.service`, to the super-repo `.git/config`, to `/usr/lib/systemd/system/development-vessel.service.d/x.conf`, to `/etc/systemd/system/x.service`, to `/run/systemd/system/x.service`, and to the unit-ctl and steward code under `/usr/local/libexec/substrate/` → **EROFS** | ok | E3 (the sandbox and its helpers defined in lane-writable files) |
| 11 | write to `/workspace/active-scripts/x.ts` → **EROFS** | ok | E3 (root executes lane-written scripts) |
| 12 | after S2: a lane-planted test file that calls `process.getuid()` and `open("/workspace/steward/signing.key")` during pull-sync's `run_suite` records `uid≠0` and `EACCES` | | E3 (root runs lane tests) |
| 13 | after S4: a forged unsigned `autonomyScope` served by a second registered `poolImpulse` producer → the reader logs `sig=bad` and the read is **closed** | the steward-signed record verifies | discovery spoof |
| 14 | `secret_set` replays from PLAN.md, scratch layout (wrong `expect_sha`; unknown name; failing validator; health failure → verified rollback; break-glass with the steward stopped); every artefact grepped for the test values → 0 hits | | C1–C6 |

All rows print an errno or HTTP code. None prints contents. Each row runs in a 7-day window
(§2.1 must-fail cadence).

---

## (e) Build slices: smallest first, each independently landable, verifiable and revertible

**Order (qa-approved, with qa's C1):** S0 → **S1b, the trust-root move, first** → S1a → S1c
→ S1d → **S2 + S6 together** → S3 → S4 → S5. S1a and S1b are independent, and S1a is listed
before S1b below only for reading order. S1b alone closes nothing against a root lane, because
root ignores modes: it creates the file that S1c then makes read-only.

**No claim that S1c closes anything against the lane may be made until S2 + S6 are live.**
- development-vessel holds `SUBSTRATE_GIT_PAT` in-process.
- A landed change to *any* non-excluded dev-vessel file can therefore `git push` a commit that
  touches `units/development-vessel.service`, its drop-ins, or the unit-ctl or steward code.
- The excluded-path check (`gap-to-feature.ts:946,2221`) runs in lane code, and landed code does
  not have to call it.
- pull-sync deploys that commit (from git objects, under S2), and the sandbox is gone at the next
  restart.
- Until S6 lands, S1c is reported as closing the **runtime** path only.

**Row 0 precondition** (from qa's C2).
- On node 1, identity resolves `METABOB_API_KEY` with scopes `[read, write]`, not `admin`, so for
  that key the precondition passed (10-02).
- S1b repeats the check for **every** per-vessel service key the steward could be shown. Any key
  resolving `admin` blocks S1b.
- The check prints scopes only.

- **S0 (prerequisite, built). Land and deploy `3ae57990` (A).** It removes the admin and HMAC
  secrets from dev-vessel's own env.
  - *Verify:* `secret-scope-lint.sh` green, and the dev-vessel unit no longer loads `.substrate-secrets`.
  - Also file the pull-sync no-restart-on-unit-change gap if it is not filed.

- **S1a. `substrate-unit-ctl` helper and call-site switch.** Additive: the old direct
  `systemctl` path still works until S1c.
  - The call sites in (b) switch to a single `unitCtl()` client.
    - **The count:** `git grep -l -E "systemctl|systemd-run|vessel-ctl" origin/dev -- 'src/**' ':!*test*'`
      gives **18 files**. 17 of them hold executable call sites; the rest are comment-only
      mentions such as `push-health-observer.ts:289`. That is qa's 18.
    - The table in (b) lists every executable site. journalctl sites are not helper verbs;
      they use the journal group.
  - When the helper is unreachable, the client returns *unknown*, never *inactive*.
  - *Verify:* rows 7 and 6-positive; dev-vessel suite parent-vs-patched; and
    `[unit-ctl] verb=… ok` lines matching each previously observed systemctl use over 24h.

- **S1b. Steward unit, migration and compatibility shim.** This is the trust-root file
  ownership move.
  - The `secret-steward` unit, with its first-start migrate/seed mode (verify against the committed file; operator `confirm` for any divergence).
  - `resolvePoolImpulse` serves trust-root shapes from the steward file, and filters them from
    the lane file.
  - Trust-root `poolImpulse_write` is forwarded to the steward.
  - `bootstrap-seeder` stops writing trust-root rows into the pool; the steward seeds itself.
  - The in-process readers (`self-fact-reconcile.ts:380`, `gap-drain-observer.ts:286`) move to
    the shape route.
  - **Confirm in the same restart window, per node** (qa C3). The readers fail closed on an
    unsigned record, so the lane stops from the S1b restart until `confirm`. This is expected on
    every node, for two reasons:
    - The live `spendEnvelope` cannot match the committed seed. It carries the user ruling of
      10-02: `usd_cap_per_hour` 5, `lineage_usd_cap_per_window` 0.5 over `lineage_window_s`
      3600, written 15:02:03Z.
    - `substrateNodes` always needs confirm.

    The restart plan therefore runs `substrate-steward confirm` immediately after the steward
    starts and *before* development-vessel restarts:
    - **What confirm shows.** For each staged record, the fields: hourly cap, lineage cap and
      window, `paused`, the `excluded_paths` count, `require_falsifier_classes`, and the
      `discovery_endpoints` count. It cites the ruling that set them ("user ruling 10-02" for
      `spendEnvelope`).
    - **What confirm checks.** The staged record's sha12 must equal the sha12 of the source row
      in `standing.json`. For `spendEnvelope`, that is the 15:02:03Z record (id `spend-envelope`).
      Any difference means the pool row changed after staging, and confirm refuses.
    - **If confirm is not done in the window,** the window is rolled back by the S1b drop-in
      revert, not left closed.
  - *Verify:*
    - row 0 (every service key: no `admin` scope);
    - row 3;
    - row 9 (both directions);
    - `[policy-read]` lines on every reader show `record found`, with the sha12 equal to the
      migrated row's;
    - boredom's envelope verdict is unchanged.

- **S1c. Confinement drop-in on development-vessel and local-tools while they are still root.**
  This closes the in-process write, E1, E2 and E3's direct paths. S1a is a dependency of S1c,
  not of S1b.
  - **`ProtectSystem=strict` is part of this slice**, together with the `ReadWritePaths`
    enumerated in (b): the shared `/tmp`, or a shared `/workspace/tmp/fc`, since strict makes
    `/tmp` read-only and `PrivateTmp=no` is required.
    - *Changed on review:* without it, uid 0 with an empty capability set still has owner access
      to every root-owned file, including:
      - `/usr/lib/systemd/system/*.service{,.d}` and `/etc/systemd/system`;
      - `/run/systemd/system`;
      - the helper and steward code under `/usr/local/libexec/substrate/`;
      - `/usr/local/bin/substrate-pull-sync`.
    - A rewritten drop-in takes effect at anyone's next `daemon-reload`. A rewritten helper takes
      effect at its next socket activation.
    - Also in this slice: `PrivateDevices`, `ProtectKernelTunables/Modules/Logs`,
      `ProtectControlGroups`, `RestrictNamespaces`, `LockPersonality`. They bind root and cost
      nothing.
  - `ReadOnlyPaths` (steward dir, super-repo `scripts/`, the super-repo's `.git/config`,
    `active-scripts`, the trust-root vessels' `/vessels` dirs).
  - `InaccessiblePaths` (both systemd sockets, the secret files).
  - `CapabilityBoundingSet=` empty. If the 24h journal scan shows EPERM, fall back to dropping
    at least `CAP_SYS_ADMIN CAP_SYS_PTRACE CAP_SYS_MODULE CAP_SYS_RAWIO CAP_MKNOD
    CAP_DAC_READ_SEARCH CAP_DAC_OVERRIDE CAP_FOWNER CAP_SETUID CAP_SETGID CAP_SETPCAP
    CAP_NET_ADMIN CAP_BPF CAP_SYS_BOOT CAP_SYS_CHROOT`.
  - `NoNewPrivileges=yes`.
  - *Verify:* rows 1, 2, 5, 6, 7, 8, 10 and 11, each with its root positive control; a 24h scan of
    both units' journals for `EROFS|EACCES|EPERM` attributed to a call site, where every hit is
    either an expected refusal (mitosis promote, `env-gate-scan`) or a defect fixed before
    node 2.
  - **Ownership alone would not do this**: root ignores modes. The namespace bind and the
    capability drop are what bind root.

- **S1d. Retire the trust-root rows in `standing.json`.** Set `status:"retired"` and
  `superseded_by:"steward"` after 7 days of S1b reads matching on every node. It is a
  one-command revert: set `status` back to `open`.

- **S2. Root never executes lane-writable bytes.** pull-sync and bootstrap only.
  - `converge_units`, `converge_fleet_defs` and `substrate-active-scripts-seed` install from
    `git show origin/dev:<path>` (or `git archive`) of the super-repo, never from the working
    tree.
  - **Root never runs git in a lane-owned `.git`.**
    - *Changed on review:* `-c` overrides are a denylist against an open set. `remote.*.url`,
      `url.*.insteadOf`, `credential.helper`, `filter.*`, `core.sshCommand` and `diff.external`
      in a lane-writable `.git/config` are all exec-or-redirect vectors. A rewritten
      `remote.origin.url` in a push clone would make pull-sync mirror lane code into
      `/vessels/identity-vessel`.
    - Mechanism (a): pull-sync keeps its **own root-owned bare mirrors**, under
      `/var/lib/substrate-pull-sync/mirrors/<v>.git` on the volume, fetched from the inventory
      URL. It deploys to `/vessels/<v>` and installs units and scripts from those objects
      (`git --git-dir=<mirror> archive|show`).
    - Mechanism (b): every operation pull-sync must perform *in* a lane tree runs as the lane uid
      via `setpriv --reuid=substrate-lane --regid=substrate-lane --init-groups --no-new-privs`.
      This covers `run_suite`/`run_suite_at` and any `git -C <lane clone>`.
    - Before S3, while the lane is still root, (a) alone holds.
  - `safe.directory='*'` is **forbidden** as a fix for git 2.39's dubious-ownership refusal.
  - *Verify:*
    - row 10 extended: a planted working-tree unit edit is not installed;
    - a planted `.git/hooks/post-merge` and a planted `remote.origin.url` in a push clone have no
      effect on what is deployed.

- **S3. Lane uids.**
  - Users and groups; `/usr/local/bin/bun` in the image; the `/root/.bun` call sites updated;
    `HOME`, cache and state dirs; group ACLs; `ProtectProc=invisible`.
  - EPERM-as-alive in the `kill(pid,0)` probes; `env-gate-scan` reads names from the manifest;
    journal group granted after the key-print count check and the admin-key rotation.
  - pull-sync's `run_suite` / `run_suite_at` run as `substrate-lane` through `setpriv --reuid
    --regid --init-groups --no-new-privs`.
  - *Verify:* rows 4 and 12; rows 1–11 re-run under the new uid; a lane suite run and a landing
    complete end to end on node 1 (a substrate-authored commit reaches origin/dev).

- **S4. Signed trust-root records.** Readers verify `steward_sig`: observe, then enforce.
  - *Verify:* row 13.

- **S5. Fleet-wide confine drop-in.** Landed lane code runs in *every* vessel that pull-sync
  deploys, so every vessel unit except steward, unit-ctl and pull-sync gets (identity included:
  it has no reason to write `/workspace/steward`)
  `ReadOnlyPaths=/workspace/steward`, both systemd sockets inaccessible, the cap drops and
  `NoNewPrivileges`.
  - This includes llm-resolver and goal-host, which direct tools.
  - *Verify:* rows 1, 5 and 6 from activity-api and goal-host.

- **S6. Authority gate outside the lane. It lands WITH S2 (qa C1).** Today the excluded-paths
  check runs only in lane code (`gap-to-feature.ts:946,2221`), and the lane holds the push PAT.

  **Remote option (GitHub ruleset): not available.** Checked read-only on 10-02:
  - `AviGopal/substrate` is **public**, user-owned, default branch `dev`. It has one ruleset,
    `dev-no-delete` (branch target, active).
  - GitHub's docs: "With push rulesets, you can block pushes to a **private or internal**
    repository … based on … file and folder paths". The file-path restriction is a push-ruleset
    rule, so it is **unavailable on this public repo**. Branch rulesets are available, but they
    are not path-scoped.
  - Branch protection would gate *all* of `dev`: restrict-updates with an owner bypass, or
    require-PR with CODEOWNERS. Either one blocks the lane's direct push entirely, which breaks
    the autonomy criterion.
  - If the lane PAT belongs to the owner account, an owner bypass also cannot tell the lane from
    the operator. *Which account the PAT belongs to was not checked*, because it is a secret
    read.
  - Possible later: a lane-only machine-user PAT (a non-admin collaborator) would let a remote
    rule tell the lane from the operator.

  **Chosen mechanism: the deploy-side gate in pull-sync.**
  - pull-sync deploys only from its root-owned mirrors (S2). The lane can neither write them nor
    run anything in them.
  - Before deploying a range `last_deployed..origin/dev` of any repo, it computes the paths the
    range touches (`git diff --name-only` on mirror objects).
  - If any path is human-governed, it holds the deploy at the last commit before that one unless
    the steward has an operator-signed `deployApproval {repo, sha}` record. Human-governed means:
    `scripts/substrate/**`, unit files and drop-ins, `scripts/substrate/{steward,unit-ctl}/**`,
    plus the autonomyScope human-governed category, read from the **signed** steward file.
  - A held deploy files a gap and is traced. Nothing after the held commit deploys until approval
    (or a revert).
  - The gate's own code and path list live in human-governed paths, so a change to the gate
    needs approval too.
  - *Verify:* a planted lane commit touching `units/development-vessel.service` on node 1's
    mirror is **not** deployed, and is reported as held. The same commit with an operator
    approval record deploys (the positive control).

`secret_set` phase 1 (the host CLI, C1–C6) is independent of S1–S6 and can land at any point
after S0. Its `secret_status` serving lands with S1b.

---

## Open decisions for the operator
1. **Trust-root membership (one user decision, four items).** Should these move to the steward
   as human-governed? This design recommends yes for all four.
   - `jointBinding` (the evaluator's expectation set, including `sql`).
   - `humanAskRoute`.
   - `/workspace/push-policy.json`, which the lane writes today (`push-policy.ts:32`).
   - `/workspace/doc-fix-policy.json`, which the lane writes today (`doc-fix-policy.ts:4`).

   Related, filed HIGH separately: `/workspace/keys/*.pem` private keys are `0644`.
2. **The permanent boundary** (REALIGNMENT §10, open item 1). The steward's category field
   makes the decision executable. It does not make it.
3. **Operator-hold rows inside `timeShapedRhythm`.** These should become the C20 TTL quarantine
   shape under the steward's *temporary-restriction* category (§7 step 9).

## Biggest risk
**The sandbox is defined in, or executes from, files the sandboxed process can write, and root
installs or runs them.**
- `converge_units` installs `/workspace/git/super-repo/scripts/substrate/units/*` from the
  working tree that is dev-vessel's own `WORKSPACE_ROOT`, every tick.
- About 19 root units run `/workspace/active-scripts/*.ts`, which dev-vessel writes.
- pull-sync runs `bun test` in lane-written clones as uid 0.
- local-tools' shell, root today, has no `ReadOnlyPaths` on super-repo `scripts/`.

A lane write there plus a helper-permitted `restart development-vessel` silently removes every
setting in this design. That is why S1c makes those paths read-only *in the same slice* as the
trust-root move, and why S2 follows immediately.

The second risk is reach through deployment. Until S5 and S6, a **landed** commit to any
non-excluded vessel runs as root with full capabilities after pull-sync deploys it. S1–S3 close
the *runtime* path (in-process writes, model-directed tools). They do not close the
*landing → deploy* path, and §7 step 9's acceptance must be reported as holding for the runtime
path only until S5 and S6 land.

**Unforgeable is not unbypassable.** The `autonomyScope()` and `spendEnvelope` verdicts are
*enforced inside development-vessel*, by lane code (`gap-to-feature.ts:840,946,2114,2221,5390`;
`feature-compose.ts:4154,6954`).
- S1–S4 make the policy **unforgeable**: the lane cannot write it, forge it or serve a fake copy.
- They do not make it **unbypassable**: landed code can simply skip the check and push.
- Only enforcement outside the lane closes that: S6 (the deploy-side gate, since a remote
  ruleset is unavailable on this public repo) and S5 (the confinement of the deployed result).
- Any report that "an unauthorized operation stays refused" must say which of the two it means.

---

## Delta 10-02: locality, no trust root

**CONFIRMED 10-02: user ruling.** "The revision is correct. The system should operate in accordance to its design principles." Delta 3 below is the design of record; it supersedes Deltas 1 and 2 where they conflict.

**User rulings (10-02, relayed verbatim):**
- "We can leave the github token as is for now. We should use the pull-sync check. There
  shouldn't be a trust root per-se."
- The standing ruling: "safety via locality, secrets never in agent reach; no per-se containment
  rules".

This section **supersedes** every part of the design above that conflicts with it. Nothing above
was deleted; the earlier sections are kept as history.

### The principle
There is no special class of records with a privileged owner, and no signatures, categories or
steward service. What the lane must not change **lives where the lane cannot reach**:
- in a directory that is read-only or invisible in every lane namespace;
- written only by an operator CLI run from the host through `docker exec` (no network
  service);
- read by pull-sync (root, not a lane unit) and, read-only, by the vessels.

### Dropped
- `secret-steward` as a network service.
- The steward-owned, signed `trust-root.json`.
- S1b's shim (forwarding writes, serving from the steward file).
- S4 signatures.
- The human-governed / earned / temporary taxonomy as a store property.
- The `trustRootPolicy{,_write}` shapes.
- The membership question for `jointBinding`, `humanAskRoute`, `push-policy.json` and
  `doc-fix-policy.json`. Each stays where it is. If any of them is later judged a thing the
  lane must not change, the answer is the same as below: move it to the operator directory.
  It is not a category.

### (1) Where approval records live
**Location: `/workspace/operator/`.** It is `root:root 0755`. Files are `0644`, written by
temp-file + rename. A `flock` on `/workspace/operator/.lock` guards writes.
- **Why `/workspace` and not `/etc/substrate`** (measured on node 1):
  - `/workspace` is the named volume (`substrate-workspace`), so it survives container recreation
    and image upgrades.
  - `/etc/substrate` is **not a mount**. It is a container-layer directory, regenerated by gen-env
    and lost on recreate.
  - `/workspace/operator` does not exist yet, so there is no collision.
- **Lane namespaces:**
  - `ReadOnlyPaths=/workspace/operator` for development-vessel (it reads the policy files) and
    for every unit under S5.
  - `InaccessiblePaths=/workspace/operator/approvals` for local-tools. Its shell has no need
    to read approvals.
  - While the lane is still root, the read-only bind plus `ProtectSystem=strict` and the empty
    capability set (S1c) are what bind it. After S3, the file mode binds as well.
- **Writer:** `substrate-operator` (bootstrap tier, stated), run as
  `docker exec -i <c> substrate-operator approve|policy|list|revoke …`. Runtime behaviour stays
  steered by data read at use time (law 1); this is only the write path for that data.
- **Approval format**, one file per approval: `/workspace/operator/approvals/<repo>/<sha>.json`.
  ```
  {repo, sha, paths:[…protected paths the range touches, as computed by the CLI from pull-sync's mirror],
   operator, approved_at, note}
  ```
  - `operator` is the operator id passed to the CLI (for example `operator:claude-avi`). The
    authority is **where the file is**, not what it says. Pull-sync never reads a commit author
    or committer string.
  - `revoke` renames the file to `<sha>.json.revoked`, which keeps history.
  - The CLI computes `paths` by asking for the protected paths in `<parent>..<sha>` on the mirror.
    pull-sync recomputes them and refuses if the sets differ, so an approval covers exactly what
    the operator saw.
- **Protected paths:** `/workspace/operator/protected-paths.json`, in the same directory and
  written by the same CLI.
  - Initial content: `scripts/substrate/**`, `**/*.service`, `**/*.service.d/**`, `**/*.timer`,
    `scripts/substrate/unit-ctl/**`, `Dockerfile.substrate`.
  - Plus the paths of vessels that hold scoped secrets: `repos/identity-vessel/**`,
    `repos/discovery-vessel/**`, and the federation-transport source.
  - pull-sync's own source is inside `scripts/substrate/**`, so a change to the check needs
    approval too.

### (2) Where `spendEnvelope`, `autonomyScope` and `substrateNodes` live
**Location:** `/workspace/operator/policy/{spendEnvelope,autonomyScope,substrateNodes}.json`. Each
file holds one record body plus `{updated_at, operator, note}`.

**Readers.** development-vessel's `resolvePoolImpulse` answers these three shapes from the policy
directory, read-only, and filters them out of `standing.json`. So:
- the existing HTTP readers are unchanged: `gap-to-feature` policy reads through discovery,
  boredom `index.ts:4215`, and `self-fact-reconcile` once it moves to the shape route;
- there is **no lane write path**: `poolImpulse_write` for these shapes returns
  `{ok:false, error:"operator-managed: /workspace/operator/policy"}`, and the file is EROFS to
  the lane.

**What a fake producer could do, and why it is accepted.** Without signatures, a lane-registered
fake `poolImpulse` producer could still serve a forged copy. That is accepted under this ruling,
for these reasons:
- These verdicts are enforced in lane code anyway (unforgeable ≠ unbypassable, above).
- The enforcement that matters sits outside the lane: the pull-sync check and S5.
- The file itself cannot be changed by the lane.

**Migration.** `substrate-operator policy import` (host CLI, once per node, in the restart
window):
- It reads the newest open row of each shape from `/workspace/git/super-repo/pool/standing.json`.
- It **shows** the fields: `usd_cap_per_hour` 5, `lineage_usd_cap_per_window` 0.5 per 3600 s
  (user ruling 10-02), `paused`, the `excluded_paths` count, `require_falsifier_classes`, and the
  `discovery_endpoints` count. It also shows each source row's sha12.
- It writes after an interactive `yes`.
- It verifies that the sha12 of each written body equals the source row's: for `spendEnvelope`,
  the 15:02:03Z `spend-envelope` row.
- The pool rows are then marked `retired`, and reverting is a single flip.
- Fresh volumes: `bootstrap-seeder` writes `policy/*.json` from the committed
  `autonomy-scope.json` instead of pool rows.

**Updates.** Through the same CLI: `substrate-operator policy set <shape> <file>`. It is a
single writer with no service, serialised by `flock`.
- **No compare-and-set service is needed.** Concurrent writers would mean two operators editing
  at once on one node. The lock serialises them, and the CLI shows the previous `updated_at`
  before replacing it.
- **Behaviour change for operators:** the cockpit's `resolve_impulse poolImpulse_write` no longer
  changes these shapes.
- **Gap to file:** a cockpit-only operator (an agent with no host shell) cannot update policy.
  That is a gap to file, not a reason to add a network write path.

### (3) Slices: kept, changed, dropped; new order
| Slice | Status |
|---|---|
| S0 env scoping (A) + secrets drop-in | **kept**: landed. |
| S1a unit-ctl helper | **kept**. Its allowlist no longer excludes `secret-steward`; it still excludes `substrate-unit-ctl`, `identity-vessel`, `surrealdb` and `substrate-pull-sync`. |
| S1b steward + shim | **replaced by S1b′**: create `/workspace/operator/{policy,approvals}`, the operator CLI, `policy import`, dev-vessel serving the three shapes read-only and refusing writes, and the seeder change. |
| S1c confinement while still root | **kept**. `ReadOnlyPaths` adds `/workspace/operator` and drops `/workspace/steward`. |
| S1d retire pool rows | **kept**, folded into `policy import`. |
| S2 root never runs lane-writable bytes | **kept**: root-owned mirrors and `setpriv` into lane trees. |
| S6 pull-sync deploy check | **kept and moved: lands WITH S2**. Mechanism as in (1). |
| S3 lane uids | **kept**. |
| S4 signatures | **dropped**. |
| S5 fleet-wide confine | **kept**. `ReadOnlyPaths=/workspace/operator` everywhere except pull-sync. |
| secret_set phase 1 | **kept** as the host CLI (C1–C6). `secret_status` becomes a CLI subcommand (`substrate-operator secret status`) instead of a served shape. |

**New order:** S0 → S1b′ → S1a → S1c → **S2 + S6** → S3 → S5.
- Nothing after S1c is claimed against the lane until S2 + S6 are live (qa C1).
- secret_set phase 1 can land any time after S0.

### (4) Step 9's acceptance, and the falsifiers that remain
**Acceptance** becomes: *an unauthorized operation stays refused despite high confidence,
because of where things live.*
- **Runtime:** the lane cannot write the policy files, the approvals, the unit sources, or the
  units' installed code, and cannot drive PID 1.
- **Deploy:** pull-sync deploys no protected-path change without an approval file the lane cannot
  write.
- **Not covered, accepted for now** (user, 10-02): the lane's GitHub token stays as is. So the
  lane *can push* a protected-path commit to origin/dev. The pull-sync check makes that
  **inert on every node** (it is never deployed), but it is visible on the remote branch until it
  is reverted. Each held deploy files a gap.

**Falsifiers.** Error codes only. Each has a positive control through the same address
(`systemd-run --wait --uid=0` from the host):
| # | Must fail (in the lane unit's own process: `authority_probe`) | Positive control |
|---|---|---|
| F1 | `open("/workspace/operator/policy/autonomyScope.json", O_WRONLY)` → EROFS (S1c) / EACCES (S3); the same for `approvals/x.json` → EROFS | root control → ok |
| F2 | `poolImpulse_write {shape:"spendEnvelope"}` → `{ok:false, operator-managed}`; the policy file's sha12 is unchanged | CLI `policy set` → the sha12 changes |
| F3 | `writeFileSync(standing.json)` with a forged `autonomyScope` row, then `resolvePoolImpulse` → returns the **policy-file** body (sha12 equal) | n/a |
| F4 | `open("/proc/1/root/workspace/operator/policy/autonomyScope.json", O_WRONLY)` → EACCES (only discriminates against full-capability targets; S3's distinct uids close the rest) | ok |
| F5 | `connect` to `/run/systemd/private` and to `/run/dbus/system_bus_socket` → ENOENT/EACCES; `systemd-run --wait true` → non-zero; `systemctl set-property development-vessel …` → non-zero | `systemd-run --wait true` → 0 |
| F6 | helper `restart local-tools-vessel` → ok; helper `set-property` / `restart substrate-pull-sync` / an unknown unit → refused | |
| F7 | a planted lane commit touching `scripts/substrate/units/development-vessel.service`, pushed to a scratch branch that a test pull-sync tracks on node 1 → **held**, gap filed, not deployed | the same sha with `substrate-operator approve` → deployed |
| F8 | an approval whose `paths` do not match the recomputed set → refused | |
| F9 | writes to the super-repo `scripts/`, the super-repo `.git/config`, `/usr/lib/systemd/system/*.d/`, `/etc/systemd/system/`, `/run/systemd/system/` and `/workspace/active-scripts/` → EROFS | ok |
| F10 | after S3: `open("/proc/<identity MainPID>/environ")` → EACCES/ENOENT; a lane-planted test sees `uid≠0` under pull-sync's `run_suite` | root `stat` ok |
| F11 | secret_set replays from PLAN.md; artefact grep for the test values → 0 hits | |

Rows 0 (no service key resolves `admin`) and 9 (an admin-scoped HTTP write with lane
credentials) from the original section are **dropped**: there is no HTTP write path left to
test. F2 is the lane-credential test.

### Recorded
- **GitHub token:** stays as is (user, 10-02). The blast-radius note above is
  **accepted-for-now**.
- **The C2 check is still valid as a fact:** `METABOB_API_KEY` resolves to `[read, write]`.
  Nothing in this delta depends on it.

---

## Delta 2 (10-02): evidence-gated deploys, no operator blocking

**User statement (direct, 10-02):** "The goal of the system and the realignment is not to have the
operator blocking." This supersedes Delta 1 wherever they conflict. Delta 1's locality rules
stand. **Its per-change approval record is withdrawn**: requiring one made the operator the
blocker for exactly the changes the system needs to make to itself. Humans take part as sources
of purpose, authority and judgment *when asked* (REALIGNMENT §10). They are not a per-landing
gate.

### The rule pull-sync applies to a protected-path change
A commit range that touches a protected path deploys on a node when (a), (b) and (c) all hold.
- Protected paths are listed in `/workspace/operator/protected-paths.json`, in a location the
  lane cannot write.
- **Every judge is the last accepted version.** Every check below runs from the node's
  *currently deployed, accepted* revision, out of pull-sync's root-owned mirror (S2). It never
  runs from the candidate, so a change cannot weaken the check that judges it.

**(a) Checks outside the lane's reach,** run by pull-sync as root from root-owned content, or as
the lane uid through `setpriv` when they execute candidate code.
1. **Static checks, before deploy, on the candidate tree:**
   - pull-sync's existing gate: the post-land suite, parent versus candidate, as already built;
   - the committed glue runner (`pull-sync-committed-glue.test.sh`);
   - `secret-scope-lint.sh`, run from the *accepted* revision against the *candidate's* units;
   - a unit lint: every lane and S5 unit keeps its confine drop-in; `systemd-analyze verify`
     passes.
2. **The protected-path must-fail suite, after deploy and restart, from inside the units**
   (`authority_probe`, F1 and F4–F10):
   - the drop-in still masks the secrets;
   - both systemd sockets are still blocked;
   - no unit gains capabilities;
   - the policy and operator directories are still EROFS;
   - pull-sync still holds a planted widening commit (F7′ below).

   If any must-fail row now *succeeds*, pull-sync rolls the node back to the previous accepted
   revision as root, restarts, re-runs the suite and files a gap naming the sha. The check is
   built into pull-sync. It is not an activity the lane could skip.

**(b) Canary soak through staged channels**
(`openspec/changes/staged-fleet-rollout`, which is already proposed: `canary`/`fleet`/`hold`,
settle window, advance activity).
- Node 1, the canary, takes the change first, under (a) and (c).
- `fleet` nodes take it only after a soak window with no regression signals.
- **The `fleet` ref is not authority.** The lane holds the push token (left as is, user
  10-02), so the lane can write `fleet`. Each consumer's pull-sync therefore re-applies (a) and
  (c) itself. It also requires that the revision has been visible in its own mirror's `dev`
  history for at least the soak window. The canary's verdict trace is evidence, not a key.

**(c) Authority-widening diff check.** pull-sync diffs the candidate against the accepted
revision, as root, over the mirror. Only the following class needs a human:
- an `InaccessiblePaths`, `ReadOnlyPaths` or `ProtectSystem`/`ProtectProc` setting removed or
  weakened on any unit;
- a capability added, `NoNewPrivileges` turned off, or `User=` changed to root or removed;
- a new unit without the confine drop-in;
- a path removed from the protected set;
- a raised cap or a removed excluded path in the committed `autonomy-scope.json` seed;
- a new socket or helper verb in `unit-ctl`'s allowlist;
- any edit to the check itself: pull-sync's gate code, the widening rules, or the must-fail
  suite.

**What happens to a widening change: not deployed, not blocking.**
- The node keeps running the accepted revision *for that repo only*. Other repos keep
  converging.
- pull-sync writes a **proposal**: a gap of class `authority_widening`, carrying the sha, the
  rule that matched, the diff hunks, and the (a) results. It writes it through the gap store (an
  ordinary shape) and as a file under `/workspace/operator/proposals/`.
- The system keeps working. The lane can push a non-widening rework or a revert, and that
  unblocks the repo **without a human**.
- A human acts only if they choose: `substrate-operator accept <sha>` writes
  `/workspace/operator/accepted/<repo>/<sha>.json`, the one remaining operator-written record.
- Non-widening protected-path changes, such as a unit's `TimeoutStopSec`, a script fix, or a
  tightening, deploy on evidence alone.

### Policy (spend and scope), kept from Delta 1 and extended
- The policy files stay in `/workspace/operator/policy/`, where the lane cannot write (locality).
  Lane code never changes them.
- They change through **two writers only**, both outside the lane:
  1. **The operator CLI** (purpose and authority when the human chooses to act).
  2. **The earned-authority criterion** (§7 step 9).
     - It is a small unit with its own uid, the only one with RW on `policy/`.
     - Its code is a protected path, so changing it is widening-class.
     - It reads trace evidence by shape, read-only.
     - It applies **tightenings automatically**. It applies **widenings** only when its
       machine-checked criterion holds on evidence relevant to that behaviour.
     - Every change is written as a C20 TTL quarantine-style record with `{rule, evidence ids,
       expires_at}`.
     - §7 step 9's exit, "two consecutive scope changes by the criterion with no operator edit",
       is measured on this writer.
- **Migration (`policy import`) runs with no human.** It copies the live pool rows *unchanged*
  and verifies sha12 equality, including the 15:02:03Z spendEnvelope row. Because it changes no
  value, it is not widening. Delta 1's interactive `yes` is removed. Fields are logged.

### Operator-in-the-loop, per slice (after removing everything outside the widening class)
| Slice | Operator step? |
|---|---|
| S0 env scoping + secrets drop-in | none (landed) |
| S1b′ operator dir + policy files + import | **none** (the import is unchanged-copy and sha-verified; Delta 1's confirm step is removed) |
| S1a unit-ctl helper | none |
| S1c confinement while still root | none |
| S2 + S6′ (evidence-gated deploy check) | **none per change.** A human appears only as the optional acceptor of an `authority_widening` proposal, and the default is not-deployed, not blocking. |
| S3 lane uids | none. The journal-group grant is automatic when the per-node secret-pattern count is 0; otherwise it stays withheld and a gap is filed, with nothing waiting on a human. Delta 1's "rotate the admin key first" is moved to secret_set as a recommendation, not a gate. |
| S5 fleet-wide confine | none |
| staged channels (b) | none (the advance is an activity) |
| earned-authority criterion | none for tightenings or criterion-met widenings. Changing the criterion itself is the widening class. |
| secret_set phase 1 | **operator-only by design**: secret values never enter agent reach (standing ruling). It is not a landing gate. Nothing in the deploy path waits on it. |

**Order:** S0 → S1b′ → S1a → S1c → **S2 + S6′** (with the staged-channel `canary`/`fleet`
split) → S3 → S5 → earned-authority criterion.

### Step 9 acceptance, re-stated
*An unauthorized operation stays refused despite high confidence.*
- **Runtime:** locality (F1–F6, F9, F10).
- **Deploy:**
  - an authority-widening change does not deploy on any node, on evidence or confidence alone,
    without either the criterion (for policy) or a human `accept` (for confinement and the
    check itself);
  - a non-widening change deploys with no human.

New and changed falsifiers. Each has a positive control through the same address.
| # | Must fail | Positive control |
|---|---|---|
| F7′ | a planted commit that removes `InaccessiblePaths=/etc/substrate/env.d` from `development-vessel.service` on a scratch channel → **held**, `authority_widening` proposal filed, other repos still converge | a planted commit that only changes `TimeoutStopSec` → **deployed** with no human |
| F8′ | a planted commit editing pull-sync's widening rules → held (the check judges itself from the accepted revision) | the same commit plus `substrate-operator accept` → deployed |
| F12 | a planted commit passing (c) but making the must-fail suite pass a row (for example, re-opening `/run/dbus/system_bus_socket` through a new drop-in that the lint missed) → **auto-rolled back** on the canary, gap filed, never reaches `fleet` | an unmodified revision → the suite stays all-refused |
| F13 | a forged `fleet` advance pushed by the lane for a revision younger than the soak window → the consumer does not converge | the same revision after the window → converges |
| F14 | the criterion writing a widening without its evidence rule holding → refused by the criterion; a lane write to `policy/` → EROFS (F1) | a tightening by the criterion → applied, TTL record present |

**What this leaves open, stated:**
- (a) and (c) judge *declared* confinement and *measured* confinement. They do not judge what
  arbitrary new vessel code does inside its own sandbox. That is S5's job, and the reason S5
  covers every deployed unit.
- With the token left as is, the remote `dev` and `fleet` refs are lane-writable. Every node's
  pull-sync is therefore the enforcement point, and the refs are evidence only.

### Delta 2 addendum: reconciled with the coordinator's restatement
1. **Delta 1's per-change approvals directory is gone.**
   - `/workspace/operator/approvals/` is renamed `accepted/`.
   - It is written only for `authority_widening` proposals that a human chooses to accept.
   - No other protected-path commit needs a file.
2. **(a) is evaluated against the CANDIDATE before deploy, as well as after it.**
   - **Before deploy (static).** pull-sync, as root and from the mirror, renders the candidate's
     effective unit properties: the unit file plus drop-ins, parsed. It runs the suite's static
     rows against them, so a failing candidate never starts on any node:
     - the secret masks are present in `InaccessiblePaths`;
     - both systemd sockets are in `InaccessiblePaths`;
     - `CapabilityBoundingSet` is empty and `NoNewPrivileges=yes`;
     - `ProtectSystem=strict`, `ProtectProc=invisible`;
     - the lane `ReadOnlyPaths` are present;
     - the glue runner is green;
     - `secret-scope-lint` is green.
   - **After deploy (canary only).** The runtime rows (F1, F4–F6, F9, F10) run from inside the
     restarted units. Any row that no longer refuses triggers auto-rollback and a gap.
3. **(b) soak is counted in pull-sync ticks.** A `fleet` node converges a revision only after it
   has been running on node 1 for N consecutive pull-sync ticks with no regression signal. N is a
   shaped value in `/workspace/operator/policy/rollout.json`, tightenable by the criterion.
   The regression signals are:
   - the post-land suite regressed;
   - a must-fail row passed;
   - a unit is in failed or restart-loop state;
   - a new failure class appeared in the journal (`staged-fleet-rollout`'s advance checks).
4. **The (c) classifier is unchanged.** "Raises spend/scope policy" covers both the committed
   seed and any code path that would write `policy/`. The live files are EROFS to the lane, so in
   practice this matches only the seed and the criterion's own code.

**Operator-in-the-loop, final:** exactly two places, both justified.
- **Accepting an `authority_widening` proposal** (optional, default not-deployed, never blocking
  other repos or commits; the lane can rework or revert without a human).
- **secret_set** (secret values stay out of agent reach by the standing ruling; not in the deploy
  path).

Everything else in S0–S5, the staged channels and the criterion has **no** operator step.

### Delta 2, qa finding: root-owned is not lane-unforgeable; the judge must be the ACCEPTED version

**The finding.** S2's mirrors fetch `origin/dev`, and the lane pushes with the user's PAT (kept,
user ruling 10-02). A lane push therefore becomes root-owned content one fetch later.
"Root-owned" says where the bytes sit, not who authored them. Three concrete paths:
1. **Super-repo `847025e2`** ("the tick that pulls a commit runs that commit's pull-sync",
   landed 10-02, with `validation/scripts/pull-sync-self-reexec.test.sh`). Every tick re-execs
   the *newly committed* `substrate-pull-sync.sh` as root, **before any gate**. A lane edit to
   pull-sync, or to a classifier inside it, runs fleet-wide within one tick and judges itself.
2. The glue runner and the must-fail suite come from the same incoming commit. `6ac1aa6` is the
   precedent: a draft added entries to its own guard's allowlist.
3. The widening classifier would come from that commit too.

**Invariant (replaces "every judge is the last accepted version" above with a mechanism).**
An incoming commit is judged **only** by the gate, classifier and evidence harness of the
currently running, previously **accepted** version. That version is pinned on root-owned local
disk, outside the volume's lane-reachable trees and outside any mirror:
- `/var/lib/substrate-pull-sync/accepted.sha`, per repo, recording the super-repo revision whose
  gate is in force;
- `/var/lib/substrate-pull-sync/accepted/`, a **staged copy** of that version's
  `substrate-pull-sync.sh`, classifier rules, protected-path list, glue runner and must-fail
  suite. The suite is executed from here and never from the mirror, a clone, or `/usr/local/bin`
  as the candidate wrote it.

`/var/lib/substrate-pull-sync` must live on the persistent volume (or be re-staged from the
image's copy on first boot) and be `InaccessiblePaths` in every lane and S5 namespace.
**847025e2's self-re-exec is changed accordingly:**
- A new pull-sync revision is **never** exec'd because it arrived.
- It becomes the running pull-sync only after the *old* staged gate classifies it, and that
  classification is necessarily `authority_widening` (below), which requires an accepted
  proposal.
- Until then, the tick keeps executing the staged accepted copy.

**Authority-widening by definition** is decided by the OLD gate, on a path list held in the OLD
staged version. Any change to the following is widening, regardless of the diff's content:
- the gate, the classifier, the evidence harness or the must-fail suite;
- `substrate-pull-sync.sh` itself, including 847025e2's self-update path, **the most important
  protected path**;
- `unit-ctl`;
- any unit file or drop-in (`**/*.service`, `**/*.service.d/**`, `**/*.timer`);
- `protected-paths.json` and the committed policy seed.

Such a change is raised as an `authority_widening` proposal with its evidence: the old harness
run against the candidate, and the diff. It is **not auto-deployed** and **never blocks other
commits**. The repo is pinned at the last accepted revision *for those paths only*: pull-sync
keeps converging vessel code and keeps running the staged gate.

- **This supersedes (c)'s content-based exceptions.** A unit-file change that only touches
  `TimeoutStopSec` is now widening by path. F7′'s positive control becomes a vessel-code-only
  commit.
- That is the price of judging by path in the old version. A content-aware relaxation (deciding
  harmless unit edits by their content) would itself be a classifier change, so it can only enter
  through an accepted proposal.

**Non-widening changes** (ordinary vessel code outside the protected list) auto-deploy after:
1. the OLD harness passes against the candidate (static rows before deploy; runtime rows on the
   canary after deploy, with auto-rollback);
2. N ticks of node-1 soak with no regression signal.

No operator is involved.

**Ordering consequence.** The canary channels (`hold`/`fleet`, `openspec/changes/staged-fleet-rollout`)
and the accepted-version pin must land **before the lane's next authority-relevant work**,
meaning anything touching pull-sync, units or drop-ins, unit-ctl, or confinement. The order
becomes:

S0 → **pin + staged channels + S6′ with the old-version judge** → S1b′ → S1a → S1c → S2 → S3 →
S5 → criterion.

The pin is the slice that makes every later slice's protection deployable without being
self-judged.

**Honest status (10-02), for the delta's status line and for §10:**
> Until the accepted-version pin lands, **a lane push can change root code on every node within
> one tick.** The lane holds a push credential (left in place by user ruling), and pull-sync
> executes the newly pushed `substrate-pull-sync.sh` as root before any gate (`847025e2`). Every
> runtime-confinement claim in this design (S1c, S3, S5) is therefore **not yet a claim against
> the lane**. It becomes one only once incoming commits are judged by the previously accepted,
> locally pinned gate.

**Proposed §10 text** (open item 4, "Known live conflicts", new bullet):
> - *Self-judging deploy path (10-02).* pull-sync re-execs each newly pulled
>   `substrate-pull-sync.sh` as root before any gate (`847025e2`), and its glue runner,
>   must-fail suite and any classifier come from the same incoming commit (precedent `6ac1aa6`).
>   With the lane's push credential in place (user ruling 10-02), a lane push changes root code on
>   every node within one tick. §7 step 9's acceptance cannot hold until an incoming commit is
>   judged only by the previously accepted gate, pinned on root-owned local disk. Changes to the
>   gate, pull-sync, unit-ctl, unit files or drop-ins are authority-widening by definition: they
>   are raised as proposals with evidence and are not deployed automatically. All other changes
>   deploy on evidence and canary soak, with no operator in the loop. The canary channels and the
>   pin land before the lane's next authority-relevant work.

---

## Delta 3 (10-02, design of record): the system adjusts its own limits on evidence judged by the accepted gate

**Ruling:** "The revision is correct. The system should operate in accordance to its design
principles." What the ruling means:
- The system may change its own limits: spend, scope, which paths it may change, and its own
  deploy gate, when its evidence supports the change.
- Humans are informed and able to intervene. They do not approve each change.
- There is no protected trust-root store.

### Principles applied
1. **Limits are shaped impulses the system reads and writes (law 1).**
   - `autonomyScope`, `spendEnvelope`, `substrateNodes`, the protected-path list and the rollout
     soak N are ordinary pool shapes.
   - There is no privileged category, no signed store, and no operator-only directory.
2. **A limit changes only through the earned-authority criterion** (§7 step 9, C20).
   - The change must cite evidence *relevant to that behaviour and its consequences*.
   - It records an L12 intervention: who/what, the before and after sha12, and the evidence ids.
   - It carries a TTL where it is a restriction.
3. **No self-certification (K15/K18; "the agent never authors its own approvals").**
   - The evidence for a change is produced and judged by the **running, previously accepted**
     gate and harness, never by the incoming change.
   - This includes `847025e2`'s self-update path: a new pull-sync is judged by the accepted
     version before it is ever exec'd.
4. **Humans are informed, and an intervention always works.** There is no per-change approval,
   and nothing blocks on the operator.
5. **Plain locality stays for what is genuinely not a limit:**
   - secrets out of agent reach;
   - (A) and the secrets drop-in (landed);
   - S1c confinement, the unit-ctl helper, S2, and the S3 uids.

### Where limits live, and who writes them
- **Proposals (any writer).** `limitChangeProposal {shape, proposed_body, rationale,
  evidence_ids[], proposer_execution_id}` is an ordinary lane-pool shape. Any activity may propose,
  including the lane, a detector, or the operator through the cockpit.
- **Effective limits (one writer: the criterion runner).** The effective records keep their
  current shapes and their current read route: `poolImpulse` by shape. All existing readers are
  unchanged (`gap-to-feature` policy reads, boredom `index.ts:4215`, `ui-write-passthrough`,
  `joint-liveness-tick`). The records are written only by the **criterion runner**.
  - The criterion runner is an activity whose *code* is the accepted version, pinned (below). It
    runs as its own uid, `substrate-judge`.
  - Its records live in `/workspace/judge/limits.json`, served through the same `poolImpulse`
    route as a second local producer.
  - That file is read-only to the lane. **This is not a trust-root category.** It is the
    consequence of principle 3: if lane code could write the effective record, it would be the
    author of its own approval. Any shape the criterion governs is stored there, and the set is
    itself a limit the criterion can change.
- **What the criterion accepts as evidence** (judged by the accepted harness):
  1. Every `evidence_id` resolves to a trace or verdict row **produced before** the proposal, by
     an execution **other than** `proposer_execution_id` and its descendants. This is the
     parent/child rule of §2.1 item 2.
  2. The rows were graded by the accepted §2.1 evaluator. Their must-fail controls refused within
     window.
  3. The evidence is relevant: the rows concern the behaviour the limit governs. A scope widening
     for path P needs landed-and-consumer-verified outcomes **on P**. Successes in nearby files do
     not count (§7 step 9).
  4. **Tightenings** apply on a smaller bar: one relevant regression or must-fail breach, with a
     TTL. **Widenings** need the full criterion. Both are written with the L12 record.
- **Migration.** On first start, the criterion runner copies the current live rows unchanged
  (the 15:02:03Z `spendEnvelope`, `autonomyScope`, `substrateNodes`) into `limits.json`. They are
  stamped `decided_by:"migration"`, sha12-verified against their source rows, and recorded as an
  L12 intervention. The pool copies are marked `retired`.

### The pinned-judge mechanism
- **State.** `/var/lib/substrate-pull-sync/accepted.sha` records the super-repo revision whose
  gate is in force. `/var/lib/substrate-pull-sync/accepted/` is a staged copy of that revision's:
  - `substrate-pull-sync.sh`;
  - the change classifier;
  - the evidence harness: post-land suite runner, glue runner, must-fail suite (F-rows);
  - the criterion runner.

  This state is on root-owned disk, persistent, and `InaccessiblePaths` in every lane and S5
  namespace.
- **Each tick** executes the staged copy **only**. `847025e2`'s "run the newly pulled
  pull-sync" is replaced: a new pull-sync is a *candidate*.
- **Ordinary changes.** For ordinary vessel code, the accepted harness runs against the candidate:
  1. static rows, before deploy;
  2. node 1 as canary, with runtime must-fail rows after deploy and auto-rollback on any breach;
  3. N ticks of soak with no regression signal;
  4. then the `fleet` nodes.

  No human is involved.
- **Changes to the gate itself** (pull-sync, classifier, harness, criterion, unit-ctl, unit files
  and drop-ins) follow §7 step 9's evaluator evolution. They do not wait for a human.
  1. The candidate gate **shadow-runs** next to the accepted one, which stays in force. It runs on
     the fixture corpus (known-valid, known-invalid, including the `a198907`/`c4bb14d`/`9cfdea4`/
     `af2c737`/`b585a03` replays and the F-rows) and on live ticks.
  2. **Promotion rule, evaluated by the accepted gate:**
     - the candidate refuses everything the accepted gate refuses (**no weakening**);
     - it agrees on the known-valid cases;
     - its own must-fail controls refuse;
     - it has soaked on node 1 for N ticks.
  3. If it accepts something the accepted gate refuses, that is a widening. It is promotable only
     with criterion evidence relevant to the newly accepted class, and never on evidence the
     candidate produced itself.
  4. On promotion, `accepted.sha` and `accepted/` are swapped atomically, an L12 record is written,
     and humans are informed.
  5. A candidate that would weaken its evidence source, its controls or its acceptance rule
     cannot certify itself: the judge is the old version.

### The intervention path (humans informed, never gating)
- **Informed.** Every limit change and gate promotion emits a notice to the surface humans
  actually read (C18): the human-surface workbench, routed by `humanAskRoute`. The notice carries
  the change, the evidence ids, the L12 record and a one-step undo. Delivery is checked *by
  effect*: a read receipt, or a gap if it is unread past a window (the 248-escalations
  precedent).
- **Hold.** A human, or a detector, writes a C20 `quarantine {target: shape|gate|repo, reason,
  expires_at}`. The criterion runner and pull-sync read holds **first**, every tick:
  - a held limit reverts to its previous record and is not re-widened until the hold expires;
  - a held gate candidate is not promoted;
  - a held repo is not deployed past its current revision.
- **Revert.**
  - For a limit: the operator CLI or cockpit writes `limitRevert {shape, to_sha12}`. The criterion
    runner applies it (a revert is always a permitted tightening) with an L12 record.
  - For a gate: `accepted/` keeps the previous K versions, and `substrate-pull-sync rollback-gate`
    (host CLI, bootstrap tier) restores one.
- **Nothing blocks on the operator.** Absent a hold, the system proceeds on evidence.

### Slices
| Slice | Status | Operator step |
|---|---|---|
| S0 (A) env scoping + secrets drop-in | kept, landed | none |
| **P: pinned judge, 847025e2 change, staged channels** | **new, first.** Until it lands, a lane push changes root code on every node within one tick. | none |
| S1a unit-ctl helper | kept | none |
| S1c confinement while still root | kept: `ReadOnlyPaths` gains `/workspace/judge` and `/var/lib/substrate-pull-sync` (inaccessible); loses `/workspace/steward` and `/workspace/operator` | none |
| S2 root never runs lane-writable bytes | kept (mirrors are candidates; only `accepted/` executes) | none |
| S3 lane uids | kept; adds the `substrate-judge` uid | none |
| **L: criterion runner + proposal/effective split + hold/revert + informing** | **new** (replaces S1b and S1d) | none (humans informed) |
| S5 fleet-wide confine | kept | none |
| S1b trust-root move / steward / S4 signatures / operator policy dir / accept records | **dropped** | — |
| secret_set phase 1 | kept as the host CLI (secret values stay out of agent reach) | operator-run by nature; not in any deploy or limit path |

**Order:** S0 → **P** → S1a → S1c → S2 → S3 → **L** → S5.

### Falsifiers (each with a positive control through the same address)
| # | Must fail | Positive control |
|---|---|---|
| J1 | a lane in-process write to `/workspace/judge/limits.json` → EROFS/EACCES | the criterion runner's write → ok, L12 present |
| J2 | a `limitChangeProposal` widening `spendEnvelope` with **high claimed confidence**, citing evidence ids produced by its own execution or descendants → refused by the criterion (§7 step 9 "stays refused despite high confidence") | the same proposal citing prior, independent, accepted-graded, relevant rows → applied |
| J3 | a scope widening for path P citing only successes in nearby paths → refused | relevant P outcomes → applied |
| J4 | `847025e2` replay: a lane-pushed pull-sync on a scratch channel is **not exec'd**; the tick runs `accepted/` | a candidate passing shadow and promotion → swapped, L12 present |
| J5 | a candidate gate that accepts one known-invalid fixture the accepted gate refuses → not promoted | an equivalent-or-stricter candidate → promoted |
| J6 | a `quarantine` on `spendEnvelope` → the criterion reverts and refuses re-widening until expiry, within one tick | the hold expires → the criterion resumes |
| J7 | a notice unread past the window → gap filed | a read notice → no gap |
| F1–F6, F9, F10 | runtime locality rows (secrets, `/proc/<pid>/root`, systemd sockets, unit-ctl, protected install targets, uids), as defined above | root control |

### Delta 3, closing H1–H5 (qa-approved; P is built first)

**Framing for the user:**
> The system changes its own limits. The code that *applies* a change is always the
> already-accepted version, never the change being proposed.

This is a property of the *writer*, not a class of record.

**H1. Bootstrap.**
- P itself lands through the **old run-on-arrival path** (`847025e2`). That is the last commit
  allowed to judge itself, and this is stated, not hidden.
- On its first tick, P writes `accepted.sha = <P's commit>` and stages `accepted/` from it. It
  records this as an **L12 bootstrap intervention** (`decided_by:"bootstrap"`, sha, node, time).
- From then on, only the pinned path executes.
- P must also carry the **break-glass**, because it freezes the gate. A parseable but broken
  accepted pull-sync would otherwise freeze self-update fleet-wide (gap
  `a-parseable-but-broken-pull-sync-freezes-self-update-fleet-wide-with-no-image-break-glass`).
  - The break-glass is `substrate-pull-sync rollback-gate [--to <sha>|--image]`, a host-run CLI.
  - `--image` restores `accepted/` from the image's own copy at
    `/usr/local/share/substrate/super-repo/…`, so it works even when every staged version is bad.
  - It writes an L12 record.
  - It is bootstrap tier, and it is the one operator action that is a recovery path rather than a
    gate.

**H2. The fixture corpus belongs to the accepted version.**
- The known-invalid replays (`a198907`, `c4bb14d`, `9cfdea4`, `af2c737`, `b585a03`), the F-rows,
  the J-rows and the known-valid set are read from `accepted/`, never from the candidate.
- A candidate may **add** fixtures. They join the corpus once that candidate is promoted.
- A candidate that **removes or edits** an existing fixture or control is a widening, judged as
  such. That is the `6ac1aa6` class.

**H3. Evidence independence is checked by dispatch provenance, not lineage alone.**
- *Why lineage is not enough:* a lane could `run_goal` a fresh, "unrelated" execution to
  manufacture evidence.
- An `evidence_id` counts only if one of the following holds:
  - it is an **observation of real consumer use** (§2.2): a downstream consumer's execution read
    the output, and the consequence was observed;
  - or the accepted harness walks its dispatch chain (`dispatch_id`, parent dispatch, `operator:`
    tag, `proposer_execution_id`) and finds **no ancestor** in the proposer's dispatch lineage,
    **and** the row is older than the proposal by at least W. W is a limit shape, so the
    criterion can only tighten it on its own authority.
- Rows dispatched by the proposer's lineage are refused, however many there are.

**H4. A hold is requested by anyone and held by the judge.**
- Anyone may write a `quarantine` **request**: an operator, a detector, or the lane. It is a
  tightening, so the judge applies it within one tick.
- The **effective** hold is a record in the judge's store (`limits.json`).
- It ends only by expiry, or by the criterion acting on evidence relevant to the reason for the
  hold.
- Deleting or retiring the request does not lift the effective hold.

**H5. Canary placement by blast radius.**
- *Facts:*
  - node 1 = `substrate-live`, a standalone node, not the hub;
  - the hub = syzygy, remote, user-operated, with the lane off;
  - node 2 = `compose2-live`, compute, the most productive lane;
  - pubspoke = a public spoke that external joiners use.
- **Root-code and gate changes** (pull-sync, `accepted/`, unit-ctl, unit files and drop-ins,
  the criterion runner) go **node 2 → node 1 → pubspoke → hub (last)**.
  - Node 2 is the lowest-blast-radius node that runs the lane. A break costs lane throughput and
    affects no external human. Nothing else depends on node 2's gate. Break-glass is local.
  - pubspoke goes after node 1 because external joiners see it.
  - The hub goes last, and only after soak on all three.
- **Vessel code** canaries where the lane lives: node 2 or node 1, whichever authored it, then the
  same order.
- Each step needs N ticks with no regression signal on the previous node, judged by the
  *receiving* node's accepted gate.
- The channel assignment is a limit shape, so the criterion may change it.

**J7 refined.**
- The read receipt names its reader: the human-surface workbench (`/vessels/human-surface-vessel/
  ui/dist`, :8310 via the sidecar route), the route `humanAskRoute` chose, and the reading
  identity.
- Notices are written by the **judge** into its own store, and the workbench reads them through a
  path that does not depend on development-vessel or goal-host. Humans can therefore read them
  while the lane is unhealthy.
- An unread notice past the window files a gap.

**New and changed J-rows:**

| # | Must fail | Positive control |
|---|---|---|
| J2′ | a proposal citing evidence that **its own dispatch lineage** produced (a fresh `run_goal` it dispatched), however recent or numerous → refused | consumer-use observations, or rows independent of that lineage and older than W → applied |
| J6′ | the lane deletes the hold request → the **effective** hold persists and re-widening stays refused until expiry or a criterion decision | expiry → lifted |
| J8 | a candidate that edits or removes an existing known-invalid fixture or F-row → classified as a widening, not promoted on parity | a candidate that adds a fixture → promoted, fixture joins the corpus |
| J9 | after P's bootstrap, a lane-pushed pull-sync is not exec'd (= J4 on node 2 first) | `rollback-gate --image` restores a working gate with every staged version corrupted (scratch node) |

### Delta 3, self-sufficiency (user requirement 10-02)

**User requirement (verbatim, via qa):**
> "We must consider that the system will need to build its own vessels, implement these sorts of
> security checks, hold and release on its own, manage its own develop and risk. And operate under
> the system's principles."

REALIGNMENT §7 step 9's "human-governed" category is **not** treated as binding here. qa is asking
the user about the plan text.

**1. Minimal bootstrap.**
- **The irreducible, operator-built piece is P's core:**
  - the small root **gate runner**, which executes `accepted/`, stages and promotes, keeps the
    history, and writes the ledger;
  - the operator's **break-glass**.
- **Everything `accepted/` contains is authored by the system through its lane**, as shaped policy
  or activities the system grades, varies and retires (law 2), never as operator-owned bash:
  - the change classifier (its path rules are data, `gate-policy.json`);
  - the evidence harness and must-fail rows;
  - the criterion runner;
  - the unit-ctl verb list;
  - the confinement drop-ins;
  - the secrets manifest;
  - the vessel template.
- Gate pieces are promoted by the **shadow path**. Limits are changed by the **criterion**.
- **The lane path to author each piece:** `feature_compose` / `gap_to_feature` against the
  piece's file under `scripts/substrate/` or `repos/<v>/`. The landing goes to `dev`, the
  candidate is judged by `accepted/`, and promotion follows.
- **Today's blocker is itself a limit, not a wall.** The live `autonomyScope` excludes
  `scripts/substrate/` and the unit-relevant vessel files, so the lane cannot author any of these
  yet.
  - That exclusion is a limit, so the criterion lifts it per path, on evidence relevant to that
    path.
  - Until it does, these pieces evolve only by operator dispatch through the cockpit: still the
    lane path, still traced, still judged by `accepted/`.

| Piece | Lives in | The system authors its next version via | Promoted by |
|---|---|---|---|
| gate runner (P core) | `scripts/substrate/gate/gate-runner.sh` | **not the lane**: operator-built, irreducible, kept small | operator (bootstrap tier) |
| classifier rules, protected-path list, soak N, canary order | `scripts/substrate/gate/gate-policy.json` | lane edit, then a candidate | shadow path; the N/order *values* in force are limits the criterion can override |
| evidence harness + must-fail and J fixtures | `validation/scripts/gate/*.test.sh` + `fixtures/` | lane edit (add = ordinary; edit/remove = widening, H2) | shadow path |
| pull-sync (the gate body) | `scripts/substrate/substrate-pull-sync.sh` | lane edit | shadow path |
| criterion runner (L) | `scripts/substrate/judge/` | lane edit | shadow path |
| unit-ctl verb list (S1a) | `scripts/substrate/unit-ctl/verbs.json` | lane edit (a new verb = widening) | shadow path |
| confinement drop-ins (S1c/S5) | `scripts/substrate/units/vessel.d/*.conf` | lane edit (loosening = widening) | shadow path |
| secrets manifest | `scripts/substrate/secrets-manifest.json` | lane edit (a new consumer = widening) | criterion, on evidence |
| vessel template | `development-vessel vessel-mitosis-start.ts:428,489,536` | lane edit | ordinary change; its output is checked by the harness |

**2. New vessels are ordinary changes, secure by default.**
- **The template change.** It emits the unit with:
  - the `vessel.d/50-confine.conf` drop-in attached (S5 properties);
  - `ExecStart=/usr/local/bin/bun`;
  - a scoped `EnvironmentFile` only for names the manifest grants it;
  - its own uid (`DynamicUser=` or a declared static one) when it declares model-directed tools.

  Today the template emits `EnvironmentFile=/etc/substrate/env` and `/root/.bun/bin/bun`
  (`vessel-mitosis-start.ts:428,536`). That is the first lane-authored change this design asks
  for.
- **The harness rows the gate runs on every candidate unit**, including new ones:
  - `secret-scope-lint`;
  - drop-in presence;
  - the effective-property check: empty capability set, both sockets inaccessible,
    `ProtectSystem=strict`.
- **A new secret consumer** declared in the manifest is the widening class. The criterion judges
  it on evidence, for example that the vessel's validated consumer use needs that credential.
  No human is in that path.

**3. Hold and release on its own.**
- Detectors place holds: a must-fail breach, a regression, an anomaly in spend or failure rate.
- The criterion releases a hold once the condition that caused it has cleared on evidence. The
  evidence must be relevant to the hold's reason and independent per H3.
- H4 stands: deleting a request never lifts the effective hold.

**4. Own risk.** Soak N, canary selection, rollout order (H5), the widening and tightening bars,
evidence age W, and hold TTLs are all **limits**, adjusted by the criterion. Humans are informed
(J7) and can intervene (holds, reverts).

**New J-rows:**
| # | Must fail | Positive control |
|---|---|---|
| J10 | a system-authored new vessel **without** the confine drop-in → refused by the accepted harness; not deployed | the same vessel produced by the template → deployed confined, own uid, with no operator step |
| J11 | a new vessel declaring a secret consumer without relevant evidence → refused by the criterion | with evidence → granted, L12 record |
| J6″ | n/a | a detector-placed hold (regression) is **released by the criterion** after the regression clears, with no human |

---

## BUILD SPEC: P (pinned judge). The first slice; operator-built core.

### State (on the volume; recreate-safe)
`/workspace/.gate/` — `root:root 0700`, `InaccessiblePaths` in every lane and S5 namespace.
- `accepted.sha`, `accepted/` and `history/<sha>/`, keeping the last K=5 versions.
- `accepted/MANIFEST.json`:
  `{sha, staged_at, files:{relpath: sha256}, gate_paths:[globs from gate-policy.json]}`.
- `ledger.jsonl`: L12 records `{at, kind: bootstrap|promote|rollback|integrity_fallback|hold, sha, from_sha, by, evidence}`.
- `promote.request`, written only by the accepted gate body.

### Files
1. **`scripts/substrate/gate/gate-runner.sh`** (core, about 150 lines, POSIX sh). Installed to
   `/usr/local/libexec/substrate/gate-runner` by `Dockerfile.substrate`, and by the old pull-sync
   path once (bootstrap).
2. **`scripts/substrate/units/substrate-pull-sync.service`:** `ExecStart=` becomes
   `/usr/local/libexec/substrate/gate-runner tick`. A drop-in on development-vessel and
   local-tools adds `InaccessiblePaths=/workspace/.gate`.
3. **`scripts/substrate/substrate-pull-sync.sh` (the gate body, inside `accepted/`):**
   - When `PULLSYNC_ACCEPTED_DIR` is set, it **removes the 847025e2 SELF-CONVERGE re-exec**.
   - It runs every glue, suite and lint script from `$PULLSYNC_ACCEPTED_DIR`, never from the
     clone or `/usr/local/bin`.
   - It classifies each super-repo range against `MANIFEST.gate_paths`:
     - **Gate paths touched:** it does not install those paths. It runs the shadow evaluation (4).
       On pass plus canary soak it writes `promote.request {sha, verdict_trace_id}`. On fail it
       files an `authority_widening`/`gate_candidate_refused` gap. Other paths keep converging.
     - **Otherwise:** the existing behaviour.
4. **`scripts/substrate/gate/shadow-eval.sh`** (in `accepted/`). It runs the accepted fixture
   corpus (`validation/scripts/gate/*.test.sh`, read from `accepted/`) with
   `PULLSYNC_BIN=<candidate's pull-sync staged in a scratch dir>`, under
   `setpriv --reuid=nobody --no-new-privs`, with a throwaway `WORKSPACE_ROOT`.
   - **Pass** means every expected-refuse fixture is refused and every expected-accept fixture is
     accepted.
   - A candidate whose corpus diff edits or removes an existing fixture is classified as widening
     (H2).
5. **`gate-policy.json`:** `gate_paths`, soak N per channel, the H5 order. It is data, and
   law-2 shaped.
6. **Tests**, `validation/scripts/gate/`: `j1-gate-dir.test.sh`, `j8-fixture-edit.test.sh`,
   `j9-no-self-exec.test.sh`, `break-glass.test.sh`, plus the migrated `pull-sync-*.test.sh`.

### The gate runner's exact responsibilities (and nothing else)
1. **`tick`:**
   1. Take the `flock`.
   2. **Bootstrap if `accepted.sha` is missing.** Stage from the super-repo's `HEAD` (P's commit)
      with `git archive`, build the MANIFEST, and append a `bootstrap` record.
   3. **Verify `accepted/` against the MANIFEST sha256s.** On a mismatch, or after 3 consecutive
      ticks where the body exits with code ≥ 2 or 124/137, restore `history/<previous>` and append
      an `integrity_fallback` record. If no history is valid, refuse to run and emit a gap line to
      the journal. It **never** falls back to the image automatically: the image is built on every
      push to `dev` (`build-substrate-image.yml:17-18`), so it is unjudged.
   4. If `promote.request` exists, check that its sha is in the super-repo mirror. Then stage that
      sha's files via `git archive <sha> -- <MANIFEST paths ∪ the candidate gate-policy's paths>`
      into `accepted.new/`, build its MANIFEST, rotate `accepted → history/<old>`, rename
      `accepted.new → accepted`, write `accepted.sha`, append a `promote` record, and delete the
      request.
   5. `exec env PULLSYNC_ACCEPTED_DIR=/workspace/.gate/accepted sh accepted/substrate-pull-sync.sh`.
2. **`rollback-gate --to <sha>|--previous|--image`** (operator, host `docker exec`):
   - restores from history, or from `/usr/local/share/substrate/super-repo` for `--image`, which
     is the image the operator chose to run;
   - appends a `rollback` record.
3. It **never** executes anything from the mirror, a clone, the candidate, or `/usr/local/bin`.

### Tests, each with a positive control; error codes and verdicts only
| Test | Must fail | Positive control |
|---|---|---|
| **J1** | From inside development-vessel's process (`authority_probe`): `open("/workspace/.gate/accepted/substrate-pull-sync.sh", O_WRONLY)` and `opendir("/workspace/.gate")` → ENOENT/EACCES. *While the lane is still root, this binds against plain opens. Remount resistance arrives with S1c's capability drop; stated.* | `systemd-run --uid=0` → ok |
| **J8** | A candidate commit editing an existing fixture in `validation/scripts/gate/fixtures/` → classified widening, no `promote.request`, gap filed | A candidate adding a fixture → shadow pass → promoted after soak; fixture is in `accepted/` |
| **J9** | A pushed `substrate-pull-sync.sh` containing a marker side effect (touch `/tmp/j9-ran`) → after a tick, `/tmp/j9-ran` is absent; `accepted.sha` unchanged | The same file passing shadow eval → promoted, then runs |
| **break-glass** (scratch container only) | Corrupt `accepted/` and every `history/*` → the runner refuses to run (no body exec) and logs a gap line | `rollback-gate --image` → the next tick runs; `rollback` record present |
| **integrity fallback** | Corrupt one `accepted/` file → that file's content is never executed | `history/<previous>` restored automatically, record present |
| **bootstrap** | — | First tick on P: `accepted.sha` = P's commit, a `bootstrap` record, nothing exec'd from the clone |

### Rollout (H5)
1. Land P on `dev`. It arrives through the **old** run-on-arrival path, the last self-judged step,
   stated.
2. **node 2 (`compose2-live`)** first. Confirm the `bootstrap` record, then run J1, J9 and the
   integrity tests live, for N ticks.
3. Then **node 1** (`substrate-live`), then **pubspoke**, then the **hub** (syzygy) last, by
   user-run pull. Each step needs N ticks clean on the previous node.
4. The break-glass test runs only on a scratch container, never on a live node.
5. **Restart plan:** pull-sync is a timer-driven oneshot, so its unit change takes effect at the
   next timer fire after `daemon-reload`, which pull-sync's own convergence does. No vessel
   restart is needed for P.

### L input queue (qa, 2026-10-02, on P review)
Until the criterion runner exists, a gate candidate classed `widening` ends at an `authority_widening` gap and exit 0 (never promoted). Under the 10-02 user ruling widenings are decided by the criterion on evidence, not left for a human, so slice L MUST consume open `authority_widening` gaps as its input queue (and the `limitChangeProposal` shape): each is either applied by the accepted criterion on relevant, independent evidence, refused with the reason recorded, or held with a TTL. Acceptance for L includes: no `authority_widening` gap older than its TTL without a criterion verdict, so these never accumulate into a de facto human gate.

### S3 F-row 4 probe (carried from reverted local-tools f4ceb0f, user decision 2026-10-02)
Source: `steward/s3-probes/shell-proc-isolation.probe.ts`. The S3 build commits it as an authority_probe run INSIDE local-tools-vessel's real service process (not the vessel's bun suite, and not by importing index.ts). Rows: RED = open() of /proc/1/environ and /proc/1/cmdline through shellResult and bounded_shell must fail with EACCES/ENOENT; controls = a same-uid dummy fixture still opens; ordinary commands and a repo-file read still work. open()-errno only, never read(). Measured: uid alone leaves cmdline (0444) openable; ProtectProc alone does nothing for root; own uid + ProtectProc=invisible (+ProcSubset=pid, NoNewPrivileges) = 9/9. On landing, re-arm gap walk-shell-commands-can-read-other-processes-environ-and-argv with this probe as its falsifier.

### L J-row: no second producer can override the judge (qa, 2026-10-02)
Readers of effective limits must not use "newest across registered producers" (readNewestPoolRecord): discovery does not enforce registration identity, so a lane-registered poolImpulse producer serving a newer record would win. Close by LOCALITY (no trust store): readers read the judge's record directly (read-only bind, same node) or ask only the producer whose identity is the judge's uid/unit, verified by SO_PEERCRED on a local socket. J-row: a lane-registered fake poolImpulse producer serving a newer spendEnvelope -> readers still return the judge's record. Positive control: the judge's own update is read within one tick. Gap: any-local-process-can-register-a-second-policy-producer-and-readers-take-the-newest-record-so-the-judges-single-writer-is-bypassable (HIGH).

### Intervention (L12, operator record edit, pre-criterion): autonomyScope widened 2026-10-02
User ruling (given in deployment's session; qa's wider kept set confirmed by the user): lift scripts/substrate/ from autonomyScope excluded_paths, keeping excluded the gate (gate/), all units (units/, units/vessel.d/), render-unit.sh, secret handlers (secrets-manifest.json, render-secret-scope.sh, secrets.env.sh, seed-identity.{ts,js}, setup-git-push.sh, substrate-key.sh, substrate-doctor.sh, reseed-restart.sh, render-llm-arms.sh, gen-env.sh), host-run scripts (substrate-install.sh, deploy-hub.sh, deploy-hub-pull.sh, deploy-remote.sh, spoke-federate.sh, substrate-config.sh, Makefile) and substrate-pull-sync.sh (until its secret handling is split, S2/S3). Applied by the user's hand (the classifier treats it as a permission grant). Node 2: updated_at 2026-10-02T21:03:41.830Z, 28 → 50 excluded, verified by the coordinator. Node 1: pending (write refused by node 1 dev-vessel event-loop stalls; gap node-1-development-vessel-event-loop-stalls-time-out-its-own-outbound-calls). Under Delta 3 a widening should come from the criterion runner (slice L, not built); this is the accepted operator interim. First lane slice under it: self-repair-operational.ts (the hold gap), node 2 canary.
- Node 1 applied 2026-10-02T22:37:25.664Z (28 → 50, same diff as node 2), after deployment restarted node 1 development-vessel (event-loop stalls cleared as an instance patch; gap stays open). Side effect: node 2 rewritten at 22:37:26.066Z with the reason note duplicated (harmless; tidy on next edit). Both lane nodes now admit the same scope.
- REVERTED (user ruling, 2026-10-02 ~22:50Z, via deployment's session; the user's hand): autonomyScope restored to the saved 28 excluded_paths (scripts/substrate/ wholesale) on the lane nodes. Cause: lane-editable scripts under scripts/substrate run as root timer units that never had the secret mask, and the admin.env mask is defeated by rename-rewrite (gap the-admin-env-mask-is-defeated-whenever-the-file-is-rewritten-so-every-vessel-can-read-the-admin-key). Re-apply condition (recorded on the record): the default-deny secret mask covers every substrate unit and is verified by effect on all nodes. Re-apply = the same apply script; the self-repair slice gets its class2 falsifier then.
- Revert applied by the user: node 1 2026-10-02T23:07:10.516Z, node 2 23:07:10.963Z (back to 28; scripts/substrate/ wholly excluded; reason history keeps widening + revert cause + re-apply condition). Widening live 21:03:41–23:07:10 (node 2), 22:37:25–23:07:10 (node 1). Coordinator check of the window: 0 lane picks naming scripts/substrate on either node, 0 autonomous super-repo commits since 21:00; 1 open class2 gap with a scripts/substrate edit_site existed but was not picked.
