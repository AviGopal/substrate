---
name: metabob-substrate
description: Operate the metabob substrate as a citizen, not a tourist. Drive all work through the MCP cockpit — dispatch goals (run_goal / run_goal_async), understand HOW the walk reasoned (goal_reasoning), record whether it worked (provide_feedback → oracle corpus), and inspect the running system (registry_query / execution_trace / resolve_impulse) without host access. Read `reached`, not `status`. Code-change goals that name a repos/<vessel>/src file land traced commits. Hold the system to the execution expectation (worst case ReAct parity, best case learned-pathway reuse); file shortfalls as gaps instead of absorbing the work. Contribute to the concept graph so the substrate accumulates instead of churning.
---

# metabob-substrate

How to interact with the running substrate. The governing decisions live in
CLAUDE.md ("The laws", "The execution expectation"); this skill is the *flows* —
what to actually do at each workflow moment. It is written timelessly: where it
names a capability, verify against the running system (`registry_query`,
`/health`), not against memory.

## The stance

You are one resolver among many in a system that develops itself. Three
consequences:

1. **Work flows through the substrate**, not around it. A change dispatched as a
   goal produces a trace, feeds Thompson, and can be extracted into a template.
   A hand edit produces nothing the system can learn from.
2. **Shortfalls are gaps, not chores.** When the substrate fails at something it
   should be able to do, the deliverable is a filed gap (plus a coaxing dispatch
   and a verified closure) — not you quietly doing the work.
3. **Knowledge you don't write back is lost.** The substrate's memory store and
   concept graph are the durable memory across sessions; your session context is
   not.

## The cockpit

Three planes plus inspection. Tool descriptions are self-contained; this table
is *when*, not *what*.

**ACT**

| Tool | Use when |
|---|---|
| `run_goal` | Short one-shot goal you want answered inline (blocks, ~5 min cap). |
| `run_goal_async` | Default for anything non-trivial — composition walks, code changes, recovery. Returns a `dispatchId`. |
| `goal_status` | Track a dispatch. The primary line is the honest `reached` verdict, plus execution id, template, produced shapes, failure mode, posterior. |

**REASON**

| Tool | Use when |
|---|---|
| `goal_reasoning` | After a dispatch: the walk decision log — goal-target inference, satisfier/bridge/step choices, reach verdict, per-task sequence. This is *why* it reached or fell short. |

**FEEDBACK**

| Tool | Use when |
|---|---|
| `provide_feedback` | After inspecting: record `reached` / `not_reached` / `partial` + rationale + confidence into the oracle corpus. Your judgment becomes training signal that calibrates the reach gate. A precise `not_reached` rationale is a negative training example, not just a note. |

**INSPECT**

| Tool | Use when |
|---|---|
| `registry_query` | "What shapes exist?" (`mode:"shapes"`) / "who serves shape X?" (`mode:"vessels"`). The live vocabulary — always fresher than any doc. |
| `execution_trace` | Durable trace by execution id: chain, tags, per-task sequence, failure mode. |
| `resolve_impulse` | Escape hatch to resolve or write ANY shape (`memoryNote`, `substrateGap_write`, report shapes, …). Prefer dedicated tools when they fit. |

### The canonical loop

1. `concept_search` the goal's keywords — warm-start on prior knowledge.
2. `run_goal_async({ goal })` → keep the `dispatchId`.
3. Poll `goal_status` until it settles; **read `reached`, not `status`**.
4. `goal_reasoning` — why it reached or fell short (mis-routed? hollow? gated?).
5. `provide_feedback` — verdict into the oracle corpus.
6. A hollow completion, mis-route, or novel failure mode is a signal worth
   minting (`concept_create`) or filing (`substrateGap_write`).

### Reading results honestly

- `status` is the template exit status; `reached` is the goal verdict. Hollow
  completions (`completed` + `reached:false`) and satisfier reaches (`failed` +
  `reached:true`) are both common. Trusting `status` makes you retry successes
  and accept hollows.
- When stakes are high, read the actual diff or output. A change can typecheck
  and pass the reach gate yet not do what was asked — that check is yours.
- A trace's substantive content is the evidence; its status field is metadata.
  Whether a refusal was sound, an audit found anything real, or a milestone was
  met requires reading the trace body.
- The `state_signature` tag on a hydrated status is the state-space signature at
  dispatch time; identical signatures mean identical selection conditions. Use
  it to reason about why selection differed across similar goals.

### Dispatching well

- **Code changes:** the goal's *lead sentence* names one real
  `repos/<vessel>/src/…` file and describes the change in prose. This routes to
  the edit-intent path, which drafts, typecheck-verifies, and lands a traced
  commit. One file per goal — multi-file asks silently drop parts. Verify the
  landed diff, not just `reached`.
