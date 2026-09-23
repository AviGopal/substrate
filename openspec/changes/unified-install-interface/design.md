## Context

The install interface is everything a person touches to go from nothing to a substrate
they can use: prerequisites, acquisition, inputs, the launch command, the done signal, the
credential, the client connection, joining, operating, and teardown.
`evidence/current-interface.md` maps what exists at each stage; `evidence/prior-audit-
ledger.md` records what 14 prior audits found and whether it stayed fixed.

Two facts shape the design:

1. **The engine is already in the image.** `gen-env` (the configuration funnel),
   `apply-inventory`, identity seeding, `substrate-ready`, `substrate-doctor`,
   `substrate-key`, `substrate-config` and `vessel-ctl` all run in-container. The raw
   `docker run` lane is already "image + one command". The host side adds no capability;
   it only re-declares facts (ports, volumes, grace, health) and re-implements
   derivations (spoke role, key guard), and every re-declaration has drifted.
2. **The system has already learned this lesson once.** The spoke derivation lived only
   in the Makefile, so a raw `docker run` never peered ("the split-brain", `gen-env.sh`
   comment above the role inference). The fix moved it into the image. A copy still
   survives at `Makefile:197-233`. Likewise the Obsidian surface was collapsed to
   point-and-go `{discovery, apiKey}` with an honest connection test
   (`openspec/changes/2026-07-19-obsidian-pebkac-config`), and gen-env names the join
   contract `{credential, anchor, selection}`. This change generalises both to the whole
   install.

## Goals / Non-Goals

**Goals**
- One path a newcomer follows on any supported host, with one set of inputs, reaching a
  substrate that has *reached a goal* and a cockpit that *answers*.
- Every recurring defect class in the ledger removed at its structural cause, not its
  instance: lane-drift, fail-open, fix-outside-artifact, warm-state masking, doc-code
  drift.
- Setup's correctness observable by something other than the operator on this host.
- Existing installs adopted unchanged.

**Non-Goals**
- Federation relay/reservation liveness (ledger rows 31-33): its own change. This change
  only requires that the verdict report it honestly.
- The Obsidian installer (covered by its point-and-go change) and Kubernetes (retired;
  banner only).
- Moving runtime behavior into shapes. Install inputs are bootstrap-tier by definition
  (law 1's stated carve-out); the point is to make that tier small and closed.

## The target interface

| Stage | Should be |
|---|---|
| 0 Prerequisites | A declared container engine (Docker, or Podman ≥ the tested version) with privileged containers, and `docker compose`/`podman compose`. Nothing else on the host: no bun, make, jq, gh, node for the install path. The cockpit adds node/npx and says so. |
| 1 Acquire | Pull a published image. Its revision is readable from labels before running and from the verdict after. No checkout required (Decision 2). |
| 2 Configure | One required input for a standalone, two for a spoke, three for a hub (table below), in one `.env`, read only by the engine's own `.env` handling. Nothing ambient. |
| 3 Launch | `docker compose up -d` against the one launch manifest. Any wrapper runs exactly this. |
| 4 Verify | `docker exec <c> substrate-status --wait usable` prints the five-level verdict and exits non-zero unless the requested level passes. |
| 5 Credential | Part of the verdict: `seeded` passes only when the key the client will use validates. No placeholder is ever printed as a key. |
| 6 Connect | `docker exec <c> substrate-connect` prints the client config (endpoint from the published ports) and the one-line MCP registration; `substrate-connect --write` style capture is a host redirect, not host logic. |
| 7 Join | Same launch; the anchor + credential inputs make it a spoke. One derivation, in the image. |
| 8 Operate | `docker compose stop` drains correctly because the manifest's stop grace covers the drain; upgrade is `pull` + `up -d`; a second fleet is a different `SUBSTRATE_NAME` + `SUBSTRATE_PORT_PREFIX`. |
| 9 Teardown | `docker compose down` (keep state) / `down -v` (destroy), and the install page names the client-side files to remove. |

### The complete input surface

| Input | Default | Derives | Required when |
|---|---|---|---|
| `SUBSTRATE_NAME` | `substrate` | container `<name>-live`, volumes `<name>-workspace`, `<name>-surreal` — the default reproduces today's `substrate-live`/`substrate-workspace`/`substrate-surreal` exactly. Existing non-default fleets (container `lab`, volumes `lab-*`) are adopted through the deprecated exact-name aliases `SUBSTRATE_CONTAINER`/`LIVE_NAME` (Decision 2) | never |
| `SUBSTRATE_PORT_PREFIX` | `18` | host port = prefix ∥ last three digits of the container port (`8080`→`18080`, `8310`→`18310`) | never |
| `DISCOVERY_ENDPOINT` + `METABOB_API_KEY` | unset | unset ⇒ root; remote ⇒ spoke of that hub (derivation in gen-env only) | joining a hub |
| one provider key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …) | unset | local LLM arms | a root or hub that should reach `usable` on its own |
| `PUBLIC_IP` | unset | the address `/bootstrap` advertises to spokes | a hub |
| `PROFILE` | derived: `standalone` for a root, `spoke` for a remote anchor | the vessel set (`standalone`, `hub`, `hub-minimal`, `spoke`, `surface`, `compute`) | running a hub or a specialised node |
| `SUBSTRATE_GIT_PAT` + `SUBSTRATE_REPO_OWNER` | unset / `AviGopal` | push **capability** and its **scope** (Decision 11) | the substrate should land its own commits |

