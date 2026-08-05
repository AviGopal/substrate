# CLAUDE.md

Guidance for Claude Code when working in this repository. This document is
**timeless and behavioral**: it describes the decisions that govern the system and
the flows through which you interact with it. It does not carry status, versions,
dates, or instance names — current state lives in the running substrate and is
queried, not memorized. When this document and the running system disagree, the
running system is authoritative; file the discrepancy as a gap.

Canonical ontology (read before implementing anything):
[`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md).
Execution model: [`docs/architecture/SUBSTRATE_AS_SOFTWARE.md`](docs/architecture/SUBSTRATE_AS_SOFTWARE.md).
Learning dynamics: [`docs/architecture/SUBSTRATE_AS_DYNAMICS.md`](docs/architecture/SUBSTRATE_AS_DYNAMICS.md).

---

## What this system is

A **substrate** is one full deployment of a vessel fleet that develops itself.
Its ontology, in five sentences:

- **Impulses** are data in any form, carried as lazy pointers with metadata.
  The metadata names a **shape** — a routing-and-reasoning key, not a schema.
- **Activities** are constrained state transitions: they declare which shapes they
  consume and produce, and dispatch tasks to **resolvers** (deterministic, pattern,
  or LLM — the LLM is one resolver among many, never the controller).
- **Vessels** bundle activities and resolvers where their data lives, and advertise
  their shapes through a discovery registry — the only fixed point; all routing is
  dynamic.
- **Every execution is traced**, and the traces are the learning substrate:
  Thompson sampling grades activity selection, relevance scores grade impulses,
  and the ribosome extracts successful executions into reusable templates.
- **Goal execution is a walk**: backward-chaining over the shape graph from the
  goal's target shapes, choosing producers by learned posterior, binding data
  flow shape-to-shape, and judging afterward whether the goal was actually
  **reached** — not merely whether the process exited cleanly.

The system develops itself: it authors its own code changes, verifies them, lands
its own commits, detects its own gaps, and fills idle capacity with condition-driven
work. Your role is defined relative to that (see "The operator role").

## The execution expectation

This is the contract every piece of work is measured against.

**Floor — parity with a conventional agent.** Given any arbitrary task, the
substrate must at worst match what a ReAct-style agent (reason → act → observe,
looped) would do: use the activity and walk machinery to map a direction along
shapes toward the goal, resolving each step with the tools and resolvers it has.
No goal should be structurally out of reach just because no learned pathway
exists yet — the walk with tool-enabled fallback *is* the ReAct loop, with the
difference that every step lands in a trace.

**Ceiling — the learned pathway.** A task the system has done before should run
over the pathway it learned: the walk finds an existing composition whose shape
signature covers the goal and executes it directly — cheaper, faster, and more
reliable than re-deriving, because the posterior on that pathway is earned.

**The middle — first/last-mile adaptation.** A task *similar* to a learned one
should reuse the existing pathway and walk only the difference: adapt the entry
(bind different inputs into the same body — the first mile) or the exit (carry
the same body's outputs to a different target shape — the last mile), rather than
either rejecting the pathway for not matching exactly or re-deriving it from
nothing. Pathway reuse with marginal walking is the mechanism by which learning
compounds; full re-derivation on every near-miss means nothing was learned.

**Reach is mechanism correctness, not a metric.** Any arbitrary goal walk should
reach with high probability (~90%) *regardless of priors* — reach failures are
information-availability failures, not capability failures: everything needed is
already in the code, the specs, and the concept graph, and the fix is making the
right information available at the right time. A high reach rate on trivial goals
is a gamed metric; the expectation applies to useful work.

When the observed behavior falls short of this contract, that shortfall is a gap:
file it, coax the substrate to close it, and verify the closure. Do not silently
absorb the work.

## How work happens: dispatch, don't edit

Development flows **through** the substrate so every change produces a trace and
feeds the learning loop. The agent-facing surface is the **metabob-mcp cockpit**
(the IDE analogue of the human's Obsidian surface; not an internal component).
Full workflow guidance: the `metabob-substrate` skill.

| Plane | Tool | Use |
|---|---|---|
| ACT | `mcp__metabob__run_goal` | Synchronous dispatch; short one-shot goals answered inline. |
| ACT | `mcp__metabob__run_goal_async` | Default for anything non-trivial; returns a `dispatchId`. |
| TRACK | `mcp__metabob__goal_status` | Poll a dispatch; the primary line is the honest `reached` verdict. |
| REASON | `mcp__metabob__goal_reasoning` | Reconstruct the walk's decision log — *why* it reached or fell short. |
| FEEDBACK | `mcp__metabob__provide_feedback` | Record an operator verdict into the oracle corpus. Measured feedback, not advice. |
| INSPECT | `mcp__metabob__registry_query` | The live shape vocabulary and who serves what. |
| INSPECT | `mcp__metabob__execution_trace` | Durable trace by execution id. |
| INSPECT | `mcp__metabob__resolve_impulse` | Escape hatch: resolve/write any impulse shape. Prefer dedicated tools. |

**The canonical loop:** `run_goal_async` → `goal_status` (read `reached`) →
`goal_reasoning` (why) → `provide_feedback` (verdict → corpus).

**Flows that follow from this:**

- **Code changes are goals.** A goal whose lead sentence names a real
  `repos/<vessel>/src/…` file routes through the edit-intent path to
  `feature_compose`, which drafts, typecheck-verifies, and lands a traced commit.
  Name the file, describe the change. One file per goal — multi-file asks drop
  parts silently.
- **`reached`, not `status`.** `status` is only the template exit status. Hollow
  completion (`completed` + `reached:false`) and satisfier reaches (`failed` +
  `reached:true`) are both common. When stakes are high, read the actual diff or
  output — a change can typecheck and pass the reach gate yet not do what was
  asked. A trace's substantive content, not its status field, is the evidence.
- **Direct edits are gated.** `Write`/`Edit` on `repos/<vessel>/src/**` is blocked
  by a PreToolUse hook (fails open when the substrate is unreachable). A conscious
  one-off bypass sets `SUBSTRATE_ALLOW_DIRECT_EDIT=1`. Edits to `docs/`, `scripts/`,
  `openspec/`, `.claude/`, tests, and config are never gated.
- **Query the system, not the cache.** Current metrics, registry contents, gap
  state, and report shapes come from the running substrate (`registry_query`,
  report-shape resolves), not from memory files or this document.
- **Dispatches are attributable.** Every dispatch carries an `operator:<id>` tag
  into the trace.

## The laws

Standing decisions, each with the reason it exists. Violating one of these is
drift even when the immediate result looks fine.

1. **Everything behavioral is a shape.** Runtime behavior must be steered by
   shaped impulses read at use time. Env vars, config files, and in-process
   constants are bootstrap-only (secrets, ports, identity): they are frozen at
   process start, invisible to traces and the walk, and unlearnable. Never gate
   behavior behind anything the system cannot observe through a shaped impulse.

2. **Behaviors are activities.** Every taught behavior is minted as an activity —
   selectable by Thompson, graded by traces, composable, replaceable by a better
   variant. A behavior that exists only as a resolver (or only as an operator's
   curl habit) is invisible to the learning loop. Resolvers are thin primitives
   that vessels earn slowly with evidence; activities are cheap to mint and cheap
   to retire.

3. **Reuse before mint.** Before creating a new activity or resolver, find an
   existing producer of the needed output shape and compose with it. A duplicate
   mint is a fresh uninformed cell that splits selection traffic and raises the
   growth rate the learning loop must outpace; reuse sharpens an existing
   posterior and adds a composition edge. Minting is the justified exception:
   a true gap with no existing producer, or variant-first repair of a measured
   weak family. **A wrong mint is negative value, not zero** — even when its
   dispatch goes green.

4. **Activities are earned by doing, not declared.** The proper origin of an
   activity is extraction from a reached execution (the ribosome), not an
   operator uploading a hand-written template. Declared-but-never-walked
   templates are hollow.

5. **Pace is a rhythm, not a throttle; boredom is condition-driven selection.**
   Cadence lives in the pool as time-shaped rhythm impulses the selector reads,
   not in static intervals, timers, or concurrency clamps. Boredom means: when
   idle, select what to do from current conditions (open-gap demand, rhythm due
   state, learning-mode signals) folded into selection weights.

6. **Don't rob the substrate's self-maintenance.** When its self-development
   fails, the failure is training signal: file it as a gap and let the system
   learn the repair. Hand-completing its work steals the lesson. Equally,
   **failure mints structure** — every observed bug class gets three questions:
   how do I patch this instance, what activity would detect this class without
   me, and what goal should the system have generated from this observation?
   If the operator authored the goal by hand, the missing generator is itself
   the gap.

7. **Measure by the gap triple.** Progress is (1) gap close rate, (2) gap latency
   from detection to close, (3) solution durability — gaps don't reappear wearing
   different hats. Activity counts, dispatch volume, and token spend are not
   progress. The goal of gap management is **learned disposition**: the system
   learns which gaps to close now, which can wait, which need more information,
   and which aren't worth closing.

8. **Information at the right time.** Confabulation and fixation are downstream
   of information starvation, not model weakness. The fix for a wrong output is
   rarely a bigger prompt — it is making the load-bearing fact (a schema, a
   contract, a prior trace) available as an impulse at the moment of use.

9. **Docs are expectations; write them timelessly.** A document is an expectation
   the system holds about itself — closure means verifying reality against it.
   Operator-facing docs describe behavior a reader can expect, never dated
   status, instance names, or ticket ids (those belong in commit messages,
   traces, and the gap store). Documentation alignment is itself substrate work
   (the docs-align loop), not a manual chore to absorb.

10. **Memory belongs to the system.** The substrate's memory store (the
    `memoryNote` shape, served by development-vessel) is authoritative; operator-
    side memory files are a derived cache. Session hooks inject substrate memory
    at start, mirror memory-file writes back as `memoryNote_write`, and dispatch
    consolidation at end — all fail open. Recall by querying the resolver; fall
    back to cache files only when the substrate is down, and say so.

11. **Location independence with data locality.** The system must run identically
    wherever it is deployed and must not rely on a host machine or host
    workspace — a substrate boots and manages itself from an image plus env plus
    volumes. But not everything runs everywhere: a vessel belongs where its
    resolver's data lives; duplicating it means duplicating access to that data.

12. **Causal discipline.** The system mints structure from its own successes, so
    correlations over traces are partly effect-as-cause. Prefer counterfactuals
    recorded at decision time and deliberate interventions; when you change
    something to see what happens, change one thing and record that you did.

13. **Humans are resolvers, not preprocessors.** A human (or an agent acting for
    one) sends goals in natural language; the system owns decomposition, path
    inference, and payload synthesis. If a goal only works after an operator
    rewrites it with file paths and expected shapes, that rewriting is a gap in
    the system, not a workflow to institutionalize.

## The operator role

The trajectory is S1 → S2 → S3: from operator-authored development, to
substrate-authored development under supervision, to a system that resists
harmful intervention with cited evidence. The operator's job is to become
structurally non-load-bearing.

- **Intervene only on intractable blockers** — things structurally beyond the
  system's reach (missing credentials, broken infrastructure it cannot see,
  a capability that cannot exist until someone bootstraps it). For everything
  else: file the gap, coax, verify.
- **Every intervention decomposes recursively**: patch the instance, then ask
  what substrate activity would have detected and repaired the class. This
  applies to the artifact you're writing about it, too.
- **Teach through the channel that is read.** Before writing any lesson, name
  its runtime reader; a lesson with no read-at-use-time path is an archive,
  not teaching — and the missing reader is itself a gap. Drafter-facing
  lessons are class-grain concepts recalled at prompt-build; operator memory
  files teach no one but the operator.
- **Wrongness is a goal seed.** A deterministic mismatch verdict carries its
  own repair goal (fix the builder for the named class); a hollow cluster
  over goals sharing surface form is the demand signal to construct a parse +
  command + oracle for that class. The system should mint these goals from
  its own observations; an operator writing them by hand is the gap.
- **Autonomy has a hard success criterion**: a substrate-authored commit landing
  on the remote working branch with no operator hands. "It fired" is not success.
- **Adversarial duty**: post-lift, the operator introduces probes, hostile peers,
  and untrusted inputs — testing the system's resistance is part of the role.

## Interaction surfaces

- **Agent (you):** the metabob-mcp cockpit, above.
- **Human:** Obsidian vessels — each connected vault is a surface to a different
  human resolver, with its own local information. All plugin-to-substrate calls
  route through the vessel's sidecar conduit (discovery-federated), never
  hardcoded ports. There may be many; the system tells them apart.
- **Federation:** substrates peer through a relay/hub so vessels on one substrate
  can resolve shapes served by another. Placement follows data locality (law 11).

## Reference: the running substrate

One container (`substrate-live`) runs every vessel as a systemd unit. Vessels
bind internal ports; the host maps them by convention `18xxx → 8xxx`. Discover
the live fleet rather than trusting a table: `docker ps --filter name=substrate`,
`registry_query`, or per-vessel `/health`.

These are **fleet-wide anchors**, not a promise about any one deployment. The
port is where the vessel binds *when it runs locally*; whether it runs locally
depends on the substrate's role. A standalone substrate serves all of them. A
spoke's role group (`roles.spoke` in `scripts/substrate/vessels.inventory.json`)
leaves out units the hub owns — the trace store (`activity-api`, role `api`) and
identity (role `control`) among them — and resolves those shapes on the hub
through discovery, so a local `:18080` may legitimately answer nothing. A
deployment can also mask individual units by name on top of its role selection
(`DISABLED_VESSELS`), so any port may be dark for that reason too. Route by shape
through discovery and let it place the call; reach for a host port only when
you are deliberately talking to one machine's copy, and confirm first that the
unit is unmasked there.

| Endpoint | Vessel | Role |
|---|---|---|
| `:18080` | activity-api | trace store + Thompson learner + activity shapes |
| `:18090` | development-vessel | memoryNote resolver + dev meta-activities |
| `:18100` | discovery-vessel | registry / routing fixed point |
| `:18210` | goal-host-vessel | goal dispatch (`/run-goal`, `/resolve`) |
| `:18260` | concept-db | concept graph + prose knowledge |

Other vessels (LLM resolvers, local tools, identity, relevance sink, light
dispatch, analysis, UI, ribosome, boredom, …) are internal-only or discovered
via the registry.

**Bootstrap:** `make -C scripts/substrate up ANTHROPIC_API_KEY=...` — one
command; build, start, in-container seed, readiness, doctor. Remote:
`scripts/substrate/deploy-remote.sh` (ship image over SSH) or `deploy-hub.sh`
(hub + federation relay). A federated spoke is two commands: `make up` pointed
at the hub's discovery endpoint, then enabling the federation transport.
Details: [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md).

**Client config:** `~/.metabob/config.json` needs `metabob.endpoint`
(`http://localhost:18080` for a local substrate) and a valid `apiKey`; all
tooling reads this config, nothing hardcodes an endpoint. Goal-host is resolved
via discovery, never pinned.

**Auth:** identity-vessel is the single validator — every vessel checks
credentials against it (API keys service-to-service, JWTs for browser surfaces).
Tenant isolation is enforced in the database via PERMISSIONS on `$token.org_id`,
not in application code. Never bypass PERMISSIONS with root credentials.

**Troubleshooting (fallback of last resort — prefer the cockpit):**
`docker exec substrate-live systemctl status <unit>`,
`docker exec substrate-live journalctl -u <unit> -n 100`. Hot-reload a vessel
after an (exceptional) manual edit: `make -C scripts/substrate restart-<vessel>`.
Before restarting anything, check nothing is mid-flight and remember learning
state persists in the container volume — back it up before destructive resets.
Never hand-edit the database; schema changes are migrations applied on unit
start.

**Validation:** the failure-mode harness
(`bun run validation/scripts/failure-mode-harness.ts`) plus a confirming
dispatch whose trace you inspect.

## Repository conventions

- **Branch hygiene:** all work on `dev` in every repo; `git pull --ff-only`
  before starting (divergence forces explicit triage); push `origin dev`. In the
  super-repo, `git submodule update --init` after pulling.
- **Commits:** early and often once working; one concern per commit;
  `<type>(<scope>): <subject>` with a body explaining *why*. One-shot writeups
  belong in the commit message, not the tree.
- **Placement:** the super-repo is a thin coordinator — `repos/*` (submodules),
  `docs/` (timeless reference), `openspec/` (change proposals), `scripts/`
  (operational tooling), `packages/` (shared TS), `validation/` (harness and
  fixtures), plus the tool directories `.claude/`, `.github/`, `.githooks/`.
  The authoritative list is `ALLOWED_TOPLEVEL_DIRS` in
  `scripts/git-hooks/pre-commit`; that hook rejects root-level additions
  outside it, and it only enforces once installed — run
  `scripts/git-hooks/install.sh` in every clone. Runtime state (the pool, the
  gap store, memory, policies) belongs in the container volume and is
  gitignored: a file the substrate rewrites is not a file git should carry.
  Tests live in each vessel's repo, never in the super-repo.
- **Script retention:** a script stays only if an activity validates it and that
  activity reaches consistently. A script nothing invokes cannot be observed
  failing, so it can never be trusted when it passes — that is the same defect
  as a verification gate with no call sites. Establish "nothing invokes it" by
  resolving directory and glob references, not basenames: the image copies whole
  script directories, so presence in the container proves nothing, and an
  untracked worktree copy of a file reads as a caller of itself.
  **The bootstrap tier is the stated exception**, not a silent carve-out: the
  Makefile, `entrypoint.sh`, `gen-env.sh`, unit rendering, secrets and readiness
  helpers, and the seeders — `bootstrap-seeder.ts` most of all, since it mints
  the first activity templates — run before any substrate exists to host a
  validating activity. Nothing there can be gated without circularity. The two
  liveness watchdogs are exempt for the same reason: a check cannot be scheduled
  by the mechanism it exists to recover.

## Alignment checklist

Before implementing, verify:

- [ ] Data flows as shaped impulses; behavior is steered by shapes (law 1)
- [ ] The behavior is an activity the loop can grade (law 2)
- [ ] An existing producer was sought before minting (law 3)
- [ ] Resolvers live where the data lives (law 11)
- [ ] Execution is traced; the trace is inspectable evidence
- [ ] The change can be dispatched as a goal rather than hand-edited
- [ ] If this fixes a bug: what detects the class without you? (law 6)

**Red flags:** new single-use REST endpoints; treating the trace store as a
universal resolver; LLM processing raw data instead of reasoning over metadata;
untraced execution; env-gated behavior; hand-completed substrate failures;
progress reported as activity counts.