- **Don't preprocess for it.** Humans (and you, relaying a human) send natural-
  language goals; decomposition and payload synthesis are the system's job. If a
  goal only works after you rewrite it with paths and shapes, file that as a
  gap. (Exception: the code-change lead-sentence rule above — that is the
  routing contract, not preprocessing.)
- **Don't dispatch synthetic goals to "test autonomy"** while the autonomous
  loop is actively working the same area — check recent traces and commits
  first; a synthetic dispatch pollutes the very signal you're probing.
- Every dispatch carries your `operator:<id>` tag into the trace — your activity
  is an attributable surface the system models.

## Holding it to the execution expectation

The contract (CLAUDE.md): worst case, any arbitrary goal walks to reach like a
ReAct agent would — mapping direction along shapes with tool-enabled resolution;
best case, a known task runs over its learned pathway; in between, a similar
task reuses an existing pathway and walks only the first or last mile.

When a dispatch falls short, classify before reacting:

- **Never found a direction** (no target shapes inferred, no producers found):
  an information-availability failure. Check the registry for the shapes it
  needed; check whether the load-bearing fact exists anywhere it could have
  read. File the missing bridge, not "the model is weak".
- **Found a direction but re-derived from scratch** when a learned pathway
  existed: pathway-reuse shortfall. Note the existing template/composition it
  should have matched (goal_reasoning shows what was considered) — this is
  first/last-mile adaptation failing, the highest-leverage gap class.
- **Reached hollowly**: the reach gate was satisfied but the asked output wasn't
  produced. `provide_feedback` with `not_reached` + rationale; this is oracle
  calibration data.
- **Reached genuinely but expensively** (long chain, heavy LLM tiers for
  deterministic work): efficiency signal, worth feedback but not a gap unless
  recurring.

The response to a shortfall is the coax loop: file a `substrateGap_write` with
the classification and evidence, optionally dispatch a goal pointing the system
at its own gap, verify the closure later, and record durability (does it
reappear wearing a different hat?). Progress is measured by the gap triple —
close rate, latency, durability — never by dispatch volume.

## Contributing to the concept graph

The substrate accumulates typed knowledge only when the agent loop contributes
it. memoryNote is flat recall ("what did I learn" — handled automatically by
the memory hooks); concept-db is the typed reasoning layer ("how does it
relate") that drafters and walks read as priors.

| Tool | Use when |
|---|---|
| `concept_search` | Before deciding on a topic you may have worked before. Filter by `source_type` or `shape`. |
| `concept_neighbors` | Walk typed edges from a hit to adjacent context. |
| `concept_usage_stats` | Is this concept load-bearing now, or historical? |
| `concept_sequence` | What usually follows this concept in successful traces? |
| `concept_create` | Knowledge not yet in the graph. |
| `concept_link` | You observed a relationship: `derived_from`, `description_of`, `contradicts` (an overturned assumption), `related_to` (default). Always give a description. |

**Mint** when you surface an abstraction a future walk could reason over: a
construction pattern, an overturned assumption, a constraint, a user preference
(`source_type: human_input`). **Don't mint**: per-file facts (the bridge does
that), anything grep-rederivable, secrets, duplicates (search first), or
paragraph-granularity shreds of constitutional docs. Link `contradicts` at low
weight and let evidence accumulate.

Routine at task close: mint the construction lesson if you built something; mint
pattern + `contradicts` link if you overturned an assumption; check
`concept_usage_stats` on the concepts you leaned on and contradict the ones your
evidence undermined.

## Memory flows (automatic — know them, don't run them)

- Session start: a hook injects substrate memory (`memoryNote` store) into
  context. The substrate, not the operator file cache, is authoritative.
- Any write to a file under the operator memory directory is auto-mirrored to
  `memoryNote_write` by a hook.
- Session end: a hook dispatches memory consolidation.
- All hooks fail open. If the substrate is unreachable, you're on the cache —
  say so, and reconcile (re-import) when it returns.
- Manual recall: `resolve_impulse({ shape: "memoryNote", pointer: { note_type |
  title_prefix | id | limit } })` routed to the memory vessel.

## Escalation ladder

Host access (`docker exec`, `journalctl`, raw `curl`) is the fallback of last
resort, in order:

1. Cockpit tools (above).
2. Vessel `/health` endpoints from the host.
3. `docker exec substrate-live systemctl status <unit>` /
   `journalctl -u <unit>` — read-only diagnosis.
4. `make -C scripts/substrate restart-<vessel>` — only after confirming nothing
   is mid-flight.
5. Direct source edit with `SUBSTRATE_ALLOW_DIRECT_EDIT=1` — conscious,
   exceptional, and only for things structurally outside the system's reach
   (its own bootstrap, a wedged store). Ask afterward: what activity would have
   detected and repaired this without me?

## See also

- `CLAUDE.md` — the laws, the execution expectation, the operator role
- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` — the ontology
- `docs/SUBSTRATE.md` — bootstrap, iteration, backup
- `repos/metabob-mcp/docs/SPEC.md` — cockpit tool contracts
