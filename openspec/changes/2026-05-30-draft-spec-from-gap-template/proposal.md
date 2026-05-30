# 2026-05-30 — draft-spec-from-gap Template (substrate-authored openspec changes)

## Motivation

Today the substrate can author **activity templates** from drift signal:
`draft-gap-closing-activity` (landed 2026-05-22) reads a
`failureModeReport` + `gapScenario`, dispatches an LLM through
`llm_completion_dispatch`, and writes a candidate template JSON to
`validation/failure-modes/proposals/`. The Thompson loop then promotes
or prunes it.

That closes the *variant* gap. It does **not** close the *spec* gap.

The openspec workflow (`openspec/changes/<date>-<slug>/{proposal.md,tasks.md}`)
is how the project schedules larger changes — not single-template
variants, but coordinated work across multiple files / vessels /
phases. As of 2026-05-30, every openspec change in the tree is
operator-authored. Two filed today
(`2026-05-30-vessel-resolve-contract-conformance` and
`2026-05-30-obsidian-vessel-concept-db-frontend`) consume signal the
substrate already has access to:

- `concept_dIRm3TC4LwUr` — concept-db /resolve handler reads
  `body?.pointer` only; impulse-wrapper callers get HTTP 400.
- `concept_dyHquRIpl8hR` — llm-resolver-vessel reads `ctx.body.prompt`
  directly; impulse-wrapper → resolved:false with parsing-shaped error.
- `concept_y-CPpfVcAhL0` — vessel_resolve_handler_dual_form (the parent
  pattern both drifts violate).

The substrate has the **evidence** for both of these openspec changes
in concept-db. What it lacks is the **template** that knows how to
group them by `gap_class`, draft a coherent proposal.md + tasks.md, and
write the pair to `openspec/changes/<date>-<slug>/`. That is the IAL
§27.S.5 gap between "substrate-authored variants" (works) and
"substrate-authored specs" (roadmap).

## Proposal

Add a seed template **`draft-spec-from-gap`** to development-vessel
that:

1. Reads N `substrateGap` impulses from concept-db filtered by a
   shared `gap_class` (variable, e.g. `resolve_contract_partial_parse`).
   Source: GET `/concepts/search?source_type=substrate_gap&gap_class=<class>&limit=<N>`.
2. Reads any cited `fix_priors` concepts so the drafter has the parent
   rule + downstream pattern context (e.g.
   `vessel_resolve_handler_dual_form` + `mcp_resolver_passthrough`).
3. Reads two structural exemplars from the openspec tree (via `fs_read`
   under `openspec/changes/<existing>/proposal.md` + `tasks.md`) so the
   LLM sees the in-tree skeleton: Motivation / Proposal / Out of Scope
   / Success Criteria / References.
4. Dispatches the draft through `llm_completion_dispatch` with a
   prompt that demands **two** markdown documents in a single JSON
   envelope: `{ "slug": "...", "proposal_md": "...", "tasks_md": "..." }`.
5. Deterministically extracts the three fields via `json_path_extract`.
6. Writes both files to
   `openspec/changes/<YYYY-MM-DD>-substrate-authored-<slug>/proposal.md`
   and `.../tasks.md` via `fs_write`. The directory date prefix is the
   execution date; the slug comes from the LLM (kebab-case, validated).
7. Emits a `specProposal` impulse summarising
   `{ change_path, gap_ids_consumed, prior_concepts, drafted_at }`.

The operator reviews the resulting `openspec/changes/...` directory.
If accepted, the change moves through the normal openspec workflow
(implementation → archive); if rejected, the operator deletes the
directory and the substrate's Thompson posterior for
`draft-spec-from-gap` takes the verifier_negative.

### Scope constraint on `fs_write`

The proposal requires fs_write to accept paths under
`openspec/changes/**`. Today `resolveFsWrite`
(`repos/development-vessel/src/resolvers/fs-write.ts`) enforces only
**workspace-root containment** (`assertInWorkspace`) — anything inside
`WORKSPACE_ROOT` is writable. No subpath allowlist exists.

Three options:

- **A. Status quo (no scoping change).** `openspec/changes/**` is
  already inside `WORKSPACE_ROOT`, so writes work. Cost: the substrate
  can also write to `repos/<vessel>/src/*`, vessel CI configs, etc. —
  a much larger blast radius than this proposal needs.
