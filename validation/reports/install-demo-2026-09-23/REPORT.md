# Install demonstration — new launches, any inventory, peered with syzygy.host and substrate-live

**Question.** Can a brand-new fleet, launched only through the install page's path (the
manifest the image prints, a `.env`, `docker compose up`), reach goals with any vessel
inventory when peered with the production hub `syzygy.host` and with the local
`substrate-live`?

**Answer.** Yes for the verdict's known-answer goal on every case: 9 of 9 new launches
reached `usable` (a real LLM completion through the hub's arms plus a goal that returned
`reached:true`) on the published image, in 49–113 s after `compose up`. A second,
data-local goal ("count the lines of a file that exists only on this node") reached with the
correct answer on 6 of the 8 applicable launches across the two runs; its failures are one
open data-locality defect (below), reported honestly by the walk as `reached:false`.

Engine: rootless Podman 6.1 + podman-compose 1.6 on the operator host. Docker is covered
separately by the CI acceptance run (below), not by this host.

## Method

`run-case.sh <case> <prefix> <env-fragment> usable` per case:

1. `docker run --rm --entrypoint substrate-manifest <image> > docker-compose.yml`
2. `.env` = `SUBSTRATE_IMAGE`, `SUBSTRATE_NAME=demo-<case>`, `SUBSTRATE_PORT_PREFIX=<p>`, plus
   the case's inputs (anchor + key, inventory, one provider key). Keys live only outside
   the repo; `env.redacted` per case shows the rest.
3. `docker compose up -d`, then `substrate-status --wait usable --json` (the verdict).
4. Data-local goal on the node's own goal-host: a 53-line file of `x` written to the node,
   `"Count the lines in the file /workspace/demo/known.txt on this machine and report the
   number."` Pass = `reached:true` **and** the record contains 53 (the file contains no
   digits, so the answer cannot be read off it).
5. `docker compose down -v` (container, volumes, logs saved first).

Anchors: `DISCOVERY_ENDPOINT=http://syzygy.host:18100` with a syzygy-issued key, or
`http://host.containers.internal:18100` with `substrate-live`'s key. Inventories: default
`spoke`, `PROFILE=compute`, `PROFILE=surface`, and a custom `ENABLED_VESSELS` minimum
(surrealdb, valkey, discovery, goal-host, local-tools, llm-resolver, federation-transport,
substrate-ready, journald forwarder); plus a full `standalone` peered with both
(`PEER_DISCOVERY_ENDPOINTS`).

## Results (published images)

`results-ci/` — image `421653ab`; `results-ci-2/` — image `c6e9ab83` (adds the verdict fix
below; re-ran the cases that did not fully pass).

| Case | Verdict | t | Data-local (53) |
|---|---|---|---|
| substrate-live → spoke | usable ✓ | 69 s / 72 s | ✗ / ✓ |
| substrate-live → compute | usable ✓ | 70 s / 78 s | timeout / ✓ |
| substrate-live → surface | usable ✓ | 49 s | n/a (goals go to the hub) |
| substrate-live → custom minimal | usable ✓ | 67 s | ✓ |
| peered standalone (both) | usable ✓ | 90 s | ✓ |
| syzygy → spoke | seeded unknown ⟶ usable ✓ | – / 113 s | ✗ / ✗ |
| syzygy → compute | seeded unknown ⟶ usable ✓ | – / 112 s | ✓ / ✗ |
| syzygy → surface | seeded unknown ⟶ usable ✓ | – / 52 s | n/a |
| syzygy → custom minimal | seeded unknown ⟶ usable ✓ | – / 110 s | ✓ / ✓ |

`connected` is `unknown` in every row by design: it is proven only by a real client
request from outside the container, which this driver does not make.

## Defects this demonstration found (and fixed, in the shipped image)

1. **The published image could not run on Docker.** 139 layers (126 by mid-September)
   against Docker's ~125 limit: `failed to register layer: max depth exceeded`. Every audit
   ran on Podman, which tolerates it. The published stage is now a single flattened layer,
   and CI moves `:dev` only after the pushed digest has been pulled and run. (`227ac65e`)
2. **No routed `llm_completion` ever worked.** The model resolver read `prompt` from the top
   of the body; discovery delivers `{pointer}`. Every node without a local arm — every
   spoke — was blind to its hub's models. (`llm-resolver-vessel db8af1d`)
3. **pull-sync never restarted the rendered LLM arms**, which share the resolver's source:
   the production hub's `llm-google/haiku/opus` were serving code from 2026-09-07. Fixed
   going forward; the three were restarted once by hand with the operator's key.
   (`421653ab`)
4. **`served` failed on self-maintenance units** (a fresh fleet's first pull-sync fails on
   one package build; a seeder rests failed), so no fresh fleet could reach `usable`.
   Those roles are now reported, not counted. (`2e34e161`)
5. **The verdict read its endpoints and key once.** Started with `compose up`, it kept the
   loopback defaults for the whole wait. Now re-read every pass. (`c6e9ab83`)
6. **Same-host anchors.** A rootless Podman container cannot reach the host's own LAN
   address; the page now names `host.containers.internal` / `host.docker.internal`.
   (`0a406621`)

## Still open (to be filed)

- **Data locality of "this machine" goals.** The walk infers `shellResult` and the command
  can run on a node without the file; the walk then refuses the empty result honestly. A
  goal about the local node must prefer the local producer.
- **Resolver robustness.** A provider reply without `choices` throws
  (`undefined is not an object (evaluating 'response.choices[0]')`) instead of failing over.
- **`cpg-inference-ts` head does not build in-container**, so every fresh fleet's first
  pull-sync exits non-zero (reported by the verdict as self-maintenance).
- **Compose noise.** The manifest's per-port publish-IP expansions make compose warn that
  `SUBSTRATE_PUBLISH_IP` is unset on every command.
- **Unfunded arms on the hub** (operator note: only OpenRouter is funded) remain advertised;
  routed completions succeeded through OpenRouter-served models, but the unfunded arms
  should de-advertise on billing failure rather than rely on selection.

## Off-host evidence (CI acceptance)

The first install acceptance run (image `45fb9698`, run 35958556101) executed README's
standalone fences verbatim on cold GitHub runners: on **Docker**, a fresh standalone booted
to `live` and `seeded` (a freshly minted key); `served` failed only on the self-maintenance
units fixed in item 4. It ran report-only (no provider key secret), so `usable` was not
evaluated there.

The acceptance run on image `c6e9ab83` (run 35966314973), same cold runners, verbatim:
**Podman** passed every level it judges in report-only mode — `live`, `seeded`, `served`
(63 units up, all nine ports published and bound non-loopback). **Docker** passed `live` and
`seeded` and failed `served` on one unit, `concept-db-seeder.service` (store role), which
succeeded on every Podman launch here. Its cause is not in that run's artifacts; the
acceptance diagnostics now keep each failed unit's journal (`405d99c2`), so the next run
states it. Open: **concept-db-seeder fails on a fresh Docker standalone.**

## Re-running

```bash
export IMAGE=ghcr.io/avigopal/substrate:<sha> OUT_DIR=$PWD/results-rerun
./run-case.sh live-spoke 25 /path/to/live-spoke.env usable
```
An env fragment is the case's `.env` lines: the anchor pair (or `PEER_DISCOVERY_ENDPOINTS`),
the inventory input, and one provider key.
