# Federation for the UI-only spoke

How a substrate that runs only a human surface joins a hub, resolves the shapes
it does not serve, is verified to actually be federated, and is removed without
leaving registry rot.

This document describes behaviour a reader can expect. It names no host, no
credential path, and no deployment.

## What standing one up actually requires

A spoke joins a hub over **HTTP plus the relay**. It does not need shell access
to the hub, and nothing here modifies the hub: the spoke registers itself by
mirroring its own capability upward. Shell access to the hub host is required
only to change the *hub* — to ship or start its image, to issue a key, or to
open its ports. Those are hub-side tasks, and a spoke that already has a key and
a reachable discovery endpoint needs none of them.

Three inputs, and no more:

1. **A hub discovery endpoint that answers over HTTP** from the spoke host.
2. **A hub-issued API key.** See "Booting against a hub" for why a locally
   minted one cannot work.
3. **A read credential for the super-repo.** This one is easy to miss because it
   has nothing to do with federation. The human surface is a *manifest* vessel
   whose working directory is a path inside the in-container super-repo clone,
   and that repository is private. The boot-time git setup arms its credential
   helper only when the substrate git PAT is present — a generic GitHub token
   does not engage it. Without the PAT the clone fails, the boot falls back to
   the working tree baked into the image (which carries the scripts tier and no
   vessel sources), and the surface has no working directory to be installed
   into. The symptom is a missing workdir at install time, several minutes after
   the real cause. Supply the credential, or expect that failure.

## What a UI-only spoke is

A spoke is a full substrate that has been trimmed to a role. A UI-only spoke
keeps the smallest set that lets a substrate be a substrate:

- its own **datastore** and its own **discovery registry**, so local vessels
  register locally and the spoke remains a genuine peer rather than a client;
- the **human surface vessel**, the only thing it actually serves;
- the **federation transport**, which mirrors that local capability up to the
  hub and answers hub-side resolves for the shapes the spoke owns;
- the small infra tier: readiness, log forwarding, self-recovery, pull-sync, and
  the seed step that establishes the in-container super-repo clone the surface
  runs out of.

It deliberately does **not** run the trace store, identity, the LLM resolvers,
the goal host, or any autonomy timer. Those live on the hub, and the spoke
resolves them there. This is law 11 in practice: a vessel belongs where its data
lives, and none of that data lives on a UI box.

`scripts/substrate/ui-only-up.sh` encodes this selection. It prints its plan and
the exact container-creation command before acting, with secret values redacted;
supports `DRY_RUN=1`, which prints both and changes nothing; refuses with usage
when the hub endpoint, the hub key, or the git credential is missing; and
refuses outright if a container of the target name exists or if any host port it
would publish is already listening — it never stops or recreates a running
substrate. After boot it asserts, rather than reports: the container runs, the
UI bundle was actually built, the surface answers from the **host** port, and
the surface's shapes are present in the **hub's** registry. It ends in a
PASS/FAIL verdict block and exits non-zero when any of those fail.

## Reaching the surface from outside the container

A UI-only spoke exists to be looked at, so the one topology detail that decides
whether it works at all is the surface's **bind address**. Two facts compose
into a trap:

- a published host port delivers traffic to the container's bridge address, not
  to its loopback address, so a process bound to loopback never sees it;
- the vessel manifest's environment block is rendered into the unit *after* the
  substrate-wide environment file, so whatever the manifest declares wins.

A surface pinned to loopback therefore starts cleanly, answers `/health` from
inside the container, registers with discovery normally, mirrors to the hub
normally — and returns nothing at all on its published port. Every signal reads
healthy except the only one that matters. The surface's manifest entry declares
an all-interfaces bind for this reason, and the launcher additionally writes a
unit drop-in asserting the same value, so a container built from an older image
is corrected at install time rather than failing mysteriously.

This does not affect registration. The vessel advertises a loopback self
endpoint in its discovery payload regardless of what it binds, because peers
reach it through the federation transport's ingress rather than by dialling that
address directly.

**Verify it on the host, never in the container.** An in-container health check
passes in exactly the broken case, which makes it worse than no check: run the
check against the published port from the host, and read a failure there
together with the container's listening sockets — a loopback address in that
listing names the cause immediately.

