# Super-repo git hooks

Versioned git hooks for the `substrate` super-repo. Installed by running:

```bash
scripts/git-hooks/install.sh
```

This sets `core.hooksPath` to `scripts/git-hooks/` so updates to the hooks land via `git pull`, not by re-copying files into `.git/hooks/`.

Inside a container, the substrate's own super-repo clone gets the same gate from `setup-git-push` when the boot creates that clone (a fresh workspace volume, or a baked seed upgraded into a clone): it writes a small `.git/hooks/pre-commit` wrapper that runs the hook as committed at `HEAD`, so a commit that deletes or empties the hook is still judged by the gate it is changing. A refused commit fails as it would for an operator, and the wrapper also files the hook's findings as a gap (`substrateGap_write`), so refusals on a fleet are measured rather than silent. A clone that already existed before that boot is left as it was.

The wrapper lives in `.git/hooks`, and git reads `.git/hooks` only when no `core.hooksPath` is in effect. A container-wide hooks path (for example one that records every commit) shadows the wrapper unless that directory carries its own `pre-commit` that runs the repository's `.git/hooks/pre-commit` and passes its exit status through. Without one the gate is inert; `setup-git-push` prints `placement gate INERT` naming the hooks path, so a skipped gate is not read as an installed one.

## Philosophy

The super-repo is a thin coordinator over:

- `repos/*` — submodule pointers to vessel repositories
- `docs/` — stateless reference documentation
- `openspec/` — future-change proposals + designs + tasks + specs
- `scripts/` — operational tooling
- `packages/` — shared TypeScript packages used across vessels
- `validation/` — install, gate and glue checks, with their fixtures
- `.claude/`, `.github/`, `.githooks/`, `.well-known/` — tool directories

Anything else accumulates as cruft. The pre-commit hook rejects new cruft at commit time so the tree stays readable. Existing files are grandfathered — the hook only checks newly-added or renamed-into entries.

## Where things go

| You have | Put it in |
|---|---|
| Stateless reference doc (architecture, API contract, how-to) | `docs/<topic>.md` |
| Future-change proposal | `openspec/changes/<slug>/proposal.md` |
| Design doc for a future change | `openspec/changes/<...>/design.md` |
| Task list for a future change | `openspec/changes/<...>/tasks.md` |
| Formal spec (Requirements + Scenarios) | `openspec/changes/<...>/specs/<name>/spec.md` |
| One-off operational script (build, deploy, audit) | `scripts/<verb>-<noun>.sh` |
| Vessel source / tests / fixtures / assets | `repos/<vessel>/...` |
| Cross-vessel TypeScript package | `packages/<package>/` |
| Playwright / screenshot output | gitignored — these are session artefacts, not source |
| WIP analysis / exploration / debugging notes | nowhere — write a commit message or stay in conversation |

## What the pre-commit hook does

The hook runs these checks, in order, and stops at the first refusal:

1. **Placement** — rejects newly-added or renamed-into entries that violate the placement rules below. Pre-existing files are grandfathered.
2. **Env ratchet** — judges added lines in unit files (below).
3. **Ignored paths stay untracked** — refuses a staged addition whose path `.gitignore` ignores.
4. **SOPS** — a staged `secrets/*.secrets.yaml` must be encrypted.
5. **Secrets scan (`gitleaks protect --staged`)** — scans the staged diff for credentials. If gitleaks isn't installed, the scan is skipped with a one-line install hint.
6. **Human-surface bundle** — a staged UI source change must carry its rebuilt `ui/dist`.
7. **Glue tests** — a commit touching `scripts/substrate/`, `validation/scripts/`, the seeder, the vendored packages or this hook runs `validation/scripts/run-glue-tests.sh` against the staged tree.

Fix the first refusal, re-stage, and commit again. Bypass with `git commit --no-verify` only for a known refusal unrelated to the commit.

## What the pre-commit hook blocks

A commit is rejected when it adds (or renames into) a file that violates any of these rules. Modifying existing tracked files is never blocked by these rules (the env ratchet below judges modified unit files too).

1. **Files at the super-repo root** are limited to a small allowlist (project metadata: `CLAUDE.md`, `README.md`, `.gitignore`, `.gitmodules`, lockfiles, dotfile configs, and the launch manifest `docker-compose.yml` with its image recipe `Dockerfile.substrate`). Everything else needs a home under one of the directories `ALLOWED_TOPLEVEL_DIRS` lists in the hook.
2. **No new top-level markdown** outside `docs/` or `openspec/`. If you wrote a writeup that only matters for the current commit, put it in the commit message instead.
3. **No new test files at root or in non-test areas**. Tests live alongside the code under `repos/<vessel>/test{,s}/`. The super-repo never holds tests.
4. **No new image / video / archive files outside `repos/*` and `docs/assets/`**. Screenshots and playwright output should be gitignored, not committed.
5. **No new ad-hoc scripts at root** (`*.sh`, `*.ts`, `*.js`, `*.mjs`, `*.cjs`, `*.py`). Scripts go in `scripts/`. If a script is one-shot (e.g. apply a migration once), it probably belongs in commit history rather than the tree.
6. **New top-level directories** outside the allowed set are rejected; pick an existing area.

