Almost every task here is bootstrap tier (`scripts/substrate/`, `Dockerfile.substrate`,
unit files, CI, docs), which runs before a substrate exists and cannot route through the
edit-intent path; those are operator-run. A task naming a `repos/<vessel>/src/` file is
dispatched as a goal naming that one file, and verified by reading `reached` and the
landed diff. Every task is verified **on a pulled image by the acceptance run** once
section 1 exists (Decision 7); a check on the operator host is a pre-check, never the
verification.

## 0. Pre-registration

- [x] 0.1 Ratify the open questions in `design.md` (Decisions 2, 6, 10-13).
- [ ] 0.2 Identify the existing gap-intake producer the acceptance run will use, and search the registry for existing equivalents of `installAcceptance` and `pushPolicy` before minting either (law 3).
- [ ] 0.3 Prove privileged systemd boots to `seeded` on the chosen CI runner under Docker and under rootless Podman; confirm nested compose defaults resolve in the compose implementation chosen per engine; if a hosted runner cannot, provision a fresh-VM runner.
- [ ] 0.4 Record the baseline: run the current README quick-start verbatim on that runner and save the transcript as the "before" evidence, expecting the failures in `evidence/current-interface.md`.

## 1. The detector first (report-only)

- [ ] 1.1 Mark README § Installation's command blocks as `install` fences, without changing their content.
- [ ] 1.2 Add the acceptance workflow that extracts and runs the `install` fences on a fresh runner per published digest and per engine; verify it reproduces 0.4's failures.
- [ ] 1.3 Add the Podman acceptance job alongside Docker.
- [ ] 1.4 Post the acceptance result to the reference hub and file a gap on failure via the producer from 0.2; verify a deliberately broken fence files exactly one gap.

## 2. Image-owned contract

- [ ] 2.1 Add OCI labels and `/etc/substrate/image-revision` in `Dockerfile.substrate` and the workflow; build in Docker format; make submodule-bump commits trigger a publish.
- [ ] 2.2 Drop `HOST=127.0.0.1` from `scripts/substrate/units/human-surface-vessel.service`; verify via acceptance that `:18310/` returns 200 on a fresh pull.
- [ ] 2.3 Commit the `development-vessel-seed.service` ordering after identity-seeder; verify via acceptance on a fresh volume that all dev seed templates upload.
- [ ] 2.4 Add `substrate-status` over `substrate-ready` + doctor sections, with the five levels and three values; make `substrate-ready.service` report its verdict instead of succeeding unconditionally; make `doctor --smoke` require `reached:true`.
- [ ] 2.5 Bake a known-answer goal for `usable` (reuse the deterministic registry-count goal used by the lifecycle verification).
- [ ] 2.6 Add `substrate-connect` (client config + registration line, refuses before `seeded`).
- [ ] 2.7 Refuse `HUB_DISCOVERY_URL`/`PEER_MULTIADDR` without `DISCOVERY_ENDPOINT` in `gen-env.sh`.
- [ ] 2.8 Make the image HEALTHCHECK `substrate-status --quick --level seeded`.
- [ ] 2.9 Record the first authenticated request arriving from outside the container in `repos/activity-api/src/middleware/jwtAuth.ts` (dispatch as a goal naming that file), and have `substrate-status` read it for `connected`.
- [ ] 2.10 Add `substrate-status --report` posting a human-reported `installAcceptance`.
- [ ] 2.11 Add the `profiles` `standalone`, `hub` (role + goal-host, development, local-tools, ribosome, analysis, light-dispatch), `hub-minimal`, `spoke`, `surface`, `compute` to `vessels.inventory.json`; derive the default in gen-env; verify a recreated `PROFILE=hub` keeps goal-host enabled.
- [ ] 2.12 Run `federation-relay` in-container for `hub`/`hub-minimal`, publish it at `P333` (`RELAY_PORT` alias for `30333`), and advertise the published address from `/bootstrap`; verify a spoke reserves a circuit on a hub with no host relay process.
- [ ] 2.13 Make `substrate-connect` print only config JSON on stdout (registration line and warnings on stderr); refuse a git token without `SUBSTRATE_REPO_OWNER` and partial or conflicting name aliases in `gen-env.sh`, before any write.
- [ ] 2.14 Make `substrate-entrypoint` dispatch `manifest`/`status`/`connect` from argv so `docker run --rm <image> manifest` works without `--entrypoint`; keep the `--entrypoint` form documented until it ships.

## 2b. Push capability

- [ ] 2b.1 Scope every landing to `SUBSTRATE_REPO_OWNER` in `repos/development-vessel/src/resolvers/vessel-mitosis-cutover.ts` (dispatch as a goal naming that one file).
- [ ] 2b.2 In the same file, read the `pushPolicy` impulse at landing time; refuse shared-branch targets without a cited promotion; verify a withdrawn promotion takes effect without a restart.
- [ ] 2b.3 Reduce `MITOSIS_DIRECT_PUSH` to a documented kill switch in `gen-env.sh` and `.env.example`.

## 3. One manifest

- [ ] 3.1 Rewrite `docker-compose.yml` on `SUBSTRATE_NAME` + `SUBSTRATE_PORT_PREFIX` using nested defaults (`${SUBSTRATE_CONTAINER:-${SUBSTRATE_NAME:-substrate}-live}`, likewise volumes), keep the old names as warned exact-name aliases, pass the prefix into the container, remove the healthcheck override, and set the stop grace from the drain + flush budget.
- [ ] 3.2 Bake the manifest into the image, add `substrate-manifest`, attach it to each published digest; fail the build on a byte difference.
- [ ] 3.3 Generate the hub+spoke fixture from the manifest; delete the hand-maintained cluster file.

## 4. Launchers become pass-through

- [ ] 4.1 Reduce `make up` to build-if-asked → compose → `substrate-status --wait usable` → `substrate-connect`; delete the host spoke derivation, the `?=` ambient fallbacks, and the four keyless-refusal recipes.
- [ ] 4.2 Remove `run`, `run-detach`, `run-live-obsidian` (as a lane) and `configure-local.sh`.
- [ ] 4.3 Collapse `deploy-hub.sh`/`deploy-hub-pull.sh`/`deploy-remote.sh` to copying the manifest + `.env` and running compose on the target.
- [ ] 4.4 Verify via acceptance that `make up` and the install page produce identical `docker inspect` output for the same inputs.

## 5. One install page

- [ ] 5.1 Rewrite README § Installation around the install inputs and profiles (see `interface.md`), the verdict, `substrate-connect`, and teardown including client-side removal.
- [ ] 5.2 Replace setup text in `docs/SUBSTRATE.md`, `docs/FEDERATION.md`, `docs/HUMAN_SURFACE.md`, `docs/guides/CONTAINER_NETWORK_LIFECYCLE.md`, the deploy and metabob-substrate skills, `.env.example` and the compose header with links; move `SYZYGY_LOCAL_SURFACE.md` under `validation/`; add a deprecation banner to `repos/deployment/README.md`.
- [ ] 5.3 Unify the client-config override name on `METABOB_CONFIG_PATH` in `ui-only-up.sh` and docs.

## 6. Cut-over

- [ ] 6.1 Make the acceptance run gate publishing `:dev`.
- [ ] 6.2 After two consecutive green runs per engine, remove the deprecated aliases.
- [ ] 6.3 Re-run the durability ledger against the new HEAD and record, per class, which rows the acceptance run now covers.
