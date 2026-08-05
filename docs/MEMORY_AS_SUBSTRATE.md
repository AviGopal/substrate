# Memory As Substrate

**Audience:** any agent or human who reads or writes memory while working in
this super-repo.

This document states one standing law and the mechanism that enforces it. It is
not a migration plan: the store exists, the hooks are wired, and what follows is
the behaviour a reader can expect from them.

---

## The law

> Memory about this system belongs to the system, not to the operator.

What an agent knows about the substrate — recurring failure modes, vessel
quirks, project conventions, user preferences — is *system knowledge*. The
substrate's `memoryNote` store, served by `development-vessel`, is the
authoritative record of it. The operator-side files under
`~/.claude/projects/<project-slug>/memory/` are a **derived cache**: readable
when the substrate is down, never the source of truth.

Three reasons the direction matters:

1. **Closure.** A substrate that cannot sustain its own loop without an external
   stateful resolver is not closed. Operator memory is one of the properties the
   closure audit tests; while memory lives only on the operator's disk, wiping
   that disk removes something the system depends on.

2. **Self-understanding.** When the substrate holds its own memory, what the
   operator sees is what the substrate sees. Alignment between the operator's
   model and the substrate's model becomes a checkable property rather than an
   article of faith.

3. **Push-away readiness.** The S2→S3 signal is the substrate refusing an
   operator intervention with cited evidence. Push-back about *memory contents*
   — "you wrote this to your cache, but the substrate's record supersedes it" —
   is only possible if the substrate owns the record. An operator who writes
   memory unilaterally has removed the substrate's standing to disagree.

---

## The `memoryNote` shape

`development-vessel` advertises two shapes at `/shapes` and serves both through
`POST /v2/impulses/resolve`.

**Read — `memoryNote`.** Envelope:

```json
{"impulse": {"type": "memoryNote", "limit": 500}}
```

Filters, all optional and combinable: `id`, `note_type`, `title_prefix`,
`provenance_tag`, `limit`. The response carries `body.notes` and `body.total`.

**Write — `memoryNote_write`.** Envelope — top-level `impulse`, the record under
`.note`:

```json
{"impulse": {"type": "memoryNote_write", "note": {"id": "...", "type": "...", "title": "...", "body": "..."}}}
```

A note record is `{ id, type, title, body, provenance_trace_ids?,
confidence_weight?, last_validated_at?, pending_sync?, created_at, updated_at }`.
`type` is one of `finding`, `feedback`, `reference`, `project`. Writes are an
upsert keyed on `id`; the store is a flat JSON array at
`WORKSPACE_ROOT/memory/notes.json`, written atomically via tmp-then-rename.

The resolver is deliberately a storage primitive. Anything cleverer — deciding
what is worth remembering, consolidating, superseding — belongs in activities
that call it, not in the resolver.

---

## What enforces the direction

Three Claude Code harness hooks, declared in `.claude/settings.json` with
scripts under `.claude/hooks/`. All three **fail open**: if the substrate is
unreachable, the hook no-ops and the session proceeds on the cache.

| Hook | Trigger | Direction |
|---|---|---|
| `substrate-session-start.sh` | SessionStart | substrate → context: resolves `memoryNote` and injects feedback notes plus recent findings into session context, alongside concept priors fetched through the discovery gateway |
| `substrate-memory-mirror.sh` | PostToolUse on `Write`/`Edit`/`MultiEdit` | operator → substrate: any `.md` written under the memory dir (except the `MEMORY.md` index) is mirrored as a `memoryNote_write` |
| `substrate-session-end.sh` | SessionEnd | operator → substrate: dispatches a memory-consolidation goal to goal-host so the session's learnings enter the loop |

The hooks are event-driven, not polled. The memory directory is derived from
`CLAUDE_PROJECT_DIR` — the project path with every `/` replaced by `-` — so it
follows the checkout rather than being pinned to one machine's layout.

Two consequences worth stating plainly:

