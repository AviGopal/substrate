# Running a human surface

The human surface is the page a person talks to the substrate through: they type
what they want done, and the answer comes back drawn — a table as a table, a
command's output as terminal text — rather than as JSON on a screen.

This document is how to put one in front of a person. Five steps.

A surface does not need a substrate of its own. It runs as a **UI-only
federated spoke**: a container holding just a discovery registry and the surface
itself, pointed at a hub that already has the compute, the trace store, and the
identity plane. Everything the surface needs but does not serve —
`goal_execution`, `goalWalkState`, the activity and trace shapes, identity, LLM
resolution — is resolved on the hub through discovery fan-out over the
federation transport.

---

## Before you start

These are prerequisites, not steps — a machine that has them once never needs
them again.

- **Docker**, privileged-capable.
- **A checkout of the super-repo** (`git submodule update --init --recursive`).
  The launcher lives in it, and the surface's own workdir is a clone of it.
- **`jq`** — the launcher reads your config with it.
- **A credential for the image**: `docker login ghcr.io` with a token carrying
  `read:packages`. The image bakes vessel source, so it is private.
- **A credential for the repo**: `gh auth login`, or a PAT with read access to
  the super-repo. The surface serves its UI from `ui/dist`, which is gitignored
  and therefore built at install time from a clone — with no credential that
  clone 401s and the install has nothing to build.

## The five steps

### 1. Point your config at the hub

`~/.metabob/config.json` — the same file the rest of the tooling reads. Two
values matter:

```json
{
  "metabob": {
    "endpoint": "http://<hub-host>:18100",
    "apiKey": "<hub-issued key>"
  }
}
```

`endpoint` is the **hub's discovery endpoint**, and `apiKey` must be **issued by
that hub**. A key minted locally is not valid there and every hub-facing call
answers 401 — which surfaces later as a page that loads and then cannot dispatch
anything.

If you keep a separate hub for federation, set `metabob.hubDiscovery` and it
wins over `endpoint`. To pin a git credential here instead of using
`gh auth token`, add `metabob.gitPat`.

### 2. Get the image

```bash
docker pull ghcr.io/avigopal/substrate:dev
```

Skippable if the image is already local. The launcher builds from source when
the image is missing, which works but is much slower and needs every submodule
initialised.

### 3. Launch the surface

```bash
scripts/substrate/ui-only-up.sh
```

No flags. Hub, key and git credential come from step 1 and from `gh auth token`;
the script prints which values it filled and from where. Flags override config
when you need a second surface against a different hub:

```bash
scripts/substrate/ui-only-up.sh --hub http://<other-host>:18100 \
    --name substrate-ui-b --port-offset 1000
```

`DRY_RUN=1` prints the full plan and the exact container command — secrets
redacted — and touches nothing.

The script refuses rather than damages: it will not reuse an existing container
name, will not take an occupied host port, and will not stop or reconfigure a
substrate that is already running. Both `--name` and `--port-offset` are needed
to put a second surface on a host that already has one.

It ends in a verdict block. It asserts the container is up, that `ui/dist` was
actually built, that the surface answers `/health` **from the host**, and that
its shapes reached the hub's registry as `<vessel>@<substrate-id>` — the last is
the only real proof federation worked, so read it rather than the exit code.

### 4. Open it

```
http://127.0.0.1:18310
```

Plus your `--port-offset` if you passed one; the launcher prints the exact URL.

### 5. Ask for something

Type it in the box in plain language — "list the running units", "how many
TypeScript files are under repos/identity-vessel/src". The system owns the
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

**A local port may legitimately answer nothing.** The container publishes the
usual `18xxx` range, but the units behind most of those ports are not running
here. Route by shape through discovery; reach for a host port only when you mean
to talk to one machine's copy.

## The image carries the roster

Which units a container runs is decided at boot from the vessel inventory
**baked into the image**, not from your checkout. A container started from a
published image runs that image's roster, however recent your working tree is.

So a surface deployed today can still be running units its roster does not name
— LLM resolvers, a metric collector — simply because the image predates the
inventory that would have masked them. They are harmless but they are not
nothing: they consume the box, and they make `docker ps` a poor guide to what
this deployment is supposed to be.

Two consequences worth holding:

- Changing the inventory does not change any running deployment. It takes an
  image rebuild, then a fresh container.
- Tooling run from a checkout reads the checkout's inventory while inspecting a
  container built from the image's. When the two disagree, expect a readiness
  report that names units the container has never heard of.

## Updating a running surface

New source does **not** reach a running surface on its own. `ui/dist` is
gitignored, and the build hook runs at install time only — so a pull delivers
source that nothing rebuilds, and the surface keeps serving the bundle it was
installed with. Until that is fixed, an update is: pull inside the container,
rebuild `ui/dist`, restart the unit.

The reliable check is not the commit — it is the bundle. Compare the
`assets/index-*.js` the page references against the one on disk, and confirm the
bundle is newer than the source it claims to carry.

## When it does not work

**The page loads, goals never complete.** The hub link. Confirm the key was
issued by the hub in your config, and that the hub's discovery endpoint answers.

**The launcher refuses immediately.** By design — an existing container name, an
occupied port, or an image whose baked manifest has no surface entry. The
message names which.

**The install reports success and the page is blank.** `ui/dist` was not built.
The build hook's output is swallowed by the installer, so its own exit status
proves nothing; the launcher asserts the directory separately for this reason.
The build log inside the container is the evidence.

**A shape resolves to a vessel that does not answer.** Registry records outlive
the process that wrote them. A record's presence is not proof of capability —
call the shape rather than trusting the listing.

## Related

- [`SUBSTRATE.md`](SUBSTRATE.md) — the image, topology selection, and the full
  launch paths for a hub or a complete local substrate.
- [`FEDERATION.md`](FEDERATION.md) — how a spoke reaches shapes it does not
  serve.
