# What a first-time reader gets wrong, and which document is responsible

Five independent readers were given one task area each — quick start, the
explanatory material, installation, maintenance, configuration. Each wrote its
questions from the README's first sixty lines **before** any research, committed
them, then executed the instructions and scored its own questions on two axes:
answered by the README, and answerable from the repository at all.

Separating those axes is the point. A question the README leaves unanswered but
the source settles is a placement defect. One nothing in the repository answers
is a knowledge gap. Across 76 cold questions: **16 answered, 29 partial, 31 not
answered — but 62 answerable.** The dominant failure is placement.

Every finding below was measured against a running fleet. Line numbers were
re-verified against the tree at the time of writing; re-check before editing,
because a file read is a snapshot.

---

## The three patterns

**Load-bearing warnings sit after the step they govern.** The placeholder-key
trap is explained thirty lines after the dispatch that trips it. The build-skip
warning is a block-quote below the build command. `substrate-config` is named as
the way to verify configuration without its blind spot. Each fact is *present*
and each still misleads: ordering is part of correctness.

**Safety settings fail open.** Two documented kill switches are discarded on the
`make` lane and resolve to their permissive defaults. A documented hardening
recommendation disables nothing. Every one of these fails toward *more*
autonomy, and no instrument reports it.

**The README promises what `docs/` correctly caveats.** LLM-arm inheritance,
`HUB_DISCOVERY_URL` interchangeability, and hot-reload are each stated flatly in
the README and correctly qualified — or contradicted — in the deeper document.
The front door is the least accurate surface.

---

## `README.md`

### Wrong — a reader acting on this gets a broken or unsafe result

| Line | Defect | Change |
|---|---|---|
| **455-457** | *"edit vessel source in `repos/<vessel>/`, then hot-reload it in the container"* — **there is no transport.** `docker inspect` shows only the two named volumes; the host repo is not mounted, and `vessel-ctl restart` restarts the unit and nothing else. A reader edits, restarts, sees old behaviour, and cannot diagnose why. | Replace with the git-based channel `docs/SUBSTRATE.md:914-920` already documents. State that the container's clone, not the host tree, is the source. |
| **434** | Lists `HUB_DISCOVERY_URL` **first** among interchangeable join variables. A/B against the image's own `gen-env.sh`: `HUB_DISCOVERY_URL` alone yields no `ENABLED_ROLES=spoke` and loopback endpoints; `DISCOVERY_ENDPOINT` yields the correct spoke. Contradicts the repo's own warning box at 196-202. | Name `DISCOVERY_ENDPOINT` as the join key. Demote `HUB_DISCOVERY_URL` to the trap it is, cross-referencing 196-202. |
| **289** | *"A federated spoke inherits the hub's LLM arms, so it needs no local provider key."* Measured on a real join: `No vessel advertising llm_completion found in discovery`. `docs/SUBSTRATE.md:349-352` carries the caveat; the README states the promise without it. | Carry the same caveat, or drop the sentence. |
| **288-291** | *"the identical vars work as `-e VAR=value` flags … or as `VAR=value` arguments to `make -C scripts/substrate up`."* Nine documented names are compose-only no-ops on the make lane, including both kill switches. | State that the make lane forwards a fixed allowlist, and name the nine. Better: fix the allowlist (below) and keep the claim true. |
| **242** | *"a spoke you do not fully trust should get a read-scoped key or `DISABLED_VESSELS=bootstrap-seeder`"* — the bare name disables nothing; `bootstrap-seeder.service` works. The advice is security-relevant and inert. | Use the `.service`-suffixed name, or fix the matcher so bare names work. |
| **492** | `workbench` listed among Core components. No systemd unit, absent from `vessels.inventory.json`, no port, last commit 2026-05-24. | Mark source-only, or remove from the fleet list. |
| **502, 513** | *"Extract — successful executions become reusable templates (ribosome)."* `applyExtraction` defaults `false`; the template's own note says no template reaches the pool in that mode; zero `ribosome-extract` runs in the last 500 traces. Minting happens via `draft-activity-from-pattern`. | Name the path that runs. Keep the ribosome as the intended mechanism if that's the design, but stop stating it as current behaviour. |
| **510** | Principle 3: *"the backend **only** stores traces."* activity-api advertises 66 shapes including `thompson_posterior`, `llmModelPolicy`, `activityTemplate_write`. | "stores traces and learns from them." Separately: the emphatic *"not a universal resolver"* polices activity-api (66 shapes) while `development-vessel` advertises 249 and goes unmentioned. |
| **16** | *"self-alteration cutover loop"* — this phrase occurs **only** on this line, in the entire repository. The system's name is **mitosis cutover**. | Rename, so the term is greppable. |
| **24-33** | The Impulse example is not a valid Impulse: omits required `metadata` and `loaded`, and puts `shape` at top level where the type has no such field (`ias-executor-ts/src/ontology.ts:8-23`). It is the first concrete artifact a reader sees. | `{ id, pointer, metadata: { shape }, loaded, budget }`. |

