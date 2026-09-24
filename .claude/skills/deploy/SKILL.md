# Deploy Vessel

Reload or add a vessel on a running substrate. There is no cluster/Helm path;
historical Kubernetes material is reference-only and must not be run.

> Deployment of a *code change* is normally not your job at all: a change
> dispatched as a goal lands via the substrate's own cutover (commit → push →
> restart with typecheck evidence), and every fleet converges to `origin/dev`
> through its in-container pull-sync. Use this skill for recovery and the
> exceptional manual edit.

Launching a substrate (standalone, hub, spoke, surface, a second fleet, a
remote node) is not a deploy step: it is
[README § Installation](../../../README.md#installation), the only place setup
commands appear. Do not restate or improvise launch commands here or in a
dispatch.

## Reload one vessel (in-container, the image ships the tool)

```bash
docker exec <container> vessel-ctl sync <vessel>      # pull the clone's origin/dev + mirror + restart
docker exec <container> vessel-ctl restart <vessel>   # restart only; works for every unit, core ones included
docker exec <container> vessel-ctl status             # the fleet: state, enabled, restarts=
```

`vessel-ctl sync` reads the container's own clone, never your working tree, so
land the change on `origin/dev` first; an unpushed host edit does not arrive.

## Add or remove a vessel at runtime

```bash
docker exec <container> vessel-ctl list               # installable vessels
docker exec <container> vessel-ctl install <vessel>   # persisted in the workspace; survives recreate
docker exec <container> vessel-ctl uninstall <vessel>
docker exec <container> vessel-ctl drift              # inventory vs what runs (read-only)
docker exec <container> vessel-ctl apply              # converge; no action lines = converged
```

**Before any restart:** confirm nothing is mid-flight (check recent
executions / health), and remember learning state lives in the container
volumes; back them up before anything destructive (README § Installation →
Usage patterns).

**Verify after:** `docker exec <container> substrate-status` (the five-level
verdict), the vessel's unit is `active` with a flat `restarts=`, and it
re-registered with discovery (`registry_query mode:"vessels"` for one of its
shapes).

## Rollback

The substrate's self-recovery reverts a broken vessel to last-good from the
in-container clone. If you must do it manually: revert the commit on `dev`,
then `vessel-ctl sync <vessel>`. Never hand-edit state in the container volume.

Operating reference: [`docs/SUBSTRATE.md`](../../../docs/SUBSTRATE.md).
