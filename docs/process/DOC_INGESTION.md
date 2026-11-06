# Doc ingestion — the contract that governs every document

`docs/**` is a **runtime input**, not prose about the runtime. Each document is split into
sections and written into concept-db as embedded concepts, where the substrate's own
code-authoring path reads them back while it drafts a change. A document that no reader
consumes is an archive. The intent is that every principle in this tree is read where a
choice is made.

The ingester is `scripts/substrate/ingest-docs-as-concepts.ts`, run on a timer. The reader
is `consultPrinciples` in `repos/development-vessel/src/resolvers/feature-compose.ts`,
called when the drafter builds its prompt.

## What gets ingested

The walk covers `docs/**`, the root `CLAUDE.md`, and each `repos/<vessel>/CLAUDE.md` and
`repos/<vessel>/README.md` — the same watched set the alignment scan uses. An `archive/` directory under `docs/`
would be excluded from the walk, as are `node_modules`, `.git`, `dist`, and any dotted entry.
Only `.md` files are read.

A document is split into sections on level-2 and level-3 headings (`##` and `###`). Text
before the first such heading becomes a section titled `(intro)`. Each section's body is
truncated to 2400 characters before it is sent, so material past that point in a very long
section never reaches a reader.

## The 200-character floor

A section whose body is shorter than 200 characters is **never emitted**. It is not
created, not updated, and not counted as seen.

The consequence is the trap worth internalising: trimming an existing section below the
floor does not shrink its concept — it silently stops the update, and the previous, longer,
superseded text survives in the store and keeps being recalled. The section looks corrected
in git and is uncorrected in the substrate. If a section genuinely has less to say, expand
the explanation past the floor rather than cutting it to a stub, or delete the heading
outright so the reap can retract it.

## `section_key` — the identity of a concept

A section's identity is `"<relpath>#<slug(heading)>"`, where the slug lowercases the
heading, replaces every run of non-alphanumeric characters with a hyphen, trims leading and
trailing hyphens, and truncates to 60 characters. The relative path is repository-relative,
for example `docs/architecture/SUBSTRATE_AS_SOFTWARE.md#the-execution-walk`.

Everything downstream keys on this. The ingester's local manifest maps `section_key` to
`{hash, id}`, so a section is created once and thereafter updated in place: unchanged
sections are skipped, changed sections are `PATCH`ed against the same concept id, and a
`PATCH` against a concept that has disappeared falls back to a create. There is exactly one
concept per `section_key` and never a duplicate.

One caveat rides on the update path: a `PATCH` refreshes the concept's content but does not
re-embed it, so a heavily reworded section keeps its prior embedding vector until a
re-embed happens. The text a reader is handed is always current; the vector that decided
whether the reader saw it may lag.

## Two shapes, two readers

Path decides shape. A section under `docs/architecture/` ingests as
`shape=architecturePrinciple`; every other watched document ingests as `shape=docSection`.
All of them carry `source_type=doc_expectation` and a pointer recording the document path,
the heading, and the `section_key`.

The reader filters on neither. `consultPrinciples` runs when the drafter builds its prompt
for a code change, and at no other point:

- It reduces the spec to its three longest salient words, with stopwords and path
  fragments dropped, and searches concept-db with them. If that returns nothing it retries
  with two words, then one.
- The search carries no shape or `source_type` filter, so any concept in the store can
  match, whatever its shape or origin. It asks for the **top 4**.
- Concepts of shape `rejected_approach` are dropped from the result, so fewer than four can
  remain. Each one left is pasted into the decomposition prompt that authors the change,
  with its id, shape and `source_type`, its summary, and its content truncated to 400
  characters.

So a section of either shape is an input to the drafter, competing with every concept in
the store for four slots. The shape records where a section came from; it does not route
the section to a different reader.

The consult is best-effort: a failed or slow search returns an empty block and the drafter
proceeds ungrounded rather than failing. A principle that never ingests therefore produces
no error anywhere — only slightly worse code, indefinitely.

## Retraction, and why it refuses

Create, update, and skip alone would make the surface append-only: a section that is
renamed, split, shrunk below the floor, or whose file is deleted or moved keeps its concept
forever, because the `section_key` changed and a changed key simply mints a new concept
beside the old one. That is actively harmful: the stale section competes with its own
replacement for one of the drafter's four slots.

So after ingest, any manifest key not re-seen this run is deleted from concept-db and
dropped from the manifest. The reap is deliberately timid, because deleting live
expectations on a transient fault is far worse than carrying a stale one a while longer,
and a partial filesystem read is indistinguishable from a mass deletion. Three guards each
abort the reap rather than proceed:

- a run forced to a named subset of documents reaps only within the files it was told to
  read, since it never looked at the others;
- a file that could not be read on this run keeps all of its sections;
- a reap set exceeding a quarter of the pre-existing manifest is refused wholesale, which
  is exactly what a truncated walk or an emptied `docs/` produces. An empty document list
  is refused outright.

A refusal is reported as its own outcome, distinct from a clean run with nothing to reap:
eviction was due and did not happen, which is a condition to act on.

## Consequences for authors

**Headings under `docs/architecture/` are a frozen interface.** The heading text is the
back half of the `section_key`, so renaming one retires a concept and mints a different one
with a fresh embedding and no accumulated usage — and if the restructure is large enough to
trip the fraction guard, the reap is refused and the stale concept survives *beside* its
replacement, both eligible for the drafter's top four. Change bodies freely; treat the
headings as the stable key they are.

The rest follows from the same contract:

- Write for a reader at the moment of use, not for a browser of the tree. A section is
  retrieved by a search on a few words of a change spec, in isolation from its neighbours,
  so it must carry its own context.
- Keep every section past 200 characters, including after an edit that removes material.
- Keep the load-bearing claim early in the section — the body is truncated at 2400
  characters and the excerpt handed to the drafter is truncated at 400.
- Say what a reader can expect to be true, with no dated status, version stamp, or progress
  framing. A dated measurement, once ingested, is recalled as a standing claim long after
  the measurement stopped holding.