### Misplaced — correct, but after the step that needs it

| Line | Defect | Change |
|---|---|---|
| **91** | `cp scripts/substrate/.env.example .env` — no `-n`, no warning. Silently overwrites an existing `.env`. | Add `-n`, or warn. |
| **89-92** | No `docker compose pull`. Compose won't re-pull an existing tag, so a section titled *"from the published image"* runs stale code for anyone returning. Measured: local `:dev` `d1887a2b…` vs remote `53af8d42…`. | Add the pull step. |
| **99** | The `until … whoami` gate has no timeout and no iteration cap. A genuine seed failure loops forever with no diagnostic — strictly worse than the bounded gate the image already implements (`TimeoutStartSec=300`, 60 attempts). | Bound it and print the diagnostic on expiry. |
| **119-124** | Hardcodes `substrate-live`, both volume names, and the 18xxx block. The relocation knobs appear 130 lines later, framed as a make-vs-compose footnote. Anyone with an existing substrate walks into a port and volume collision. | Forward-reference `LIVE_NAME` / `PORT_OFFSET` at the point of collision. |
| **176 vs 146** | Doctor — the only detector for a dead provider key — is introduced *after* the dispatch step that fails because of it. | Move the check before the first dispatch, or name the symptom at 146. |
| **384-390** | The build-skip warning is a block-quote below the command it qualifies. A reader who follows step 2 under a heading that says *"Building from source"* compiles nothing when the `:dev` tag exists (`Makefile:401`). | Put the condition in the command, not after it. |

### Absent — a maintenance surface that isn't there

`substrate-pull-sync`, `drift`, `apply`, `uninstall`, `deregister`, `make stop`,
`substrate-config`, and any form of *backup* occur **zero times** in README.md.
Sections 449-481 contain a ports table, a PAT note, a submodule paragraph, and
one recipe that doesn't work. A month of operations lives in `docs/SUBSTRATE.md`,
reached by a bare *"Full guide"* link at 476.

Also absent from all 526 lines: **teardown** and **what it costs to run** — the
only two questions in the audit that nothing in the repository answers. The
Quick Start creates a privileged container and two named volumes that hold the
learning state, and never says how to undo it.

**Change:** a short Maintenance section that names the eight verbs and links
each to its section in `docs/SUBSTRATE.md`; a teardown block; a resource line.
`deploy-remote.sh:43`'s *"~4-6GB"* is the only size figure in the repo and the
image is 0.7 GB.

---

## `docs/SUBSTRATE.md`

Genuinely good, and wrong about itself in five places.

