How to follow along: every task under `repos/<vessel>/src` is dispatched as a goal, never
edited by hand; the verbatim goal text is in `goals/<task>.txt`, and each names the
landing marker (the literal string that must appear as an added line in the landing
commit's diff — pass it as the harness's `M_OVERRIDE`). A task is done when the marker is
in a commit on the push clone, the vessel restarted after it, the runtime file equals the
clone (`cmp /vessels/<v>/src/<file> /workspace/git/vessels/<v>/src/<file>`), and the
falsifier's positive AND negative control both read as stated. Operator-tier tasks are
marked; they are config or bring-up steps an agent performs by hand, with the README as
the only source of launch commands. Nothing here is dispatched while an acceptance
sequence for another change is running on the node.

## 0. Preconditions (verify, do not build)

- [x] 0.1 `PEER_FANOUT_MODE` is not overridden: `/etc/substrate/env` on the node has no
  `PEER_FANOUT_MODE=` line, or it reads `union`. Falsifier: a `vesselCapability` query
  for `feature_compose` returns both a local row and a `@<substrate>` peer row.
- [x] 0.2 resumable-landings 2.2 is live on the node: pull-sync's `restart_age_defer`
  reads `in_flight_oldest_ms` from `/health` (breadcrumb carries an age, not a count).
- [x] 0.3 The second node's substrate name differs from the first's (`SUBSTRATE_NAME`),
  so the transport mirrors its rows as `<vesselId>@<name>` and they do not collide in the
  union merge. The second node MUST NOT set `DISCOVERY_ENDPOINT` at the first node: the
  development-vessel unit hardcodes `VESSEL_ID=development-vessel-local`, and a direct
  registration under that id would overwrite the first node's composer row.
  Verified at stage 1: node 2 is `compose2` with its own loopback discovery; node 1's registry
  still holds only its own `development-vessel-local` row.

## 1. Ownership at pick time (development-vessel)

- [x] 1.1 `repos/development-vessel/src/resolvers/gap-to-feature.ts`: add
  `ownedVessels()` reading `vesselsCloneRoot()/<v>/.git` (the existing helper, `VESSELS_CLONE_ROOT`)
  at call time, and make `admitActionableGaps` skip a gap whose `identifyVessel` result
  is not owned, excluding it with reason `not owned here(<vessel>)` (the loop's existing
  `excluded.push` idiom) without incrementing the gap's backoff. Goal: `goals/1.1-owned-vessels-admission.txt`. Marker:
  `not owned here`. Falsifier (on the second node only, or on the first node with a
  scratch `VESSELS_CLONE_ROOT` — never by moving the first node's live clones, which
  the cutover and any acceptance harness read): remove one clone from the owned set for
  two admission passes → its gaps are skipped with that line and their
  `failed_attempts` unchanged; restore → admitted again. Negative control before
  landing: the same removal changes nothing in admission — on the old code no admission
  path reads the clone directory (the only two reads, a phantom-file check and
  `vesselsCloneRoot()`, serve other purposes). Status: landed as development-vessel
  `c293bb6` (substrate-authored), reading its root through `vesselsCloneRoot()`.
  Positive falsifier runs on the second node.