- Writing a memory file is *allowed*; the mirror hook makes the substrate copy
  authoritative regardless. You do not need to choose between the two paths.
- Reading from the cache is a fallback, not a shortcut. When a fact comes from a
  cache file because the substrate was down, say so in the response so drift is
  auditable.

---

## Recall and write discipline

**To recall:** resolve `memoryNote` against `development-vessel` — by `id` when
you have one, by `title_prefix` or `note_type` when you are searching. The
substrate's response is authoritative. Fall back to `MEMORY.md` and the linked
files only when the resolve fails.

**To record:** write the note (either directly as `memoryNote_write`, or as a
file that the mirror hook forwards) with a stable `id`, a `type`, a title that
reads as a claim, and a body that carries its own evidence.

**What not to record:**

- Anything obtainable by reading a current file — read the file instead.
- Speculative claims with no provenance.
- Secrets, credentials, or PII.
- Workflow state that belongs in `openspec/changes/`.

**Teaching reach.** A `memoryNote` teaches the operator; it has no
read-at-use-time path into the substrate's own drafting. A lesson meant for the
system belongs in the concept graph, where it is recalled at prompt-build time.
Before writing any lesson, name the runtime reader that will consume it — a
lesson with no reader is an archive, and the missing reader is itself a gap.

---

## Bulk import from an operator cache

`scripts/substrate/import-operator-memory.ts`, wired as
`make -C scripts/substrate import-memory`, reconciles a cache directory into the
store. Use it to seed a fresh substrate, or to replay cache-side writes that
accumulated while the substrate was down.

- Reads every `.md` under the operator memory directory, skipping `MEMORY.md`
  and any file with an empty body.
- Types each note by frontmatter `type`, else by filename prefix: `feedback_*` →
  `feedback`, `percolation_*` / `project_*` → `project`, everything else →
  `finding`. Title comes from frontmatter `name`, else the filename stem.
- Note id is `operator-import:<filename-stem>`; confidence weight defaults by
  type (`feedback` 0.8, `finding` and `reference` 0.7, `project` 0.6).
- **HTTP path** — with `DEV_VESSEL_ENDPOINT` set, POSTs each note as
  `memoryNote_write` to `/v2/impulses/resolve`. This is the path that populates
  a running substrate.
- **Offline path** — with no `DEV_VESSEL_ENDPOINT`, writes
  `WORKSPACE_DIR/memory/notes.json` and does **not** touch a running store.
- Idempotent: upsert by id, skipping notes whose body is unchanged. It reports
  `imported` / `updated` / `skipped`.

---

## Verifying memory closure

`validation/scripts/closure-audit.ts` probes seven `(property, external tool)`
pairs — operator memory, slash-command skills, subagent dispatch, GitHub Actions
CI, operator shell access, operator spec-authoring, and push-away — and returns
a per-pair verdict.

```bash
bun run validation/scripts/closure-audit.ts --without=operator-memory
```

Memory closure is green when the substrate answers from `memoryNote` alone. The
independent confirmation is a recall test: with the operator cache directory
absent, can previously-known facts still be recalled by substrate query? If yes,
the cache is genuinely derived. If no, the cache is still load-bearing and the
gap is real regardless of what the audit prints.

---

## Scope

This law governs *system* memory only.

- It does not remove the operator-side cache. The cache is the offline-read
  fallback; deleting it is an operator decision, not a closure requirement.
- It does not cover operator-harness configuration — settings, keybindings,
  skill definitions. Those are harness concerns, not system knowledge.
- It does not make the substrate's memory a substitute for the concept graph.
  Memory records what was observed; the concept graph carries the class-grain
  lessons the substrate reads back at use time.

---

## References

- [`docs/SUBSTRATE.md`](SUBSTRATE.md) — substrate operational context.
- `repos/development-vessel/src/resolvers/memory-note.ts` — the resolver's read
  and write pointers, storage layout, and note record.
- `.claude/hooks/` — the three hook scripts and their fail-open behaviour.
