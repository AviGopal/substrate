#!/usr/bin/env bash
# setup-git-push.sh — make the container able to push its own authored code to
# the AviGopal repos (substrate self-development through repositories).
#
# Runs once at startup (git-push-setup.service oneshot), AFTER gen-env has
# written /etc/substrate/env. Two jobs:
#   1. System-level git identity + credential helper. MUST be --system, not
#      --global: systemd services run with NO HOME, so ~/.gitconfig (--global)
#      is never read — that silently breaks push auth (commit works via git's
#      hostname fallback, push fails → local_only). /etc/gitconfig is read
#      regardless of HOME.
#   2. Idempotent writable clones of the self-developed vessel repos at
#      MITOSIS_PUSH_CLONE_DIR/<vessel>, on dev. The cutover (direct-push mode)
#      commits+pushes here, then mirrors into the live /vessels runtime.
#   3. Idempotent super-repo clone at /workspace/git/super-repo, on dev, tracking
#      the canonical AviGopal/substrate. The cutover diff-baseline + unit-file
#      source and the landed-truth reads (docs-align-scan, self-operational-health)
#      all read this tree, so it MUST track substrate.git/dev — not the stale
#      metabob-devbob.git/snapshot-branch a persistent volume artifact used to leave it on.
#
# Fails open: no PAT → configure identity only, skip clones (drafts won't push,
# but the substrate still runs and learns).
set -uo pipefail

# Load env + persisted secrets (PAT lives in one or both).
[ -f /etc/substrate/env ] && . /etc/substrate/env 2>/dev/null || true
[ -f /workspace/.substrate-secrets ] && . /workspace/.substrate-secrets 2>/dev/null || true
export SUBSTRATE_GIT_PAT="${SUBSTRATE_GIT_PAT:-}"

# Never block on an interactive credential/terminal prompt. With no (or an
# invalid) PAT, HTTPS git ops against private repos would otherwise hang waiting
# for a username — fail them fast instead, so a push error is visible rather
# than a wedged unit.
export GIT_TERMINAL_PROMPT=0

AUTHOR_NAME="${SUBSTRATE_GIT_AUTHOR_NAME:-Substrate Autonomous}"
AUTHOR_EMAIL="${SUBSTRATE_GIT_AUTHOR_EMAIL:-substrate-autonomous@substrate.local}"
CLONE_DIR="${MITOSIS_PUSH_CLONE_DIR:-/workspace/git/vessels}"
# Everything mutable from all vessels: clone every substrate vessel repo so the
# cutover can self-develop ANY of them (not just development-vessel). Each maps
# to AviGopal/<name> on dev and to the live runtime /vessels/<name>. Override
# via SUBSTRATE_PUSH_VESSELS (space-separated). A clone whose vessel doesn't run
# at /vessels/<name> is still pushable; its mirror-to-live just no-ops safely.
VESSELS="${SUBSTRATE_PUSH_VESSELS:-activity-api analysis-vessel boredom-vessel concept-db cpg-inference-ts development-vessel discovery-vessel goal-host-vessel ias-executor-ts identity-vessel light-dispatch-vessel llm-resolver-vessel local-tools-vessel obsidian-vessel ribosome-vessel stateful-ui-vessel}"

# 1. System git identity (always). The credential helper is configured ONLY if
#    the PAT validates — see below.
git config --system user.name  "$AUTHOR_NAME"
git config --system user.email "$AUTHOR_EMAIL"
echo "[setup-git-push] system git identity configured"

