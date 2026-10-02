# Merge mechanism — pivot from operator-script to substrate-composed activity

**Date:** 2026-06-01
**Driver:** operator goal "Assist the system running within the substrate
container run activities to implement the IAL ... mechanism to merge into
dev and push ... no canonical paths, durable, show composition."
**Outcome of this turn:** an operator-side `publish-substrate-authored.ts`
script was authored, then deleted in response to the refined goal. The
substrate-citizen design is articulated below. The infrastructure gap that
blocks immediate end-to-end demonstration is identified and the next
iteration's work is queued.

## Why "operator script" was the wrong shape

A standalone Bun script run on the operator's machine that scans
`scripts/substrate/workspace/staging/`, mirrors files into the super-repo
working tree, and opens a PR works mechanically. It fails the design
constraint two different ways:

1. **Path canonization.** The script needs to know where each artifact
   class lands. Even the most permissive version (allowed-prefix
   allowlist) hardcodes which prefixes are legitimate. When a substrate
   authors a new vessel under `repos/<new-vessel>/`, the script doesn't
   need to change — but it still owns the routing decision. The substrate
   doesn't.
2. **Composition deficit.** The script is monolithic. The substrate
   cannot inspect, extend, or compose it. The publication step is
   structurally opaque to the substrate the same way an external CI job
   would be. The substrate's authoring loop emits an artifact and waits
   for something it cannot observe to land it in git.

The refined design routes through substrate-side activities composed
from substrate-side resolver primitives. The substrate's own authoring
pipeline emits an `authoredArtifactCandidate` impulse; a downstream
`publish-substrate-authored-artifact` activity composes the publication
into the trace store. Provenance, attribution, and failure-mode
classification all flow through the existing Thompson Sampling +
concept-db machinery without an external bridge.

## What the composition looks like

Three new dev-vessel resolvers (three-place rule per
`repos/development-vessel/CLAUDE.md`):

1. `git_branch_create` — `{ branch_name: string, base?: string }` →
   `branchCreateResult`. Refuses branch names not matching the
   substrate-allowed-prefix env var (default
   `^(substrate-authored|substrate)/.*$`). The pattern is configurable
   via env; no hardcoded vessel name.

2. `git_push` — `{ branch: string, remote?: string }` → `gitPushResult`.
   Always rejects `--force`. Refuses any push to `main`, `dev`, or
   `master`. Refuses push from a substrate-identity context to any
   branch the substrate-identity does not own.

3. `gh_pr_create` — `{ source_branch, target_branch, title, body }` →
   `prCreateResult`. Wraps `gh pr create`. Refuses auto-merge. Body must
   carry a `Substrate-Authored-By:` provenance line.

One new activity composition seeded into activity-api (NOT inlined in
dev-vessel source; lives as a template fetched by id per the
`activity-api as source of truth` discipline):

```
publish-substrate-authored-artifact
  inputShapes: [authoredArtifactCandidate]
  outputShapes: [publicationResult, gitPushResult, prCreateResult]
  variables: [target_path, target_branch, commit_message, pr_title, pr_body]
  tasks:
    1. git_status (verify clean baseline)
    2. fs_write (artifact body to target_path)
    3. git_branch_create (target_branch)
    4. git_add (target_path)
    5. git_commit (commit_message)
    6. git_push (target_branch)
    7. gh_pr_create (target_branch → dev, pr_title, pr_body)
```

Every input including `target_path` flows in as a variable. The activity
itself canonizes nothing. A future substrate-authored vessel publishes
to `repos/<that-new-vessel>/...` by setting that variable; no script,
spec, or resolver edit needed.

## Concept-db / impulses / activities / variants interaction

The substrate's full authoring loop becomes:

1. **Concept-db priors** seed the drafter's pruned vocabulary. The
   drafter's LLM task cites `cited_concept_ids` from concept-db when it
   produces an `authoredActivityCandidate`.
2. **Authoring activity** (`draft-activity-from-pattern` or
   `draft-gap-closing-activity`) emits `authoredArtifactCandidate` as
   its terminal impulse, body containing destination path and content.
3. **Comprehensibility + convergent-validity check** gate the candidate
   before publication. A candidate that fails either is rejected with
   `verifier_negative.comprehensibility_below_floor` or
   `verifier_negative.divergence_above_threshold`.
4. **Publication composition** (above) dispatches when the gate clears.
   Every resolver call goes through the existing trace recorder; the
   commit SHA, PR URL, and target path land in the trace.
5. **Operator review → merge** advances dev. Once landed, a
   `lifecycle:registry:change` lifecycle event fires the
   ribosome which inspects the merged template, increments the
   relevant Thompson posterior, and updates the variant family in
   activity-api.
