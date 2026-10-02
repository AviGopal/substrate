# Tasks

## Phase 0 — self-persistence (continuity first)

- [ ] 0.1 Define the `substrateSnapshot` bundle shape: manifest
      (substrate version, vessel versions, table list, row counts, sha,
      created_at) + per-store jsonl exports (SurrealDB tables, concept
      graph, `/workspace/memory/notes.json`). Exclude valkey (ephemeral).
- [ ] 0.2 `snapshot-state` resolver in development-vessel (three-place
      rule: resolver + `config.ts` shape + `impulses.ts` case + per-resolver
      test). Exports the bundle to `/workspace/snapshots/<ts>/` and writes a
      manifest. Formalizes the existing ad-hoc jsonl dump format.
- [ ] 0.3 `snapshot-state` activity template (seed) + autonomous trigger
      (systemd timer or boredom rotation entry — gated so it is NOT a fixed
      core-loop entry per `feedback_external_apps_outside_core_loop`).
- [ ] 0.4 Restore path: `restore-state` resolver + bootstrap hook that, on
      a fresh/empty container, pulls the latest bundle and imports it
      (idempotent, upsert-by-id; mirrors `import-operator-memory.ts`).
- [ ] 0.5 Verification: snapshot → restore into a scratch SurrealDB
      namespace → assert row-count + sha parity before declaring a bundle
      durable (closed-loop self-check, not blind export).
- [ ] 0.6 Off-host push of the bundle (depends on Phase 1 keystone):
      add `.gitattributes` LFS-tracking `*.jsonl`; push to
      `AviGopal/substrate-state` (private, empty — first push sets `main`).

## Phase 1 — container-side authenticated push (keystone)

> **FUNCTIONALLY LIVE & PROVEN in substrate-live 2026-06-16.** Direct-push
> cutover validated end-to-end: `push_status: pushed`,
> `AviGopal/development-vessel` dev advanced by a Substrate-Authored commit,
> `/vessels` runtime mirror confirmed. Capability code committed canonical
> (dev `2cad89c`). Remaining items below = SOURCE-persistence (for rebuild/M3
> durability) + test; the running container already has the capability.
> See [[finding-2026-06-16-substrate-self-develops-through-repos]].

- [x] 1.1 `gen-env.sh` PAT passthrough — DONE (source). Writes SUBSTRATE_GIT_PAT
      + AUTHOR_NAME/EMAIL to `/etc/substrate/env` and round-trips the PAT in the
      persisted-secrets heredoc (fixes a latent bug: old gen-env wiped an
      operator-supplied PAT on restart). Synced to running container.
- [x] 1.2 git identity + credential helper — DONE (source) in
      `scripts/substrate/setup-git-push.sh`: `git config --system` identity +
      env-PAT helper (NOT `--global` — systemd procs have no HOME). Synced + run.
- [x] 1.3 Wire `setup-git-push.sh` into startup — DONE (source): new
      `git-push-setup.service` oneshot (`Before=development-vessel`), COPY+enable
      in Dockerfile, dev-vessel unit `After=git-push-setup` + direct-push env +
      `EnvironmentFile=-/workspace/.substrate-secrets`. `run-live`/`run-detach`
      Makefile flipped (host-sync → SUBSTRATE_GIT_PAT). Synced to running container
      (restart-safe now, not just rebuild-safe).
      **Everything-mutable:** setup-git-push clones ALL 16 substrate vessels
      (not just development-vessel) so the cutover can self-develop any of them;
      created `dev` branches on the 9 split-outs for uniform `push origin dev`.
      Fixed `.dockerignore` (was excluding `repos/obsidian-vessel` while the
      substrate-obsidian stage builds it).
- [x] 1.4 `MITOSIS_DIRECT_PUSH=1` mode in `vessel-mitosis-cutover.ts` — DONE +
      committed to dev `2cad89c`. host_repo_root=`MITOSIS_PUSH_CLONE_DIR/<v>`,
      baseRoot=`MITOSIS_RUNTIME_DIR/<v>` (=/vessels). (Operator-anchored direct
      edit via SUBSTRATE_ALLOW_DIRECT_EDIT — the bootstrap paradox.)
- [x] 1.5 Mirror-to-`/vessels` + freshness re-derive confirmed (baseRoot=live
      runtime fixes the base_sha path-mismatch livelock). Real restart pending
      autonomous-loop exercise; **self-restart race** noted (dev-vessel restarts
      itself; change lands, trace may truncate).
- [x] 1.6 Host-sync retired for dev-vessel (unit no longer sets
      `MITOSIS_HOST_SYNC_MODE`). `run-live` Makefile flip still pending (source).
- [ ] 1.7 Per-resolver test for direct-push mode. Pending.

## Phase 2 — environment independence

- [ ] 2.1 Source vessels from the in-container writable clones (or a
      registry image tagged by CI) rather than the host `repos/` bind mount.
- [ ] 2.2 Push the substrate image to a registry; verify a clean pull+run
      on a second machine comes up healthy and restores from a bundle.
- [ ] 2.3 Move `/workspace` from `$(pwd)/workspace` bind mount to a named
      volume; portability carried by the Phase-0 bundle, not the host path.
- [ ] 2.4 Parameterize host-mapped ports + paths (env-driven, not hardcoded
      in Makefile/configure-local.sh).
- [ ] 2.5 Make harness hook endpoints config-driven (already partly:
      `DEV_VESSEL_ENDPOINT`, `GOAL_HOST_ENDPOINT`); remove hardcoded
      operator-home memory paths where the substrate copy is authoritative.

## Cross-cutting

- [ ] X.1 Operator: create fine-grained PAT (Contents:R/W on vessel repos +
      state repo); place at `/workspace/.substrate-secrets`. **BLOCKER for
      0.6, 1.x validation.**
- [x] X.2 `AviGopal/substrate-state` repo created (private, empty) 2026-06-16.
- [ ] X.3 Confirm `.gitignore` covers `workspace/.substrate-secrets` and the
      snapshot bundles (already noted in gen-env.sh comment; verify).
