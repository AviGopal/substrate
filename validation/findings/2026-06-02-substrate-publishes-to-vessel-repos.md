# Substrate publishes to vessel repos via the existing publication chain

**Date**: 2026-06-02
**Status**: Verified end-to-end

## Summary

The substrate's `publish-substrate-authored-artifact` activity is **already
vessel-agnostic**. No new template was needed to extend substrate-managed
publication from the super-repo to individual vessel repos. The activity
takes `cwd`, `owner`, `repo`, `target_path`, `target_branch`, `base_branch`,
`commit_message`, `artifact_body`, `pr_title`, `pr_body` as variables and
runs the same 7-task composition (write → branch → commit → push → PR)
against whatever cwd it is pointed at.

## Verification

1. Cloned `AviGopal/development-vessel` to
   `scripts/substrate/workspace/git/vessels/development-vessel` using the
   same HTTPS-with-token remote pattern as the super-repo clone.
2. Substrate (boredom or operator dispatch) ran
   `publish-substrate-authored-artifact` with `cwd=/workspace/git/vessels/development-vessel`,
   `owner=AviGopal`, `repo=development-vessel`.
3. Trace `exec_mt2w5985` at 2026-06-02T07:34:52Z, status=success,
   duration=2530ms, output shapes `[commandResult, branchCreateResult,
   gitPushResult, prCreateResult]`.
4. PR opened: https://github.com/AviGopal/development-vessel/pull/1
   - Branch: `substrate-authored/2026-06-02-vessel-managed-test`
   - Committer: `substrate-live <substrate-live@substrate.local>`
   - File: `docs/findings/2026-06-02-substrate-managed-test.md`

## Operator pattern

Run once per machine to set up the writable clones:

```bash
make -C scripts/substrate clone-vessel-repos
```

The target is idempotent; it only clones vessels that have their own GitHub
remote (currently just `development-vessel`). Vessels that live directly in
the super-repo as plain directories (`goal-host-vessel`,
`llm-resolver-vessel`, etc.) are reached via
`/workspace/git/super-repo/repos/<vessel>/` and need no separate clone.

The clones live under `scripts/substrate/workspace/`, which is gitignored —
the super-repo records only the Makefile target, not the clones themselves.

## Pattern observation

The publication chain composition was designed for the super-repo but the
abstraction held: every command in it (`fs_write`, `git checkout -B`,
`git add && git commit`, `git push`, `gh pr create`) is cwd-relative, so
pointing it at a different working tree just works. The substrate did not
need a `publish-to-vessel-repo` sibling template, nor a `vessel_name → cwd`
resolver shim. The existing variable surface is the right one.

The only operator-side work was making the vessel repo physically present
on the host filesystem (bind-mounted into the container). That is the
target this finding adds.
