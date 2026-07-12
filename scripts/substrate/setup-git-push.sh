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
# for a username — fail them fast so the host-sync (SSH) path is the durable one.
export GIT_TERMINAL_PROMPT=0

AUTHOR_NAME="${SUBSTRATE_GIT_AUTHOR_NAME:-Substrate Autonomous}"
AUTHOR_EMAIL="${SUBSTRATE_GIT_AUTHOR_EMAIL:-substrate-autonomous@metabob.com}"
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
# token. Password authentication is not supported." — and the cutover used to
# spew that auth error on every self-alteration and report a misleading
# local_only. The DURABLE push path is the host-sync poller (host SSH key), which
# does not depend on this PAT at all. So:
#   - No PAT, or PAT fails a live GitHub API probe  → DO NOT configure the broken
#     HTTPS credential helper. Log ONE clear warning. The cutover's push will
#     simply fail fast and fall through to the host-sync intent (durable path).
#   - PAT validates → configure the helper as a fast path (push direct from the
#     container; host-sync still covers any residual failure).
# This keeps a bad/expired operator PAT from being load-bearing and from
# generating per-push noise, while the substrate keeps landing commits via SSH.
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
# and only WARN (never disable) if the probe can't confirm auth — the cutover's
# host-sync fallback (host SSH key) durably catches any push that does fail.
PAT_PROBE_REPO="${SUBSTRATE_PAT_PROBE_REPO:-development-vessel}"
if [ -n "$SUBSTRATE_GIT_PAT" ]; then
  git config --system credential.helper '!f() { echo username=x-access-token; echo "password=$SUBSTRATE_GIT_PAT"; }; f'
  echo "[setup-git-push] in-container HTTPS credential helper configured (fast path; reads PAT from env at push time)"

  # Advisory probe with retries (tolerate transient flakiness before warning).
  PAT_OK=0
  for attempt in 1 2 3; do
    if git -c credential.helper="!f() { echo username=x-access-token; echo \"password=$SUBSTRATE_GIT_PAT\"; }; f" \
         ls-remote --heads "https://github.com/AviGopal/${PAT_PROBE_REPO}.git" dev >/dev/null 2>&1; then
      PAT_OK=1; break
    fi
    sleep 2
  done
  if [ "$PAT_OK" = "1" ]; then
    echo "[setup-git-push] PAT auth confirmed against AviGopal/${PAT_PROBE_REPO}"
  else
    echo "[setup-git-push] NOTE: PAT auth probe did not confirm after 3 tries (AviGopal/${PAT_PROBE_REPO}). This is often transient (GitHub fine-grained-PAT rate-limiting); the helper stays configured. If in-container pushes keep failing, the cutover falls back to the HOST-SYNC poller (SSH) — and the push_health_observer will emit a substrateGap. OPERATOR: if sustained, refresh SUBSTRATE_GIT_PAT (Contents: Read+Write)."
  fi
else
  # No PAT: ensure no stale helper remains so pushes fail fast (host-sync covers).
  git config --system --unset-all credential.helper 2>/dev/null || true
  echo "[setup-git-push] no SUBSTRATE_GIT_PAT — in-container HTTPS push disabled; self-authored commits land via the HOST-SYNC poller (SSH). Clones refreshed read-only if reachable."
fi

# 2. Idempotent writable clones on dev.
mkdir -p "$CLONE_DIR"
REPO_OWNER="${SUBSTRATE_REPO_OWNER:-AviGopal}"   # fork override: set SUBSTRATE_REPO_OWNER to your GitHub org/user
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
if [ -d "$SUPER_REPO_DIR/.git" ]; then
  git -C "$SUPER_REPO_DIR" remote set-url origin "$super_url"
  if git -C "$SUPER_REPO_DIR" fetch --no-recurse-submodules origin dev -q 2>/dev/null; then
    git -C "$SUPER_REPO_DIR" checkout -q dev 2>/dev/null || git -C "$SUPER_REPO_DIR" checkout -q -b dev origin/dev 2>/dev/null || true
    git -C "$SUPER_REPO_DIR" reset --hard origin/dev -q 2>/dev/null \
      && echo "[setup-git-push] refreshed super-repo (${SUPER_REPO}) → $(git -C "$SUPER_REPO_DIR" rev-parse --short HEAD)" \
      || echo "[setup-git-push] WARN refresh failed for super-repo"
  else
    echo "[setup-git-push] WARN fetch failed for super-repo (offline?); keeping existing clone"
  fi
else
  if git clone -q --no-recurse-submodules --branch dev "$super_url" "$SUPER_REPO_DIR"; then
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
echo "[setup-git-push] done"