| Line | Defect | Change |
|---|---|---|
| **381, 392** | *"point `DISCOVERY_ENDPOINT` (or `HUB_DISCOVERY_URL`)"*, and a table row presenting `HUB_DISCOVERY_URL` as *"the discovery group to join (same value as above)"*. This is the **authoritative** doc README:235 defers to, and it is refuted by the image's own `gen-env.sh`. | Same fix as README:434. This one matters more — it is where a careful reader goes. |
| **945** | The clobber warning — *"the copy source is your working tree"* — is attached to `vessel-ctl sync`, whose source is `git pull --ff-only origin dev` on the in-container clone. It never reads the host tree. The warning belongs to the deleted `sync-*` make targets. | Detach the warning; describe what `sync` does. |
| **893** | Calls `substrate-ready`'s count *"honest"*. Masked units bucket to `skipped`, never `down` — legitimate for a spoke, indistinguishable from an accidental mask. | Qualify. Say what `skipped` hides. |
| **805-820** | *"an apply that prints no action lines is a genuine no-op"*, with the seven-`started`-lines pattern relegated to *"an image older than this behaviour"*. That is the image `make up` actually runs, because it skips `build` when the tag exists. | State that the fix ships via `substrate-pull-sync` and that the published image may predate it. |
| **835-843** | The mask-recovery procedure says no restart is needed. Measured: services recover, but 15 timers are left `ActiveState=failed` (*"Unit to trigger vanished"*), invisible to `drift`, to `apply`, and to `vessel-ctl status` — which cannot show timer units at all. Only full `substrate-ready` catches it; a container restart heals it. | Add the restart step and the timer check. |
| **899** | Documents `substrate-pull-sync` with no exit semantics. It prints `failed=1` and **exits 0**; `cpg-inference-ts: BUILD FAILED` never converges. | Document the exit status, and fix it to be non-zero on failure. |
| **758-761** | The disabled-unit triage loop checks that a timer *exists*, not that it is alive — it cleared all 15 failed timers above. | Check liveness. |

---

## `scripts/substrate/.env.example`

| Line | Defect | Change |
|---|---|---|
| **17** | `ANTHROPIC_API_KEY=sk-ant-...` ships **uncommented**, and `gen-env.sh:318` gates only on non-emptiness. A reader who runs the documented `cp` and forgets to edit gets a container reporting `healthy`, passing the README's own convergence gate and 8 of 9 doctor checks, that cannot draft a token. The dispatch fails with an error about *template ids* that never mentions authentication. | **Comment out line 17.** One character converts a silent hollow success into a loud boot failure at `gen-env.sh:318`. Highest value-per-byte change in the audit. |
| **116-131** | Documents the selection precedence correctly but never states the **name grammar**. `ENABLED_VESSELS` requires exact unit names — `ENABLED_VESSELS=activity-api` *disables* activity-api. The only statement of this is a shell comment at `apply-inventory.sh:9`. | State it here, next to the five variables. |
| **118-119** | *"An unknown PROFILE or role name is now a BOOT ERROR … rather than a container that silently comes up nearly empty."* The guard covers `PROFILE` and `ENABLED_ROLES` only. The exact failure the doc says is fixed is live on the `ENABLED_VESSELS` path, and unknown `DISABLED_VESSELS` names are accepted silently. | Scope the claim, or extend the guard. |
| **121-125** | `PROFILE`'s valid values are never given; the names printed beside it belong to `ENABLED_ROLES`. Actual: `PROFILE='hub'` → `FATAL: names no entry in .profiles — known: compute_node, surface_node`. | Name the profiles. The FATAL is loud and correct, so this misleads rather than breaks. |
| **122** | Bare-role list omits `desktop` — 11 documented, 12 actual. | Add it. |
| **8-11** | Points at `substrate-config` to check *"whether your value won"*. Provenance is a 33-name hardcoded list (`gen-env.sh:105-115`) against ~74 emitted names. For a discarded `MITOSIS_DIRECT_PUSH=0` it prints `unrecorded 1` — which reads like confirmation. | Note the coverage limit. `DRY_RUN=1 apply-inventory` is the honest instrument and is buried in a comment at line 131. |
| **1, 59-63** | Calls itself *"compose env"* while cross-referencing the make lane, and README:288 asserts equivalence. Nine documented names are compose-only. | Mark them. |

---

## `docs/operations/CONFIGURATION_SURFACE.md`

Six of eight sampled rows re-measured exactly true. The method sections are the
best material in the repo on this subject. Two rows are stale.

| Line | Defect | Change |
|---|---|---|
| **163** | *"Names emitted into `/etc/substrate/env` — 72 — `grep -cE '^[A-Z_]'` after a boot."* Measured 73, 74 and 77 depending on what was supplied. **Emission is conditional, so the method cannot reproduce a fixed number.** `config-surface-baseline.txt` in the same repo already says 77. | Replace the count with the range and the condition, or drop the row. The doc's own §6 warning applies to itself. |
| **197** | `SURREALDB_PASSWORD` *"worst pair"* cites `changeme` (activity-api) vs `root` (relevance-sink). relevance-sink now reads `?? "changeme"` — fixed. The class is live elsewhere: `development-vessel/src/resolvers/orphaned-org-write-scan.ts:5`. | Re-cite. The finding holds; the instance doesn't. |

