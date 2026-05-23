# Tasks — Single-Container Substrate

See `design.md` for rationale and architecture.

Acceptance criterion for the whole spec: `docker run metabob/substrate:dev` starts all
vessels healthy, `~/.metabob/config.json` pointing to `http://localhost:8080` lets
every existing harness run without modification, and `minibob --single "hello"` produces
a trace visible in activity-api.

---

## Phase 1 — Dockerfile.substrate

### 1.1 Base image with systemd

- [x] 1.1.1 Write `Dockerfile.substrate` in super-repo root using `debian:bookworm-slim`
  as base. Install systemd, dbus, and the minimal set of packages needed to run it
  inside a container (`systemd-sysv`, `libpam-systemd`). Set `CMD ["/lib/systemd/systemd"]`.
  Acceptance: `docker build -f Dockerfile.substrate .` completes without error;
  `docker run --rm --cap-add SYS_ADMIN metabob/substrate:dev systemctl list-units`
  exits 0.

- [x] 1.1.2 Add Bun runtime installation to the Dockerfile (curl from bun.sh official
  installer, pinned to the version used in vessel repos — read from any vessel
  `package.json` `engines.bun` field). Acceptance: `bun --version` inside container
  matches vessel requirement.

- [x] 1.1.3 Install SurrealDB binary (current version: 3.x, fetch from GitHub releases).
  Add `surrealdb.service` systemd unit:
  ```
  ExecStart=/usr/local/bin/surreal start \
    --user root --pass ${SURREAL_PASS} \
    --bind 0.0.0.0:8000 \
    file:/data/surrealdb
  ```
  Acceptance: unit reaches `active (running)` and `curl http://localhost:8000/health`
  returns 200.

- [x] 1.1.4 Install Valkey binary (Redis-compatible; fetch from valkey.io releases).
  Add `valkey.service` unit with `ExecStart=/usr/local/bin/valkey-server --port 6379
  --dir /data/valkey --appendonly yes`. Acceptance: unit active and `valkey-cli ping`
  returns PONG.

### 1.2 Vessel source layers

- [x] 1.2.1 `COPY repos/discovery-vessel /app/discovery-vessel` in Dockerfile.
  Run `bun install --frozen-lockfile --production` in that directory during build.
  Add `discovery-vessel.service` unit:
  ```
  Environment=PORT=8100
  Environment=DISCOVERY_SELF_ENDPOINT=http://localhost:8100
  ExecStart=bun run /app/discovery-vessel/index.ts
  Restart=on-failure
  RestartSec=3s
  ```

- [x] 1.2.2 `COPY repos/identity-vessel /app/identity-vessel`, install deps.
  Add `identity-vessel.service` unit with `After=surrealdb.service valkey.service
  discovery-vessel.service`:
  ```
  EnvironmentFile=/etc/substrate/env
  Environment=PORT=8101
  Environment=SURREALDB_URL=http://localhost:8000
  Environment=REDIS_URL=redis://localhost:6379
  Environment=DISCOVERY_VESSEL_ENDPOINT=http://localhost:8100
  ExecStart=bun run /app/identity-vessel/src/index.ts
  ```

