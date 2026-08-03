# Memory As Substrate

**Status (updated 2026-06-16): LIVE and hook-enforced.** The `memoryNote` / `memoryNote_write` resolvers ship in `development-vessel` and are advertised at `http://localhost:18090/shapes`. The one-shot import has run (169 operator files → substrate; store holds 171 notes). The operator→substrate write direction and the substrate→context read direction are now enforced by **Claude Code harness hooks** (see §E), not by the substrate-resident cron activities this doc originally specced (those — `memory-sync-tick`, `memory-pending-flush` — were never built; the hooks supersede them). References specs accepted in the retired proposal (§1, Memory closure) and the retired proposal (§A, `memoryNote` + `extract-memory-note`). No new spec proposed here.

**Audience:** Claude (the operator), and any other agent or human who reads or writes operator-side memory while working in this super-repo.

**Reading order:** §A defines the principle. §B contrasts current and target state, including the bridge-state interim that is the actual operating reality today. §C–§F define the migration plan, operator workflow, override mechanism, and closure verification. §G enumerates what this change does NOT do.

---

## §A. The principle

> Memory about this system belongs to the system, not to the operator.

What Claude knows about metabob-devbob — recurring failure modes, vessel quirks, project conventions, user preferences — is *system knowledge*. The substrate (single-container or canary) is the authoritative store for that knowledge. Operator-side files at `~/.claude/projects/-home-avi-documents-work-exp-repo-metabob-devbob/memory/` are a derived cache.

Three reasons this matters:

1. **Closure.** IAL Phase 27 lift requires the substrate to sustain its loop without external stateful resolvers. Operator memory is one of the seven closure gaps catalogued in `substrate-closure-properties`. Until memory is substrate-resident, wiping `~/.claude/.../memory/` would lose properties the lift surface depends on, which violates the closure principle.

2. **Self-understanding.** When the substrate holds its own memory, what the operator sees is what the substrate sees. Alignment between the operator's model and the substrate's model becomes a measurable property (the cache mirrors substrate state) rather than an article of faith.

3. **Adversarial S2→S3 readiness.** The S2→S3 transition (per `feedback_lift_three_state_model`) is signalled by substrate push-away: the substrate refusing operator interventions with cited rationale. Push-back about *memory contents* — "you wrote this in your cache but the substrate's evidence supersedes it" — requires the substrate to be the source. Today the operator unilaterally writes memory; that asymmetry blocks the push-away signal.

The override is **one-directional in principle**: writes flow operator → substrate; reads consult substrate first, fall back to cache. In practice today, the override is partial — see §B bridge state.

---

## §B. Current vs target state

### Current (pre-override, today's baseline)

- Memory lives in `~/.claude/projects/-home-avi-documents-work-exp-repo-metabob-devbob/memory/`:
  - `MEMORY.md` — index of one-line summaries with links
  - Individual notes (`feedback_*.md`, `percolation_*.md`, `project_*.md`, etc.) — frontmatter (`name`, `description`, `type`, `originSessionId`) plus markdown body
- Claude reads `MEMORY.md` at session start (auto-loaded into context) and individual notes on demand
- Claude writes new notes directly to disk; the file is the source of truth
- Substrate has no awareness of memory contents; substrate cannot cite, refute, or supersede a memory

### Target (post-override, closure-green)

- Memory lives as `memoryNote` impulses (shape contract: `closure-replacement-suite` §A)
  ```
  memoryNote { id, type, title, body, provenance_trace_ids[], confidence_weight, last_validated_at, supersedes_id? }
  ```
- Resolved by `development-vessel` per `substrate-closure-properties` §1
- Writes flow through `memoryNote_write` admin-gated write shape
- New `finding`-type notes are ribosome-emitted automatically from `lifecycle:execution:succeeded` events (per `extract-memory-note` activity contract)
- `feedback` and `reference` notes are operator-emitted via explicit `memoryNote_write` invocation
- Operator-side files become a mirror: a 5-minute `memory-sync-tick` activity pulls `memoryNote` impulses and writes the cache. Wiping the cache is recoverable; wiping the substrate is not.
- Closure-audit `--without=operator-memory` (per `substrate-closure-properties` §27.3.j.1) reports green

### Now (post-cutover, 2026-06-16) — hook-enforced

The readiness probe (`development-vessel` advertises `memoryNote` in `/shapes`) now returns **true**, so the bridge state below is **historical**. The override is no longer "partial" — it is enforced by three Claude Code harness hooks (defined in `.claude/settings.json`, scripts under `.claude/hooks/`):

