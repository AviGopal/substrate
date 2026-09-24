Almost every task here is bootstrap tier (`scripts/substrate/`, `Dockerfile.substrate`,
unit files, CI, docs), which runs before a substrate exists and cannot route through the
edit-intent path; those are operator-run. A task naming a `repos/<vessel>/src/` file is
dispatched as a goal naming that one file, and verified by reading `reached` and the
landed diff. Every task is verified **on a pulled image by the acceptance run** once
section 1 exists (Decision 7); a check on the operator host is a pre-check, never the
verification.

## 0. Pre-registration

- [x] 0.1 Ratify the open questions in `design.md` (Decisions 2, 6, 10-13).
- [x] 0.2 Identify the existing gap-intake producer the acceptance run will use, and search the registry for existing equivalents of `installAcceptance` and `pushPolicy` before minting either (law 3). Producers found in the registry and reused: `substrateGap_write` (gap intake), `memoryNote_write` with note_type `installAcceptance` (no new shape), and `pushPolicy`/`pushPolicy_write` on the existing `<x>Policy` pattern.
- [ ] 0.3 Prove privileged systemd boots to `seeded` on the chosen CI runner under Docker and under rootless Podman; confirm nested compose defaults resolve in the compose implementation chosen per engine; if a hosted runner cannot, provision a fresh-VM runner.
- [ ] 0.4 Record the baseline: run the current README quick-start verbatim on that runner and save the transcript as the "before" evidence, expecting the failures in `evidence/current-interface.md`.

## 1. The detector first (report-only)

- [x] 1.1 Mark README § Installation's command blocks as `install` fences, without changing their content.
- [x] 1.2 Add the acceptance workflow that extracts and runs the `install` fences on a fresh runner per published digest and per engine; verify it reproduces 0.4's failures. Pending: a run on a published digest reproducing 0.4.
- [x] 1.3 Add the Podman acceptance job alongside Docker.
- [x] 1.4 Post the acceptance result to the reference hub and file a gap on failure via the producer from 0.2; verify a deliberately broken fence files exactly one gap. Pending: the one-gap check on a deliberately broken fence.

## 2. Image-owned contract

- [x] 2.1 Add OCI labels and `/etc/substrate/image-revision` in `Dockerfile.substrate` and the workflow; build in Docker format; make submodule-bump commits trigger a publish.
- [x] 2.2 Drop `HOST=127.0.0.1` from `scripts/substrate/units/human-surface-vessel.service`; verify via acceptance that `:18310/` returns 200 on a fresh pull. Pending: the `:18310/` check on a fresh pull.
- [x] 2.3 Commit the `development-vessel-seed.service` ordering after identity-seeder; verify via acceptance on a fresh volume that all dev seed templates upload. Pending: the fresh-volume upload count.
- [x] 2.4 Add `substrate-status` over `substrate-ready` + doctor sections, with the five levels and three values; make `substrate-ready.service` report its verdict instead of succeeding unconditionally; make `doctor --smoke` require `reached:true`.
- [x] 2.5 Bake a known-answer goal for `usable` (reuse the deterministic registry-count goal used by the lifecycle verification).
- [x] 2.6 Add `substrate-connect` (client config + registration line, refuses before `seeded`).
- [x] 2.7 Refuse `HUB_DISCOVERY_URL`/`PEER_MULTIADDR` without `DISCOVERY_ENDPOINT` in `gen-env.sh`.
- [x] 2.8 Make the image HEALTHCHECK `substrate-status --quick --level seeded`.
- [x] 2.9 Record the first authenticated request arriving from outside the container in `repos/activity-api/src/middleware/jwtAuth.ts` (dispatch as a goal naming that file), and have `substrate-status` read it for `connected`. Landed as a direct edit, not a dispatched goal (the cockpit was unreachable).
- [x] 2.10 Add `substrate-status --report` posting a human-reported `installAcceptance`.
- [x] 2.11 Add the `profiles` `standalone`, `hub` (role + goal-host, development, local-tools, ribosome, analysis, light-dispatch), `hub-minimal`, `spoke`, `surface`, `compute` to `vessels.inventory.json`; derive the default in gen-env; verify a recreated `PROFILE=hub` keeps goal-host enabled. `hub` includes the `autonomy` role and boredom-vessel (Decision 10). Pending: the recreated-hub check on a published image.
- [x] 2.12 Run `federation-relay` in-container for `hub`/`hub-minimal`, publish it at `P333` (`RELAY_PORT` alias for `30333`), and advertise the published address from `/bootstrap`; verify a spoke reserves a circuit on a hub with no host relay process. Pending: a spoke reserving a circuit on a hub with no host relay.
- [x] 2.13 Make `substrate-connect` print only config JSON on stdout (registration line and warnings on stderr); refuse a git token without `SUBSTRATE_REPO_OWNER` and partial or conflicting name aliases in `gen-env.sh`, before any write.
- [x] 2.14 Make `substrate-entrypoint` dispatch `manifest`/`status`/`connect` from argv so `docker run --rm <image> manifest` works without `--entrypoint`; keep the `--entrypoint` form documented until it ships.