# PAT validation (2026-06-19). The in-container push is an HTTPS PAT path. When
# the PAT is invalid/missing, EVERY `git push` fails with "Invalid username or
# token. Password authentication is not supported." — and the cutover would spew
# that auth error on every self-alteration and report a misleading
# local_only. So:
#   - No PAT → DO NOT configure a broken HTTPS credential helper. Log ONE clear
#     warning. The cutover's push fails fast and the commit stays local until a
#     credential is supplied.
#   - PAT present → configure the helper so the cutover pushes direct from the
#     container.
# This keeps a bad/expired operator PAT from generating per-push noise, and keeps
# the reason a commit did not land legible in one log line instead of many.
# Credential helper: configured whenever a PAT is present. The helper reads
# $SUBSTRATE_GIT_PAT from the git process env at push time (the dev-vessel unit
# has it via its EnvironmentFile), so the token is never written into any config.
#
# PAT validation is ADVISORY, not gating (2026-06-19). The fine-grained PAT in
# use authenticates git ops most of the time but exhibits INTERMITTENT
# "Invalid username or token" failures (GitHub fine-grained-PAT flakiness /
# rate-limiting). A hard startup probe that DISABLED the helper on a single
# transient blip would wrongly kill a working fast path. So: configure the
# helper unconditionally when a PAT exists, probe a few times for observability,
# and only WARN (never disable) if the probe can't confirm auth — a push that
# does fail leaves its commit in the clone and is surfaced by
# push_health_observer.
PAT_PROBE_REPO="${SUBSTRATE_PAT_PROBE_REPO:-development-vessel}"
REPO_OWNER="${SUBSTRATE_REPO_OWNER:-AviGopal}"   # fork override: set SUBSTRATE_REPO_OWNER to your GitHub org/user
if [ -n "$SUBSTRATE_GIT_PAT" ]; then
  # Self-sufficient helper (2026-07-12): source /etc/substrate/env at use time so
  # git authenticates from ANY process context (plain shells, tick units without
  # the full EnvironmentFile), not only units that inherit SUBSTRATE_GIT_PAT.
  # Falls back to the process env when the file is absent. The token is still
  # never written into any config. An empty-env shell previously made this
  # helper return an empty password, which (being first in the helper chain)
  # produced the "intermittent Invalid username or token" failures.
  git config --system credential.helper '!f() { [ -r /etc/substrate/env ] && . /etc/substrate/env 2>/dev/null; echo username=x-access-token; echo "password=${SUBSTRATE_GIT_PAT:-$GITHUB_TOKEN}"; }; f'
  echo "[setup-git-push] in-container HTTPS credential helper configured (self-sourcing; reads PAT from /etc/substrate/env or process env at push time)"

  # Advisory probe with retries (tolerate transient flakiness before warning).
  PAT_OK=0
  for attempt in 1 2 3; do
    if git -c credential.helper="!f() { echo username=x-access-token; echo \"password=$SUBSTRATE_GIT_PAT\"; }; f" \
         ls-remote --heads "https://github.com/${REPO_OWNER}/${PAT_PROBE_REPO}.git" dev >/dev/null 2>&1; then
      PAT_OK=1; break
    fi
    sleep 2
  done
  if [ "$PAT_OK" = "1" ]; then
    echo "[setup-git-push] PAT auth confirmed against ${REPO_OWNER}/${PAT_PROBE_REPO}"
  else
    echo "[setup-git-push] NOTE: PAT auth probe did not confirm after 3 tries (${REPO_OWNER}/${PAT_PROBE_REPO}). This is often transient (GitHub fine-grained-PAT rate-limiting); the helper stays configured. If in-container pushes keep failing, self-authored commits stay local and the push_health_observer will emit a substrateGap. OPERATOR: if sustained, refresh SUBSTRATE_GIT_PAT (Contents: Read+Write)."
  fi
else
  # No PAT: ensure no stale helper remains so pushes fail fast rather than hang.
  git config --system --unset-all credential.helper 2>/dev/null || true
  echo "[setup-git-push] no SUBSTRATE_GIT_PAT — in-container HTTPS push disabled; self-authored commits are committed locally but cannot land until a credential is supplied. Clones refreshed read-only if reachable."
fi

# 2. Idempotent writable clones on dev.
mkdir -p "$CLONE_DIR"
# REPO_OWNER already resolved above (SUBSTRATE_REPO_OWNER, default AviGopal).
for v in $VESSELS; do
  d="$CLONE_DIR/$v"
  url="https://github.com/${REPO_OWNER}/$v.git"
  if [ -d "$d/.git" ]; then
    git -C "$d" remote set-url origin "$url"
    if git -C "$d" fetch origin dev -q 2>/dev/null; then
      git -C "$d" checkout -q dev 2>/dev/null || true
      git -C "$d" reset --hard origin/dev -q 2>/dev/null \
        && echo "[setup-git-push] refreshed $v → $(git -C "$d" rev-parse --short HEAD)" \
        || echo "[setup-git-push] WARN refresh failed for $v"
    else
      echo "[setup-git-push] WARN fetch failed for $v (offline?); keeping existing clone"
    fi
  else
    git clone -q --branch dev "$url" "$d" \
      && echo "[setup-git-push] cloned $v" \
      || echo "[setup-git-push] WARN clone failed for $v"
  fi