- **Writes** — the `substrate-memory-mirror` PostToolUse hook fires on every `Write`/`Edit`/`MultiEdit` of a file under `~/.claude/.../memory/` and emits the corresponding `memoryNote_write`. The write envelope is `{"impulse":{"type":"memoryNote_write","note":{…}}}` (top-level `impulse`, body under `.note` — NOT the `{"pointer":{…}}` form the old import script used). You may still write the file; the substrate copy is authoritative and is written for you.
- **Reads** — the `substrate-session-start` hook queries `memoryNote` (recent + high-confidence) and injects the result into session context. Read envelope: `{"impulse":{"type":"memoryNote", id?|note_type?|title_prefix?|provenance_tag?|limit?}}`. The substrate response is authoritative; cache reads are a fallback only when the substrate is down (say so when you use them).
- **Consolidation** — the `substrate-session-end` hook dispatches a memory-consolidation goal so the session's learnings are absorbed by the loop.

All hooks **fail open**: substrate unreachable ⇒ hook no-ops ⇒ cache fallback. To reconcile cache→substrate after an outage, re-run the import (§C.3).

### Bridge state (historical — pre-2026-06-16, retained for context)

Before the cutover, `memoryNote` was specced but unshipped, so memory was file-first with a `pending_sync: true` flag and a planned (never-built) flush tick. The discipline (types, when to save, what not to save) was identical to today; only the destination and the enforcement mechanism changed. This block is kept only so older traces and commits that reference "bridge state" remain legible.

---

## §C. Migration plan

One-time bulk conversion of the existing ~70 operator-side notes to `memoryNote` impulses, gated on `memoryNote_write` being live.

### C.1 Inventory

- Count: ~70 notes under `~/.claude/projects/-home-avi-documents-work-exp-repo-metabob-devbob/memory/` as of 2026-05-23
- Categories from `MEMORY.md`:
  - `percolation_*` — work-session summaries (~40 notes); map to `memoryNote.type = "finding"`
  - `feedback_*` — user preferences and conventions (~15 notes); map to `memoryNote.type = "feedback"`
  - `project_*` — project-level orientation (~5 notes); map to `memoryNote.type = "reference"`
  - `jiggle_prune_*`, `shapes_*`, others — heterogeneous; map by content judgement

### C.2 Conversion mapping

For each file:

| Field in `memoryNote` | Source |
|---|---|
| `id` | ULID derived from filename base (deterministic) |
| `type` | Per filename prefix (see C.1) |
| `title` | Frontmatter `description` (or `name` if no description) |
| `body` | Markdown body below frontmatter |
| `provenance_trace_ids` | Extracted from body if cited (e.g. "trace `01HX...`"); empty list otherwise |
| `confidence_weight` | Default by type per `closure-replacement-suite` §A: 0.6 finding, 0.4 feedback, 0.7 reference |
| `last_validated_at` | File mtime |
| `supersedes_id` | None for first import (supersession is recorded only for explicit replaces) |

### C.3 Bulk-emit script (as built)

The script is **`scripts/substrate/import-operator-memory.ts`** (wired as `make -C scripts/substrate import-memory`). The originally-specced path `validation/scripts/migrate-memory-to-substrate.ts` was never created; this is its as-built replacement.

- Reads every `.md` under `~/.claude/projects/-home-avi-documents-work-exp-repo-metabob-devbob/memory/` (excluding `MEMORY.md`)
- Parses frontmatter + body; types by frontmatter `type` or filename prefix (`feedback_*`→feedback, `percolation_*`/`project_*`→project, else finding)
- Note id is `operator-import:<filename-stem>`; provenance tag `operator-import-2026-05-25`; confidence by type
- **HTTP path** (`DEV_VESSEL_ENDPOINT=http://localhost:18090`): POSTs `{"impulse":{"type":"memoryNote_write","note":{…}}}` to `/v2/impulses/resolve` for each note — this is the path that populates the live substrate. **Offline path** (no `DEV_VESSEL_ENDPOINT`): writes `WORKSPACE/memory/notes.json` instead (does NOT touch the running store).
- Idempotent: upsert-by-id, skips notes whose body is unchanged
- Run record: 2026-06-16, `imported=169 updated=0 skipped=0`, store 1→171.

### C.4 Verification