## The env ratchet: behaviour switches in units can only shrink

Separately from placement, the hook judges every added line under `scripts/substrate/units/`. An `Environment=` line is frozen at process start and invisible to traces and the walk, so a unit may only set **bootstrap** names (ports, hosts, ids, endpoints, paths), pinned with a reason in `env-ratchet/bootstrap-allowlist.txt`. The behaviour names units already set are pinned in `env-ratchet/grandfathered-behaviour.txt`, which only shrinks. A behaviour change belongs in a shaped impulse read at use time. A refusal names the line to revert. The rules, what they do not cover, and the gate fixture that blocks bypassed commits are described in the comment above the ratchet in `pre-commit`.

## Why "in commit history, not the tree"

A document that describes a single integration, a fix, or a state at a point in time has a natural home: the commit that did the work. Future readers can `git log` and `git blame` to recover what changed and why. A markdown file in the tree describing the same thing competes with the commit message, drifts as the code evolves, and pollutes the repo's surface area.

Use docs (`docs/`) for things that are still true a year from now. Use openspec (`openspec/`) for things that should be true after a future change lands. Use commit messages for everything else.

## What the pre-commit hook does NOT do

- It does not build, and it runs only the glue tests (vessel tests run in each vessel's repo).
- It does not deploy or validate openspec contracts.

## Gitleaks

`gitleaks protect --staged --redact --no-banner` runs after a successful placement check. Findings block the commit; the matched secret is redacted in the output so the terminal scrollback / hook log doesn't itself become a leak source.

Install:

```bash
brew install gitleaks                                      # macOS
go install github.com/gitleaks/gitleaks/v8@latest          # Go toolchain
# or grab a binary: https://github.com/gitleaks/gitleaks/releases
```

If gitleaks is not on `PATH` the hook prints a one-line install hint and lets the commit through. The first defence against credential leaks remains the `.gitignore` patterns in the super-repo (`.env*`, `*.key`, `*.pem`, `secrets.yaml`, `.metabob_api_key`, `.metabob_session`); gitleaks is the second.

**False positives.** If gitleaks flags an example value in a docs page or a placeholder in a config template, add an inline allowlist marker:

```
example_key = "AKIAEXAMPLE..."  # gitleaks:allow
```

Or extend the project rule set in `scripts/git-hooks/.gitleaks.toml`, which the hook passes to gitleaks.

**If a secret slips through.** Rotate it immediately. The leaked value lives in git history forever; rotation is what makes the cheap `git rm` recovery path safe.

## Bypass

```bash
git commit --no-verify
```

Use sparingly. The rules exist to keep `git blame` readable; bypassing routinely undoes that.

## Vessel hooks

Vessel repos (under `repos/<name>`) are separate git repos with their own history. The super-repo hook cannot govern their internals — it only sees submodule pointer bumps. To enforce the same placement discipline inside a vessel, install the vessel hook template:

```bash
# From the super-repo root:
scripts/git-hooks/install.sh --vessel repos/<vessel-name>
```

This copies `scripts/git-hooks/vessel-pre-commit` into `repos/<vessel>/.git-hooks/pre-commit` and sets `core.hooksPath=.git-hooks` inside that repo. **Commit `.git-hooks/pre-commit` inside the vessel repo** so collaborators get it on clone.

The vessel hook enforces:
- Vessel root holds only project metadata (package.json, tsconfig, README, lockfiles, dotfile configs)
- No markdown docs at vessel root (use `docs/`)
- No loose scripts at vessel root (use `scripts/`)
- No test files at vessel root (use `test/` or `tests/`)
- No binary artefacts outside `assets/`, `public/`, `docs/assets/`
- No `node_modules/` committed
- Gitleaks secrets scan (when installed)

**New vessels**: run `install.sh --vessel repos/<name>` as part of the vessel creation checklist, before the first commit.

## Extending the rules

Edit `scripts/git-hooks/pre-commit` (super-repo) or `scripts/git-hooks/vessel-pre-commit` (vessel template). Notable knobs:

- `ROOT_ALLOWLIST` — exact-name files allowed at root.
- `ALLOWED_TOPLEVEL_DIRS` / `ALLOWED_VESSEL_DIRS` — directories allowed at root.
- `ARTEFACT_EXTENSIONS` — pipe-separated extensions treated as binary artefacts.

Add a comment explaining the change so future readers understand the carve-out. Changes to `vessel-pre-commit` only take effect in vessels after re-running `install.sh --vessel`.