6. **Variant evolution.** When the drafter authors a v2 of an existing
   template (same name, same outputShapes), the activity-api stores it
   as a variant of the family. Thompson Sampling between the two
   eventually promotes the higher-success variant. The drafter's
   posterior reflects which prior pattern → merged-and-promoted v2
   succeeded; concept-db's per-concept usage_stats reflect which cited
   concepts correlate with successful authoring.

The closed loop is: concept-db priors → drafter → comprehensible
candidate → publication composition → operator merge → ribosome
extraction → variant promotion → drafter's posterior update → next
drafter cycle uses the updated posterior. No path is canonical; every
contract is impulse-shaped; every step composes from primitives.

## Infrastructure gap that blocks immediate demonstration

The substrate container at `substrate-live` has **no writable git
checkout**. The super-repo is bind-mounted RO at `/home/avi/...`;
`/workspace` has no `.git` directory; the existing `git_add` /
`git_commit` / `git_status` resolvers can be invoked but have nothing
to act on. Confirmed via `docker exec substrate-live git status` from
both `/workspace` and the host-mount paths — both fatal.

The composition above presupposes the substrate can stage, commit, and
push from a writable checkout. Until that exists, the new resolvers
can't be exercised end-to-end. The wiring needed:

1. **Writable clone in the container.** Either at startup via
   `scripts/substrate/entrypoint.sh` cloning the super-repo into
   `/workspace/git/super-repo`, or via a separate bind-mount RW.
   `/workspace/git/` is the candidate path since `/workspace` is
   already the substrate-RW volume.
2. **Substrate-side git identity.** Pre-H2 this is operator credentials
   mounted into the container (deploy key or gh token). Post-H2 it's an
   ed25519 keypair derived from the substrate's vessel_id signing
   commits, with GitHub-side commit signature verification.
3. **gh CLI** in the container image so `gh_pr_create` can dispatch.
   Check whether `Dockerfile.substrate` already installs it; add if not.
4. **Branch-protection rule** server-side that refuses any push to
   `dev` / `main` from the substrate's git identity. Until then, the
   substrate-side `git_push` resolver enforces the same constraint
   client-side (which is necessary but insufficient under a compromised
   substrate).

These four items are the actual prerequisites for the composition above
to run end-to-end. They are also the implementation of the
`substrate-as-git-author` spec's Phase 1 — except step (2) is a
known-incomplete bridge (operator credentials) until H2 ships.

## Queued for next iteration

In order:

1. Wire up writable super-repo clone in substrate startup
   (entrypoint.sh + Dockerfile.substrate as needed). Decide on
   bind-mount-RW vs clone-on-startup based on update cadence (operator
   pushes happen continuously; clone-on-startup means substrate sees a
   stale base — bind-mount-RW into a separate-path clone is the right
   default).
2. Mount operator's git credentials into the container as the pre-H2
   identity. Document the security caveat clearly. File the H2 keypair
   work as a blocker on full Phase 1 of substrate-as-git-author.
3. Add the three new resolvers (`git_branch_create`, `git_push`,
   `gh_pr_create`) to dev-vessel via the three-place rule. Add the
   substrate-allowed-branch-prefix env var.
4. Seed the `publish-substrate-authored-artifact` activity composition
   into activity-api via `scripts/substrate/seed-templates` or
   equivalent. The template's variables encode the destination path;
   no canonical path lives in the resolver or the activity body.
5. Test end-to-end: dispatch the composition against an
   `authoredArtifactCandidate` from the existing
   `draft-gap-closing-activity` output (10 proposals already on disk in
   `scripts/substrate/workspace/proposals/`). PR opens against dev;
   operator reviews; merge; ribosome extracts.

## What was committed in this turn

Only this finding. No resolver code, no script, no activity template.
The previous attempt's `publish-substrate-authored.ts` was deleted —
the operator-script architecture was the wrong design.

## What was learned

The pivot exposed an implicit assumption in the substrate-as-git-author
spec (`openspec/changes/2026-06-01-substrate-as-git-author/`, commit
`7195c40c`): that the substrate has a writable git context. The spec's
Phase 1 acceptance criterion ("substrate can commit a single authored
file to its scratch branch and push") cannot be met until the container
wiring above is in place. That criterion should be split into two: an
"infrastructure" sub-phase that establishes the writable clone +
substrate identity, then a "resolver" sub-phase that ships the three
primitives. The spec's committable-artifacts table also needs
revision per the no-canonical-paths constraint — the rows are
*examples*, not contracts. The composition decides the path; the
resolvers only enforce the sandbox boundary.