---

## Beyond the docs — defects the audit surfaced that no edit fixes

These are code, not prose. Listed because leaving them out would make the doc
changes look sufficient.

1. **Both kill switches are discarded on the `make` lane.** `MITOSIS_DIRECT_PUSH=0`
   and `ROUTE_EDIT_INTENT_TO_COMPOSE=0` never enter the container; `gen-env`
   would honour both (`:599`, `:540`). The dropping layer is the `-e` allowlist
   in the `run-live` recipe. An operator who believes autonomous push is off has
   not turned it off. **Fix the allowlist, not the docs.**
2. **The container HEALTHCHECK reports `healthy` through a dead data plane.**
   `substrate-ready --quick` exits 0 with surrealdb, activity-api,
   identity-vessel and llm-resolver masked and dead. `docker ps` agrees. The two
   cheapest signals an operator has both lie, together. This is the same defect
   class as the restart loop that doctor check 5b now catches — relocated to the
   `skipped` bucket.
3. **`mcp__metabob__registry_query` reports false absences.** It answers *"No
   vessels advertise shape memoryNote"* while discovery lists 383 shapes
   including that one, and a direct `vesselCapability` resolve returns a working
   endpoint. That tool is the read path for law 3's *find an existing producer
   before you mint* — a false negative there is precisely what causes a
   duplicate mint.
4. **`ENABLED_EXTRA_VESSELS` logs its own no-op.** It prints
   `(additive): boredom-vessel` and then disables it two lines later. A
   confirming echo over a no-op is worse than silence.
5. **`deploy-hub.sh:33`** demands a PAT for *"the private repo"*; the super-repo
   and all 18 submodules are public. The script also `docker rm -f substrate-live`
   on the target, undocumented, and its own comment at `:117-118` says the first
   deploy leaves the relay empty — so a fresh hub still fails README:211's hub
   test, and the README offers that script as the remedy.
6. **`config-surface-probe.sh` cannot see any of this.** Its baseline is
   counts-only, so a value-replacement regression trips nothing; its `DROPPED`
   axis only judges names a lane already passes, so variables **no lane passes**
   are structurally invisible. It checks the axis where nothing was wrong.
7. **`Makefile:592`** prints *"only the repo is bind-mounted (ro) for sync-\*
   hot-reload"* on every launch. No such mount exists; those targets are gone.
   This is the sentence README:456 was probably written from.

---

## Order of work

1. `.env.example:17` — one character, converts a silent failure into a loud one.
2. The two kill switches in the `run-live` `-e` allowlist — safety, and silent.
3. The `skipped` bucket in `substrate-ready` — it is the signal you would trust
   during an outage.
4. README:455-457 — the only iteration recipe in the document, and it cannot work.
5. `docs/SUBSTRATE.md:381,392` and README:434 — one contradiction, two sites.

Everything else is real and none of it is urgent.

---

## What held up

An audit that lists only defects is half an audit. The load-bearing claims
survived:

- **The system writes and lands its own code.** 580 of 1589 commits across
  `repos/*` in 30 days authored by `Substrate Autonomous`, most recent
  2026-08-22. This is the least believable claim in the README and the
  best-evidenced.
- Thompson posteriors stored and moving across 123 variants; traces seconds old.
- All 6 documentation links and all 11 `repos/<vessel>` paths resolve; the seven
  `SUBSTRATE_AS_*` lenses are exactly seven; `docs/README.md` indexes 61 of 61.
- The anonymous-`ghcr` explanation at README:73-78 pre-empts the exact 401 that
  would make a reader think the package is private. Both halves measured true.
- The `/bootstrap` pre-flight at README:210 predicted the entire downstream
  spoke failure before launch. *"The count cannot distinguish dead from alive"*
  at :214 is a caveat most documents never write.
- The hub-write warning at :238 — 18/18 templates, measured. The two join
  discriminators at :315/:318 are precisely the two that work.
- `LIVE_NAME` / `PORT_OFFSET` verified end to end, and the compose-adopts-
  production hazard at :249-258 is documented accurately and prominently.
- `docs/SUBSTRATE.md`'s backup and restore recipes worked verbatim, verification
  steps included.