Everything else — vessel selection, extra providers, retention, federation overrides,
autonomy switches — is **advanced configuration**: documented once in
`docs/operations/CONFIGURATION_SURFACE.md`, forwarded by the manifest, never required by
the install page. `SUBSTRATE_PORT_PREFIX` expresses every offset the repo has used
(6000, 7000, 8000, 9000, 20000 are all multiples of 1000) and is plain compose string
interpolation, so no launcher does arithmetic. Prefixes ≥ 33 land in the ephemeral range;
the verdict warns.

## Decisions

### 1. The image owns the contract; launchers pass inputs through
Every derivation (role, endpoints, key requirement, volume and container names from
`SUBSTRATE_NAME`) happens in the image or in the manifest's interpolation. A launcher that
computes a value the image also computes is a defect by definition (spec
`install-contract`). *Alternative rejected:* keep host derivation "for convenience" — the
ledger shows every such copy drifted (rows 8, 11, 24, 25).

### 2. Where the launch manifest lives — **ratified: B, baked, published per digest**
The root `docker-compose.yml` is the single source. The same bytes are baked into the image
at `/usr/local/share/substrate/docker-compose.yml`, printed by `substrate-manifest`, and
attached to each published digest; CI fails on any byte difference. *Why this and not
generic practice alone:* the substrate is itself a consumer of the manifest — it deploys
peers and replaces itself from inside a container with no checkout — so the baked copy is
the channel the system's own deploy activities read, and the byte-equality check is what
catches the substrate editing one copy and not the other when it authors changes to the
super-repo.

Naming uses compose's nested defaults, verified with podman-compose 1.6.0:
`container_name: ${SUBSTRATE_CONTAINER:-${SUBSTRATE_NAME:-substrate}-live}` and
`name: ${WORKSPACE_VOLUME:-${SUBSTRATE_NAME:-substrate}-workspace}` (likewise surreal).
Defaults reproduce today's names; `SUBSTRATE_NAME=lab` alone gives `lab-live`/`lab-*`; the
deprecated exact names still adopt an existing `lab` fleet. Docker Compose v2's handling is
verified by the acceptance run (task 0.3), not assumed.

### 3. `make` becomes a developer wrapper, not a lane
`make up` = (`make build` only when `REBUILD=1` or the tag is absent) → `docker compose up
-d` with `SUBSTRATE_IMAGE` set to the local tag → `substrate-status --wait usable` →
`substrate-connect`. `run-live`, `run`, `run-detach`, `run-live-obsidian`, the `?=`
ambient fallbacks and `configure-local.sh` are removed. `deploy-*` copy the manifest and a
`.env` to the target and run compose there; `deploy-hub-pull.sh` and `deploy-hub.sh`
collapse to one script. The cluster compose becomes the acceptance fixture for hub+spoke,
generated from the manifest rather than hand-maintained.

