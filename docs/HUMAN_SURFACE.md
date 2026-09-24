# Running a human surface

The human surface is the page a person talks to the substrate through: they type
what they want done, and the answer comes back drawn — a table as a table, a
command's output as terminal text — rather than as JSON on a screen.

This document explains what a surface is and how it behaves. Putting one in front
of a person is sequence D of [README § Installation](../README.md#installation), the
only place setup commands appear: the `surface` profile, pointed at a hub with the
two join inputs, waiting for the `served` verdict.

A surface does not need a substrate of its own. It runs as a **UI-only
federated spoke**: a container holding just a discovery registry, the federation
transport and the surface itself, pointed at a hub that already has the compute,
the trace store, and the identity plane. Everything the surface needs but does not
serve — `goal_execution`, `goalWalkState`, the activity and trace shapes, identity,
LLM resolution — is resolved on the hub through discovery fan-out over the
federation transport.

---

## What a surface needs

- **A hub that actually serves federation.** Not merely a substrate with the
  compute and the trace store: the surface joins over the relay, so the hub must
  advertise one. Check before you start, because an unrelayed hub is
  indistinguishable from a healthy one until the surface fails to register:

  ```bash
  curl -s http://<hub-host>:18100/bootstrap | jq '.relay_multiaddrs | length'   # must be > 0
  ```

  A hub launched with the `hub` profile runs its relay in-container and
  advertises it at its `PUBLIC_IP`; see [`FEDERATION.md`](FEDERATION.md).
- **A key issued by that hub** as the surface's `METABOB_API_KEY`. A key minted
  locally is not valid there and every hub-facing call answers 401, which
  surfaces later as a page that loads and then cannot dispatch anything.
- **No credential for the image, and no checkout.** `ghcr.io/avigopal/substrate`
  is a public package, and the surface and its built UI are baked into it.

The surface answers on `P310` (`http://127.0.0.1:18310` by default). To keep it on
the local host, map `127.0.0.1:P310:8310` in a compose override; the manifest's
port mapping is the only exposure decision.

## Using it

Type what you want in the box in plain language — "list the running units", "how
many TypeScript files are under repos/identity-vessel/src". The system owns the
decomposition. If a goal only works once you have rewritten it with file paths
and expected shapes, that rewriting is a gap in the system, not a workflow to
adopt.

Each run gets a page showing what was produced and whether the goal was actually
**reached** — which is not the same as the run exiting cleanly. Feedback typed
back into the surface is recorded as an operator verdict, not a comment.

---

## What runs where

The surface container holds a store for its own registry, the discovery vessel,
the federation transport, and the surface. That is deliberately almost nothing:

| Runs locally | Resolved on the hub |
|---|---|
| discovery (the fixed point, and the fan-out point) | `goal_execution`, `goalWalkState` |
| the human surface itself | activity + trace shapes |
| the federation transport | identity validation |
| a local store for the registry's own rows | LLM resolution |

Two consequences worth knowing before you debug anything:

**Every dispatch crosses the network.** A UI-only spoke has no local goal-host,
so each goal travels to the hub and back. A surface that loads but cannot
dispatch is nearly always the hub link — a key the hub did not issue, or a hub
that is not reachable — not the page.

**The hub URL must work from inside the container.** A check you run with `curl`
on the *host* and the surface's own calls from *inside* the bridge network see
different addresses. On a same-host hub/surface pair those differ: `127.0.0.1`
answers only from the host, the docker bridge gateway only from the container.
Use the machine's LAN IP, which answers from both. A hub URL that is unreachable
from the host reports `HTTP 000`, which reads like a federation failure and is
not one.

**A local port may legitimately answer nothing.** The container publishes the
usual `18xxx` range, but the units behind most of those ports are not running
here. Route by shape through discovery; reach for a host port only when you mean
to talk to one machine's copy.

## The roster: where it comes from, and when it changes

Which units a container runs is decided **before systemd starts**, from a fleet
inventory kept in the container's volume. The image seeds that file on first
boot; from then on the volume copy is authoritative, deliberately — a substrate
is allowed to alter its own membership.

A repo-side inventory change now reaches a running container on its own.
`substrate-pull-sync` converges both the inventory and the selector that reads
it, so you do not need an image rebuild to change a roster. Two things to hold
about the timing:

- **A converged inventory is not an applied one.** Selection runs pre-systemd, so
  the file can be current while the running units are not. Close the gap without
  restarting anything:

  ```bash
  docker exec <container> vessel-ctl drift    # what does this fleet actually run?
  docker exec <container> vessel-ctl apply    # make it match the inventory
  ```
- **It will not overwrite a customised inventory.** A sidecar records what the
  updater last wrote. Match it, and git wins. Differ from it, and the file is
  left alone and the sync log says so — because silently reverting a fleet's
  self-chosen membership is worse than being out of date, and an unexplained
  revert is exactly what nobody traces back. Delete the sidecar to accept git.

Two things it still does not govern, so expect them in `docker ps` on a surface
that should not have them:

- **Manifest vessels**, which the selector skips entirely by design.
- **LLM arm units rendered at boot** (`llm-opus`, `llm-haiku`, `llm-google`),
  which never exist as files for an inventory to name. They are governed instead
  by the entrypoint's arm pass, which honours the same role selection — a
  surface node excludes role `models`, so its arms are rendered but left
  unenabled and will NOT be running.

`docker ps` remains a poor guide to what a deployment is *supposed* to be; use
`docker exec <container> vessel-ctl status`.

## Updating a running surface

`ui/dist` is **committed**, so git is the delivery channel: a pull brings the
built bundle along with the source, and the surface serves it after a unit
restart. No toolchain on the box, no build step at boot that can fail, no
credential needed merely to render a page.

This is why the surface is not rebuilt on the container. A rebuild does not
reproduce the committed bundle byte-for-byte — vite content-hashes, and each
machine's bun differs — so building over a tracked `dist` leaves *modified
tracked files*, `git pull --ff-only` then refuses, and the deployment quietly
stops converging. The install hook builds only when `dist` is absent.

The cost lands on whoever changes UI source: a `ui/src` commit must carry its
rebuilt bundle. The pre-commit hook refuses otherwise and prints the command.
It cannot cover a commit path that skips hooks — substrate-authored commits
included — so a substrate that edits `ui/src` today still lands source without a
bundle.

The reliable check is the bundle, not the commit: compare the
`assets/index-*.js` the page references against what is on disk.

## Recreating one

The surface unit and its built UI are baked into the image and enabled there, so a
recreate through the manifest (install page, usage patterns) keeps the surface: the
volumes survive, and nothing the surface needs lives outside them or the image.

One hazard on the same path is worth knowing:

- **A federation transport in a restart loop reports `activating`, never
  `failed`.** It is invisible to `--state=failed`; read `restarts=` in
  `vessel-ctl status`, and read `live` in `substrate-status`, which fails a unit
  whose restart count rises during evaluation.

  **That tell does not cover the commonest case.** A transport that finds no
  relay anchor does not restart at all — it starts direct-only and polls for one —
  so a surface that never reached the relay looks identical to a federated one
  under both `--state=failed` and `restarts=`. The signal that separates them is
  the reservation: `curl -s http://127.0.0.1:8401/health` inside the container and
  read `.transport.activeReservations`; `0` means the surface is running and
  federating nothing.

## Stopping and starting one

A surface container can be stopped and started; it re-registers with the hub and
its shapes reappear in the registry without help. Two things make that true, and
both were silently false until they were tested by actually doing it:

- **The secrets must be persisted.** `/workspace/.substrate-secrets` had two
  writers that each truncated it, so `API_KEY_SECRET` could vanish. A container
  in that state runs indefinitely and refuses to boot the moment it is
  restarted — it will not sign keys with a secret it cannot reproduce. Only a
  substrate with a local datastore trips the check, which is why it hid.
- **The substrate id must be persisted too.** `FED_SUBSTRATE_ID` regenerated on
  each boot, so a restart appeared on the hub as a *new* substrate and left the
  old identity behind as a record nothing would ever refresh.

When judging whether a restart worked, do not ask whether the hub still lists
the substrate's shapes. Registry records outlive the process that wrote them by
the TTL, so that question answers yes for a box that is powered off. Ask whether
the record was refreshed *after* the restart.

## When it does not work

**The page loads, goals never complete.** The hub link. Confirm the key was
issued by the hub in your config, and that the hub's discovery endpoint answers.

**The launch refuses immediately.** By design — a partial or conflicting set of
install inputs, or a join variable without `DISCOVERY_ENDPOINT`. The message names
the input to set. An occupied host port is reported by the container engine; a
second surface on one host takes its own `SUBSTRATE_NAME` and port prefix.

**`served` fails.** The verdict names the unit or port: the surface must answer on
its published port from outside the container, not only on loopback.

**A shape resolves to a vessel that does not answer.** Registry records outlive
the process that wrote them. A record's presence is not proof of capability —
call the shape rather than trusting the listing.

## Related

- [README § Installation](../README.md#installation) — setup for a surface, a
  hub, or a complete local substrate.
- [`SUBSTRATE.md`](SUBSTRATE.md) — the image, topology selection, and operating a
  running fleet.
- [`FEDERATION.md`](FEDERATION.md) — how a spoke reaches shapes it does not
  serve.