- **B. Per-resolver allowlist.** Add an optional
  `WRITE_ALLOWLIST` env (default: full workspace) parsed as a list of
  glob prefixes. When set, `assertInWorkspace` also checks
  `WRITE_ALLOWLIST.some(prefix => rel.startsWith(prefix))`. This
  spec ships a substrate-mode setting of
  `openspec/changes/,validation/failure-modes/proposals/,memory/`
  (the three paths the substrate actually authors into today).
- **C. Per-pointer scope hint.** Add an `intent: "openspec"` field on
  the `FsWritePointer` and validate scope per-intent. More expressive
  but requires every caller to pass intent, and the seed template
  declaration is the wrong place to enforce policy.

**This proposal selects B.** It is the smallest patch that gives the
operator a knob to bound substrate authoring without rewriting every
caller. The default (unset) preserves today's behavior so existing
seed templates (`harness-run-matrix`, `coverage-tick`, etc.) keep
working. The substrate's systemd unit sets the env to the three-path
allowlist; the operator can widen it if they choose.

## Out of Scope

- **Auto-merging substrate-authored changes.** The change-directory is
  written to disk and stops there. Operator review is the merge step.
  No `git add` / `git commit` of the proposal directory.
- **Implementing the proposed changes.** This template authors
  *proposals*, not implementations. The opsx:apply workflow remains
  operator-driven for substrate-authored specs until S2 maturity
  lets the substrate apply its own proposals.
- **Generalizing to operator-authored gap classes.** First-class
  consumer is `substrateGap` impulses minted by the conformance probe
  (`2026-05-30-vessel-resolve-contract-conformance`) and equivalent
  drift detectors. Operator-curated gap lists are out of scope; the
  operator already writes proposals by hand for those.
- **Modifying existing openspec changes.** This template only creates
  new change directories. Updates to in-flight specs remain operator
  work.
- **Concept-db queries beyond the two endpoints used** (`/concepts/search`
  + `/concepts/:id`). Sequence walks, neighbor expansions, and stats
  reads are nice-to-haves; the v1 drafter does single-hop reads only.

## Success Criteria

1. `repos/development-vessel/src/seed/draft-spec-from-gap.ts` exists,
   is exported from `src/seed/index.ts`, and lands in `SEED_TEMPLATES`.
2. `fs-write.ts` honors `WRITE_ALLOWLIST` env; default behavior
   unchanged when unset; lint + per-resolver tests green.
3. `bun run lint` clean (typecheck + shape-dispatch agreement).
4. `bun test` clean — per-template test validates the 8-task graph;
   per-resolver test for the new fs-write allowlist branch.
5. `bun run cli seed-templates` uploads the template to activity-api
   without 403.
6. Dispatched via `run_goal` with a goal targeting concept-db drift
   (concepts `concept_dIRm3TC4LwUr` + `concept_dyHquRIpl8hR`), the
   substrate writes a real `openspec/changes/2026-05-30-substrate-authored-<slug>/`
   directory with proposal.md + tasks.md that name the two evidence
   concepts and a coherent fix proposal.
7. Mint a `vessel_construction_pattern` concept
   (`substrate_authored_openspec_change`) describing the
   self-scheduling pattern so future drafters can compose on it.

## References

- `concept_y-CPpfVcAhL0` — vessel_resolve_handler_dual_form (parent
  rule for the first target gap class)
- `concept_dIRm3TC4LwUr` — concept-db drift evidence
- `concept_dyHquRIpl8hR` — llm-resolver-vessel drift evidence
- `openspec/changes/2026-05-22-failure-mode-autonomous-loop/proposal.md`
  — the variant-drafting precedent this proposal extends
- `openspec/changes/2026-05-30-vessel-resolve-contract-conformance/proposal.md`
  — produces the `substrateGap` impulses this template consumes
- `openspec/changes/2026-05-30-obsidian-vessel-concept-db-frontend/proposal.md`
  — structural exemplar (Motivation / Proposal / Phases / Out of Scope
  / Success Criteria / References)
- `repos/development-vessel/src/seed/draft-gap-closing-activity.ts`
  — task-graph template the new seed mirrors
- `repos/development-vessel/src/resolvers/fs-write.ts` — resolver to
  extend with WRITE_ALLOWLIST
- IAL §27.S.5 — post-lift agenda: substrate-authored propose-spec
  pipeline
