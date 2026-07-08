# metabob-devbob — a self-improving development substrate

**An autonomous AI development system built on the impulse–activity foundation, with Thompson Sampling for continuous learning. The system develops itself: goals are dispatched into a running substrate, every execution is traced, and successful patterns become reusable templates.**

> **Start here:** [`CLAUDE.md`](CLAUDE.md) is the authoritative, continuously-maintained description of how to work in this repo. This README is a high-level orientation; when the two disagree, CLAUDE.md wins.

## Overview

The substrate demonstrates:

- **Impulse–Activity architecture** — universal data (*impulses*) processed through constrained state transitions (*activities*).
- **Learning loop** — Thompson Sampling for activity selection, Bayesian relevance scoring for impulses, ribosome extraction of templates from successful traces.
- **Vessel pattern** — capabilities are provided by *vessels* (bundles of activities + resolvers + lifecycle hooks) that live where their data lives.
- **Self-governance / autonomy** — the substrate detects its own operational gaps, proposes and verifies changes, and lands them through a self-alteration cutover loop, moving along the S1 → S2 → S3 autonomy trajectory (operator-authored → substrate-authored → distributed-stable).

## Architecture foundation

> **Canonical reference:** [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)

### Core concepts

**Impulses** — data in any form (text, structured data, signals, commands) with metadata for reasoning. Lazy-loaded pointers; reasoners see the shape/summary, resolvers load content:

```typescript
{
  id: "error-log",
  pointer: { type: "file", path: "error.log" },
  shape: "error_log",
  budget: 2000
}
```

**Activities** — constrained state transitions linking input impulses to output impulses. Tasks dispatch to *resolvers* (the LLM is one resolver among many), and execution is measured (success rate, cost, duration):

```typescript
{
  id: "fix-bug",
  output_shapes: ["patch"],
  tasks: [
    { id: "analyze", resolver: "llm",  /* … */ },
    { id: "fix",     resolver: "bash", /* … */ }
  ]
}
```

**Vessels** — capability providers that register with the discovery-vessel and resolve the shapes they own. The backend (`activity-api`) is a trace store + pattern learner, **not** a universal resolver.

## How development works: dispatch through the substrate

The default development loop is **not** "hand-edit a file and run tests." It is to **dispatch the change as a goal** so it runs as a traced activity and feeds the learning loop. The agent-facing dispatch surface is the **metabob-mcp** tool `mcp__metabob__run_goal` (which reaches `goal-host-vessel`). The older `minibob` CLI is **deprecated** and being retired.

```
mcp__metabob__run_goal  goal="fix the failing tests in activity-api"
mcp__metabob__run_goal  goal="add input validation to the impulse endpoint"
```

Conscious one-off direct edits to vessel source are gated by a PreToolUse hook and require `SUBSTRATE_ALLOW_DIRECT_EDIT=1`; docs/scripts/tests/config are never gated. See CLAUDE.md → *Development Philosophy: Substrate First*.

## Installation

The whole system runs as **one container** (`substrate-live`) hosting the vessel fleet as systemd units — no Kubernetes, no orchestration on the host. The host contract is a single `docker run`: one privileged container, one LLM-provider env var, two named volumes (workspace + datastore). Everything load-bearing — seeding, readiness, diagnosis — happens inside the container at boot; the Makefile is a convenience wrapper over exactly that contract.

**Prerequisites:** Docker, GNU make, git. (For the Obsidian interface installer: `curl` + `jq`, and `bun` for its libp2p sidecar.)

**1. Clone** — submodules are mandatory; the image build copies each vessel's source from `repos/<vessel>`:

```bash
git clone --recurse-submodules https://github.com/AviGopal/substrate
cd substrate
```

**2. Start** — one command:

```bash
make -C scripts/substrate up ANTHROPIC_API_KEY=sk-ant-...
```

`up` builds the image if needed, starts the container, seeds identity + templates in-container, waits for fleet readiness, points `~/.metabob/config.json` at the substrate, and runs a doctor check. `OPENAI_API_KEY` (with optional `OPENAI_BASE_URL` for Ollama/local models and `LLM_DEFAULT_MODEL`) works in place of Anthropic; at least one LLM provider key is required. All other secrets (JWT signing, datastore password, the bootstrap API key) are generated on first boot and persisted to the workspace volume.

**3. Verify:**

