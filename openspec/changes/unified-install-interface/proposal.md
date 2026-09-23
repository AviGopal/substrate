## Why

A substrate is supposed to boot "from an image plus env plus volumes" on any host (law 11),
and the operator's first contact with it is installation. Today that contact is a
maze: 8 launch lanes, ≥8 documents each naming a different canonical start, two
vocabularies for naming an instance, three healthcheck definitions, three stop graces,
five published-port sets, and no documented way to connect the cockpit CLAUDE.md mandates
(`evidence/current-interface.md`). `docs/SUBSTRATE.md` is headed "Launch: two canonical
paths"; README says "the two lanes do not translate each other."

The prior setup audits did not catch this because they could not. All of them ran on one
host, under Podman, with the image already local and the operator's credentials ambient;
from September they ran their own drivers rather than the documented commands, and the
docs were then aligned to the drivers. Of 55 deduplicated findings, 22 hold, 14 are
partial, 17 were never fixed, 2 regressed, and **none was verified off-host or on a pulled
image** (`evidence/prior-audit-ledger.md`). An independent attempt on another host found
the docs do not produce an easy setup.

The ledger shows five recurring classes, each with a structural cause: lane-drift (each
launcher re-declares the same facts), fail-open checks (a check that cannot run passes),
fixes outside the artifact (repairs verified in a drop-in or overlay, never shipped),
warm-state masking (ambient credentials and local images hide fresh-host failures), and
doc-code drift (docs aligned to a harness, not to the artifact). Fixing instances has been
fast (~1 day) and non-durable. This change removes the causes by defining the install
interface once, as a contract the image owns, with an acceptance run that is the only
thing allowed to call setup green.

## What Changes

- **One install contract, owned by the image.** The complete newcomer input surface is
  `{instance name, port prefix, anchor + credential, provider key, profile, push capability}`
  — one required for a standalone, two for a spoke, three for a hub; everything else is advanced configuration
  documented in one reference. Launchers pass inputs through; they
  derive nothing. The spoke derivation, key guard and port arithmetic that the Makefile
  duplicates move to (or stay in) the image.
- **One launch manifest.** Ports, volumes, healthcheck, stop grace, tmpfs and privilege are
  declared in exactly one file, and every supported launcher consumes it. **BREAKING:**
  raw `docker run` recipes, `make run`/`run-detach`, `run-live-obsidian`'s private port
  list, `deploy-remote.sh`'s and `deploy-hub-pull.sh`'s own `docker run` lines, and the
  compose vocabulary `SUBSTRATE_CONTAINER`/`*_VOLUME`/nine `*_PORT` are replaced by the
  manifest and its two inputs (`SUBSTRATE_NAME`, which is the container name as `LIVE_NAME`
  is today, and `SUBSTRATE_PORT_PREFIX`).
- **No ambient inputs.** A launcher reads only declared inputs. The Makefile's `?=`
  fallbacks to `~/.metabob/config.json` and `gh auth token` are removed.
- **A readiness verdict that cannot fail open.** One in-image command reports five
  ordered levels — `live`, `seeded`, `served`, `usable`, `connected` — each
  `pass | fail | unknown`; `unknown` never counts as pass. `usable` requires a baked
  known-answer goal to return `reached:true`. The healthcheck, `make up`, and the docs all
  read this one verdict.
- **The image hands the client its connection.** An in-image command emits the client
  configuration (endpoint computed from the published ports, a validated key) and the MCP
  registration line; one config path and one env-var name.
- **Reachable by default, identifiable always.** Every published vessel binds all
  container interfaces (publishing is the exposure boundary); the image carries its
  revision as OCI labels and in a file, and the verdict reports image revision and running
  `/vessels` revision separately.
- **Profiles name real compositions.** `PROFILE` selects `standalone`, `hub` (which now
  includes goal-host and the compute vessels every deployed hub has needed), `hub-minimal`,
  `spoke`, `surface` or `compute`; nothing is unmasked by hand.
- **Push is a scoped capability.** A git credential grants autonomy (standing ruling);
  `SUBSTRATE_REPO_OWNER` scopes where it lands; landing on a branch other fleets converge to
  is promoted by evidence through a `pushPolicy` impulse. `MITOSIS_DIRECT_PUSH` becomes a
  kill switch only.
- **One install page.** README § Installation is the only place setup commands appear;
  every other document links to it.
- **An install acceptance run is the class detector.** On every published image, a fresh
  host with no ambient state executes the install page's fenced commands verbatim, on
  each declared engine (Docker and Podman), and records the verdict. CI judges and gates
  publishing; the result is also posted to the reference hub as a traced impulse and files a
  gap on failure, so the substrate learns install health and closes its own install gaps. A
  person's install can report the same way. A setup fix is closed only when the acceptance
  run passes on a pulled image.

## Capabilities

### New Capabilities
- `install-contract`: the complete, closed set of install inputs, their derivations, and
  the prohibition on ambient inputs and host-side derivation.
- `launch-manifest`: the single declaration of how the image is run, and the rule that
  every launcher consumes it.
- `readiness-verdict`: the five-level, three-valued verdict and what each level proves.
- `client-connection`: the image-emitted client configuration and cockpit registration.
- `install-acceptance`: the off-host, doc-following acceptance run, what may call setup
  green, and how results reach the substrate.
- `push-capability`: push as an owner-scoped capability with evidence-gated promotion.

### Modified Capabilities
_None in `openspec/specs/` (no archived baseline exists for setup)._

## Impact

- **Host tooling:** `docker-compose.yml`, `scripts/substrate/Makefile`,
  `configure-local.sh`, `deploy-remote.sh`, `deploy-hub.sh`, `deploy-hub-pull.sh`,
  `ui-only-up.sh`, `docker-compose.cluster.yml`, `.env.example`.
- **Inventory and federation:** `vessels.inventory.json` profiles; `federation-relay` moves
  in-container for hub profiles.
- **Landing route:** `repos/development-vessel/src/resolvers/vessel-mitosis-cutover.ts`
  (owner scope, `pushPolicy`).
- **Image:** `Dockerfile.substrate` (labels, revision file), unit files
  (`human-surface-vessel.service` bind), `substrate-ready`, `substrate-doctor`,
  `substrate-key`, `gen-env.sh` (single role derivation), CI
  `build-substrate-image.yml` (labels, Docker-format build for HEALTHCHECK under Podman).
- **Docs:** README § Installation becomes the single install page; `docs/SUBSTRATE.md`
  §§ Launch/Container config matrix/Deploy paths, `docs/FEDERATION.md` join sections,
  `docs/guides/CONTAINER_NETWORK_LIFECYCLE.md`, `docs/guides/SYZYGY_LOCAL_SURFACE.md`,
  `docs/HUMAN_SURFACE.md`, `.claude/skills/deploy` and `metabob-substrate` skill setup text
  are reduced to links; `repos/deployment/README.md` gets a deprecation banner.
- **Existing installs:** every existing fleet's container and volume names are preserved
  (default and non-default alike); default names stay (`substrate-live`,
  `substrate-workspace`, `substrate-surreal`, ports 18xxx), so a running fleet is adopted,
  not replaced.
- **Bootstrap tier.** All of this runs before a substrate exists, so it sits inside the
  CLAUDE.md script-retention exception; the acceptance run is how it is nonetheless
  observed failing (`design.md` § Decision 6).
