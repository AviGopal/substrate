---
name: metabob-substrate
description: Operate the metabob substrate as a citizen, not a tourist. Drive it through the MCP cockpit — dispatch work (run_goal / run_goal_async), understand HOW it reasoned (goal_reasoning), record whether it worked (provide_feedback → oracle corpus), and inspect the running system (registry_query / execution_trace / resolve_impulse) without host access. Read `reached`, not `status`. Plain code-change goals that name a repos/<vessel>/src file route to feature_compose and land traced commits. And read the concept graph before deciding, writing back the load-bearing signal so the substrate accumulates instead of churning.
---

# metabob-substrate

## What this skill is for

The substrate has a concept graph (concept-db, port 18260). It learns by accumulation: every analysis-vessel resolution mints a usage row via concept-bridge-observer; every autonomous draft (boredom-vessel → draft-gap-closing-activity) reads concept-db as priors. Today the graph holds ~4 concepts and a handful of edges — mostly bridge-minted, mostly shape-level. **The substrate's vocabulary is thin not because the wiring is broken but because the work hasn't been intercepted yet.**

This skill makes the agent loop a contributor, not just a consumer. When you read a file, mint a concept. When you discover a constraint, link concepts. When the user corrects you, mint the correction. The substrate becomes the durable memory across sessions.

## When this skill applies

- Reading or editing code, docs, or specs in `repos/`, `docs/`, `openspec/`, `validation/`, `scripts/`
- Receiving user instructions that constrain future work (preferences, conventions, anti-patterns)
- Discovering a non-obvious idiom, an environmental constraint, a deployment direction, a failure mode
- Reviewing memory files in `~/.claude/projects/<project-slug>/memory/` (the project-slug is the project dir path with every `/` replaced by `-`)
- Working with the substrate's autonomous loop (boredom-vessel, draft-gap-closing-activity, ribosome-vessel)
- Any time you'd otherwise file a note that only the current session will see

## The five MCP tools

Always available in vessel mode (substrate-local MCP). Tool descriptions are self-contained; the table below is *when* to reach for each, not *what* it does.

| Tool | Use when |
|---|---|
| `concept_search` | Before deciding what to do next on a topic you've worked on before. Filter by `source_type` (e.g. `vessel_construction_pattern`) or `shape` to scope. |
| `concept_neighbors` | After finding a concept, to walk typed edges (`description_of`, `derived_from`, `contradicts`) and find adjacent context. |
| `concept_usage_stats` | When deciding whether a concept is currently load-bearing vs historical. `total_uses` + `success_rate` + recent trace timeline tells you "is this still active?" |
| `concept_sequence` | When you're at decision T+0 and want to anticipate T+1 — what concept usually follows this one in successful traces. |
| `concept_link` | When you observe a relationship between two existing concepts. Always include a `description` so future readers know your rationale. |
| `concept_create` | When you've surfaced knowledge that isn't yet in the graph. Pick `source_type` from the taxonomy below. |

## Driving the substrate through MCP: dispatch → inspect → verify

Reading/writing the concept graph is half of citizenship; the other half is **doing work *through* the substrate** so it produces a trace and feeds the learning loop, instead of editing files untraced. The MCP surface is a **complete operator cockpit** — you can dispatch work, understand *how* the substrate reasoned, record whether it actually worked, and inspect the running system, all **without host access** (no `docker exec`, no `journalctl`, no raw `curl`). Reach for these before dropping to the shell.

The tools group into **three planes** plus a coverage set:

**ACT — dispatch work.**

| Tool | Use when |
|---|---|
| `run_goal` | Short, one-shot goal you want answered inline. Blocks via goal-host `/resolve` (~290s cap). |
| `run_goal_async` | Long goal (composition walk, code change, drafter fallback, recovery) that would blow the sync cap, or when you want to keep working. Returns a `dispatchId` immediately. **Default for anything non-trivial.** |
| `goal_status` | Track a `dispatchId` → the **honest `reached` verdict** (see below), the executionId/template, and a hydrated trace roll-up (state-space signature, produced shapes, failure mode, Thompson α/β). |

**REASON — understand *how* it reasoned.**