```bash
make -C scripts/substrate ready            # fleet readiness matrix
make -C scripts/substrate doctor SMOKE=1   # deep diagnosis + end-to-end goal dispatch
```

**4. Get your credentials.** identity-vessel is internal-only, so a human obtains or mints keys through the Makefile — no raw API calls:

```bash
make -C scripts/substrate show-key                 # the operator API key
make -C scripts/substrate issue-key NAME=my-peer   # mint a key (spoke / external peer / new vessel)
make -C scripts/substrate list-keys                # list issued keys
make -C scripts/substrate revoke-key KEY_ID=key_x  # revoke one
```

The full key is printed once and never stored. See [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md) § *Keys and tokens*.

**5. Install the human interface (Obsidian plugin)** — one command, into an existing or new vault:

```bash
bash repos/obsidian-vessel/install.sh --local            # same-machine substrate
bash repos/obsidian-vessel/install.sh                    # interactive: vault → host → key
```

The installer selects or creates the vault, installs the plugin, and prefers the **libp2p** transport: it derives the relay multiaddr from your discovery host and enables the federation sidecar automatically, writing direct HTTP endpoints only as same-host fallback. See [`repos/obsidian-vessel/README.md`](repos/obsidian-vessel/README.md).

### Joining an existing federation

A **hub** on a public IP shares a namespace with **spokes**. Ask the hub operator for a key (`make issue-key NAME=…` on the hub), then start your container pointed at the hub:

```bash
make -C scripts/substrate run-live ANTHROPIC_API_KEY=... ENABLED_ROLES=spoke \
  DISCOVERY_ENDPOINT=http://<hub>:18100 ACTIVITY_API_ENDPOINT=http://<hub>:18080 \
  IDENTITY_VESSEL_URL=http://<hub>:18101 METABOB_API_KEY=<hub-issued-key>
```

One image serves every role: a full local substrate, a minimal hub (control plane + store + relay), or a compute-only spoke — selection is declarative via `ENABLED_ROLES` / `ENABLED_VESSELS` (`scripts/substrate/vessels.inventory.json`, applied at boot). Vessels behind NAT join over the libp2p relay via a sidecar. To stand up your own remote substrate or hub on a VM: `scripts/substrate/deploy-remote.sh` (ships the local image over SSH, no registry) or `scripts/substrate/deploy-hub.sh` (the VM pulls the repo, builds there, and runs the relay). Point vessel clones at your own fork with `SUBSTRATE_REPO_OWNER=<your-org>`. Full guide: [`docs/FEDERATION.md`](docs/FEDERATION.md).

## Working with the substrate

Each vessel is reached on a host-mapped port (`18xxx → 8xxx`); a few vessels are internal-only and reached via discovery.

**Iterate:**

```bash
# edit vessel source in repos/<vessel>/, then hot-reload it in the container:
make -C scripts/substrate restart-<vessel>

# validate against the local substrate (localhost:18080):
bun run validation/scripts/failure-mode-harness.ts
mcp__metabob__run_goal  goal="verify the change works"
```

**Key endpoints** (host-mapped; see CLAUDE.md → *Substrate endpoints* for the full table):

| Host port | Vessel | Role |
|---|---|---|
| `localhost:18080` | activity-api | trace store + Thompson learner + activity-shape resolver |
| `localhost:18090` | development-vessel | `memoryNote` resolver + dev meta-activities |
| `localhost:18100` | discovery-vessel | vessel registry / routing fixed-point |
| `localhost:18210` | goal-host-vessel | `POST /run-goal` (goal dispatch), `POST /resolve` |
| `localhost:18250` | analysis-vessel | code-analysis resolver (source_code, problem_detection, …) |
| `localhost:18260` | concept-db | concept-graph shapes + dense (MiniLM) search |
| `localhost:18270` | stateful-ui-vessel | substrate UI panels |

Optional environment for the substrate's self-development loop: a GitHub credential (`SUBSTRATE_GIT_PAT`, or the host's SSH key via the host-sync timers) lets the substrate land its own commits — without one it runs and learns but cannot push. Full guide: [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md).

## Keeping submodule pointers current