- `closure-audit --without=operator-memory` reports green (no §27.1/§27.2 property fails)
- Independent recall test: wipe `~/.claude/.../memory/` in a non-production Claude session; verify Claude can recall any previously-known fact by substrate query alone
- Manifest reconciliation: every input file maps to an emitted `memoryNote.id`; orphans (files with no mapping) are reported and resolved manually

### C.5 Post-migration

- `~/.claude/.../memory/` is wiped and re-populated by `memory-sync-tick` from substrate state
- Subsequent operator-side writes flow through the §D workflow

---

## §D. Operator (Claude) workflow change

### D.1 Writing a memory

When Claude observes something memorable — a user correction, a recurring failure mode, a project convention worth recording:

- **Preferred path (substrate live):**
  1. Construct the `memoryNote` body (id, type, title, body, provenance_trace_ids, confidence_weight)
  2. POST to substrate `/v2/impulses/resolve` with `memoryNote_write`
  3. Confirm the resolver's success response
  4. Do not also write the file. The next `memory-sync-tick` writes the cache.
- **Bridge path (substrate offline or `memoryNote` not yet shipped):**
  1. Write the file under `~/.claude/projects/-home-avi-documents-work-exp-repo-metabob-devbob/memory/` with full frontmatter
  2. Add `pending_sync: true` to the frontmatter
  3. Add the one-line index entry to `MEMORY.md` (as today)
  4. The next sync tick flushes the pending note to substrate and clears the flag

### D.2 Reading / recalling a memory

When Claude needs prior context:

- **Preferred path:** query substrate `/v2/impulses/resolve` with a `memoryNote` pointer (by id, type, or title prefix). Substrate response is authoritative.
- **Bridge path:** read `MEMORY.md` and the linked notes from `~/.claude/.../memory/`. Surface the fact that the read was cache-side in the response so the user can audit drift.

### D.3 Updating / superseding a memory

To replace or refine an existing memory:

- Emit a new `memoryNote` with `supersedes_id` set to the prior note's id
- Substrate marks the prior note `superseded`; the cache sync removes it from the active index but retains it for provenance

### D.4 Memory types and what NOT to save (unchanged from prior discipline)

The four types map onto `memoryNote.type`:

- `finding` (`percolation_*`) — work-session conclusions, including dates and trace references where available
- `feedback` — user preferences, conventions, "don't do X, do Y" corrections
- `reference` (`project_*`) — project-level orientation, links to canonical docs

What NOT to save (rules carry over from existing memory discipline):

- Information available by reading a current file (read the file instead)
- Speculative claims without provenance
- Anything sensitive (secrets, credentials, PII)
- Workflow-state that belongs in `openspec/changes/`, not memory

---

## §E. The override mechanism

> **As built (2026-06-16): harness hooks, not cron activities.** The two substrate-resident cron activities specced below (`memory-sync-tick`, `memory-pending-flush`) were never implemented. Their job is now done by Claude Code harness hooks defined in `.claude/settings.json` with scripts in `.claude/hooks/`:
>
> | Specced activity | As-built replacement | Direction |
> |---|---|---|
> | `memory-pending-flush` (push cache→substrate) | `substrate-memory-mirror` (PostToolUse on memory-file Write/Edit) | operator → substrate, event-driven (not 5-min poll) |
> | `memory-sync-tick` (pull substrate→cache) | `substrate-session-start` (pull substrate→**context** at session start) | substrate → operator, at session start |
> | — | `substrate-session-end` (dispatch consolidation goal) | operator → substrate, at session end |
>
> The hooks fire on real events (tool use, session lifecycle) instead of a 5-minute cron, and they inject substrate state into *context* rather than regenerating cache files — the cache is left as a static read-fallback. The conflict-handling and outage semantics below still describe the intended end-state if/when a substrate-resident sync activity is added; today, conflicts resolve substrate-authoritative simply because reads come from the substrate.

The original interim design (substrate-resident activities) is retained below for reference:

### E.1 `memory-sync-tick` (cron, every 5 minutes)

- Owning vessel: `development-vessel`
- Lifecycle trigger: `cron-dispatch` per `closure-replacement-suite` §B (cron table)
- Task summary:
  1. Pull all `memoryNote` impulses from substrate
  2. Diff against `~/.claude/projects/-home-avi-documents-work-exp-repo-metabob-devbob/memory/` (filename ↔ `memoryNote.id` via manifest)
  3. Write any new substrate-side notes to the cache (filename = `<type>_<slug>.md`, frontmatter populated)
  4. Remove any cache-side notes whose substrate `memoryNote` is `superseded` or deleted
  5. Update `MEMORY.md` index
