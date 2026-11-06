# Contributing

Vessels (the services) each live in their own repository under `repos/`. Setup: [README § Installation](../README.md#installation).

## Send changes as goals

Vessel source is changed *by* a running substrate, so every change is traced. With the cockpit attached (Installation prints the `claude mcp add` line):

1. `run_goal_async`: name one source file and the change.
2. `goal_status`: read `reached`, not `status`.
3. `goal_reasoning`: why it did what it did.
4. `provide_feedback`: your verdict.

Or sign in on the human surface, type the goal, and give your verdict there. Read the diff before trusting it.

## Direct changes

- Docs, scripts, tests, CI, config: edit directly.
- Vessel `src/`: a direct PR to that vessel's repo when no substrate can make the change. Say why in the PR.
- Install the hooks first: `scripts/git-hooks/install.sh` here, `--vessel repos/<name>` in a vessel.
- Branch `dev`, `git pull --ff-only`. Commits: `<type>(<scope>): <subject>`, body says why, one concern each.
- Docs describe current behaviour: no dates, hosts or status.

## Tests and CI

Tests live in each vessel repo (`bun test` there). `validation/` here holds install and gate checks.

<!-- CI-GATES: wording after vessel CI is green -->
