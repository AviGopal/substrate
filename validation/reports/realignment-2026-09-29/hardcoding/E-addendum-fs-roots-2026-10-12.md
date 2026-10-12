# Hardcoding census addendum: filesystem roots fixed at module load (2026-10-12)

**What this adds to the 10-01 census** (`7c4d860d`; class B, behaviour gated by an env var or a constant): one subclass. It was found by qa and the coordinator, and re-verified by docs at development-vessel origin/dev `546f7e86`.

**The class.** A clone or workspace root is fixed in code: either a module constant, or a read at module load of an environment variable that other harnesses do not set.
- The walk cannot see it.
- Test harnesses that redirect the documented clone-root variables do not reach it.
- It was found through a test-gate log line: a drafter-split test reaching `git -C <default root>/<test vessel>`.

## Instances (development-vessel, origin/dev `546f7e86`)

| # | Site | What is fixed |
|---|---|---|
| 1 | `src/resolvers/pull-cutover.ts:47` | `const CLONE_DIR = "/workspace/git/vessels"`. There is no env override. `resolvePullCutover` uses it for `rev-parse` and `ls-remote` in the vessel clone. |
| 2 | `src/resolvers/test-suite.ts:50` | `VESSEL_CLONES_ROOT = process.env.MITOSIS_VESSEL_CLONES ?? "/workspace/git/vessels"`, read at module load. This is a third root variable, beside `MITOSIS_PUSH_CLONE_DIR` and `VESSELS_CLONE_ROOT`. |
| 3 | `src/resolvers/intervention-evaluate.ts:182` | `join("/workspace/git/vessels", vessel)`. There is no env override. |
| 4 | `src/resolvers/feature-compose.ts:9422` and `:9433` | The staging probe `test -d /workspace/git/vessels/<vessel>`, and the attempt ledger's `repo` field. Both are literals. |
| 5 | `src/resolvers/vessel-mitosis-evaluate.ts:531` | `DEFAULT_CLONE_REPO_ROOT = "/workspace/git/super-repo/repos"`. |

## Approach

This follows the census's own approach:
- **One seam.** Every site reads the existing `vesselsCloneRoot()` in `src/judge/gap-policy.ts`, at use time.
- **A positive control.** A harness that redirects the root sees no access under the default root.

**Placement note.** Several of these files are on the autonomy-scope exclusion list, so this is operator work or a user ruling, not a lane need. That is outside this addendum.
