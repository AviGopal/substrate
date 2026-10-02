# Substrate as Git Author — capability spec

## ADDED Requirements

These requirements install the substrate's role as a constrained git author. They cover identity, scope discipline, the gate-commit-push-PR resolver chain, the productivity and snapshot activities, the operational guarantees enforced at both the resolver layer and the git server, and the portability boundary across substrates.

### Requirement: Substrate git author identity is H2-derived

The substrate SHALL use an H2-derived ed25519 keypair (per `2026-04-26-security-hardening-findings` §H2) as its git author identity. The git author email SHALL be `<vessel-id>@substrate.local` where `vessel_id == base32(multihash(SHA-256, pubkey))`. The same keypair SHALL sign every substrate-authored commit. Commits authored by the substrate SHALL be verifiable as substrate-authored via `git log --show-signature`.

#### Scenario: Substrate commit carries H2 signature
- **WHEN** the substrate emits a `substrate_commit` impulse and the gate passes
- **THEN** the resulting git commit is signed under the H2 keypair and `git log --show-signature` resolves to the substrate's registered pubkey via the discovery-vessel registry

#### Scenario: Author email matches vessel-id
- **WHEN** a substrate-authored commit is inspected
- **THEN** the author email equals `<vessel-id>@substrate.local` with the same `vessel-id` as the H2-registered pubkey hash

#### Scenario: Commit not signed by H2 keypair rejected at PR time
- **WHEN** a PR is opened against `dev` containing a commit purporting substrate authorship but signed with a key other than the registered H2 keypair
- **THEN** the operator review process flags the signature mismatch and the merge is refused

### Requirement: Substrate writable branch scopes are enumerated

The substrate's writable branch namespaces SHALL be exactly:
- `substrate/<vessel-id>/<purpose>` — per-vessel scratch, auto-pruned after a configured TTL (default 30 days)
- `substrate-authored/<date>` — substrate-batched work intended for operator review (PR base)
- `substrate-snapshots/<date>` — concept-db exports, posterior snapshots, attribution exports

The `substrate_commit` and `substrate_push` resolvers SHALL refuse operations on any other branch.

#### Scenario: Scratch branch accepted
- **WHEN** the substrate calls `substrate_push` with `branch: "substrate/abc123/test"` matching its own vessel-id
- **THEN** the push proceeds

#### Scenario: Operator branch rejected
- **WHEN** the substrate calls `substrate_push` with `branch: "dev"` or `branch: "main"`
- **THEN** the resolver rejects the call before reaching the git server

#### Scenario: Wrong-vessel scratch branch rejected
- **WHEN** the substrate with `vessel_id: A` calls `substrate_push` with `branch: "substrate/B/test"`
- **THEN** the resolver rejects the call — substrates SHALL NOT push to other substrates' scratch branches

### Requirement: `substrate_commit` resolver contract

The `substrate_commit` resolver SHALL accept `{ files: string[], message: string, scope: 'scratch' | 'authored' | 'snapshot', authored_by_trace_id: string }`. It SHALL stage the files, run `substrate_commit_gate` over them, sign the commit with the H2 keypair, and commit on the current branch only if the gate passes. It SHALL emit a `gitCommitResult` impulse with the commit SHA on success or the gate-failure reason on refusal.

#### Scenario: Gate pass produces signed commit
- **WHEN** `substrate_commit` is called with files passing lint + tests + comprehensibility
- **THEN** a signed commit is created and `gitCommitResult.status = "success"` with the commit SHA

#### Scenario: Gate fail refuses commit
- **WHEN** `substrate_commit` is called with a lint-failing file
- **THEN** no commit is created and `gitCommitResult.status = "refused"` with `reason = "gate_failed.lint"`

#### Scenario: Out-of-scope scope value rejected
- **WHEN** `substrate_commit` is called with `scope: "main"` or any value outside `'scratch' | 'authored' | 'snapshot'`
- **THEN** the resolver rejects the call without staging

### Requirement: `substrate_push` resolver contract

The `substrate_push` resolver SHALL accept `{ branch: string }`. It SHALL refuse `--force` pushes. It SHALL verify the branch matches a substrate writable scope (per the enumerated branches requirement above) before invoking git. It SHALL emit a `gitPushResult` impulse.

#### Scenario: Normal push accepted
- **WHEN** `substrate_push` is called with a valid scratch branch and the local branch is ahead of the remote
- **THEN** the push proceeds and `gitPushResult.status = "success"`

#### Scenario: Force push rejected
- **WHEN** `substrate_push` is called with any flag or option semantically equivalent to `--force` or `--force-with-lease`
- **THEN** the resolver rejects the call and emits `gitPushResult.status = "refused"` with `reason = "force_push_forbidden"`

### Requirement: `substrate_open_pr` resolver contract

The `substrate_open_pr` resolver SHALL accept `{ source_branch, target_branch: 'dev' | 'main', title, body }`. It SHALL refuse target branches outside `'dev' | 'main'`. The PR body SHALL cite trace IDs and concept IDs per the comprehensibility discipline (concept_Q3lwHwujiwkj); the resolver SHALL refuse PRs with empty bodies or bodies missing both trace and concept citations. It SHALL emit a `gitPrResult` impulse.