## 2b. Push capability

- [x] 2b.1 Scope every landing to `SUBSTRATE_REPO_OWNER` in `repos/development-vessel/src/resolvers/vessel-mitosis-cutover.ts` (dispatch as a goal naming that one file). Landed as a direct edit, not a dispatched goal. A new install enters the scoped regime through the initial policy gen-env writes on a fresh volume; an existing volume stays grandfathered.
- [x] 2b.2 In the same file, read the `pushPolicy` impulse at landing time; refuse shared-branch targets without a cited promotion; verify a withdrawn promotion takes effect without a restart.
- [x] 2b.3 Reduce `MITOSIS_DIRECT_PUSH` to a documented kill switch in `gen-env.sh` and `.env.example`. gen-env, `.env.example`, the manifest and the configuration reference name it the emergency stop.

## 3. One manifest

- [x] 3.1 Rewrite `docker-compose.yml` on `SUBSTRATE_NAME` + `SUBSTRATE_PORT_PREFIX` using nested defaults (`${SUBSTRATE_CONTAINER:-${SUBSTRATE_NAME:-substrate}-live}`, likewise volumes), keep the old names as warned exact-name aliases, pass the prefix into the container, remove the healthcheck override, and set the stop grace from the drain + flush budget.
- [x] 3.2 Bake the manifest into the image, add `substrate-manifest`, attach it to each published digest; fail the build on a byte difference. The build compares the published digest's `substrate-manifest` with the tracked file and attaches it.
- [x] 3.3 Generate the hub+spoke fixture from the manifest; delete the hand-maintained cluster file.

## 4. Launchers become pass-through

- [x] 4.1 Reduce `make up` to build-if-asked → compose → `substrate-status --wait usable` → `substrate-connect`; delete the host spoke derivation, the `?=` ambient fallbacks, and the four keyless-refusal recipes.
- [x] 4.2 Remove `run`, `run-detach`, `run-live-obsidian` (as a lane) and `configure-local.sh`.
- [x] 4.3 Collapse `deploy-hub.sh`/`deploy-hub-pull.sh`/`deploy-remote.sh` to copying the manifest + `.env` and running compose on the target. `deploy.sh` is the one path; the three scripts are deprecated shims over it.
- [ ] 4.4 Verify via acceptance that `make up` and the install page produce identical `docker inspect` output for the same inputs.

## 5. Docs cleanup: collapse to one install page

Timing: 5.1–5.4 land in migration phase 2 (after sections 2–4 ship), 5.5 in phase 3 (after
the aliases are removed). The disposition of every affected doc is in `interface.md` § 6.
Docs are never edit-gated; every item here is operator-run unless it names a `src/` file.

