# Sources

Re-derivation commands for the load-bearing claims in `proposal.md` and `design.md`. The
**Observed** column holds measurements from 2026-09-22 on the operator host, not
expectations; re-run before relying on one. Run from the super-repo root.

| Claim | Command | Observed |
|---|---|---|
| Docs declare two canonical paths | `grep -n 'two canonical paths' docs/SUBSTRATE.md` | line 208 |
| Human-surface unit pins loopback | `grep -n 'HOST=' scripts/substrate/units/human-surface-vessel.service` | `HOST=127.0.0.1` |
| Vessel default is all interfaces | `grep -n 'HOST' repos/human-surface-vessel/src/config.ts` | `process.env.HOST ?? "0.0.0.0"` |
| Other vessels ignore the unit's HOST | decode `/proc/net/tcp` in a running container for :8100/:8210 | bound `0.0.0.0` with `HOST=127.0.0.1` in unit |
| Make never reads `.env` | `grep -nE '^\s*-?include' scripts/substrate/Makefile` | no output |
| README says it does | `sed -n 503,505p README.md` | "let `make` pick it up" |
| Ambient key fallbacks | `sed -n 96,99p scripts/substrate/Makefile; sed -n 128p scripts/substrate/Makefile` | `?=` from `~/.metabob/config.json`, `gh auth token` |
| `make up` never pulls | `sed -n 440,442p scripts/substrate/Makefile` | build only if `image inspect` fails |
| Readiness fail-open in make | `grep -n 'substrate-ready.sh --timeout' scripts/substrate/Makefile` | `\|\| true` |
| Ready unit always succeeds | `grep -n ExecStart scripts/substrate/units/substrate-ready.service` | `\|\| echo … continuing` |
| Smoke ignores `reached` | `sed -n 381,404p scripts/substrate/substrate-doctor.sh \| grep -c reached` | 0 |
| Key gate demoted in gen-env | `grep -n 'DEMOTED FROM A BOOT GATE' scripts/substrate/gen-env.sh` | present |
| Make still refuses keyless | `grep -n 'No LLM provider key found' scripts/substrate/Makefile` | 4 hits |
| Compose overrides healthcheck | `grep -n -A2 'healthcheck:' docker-compose.yml` | curl `:8100/health` |
| Compose stop grace | `grep -n stop_grace_period docker-compose.yml` | `30s` |
| Client config written only by make, default name | `sed -n 458,462p scripts/substrate/Makefile; grep -n 18080 scripts/substrate/configure-local.sh` | `LIVE_NAME = substrate-live`; hardcoded `:18080` |
| No image revision | `docker image inspect ghcr.io/avigopal/substrate:dev --format '{{json .Config.Labels}}'` | `io.buildah.version` only |
| Podman drops HEALTHCHECK | `docker image inspect ghcr.io/avigopal/substrate:dev --format '{{json .Config.Healthcheck}}'` | `null` |
| Hub role lacks compute | `jq -c .roles.hub scripts/substrate/vessels.inventory.json` | no `compute` |
| Live hub goal-host hand-started | `ssh … docker exec substrate-live systemctl is-enabled goal-host-vessel` | `disabled` (while `active`) |
| Seed ordering fix uncommitted | `git diff --stat scripts/substrate/units/development-vessel-seed.service` | modified, not committed |
| Fresh clone root noise | `git clone --depth 1 -b dev https://github.com/AviGopal/substrate.git x && ls x \| wc -l` | 173 entries |
| This host is Podman, no bun, no npx | `docker version; which bun npx` | podman 6.1.2; neither found |
| Compose nested defaults resolve (Decision 2) | a compose file with `container_name: ${SUBSTRATE_CONTAINER:-${SUBSTRATE_NAME:-substrate}-live}`; `SUBSTRATE_NAME=lab podman-compose config` | podman-compose 1.6.0: `lab-live`, `lab-workspace`; default `substrate-live`, `substrate-workspace`. Docker Compose v2 not tested here (plugin link broken on this host) |
| Real hub composition (Decision 10) | `grep -n HUB_EXTRA_VESSELS scripts/substrate/deploy-hub.sh` | goal-host, development, local-tools, ribosome, analysis, light-dispatch; comment records they were once hand-unmasked |
| Hub role lacks compute and autonomy | `jq -c .roles.hub scripts/substrate/vessels.inventory.json` | store, control, api, transport, seed, infra, registry, models |
| Relay runs outside any manifest | `grep -rn 30333 docker-compose.yml scripts/substrate/deploy-hub*.sh` | host process in deploy scripts; not published by compose |
| Push ruling: autonomy gated by capability | operator memory `feedback-consumed-means-verified-by-a-trusted-activity-and-autonomy-is-gated-by-push-capability` | ruling 3 (2026-08-09) |
| metabob-mcp config precedence | `grep -n METABOB_CONFIG_PATH -A10 ../metabob-mcp/src/config.ts` | override > `./.metabob/config.json` > `~/.metabob/config.json` > hosted default |
| Landing route file | `rg -l -a MITOSIS_DIRECT_PUSH repos/*/src` | `repos/development-vessel/src/resolvers/vessel-mitosis-cutover.ts` |
| Prior audit ran here, not off-host | read each audit's "where" in `evidence/prior-audit-ledger.md` | 14/14 this host |

Evidence files: `evidence/prior-audit-ledger.md` (review of prior audits, 55 rows),
`evidence/current-interface.md` (the interface as it is), and
`validation/reports/setup-path-bifurcation-audit-2026-09-22/REPORT.md`.