- Output shape: `cacheSyncReport` { written, removed, conflicts }

### E.2 `memory-pending-flush` (cron, every 5 minutes, runs before E.1)

- Reads cache-side files with `pending_sync: true` frontmatter
- For each: emits `memoryNote_write`; on success, clears the flag
- Output shape: `pendingFlushReport` { flushed, failed }

### E.3 Conflict handling

When the cache and substrate disagree on a `memoryNote` body (same id, different content):

- Substrate wins. Cache is overwritten on the next tick.
- An `interventionRefused` impulse is emitted with `reason="memory-conflict"` and both bodies attached, so the operator can audit
- This is the substrate's push-away signal for memory: "the operator wrote X to the cache, but the substrate's record says Y, and the substrate's record is authoritative"

### E.4 Outage behaviour

When the substrate is unreachable for an extended period:

- Cache reads continue to work (fallback per §D.2)
- Cache writes accumulate `pending_sync: true` notes
- `memory-pending-flush` flushes them when substrate returns
- No data loss; only delay

---

## §F. Closure verification

After migration is complete:

- `validation/scripts/closure-audit.ts --without=operator-memory` MUST report green for three consecutive nightly runs. The closure-audit script tests each of the seven `(property, external_tool)` pairs — operator memory, slash-command skills, subagent dispatch, GitHub Actions CI, operator shell access, operator spec-authoring, and operator git access — against substrate-only resolvers and returns a per-pair verdict. Memory closure is one of the seven test targets.

- The specific memory-closure test: given a Claude session with `~/.claude/.../memory/` wiped, can the operator recall three known facts via substrate query alone? If yes, memory closure is provisionally green. Three consecutive nightly green runs on this test (and the other six pairs) constitute the hard closure-audit gate.

- A separate one-shot validation MUST pass: in a non-production Claude session, wipe `~/.claude/projects/-home-avi-documents-work-exp-repo-metabob-devbob/memory/`, restart, and verify recall of three known facts via substrate query alone. This is the same test as above, run once manually before the nightly runs are initiated.

- After both the manual one-shot and three nightly runs pass, memory closure (the first of the seven gaps) flips to green. Full lift-gate closure requires all seven pairs to be green for three consecutive nights.

**Self-documenting substrate:** `extract-memory-note` is the ribosome-side activity that automatically emits `finding`-type `memoryNote` impulses from `lifecycle:execution:succeeded` events. This means successful substrate activities self-document — the substrate's operational experience accumulates in its own memory without operator-side filing. Operator-emitted `feedback` and `reference` notes supplement this automatic layer, but the base of `finding` notes grows without human intervention.

---

## §G. What this change does NOT do

- Does NOT delete the operator-side cache. The cache stays as the offline-read fallback and as the surface Claude reads at session start (auto-loaded `MEMORY.md`). Removing the cache is a separate operator decision, not a closure requirement.
- Does NOT introduce a new openspec change. `memoryNote`, `memoryNote_write`, and `extract-memory-note` are all already specced in `closure-replacement-suite` §A and `substrate-closure-properties` §1. This document operationalises those specs; it does not extend them.
- Does NOT block on `memoryNote` being fully implemented. The §B bridge state IS the operating reality until shipping completes. Claude follows §D today by reading frontmatter, writing files, and marking `pending_sync` — the substrate-side flush is gated, not the operator-side discipline.
- Does NOT migrate operator-only context like `~/.claude/settings.json`, keybindings, or skill definitions. Those are operator-harness concerns, not system memory.
- Does NOT change the four memory types (`finding` / `feedback` / `reference`, plus prior heterogeneous bucket). The discipline carries through unchanged; only the destination moves.
- Does NOT touch checked tasks in any openspec change. Sequencing of `memoryNote` shipping is owned by `closure-replacement-suite` §A tasks.

---

## References

- `openspec/changes/2026-05-23-substrate-explicit-vessels/proposal.md` — `development-vessel` as the owning vessel
- `docs/SUBSTRATE.md` — substrate operational context (single-container)
- `~/.claude/projects/-home-avi-documents-work-exp-repo-metabob-devbob/memory/feedback_lift_three_state_model.md` — S2→S3 push-away framing that motivates substrate-as-source-of-truth