## Booting against a hub

Two inputs: the hub's discovery endpoint and a hub-issued API key.

Supplying a discovery endpoint **with no explicit role selection** is the signal
that flips the container into the federated-spoke path. From that one value the
launcher derives:

- the **spoke role** as the default selection;
- the **hub discovery URL** the container sees, passed under a distinct name
  from the local discovery endpoint;
- the hub's **trace-store** and **identity** endpoints, by fleet port convention
  on the same host;
- a **blanked local discovery endpoint**. This is the subtle and load-bearing
  part: if the hub URL were handed to the container as its discovery endpoint,
  every local vessel would register into the *hub's* registry and the spoke
  would stop being a peer. Blanking it means local vessels register with the
  spoke's own registry, and the federation transport is what mirrors that
  capability upward.

A UI-only spoke narrows this further with an explicit vessel allow-list, which
takes precedence over the role selection. The spoke role group still carries the
whole compute fleet; a UI box must not run it.

The key must be **hub-issued**. A spoke mints its own bootstrap key against its
own identity vessel; the hub validates keys against its own secret and rejects
one claiming a foreign issuer, so a locally minted key 401s on every hub-facing
call and the spoke's capability never reaches the hub namespace. A spoke has no
local identity vessel at all, which makes this unambiguous rather than merely
advisable.

## When federation auto-enables, and when the explicit step is needed

**Auto at boot.** When the container comes up with a hub discovery URL set, the
entrypoint installs the federation transport from the vessel manifest and links
it into the boot target before handing off to init. The transport then derives
its own relay anchor from the hub's public bootstrap endpoint and its own peer
identity from the substrate id assigned at env-generation time. So the ordinary
path is: boot pointed at a hub, and federation is already on. No relay address is
hand-copied, and no second command is required.

This is spoke-only. A substrate with no hub pointer never starts the transport,
so a standalone deployment cannot crash-loop on it, and a transport that fails to
come up never blocks the rest of the boot.

**The explicit step** — `scripts/substrate/spoke-federate.sh` — is an *override*,
not a required stage. Reach for it when:

- the spoke must run under a **pinned** federation substrate id rather than the
  auto-assigned one (a stable id keeps the libp2p peer identity constant across
  container recreates);
- you want the **hub-side collision check** run before the transport comes up
  under that id (see below);
- the relay anchor must be pinned explicitly because the hub's bootstrap
  advertisement is unavailable or wrong.

It upserts the federation identity into the container's env, installs the
transport from the manifest, and waits for the transport's health surface,
failing loudly if it never answers.

## The substrate-id collision check

The federation substrate id must be unique within the hub's namespace. It is not
cosmetic: the libp2p keypair is derived deterministically from the transport's
vessel id, which embeds the substrate id. Two substrates sharing an id derive the
**same peer id**. Circuit dials through the relay become ambiguous between them,
and the self-dial filter then discards every peer substrate's rows as if they
were its own — the symptom is "no local or remote producer" at the hub with
hub, spoke, and vault all simultaneously dark, which reads like a relay outage
rather than an identity clash.

The explicit federation step guards against this before enabling the transport:
it resolves the hub's vessel registry and refuses if any registered vessel id
already ends in the requested substrate id. Because a UI-only spoke's whole
purpose is to be one of many surfaces on one hub, run this check whenever you
pin an id by hand.

## How the spoke resolves shapes it does not serve

Three mechanisms, in the order a request meets them.

**1. Discovery fan-out.** The spoke's own registry is the routing fixed point for
local shapes. When no local vessel owns the requested shape, discovery forwards
the lookup to its peer endpoints, which on a spoke default to the hub discovery
URL. The forward carries a depth header so a lookup can never loop back through
the substrate that started it. This is what makes trace, activity, identity, and
LLM shapes reachable from a box that serves none of them.

**2. The federation transport as ingress.** In the other direction, a remote peer
that found this spoke through the hub namespace resolves any locally-owned shape
over the relay circuit. The transport answers probe shapes inline and proxies
everything else to the owning vessel on this substrate, found through the *local*
discovery with the depth pinned high so an ingress lookup can never fan back out
and loop.

