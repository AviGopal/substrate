# Deploy Vessel

Deploy or reload a vessel on a running substrate. Two live paths: hot-reload
into the local single-container substrate, and shipping to a remote VM. There
is no cluster/Helm path; historical Kubernetes material is reference-only under
`repos/deployment/` and must not be run.

> Deployment of a *code change* is normally not your job at all: a change
> dispatched as a goal lands via the substrate's own cutover (commit → push →
> restart with typecheck evidence). Use this skill for bootstrap, recovery, and
> the exceptional manual edit.

## Local substrate (hot-reload)

```bash
# Reload one vessel from the working tree into the running container
make -C scripts/substrate restart-<vessel>     # sync + unit restart
make -C scripts/substrate sync-<vessel>        # sync only

# Which vessels have targets: read the Makefile's .PHONY list
grep "restart-" scripts/substrate/Makefile
```

Vessels without a restart target are core units — restart them directly:
`docker exec substrate-live systemctl restart <unit>`.

**Before any restart:** confirm nothing is mid-flight (check recent
executions / health), and remember learning state lives in the container
volume — back it up before anything destructive (`docs/SUBSTRATE.md`).

**Verify after:** the vessel's `/health` responds, its unit is `active`
(`docker exec substrate-live systemctl is-active <unit>`), and it re-registered
with discovery (`registry_query mode:"vessels"` for one of its shapes).

## Full substrate bootstrap

```bash
make -C scripts/substrate up ANTHROPIC_API_KEY=...
```

One command: build, start, in-container seed, readiness, doctor. Idempotent.
A federated spoke is the same command pointed at a hub's discovery endpoint,
plus enabling the federation transport — see `docs/SUBSTRATE.md`.

## Remote VM

```bash
scripts/substrate/deploy-remote.sh   # ship the local image over SSH (no registry)
scripts/substrate/deploy-hub.sh      # VM pulls repo, builds hub + federation relay
```

## Rollback

The substrate's self-recovery reverts a broken vessel to last-good from the
in-container clone. If you must do it manually: revert the commit on `dev`,
then `restart-<vessel>`. Never hand-edit state in the container volume.
