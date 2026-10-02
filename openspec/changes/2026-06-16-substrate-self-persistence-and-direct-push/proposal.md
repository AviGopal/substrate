# Substrate self-persistence + direct-to-remote push

> Status: proposed (2026-06-16). Operator-anchored S1 increment — the
> capability the substrate cannot author for itself because it is the
> capability it currently lacks. After it lands, the self-development loop
> graduates the remainder.

## Why

The substrate is coupled to this host machine in three ways, all of which
break continuity the moment the container moves or the host is absent:

1. **State durability is host-bound.** SurrealDB posteriors/traces,
   concept graph, and the memoryNote store persist only via the host
   bind-mount `scripts/substrate/workspace`. Snapshots exist
   (`workspace/snapshots/`) but are operator/observer-side dumps — there
   is no substrate-initiated snapshot, no off-host target, no
   restore-on-bootstrap. A fresh container on another machine comes up
   empty.
2. **Code cutover is host-mediated.** `vessel-mitosis-cutover.ts` already
   contains a full in-container commit→push→mirror→restart path
   (`runGitAwareCutover`), but it is gated off by `MITOSIS_HOST_SYNC_MODE=1`,
   which routes through a host-side `host-sync-poller.sh` systemd timer.
   The container has no git identity, no credentials, and no writable
   clone. The poller handshake is also where the cutover livelock lives
   (`rejected_base_sha` / `rejected_commit_failed`).
3. **The environment is assumed.** Host-mapped ports (`localhost:18xxx`),
   the `$(pwd)/workspace` and read-only repo bind mounts, operator
   `gh auth token`, and Claude-harness hooks hardcoded to localhost paths.
   The image is built locally and never pushed to a registry.

Continuity — the substrate's own framing (`SUBSTRATE_AS_MDP.md` §4.6:
"the transient state is the steady state"; `SUBSTRATE_AS_DEC.md` §4.4: the
learned content is `⋆`, the persisted posterior precision) — requires that
the carrier of learning (`⋆`) survive a move from host A to host B. Today
it does not. This change makes the substrate persist itself and ship its
own code without the host in the loop.

## Operator decisions (locked 2026-06-16)

- **State target:** versioned bundle pushed off-host to a dedicated state
  repo (`AviGopal/substrate-state` — private, created 2026-06-16; Git LFS
  for large jsonl exports), with restore-on-bootstrap. Note the
  metabob-free name: new artifacts drop the `metabob` prefix as the name is
  retired (existing fleet not mass-renamed by this change).
- **Auth:** fine-grained PAT mounted as a container secret
  (`SUBSTRATE_GIT_PAT` in `/workspace/.substrate-secrets`); never baked
  into the image.
- **Push policy:** authored code pushes direct to `dev` (CI deploys to
  canary). The cutover path — not the bare `git_push` resolver — is the
  vehicle, because it carries the scope-creep + freshness gates.

## The keystone

All three goals depend on one primitive: **container-side authenticated
git push.** Self-persistence-off-host and code-push share it. It is the
one increment that must be operator-authored once (S1 anchor); after it,
the loop can self-develop Phases 2+ through its own mitosis pipeline.

## Phases

- **Phase 0 — self-persistence (continuity first).** A substrate-authored
  `snapshot-state` activity exporting SurrealDB + concept + memoryNotes to
  a versioned, verified bundle; autonomous on a timer; pushed off-host to
  the state repo; restore-on-bootstrap so a fresh container resumes as the
  prior one.
- **Phase 1 — container-side authenticated push (keystone).** Git identity
  + PAT credential helper + writable clones inside the container; a
  `MITOSIS_DIRECT_PUSH` mode that takes the existing `runGitAwareCutover`
  branch with `host_repo_root` pointed at the writable clone; retire
  `host-sync-poller.sh` from the loop.
- **Phase 2 — environment independence.** Source from in-container git
  clone (not the host `repos/` mount); push the image to a registry; move
  `/workspace` to a named volume + the Phase-0 bundle; parameterize
  ports/paths; make harness hook endpoints config-driven.

## Out of scope

- H1 two-sided trace signing (tracked separately; "direct to dev" relies
  on the validation back-half, per the locked policy).
- Federation / multi-peer aggregation (Phase 2 is the precondition, not
  this change's deliverable).

## Non-obvious findings (de-risk)

- The in-container push path is already written and tested behind the mode
  flag — Phase 1 is wiring + creds + writable clone, not a from-scratch
  build.
- `clone-vessel-repos` already creates token-authed writable clones at
  `/workspace/git/vessels/<vessel>`; they are simply not wired into the
  cutover's `host_repo_root`.
- Valkey is intentionally ephemeral (`--save ""`); it is cache only and is
  correctly excluded from the snapshot bundle.