### 4. The verdict is five-level and three-valued
| Level | Proves | Typical fail |
|---|---|---|
| `live` | every selected core unit active with stable `NRestarts` | crash loop reported as `activating` |
| `seeded` | the key `substrate-connect` will emit validates (`whoami`) | pre-seed placeholder, 401 race |
| `served` | every vessel the inventory selects is active, and every *published* port is bound on a non-loopback address inside the container | human-surface loopback pin |
| `usable` | an LLM completion succeeds on some arm (local or federated) **and** a baked known-answer goal returns `reached:true` within a bound | keyless root; hub without goal-host |
| `connected` | the container has observed an authenticated request using the emitted key arrive through a published port from outside the container | port unpublished, wrong prefix, client never configured |

Each level is `pass | fail | unknown`; a level cannot pass if a lower one is not `pass`;
`unknown` (could not evaluate) never passes. `connected` needs no host logic: the first cockpit call (or any client request) arriving
through the published port is the proof, and until one arrives the level is `unknown`. The image HEALTHCHECK is `substrate-status --quick
--level seeded`; the compose file does **not** override it. `substrate-ready.service`'s
unconditional success and `make up`'s `|| true` are removed. `substrate-doctor --smoke`
checks `reached`.

### 5. The image hands the client its connection
`substrate-connect` emits `{"metabob":{"endpoint","apiKey"}}` for `~/.metabob/config.json`.
The location rule is the one metabob-mcp already implements and cannot be changed from here
(`metabob-mcp/src/config.ts:40-50`): `METABOB_CONFIG_PATH` overrides everything, then
`./.metabob/config.json` in the server's working directory **shadows** the home file, and
with no file the server falls back to a hosted endpoint. So `substrate-connect` writes the
home file, names `METABOB_CONFIG_PATH` as the only override (`METABOB_CONFIG` is retired),
and warns when a project-local `.metabob/config.json` exists that would shadow it (this
super-repo has one). Only the config JSON goes to stdout, so it can be redirected straight into the file; the
registration line `claude mcp add metabob -- npx -y @metabob/mcp` and any warnings go to
stderr. The install page tells the reader to run the line it printed, and never repeats it. The endpoint is computed from
`SUBSTRATE_PORT_PREFIX`, which the manifest passes into the container, so the image knows
its own published address. The install page states the node/npx prerequisite for the
cockpit.

### 6. Acceptance: CI judges, the substrate learns — **ratified**
Setup runs before any substrate exists, so its detector cannot be an activity *on* the
instance being installed, and the system under test must not grade itself (law 12; an image
that breaks the hub could not record its own failure). So the **judge** is a fresh CI
runner per published digest and per declared engine: no `~/.metabob`, no `gh` auth, no
local image, no bun, fresh volumes. It executes the install page's `install` fences
verbatim (docs are the test input — law 9) and passes only at `connected` with a cockpit
`registry_query` answering. That verdict gates publishing `:dev`.

Recording in the substrate is not optional here, as it would be in a conventional project.
A result that lives only in CI is invisible to the learning loop: the detector would not be
an activity the loop can grade (law 2), install durability would have no data source
(law 7 — the metric that exposed 17 never-fixed findings), and a failure could not become a
gap the substrate closes itself (law 6). So the **learner** is the substrate: each run posts
an `installAcceptance` impulse (digest, engine, profile, per-level verdict, failing fence)
to the reference hub, and a failure files a gap through the existing gap-intake path (task
0.2 finds the producer; law 3). The substrate drafts the fix; the next run on a pulled
image verifies it. The loop closes with no operator hands (the S2 criterion). Posting
retries rather than blocks, so a hub outage never blocks a release.

A human installing on their own host is a resolver too (law 13), and today their failure
leaves no trace — which is why no record of the other host's failure exists.
`substrate-status --report` (opt-in) posts the same `installAcceptance` shape, marked
`source: human_reported`, from any install that has an anchor to report to.

### 7. Fixes close in the artifact
A setup defect is closed only when the acceptance run passes on a pulled image that
contains the fix. Drop-ins, overlays, hand edits and uncommitted units may unblock work;
they never close a gap (ledger class *fix-outside-artifact*).