**3. Dispatch-scoped shapes are pinned, never shortcut.** `goal_execution`,
`goalWalkState`, and the live dispatch feed are **per-goal-host in-memory
state**, not fleet-wide facts. Routing them by "first dialable owner" answers
from whichever substrate wins the dial race, so a degraded local circuit
silently swaps a human's panel onto a foreign goal host whose store holds none of
this surface's dispatches — the observed symptom being a stale board rendered as
if it were the whole fleet.

The conduit therefore treats these shapes specially. They never take the hub
ingress shortcut; they go through the discovery path, where aggregate list
shapes **merge** every owner's answer (deduplicated, each row tagged with who
resolved it, any successful subset beating an empty answer) and per-dispatch
shapes **pin** to the owner that answered for that dispatch id before, falling
back to the normal failover order only when the pinned owner stops answering.

A UI surface inherits this behaviour by routing through the conduit rather than
calling vessels directly. A surface that hardcodes a hub endpoint for walk state
reintroduces exactly the defect above.

## Verifying that federation actually works

"The transport unit is active" is not evidence. Four checks, each with the
healthy and unhealthy shape of the answer. Run them from the spoke host.

### 1. The transport is up and holding a reservation

```
docker exec <spoke-container> curl -s http://127.0.0.1:8401/health
```

*Healthy* — JSON reporting a peer id, at least one **circuit multiaddr**
containing `/p2p-circuit`, and a live relay connection.
*Unhealthy* — no answer at all (the unit never started: read its journal), or
JSON with an empty multiaddr list / no relay connection. An empty circuit list
with a running process means the relay dial failed; the transport logs and
continues rather than exiting, so the unit stays green while federation is dead.
**This is the check that distinguishes those two states.**

### 2. The spoke appears in the hub's registry under its own id

```
curl -s -X POST <hub-discovery>/resolve \
  -H 'Content-Type: application/json' \
  -H 'Authorization: ApiKey <hub-issued-key>' \
  -d '{"pointer":{"type":"vesselRegistry"}}' \
  | jq -r '.content.vessels[].vesselId' | grep '@<fed-substrate-id>'
```

*Healthy* — one or more ids ending in `@<fed-substrate-id>`, including the human
surface. That is the capability mirror having reached the hub.
*Unhealthy* — no matches. Either the mirror never ran, or the key is not
hub-issued and every register 401'd. Distinguish by re-running without the auth
header: a 401 confirms the key path.
*Also unhealthy* — matches you did not expect, i.e. another substrate already
holds this id. That is the collision case; pick a unique id.

### 3. The relay ingress is advertised and derivable

```
curl -s -X POST <hub-discovery>/resolve \
  -H 'Content-Type: application/json' \
  -H 'Authorization: ApiKey <hub-issued-key>' \
  -d '{"pointer":{"type":"vesselCapability","shape":"federation_probe"}}' \
  | jq -r '.content.vessels[].libp2p_multiaddr[]?'
```

*Healthy* — at least one multiaddr whose prefix before `/p2p-circuit` is the
relay anchor. This is the same value the explicit federation step auto-derives.
*Unhealthy* — an empty result means the hub has no federation ingress row, so
nothing can dial in; the relay is not running or never registered. Every spoke
will silently fall back to plain HTTP, which works only where the hub's ports
are directly reachable.

### 4. A shape the spoke does NOT serve resolves anyway

The only end-to-end check. Ask the spoke's **own** discovery for a shape that
lives on the hub — a trace-store or identity shape — and confirm it answers.

```
docker exec <spoke-container> curl -s -X POST http://127.0.0.1:8100/resolve \
  -H 'Content-Type: application/json' \
  -H 'Authorization: ApiKey <hub-issued-key>' \
  -d '{"pointer":{"type":"<a-shape-the-hub-owns>"}}'
```

