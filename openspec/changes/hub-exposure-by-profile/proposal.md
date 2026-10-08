## Why

A hub publishes every vessel port on every host interface unless the operator narrows it in `.env`. The
README's port table states what each port must be reachable by (clients, spokes, peers, humans), and
says "a hub's firewall list is this table filtered by spokes". Yet nothing turns that table into an exposure:
a fresh hub, or a reinstall from the image plus an unmodified `.env`, publishes them all on `0.0.0.0`.
Law 11 says an image plus env must run identically wherever it is deployed. Today, how a hub is exposed
depends on hand edits to its `.env` and on a host firewall that only an operator script installs.

This was observed on 2026-10-07. activity-api's jwtAuth admitted any `X-Internal-Api-Key` value on its
trace, impulse and event writes. The hub published 18080 on `0.0.0.0`, so the network's learning store
accepted unauthenticated writes from the internet. The interim containment is a host firewall chain that
admits 18080 only from listed spoke addresses (`scripts/substrate/hub-firewall.sh`, plus a boot unit). The code fix
(activity-api 0423842: the header path removed) is the closure, and it is in the gate.

### What a binding can and cannot fix

- **It cannot fix 18080 itself.** Spokes reach a hub's activity-api over the internet, because gen-env
  derives `ACTIVITY_API_ENDPOINT=<hub>:18080` for every hub-attached spoke and the spoke profile runs no
  activity-api of its own. Binding to the hub's public address instead of `0.0.0.0` exposes the same
  thing on a single-interface host. Exposure of a spoke-facing port is closed by authentication, and
  narrowed only by WHO may connect, never by which local address listens.
- **It can fix every port no spoke needs.** On a hub, goal-host (P210, clients only), the stateful UI
  (P270, humans) and the human surface (P310, humans) are published beyond the host for no reader.
  Making the profile choose their publish address removes that exposure at the source, on every hub.

## What Changes

1. **Exposure is derived from the profile.** The port table (vessel, must-be-reachable-by, profiles) becomes
   one committed file, `scripts/substrate/exposure.json`, that the README table is generated from or linted against.
   For each profile, each port is either `remote` (published on `SUBSTRATE_PUBLISH_IP`, default every interface)
   or `local` (published on `127.0.0.1`). The rule: a port is `remote` on a profile only if a reader in its
   must-be-reachable-by column lives on ANOTHER host for that profile. On a hub: activity-api, discovery,
   identity, relay, and any spoke-read port (see open question 1) are `remote`; goal-host, the stateful UI and
   the human surface are `local`.
2. **The installer and deploy.sh write those defaults.** For each `local` port they write
   `<VESSEL>_PUBLISH_IP=127.0.0.1` into a fresh `.env`, unless the operator set that variable. An existing
   `.env` is never rewritten silently: deploy.sh's existing `--accept-ports` preflight already refuses a
   change in exposure, and it now also names the profile default that differs. The compose manifest is
   unchanged; it already honours `<VESSEL>_PUBLISH_IP`.
3. **A hub's spoke-facing ports are source-restricted by an install input, as defence in depth.** For a hub
   profile, deploy.sh installs the `hub-firewall.sh install-boot` unit with `ALLOW_18080_SRC` taken from a
   new install input, `HUB_SPOKE_SOURCES`. When the input is unset, no unit is installed, and deploy.sh warns
   that the hub's spoke-facing ports are open to any source. That is correct only while every such port
   authenticates every write.
4. **A check that detects the class without an operator (law 6).** `substrate-status`, which already reads
   published ports, compares the container's actual publish set with `exposure.json` for its profile and
   reports `exposure_drift` with the port names. On a hub it also reports whether the firewall boot unit is
   enabled, and how many sources it admits. This is what would have caught a 0.0.0.0 publish of an
   unauthenticated port. It does not judge authentication; the per-vessel keyless-route probe gap
   (`nothing-probes-each-vessels-data-routes-for-keyless-access`) is that detector.

## Impact

- Live hub: no change until this is reviewed. Its current publishes are already narrowed by the firewall,
  so applying item 2 there is a deliberate redeploy with `--accept-ports`, done with the user.
- Spokes and standalone nodes: the same derivation applies. A standalone node keeps every port `remote` only if
  the operator says so; its readers are on the same host, so the derived default is `local`, which is the
  safer default for a developer machine. That changes what a fresh standalone exposes; see open question 2.
- Script retention: `hub-firewall.sh` gains a caller (deploy.sh) and keeps its test, so it is no longer an
  uninvoked operator tool. The 18080 restriction can be lifted once 0423842 is live on the hub, by setting
  `HUB_SPOKE_SOURCES` empty, and the chain stays as default-deny for the `local` ports.

## Open questions for review

1. The README table says development-vessel (P090) and concept-db (P260) must be reachable by spokes.
   On the live hub both are firewalled from outside: 18260 since 2026-10-04, because it served private
   concepts unauthenticated, and 18090 by the default-deny. Spokes run their own development-vessel. Either
   the table is wrong for a hub, or spokes have silently lost something they read. This must be resolved
   before `exposure.json` is written. It is a docs-against-reality discrepancy, so it is filed as a gap
   either way.
2. **Ruled by the user (2026-10-08): `local` by default.** A fresh standalone publishes every port on
   `127.0.0.1`, and an operator opts in to wider exposure with `SUBSTRATE_PUBLISH_IP`. Existing installs are
   unchanged: deploy.sh's preflight refuses an exposure change without `--accept-ports`.