This repo pins each vessel via a submodule gitlink (`repos/<vessel>` → a commit in that vessel's own repo, tracking its `dev` branch per `.gitmodules`). Vessels are developed and pushed independently (by the substrate's own cutover loop or by an operator working directly in a vessel checkout), so the pointer recorded here always lags the vessel's true `dev` HEAD by some amount. `.github/workflows/bump-submodules.yml` bounds that lag: on a schedule (and on manual dispatch) it resolves each submodule's latest `dev` commit with `git ls-remote` (no clone, no checkout — just a ref lookup), fast-forwards any gitlink that moved via `git update-index --cacheinfo`, and commits + pushes the result directly to `dev`. It runs as a GitHub Actions job, not a host cron or Makefile target, so currentness does not depend on any particular machine being on — the constraint recorded in this project's operating notes is that the substrate (and its supporting automation) must not rely on the host. A submodule the workflow's token cannot read (a private repo in a different GitHub org) is skipped with a warning rather than failing the run; the pointer for that submodule stays whatever the last successful bump (or manual `git submodule update --remote`) left it.

## Core components

- **activity-api** (`repos/activity-api`) — TypeScript/Bun/Hono backend. Execution-trace store, Thompson-Sampling learner, and resolver for the shapes it owns (traces, templates, metrics, goal paths, composition stats). Not a universal resolver.
- **discovery-vessel** (`repos/discovery-vessel`) — vessel capability registry with resolver contracts and per-mutation auth; the routing fixed-point.
- **goal-host-vessel** (`repos/goal-host-vessel`) — wraps `GoalHost` from `ias-executor-ts`; primary dispatch target for all goal execution, with in-flight goal-seeking + a goal-reaching gate.
- **llm-resolver-vessel** / **local-tools-vessel** / **ribosome-vessel** / **boredom-vessel** — LLM completion, filesystem/process tools, template extraction from successful traces, and the autonomous idle/topology loop, respectively.
- **concept-db** (`repos/concept-db`) — concept-graph shapes + dense semantic search.
- **development-vessel** (`repos/development-vessel`) — meta-vessel for substrate self-development; owns the authoritative `memoryNote` store.
- **identity-vessel** (`repos/identity-vessel`) — single source of truth for authentication (HMAC API keys + JWT issuance).
- **analysis-vessel** (`repos/analysis-vessel`) — code-analysis resolver (supersedes the standalone analysis-api as the discovery-registered surface).
- **activity-dashboard** / **workbench** — read-only observability and human-in-the-loop authoring surfaces over `activity-api`.

## Learning loop

1. **Recommend** — Thompson Sampling selects an activity variant.
2. **Execute** — the activity runs, producing an execution trace.
3. **Record** — the trace is stored with success/failure, cost, and duration.
4. **Learn** — α/β posteriors update for future selection; impulse-relevance and resolver metrics feed back.
5. **Extract** — successful executions become reusable templates (ribosome).

**Reuse before minting:** before minting a new activity/resolver, prefer an existing producer of the needed output shape. Reuse sharpens posteriors and raises the credit-mixing rate (λ₁); minting is the justified exception, not the default. See CLAUDE.md → *Key Design Principles*.

## Key design principles

1. **Impulses are universal data** — everything is an impulse with metadata; resolvers access content.
2. **Activities constrain search** — without activities, infinite options; with them, ranked finite options.
3. **Resolvers live where data lives** — don't centralize resolution; the backend only stores traces.
4. **Metadata first, content later** — reasoners see metadata to decide; resolvers load content to execute.
5. **Record everything** — every execution is traced; this is the raw material for learning.
6. **Learn from traces** — Thompson Sampling, relevance scores, ribosome extraction.
7. **Reserve improvisation** — when nothing matches, try something new, but record it.
8. **LLMs are tools, not controllers** — use LLMs for reasoning; deterministic resolvers for everything else.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — authoritative working guide (substrate-first loop, vessel inventory, auth, endpoints).
- [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md) — canonical system definition.
- [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md) — local single-container substrate: quick-start, iteration, backing up learning state.
- [`docs/architecture/`](docs/architecture/) — the `SUBSTRATE_AS_*` lenses (dynamics, MDP, network, representation, DEC, fleet, software) and supporting design docs.
- [`docs/RBAC_GUIDE.md`](docs/RBAC_GUIDE.md), [`docs/AUTH_JWT_CLAIMS.md`](docs/AUTH_JWT_CLAIMS.md) — multi-tenant isolation and auth claims.
- [`openspec/changes/`](openspec/changes/) — future-change proposals, designs, and tasks.
</content>
</invoke>