- [x] 5.1 Rewrite README § Installation from `interface.md` §§ 1–4 as the only page with setup commands, every command block fenced `install`; fold README § Join, § Building from source and § Running your own hub into its sequences C, G and B.
- [x] 5.2 Apply the disposition table (`interface.md` § 6) to `CLAUDE.md`, `docs/SUBSTRATE.md`, `docs/FEDERATION.md`, `docs/operations/CONFIGURATION_SURFACE.md`, `docs/HUMAN_SURFACE.md`, `docs/testing/QUICK_VERIFICATION_GUIDE.md`, `docs/LIVE_DEVELOPMENT.md`, the guides, the deploy and metabob-substrate skills, `.env.example`, the compose header, the Makefile header, and `docs/README.md`; verify a search for launch commands (`docker compose up`, `make -C scripts/substrate up`, `docker run --privileged`, `deploy-hub`) outside README § Installation finds none. The launch-command search finds none outside README § Installation (archived changes aside).
- [ ] 5.3 Move `docs/guides/SYZYGY_LOCAL_SURFACE.md` under `validation/reports/syzygy-local-bringup-2026-09-22/`; fold `CONTAINER_NETWORK_LIFECYCLE.md` into `docs/SUBSTRATE.md` and delete it; repoint `HUMAN_PROJECT_LIFECYCLE.md`; add deprecation banners to `repos/deployment/README.md` and the cloud-dashboard Helm section; label vessel-README `bun run dev` sections developer-only; move or delete the root `.env.devbob*.example`. Partial: the development-vessel and activity-api READMEs carry the developer-only label; the guides, `repos/deployment`, the Helm docs and identity-vessel's README are outside this change's tree.
- [x] 5.4 Unify the client-config override name on `METABOB_CONFIG_PATH` in `ui-only-up.sh` and docs.
- [ ] 5.5 Phase 3: delete the migration notes and every remaining mention of the retired names (`LIVE_NAME`, `PORT_OFFSET`, `SUBSTRATE_CONTAINER`, `*_VOLUME`, the nine `*_PORT`, `run-live`, `configure-local`, `30333`).
- [ ] 5.6 Delete the tracked repo-root scratch files (outside `ALLOWED_TOPLEVEL_DIRS` and the root files the hook allows) and install `scripts/git-hooks/pre-commit` in the in-container clones where the substrate commits; verify a substrate-authored commit adding a root file is rejected. Partial: the root scratch files are deleted and setup-git-push installs the placement hook in the push clones; the rejected-commit check is pending.

## 5b. Docs cleanup: purge the substrate's copy

Deleting text from the repo does not delete it from the system: docs are ingested into
concept-db, and deleted sections keep being retrieved until reaped.

- [x] 5b.1 Make a refused reap file a gap instead of only logging `reap:"refused"` in `scripts/substrate/ingest-docs-as-concepts.ts`; verify with a reap set over the cap.
- [ ] 5b.2 After 5.2 and again after 5.5, run one supervised reap of stale doc sections (backing up concept-db first); verify a concept search for `run-live`, `PORT_OFFSET` and "two canonical paths" returns no live section.
- [ ] 5b.3 Sweep `memoryNote` entries and drafter lessons (`compose_lesson`) that prescribe retired lanes; retire or rewrite them through the memory resolver (law 10), then refresh the operator memory cache.

## 5c. Docs cleanup: keep it clean (the class detectors)

- [x] 5c.1 Add a deterministic check to `repos/development-vessel/src/resolvers/docs-align-tick.ts`: launch commands outside README § Installation are findings (dispatch as a goal naming that file). Landed as a direct edit, not a dispatched goal; 5c.3's false-positive count is not yet measured on a live tree.
- [x] 5c.2 In the same file, flag environment variable names in docs that `gen-env.sh` neither reads nor emits, and make targets absent from the Makefile; verify it flags `IDENTITY_URL` on a fixture doc.
- [x] 5c.3 In the same file, exclude `node_modules` from the script walk; verify the false-positive count drops on an unchanged tree.
- [ ] 5c.4 File a gap for the missing capability: a targeted doc-fix landing path to the super-repo, without which doc alignment cannot be substrate work (law 9).
- [ ] 5c.5 Verify the detectors fire: re-introduce a restated `docker compose up` in a scratch doc and confirm a `docs_align_tick` finding plus a gap, then remove it. A positive control run through the install-surface check (a scratch doc restating compose, an unread variable and a removed make target) produced all four findings; the live tick and its gap are pending.

## 6. Cut-over

- [ ] 6.1 Make the acceptance run gate publishing `:dev`.
- [ ] 6.2 After two consecutive green runs per engine, remove the deprecated aliases.
- [ ] 6.3 Docs cleanup done when: the acceptance run is green on both engines; setup commands appear in exactly one file; `docs_align_tick` reports no restated commands or unread variables; the old-lane concept search returns only reaped sections.
- [ ] 6.4 Archive this change so its specs become the `openspec/specs` baseline for setup.
- [ ] 6.5 Re-run the durability ledger against the new HEAD and record, per class, which rows the acceptance run now covers.
