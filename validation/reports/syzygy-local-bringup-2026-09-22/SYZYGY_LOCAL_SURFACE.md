# Local human surface on Syzygy (verification record)

This is dated evidence from one Syzygy fixture, not an operating procedure. The
procedure is [README § Installation](../../../README.md#installation) (sequence C to
join, D for a surface), with the protocol in
[`docs/FEDERATION.md`](../../../docs/FEDERATION.md) and surface behaviour in
[`docs/HUMAN_SURFACE.md`](../../../docs/HUMAN_SURFACE.md). The hosts, image
identifiers, ports, and recovery actions below are not portable configuration, and
the hand-built compose launch below predates the one-token join.

**Observed result on 2026-09-22: local setup succeeded, after a manual recovery.** The
first P2P attempt returned `NO_RESERVATION`; restarting only Syzygy's federation
transport restored the route. The board read hub-owned dispatches. Ten of eleven
bounded read probes returned successfully; the activity trace listing timed out. See
the verification report, `REPORT.md` in this directory.

**Later observation (2026-09-29):** the route was found broken again with nothing
filed, so the result above does not show the reservation defect cannot recur; see
[the federation-p2p dossier](../realignment-2026-09-29/dossiers/federation-p2p.md).

This is the observed September 22, 2026 bring-up, using the locally available
image `125775d713bcfb1011ff6516766f2bb807f1d50036aa678eb733f830b1bfb94e`.
It creates `syzygy-local-surface` and leaves existing containers alone.
The local instance supplies the browser surface, discovery, transport, and local
support stores. Execution, model services, and the activity store belong to the
existing Syzygy network. No local model key or Git credential is needed.

`docker start substrate-live` is not equivalent to this procedure. That name
refers to a pre-existing legacy container with its own image, volumes, ports,
and configuration. It counts as a Syzygy join only after its actual topology
settings and P2P route have been verified.

## Start

From the repository root, create the protected credential file once. Supply a
key issued by Syzygy's identity authority; a locally minted key will not work.
The following Bash sequence avoids putting the credential in shell history:

```bash
umask 077
read -rsp 'Syzygy API key: ' syzygy_join_key
printf '\n'
(set -o noclobber; printf 'METABOB_API_KEY=%s\n' "$syzygy_join_key" > .env.syzygy-local)
unset syzygy_join_key
```

`.env.syzygy-local` is gitignored. Reuse it on subsequent starts.
The recorded setup reused and validated the existing `spoke-syz` join key
without printing it or modifying that container.

```bash
docker compose \
  -f validation/reports/syzygy-local-bringup-2026-09-22/compose.yaml \
  -p syzygy-local-surface up -d --no-build

docker exec syzygy-local-surface substrate-key whoami
docker exec syzygy-local-surface substrate-ready --once --json
docker exec syzygy-local-surface vessel-ctl status
```

Open **http://127.0.0.1:38310**. The browser port is bound only to host loopback.
The Compose file pins a **local image ID**, not a registry digest: another host
must obtain a verified image and change that reference before running it.
The tested engine is rootless Podman with podman-compose behind the Docker CLI.

## Configuration that matters

- Local discovery remains `http://127.0.0.1:8100`; local vessels register here.
- `HUB_DISCOVERY_URL` and `PEER_DISCOVERY_ENDPOINTS` point to
  `http://syzygy.host:18100`.
- Identity is `http://syzygy.host:18101`; activity storage is configured as
  `http://syzygy.host:18080`.
- Transport learns the relay from the hub's `/bootstrap` response. Do not pin
  a copied relay address when the hub can advertise its current address.
- `FED_SUBSTRATE_ID=syzygy-local-surface-20260922` identifies this instance.
  Choose another unique value when deploying another instance.
- The explicit inventory omits local goal-host, development, tools, and model
  services. Remote capability checks therefore cannot pass through local copies.
- The baked human-surface unit binds to container loopback. The read-only
  `surface-host.conf` mount overrides it to `0.0.0.0` inside the container;
  otherwise publishing its port does not make it accessible from the host.

The two named volumes are `syzygy-local-surface-workspace` and
`syzygy-local-surface-surreal`. Preserve both and this launch plan.
The baked surface and UI are already present; do not run the historical
`ui-only-up.sh` credential/clone/install journey for this image. Its mandatory
Git credential and workdir assumptions are not required for this tested path.

## Verify the connection

```bash
curl -fsS http://127.0.0.1:38310/health
curl -fsS http://127.0.0.1:38310/ > /dev/null
docker exec syzygy-local-surface curl -fsS http://127.0.0.1:8401/health
python3 validation/reports/syzygy-local-bringup-2026-09-22/operate.py probe
```

Require a live reservation (`reservationsHeld`, not merely a remembered circuit
address), actual responses via `/egress/resolve`, and a capability coverage
comparison. The probe saves its results in the report directory. It reads
remote policies/state and runs a bounded `printf` tool probe; it does not invoke
arbitrary write capabilities, deployments, or goal execution.

HTTP discovery and identity are bootstrap/control dependencies in this setup.
A successful P2P capability response does not imply that all traffic, identity
validation, or every human-surface request uses P2P.

## Maintain

Repeat the same Compose `up` command to reconcile the instance. Use the same
file/project with `stop` and `start` for suspension/resumption. `down` removes
the container and Compose network while retaining named volumes; do not add
`-v` unless deliberately deleting its state.

For a built-in roster change, edit the Compose selection and run `up -d` again.
The volume-backed inventory/manifest and `installed.json` govern vessel
selection and dynamically installed membership. Inspect `vessel-ctl drift`
and real service/capability results after changing them.

The companion explicit-inventory proof (`inventory-idempotence.json` in this directory)
uses a separate instance and volumes. It repeats `up`, force-recreates the
container, checks the persistent identity and workspace marker, confirms the
instance in Syzygy's registry, and verifies read-only `activeDispatches` in both
P2P directions. A new inventory should be accepted only after the same checks;
an inventory list is a composition request, not a dependency proof by itself.

See the bring-up report (`REPORT.md` in this directory)
for measured capability coverage, failures, and the limits of verification.
