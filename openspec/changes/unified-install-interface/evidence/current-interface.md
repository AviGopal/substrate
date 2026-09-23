# The install and setup interface as it is

Investigator-authored (read-only) 2026-09-22, spot-checked by the change author; **✓** =
re-checked by hand. Line numbers are HEAD unless marked working tree. Measurements are
dated observations; re-derive before relying on them (`sources.md`).

## The interface in one paragraph

A newcomer faces **8 launch lanes** (plus 2 wrappers), **≥8 documents** each naming a
different canonical start, **two knob vocabularies** for naming an instance, **three
healthcheck definitions**, **three stop graces** (10 s / 30 s / 300 s), **five published-
port sets** (9/9/7/6/4), and a configuration funnel fed by **four indistinguishable
channels**. Everything load-bearing already runs inside the image; what the image cannot
do — hand a client its config, expose the human surface, report its own revision — is
exactly where setup fails.

## Stage by stage

| Stage | What exists today | How it fails |
|---|---|---|
| **0 Prerequisites** | Docker, `--privileged` (systemd PID 1). Per lane: compose → git+docker; `make up` → make, jq, curl, and **bun + submodules** when no local image; deploy-* → ssh; ui-only → `gh`; cockpit → node/npx. 9 host ports. Podman undocumented, yet every audit ran on it ✓ | missing bun/submodules loud; missing `npx` silent (cockpit just never connects) ✓ |
| **1 Acquire** | compose: clone (no submodules) + `docker compose pull`. make: build-if-missing, **never pulls** (`Makefile:441`) ✓. deploy-remote ships a local image; deploy-hub builds on the VM; deploy-hub-pull pulls. | **No revision is identifiable**: no OCI labels ✓, no git metadata in the image, and `substrate-pull-sync` converges `/vessels` to `origin/dev` at boot, so running code ≠ image code |
| **2 Configure** | Channels: run env (`-e`/shell/`.env`/compose default — indistinguishable), `/workspace/.substrate-secrets`, `~/.metabob/config.json` (make `?=`) ✓, `gh auth token` ✓, `LLM_ARMS`, inventory selection. Counts: gen-env provenance list 43 names; ~80 emitted; `.env.example` documents 50 (2 active); compose forwards 40; make forwards 45 | a name `.env` supplies but compose doesn't list is dropped silently; `substrate-config` says `unrecorded`; `-e VAR=` cannot clear a persisted value; `PEER_MULTIADDR` read, forwarded by nothing |
| **3 Launch** | `make up` · root compose · raw `docker run` (7 ports in the Makefile comment, 9 in README) · `make run` (no datastore volume) · `run-live-obsidian` (ignores offset) · deploy-remote · deploy-hub · deploy-hub-pull (hub without goal-host ✓) · ui-only-up · cluster compose (unnamed volumes). In-container boot is common: gen-env → apply-inventory → restore → federation auto-enable → arms → systemd | `up -d` exits 0 on a crash-loop; `up` on a running container ignores new settings |
| **4 Verify** | image HEALTHCHECK `substrate-ready --quick` (**null under Podman** ✓); compose overrides with discovery `/health` only ✓; cluster probes :8080/:8210; `substrate-ready.service` always exits 0 ✓; `make up` readiness `\|\| true` ✓; `substrate-key whoami`; `substrate-doctor` (8 sections incl. a real LLM call); `doctor --smoke` checks an execution id, **not `reached`** ✓ | the only signal that proves usability — a goal `reached:true` — is run by no lane |
| **5 Credential** | identity-seeder mints keys (gives up at 300 s). `substrate-key show/whoami/issue/jwt/list/revoke/bootstrap-admin`. Spoke keys issued on the hub | `show` prints a pre-seed placeholder without error; ambient keys leak into spokes via make |
| **6 Connect clients** | `~/.metabob/config.json` written only by host `configure-local.sh`, hardcoded `localhost:18080` + `substrate-live` ✓. Config path env var is `METABOB_CONFIG` (ui-only-up, HUMAN_SURFACE.md) vs `METABOB_CONFIG_PATH` (metabob-mcp, `.mcp.json`) → two files ✓. MCP install documented nowhere; plugin uses `npx -y @metabob/mcp`, default endpoint a hosted URL. Human surface binds loopback (baked unit) ✓ | cockpit silently absent on every lane but default-name `make up` |
| **7 Join** | `{METABOB_API_KEY, DISCOVERY_ENDPOINT}` point-and-go; transport auto-enabled; relay anchor from `/bootstrap` | derived identity unreachable → loud; deploy-remote peering truncated on next boot → silent; reservation liveness unproven |
| **8 Operate** | `make stop` drains 300 s; compose 30 s; docker 10 s ✓. Upgrade: compose pull+up; make has none; code self-updates via pull-sync. Backup: a docs-only tar recipe. `vessel-ctl` 10 verbs. Second fleet: `LIVE_NAME`+`PORT_OFFSET` (make) vs `SUBSTRATE_CONTAINER` + 2 volumes + 9 ports (compose) | default volume names silently shared by a second fleet |
| **9 Teardown** | `docker compose down [-v]`, `make clean`, manual `docker volume rm` | nothing removes client config or the MCP registration |

## Already in the image (usable as the contract's engine)

`gen-env`, `apply-inventory`, `apply-llm-arms`, `render-unit`, `substrate-entrypoint`,
`substrate-ready`, `substrate-doctor`, `substrate-key`, `substrate-config`, `vessel-ctl`,
`spoke-federate`, `setup-git-push`, `substrate-pull-sync`, `reseed-restart`, plus bun, jq,
curl, git (no `gh`). The raw `docker run` lane is already "image + one command" for a
fleet.

**Needs a host checkout today:** the compose file and `.env.example`; the Makefile (its
post-boot steps call the *worktree's* `substrate-ready.sh`/`substrate-doctor.sh`, which
can differ from the image's); `configure-local.sh`; `ui-only-up.sh`; deploy-*; the cluster
file; the backup recipe.

**The image cannot:** emit client configuration, install or describe the cockpit, expose
the human surface beyond loopback, or report its revision.

## Interface smells (counts)

1. LLM-key gate: gen-env warns (since 09-15), 4 make recipes refuse, 3 docs promise a boot
   refusal ✓ — a blank `.env` yields `healthy` + `whoami` valid + doctor §1-6 pass.
2. Config funnel fed 8 different-sized ways (85 refs / 43 provenance / ~80 emitted / 50
   documented / 40 compose / 45 make / 36 `?=` / 48 unit-only names).
3. 9 lanes + 2 wrappers; 2 instance vocabularies; spoke derivation implemented twice.
4. 3 probe definitions + 2 fail-open readiness gates; HEALTHCHECK absent under Podman;
   smoke test blind to `reached`.
5. 3 stop graces vs a documented 240 s drain + 90 s flush; 5 port sets.
6. 5 ambient-credential fallbacks.
7. Client config: 2 env-var names, 2 file locations, 1 hardcoded writer, 0 documented
   cockpit installs.
8. 9 silent failures (`cp -n` skip, `up -d` 0 on crash-loop, healthy≠seeded, `show`
   placeholder, `unrecorded`, shared default volumes, dropped `.env` names, truncated
   peering, keyless boot looks green).
9. Autonomous push defaults on (`MITOSIS_DIRECT_PUSH:-1`) with the kill switch commented
   out in `.env.example`.
10. No identifiable revision.
