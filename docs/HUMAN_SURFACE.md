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
- **No credential for the image.** `ghcr.io/avigopal/substrate` is a **public**
  package and pulls anonymously — no `docker login`, no `read:packages` PAT.
- **A credential for the repo**, *while the super-repo is private*:
  `gh auth login`, or a PAT with read access. The surface's workdir is a clone
  of the super-repo — it runs its server straight out of it — so with no
  credential the clone 401s and there is nothing to run. This is the one
  prerequisite that disappears entirely if the repo is made public.

  It is **no longer needed in order to build**. `ui/dist` is committed, so a
  clone already carries a working bundle and the install skips the build.

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

## The roster: where it comes from, and when it changes

Which units a container runs is decided **before systemd starts**, from a fleet
inventory kept in the container's volume. The image seeds that file on first
boot; from then on the volume copy is authoritative, deliberately — a substrate
is allowed to alter its own membership.

A repo-side inventory change now reaches a running container on its own.
`substrate-pull-sync` converges both the inventory and the selector that reads
it, so you do not need an image rebuild to change a roster. Two things to hold
about the timing:

- **It lands one restart late.** Selection runs pre-systemd, so a converged
  inventory changes nothing until the container next starts. The file is
  current; the running units are not.
- **It will not overwrite a customised inventory.** A sidecar records what the
  updater last wrote. Match it, and git wins. Differ from it, and the file is
  left alone and the sync log says so — because silently reverting a fleet's
  self-chosen membership is worse than being out of date, and an unexplained
  revert is exactly what nobody traces back. Delete the sidecar to accept git.

Two things it still does not govern, so expect them in `docker ps` on a surface
that should not have them:

- **Manifest vessels**, which the selector skips entirely by design.
- **LLM arm units rendered at boot** (`llm-opus`, `llm-haiku`, `llm-google`),
  which never exist as files for an inventory to name.

They are harmless but not nothing: they consume the box, and they make
`docker ps` a poor guide to what a deployment is *supposed* to be.

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