#### Scenario: Compliant PR opened
- **WHEN** `substrate_open_pr` is called with `target_branch: "dev"` and a body citing at least one trace id and one concept id
- **THEN** the PR is opened via `gh pr create` and `gitPrResult.url` carries the PR URL

#### Scenario: Citation-empty PR refused
- **WHEN** `substrate_open_pr` is called with a body containing neither trace nor concept ids
- **THEN** the resolver refuses with `reason = "citations_required"`

#### Scenario: Substrate cannot self-approve
- **WHEN** the substrate, after opening a PR, attempts to add a review approval via any code path
- **THEN** the operation is refused (substrate identity carries no review-approve permission)

### Requirement: `concept_db_snapshot` resolver contract

The `concept_db_snapshot` resolver SHALL export the current concept-db state to structured JSON with per-concept signatures. The JSON SHALL include concept ids, bodies, links, and a deterministic per-concept signature (SHA-256 over the canonical-JSON serialisation of each concept record). The output path SHALL be `validation/concept-db-snapshots/<vessel-id>-<date>.json`.

#### Scenario: Snapshot is deterministic for unchanged concept-db state
- **WHEN** `concept_db_snapshot` is invoked twice with no concept-db mutations between invocations
- **THEN** the two output files are byte-identical

#### Scenario: Path discipline enforced
- **WHEN** `concept_db_snapshot` is invoked
- **THEN** the output is written under `validation/concept-db-snapshots/` matching the prescribed filename pattern

### Requirement: `substrate_commit_gate` resolver contract

The `substrate_commit_gate` resolver SHALL be a pre-commit verifier composing lint, tests, and `comprehensibility_check` (concept_uXRPTRZPCKFS) over the staged files. It SHALL refuse the commit on any failure with a structured `reason` field naming the failing sub-check. The substrate SHALL NOT have any code path that bypasses the gate.

#### Scenario: Lint failure refuses commit
- **WHEN** the gate is invoked over a file that fails lint
- **THEN** the gate emits `status = "refused"` with `reason = "gate_failed.lint"` and the parent `substrate_commit` refuses

#### Scenario: Test failure refuses commit
- **WHEN** the gate is invoked over a file change that breaks an existing test
- **THEN** the gate emits `status = "refused"` with `reason = "gate_failed.tests"`

#### Scenario: Comprehensibility floor refuses commit
- **WHEN** the gate is invoked over a newly-authored template scoring below the comprehensibility floor (default 0.6)
- **THEN** the gate emits `status = "refused"` with `reason = "gate_failed.comprehensibility"`

### Requirement: `commit-authored-template` activity contract

The `commit-authored-template` activity SHALL be a seed activity with `input_shapes: [authoredActivityCandidate]` and `output_shapes: [gitPrResult]`. It SHALL compose `substrate_commit_gate` + `substrate_commit` (scope `authored`) + `substrate_push` + `substrate_open_pr` (target `dev`). The candidate template SHALL be written under `repos/development-vessel/src/seed/proposed/<vessel-id>/<date>/<id>.ts`. The activity SHALL NOT add an entry to `SEED_TEMPLATES` directly; only operator-merged PRs may modify `SEED_TEMPLATES`.

#### Scenario: Drafter success ends in PR
- **WHEN** `draft-activity-from-pattern` produces a comprehensible candidate and dispatches `commit-authored-template`
- **THEN** a PR is opened against `dev` containing the candidate file under `proposed/<vessel-id>/<date>/`

#### Scenario: Substrate cannot edit SEED_TEMPLATES
- **WHEN** `commit-authored-template` is invoked with `files` including a path under `repos/development-vessel/src/seed/index.ts` (or any registry-aggregating file)
- **THEN** the activity refuses and the operator must hand-edit the registry on merge

### Requirement: `publish-substrate-snapshot` activity contract

The `publish-substrate-snapshot` activity SHALL run on a boredom cadence (default nightly), bundling `concept-db-snapshot`, posterior snapshot, and attribution exports into a single commit on `substrate-snapshots/<date>`. If publish fails for any reason, the activity SHALL emit a critical `substrateGap` impulse so the next boredom tick surfaces the durability gap.

#### Scenario: Nightly snapshot publishes
- **WHEN** the boredom tick triggers `publish-substrate-snapshot` and the gate passes
- **THEN** one commit lands on `substrate-snapshots/<date>` containing the three artifact families and `gitPushResult.status = "success"`

#### Scenario: Publish failure raises substrateGap
- **WHEN** the snapshot publish fails (e.g. network, gate, or push refusal)
- **THEN** a `substrateGap` impulse with `severity: "critical"` is emitted describing the failure

### Requirement: `propose-spec-from-recurring-gap` activity contract