### 8. Reachable by default, identifiable always
Published vessels bind `0.0.0.0` inside the container; publishing a port is the exposure
decision (loopback-only is `127.0.0.1:` in the manifest's port mapping, as Syzygy already
does). `human-surface-vessel.service` drops `HOST=127.0.0.1`; `served` catches the class
for every vessel. The image carries `org.opencontainers.image.{revision,created,source}`
and `/etc/substrate/image-revision`; the verdict prints image revision and, per vessel,
the running `/vessels` revision (pull-sync may move it). CI builds in Docker format so
HEALTHCHECK survives Podman, and the submodule-bump commits trigger a publish.

### 9. One install page
README § Installation is the only document with setup commands. `docs/SUBSTRATE.md`,
`docs/FEDERATION.md`, the guides, the skills and the compose header link to it. Dated
records (`SYZYGY_LOCAL_SURFACE.md`) move under `validation/`. A doc that restates install
commands is a doc-code-drift defect.

### 10. Profiles name real compositions — **ratified: `hub` dispatches**
The `hub` profile is the `hub` role plus the compute vessels every deployed hub has needed:
goal-host, development-vessel, local-tools, ribosome, analysis and light-dispatch — the list
`deploy-hub.sh` carries, which it records was once hand-unmasked and undeclared. The reason is
data locality (law 11): the hub holds the trace store, the learner, the posteriors and the gap
store, so the walk that reads posteriors on every step, and the self-development loop that
turns gaps into commits, belong next to them. A hub without goal-host holds all the learning
state and can act on none of it.

**Pending ratification: the self-development loop.** The list above makes a hub *dispatch*;
it does not make it *self-develop*. That loop is the `autonomy` role (gap-compose,
compose-teacher, funnel-drain and their timers) plus `boredom-vessel` (the law-5 selector),
and none of them are in `HUB_EXTRA_VESSELS`. No deployed hub runs them today; the operator's
standalone does. By the same data-locality argument (the gap store lives on the hub), they
belong in `hub`. Recommendation: include them in `hub`. The loop's pushes are still bounded
by Decision 11, since autonomy follows push capability, not the profile. `hub-minimal` (the bare role: registry, identity, trace store,
models, transport) remains for a relay or control-plane node with no data of its own. The
`surface` and `compute` profiles replace the inventory's `surface_node`/`compute_node`.

**The relay moves into the container.** Today a hub's relay runs as a host process on
`30333` (`deploy-hub.sh`, `deploy-hub-pull.sh`) or behind a separate forwarding container
(Syzygy), and no manifest publishes it: one more fact outside the declared artifact. The
`hub` and `hub-minimal` profiles run `federation-relay` in-container; the manifest publishes it
at the prefix-derived port `P333`, and `/bootstrap` advertises the published address.
`RELAY_PORT` (advanced) keeps an existing hub on `30333` during migration.

### 11. Push is a scoped capability, not a default — **ratified**
The standing ruling is that autonomy is gated by push capability, not by role: a substrate
that can push may be autonomous. So there is no "off for fresh installs" default; supplying
`SUBSTRATE_GIT_PAT` grants the capability. What the architecture adds is **scope**: because
every fleet's `/vessels` converges to `origin/dev` at boot, a push to the shared branch
reaches every fleet's running code within hours. Therefore:
- The capability's target is `SUBSTRATE_REPO_OWNER`. The install page directs a newcomer to
  their own fork, so a new substrate's autonomy is real but lands on its own branch.
- Landing on the shared `dev` of another owner is a separate, **earned** capability: granted by
  evidence (landings settled `held` in the attempt ledger — `causal-attempt-ledger` — and
  verified by a high-confidence activity, per the `consumed` ruling), not by an env var.
- The push policy is a shaped impulse (`pushPolicy`: target, promotion state, evidence
  pointer) read by the landing route at use time (law 1). `MITOSIS_DIRECT_PUSH` remains only
  as an emergency kill switch, documented as such.

### 12. Engines: Docker and Podman, both tested — **ratified**
Law 11 makes the engine list the definition of "wherever it is deployed", and the
substrate's own development host is Podman, so Podman is declared. Each declared engine has
its own acceptance job; one compose implementation is tested per engine (Docker Compose v2;
podman-compose ≥ 1.6 on Podman, or Compose v2 against the Podman socket — task 0.3 picks one).
Rootless Podman uses `--systemd=always` semantics; the image is built in Docker format so the
HEALTHCHECK survives. Testing both also removes the engine as the hidden variable behind
every prior single-host green (law 12).