done

# 3. Idempotent super-repo clone on dev (canonical AviGopal/substrate). Same
#    clone-or-refresh pattern as the vessels above (reuse, not a new mechanism) so a
#    from-repo container comes up with the super-repo tracking substrate.git/dev by
#    construction — no divergence onto a fork/snapshot branch. --no-recurse-submodules:
#    the reads that matter (docs/, scripts/, direct-tree vessels) live in the working
#    tree; submodule vessels use their own $CLONE_DIR/<v> clones. Fork override:
#    SUBSTRATE_SUPER_REPO (repo name) + SUBSTRATE_REPO_OWNER (owner).
SUPER_REPO="${SUBSTRATE_SUPER_REPO:-substrate}"
SUPER_REPO_DIR="${SUBSTRATE_SUPER_REPO_DIR:-$(dirname "$CLONE_DIR")/super-repo}"
super_url="https://github.com/${REPO_OWNER}/${SUPER_REPO}.git"
mkdir -p "$(dirname "$SUPER_REPO_DIR")"
if [ -d "$SUPER_REPO_DIR" ] && [ ! -d "$SUPER_REPO_DIR/.git" ] && [ -n "$(ls -A "$SUPER_REPO_DIR" 2>/dev/null)" ]; then
  # Baked-seed upgrade: a pulled image that booted without credentials seeded
  # this dir as a bare working tree (no .git). When credentials later exist,
  # `git clone` into the non-empty dir would fail forever — so init-in-place
  # and let the fetch+reset path below converge the tree onto origin/dev.
  # Self-alteration (pull AND push) requires a real clone, not the seed.
  if git -C "$SUPER_REPO_DIR" init -q 2>/dev/null && git -C "$SUPER_REPO_DIR" remote add origin "$super_url" 2>/dev/null; then
    # A seed has never been a clone, so it has never committed: gate it like a fresh one.
    SUPER_CLONED_THIS_BOOT=1
    echo "[setup-git-push] upgrading baked super-repo seed to a live clone"
  fi
fi
if [ -d "$SUPER_REPO_DIR/.git" ]; then
  git -C "$SUPER_REPO_DIR" remote set-url origin "$super_url"
  if git -C "$SUPER_REPO_DIR" fetch --no-recurse-submodules origin dev -q 2>/dev/null; then
    git -C "$SUPER_REPO_DIR" checkout -q dev 2>/dev/null || git -C "$SUPER_REPO_DIR" checkout -q -f -B dev origin/dev 2>/dev/null || true
    git -C "$SUPER_REPO_DIR" reset --hard origin/dev -q 2>/dev/null \
      && echo "[setup-git-push] refreshed super-repo (${SUPER_REPO}) → $(git -C "$SUPER_REPO_DIR" rev-parse --short HEAD)" \
      || echo "[setup-git-push] WARN refresh failed for super-repo"
  else
    echo "[setup-git-push] WARN fetch failed for super-repo (offline?); keeping existing clone or seed"
  fi
else
  if git clone -q --no-recurse-submodules --branch dev "$super_url" "$SUPER_REPO_DIR"; then
    SUPER_CLONED_THIS_BOOT=1
    echo "[setup-git-push] cloned super-repo (${SUPER_REPO})"
  elif [ -d /usr/local/share/substrate/super-repo ]; then
    # Pulled image with no repo credentials: seed the working tree from the
    # copy baked at image build so dynamic vessels (federation transport, …)
    # have their workdir without any GitHub access.
    mkdir -p "$SUPER_REPO_DIR"
    cp -a /usr/local/share/substrate/super-repo/. "$SUPER_REPO_DIR/"
    echo "[setup-git-push] clone unavailable — seeded super-repo working tree from baked image copy"
  else
    echo "[setup-git-push] WARN clone failed for super-repo"
  fi
fi