- [x] 1.1b `repos/development-vessel/src/resolvers/gap-to-feature.ts`: an EMPTY owned set
  means ownership is unknown, not "nothing owned". As landed, 1.1 excluded every gap when
  the clone root was missing or empty, which broke
  `test/resolvers/gap-to-feature-admission.test.ts` ("EXCLUDES a no-producer orphan and admits
  the proven-landable + fresh-orphan paths") in pull-sync's candidate run. pull-sync then
  refused to converge development-vessel. Reproduced off-lane with `VESSELS_CLONE_ROOT` set to an
  empty dir; with the fix the test passes both ways (5/5). Goal:
  `goals/1.1b-owned-set-empty-means-unknown.txt`. Marker: `ownedSet.size > 0`. Falsifier:
  pull-sync's next development-vessel pass converges instead of logging TEST REGRESSION.
  Status: landed as development-vessel `79562c7` (the exact guard); development-vessel restarted
  onto it at 06:49:16.
- [x] 1.2 `repos/development-vessel/src/resolvers/gap-to-feature.ts`: the object in the
  `[gap-to-feature] pick` log line carries `owner` (the node's `SUBSTRATE_NAME`) as its
  first property. Goal: `goals/1.2-pick-line-owner.txt`. Marker:
  `owner: process.env["SUBSTRATE_NAME"]`. Falsifier: journal pick lines after restart
  read `pick {"owner":"<name>",…`. Status: landed as development-vessel `b2f30d3`.

## 2. Owner pin in discovery and goal-host routing

- [x] 2.0 `repos/development-vessel/src/routes/impulses.ts`: serve `composeOwnership`
  (`{ node, owned_repos }`, from `ownedVessels()`). Discovery's capability projection
  cannot carry the field: discovery-vessel is a protected vessel and
  `vessel_mitosis_cutover` refuses every cutover on it (see design). Goal:
  `goals/2.0-serve-compose-ownership.txt`. Marker: `case "composeOwnership":`.
  Falsifier: resolving `{type:"composeOwnership"}` at development-vessel returns this
  node's name and the sorted clone set; on the second node it returns only its owned set.
- [x] 2.1 `repos/development-vessel/src/config.ts`: advertise `composeOwnership` in the
  discovery shapes list so a remote caller reaches it through the transport. Goal:
  `goals/2.1-advertise-compose-ownership.txt`. Marker: `"composeOwnership",`.
  Falsifier: a `vesselCapability` query for `composeOwnership` lists development-vessel.
  Status (2.0 + 2.1): landed together as development-vessel `df0ffe1` (substrate-authored;
  the compose added the advertisement in the same commit and imports `ownedVessels`
  dynamically inside the case). development-vessel restarted onto it; runtime equals the
  clone; resolving `composeOwnership` returns `node: substrate` and exactly the 19 repos in
  the clone directory (positive falsifier on the first node). Second-node half pending.
- [x] 2.2 `repos/goal-host-vessel/src/index.ts`: in the early edit-intent block, derive
  the target vessel from `earlyEditFile` (`repos/<vessel>/…`), prefer the row whose
  `owned_repos` includes it, else fall back to `pickSatisfierProducer`; log
  `routed by ownership → <vesselId>` or `routed by pick`. Goal:
  `goals/2.2-route-by-ownership.txt`. Marker: `routed by ownership`. Falsifier: with
  two rows claiming different vessels, an edit goal for each lands on the claiming
  node's clone (commit appears in that node's `/workspace/git/vessels/<v>`); with one
  row, the log reads `routed by pick` and behaviour is unchanged.
  Status: landed as goal-host `51b5336` (substrate-authored); goal-host restarted onto it,
  runtime file equals the clone, and with no row advertising `owned_repos` every edit
  goal logs `routed by pick` (negative control holds). Positive half waits on 2.0, 2.1,
  2.2b and the second node.
- [x] 2.2b `repos/goal-host-vessel/src/index.ts`: when more than one `feature_compose` row
  exists and none carries `owned_repos`, resolve `composeOwnership` on each row (3 s
  timeout; a silent producer claims nothing) before choosing. Goal:
  `goals/2.2b-resolve-ownership-per-row.txt`. Marker:
  `pointer: { type: "composeOwnership" }`. Falsifier: with two nodes, an edit goal for a
  repo the second node owns logs `routed by ownership → development-vessel-local@<name>`;
  with one row nothing is fetched and the log reads `routed by pick`. Status: landed as
  goal-host `2c0aad9`, exactly the requested block.
- [x] 2.3 `repos/goal-host-vessel/src/index.ts`: two rows claiming the same vessel file
  `compose-ownership-duplicate-<vessel>` once (open-gap check first). Goal:
  `goals/2.3-duplicate-owner-gap.txt`. Marker: `compose-ownership-duplicate-`.
  Falsifier: temporarily give both nodes a clone for one repo → one gap; a second
  edit goal does not file another.
  Status: landed as goal-host `d07b3d6` (substrate-authored, 19 lines); goal-host restarted
  onto it. Positive falsifier needs two nodes.

## 3. Ledger node attribution (development-vessel)

- [x] 3.1 `repos/development-vessel/src/resolvers/attempt-register.ts`: `registerAttempt`
  stamps `node: process.env["SUBSTRATE_NAME"] ?? "substrate"` on the intent and the
  settlement copies it. Goal: `goals/3.1-attempt-node.txt`. Marker: `node: process.env["SUBSTRATE_NAME"]`.
  Falsifier: the next `attemptIntent` and its settlement carry the node name; older
  records are untouched.
  Status: an autonomous recommit of an earlier refused attempt landed `1c7833b`, which
  writes `node: null` on the intent and copies it to the outcome (a hollow write: it passed
  every gate and records nothing). The goal now replaces that null and adds the settlement
  field; marker `node: process.env["SUBSTRATE_NAME"]`.
  Landed as development-vessel `792a9cd`: the intent records the node name and the settlement
  copies it (exactly the requested diff).
- [x] 3.2 `repos/development-vessel/src/resolvers/attempt-checks.ts`: `evaluateChecks`
  takes the target vessel; when `systemctl show <vessel>.service -p LoadState --value`
  (run through the same `Bun.spawn` path `resolveSystemdUnitHealthObserver` already
  uses, which is proven to return data on the node) is not `loaded`, `systemd_units` is
  `unknown` with detail `target not resident on <node>`; a spawn that fails or prints
  nothing is `unknown` with detail `systemctl unavailable`, never treated as resident. Goal: `goals/3.2-non-resident-unknown.txt`.
  Marker: `target not resident on`. Falsifier: register an attempt for a vessel masked by
  `DISABLED_VESSELS` → `unknown` with that detail and settlement `unresolved` on it;
  control: a resident vessel settles `held`.
  Status: landed as development-vessel `cec6c8d`; the original result handling is
  preserved inside an async IIFE. Hollow until 3.2a: its only caller does not pass the
  target.
- [x] 3.2a `repos/development-vessel/src/resolvers/attempt-checks.ts`: `takeSnapshot` passes
  its single repo as `evaluateChecks`' target. Goal: `goals/3.2a-snapshot-passes-target.txt`.
  Marker: `opts.repos?.length === 1 ? opts.repos[0] : undefined`. Falsifier: the next
  post-landing snapshot for a resident vessel evaluates `systemd_units` as before; one
  for a vessel masked by `DISABLED_VESSELS` records `unknown` with `target not resident on`.
  Status: landed as development-vessel `a4923f2` (one line, exactly as requested).

## 4. Second compute node (operator tier)

- [x] 4.1 Owned set for the second node: `development-vessel activity-api
  goal-host-vessel` — the three repos landed most in the evidence window (17, 7 and 1 of
  25 landings), development-vessel first so the first node's composer never restarts
  through its own cutover. Recorded as `SUBSTRATE_PUSH_VESSELS` in the node's `.env`.
- [x] 4.2 Bring up the node per README § Installation (sequence A) with these `.env`
  additions — the gen-env "long form" that states a loopback `DISCOVERY_ENDPOINT` so the
  node keeps its own discovery (its vessels register there, not into the first node's
  registry, where the hardcoded `VESSEL_ID`s would collide):
  `PROFILE=compute`, a distinct `SUBSTRATE_NAME` and `SUBSTRATE_PORT_PREFIX`,
  `DISCOVERY_ENDPOINT=http://127.0.0.1:8100`,
  `HUB_DISCOVERY_URL=http://host.containers.internal:<P1>100`,
  `IDENTITY_VESSEL_URL=http://host.containers.internal:<P1>101`,
  `ACTIVITY_API_ENDPOINT=http://host.containers.internal:<P1>080`,
  `PEER_DISCOVERY_ENDPOINTS` = the first node's discovery plus the hub the org joins,
  `SUBSTRATE_ADVERTISE_HOST=host.containers.internal`, and the first node's
  `METABOB_API_KEY`, `GITHUB_TOKEN`, `FEDERATION_PEER_AUTH_MODE` and
  `FEDERATION_SIGNING_SECRET` (same org, HMAC peer auth). Verify: `/health` on its
  goal-host and development-vessel; its `substrate-status` reports `usable`; its
  development-vessel log shows `registered as development-vessel-local` against its own
  discovery; a `vesselCapability` query on the second node for `feature_compose` shows
  its local row plus the first node's and the hub's as peer rows.
  Status (stage 1, pushing off via `MITOSIS_DIRECT_PUSH=0`): `compose2-live` up, same org,
  `usable`; `composeOwnership` returns `compose2` with exactly the three owned repos; pick lines
  carry `"owner":"compose2"`. Three manual steps were needed, each now a task below (4.0a-c).
- [x] 4.0a `scripts/substrate/gen-env.sh` (operator tier): carry `SUBSTRATE_PUSH_VESSELS` into
  `/etc/substrate/env`. Measured: it was dropped, so `setup-git-push` cloned all 16 repos and
  node 2 claimed ownership of everything; 13 clones were moved aside by hand (not durable
  across a reboot). Falsifier: a fresh compute node boots with only the named clones.
  Needs two edits, both prepared (not applied) under
  `~/.cache/compose-ownership-harness/prepared/`: the gen-env carry, and one environment line
  in the root `docker-compose.yml` (the launch manifest passes only listed variables, so the
  container never saw the setting). Takes effect after an image rebuild.
  Status: both edits applied to the working tree (uncommitted, user-approved); image rebuild
  built at 14:58Z as `localhost/substrate:compose-ownership` (separate tag, so node 1's `:dev`
  is untouched); the image's gen-env and baked manifest both carry the setting. Falsifier
  passed: node 2 recreated on this image (07:04Z) boots with only its three clones; setup-git-push
  cloned nothing further although 13 set-aside clones sit in the same volume.
  Regression found on node 2's next plain restart: its pull-sync had refreshed the glue scripts
  from `origin/dev`, which lacked the uncommitted edit, so gen-env dropped the setting and
  node 2 re-cloned and claimed all 16 repos. Fixed durably by committing and pushing both
  edits (`e31e28dd`, operator identity, user-approved); node 2 re-verification follows its
  next glue refresh. Re-verified 09:03Z after a plain restart: the env file carries both settings
  and node 2 owns exactly its three repos.
- [x] 4.0b Compute profile (operator tier): enable `substrate-pull-sync.timer` on a composer
  node (it is masked in `compute`), or the node runs its image's code and never converges.
  Measured: node 2 booted without any of this change's commits; they were mirrored by hand.
  No code change needed: `ENABLED_EXTRA_VESSELS=substrate-pull-sync.timer` in the node's
  `.env` (supported by apply-inventory and already passed through by the manifest), then
  `docker compose -p compose2 up -d`, which affects node 2 only.
  Verified: after the recreate the timer is active; its first pass (07:10) recorded a test baseline
  and mirrored development-vessel `d58105a` into node 2's runtime (live equals clone).
- [x] 4.0c Node 1 advertises a dialable endpoint (`SUBSTRATE_ADVERTISE_HOST`), then restarts.
  Measured: node 1's `feature_compose` row is `http://localhost:8090`, so node 2's peer merge
  drops it and neither node can route a compose to the other.
  Done under 4.5(b): per-vessel `VESSEL_ADVERTISE_ENDPOINT=http://host.containers.internal:18090` on node 1's
  development-vessel (container-wide `SUBSTRATE_ADVERTISE_HOST` rejected: it would re-point every vessel).
- [x] 4.0e A composer node needs a model it can dial. The compute profile masks llm-resolver, and
  the first node's `llm_completion` row advertises a loopback endpoint that a peer's merge
  drops, so node 2's `feature_compose` failed with "endpoint discovery failed (llm=false)"
  (stage 1's "usable" check passed only because a plain resolve is forwarded whole to a peer).
  Fixed on node 2 by config: `ENABLED_EXTRA_VESSELS` adds `llm-resolver-vessel.service`, with
  the first node's OpenRouter key. Verified 09:57Z: one local `llm_completion` producer, six arms.
  Shared quota: until an llm budget shape exists, node 2 runs only inside agreed windows, and
  with `COMPOSE_MAX_CONCURRENT=1` when left running.
  Operator lesson from the window: a named maintenance lease taken while the node still runs
  image code older than named leases is taken as the unnamed lease, which blocks every name,
  cutovers included. It refused node 2's own 4.5(a) cutover until released and re-taken by name.
  Take named leases only after the node runs current code.
- [x] 4.0f A composer node's compose workspace must install the vessel's dependencies. On node 2,
  `feature_compose` failed verify with `INSTALL_EXIT=1 … Cannot find module
  '@avigopal/ias-executor-ts'` (12:2xZ, dispatch d825156b), so only the patch_with_tools fallback
  could produce a verified patch there. Find what node 1 has that node 2 lacks (the super-repo
  checkout of ias-executor-ts, a registry credential, or a workspace link) and supply it through
  the node's boot configuration, not by hand.
  Lead: development-vessel declares `"@avigopal/ias-executor-ts": "file:../ias-executor-ts"`, so
  the compose workspace needs an `ias-executor-ts` checkout beside the vessel; node 1 has it at
  `/workspace/git/super-repo/repos/ias-executor-ts`. Check whether node 2's super-repo submodules
  are checked out (likely not on a compute node) and make the boot initialise the ones the
  owned vessels' `file:` dependencies need.
  Confirmed on node 2's volume: every super-repo submodule is uninitialised (`git submodule
  status` prefix `-`) and `repos/ias-executor-ts` is an empty directory. Instance fix on node 2:
  `git -C /workspace/git/super-repo submodule update --init repos/ias-executor-ts` (persists in
  the volume). Durable fix (operator tier): the boot step that creates the super-repo clone
  initialises the submodules the node's owned vessels' `file:` dependencies name.
  Instance fix applied on node 2 at 13:05Z: `repos/ias-executor-ts` checked out at `7d2c5ab`.
  Second half: `ias-executor-ts` resolves through `./dist/` (`main`/`types`), and `dist/` is gitignored,
  so a fresh checkout has no build output (107 × TS2307 in the compose layout). Built on node 2
  (`bun install && bun run build`, 13:2xZ); the compose layout then typechecks with 0 errors.
  Correction (13:5xZ): that layout was the wrong one. `feature_compose` symlinks the worktree's
  `node_modules` to the PUSH CLONE's, so the dependency resolves as
  `/workspace/git/vessels/development-vessel` → `../ias-executor-ts` (the ias-executor-ts push clone),
  and bun had copied that package into the clone's `node_modules` before any `dist/` existed. The
  routed compose therefore failed its baseline (`baseline-typecheck-broken-repos-development-vessel`,
  107 × TS2307, 13:25:28). Fixed on node 2: build `/workspace/git/vessels/ias-executor-ts`, then
  `bun install` in the development-vessel clone; the clone typechecks with 0 errors and stays clean.
- [x] 4.0g (operator tier) Make 4.0f durable: the boot step that creates a node's super-repo clone
  builds each push clone that an owned vessel names as a `file:` dependency (`bun install && bun run
  build`) BEFORE installing the owning vessel's clone, so the copied package carries `dist/`; a fresh
  composer node then needs no hand steps.
  It must also initialise the super-repo checkouts of the node's OWNED repos: `feature_compose`
  grounds from `super-repo/repos/<vessel>`, and with those uninitialised node 2 refused a routed goal
  with "Grounding window (0 bytes)" (a0ad176c, 14:22Z). Instance fix on node 2 at 14:4xZ:
  `git submodule update --init repos/development-vessel repos/goal-host-vessel repos/activity-api`. Falsifier: a
  freshly created compute node's first `feature_compose` on development-vessel passes install and
  typecheck.
  Done: super-repo `dc38d548`, section 3b of `setup-git-push.sh`. For each owned vessel it
  initialises the super-repo checkout, clones and builds each `file:` dependency, then installs
  the clone. Idempotent on node 2: a rerun printed no warnings and typecheck stayed at 0.
  Fresh-node check (21:38Z): a throwaway container from the node image with an empty
  `/workspace` and `SUBSTRATE_PUSH_VESSELS=development-vessel` ran the boot step, then the clone
  baseline typecheck. Control (script before `dc38d548`): grounding 0 bytes, 107 × TS2307,
  reproducing both original failures. With `dc38d548`: "built ias-executor-ts", grounding
  4.6 MB, typecheck 0 errors.
  Scope:
  - This checks the boot step and the compose baseline (install + typecheck), not a full LLM
    compose.
  - A node booted from an image built before `dc38d548` still runs the old copy at boot, so a
    fresh composer node needs the next image build.
- [x] 4.0d Shared gap store (decided: one store, held by the first node). A node that does not
  hold the store forwards `substrateGap` and `substrateGap_write` to the holder's
  development-vessel; the picker's ownership filter (1.1) then admits only its own repos
  from the shared backlog, and every write lands in the one store. The holder's address is a
  boot-time placement fact, `GAP_STORE_ENDPOINT`, like `IDENTITY_VESSEL_URL`.
  - [x] 4.0d-i `repos/development-vessel/src/resolvers/substrate-gap.ts`: forward both
    resolvers when `GAP_STORE_ENDPOINT` is set; an unreachable store is a structuredError,
    never a silent fallback to the local file. Goal: `goals/4.0d-gap-store-forwarding.txt`.
    Marker: `forwardToGapStore(`. Falsifier: unset on node 1 → its reads are unchanged
    (same count as before landing); set on node 2 → a `substrateGap` read on node 2 returns
    node 1's gaps, and a write on node 2 appears in node 1's `gaps.json`.
    Status: landed as `51e30de` (15:48:52), exactly as requested, then deleted six minutes
    later by the autonomous recommit `21179d8` (staged on a base from before the landing);
    development-vessel restarted onto the recommit, so the forwarding never ran. The recommit
    gap is closed and the recurrence is recorded on the existing overwrite gap. Needs
    re-landing. Re-landed as `516bc18` (17:15), partially: the helper and the write-side call
    landed and run (development-vessel restarted onto them at 17:20:47; runtime equals the
    clone), but the read-side call in `resolveSubstrateGap` did not. Inert until
    `GAP_STORE_ENDPOINT` is set (node 2 only, currently stopped).
  - [x] 4.0d-iii Read-side forwarding in `resolveSubstrateGap`. Goal:
    `goals/4.0d-iii-read-side-forward.txt`. Marker: `forwardToGapStore(pointer as unknown as`.
    Status: landed as `eb62676`; development-vessel restarted onto it at 19:59:27; the running
    file forwards in both resolvers. Negative control on node 1 (no `GAP_STORE_ENDPOINT`):
    local reads unchanged. The positive half (node 2 reads and writes node 1's store) runs at
    stage 2.
  - [x] 4.0d-ii (operator tier) gen-env carries `GAP_STORE_ENDPOINT` and the manifest passes it,
    as for `SUBSTRATE_PUSH_VESSELS`; node 2's `.env` sets it to node 1's development-vessel
    resolve URL (`http://host.containers.internal:18090/v2/impulses/resolve`).
    Status: gen-env and manifest edits applied (uncommitted); node 2's `.env` staged.
    Positive half verified live (07:10Z): a `substrateGap` read on node 2 returned a gap that
    exists only in node 1's store, and a probe gap written on node 2 appeared in node 1's
    `gaps.json` and not in node 2's (probe then closed the same way).
- [x] 4.2a First node: add the second node's discovery to `PEER_DISCOVERY_ENDPOINTS` in
  `/etc/substrate/env`, then restart discovery-vessel (the unit loads the value through
  its `EnvironmentFile` at process start; discovery reads `process.env` at use time, but
  the environment itself is fixed until the restart). Only when no acceptance sequence
  is running on the first node. Verify the same query as 4.2 from the first node's
  goal-host.
  Done under 4.5(b) at 13:13Z; node 1's discovery lists both composers.
- [x] 1.1c `repos/development-vessel/src/resolvers/gap-to-feature.ts`: ownership is the declared
  set `SUBSTRATE_PUSH_VESSELS` intersected with the clones present (falls back to all present
  clones when unset). Reason: the push clones are also pull-sync's source, so removing a clone
  to give up ownership would also stop the node pulling that repo. Goal:
  `goals/1.1c-owned-set-is-declared.txt`. Marker: `const declared = (process.env["SUBSTRATE_PUSH_VESSELS"]`.
  Falsifier: node 2 (declared = its three clones) still reports the same three; node 1 with the
  setting unset still reports all its clones; node 1 with 4.3's declaration reports sixteen.
  Status: landed as `988377f`; development-vessel restarted onto it at 08:18:42; node 1 with the
  setting unset still reports all 19 repos (negative control).
  Positive on node 2 (09:03Z): with all 16 clones present again and the setting carried, it owns
  exactly its three declared repos.
- [x] 4.3 First node gives up the second node's repos without losing its clones: a drop-in on
  node 1's development-vessel unit sets `SUBSTRATE_PUSH_VESSELS` to its sixteen other repos,
  then development-vessel restarts (after 1.1c runs there). Node 1's clones all stay, so its
  pull-sync keeps converging development-vessel, activity-api and goal-host from the node that
  owns them. Boot-transient until it lives in node 1's `.env` (a drop-in survives restarts,
  not a recreate). Verify: node 1's `composeOwnership` lists sixteen repos; node 2's lists
  three; no repo appears in both; node 1's pick lines exclude `not owned here(development-vessel)`.
  Status: drop-in applied (header per CONFIGURATION_SURFACE), development-vessel restarted at
  08:57:56 with nothing in flight; node 1 owns 16 repos (none of node 2's three), node 2 owns 3,
  no overlap; 0 RECURSION REFUSED. Picker checks ("not owned here", owned picks proceed) pending
  the coordinator's release of its autonomous_pick hold. After the release: first admission pass
  `951 candidates → 41 admitted, 910 excluded {"not owned here":312, …}`, and a pick proceeded for a
  node-1 repo (`concept-db`, `"owner":"substrate"`); 0 RECURSION REFUSED.
- [x] Stage 3 (node 2 pushes on): node 2 recreated 09:29:46Z without `MITOSIS_DIRECT_PUSH=0`; no
  kill-switch line at boot. Node 2 is stopped between windows (shared quota, overlap with the
  first node's directed queue for the same repos until 4.5).
- [x] 4.4 Change-level falsifier (re-expressed for the ownership the change moved): the second
  node lands development-vessel (a repo it owns) while the first node has a compose in
  flight on a repo the first node still owns. The first node's compose completes and pushes;
  the first node's journal shows no `restarted by mitosis-cutover` for that landing; the
  first node converges to the new development-vessel through pull-sync's age-deferred
  restart, after its compose ends. Needs 4.0d (shared store) and stage 3 (node 2's pushes);
  does not need cross-node routing. Confound to remove first: the first node still holds all
  clones, so its picker also admits development-vessel gaps and would self-land during the
  test. Move its three owned-by-node-2 clones aside (reversible; `ownedVessels()` reads at
  use time) or claim 4.4 only after 4.3.
  Run 1 (12:45-13:00Z): node 2 composed and pushed development-vessel `77ee9b9` (4.5(a)) with
  node 1 holding one compose in flight. Held: no node-1 restart was caused by node 2's landing;
  node 1 took the change through pull-sync, which mirrored it (12:57:53) and DEFERRED the restart
  ('2 in flight, oldest 76633ms < ceiling 900000ms … PENDING'). Confounded: node 1 restarted at
  12:55:44 through its OWN cutover of a directed development-vessel landing (`fd7070d`, LOSSY,
  1 in flight), the transitional overlap that exists until 4.5 routes directed work to the owner.
  A clean pass needs a run with no directed development-vessel landing on node 1: after 4.5.
  Follow-up measured 13:07:16Z: node 1's pull-sync took the owed restart for node 2's `77ee9b9`
  only when development-vessel reached zero in flight: "owed restart after deferral — it observed
  0 in flight, so nothing was lost" (deferred at 12:57:53 with 2 in flight). So the node-2-caused
  path was lossless end to end; the only lossy node-1 restart was its own directed cutover.
  2.2b routing (positive half), 13:24Z and 13:51Z: a directed development-vessel goal sent to node 1
  logged `routed by ownership → development-vessel-compose2` and composed on node 2. The second try
  reached a real verdict (baseline passed after 4.0f) and failed verify with TS1005. Root cause,
  found by the coordinator: local-tools applies `fs_edit` via `String.replace`, so `$'` in the
  replacement expands to the rest of the file; not a drafting or routing fault. Node 2's local-tools
  needs the same fix before that goal is retried there.
  PASSED end to end (14:40-14:45Z): dispatch ec38999d sent to node 1 logged `routed by ownership →
  development-vessel-compose2`; node 2 landed development-vessel `6bfbe4b` (substrate-authored, on
  origin/dev), byte-equal to the pre-validated file. Remaining seam (not this change): 2 of 3
  first-class landings today kept walking after landing on the dispatching node.
  Clean rerun for `6bfbe4b` (14:45-15:07Z): NOT clean. Node 1's pull-sync quiesced admission at
  14:56:05 with 1 in flight and logged "drained to 0 in 260s … converging with NOTHING in flight"
  at 15:00:26. It had not restarted yet when a DIRECTED development-vessel compose
  (`route-edit-ff34ece8`, `directed: true`) was admitted at 15:00:45. At 15:01:25 it mirrored
  `6bfbe4b` and deferred the restart ("2 in flight"). Node 1 then landed that directed compose
  itself as `66f62d5` and restarted through its own cutover at 15:06:54 ("observed 1 in flight …
  LOSSY"). Runtime equalled the clone afterwards. Two findings, neither caused by node 2's landing:
  (i) a quiesce's closed admission does not hold across the drain→restart window, or does not apply
  to directed composes;
  (ii) directed `pointer.gap_id` composes bypass ownership by design, so node 1 still composes and
  lands repos it does not own (`66f62d5` is node 1's landing, not a routed one; node 2's own
  attempt at the same gap failed env-baseline at 14:58).
  4.4 stays open until directed gap work is also placed on the owner, or a run has no directed
  development-vessel compose on node 1.
  PASSED (clean run, 21:41-22:21Z). The coordinator held all directed development-vessel work off
  node 1 for the window, and node 1 logged no `directed: true` compose.
  - The goal was the removal of the obsolete human-surface verify bypass in gap-to-feature.ts
    (`goals/4.4-remove-human-surface-verify-bypass.txt`). It was sent to node 1's goal-host
    (dispatch 83a2cd35), which logged `routed by ownership → development-vessel-compose2`.
  - Node 2 landed development-vessel `766f68d` at 21:45:07. It was reached, is on origin/dev, and
    the diff is exactly the 10 intended deletions.
  - Node 1 at landing: in_flight 1. Its compose `fc-muix3kus-ex4928` (boredom-vessel, a repo node 1
    owns, started about 21:44:25) ran to its own terminal verdict at 21:46:31 (`semantic_reject`,
    adversarial refuters) without interruption.
  - Node 1 journal: no `restarted by mitosis-cutover` in the window. Pull-sync mirrored `766f68d`
    at 21:49:47 and deferred the restart three times, because every tick found an autonomous
    compose in flight (21:49:47, 21:59:46, 22:10:16). It took the owed restart at 22:20:46:
    "restarted by pull-sync: owed restart after deferral — it observed 0 in flight, so nothing
    was lost". Node 1 runtime == clone afterwards; node 2 runtime == clone at `766f68d`.
  - Not observed: "completes and pushes". Node 1's in-window composes all ended without landing,
    for reasons independent of this change (semantic_reject, drift refusals, one LLM plane "no llm
    arm is currently servable"). That clause stands in for "not interrupted", which the terminal
    verdict above and the zero-in-flight restart observe directly.
  - The quiesce path (see the filed gap
    `pull-sync-reopens-admission-after-the-quiesce-drain-before-it-restarts…`) was not exercised in
    this run, because the deferral path fired instead, so it does not affect this result. The
    31-minute deferral does show the coordinator's filed "defers an owed restart indefinitely" gap.
- [x] 4.5 Cross-node routing for directed composes (positive halves of 2.2b and 2.3). Needs:
  (a) `repos/development-vessel/src/discovery-registration.ts` honours the same advertise
  precedence as the shared registration loop (`VESSEL_ADVERTISE_ENDPOINT` >
  `SUBSTRATE_ADVERTISE_HOST` + offset > loopback); it hardcodes `localhost` today;
  (b) per-vessel drop-ins on each node's development-vessel unit (node 1
  `http://host.containers.internal:18090`, node 2 `:26090`), not the container-wide host;
  (c) a distinct `VESSEL_ID` on node 2, because the peer merge drops a row whose `vesselId`
  equals a local one and both composers are `development-vessel-local`. Checked: goal-host's
  `DEV_VESSEL_ID_PATTERN` is `/^development-vessel(-|$)/`, so `development-vessel-compose2` still
  matches its re-registration; the unit hardcodes `Environment=VESSEL_ID=development-vessel-local`,
  so node 2 overrides it with a unit drop-in (survives restarts, not a recreate). Node-1 drop-ins survive restarts but not a recreate; record
  them as boot-transient until they live in node 1's `.env`.
  Progress: (a) landed by node 2 itself as development-vessel `77ee9b9`. (c) applied on node 2 at
  13:05:38 (drop-in: `VESSEL_ID=development-vessel-compose2`, advertise `:26090`); node 2's discovery
  now lists `development-vessel-compose2` at `http://host.containers.internal:26090`. (b) and node 1's
  peer entry applied 13:13Z (development-vessel drop-in `VESSEL_ADVERTISE_ENDPOINT=…:18090`, restart
  at in_flight 0 after two full `git ls-files src` comparisons; `PEER_DISCOVERY_ENDPOINTS` += node 2's
  discovery, discovery restarted). Node 1's discovery lists `development-vessel-local @ :18090` and
  `development-vessel-compose2 @ :26090`. Boot-transient on node 1 until its `.env` carries both.
  Remaining: positive routing check (a directed development-vessel goal sent to node 1 routes
  by ownership to node 2) and 2.3's duplicate-owner gap.
- [x] 4.6 `repos/development-vessel/src/resolvers/gap-to-feature.ts`: route directed gap work to the
  owner. Auto-picks admit only owned repos (1.1), but a targeted `pointer.gap_id` bypassed that
  filter. Node 1 composed and landed development-vessel (`66f62d5`), and two nodes composed the
  same gap. The change adds `findComposeOwner(vessel)`, which returns the one `feature_compose` row
  whose `composeOwnership` lists the vessel. After selection, a directed gap whose repo is not owned
  here is forwarded to that row with `forwarded_from` and `timeout: false`, and the owner's report is
  returned with `routed_to`. A forwarded request is never forwarded again; with no single owner,
  the gap is composed locally as before. Goal: `goals/4.6-route-directed-gap-work-to-owner.txt`.
  Marker: `async function findComposeOwner(`.
  Pre-validated against origin/dev `054de6f`:
  - both anchors unique;
  - tsc 0 errors before and after;
  - the 17 test files importing gap-to-feature, run in a throwaway container with no network in a
    checkout named `development-vessel` and a scratch `WORKSPACE_ROOT`: 138 pass / 4 fail before
    and after, with identical failing names (all four fail on base).
  Landed by node 2 as development-vessel `8645ead` (routed by ownership from node 1's goal-host,
  dispatch c7fb1945, reached). Byte-equal to the pre-validated file except two added blank lines.
  Node 1 restarted onto it through pull-sync at 04:11:02 ("converged … observed 0 in flight");
  runtime == clone.
  Falsifier (04:11:21Z): two directed `gap_to_feature` requests with `dry_run: true` sent to node 1.
  - Development-vessel gap (`the-reconcile-detector-closed-picker-…`): node 1 logged "directed … routed
    by ownership → development-vessel-compose2"; node 2's development-vessel handled it ("PENDING
    verification at pick time — skipping re-compose"); the response carried
    `routed_to: development-vessel-compose2`.
  - Negative control, concept-db gap (`route-edit-59884cb8`, owned by node 1): handled on node 1,
    with no routing line and `routed_to` null.
  - No landings on either node.
  Not exercised: a long forwarded compose, because both gaps were pending verification, so neither
  composed. That path depends on the `timeout: false` fetch, which the coordinator's goal-host
  3.3 measured for the same Bun cut.
  Still not routed by ownership: goal-host's post-walk compose (see design follow-ups).
- [x] 4.7 `repos/goal-host-vessel/src/index.ts`: route the post-walk edit-intent compose by
  ownership, the way the early site does (2.2/2.2b). Without it, a goal whose early compose ran on
  the owner was composed again on a non-owner, and one change was applied twice (`194df79`). Goal:
  `goals/4.7-route-post-walk-compose-by-ownership.txt`. Marker:
  `EDIT-INTENT ${owners.length === 1`.
  Pre-validated against origin/dev `b7bda9c` in a network-less container (checkout named
  `goal-host-vessel`, scratch `WORKSPACE_ROOT`): anchor unique; tsc 0 errors before and after; the
  full suite (73 files, 868 tests) gives 865 pass / 3 fail / 1 error on both, with identical
  fail/error lines.
  Landed by node 2 as goal-host `fbb2fab` (dispatch f8c41dbe, routed by ownership, reached). NOT
  byte-equal to the pre-validated file:
  - the drafter doubled a regex escape, turning `/\/+$/` into `/\/\/+$/` in the composeOwnership
    probe URL;
  - it kept the original `if (v?.endpoint)` block and added a mangled copy before it;
  - it joined two statements onto one line.
  Behaviour today is as specified: the routing decision is correct, and the final `composeUrl`
  comes from the original block, so there is one duplicate log line. The probe URL is correct only
  while endpoints carry no trailing slash.
  Observed live: node 1's goal-host restarted onto `fbb2fab` through pull-sync at 04:19:23. At
  04:26 a 0-step walk naming development-vessel `feature-compose.ts` logged "EDIT-INTENT routed by
  ownership → development-vessel-compose2", and the producer line appeared twice, as predicted
  from the duplicate block. Node 1 composed nothing. Node 2 composed the gap (`route-edit-0f3e138a`)
  twice, once early and once post-walk, so the double compose now stays on the owner, where its own
  report and the landed-commit probe apply.
- [x] 4.7b Cleanup of `fbb2fab`'s drafting defects, dispatched after value-per-cost-selection 2.7
  (goal-supplied edits applied verbatim) went live on node 2 (development-vessel `f70160f`).
  - First try, `goals/4.7b-clean-up-fbb2fab.txt`, used prose ("Replace exactly this line … with …"),
    which 2.7's strict parser rejects by design, so the LLM planner ran. It landed goal-host `3cced35`
    with only 1 of the 3 edits (the probe-URL regex) and still reached. That is hollow-partial reach,
    recorded on the gap `an-exact-edit-goal-can-land-with-some-of-its-edits-silently-dropped-…`.
  - Second try, `goals/4.7c-finish-fbb2fab-cleanup.txt`, used 2.7's format (`Apply exactly these 2
    edits` / `EDIT n` / `old:` / `new:` / `Done when:`). Before dispatch it was checked with the
    running `parseExactEditBlocks` and `spliceExactEdits` on a spec wrapped as goal-host wraps it:
    2 edits parsed, and the splice equalled the reference file.
  - Landed goal-host `1669ac8` (parent `3cced35`): "[fc-exact] applying 2 goal-supplied edits
    verbatim … (no LLM plan)", spec refinement skipped, and no completions on node 2's
    llm-resolver. The landed `index.ts` is byte-equal to the pre-validated 4.7 file (tsc 0; full
    suite 865/3/1, identical to base).
  - Lesson for exact-edit goals: write them in 2.7's block format; prose goals still go through
    the planner.

## 5. Detector (development-vessel)

- [x] 5.1 `repos/development-vessel/src/resolvers/composer-interruption-sweep.ts` (new):
  resolves `composerInterruptionReport` from the vessel's `[restart-attribution]` journal
  lines and `ownedVessels()`. The line names the cutover vessel and an in-flight count, not
  the interrupted composes' targets, so the class detected is a `foreign_cutover` (a
  restart caused by a cutover on a vessel this node does not own), with lossy restarts
  counted alongside. Files/updates `composer-interruption-<node>-<day>` when
  `foreign_cutovers > 0`; `lines_read == 0` reports `journal unreadable` and no verdict.
  Goal: `goals/5.1-interruption-sweep.txt`. Marker: `resolveComposerInterruptionSweep`.
  Falsifier: on the first node today (it owns everything) the report shows `restarts > 0`,
  `lossy > 0`, `foreign_cutovers: 0` and no gap; on the first node after 4.3 (it no longer
  owns development-vessel) a development-vessel cutover restart there counts 1 and opens
  the gap.
  Status: landed as development-vessel `827a218` (178 lines; the parser matches the real
  line format). Its gap write was hollow: it called the gap store's READ resolver
  (`resolveSubstrateGap`) inside a catch that swallows everything, and an empty owned set
  would count every cutover as foreign. Fixed by 5.1a.
  First-node falsifier (live, after 5.2): a 6 h report read 30644 journal lines and found 18
  restarts, 13 lossy, 0 foreign cutovers, and filed no gap, as expected on a node that owns
  every repo.
- [x] 5.1a Same file: write the gap through `resolveSubstrateGapWrite` with a
  `substrateGap_write` pointer, log a refused or failed write, and report `owned set
  unavailable` instead of counting foreign cutovers when `ownedVessels()` is empty. Goal:
  `goals/5.1a-sweep-writes-its-gap.txt`. Marker: `resolveSubstrateGapWrite({ type: "substrateGap_write"`.
  Status: landed as development-vessel `1e18e09` (06:25); the read-resolver call is gone.
- [x] 5.2 `repos/development-vessel/src/routes/impulses.ts`: route `composerInterruptionReport`
  to the sweep. Goal: `goals/5.2-serve-interruption-report.txt`. Marker:
  `case "composerInterruptionReport":`. Falsifier: resolving the shape returns the report.
- [x] 5.2b `repos/development-vessel/src/config.ts`: advertise `composerInterruptionReport`.
  Goal: `goals/5.2b-advertise-interruption-report.txt`. Marker:
  `"composerInterruptionReport",`. Falsifier: a `vesselCapability` query lists it.
  Status (5.2 + 5.2b): landed together as development-vessel `4d5d563`; the shape resolves live.
- [x] 5.3 (operator tier, data only) Schedule the sweep by law 5, not a timer: write two
  pool impulses, `timeShapedRhythm` (family `composer-interruption`, hourly-scale
  staleness, small budget) and `rhythmFamilyGoal` (`{family: "composer-interruption", goal:
  "Resolve composerInterruptionReport for this node and act on the gap it files"}`), which
  `rhythm_conductor_tick` merges over its bootstrap map at use time. Falsifier: within a
  conductor cycle the family is enqueued and a dispatch resolves the report.
  Status: both impulses written (`rhythm-composer-interruption`, budget 0.05, alpha/beta 2/2,
  staleness 1.0; `rhythm-family-goal-composer-interruption`) and read back from the pool.
  Falsifier pending: the conductor (driven by boredom-vessel) enqueues into
  `/root/.minibob/boredom-queue.json`.
  Measured: the conductor enqueued the family ('rhythm composer-interruption due, score
  10.00') and dispatched it within a minute (d68fda79), so the scheduling half holds. The
  dispatch did not reach: goal-host's walk POSTed the named shape to the shellResult
  producer (local-tools, HTTP 404), not to development-vessel. Filed as
  `walk-posts-a-named-shape-pointer-to-the-executor-satisfiers-producer-instead-of-the-shapes-own-producer`.
  Root cause: at the 08:26 container restart goal-host registered development-vessel's
  shapes 6 s before development-vessel was up and never recovered, so no development-vessel
  shape reached its map (the gap now carries this, with the durable fix: retry with backoff).
  Verified after goal-host's 12:36 restart: rhythm dispatch 8a1504b3 bound
  `composerInterruptionReport` and produced it from development-vessel, so the falsifier holds.
  Its reach was still scored partial because the walk also bound `llmCompletion` from the
  goal's "report its counts" wording, and did not produce it. That is a reach-scoring issue,
  outside this change.

## 6. Post-split convergence (found 2026-09-28)

- [x] 6.1 Node 1's super-repo was 130 commits behind origin: `state/learning-mode-state.json` (development-vessel's
  runtime learning-mode state under `$WORKSPACE_ROOT`) was tracked in git (re-added by autonomous commit `edc68d49`)
  and modified locally, so every pull-sync fast-forward was refused and the glue layer (scripts, pull-sync self-update)
  froze. `50830bec` untracks it and ignores `/state/`; both nodes fast-forwarded with the live file preserved
  (backups under `/workspace/backup/superrepo-ff-*`).
- [x] 6.2 Node 2's pull-sync failed cpg-inference-ts on every tick since 09-26: its `tsconfig.build.json` emits
  declarations only, so the shared-package fan-out's tsc-only build never produced `dist/index.js`. `31f15baf` falls
  back to the package's own build script in a scratch copy, and folds in node 2's uncommitted local gate-budget patch
  (420 s → 900/1000 s) so the self-update does not revert it. Verification pending: node 2's next ticks self-update and
  log a clean cpg-inference-ts fan-out with `failed=0`. VERIFIED 08:11: after `4bb21141` (the package build
  script calls bare `bun`, absent from the unit's PATH) node 2 logged "fan-out healthy AND propagated", `failed=0`,
  analysis-vessel active; 08:21 tick also `failed=0`.
- [ ] 6.3 Class: a node whose glue-layer fast-forward fails logs it every tick but files nothing. Pull-sync should
  file one gap per node when the super-repo stays behind origin across N ticks, naming the blocking paths.
- [ ] 6.4 Class: runtime files still tracked in the super-repo on node 2 (`leases/*.json`, `Substrate/Projects/*`,
  `scripts/substrate/vessels.inventory.json`) will block the next commit that touches them the same way.

