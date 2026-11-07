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

- Here: `install-acceptance.yml` runs the install page, network and upgrade checks on Docker and Podman against each built image. Submodule bumps carry no status check.
- activity-api: build, typecheck, lint, tests. Integration tests run only when `SURREALDB_URL`, `ACTIVITY_API_URL` or `TEST_API_URL` is set and answers. A failing test fails CI unless it is a known source defect listed in `.github/known-red.txt`.
- concept-db: typecheck, tests, shape-dispatch check.
- Other vessels have no test CI: run `bun test` before you push.