| Tool | Use when |
|---|---|
| `goal_reasoning` | After a dispatch, to read the goal-host **walk decision-log** for that `dispatchId`: goal-target inference → satisfier/bridge/step decisions → reach verdict, plus the per-task walk sequence from the trace. This is *why* it reached (or didn't). Richer than `goal_status`. For satisfier-only reaches (no template ran) it renders the `walkLog` the trace can't. |

**FEEDBACK — record whether it actually worked.**

| Tool | Use when |
|---|---|
| `provide_feedback` | After inspecting a dispatch with `goal_reasoning`, record an operator verdict (`reached` / `not_reached` / `partial` + rationale + confidence). Writes a ground-truth label into the substrate's **oracle corpus** (`goal_verification_labels`) that calibrates the automated reach-gate. Measured feedback, not advice — your judgment becomes training signal. Auto-derives goal/executionId/template from the dispatch record. |

**INSPECT — read the running substrate (no host access).**

| Tool | Use when |
|---|---|
| `registry_query` | "What shapes exist?" (`mode:"shapes"`) or "who serves shape X?" (`mode:"vessels"`, requires `shape`) — reads discovery-vessel directly. Replaces `docker exec … curl discovery`. |
| `execution_trace` | Read a durable trace by `execution_id` — status, template, composition chain, load-bearing tags, per-task sequence + failure_mode. The general reader `goal_reasoning` specialises. Replaces raw `/v2/activities/execution-traces/:id` curls. |
| `resolve_impulse` | **Advanced escape hatch**: resolve/write ANY impulse shape (`memoryNote`, `feature_compose`, `*_write`, …) via MCP instead of raw `curl /v2/impulses/resolve`. Set `activity_api:true` for activity-api-owned shapes, or `vessel_shape` to route to the owning vessel via discovery. Prefer the dedicated tools when they fit. |

### `reached`, not `status` — the honest signal

`status` (`running`/`completed`/`failed`) is only the **template exit status**. The load-bearing signal is **`reached`** (`yes`/`no`), the goal-reach verdict — surfaced as the *primary* line by `goal_status` and `goal_reasoning`. A `status:"completed"` with `reached:false` (or `status:"failed"` with `reached:true`) is common and correct; **trusting `status` will make you wrongly retry a goal that succeeded or accept one that hollow-completed.** Always read `reached`; when the stakes are high, read the actual diff/output (a change can typecheck + pass the reach-gate yet not do what was asked — the one check the substrate can't make for itself).

### Operator identity is auto-stamped

Every dispatch from these tools carries an `operator:<id>` tag (default `claude-code-operator`, override via `MB_OPERATOR_ID`), threaded into the trace tags and folded into `provide_feedback` labels. Your dispatches are a **differentiable, attributable surface** the substrate can model — you don't do anything; it happens automatically.

### Plain-language code changes route to `feature_compose`

You do **not** need the byte-exact BEFORE/AFTER trick to land a code change. A plain goal that **names a real source file** — e.g. `run_goal_async({ goal: "edit repos/development-vessel/src/resolvers/gap-to-feature.ts: <describe the change>" })` — routes through the edit-intent path to `feature_compose`, which drafts + typecheck-verifies + lands a real commit via mitosis cutover, all traced. Requirements: **name the concrete `repos/<vessel>/src/…` file path in the goal text** (that's what triggers routing), and describe the change in prose. `reached:true` + a `feature_compose` `selectedTemplateId` + a landed commit means it worked — then verify the diff.

### The canonical loop

1. `concept_search` the goal's keywords (start-of-task routine below) — warm-start on prior knowledge.
2. `run_goal_async({ goal })` → keep the `dispatchId`. (Name a real file path for code changes.)
3. Poll `goal_status({ dispatch_id })` until `status ≠ running`; **read `reached`**, not `status`.
4. `goal_reasoning({ dispatch_id })` to see the walk decision-log — *why* it reached or fell short (mis-routed? hollow? failed a gate?).
5. `provide_feedback({ dispatch_id, verdict, rationale })` — record the verdict into the oracle corpus. A `not_reached` with a precise rationale is a negative training example, not just a note.
6. A hollow completion / mis-route / failure mode is a real signal worth a `concept_create` (close-task routine).

**Understanding the current state space.** The `state_signature:<hash>` line in a hydrated `goal_status` (or the trace tag via `execution_trace`) is the substrate's state-space signature *at dispatch time* — load, recent-trace aggregate, catalogue counts, computed by development-vessel's `compute_state_signature` resolver. Two dispatches with the same signature ran under the same conditions; a shifting signature means the pool/catalogue moved between runs. Use it to reason about *why* selection differed across otherwise-identical goals.

> **New/changed tools not loading?** The MCP server runs the **compiled `dist/cli.js`**, not `src/`. After editing metabob-mcp source you must `bun run build` (then have the operator reconnect the MCP server) or the tools stay stale — a passing handler test proves the code, not that the tool is live.

## The substrate's concept taxonomy (mapped to information streams the user named)

| Stream | `source_type` | Examples |
|---|---|---|
| **Codebase** (idioms, conventions, anti-patterns) | `extracted` or `cpg_embedding` | "MiniBob delegates goal execution to goal-host-vessel"; "VesselDaemon emits task.completed only for in-engine executions" |
| **Documentation** (CLAUDE.md, foundation docs, READMEs) | `vessel_construction_pattern` or `impulse_activity_pattern` | "Three-layer discipline: TS=routing, activities=orchestration, LLMs=via resolver"; "Impulses are universal data access, not instructions" |
| **Organization** (vessel layout, ownership, branch convention) | `vessel_construction_pattern` | "All vessel repos use `dev` as working branch"; "Super-repo is docs + submodule pointers" |
| **External constraints** (lift criteria, openspec timelines, deployment direction) | `memo` | "kubectl/Helm suspended — substrate-only direction"; "lift evaluation: S2→S3 measured by push-away" |
| **Environment** (substrate config, env vars, ports, secrets) | `memo` | "concept-db at port 18260 (host) / 8260 (container)"; "METABOB_API_KEY auto-attached by http_fetch for substrate-local hosts" |
| **Messages** (user instructions that constrain decisions) | `human_input` | "Don't add Co-Authored-By trailer"; "Prefer variant-first repair over template mutation" |
| **History** (git percolations, decisions made and reversed) | `memo` | "Concept-bridge wired 2026-05-29; runs auto-refresh JWT to avoid IAM rejection"; "Concept-db root signin via JS client requires re-auth on expiry" |
| **Memories** (MEMORY.md entries, findings) | `memo` | Mint each MEMORY.md finding as a concept with edges to the concepts it cites |
| **Notes** (validation/, openspec/changes/) | `memo` or `vessel_construction_pattern` | Spec sections, scenario JSON, finding documents |

The taxonomy isn't perfect — `extracted` and `memo` overlap, `cpg_embedding` is conventionally bridge-only. Lean on **shape** (free-form) when source_type is ambiguous; concept-db's similarity search is shape-agnostic.

## Intercept routines

These are checklists for specific workflow moments. Each says "at point X, do Y" — short enough that running them adds <30 seconds to a normal interaction.

### Routine: starting a non-trivial task

1. `concept_search` with the task's keywords AND with `source_type=vessel_construction_pattern` (constraints) AND `source_type=memo` (recent findings).
2. If hits, `concept_neighbors` on the highest-relevance match to see what's adjacent.
3. If empty, take note — at the *end* of the task you'll likely mint several new concepts. (Most of the substrate's vocabulary growth happens at task-end, not task-start.)

### Routine: discovering a non-obvious idiom or constraint

When during code/doc reading you find something that surprises you OR you'd want a future session to know:

```
concept_create({
  shape: "<descriptive shape name; reuse existing ones via search first>",
  source_type: "extracted" | "vessel_construction_pattern" | "memo",
  summary: "<one-line gist>",
  content: "<the substantive paragraph — embedded for similarity search>",
  pointer: { type: "<source>", path: "<file>", section: "<heading>" }  // if from a doc
})
```

Then `concept_link` to existing concepts:
- `derived_from` if this concept descends from a more general one already in the graph
- `description_of` if it explains an existing concept
- `contradicts` if it overturns a prior assumption (the prior concept stays — concept-db's upkeep will adjust priorities)
- `related_to` as the default when no stronger edge applies

### Routine: receiving a user correction or preference

User says "no, don't X" or "from now on Y":

```
concept_create({
  shape: "user_preference",
  source_type: "human_input",
  summary: "<short rule>",
  content: "<full preference + the context that triggered it>",
  pointer: { type: "human_input", session_date: "<YYYY-MM-DD>" }
})
```

These accumulate the "feedback" half of auto-memory in the substrate, not just in the file cache.

### Routine: finding a memory file (or writing one)

**As of 2026-06-16 memory is substrate-resident and hook-enforced** (CLAUDE.md §"Memory: The Substrate Is The Source Of Truth"). The `memoryNote` / `memoryNote_write` resolvers are live on development-vessel (`http://localhost:18090`), and:

- **Reads** come from the `substrate-session-start` hook (auto-injected at load) or a direct `memoryNote` query — not from `MEMORY.md`, which is now a thin pointer.
- **Writes** to any file under the memory dir are auto-mirrored to `memoryNote_write` by the `substrate-memory-mirror` hook. You don't need to mirror by hand.

So the memory↔substrate sync is handled. The concept-graph layer is still **complementary** and worth doing for *load-bearing* knowledge:

1. The memoryNote already holds the full text (via the hook). You don't need to duplicate it as a `memo` concept.
2. **Do** `concept_create` / `concept_link` when the memory encodes a relationship that belongs in the typed graph (e.g. a finding that `contradicts` a prior concept, or `derived_from` an existing pattern) — the concept graph adds typed edges the flat memoryNote store doesn't have.
3. Skip per-note concept minting for routine findings; reserve it for abstractions the graph can reason over.

Memory is the substrate's flat recall; concept-db is its typed reasoning layer. Use memoryNote for "what did I learn," concept-db for "how does it relate."

### Routine: closing a non-trivial task

After implementation:

1. If you mint a new resolver, vessel, or activity: `concept_create` with `source_type: vessel_construction_pattern` for the construction lesson.
2. If you discovered a bug pattern: `concept_create` with `source_type: extracted` for the pattern, `concept_link({edge_type: "contradicts"})` to the assumption it overturned.
3. If you filed an openspec change or finding memory: `concept_create` for the change's load-bearing rationale, link to the concepts it modifies.
4. Use `concept_usage_stats` on the most-cited prior concepts during this task. If lifetime success_rate < 0.5, consider whether to `concept_link({edge_type: "contradicts"})` against them with your new evidence.

### Routine: idle / boredom mode

When the substrate has nothing pressing and you're scanning for improvements (mirrors boredom-vessel goal[7]):

1. `concept_search` with `min_relevance=0.0` and high `limit` — find low-relevance concepts.
2. For each: is it useful, or is it diagnostic noise? Diagnostic noise → `concept_link({edge_type: "contradicts", weight: 0.1})` against itself with a deprecation rationale, then let upkeep prune.
3. `concept_search` with `source_type=memo` — find findings that haven't been linked into the graph yet.
4. Walk neighbors of each high-relevance concept; if a neighbor is orphaned (no further neighbors, low usage), it's a candidate for either richer linking or pruning.

## What NOT to do

- **Don't mint per-file concepts**. The concept-bridge already does that (impulse-signature concepts). Hand-minted concepts should be the *abstractions over* files, not the files themselves.
- **Don't mint concepts that will be reachable via grep or `find`.** A concept is for knowledge that *isn't* easily re-derivable from the source. Symbol names, function locations — these are CPG/grep territory, not concept territory.
- **Don't mint concepts with secrets, API keys, or credentials.** Concept-db is org-scoped but not airtight.
- **Don't mint duplicates without checking.** Always `concept_search` first. Duplicates pollute Bayesian relevance.
- **Don't link `contradicts` lightly.** It's a strong signal that upkeep will act on. Use `weight=0.1–0.3` for new contradictions; let evidence accumulate before raising.
- **Don't mint constitutional concepts (CLAUDE.md sections) per-paragraph.** Mint per *load-bearing section* — the granularity at which the concept makes sense without its surrounding context.

## Verifying the substrate is healthy enough to write to

Before a writing-heavy intercept session, quick check:

```
mcp__metabob__concept_search()        # confirms concept-db is reachable
mcp__metabob__concept_usage_stats({   # confirms usage writes work
  concept_id: "concept_xkrH3DvKplQd"  # the well-exercised seed concept
})
```

If either fails: check `docker exec substrate-live systemctl is-active concept-db.service`. If concept-db is down, see `finding_2026_05_28_concept_db_root_signin_blocked` for the historical root cause and the SurrealQL fix shipped 2026-05-30.

## Bootstrap concepts (one-shot, on first activation)

If the graph is essentially empty (fewer than ~20 concepts), run `scripts/concept-seed/seed-claudemd.sh` from this repo (created alongside this skill) once to mint constitutional concepts from CLAUDE.md sections. After that, ongoing accumulation happens incrementally through the intercept routines above.

## See also

- `repos/concept-db/CLAUDE.md` — concept-db's data model and API surface
- `openspec/changes/2026-05-28-concept-bridge-observer/` — the design rationale for bridge-mediated bridge accumulation, and the Part B per-symbol fan-out that's still deferred
- `finding_2026_05_29_substrate_context_aware_authoring` — why the autonomous draft loop now reads concept-db as priors
- `feedback_memory_as_substrate` — operator memory files are a derived cache; substrate is source of truth