# 3b. What a composer node needs to compose the repos it lands. feature_compose grounds
#     each target from $SUPER_REPO_DIR/repos/<v> (cloned --no-recurse-submodules above,
#     so those checkouts start empty and grounding reads 0 bytes), and a compose worktree
#     links node_modules to the push clone's, where a `file:../<dep>` dependency is a COPY
#     of the sibling clone made at install time: a dep that was never built (its dist/ is
#     gitignored) installs without its entry points and every file importing it fails
#     TS2307. Measured on a second composer node: both failures refused every compose on
#     its owned repos until fixed by hand. So, per landed vessel: initialise its super-repo
#     checkout, clone and build each file: dependency, then install the vessel's clone.
if [ -d "$SUPER_REPO_DIR/.git" ]; then
  for v in $VESSELS; do
    git -C "$SUPER_REPO_DIR" submodule update --init -q "repos/$v" 2>/dev/null \
      || echo "[setup-git-push] WARN super-repo checkout of repos/$v not initialised"
    pj="$CLONE_DIR/$v/package.json"
    [ -f "$pj" ] || continue
    deps=$(grep -oE '"file:\.\./[A-Za-z0-9._-]+"' "$pj" | sed -E 's#"file:\.\./([^"]+)"#\1#')
    [ -n "$deps" ] || continue
    for dep in $deps; do
      dd="$CLONE_DIR/$dep"
      [ -d "$dd/.git" ] || git clone -q --branch dev "https://github.com/${REPO_OWNER}/$dep.git" "$dd" \
        || { echo "[setup-git-push] WARN clone failed for $dep (file: dependency of $v)"; continue; }
      if [ ! -d "$dd/dist" ]; then
        (cd "$dd" && bun install >/dev/null 2>&1 && bun run build >/dev/null 2>&1) \
          && echo "[setup-git-push] built $dep (file: dependency of $v)" \
          || echo "[setup-git-push] WARN build failed for $dep (file: dependency of $v)"
      fi
    done
    (cd "$CLONE_DIR/$v" && bun install >/dev/null 2>&1) \
      || echo "[setup-git-push] WARN install failed in the $v clone"
  done
fi

# 4. Placement gate on the super-repo clone. A substrate-authored commit that adds
#    a file outside the tracked layout (walk scratch swept up by a drift commit,
#    template placeholders written as literal paths) is refused by the same
#    versioned pre-commit hook an operator clone runs, so the super-repo root stays
#    a thin coordinator.
#
#    WHICH VOLUMES. The gate is installed only when this boot turned the directory
#    into a clone: a fresh `git clone`, or a baked seed upgraded in place (a seed has
#    never been a clone, so it has never committed; a spoke that booted without
#    credentials holds exactly such a seed and is gated from the boot that first
#    gives it one). A clone that existed before this boot keeps committing as it
#    did. A wrapper already present from an earlier gated boot is refreshed; a
#    foreign hook (no marker) is never overwritten.
#
#    WHAT RUNS. The wrapper runs the hook as COMMITTED at HEAD, not the working-tree
#    copy, so a commit that deletes or empties the hook is still judged by the gate
#    as it stood before that commit (a hook change takes effect one commit later).
#    It fails open only when there is no HEAD yet or HEAD carries no hook, and says
#    so on stderr.
#
#    A REFUSAL IS FILED. A refused commit fails the committing route; the wrapper
#    also files the hook's findings through substrateGap_write, keyed by the
#    violation set, so refused landings on a gated fleet are measured, not silent.
#
#    WHERE IT CAN BE INERT. git runs .git/hooks only when no core.hooksPath is in
#    effect. A container-wide hooks path shadows the wrapper unless that directory
#    carries a pre-commit that chains to the repository's own; the check below
#    names that case instead of reporting the gate as installed.
PLACEMENT_HOOK_MARKER="substrate-placement-gate"
if [ -d "$SUPER_REPO_DIR/.git" ]; then
  _ph="$SUPER_REPO_DIR/.git/hooks/pre-commit"
  _ph_ours=0
  [ -f "$_ph" ] && grep -q "$PLACEMENT_HOOK_MARKER" "$_ph" 2>/dev/null && _ph_ours=1
  if [ "$_ph_ours" = 1 ] || { [ "${SUPER_CLONED_THIS_BOOT:-0}" = 1 ] && [ ! -e "$_ph" ]; }; then
    mkdir -p "$SUPER_REPO_DIR/.git/hooks"
    cat > "$_ph" <<'HOOK'
