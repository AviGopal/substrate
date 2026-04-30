# Super-repo git hooks

Versioned git hooks for the `metabob-devbob` super-repo. Installed by running:

```bash
scripts/git-hooks/install.sh
```

This sets `core.hooksPath` to `scripts/git-hooks/` so updates to the hooks land via `git pull`, not by re-copying files into `.git/hooks/`.

## Philosophy

The super-repo is a thin coordinator over:

- `repos/*` — submodule pointers to vessel repositories
- `docs/` — stateless reference documentation
- `openspec/` — future-change proposals + designs + tasks + specs
- `scripts/` — operational tooling
- `packages/` — shared TypeScript packages used across vessels

Anything else accumulates as cruft. The pre-commit hook rejects new cruft at commit time so the tree stays readable. Existing files are grandfathered — the hook only checks newly-added or renamed-into entries.

## Where things go

| You have | Put it in |
|---|---|
| Stateless reference doc (architecture, API contract, how-to) | `docs/<topic>.md` |
| Future-change proposal | `openspec/changes/<YYYY-MM-DD>-<slug>/proposal.md` |
| Design doc for a future change | `openspec/changes/<...>/design.md` |
| Task list for a future change | `openspec/changes/<...>/tasks.md` |
| Formal spec (Requirements + Scenarios) | `openspec/changes/<...>/specs/<name>/spec.md` |
| One-off operational script (build, deploy, audit) | `scripts/<verb>-<noun>.sh` |
| Vessel source / tests / fixtures / assets | `repos/<vessel>/...` |
| Cross-vessel TypeScript package | `packages/<package>/` |
| Playwright / screenshot output | gitignored — these are session artefacts, not source |
| WIP analysis / exploration / debugging notes | nowhere — write a commit message or stay in conversation |

## What the pre-commit hook blocks

A commit is rejected when it adds (or renames into) a file that violates any of these rules. Modifying existing tracked files is never blocked.

1. **Files at the super-repo root** are limited to a small allowlist (project metadata: `CLAUDE.md`, `README.md`, `.gitignore`, `.gitmodules`, lockfiles, dotfile configs). Everything else needs a home under `repos/`, `docs/`, `openspec/`, `scripts/`, `packages/`, `.claude/`, `.github/`, or `.githooks/`.
2. **No new top-level markdown** outside `docs/` or `openspec/`. If you wrote a writeup that only matters for the current commit, put it in the commit message instead.
3. **No new test files at root or in non-test areas**. Tests live alongside the code under `repos/<vessel>/test{,s}/`. The super-repo never holds tests.
4. **No new image / video / archive files outside `repos/*` and `docs/assets/`**. Screenshots and playwright output should be gitignored, not committed.
5. **No new ad-hoc scripts at root** (`*.sh`, `*.ts`, `*.js`, `*.mjs`, `*.cjs`, `*.py`). Scripts go in `scripts/`. If a script is one-shot (e.g. apply a migration once), it probably belongs in commit history rather than the tree.
6. **New top-level directories** outside the allowed set are rejected; pick an existing area.

## Why "in commit history, not the tree"

A document that describes a single integration, a fix, or a state at a point in time has a natural home: the commit that did the work. Future readers can `git log` and `git blame` to recover what changed and why. A markdown file in the tree describing the same thing competes with the commit message, drifts as the code evolves, and pollutes the repo's surface area.

Use docs (`docs/`) for things that are still true a year from now. Use openspec (`openspec/`) for things that should be true after a future change lands. Use commit messages for everything else.

## What the pre-commit hook does NOT do

- It does not run tests or builds.
- It does not deploy.
- It does not call kubectl or helmfile.
- It does not validate openspec contracts.

The previous deploy-on-commit hook was removed — deployment runs from CI on push to `dev`, not from the developer's laptop on every commit.

## Bypass

```bash
git commit --no-verify
```

Use sparingly. The rules exist to keep `git blame` readable; bypassing routinely undoes that.

## Extending the rules

Edit `scripts/git-hooks/pre-commit`. Notable knobs:

- `ROOT_ALLOWLIST` — exact-name files allowed at the super-repo root.
- `ALLOWED_TOPLEVEL_DIRS` — directories allowed at the super-repo root.
- `ARTEFACT_EXTENSIONS` — pipe-separated extensions treated as binary artefacts.

Add a comment explaining the change so future readers understand the carve-out.