*Healthy* — real content, resolved by a vessel on the hub. The fan-out worked.
*Unhealthy* — "no producer" for a shape the hub demonstrably serves means the
spoke's peer endpoints are not set to the hub; confirm the container received a
hub discovery URL and that its local discovery endpoint was blanked rather than
pointed at the hub.
*Not a federation result* — a **401** here is an auth answer, not a routing
answer. The spoke validates credentials against the hub's identity vessel, so an
unauthenticated or locally minted key fails this check while federation may be
perfectly healthy. Attach the hub-issued key, and read a 401 as "wrong key",
never as "fan-out broken".

A useful negative control: confirm the spoke's registry does **not** list a local
owner for that shape. If it does, the resolve proved nothing — it was answered
locally and never crossed the federation boundary.

### What a green unit alone proves

Nothing. The transport survives peer faults by design: unhandled stream and
socket errors from the libp2p layer are logged and swallowed so a single
unreachable peer cannot take the vessel down. That resilience means unit state is
uninformative about federation health, which is why checks 1 and 4 exist.

## Rolling back cleanly

Registry rot is the failure to avoid: a removed spoke whose rows linger in the
hub's registry, so hub-side lookups keep selecting a vessel that is gone and
every resolve through it fails until the row's time-to-live expires.

Deregistration is built into the mechanism — the rendered unit for every dynamic
vessel deregisters from discovery on any clean stop, so a graceful stop leaves
the registry immediately instead of rotting. The rollback is therefore ordered
around **stopping cleanly first**:

1. **Uninstall the human surface** through the vessel control path, in the
   container. This stops the unit, which triggers the deregister hook, and
   removes the unit file. Do not `docker rm -f` before this step — a killed
   container never runs the hook.
2. **Uninstall the federation transport** the same way. Its capability mirror on
   the hub stops being refreshed at this point.
3. **Confirm the hub is clean.** Re-run verification check 2. Expect **no**
   matches for the substrate id. If rows remain, they will age out on their own,
   but a lingering row means a hard kill happened somewhere — worth knowing.
4. **Only then** remove the container. Its named volumes hold this spoke's local
   state; delete them only if you intend to discard it, and remember that the
   fleet definition the container boots from lives in the volume, not the image.
5. **Do not** reuse the retired substrate id for a different spoke until check 2
   is clean, or the new spoke inherits the old one's peer identity ambiguity.

## Operating notes that bite

- **The fleet definition in the volume is authoritative.** The entrypoint seeds
  the fleet inventory and manifest from the image **only on first boot** — the
  copy is guarded on the file not already existing. For an already-running
  container, editing the repository's JSON changes nothing; the volume copy
  governs. Update the volume copy, or recreate the container against fresh
  volumes, and never assume a repo edit has taken effect.
- **A new vessel's port is container-internal.** Publishing it means either
  adding a port mapping and recreating the container — which destroys nothing
  persistent but does interrupt everything in flight — or attaching a socat
  sidecar on the docker bridge that publishes the host port without touching the
  substrate container at all. Prefer the sidecar on a substrate you must not
  disturb.
- **A unit missing from the fleet inventory runs unconditionally in every
  role.** Ship a unit, list it. Give a paired timer and service the *same* role:
  a timer listed alone once left its service ungoverned, so it ran where its
  dispatch conduit was correctly absent, and every failed connection was written
  into the shared learning store as arm quality.
- **Manifest-marked entries are never masked** by role selection, which is
  correct for a runtime-installed vessel — and means such a vessel must be
  installed explicitly after readiness rather than expected to appear from the
  role choice.
- **A green surface can still serve nothing.** The human surface serves its UI
  from a build directory that is deliberately not committed. The vessel-install
  path runs a dependency install in the vessel's working directory but never a
  build, so the build is a post-install hook — and the install path swallows that
  hook's output *and* its exit status. The install therefore reports success
  whether the UI built or not. **Assert the build output exists; never accept the
  install's own verdict.** The hook writes its own log with a terminal
  success/failure sentinel precisely because nothing else records it. The same
  hook pins the package manager's home and cache outside the repository: a home
  redirected into the tree once leaked a multi-hundred-megabyte cache into it.
- **Host-local endpoints do not federate.** A vessel that registers a loopback or
  container-host alias as its endpoint is reachable only from the machine that
  registered it. Such a row must never shadow a live circuit multiaddr, or a
  remote resolve dies in the ingress proxy instead of hopping over the relay.