### 13. Reference hub and its key — **ratified**
Results post to the long-lived production hub, because the gap store and the learner live
there. The CI key is issued under its own org with write access only to the
`installAcceptance` shape and gap intake, held as a CI environment secret, rotated, owned by
the operator; never a root or admin key (post-S3 the system must resist hostile inputs, and
the acceptance channel is one). The run holds its own low-budget provider key; a fixture
provider is refused because it would make `usable` hollow.

## Reuse audit
- `gen-env.sh` stays the single funnel and the single role derivation; the Makefile copy
  is deleted, not ported.
- `substrate-ready` already has `--quick`/`--services-only` levels and the `NRestarts`
  crash-loop check (`substrate-ready.sh:76-107`); `substrate-status` is a verdict front
  end over it and `substrate-doctor`'s sections, not a new checker.
- `substrate-key whoami` is the `seeded` check; `substrate-doctor` §7 (real completion per
  arm) is the LLM half of `usable`; DLV's deterministic registry-count dispatch is the
  known-answer goal.
- `config-surface-probe.sh` supplies the input-surface counts the acceptance run tracks.
- `docker-compose.cluster.yml` becomes the generated hub+spoke fixture.

## Risks / Trade-offs
- **Breaking muscle memory** (`make run-live`, raw `docker run`, the nine `*_PORT`s) →
  phase 1 accepts the old names with a deprecation warning that names the new input.
- **Privileged systemd on CI runners** may not work on every hosted runner → task 0.3
  proves it before anything else depends on it; a self-hosted fresh VM is the fallback.
- **The acceptance run needs an LLM key** to reach `usable` → a scoped low-budget key held
  as a CI secret; a fixture provider is *not* acceptable (it would make `usable` hollow).
- **Prefix granularity** restricts offsets to multiples of 1000 → every offset in use
  already is.
- **A keyless spoke cannot reach `usable`** until federated LLM inheritance works (the docs
  record that it does not yet), so the hub+spoke acceptance case is red by design until
  then → it runs report-only and does not gate publishing until that change lands.
- **`served` depends on the manifest passing its port prefix in**, which Decision 2 now does.
- **Fork-scoped push slows cross-fleet improvement** for newcomers until promotion is earned →
  that is the intended trade: a cold substrate's landings reach others only with evidence.
- **One more container step** (`substrate-connect`) → it replaces two hand steps and a
  hardcoded script.

## Migration Plan
1. **Add** (non-breaking): labels + revision file; `substrate-status`, `substrate-connect`,
   `substrate-manifest`; `SUBSTRATE_NAME`/`SUBSTRATE_PORT_PREFIX` in the manifest with the
   old compose names still honoured and warned; surface bind; acceptance run in
   report-only mode.
2. **Switch**: README becomes the single page; other docs link; `make up` wraps compose;
   deploy scripts consume the manifest; acceptance run gates publishing `:dev`.
3. **Remove** after two consecutive green acceptance runs on each engine: deprecated
   lanes, old variable names, `configure-local.sh`, ambient fallbacks.
Rollback: phases 1-2 are additive or wrappers; the previous image tag runs unchanged
against the same volumes.

## Resolved decisions
1. Manifest location → Decision 2 (B, baked, per-digest, nested-default naming).
2. Hub composition → Decision 10 (`hub` dispatches; `hub-minimal` opt-out).
3. Push default → Decision 11 (capability scoped by owner; shared-branch promotion earned;
   env var is a kill switch only).
4. Engines → Decision 12 (Docker and Podman, each acceptance-tested).
5. Results and key → Decisions 6 and 13 (CI judges and gates; the substrate learns;
   narrow CI key; human installs report too).

## Open Questions
- Decision 10: include the `autonomy` role and boredom in `hub` (recommended), or leave hub
  self-development to a separate profile.
- The `installAcceptance` and `pushPolicy` shapes are new names. Before minting, task 0.2
  checks the registry for an existing producer of an equivalent shape (law 3).
- Federated LLM inheritance for keyless spokes is outside this change; until it lands, the
  `spoke` acceptance case is report-only.