The `propose-spec-from-recurring-gap` activity SHALL detect recurring substrateGap patterns (e.g. heartbeat starvation + silent task failure, concept_dD1udnb-sQnD + concept__8RiPOP7wP5A), compose `draft-spec-from-gap` + `substrate_commit` (scope `authored`) + `substrate_open_pr`, and produce an openspec proposal as a PR under `openspec/changes/substrate-authored-<date>-<slug>/`. The PR body SHALL cite the recurring gap impulse ids and the concept ids of the gap classes.

#### Scenario: Recurring gap produces openspec PR
- **WHEN** the substrate observes ≥3 instances of a single gap class across distinct traces and dispatches `propose-spec-from-recurring-gap`
- **THEN** a PR opens against `dev` containing `openspec/changes/substrate-authored-<date>-<slug>/` with proposal.md, tasks.md, and a spec delta

#### Scenario: Substrate cannot bypass openspec strict validation
- **WHEN** the candidate proposal fails `openspec validate --strict`
- **THEN** the gate refuses and no PR is opened

### Requirement: Operational guarantees enforced at two layers

The following guarantees SHALL be enforced at BOTH the resolver layer AND the git server (GitHub branch protection):
- Substrate cannot push to `main` or `dev`
- Substrate cannot `--force` push
- Substrate cannot commit lint-failing code
- Substrate cannot bump submodule pointers in super-repo `main`
- Substrate cannot delete branches it did not create
- Substrate cannot self-approve PRs
- Operator can revert any substrate commit; substrate cannot revert operator commits

#### Scenario: Resolver-layer block on main
- **WHEN** any substrate code path attempts to invoke `substrate_push` with `branch: "main"`
- **THEN** the resolver refuses before reaching git

#### Scenario: Server-layer block on main (defence in depth)
- **WHEN** the substrate identity (somehow bypassing the resolver) attempts a `git push origin main`
- **THEN** the GitHub branch protection rule rejects the push with `protected branch hook declined`

#### Scenario: Submodule pointer bump in super-repo main refused
- **WHEN** `substrate_commit` is called with files including super-repo submodule pointer changes and target scope would land on `main`
- **THEN** the resolver refuses

#### Scenario: Operator revert succeeds
- **WHEN** the operator runs `git revert <substrate-commit-sha>` on a branch they control
- **THEN** the revert proceeds; the substrate identity has no permission to block it

### Requirement: Within-substrate durability across container lifetimes

On boot, the substrate SHALL fetch its own `substrate-snapshots/<date>` and `substrate-authored/<date>` branches and reimport concept-db state from the most recent snapshot. Trace store and Thompson posteriors SHALL restart fresh (each container develops its own selection bias). Concept knowledge persists across container lifetimes via the snapshot import path.

#### Scenario: Concept-db restored after container restart
- **WHEN** a substrate container is destroyed and a new one boots with the same H2 keypair
- **THEN** the new container's concept-db contains all concepts present in the most recent `substrate-snapshots/<date>` snapshot

#### Scenario: Posteriors restart fresh
- **WHEN** a substrate container is destroyed and a new one boots
- **THEN** Thompson α/β counters are reset; the new container does not import posteriors from snapshots

### Requirement: Cross-substrate sharing via operator-merged dev

Substrate-authored templates SHALL be sharable across substrates exclusively via operator-merged PRs into `dev`. A substrate pulling from `dev` SHALL inherit other substrates' merged templates as candidates with fresh Thompson posteriors. Substrates SHALL NOT share posteriors directly.

#### Scenario: Substrate-B inherits substrate-A's merged template
- **WHEN** substrate-A's `commit-authored-template` PR is merged to `dev` and substrate-B pulls `dev`
- **THEN** substrate-B's seed pipeline registers the template with α = β = 1 (uniform prior)

#### Scenario: Posteriors are not shared
- **WHEN** substrate-A has accumulated α=50, β=3 on a template and substrate-B inherits the template
- **THEN** substrate-B starts with α=β=1, not α=50, β=3

### Requirement: Cross-substrate federation gated on H1-H4

Cross-substrate federation without an operator intermediary SHALL depend on H1-H4 hardening. Substrate-A's commit signatures SHALL be verifiable by substrate-B via the discovery-vessel pubkey registry. Substrate-authored concepts SHALL reach canonical status only after ≥N substrates have ratified via signed `concept_link` operations (H4 quorum); below the quorum threshold, concepts remain in proposal status.

#### Scenario: Signature verification across substrates
- **WHEN** substrate-B inspects a commit authored by substrate-A
- **THEN** substrate-B queries the discovery-vessel pubkey registry for substrate-A's pubkey and verifies the H2 signature

#### Scenario: Below-quorum concept stays in proposal status
- **WHEN** substrate-A authors a concept and only substrate-A has ratified
- **THEN** the concept's canonicalization status is `proposal` and downstream substrates treat it as non-canonical

#### Scenario: At-quorum concept becomes canonical
- **WHEN** ≥N substrates have signed `concept_link` ratification operations for substrate-A's authored concept
- **THEN** the concept's canonicalization status flips to `canonical` and downstream substrates may rely on it
