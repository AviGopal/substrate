## ADDED Requirements

### Requirement: Every landing route registers an attempt before mutating
Each code path that creates a commit or pushes to a watched branch SHALL resolve an
`attemptIntent` impulse before it writes to the working tree. The intent SHALL carry:
`attempt_id` (unique, stable across retries of the same landing), `authoring_execution_id`
(the walk execution that produced the change, not a synthetic id), `route` (the landing
route name), `gap_id` (nullable), `repo`, `touched_files`, `predicted` (the check ids
expected to flip to `pass` and the check ids that must remain `pass`), and
`pre_snapshot_id` (the `stateSnapshot` taken before mutation).

#### Scenario: A compose landing registers first
- **WHEN** `feature_compose` lands a change through the mitosis cutover
- **THEN** an `attemptIntent` exists whose `pre_snapshot_id` names a snapshot with an
  earlier timestamp than the commit
- **AND** its `authoring_execution_id` resolves to an `execution` row

#### Scenario: A retry reuses the attempt
- **WHEN** a landing route retries the same landing after a transient failure
- **THEN** it reuses the existing `attempt_id` rather than registering a second attempt

### Requirement: Attempt identity travels in the commit
A registered landing SHALL write its `attempt_id` into the commit as an `Attempt-Id:`
trailer. The ledger SHALL resolve landings by trailer, not by sha alone, so a rebase
before push (which changes the sha) keeps the landing attached to its attempt; the ledger
SHALL record every sha observed for the attempt.

#### Scenario: The cutover rebases before pushing
- **WHEN** the mitosis cutover rebases a registered commit onto a moved `origin/dev`
- **THEN** the pushed sha differs from the committed sha
- **AND** the ledger attaches both shas to the same `attempt_id`

### Requirement: Git-layer registration covers routes that do not cooperate
Every git repository writable inside the substrate container SHALL run a container-wide
hook set (installed at bootstrap through the system git configuration) that reports each
new commit and each ref update to the ledger. A commit without an `Attempt-Id:` trailer,
or with a trailer naming no registered attempt, SHALL be recorded `unaccounted` at commit
time. The hooks SHALL record and never refuse, and SHALL use hook points that
`--no-verify` does not skip (`post-commit`, `reference-transaction`).

#### Scenario: An LLM tool step commits through a shell
- **WHEN** a walk's tool fallback runs `git commit` and `git push` through a shell
  resolver
- **THEN** the commit is recorded `unaccounted` at commit time with its repository,
  author and subject
- **AND** the commit and push are not refused

#### Scenario: A repository already has its own hooks
- **WHEN** a repository has an active hook in its own hooks directory or configuration
- **THEN** the ledger hook runs that hook as well, and passes on its exit status wherever
  git would have acted on it

#### Scenario: A hook cannot reach the ledger
- **WHEN** the ledger is unreachable during a commit
- **THEN** the commit completes and the hook appends the event to a local spool that is
  delivered when the ledger is reachable

### Requirement: Shell-driven commits carry the dispatching execution
Shell-spawning executors SHALL export the dispatching execution id to every shell they
spawn. Every executor that spawns a shell process on behalf of a walk step (the local-tools
shell resolvers and the `bash` host of the embedded IAS executor) SHALL export the
dispatching execution id as `SUBSTRATE_EXECUTION_ID` into the spawned environment, and the
git hooks SHALL record it on each commit and ref event. The ledger SHALL treat any
execution named on a landing event, accounted or not, as an execution that produced a
landing.

#### Scenario: A tool-fallback commit is linked to its execution
- **WHEN** a walk's tool fallback commits through a shell resolver
- **THEN** the ledger event for that commit carries the walk's execution id
- **AND** that execution is recorded as having produced an unaccounted landing

### Requirement: Registration failure does not block the landing
A route SHALL proceed with its landing when registration fails or times out, and SHALL mark
the resulting landing `unaccounted` by recording the landed sha with `attempt_id: null`
and the registration error. A landing marked `unaccounted` SHALL NOT be eligible for
settlement credit.

#### Scenario: Registration is unreachable
- **WHEN** `attempt_register` returns a structured error during a cutover
- **THEN** the cutover completes
- **AND** the landed sha is recorded as `unaccounted` with the error text

### Requirement: Unaccounted landings are detected and filed
An `unaccounted_landing_scan` resolver SHALL ingest the hook spool into the ledger and
report which commits have no `attemptIntent`. The scan SHALL be free of side effects outside
its own idempotent ledger records: it SHALL NOT delete spool files and SHALL NOT write gaps,
because a resolver may be executed during compose verification and a draft's side effects
must never reach the live gap store. The attempt sweep SHALL file one `substrateGap` per
unaccounted commit whose sha is a hex commit id, naming the sha, author, subject and
repository. The scan SHALL report the commits it could not evaluate separately from the
commits it evaluated.

#### Scenario: A direct commit bypasses registration
- **WHEN** a commit lands on a watched branch without any route registering it
- **THEN** within one scan cycle a gap exists naming that sha
- **AND** no operator action was required to create the gap

#### Scenario: The scan cannot read a repository
- **WHEN** the scan fails to read a watched repository's log
- **THEN** it reports that repository as `unknown` rather than as having zero unaccounted
  commits