#!/usr/bin/env bash
# substrate-placement-gate: written by setup-git-push. Runs the super-repo's
# committed placement hook and files a gap when it refuses a commit.
set -u
rel=scripts/git-hooks/pre-commit
# No commit yet: there is no committed gate to run.
git rev-parse -q --verify HEAD >/dev/null 2>&1 || exit 0
d="$(mktemp -d 2>/dev/null)" || { echo "[placement-gate] WARN no temp dir; this commit is not gated" >&2; exit 0; }
trap 'rm -rf "$d"' EXIT
# The committed hook, never the working-tree copy: a commit that deletes or empties
# the hook is still judged by the gate as it stood before that commit.
if ! git show "HEAD:$rel" >"$d/pre-commit" 2>/dev/null || [ ! -s "$d/pre-commit" ]; then
  echo "[placement-gate] WARN HEAD carries no $rel; this commit is not gated" >&2
  exit 0
fi
git show "HEAD:scripts/git-hooks/.gitleaks.toml" >"$d/.gitleaks.toml" 2>/dev/null || rm -f "$d/.gitleaks.toml"
bash "$d/pre-commit" "$@" >"$d/out" 2>&1
rc=$?
cat "$d/out" >&2
[ "$rc" -eq 0 ] && exit 0
# A refusal is information: file it so refused landings are measured, not silent.
# Filing never changes the verdict and never blocks on the network.
(
  command -v jq >/dev/null 2>&1 && command -v curl >/dev/null 2>&1 || exit 0
  if [ -z "${METABOB_API_KEY:-}" ] && [ -r /etc/substrate/env ]; then . /etc/substrate/env 2>/dev/null; fi
  report="$(sed 's/\x1b\[[0-9;]*m//g' "$d/out" | head -c 3000)"
  key="$(printf '%s\n' "$report" | grep -E '✗|━━━' | sort -u | sha1sum | cut -c1-12)"
  staged="$(git diff --cached --name-only --diff-filter=ACMR | head -50 | jq -R . | jq -sc .)"
  top="$(git rev-parse --show-toplevel 2>/dev/null)"
  body="$(jq -nc --arg id "super-repo-commit-refused-$key" --arg r "$report" --arg top "$top" \
      --argjson staged "$staged" --argjson rc "$rc" \
    '{impulse:{pointer:{type:"substrateGap_write",gap:{id:$id,category:"systematic_failure",
      source:"substrate_detected",status:"open",
      summary:("A commit to the super-repo clone was refused by the placement gate (scripts/git-hooks/pre-commit). The route that made it either wrote outside the tracked layout or changed human-surface UI source without its rebuilt bundle; the landing did not happen. Findings:\n" + $r),
      classification_metadata:{repo:$top, hook:"scripts/git-hooks/pre-commit", exit_status:$rc, staged:$staged}}}}}')" || exit 0
  auth=()
  [ -n "${METABOB_API_KEY:-}" ] && auth=(-H "Authorization: ApiKey ${METABOB_API_KEY}")
  curl -s --max-time 8 -o /dev/null -X POST "${DEV_VESSEL_ENDPOINT:-http://127.0.0.1:8090}/v2/impulses/resolve" \
    -H 'Content-Type: application/json' "${auth[@]}" -d "$body" \
    || echo "[placement-gate] WARN could not file the refusal as a gap" >&2
)
exit "$rc"
HOOK
    chmod +x "$_ph"
    echo "[setup-git-push] super-repo placement gate installed (.git/hooks/pre-commit runs the committed scripts/git-hooks/pre-commit)"
  elif [ -e "$_ph" ]; then
    echo "[setup-git-push] super-repo has its own pre-commit hook; placement gate not installed"
  else
    echo "[setup-git-push] super-repo clone predates this boot; placement gate not installed (an existing volume keeps its commit behaviour)"
  fi
  # A hooks path in effect (system, global or local) replaces .git/hooks entirely.
  _hp="$(git -C "$SUPER_REPO_DIR" config --get core.hooksPath 2>/dev/null || true)"
  if [ -n "$_hp" ] && [ -f "$_ph" ] && grep -q "$PLACEMENT_HOOK_MARKER" "$_ph" 2>/dev/null && [ ! -x "$_hp/pre-commit" ]; then
    echo "[setup-git-push] WARN placement gate INERT: core.hooksPath=$_hp has no pre-commit chaining to .git/hooks/pre-commit, so git never runs the gate"
  fi
fi
echo "[setup-git-push] done"