- [x] 1.2.3 `COPY repos/metabob-activity-api /app/activity-api`, install deps.
  Copy the ONNX embedding model (`src/assets/models/`) into the image (it's bundled
  in the source tree; verify it's not gitignored). Add `activity-api.service` with
  `After=surrealdb.service valkey.service identity-vessel.service discovery-vessel.service`:
  ```
  EnvironmentFile=/etc/substrate/env
  Environment=PORT=8080
  Environment=SURREALDB_URL=http://localhost:8000
  Environment=SURREALDB_NAMESPACE=activity-system
  Environment=SURREALDB_DATABASE=learning_loop
  Environment=REDIS_URL=redis://localhost:6379
  Environment=DISCOVERY_VESSEL_ENDPOINT=http://localhost:8100
  Environment=EMBEDDING_MODEL_DIR=/app/activity-api/src/assets/models
  ExecStartPre=bun run /app/activity-api/scripts/init-database.ts
  ExecStart=bun run /app/activity-api/src/index.ts
  ```

- [x] 1.2.4 `COPY repos/minibob /app/minibob`, install deps. Add `minibob.service`
  with `After=activity-api.service`:
  ```
  EnvironmentFile=/etc/substrate/env
  Environment=MINIBOB_PORT=8200
  Environment=METABOB_ENDPOINT=http://localhost:8080
  Environment=DISCOVERY_VESSEL_ENDPOINT=http://localhost:8100
  Environment=DISCOVERY_ENABLED=true
  ExecStart=bun run /app/minibob/index.ts --daemon
  ```

- [x] 1.2.5 `COPY repos/development-vessel /app/development-vessel`, install deps.
  Add `development-vessel.service` with `After=activity-api.service`:
  ```
  EnvironmentFile=/etc/substrate/env
  Environment=PORT=8090
  Environment=METABOB_ENDPOINT=http://localhost:8080
  Environment=DISCOVERY_ENDPOINT=http://localhost:8100
  ExecStart=bun run /app/development-vessel/src/index.ts
  ```

### 1.3 Environment file and secrets

- [x] 1.3.1 Write `scripts/substrate/gen-env.sh`: generates `/etc/substrate/env`
  at container start from required env vars (`JWT_SECRET`, `SURREAL_PASS`,
  `METABOB_API_KEY`, `ANTHROPIC_API_KEY`). If `JWT_SECRET` or `SURREAL_PASS` are
  not provided, generate random values and print them to stdout once (they persist
  in the volume on subsequent starts). Template:
  ```
  JWT_SECRET=<value>
  SURREAL_PASS=<value>
  METABOB_API_KEY=<value>
  ANTHROPIC_API_KEY=<value>
  ```

- [x] 1.3.2 Write the container entrypoint: a shell script that (1) runs `gen-env.sh`,
  (2) enables all vessel systemd units (`systemctl enable --now`), (3) execs
  `/lib/systemd/systemd`. This replaces the direct `CMD` from 1.1.1.

---

## Phase 2 — Init and Seeding

### 2.1 Database init

- [ ] 2.1.1 Verify `repos/metabob-activity-api/scripts/init-database.ts` runs cleanly
  against a fresh SurrealDB file instance at `http://localhost:8000`. The script is
  already idempotent via migration tracking. Run it in a throw-away container against
  a temp file DB and confirm all migrations apply without error. Document the exact
  migration count (currently ~132) in a note in this tasks.md.

- [ ] 2.1.2 Add a `ExecStartPost` health-check to `activity-api.service`:
  ```
  ExecStartPost=/bin/bash -c 'for i in $(seq 1 30); do curl -sf http://localhost:8080/health && exit 0; sleep 1; done; exit 1'
  ```
  This makes systemd wait for the API to be ready before starting dependent units
  (minibob, development-vessel).

### 2.2 Identity seeding

- [x] 2.2.1 Write `scripts/substrate/seed-identity.ts`: on first container start (detect
  by checking if any `api_key` rows exist via identity-vessel `/v1/keys/list`), create
  one initial API key with `read,write` scope and `org_id: organizations:local` and
  print it to stdout. The key is stored in SurrealDB; subsequent starts skip seeding.
  This becomes the `METABOB_API_KEY` value in `~/.metabob/config.json`.

- [ ] 2.2.2 Wire `seed-identity.ts` into the entrypoint after identity-vessel reaches
  healthy. The generated key is printed to container stdout on first run so the user
  can capture it: `docker logs substrate 2>&1 | grep "SUBSTRATE_API_KEY"`.

### 2.3 Template seeding

- [ ] 2.3.1 After activity-api is healthy, run `development-vessel`'s
  `bun run cli seed-templates` to upload the seed templates (draft-gap-closing-activity,
  etc.) into the local activity-api. Add as `ExecStartPost` on `development-vessel.service`
  or as a one-shot `substrate-seed.service` that runs after all vessels are up.
  Acceptance: `curl http://localhost:8080/v2/activities/templates | jq '.total'` returns
  a non-zero count.

---

## Phase 3 — `systemd_restart` Resolver

The autonomous loop requires development-vessel to restart a systemd unit after
modifying vessel source code. Without this resolver, code changes by activities never
take effect — the running vessel keeps executing the old code.

- [x] 3.1 Add `systemd_restart` resolver to `repos/development-vessel/src/resolvers/`:
  - Input: `{ unit: string }` (systemd unit name, e.g. `"activity-api"`)
  - Executes `systemctl restart <unit>` then polls `systemctl is-active <unit>` until
    active or 30s timeout
  - Output shape: `systemd_unit_restart` → `{ success: boolean, active: boolean, startup_ms: number }`
  - Deterministic tier (no LLM). Requires the container to run with `--cap-add SYS_ADMIN`.
  - Acceptance: calling the resolver restarts the named unit and the unit reaches
    `active (running)` within the timeout. Returns `success: false` if the unit fails
    to start (caller can check logs via `journalctl -u <unit> -n 50`).

- [x] 3.2 Register `systemd_unit_restart` shape with discovery-vessel at
  development-vessel startup. Advertise it alongside the other development shapes
  (`git_status`, `git_diff`, `file_content`, etc.).

- [x] 3.3 Add a per-resolver test for `systemd_restart`:
  - Mock the `systemctl` call; verify the resolver polls until active.
  - Verify timeout path returns `{ success: false }`.
  - Verify the output shape matches `systemd_unit_restart` contract.

## Phase 4 — Observation Tooling

The substrate is autonomous; these tools are for observation only, not for driving
the loop.

- [x] 4.1 Write `scripts/substrate/Makefile` with targets:
  - `substrate-build` — build the container image
  - `substrate-run` — start the container with workspace + data volumes
  - `substrate-logs-<vessel>` — `docker exec substrate journalctl -u <vessel> -f`
  - `substrate-status` — `docker exec substrate systemctl status` for all units
  - `substrate-stop` — stop and remove the container
  - `substrate-shell` — `docker exec -it substrate bash` for inspection

  The `substrate-run` target mounts the workspace:
  ```bash
  docker run -d --name substrate --cap-add SYS_ADMIN \
    -v $(pwd):/workspace \
    -v ./substrate-data:/data \
    -p 8080:8080 -p 8100:8100 \
    metabob/substrate:dev
  ```

- [ ] 4.2 Write `scripts/substrate/configure-local.sh`: writes `~/.metabob/config.json`
  with `endpoint: http://localhost:8080` and the seeded API key from container logs.
  This is for observation tools (harness runs from host, workbench access) — not for
  driving the autonomous loop, which runs entirely inside the container.

- [ ] 4.3 Write `docs/SUBSTRATE.md` covering:
  - What the substrate is (autonomous self-developing system, not a dev environment)
  - How to start it and observe it (Makefile targets, workbench URL)
  - The autonomous loop topology (boredom → activity → development-vessel → systemd_restart → harness)
  - How to read Thompson progress (stratified harness output, workbench templates view)
  - How to steer without driving (add a spec file to /workspace/openspec/changes/ — the
    system will discover and implement it)

---

## Phase 5 — Autonomous Loop Verification

- [x] 5.1 Smoke: all vessels reach `active (running)` within 60s of container start.
  `curl http://localhost:8080/health` returns `{"status":"healthy"}`.

- [ ] 5.2 Boredom loop fires: within 5 minutes of container start with no external
  input, minibob daemon selects and executes an activity. Verify via:
  `GET http://localhost:8080/v2/activities/execution-traces?limit=1` returns ≥1 row.

- [ ] 5.3 `systemd_restart` resolver functions: dispatch an activity that writes a
  trivial change to a test file in /workspace and calls `systemd_restart` for
  `development-vessel`. Verify the unit restarts and returns to active without
  container restart.

- [ ] 5.4 Lifecycle observer fires: manually run `draft-gap-closing-activity` via
  minibob. Verify `harness-run-matrix` fires automatically within 30s by observing
  a new `failureModeReport`-shaped AET in activity-api:
  `GET http://localhost:8080/v2/activities/execution-traces?activity_template_id=development-vessel:harness-run-matrix`
  returns ≥1 row. (This task gates on harness-as-lifecycle-participant Phase 1 being
  complete inside the container.)

- [ ] 5.5 Commit `validation/baselines/local-substrate-cold.json`: template count,
  thompson_pool_size, recommend_mrr from first stratified harness run inside the
  container. This is the baseline for measuring autonomous warm-up.

---

## Phase 6 — Main Loop Integration

- [ ] 6.1 Update CLAUDE.md "Known substrate endpoints" to add
  `http://localhost:8080 — local single-container substrate (make substrate-run)`.

- [ ] 6.2 Update CLAUDE.md "The Development Loop" to describe the autonomous model:
  the substrate runs the loop; the human steers by adding specs to /workspace/openspec/;
  the harness fires from lifecycle events, not from scheduled scripts.

- [ ] 6.3 Confirm `.claude/scheduled_tasks.lock` harness runs use `METABOB_ENDPOINT`
  from config (not hardcoded canary). Already addressed by the portability commit
  (`8133817d`) — verify no regressions.

---

## Stop Condition

The spec is complete when:

- [ ] `docker run metabob/substrate:dev` brings up all seven services (infra + 5 vessels)
  without manual intervention; all units reach `active (running)` within 60s
- [ ] Minibob boredom loop fires autonomously within 5 minutes; a trace appears in
  activity-api without external input
- [ ] `systemd_restart` resolver functions: an activity can restart a vessel unit and
  the unit returns to active without container restart
- [ ] Lifecycle observer fires `harness-run-matrix` automatically after a
  registry-modifying activity completes (gates on harness-as-lifecycle-participant
  Phase 1)
- [ ] `validation/baselines/local-substrate-cold.json` committed
- [ ] `docs/SUBSTRATE.md` describes the autonomous model, not a developer workflow
