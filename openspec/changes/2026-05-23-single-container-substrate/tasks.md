# Tasks — Single-Container Substrate

See `design.md` for rationale and architecture.

Acceptance criterion for the whole spec: `docker run metabob/substrate:dev` starts all
vessels healthy, `~/.metabob/config.json` pointing to `http://localhost:8080` lets
every existing harness run without modification, and `minibob --single "hello"` produces
a trace visible in activity-api.

---

## Phase 1 — Dockerfile.substrate

### 1.1 Base image with systemd

- [ ] 1.1.1 Write `Dockerfile.substrate` in super-repo root using `debian:bookworm-slim`
  as base. Install systemd, dbus, and the minimal set of packages needed to run it
  inside a container (`systemd-sysv`, `libpam-systemd`). Set `CMD ["/lib/systemd/systemd"]`.
  Acceptance: `docker build -f Dockerfile.substrate .` completes without error;
  `docker run --rm --cap-add SYS_ADMIN metabob/substrate:dev systemctl list-units`
  exits 0.

- [ ] 1.1.2 Add Bun runtime installation to the Dockerfile (curl from bun.sh official
  installer, pinned to the version used in vessel repos — read from any vessel
  `package.json` `engines.bun` field). Acceptance: `bun --version` inside container
  matches vessel requirement.

- [ ] 1.1.3 Install SurrealDB binary (current version: 3.x, fetch from GitHub releases).
  Add `surrealdb.service` systemd unit:
  ```
  ExecStart=/usr/local/bin/surreal start \
    --user root --pass ${SURREAL_PASS} \
    --bind 0.0.0.0:8000 \
    file:/data/surrealdb
  ```
  Acceptance: unit reaches `active (running)` and `curl http://localhost:8000/health`
  returns 200.

- [ ] 1.1.4 Install Valkey binary (Redis-compatible; fetch from valkey.io releases).
  Add `valkey.service` unit with `ExecStart=/usr/local/bin/valkey-server --port 6379
  --dir /data/valkey --appendonly yes`. Acceptance: unit active and `valkey-cli ping`
  returns PONG.

### 1.2 Vessel source layers

- [ ] 1.2.1 `COPY repos/discovery-vessel /app/discovery-vessel` in Dockerfile.
  Run `bun install --frozen-lockfile --production` in that directory during build.
  Add `discovery-vessel.service` unit:
  ```
  Environment=PORT=8100
  Environment=DISCOVERY_SELF_ENDPOINT=http://localhost:8100
  ExecStart=bun run /app/discovery-vessel/index.ts
  Restart=on-failure
  RestartSec=3s
  ```

- [ ] 1.2.2 `COPY repos/identity-vessel /app/identity-vessel`, install deps.
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

- [ ] 1.2.3 `COPY repos/metabob-activity-api /app/activity-api`, install deps.
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

- [ ] 1.2.4 `COPY repos/minibob /app/minibob`, install deps. Add `minibob.service`
  with `After=activity-api.service`:
  ```
  EnvironmentFile=/etc/substrate/env
  Environment=MINIBOB_PORT=8200
  Environment=METABOB_ENDPOINT=http://localhost:8080
  Environment=DISCOVERY_VESSEL_ENDPOINT=http://localhost:8100
  Environment=DISCOVERY_ENABLED=true
  ExecStart=bun run /app/minibob/index.ts --daemon
  ```

- [ ] 1.2.5 `COPY repos/development-vessel /app/development-vessel`, install deps.
  Add `development-vessel.service` with `After=activity-api.service`:
  ```
  EnvironmentFile=/etc/substrate/env
  Environment=PORT=8090
  Environment=METABOB_ENDPOINT=http://localhost:8080
  Environment=DISCOVERY_ENDPOINT=http://localhost:8100
  ExecStart=bun run /app/development-vessel/src/index.ts
  ```

### 1.3 Environment file and secrets

- [ ] 1.3.1 Write `scripts/substrate/gen-env.sh`: generates `/etc/substrate/env`
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

- [ ] 1.3.2 Write the container entrypoint: a shell script that (1) runs `gen-env.sh`,
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

