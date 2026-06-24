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

## The local substrate

Local development runs on a **single container** (`substrate-live`) that runs the vessel fleet as systemd units — no Kubernetes, no Helm, no Istio. Each vessel is reached on a host-mapped port (`18xxx → 8xxx`); a few vessels are internal-only.

**Bootstrap:**

```bash
make -C scripts/substrate run-live ANTHROPIC_API_KEY=...
make -C scripts/substrate seed-live
scripts/substrate/configure-local.sh
```

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

Canary / production are **downstream** Kubernetes substrates (`activity.metabob.com`); CI/CD deploys to canary on push to `dev`. Full guide: [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md).

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