- [ ] 2.2.1 Write `scripts/substrate/seed-identity.ts`: on first container start (detect
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

## Phase 3 — Developer Tooling

### 3.1 Makefile

- [ ] 3.1.1 Write `scripts/substrate/Makefile` (or `substrate.mk`) with targets:
  - `make substrate-build` — `docker build -f Dockerfile.substrate -t metabob/substrate:dev .`
  - `make substrate-run` — `docker run -d --name substrate --cap-add SYS_ADMIN -v ./substrate-data:/data -p 8080:8080 -p 8100:8100 -p 8200:8200 metabob/substrate:dev`
  - `make substrate-restart-<vessel>` — `docker exec substrate systemctl restart <vessel>` (one target per vessel)
  - `make substrate-logs-<vessel>` — `docker exec substrate journalctl -u <vessel> -f`
  - `make substrate-status` — `docker exec substrate systemctl status` for all vessel units
  - `make substrate-stop` — `docker stop substrate && docker rm substrate`
  - `make substrate-shell` — `docker exec -it substrate bash`

- [ ] 3.1.2 Write `scripts/substrate/configure-local.sh`: writes `~/.metabob/config.json`
  with `endpoint: http://localhost:8080` and the seeded API key (fetched from container
  logs or passed as argument). Prints next steps.

### 3.2 Source volume development mode

- [ ] 3.2.1 Document (in a `SUBSTRATE.md` in the super-repo root or `docs/`) the
  source-volume dev loop:
  ```bash
  make substrate-run-dev  # adds -v ./repos/<vessel>:/app/<vessel> for each vessel
  # Edit repos/metabob-activity-api/src/routes/activities.ts
  make substrate-restart-activity-api
  # Change is live in ~2 seconds
  ```
  Add `substrate-run-dev` target to the Makefile that mounts all repos/ source trees.

---

## Phase 4 — Harness Validation

### 4.1 Smoke test

- [ ] 4.1.1 With `~/.metabob/config.json` pointing to `http://localhost:8080`, run:
  ```bash
  bun run validation/scripts/failure-mode-harness.ts --label "local-smoke"
  ```
  Acceptance: harness completes without connection errors. gap_count may be non-zero
  (cold Thompson state); that's expected. No HTTP 500s or auth failures.

- [ ] 4.1.2 Run `minibob --single "list the files in the current directory"` against
  the local substrate. Acceptance: execution completes, trace appears in activity-api
  (`GET http://localhost:8080/v2/activities/execution-traces?limit=1` returns a row).

### 4.2 Thompson warm-up baseline

- [ ] 4.2.1 Commit a `validation/baselines/local-substrate-cold.json` capturing the
  initial state: template count, thompson_pool_size=0, recommend_mrr from first
  stratified harness run. This is the baseline against which warm-up is measured.

- [ ] 4.2.2 After 48h of development activity (or 50+ executions), run the stratified
  harness again and compare. Acceptance: thompson_pool_size > 0, recommend_mrr > cold
  baseline. Document the warm-up trajectory in `validation/failure-modes/PROGRESSION.md`
  under a new "Local Substrate" section.

---

## Phase 5 — Main Loop Integration

- [ ] 5.1 Update `openspec/changes/2026-04-26-impulse-activity-loop/tasks.md` to add
  Phase 26 (this spec) as the active development path. Note that Phase 5 cutover
  prerequisites (H1, H5) are not required in the single-container substrate and the
  development loop proceeds under the container trust model.

- [ ] 5.2 Update CLAUDE.md "Known substrate endpoints" to include:
  ```
  - http://localhost:8080  — local single-container substrate
  ```
  And update "The Development Loop" to show `make substrate-restart-<vessel>` as the
  iteration step alongside `git push`.

- [ ] 5.3 Update `.claude/scheduled_tasks.lock` if any scheduled harness runs are
  pinned to the canary endpoint, so they use `METABOB_ENDPOINT` from config instead.

---

## Stop Condition

The spec is complete when:

- [x] `docker run metabob/substrate:dev` brings up all six services (infra + 4 vessels)
  without manual intervention
- [x] `~/.metabob/config.json` with `endpoint: http://localhost:8080` passes the
  failure-mode harness smoke test
- [x] `minibob --single "<goal>"` produces a trace visible in activity-api
- [x] Restarting a single vessel unit does not require restarting the container
- [x] The stratified harness produces a non-error report (gap_count may be non-zero)
- [x] CLAUDE.md and SUBSTRATE.md reflect the local-first development loop
