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
#
# Fails open: no PAT → configure identity only, skip clones (drafts won't push,
# but the substrate still runs and learns).
set -uo pipefail

# Load env + persisted secrets (PAT lives in one or both).
[ -f /etc/substrate/env ] && . /etc/substrate/env 2>/dev/null || true
[ -f /workspace/.substrate-secrets ] && . /workspace/.substrate-secrets 2>/dev/null || true
export SUBSTRATE_GIT_PAT="${SUBSTRATE_GIT_PAT:-}"

AUTHOR_NAME="${SUBSTRATE_GIT_AUTHOR_NAME:-Substrate Autonomous}"
AUTHOR_EMAIL="${SUBSTRATE_GIT_AUTHOR_EMAIL:-substrate-autonomous@metabob.com}"
CLONE_DIR="${MITOSIS_PUSH_CLONE_DIR:-/workspace/git/vessels}"
# Everything mutable from all vessels: clone every substrate vessel repo so the
# cutover can self-develop ANY of them (not just development-vessel). Each maps
# to AviGopal/<name> on dev and to the live runtime /vessels/<name>. Override
# via SUBSTRATE_PUSH_VESSELS (space-separated). A clone whose vessel doesn't run
# at /vessels/<name> is still pushable; its mirror-to-live just no-ops safely.
VESSELS="${SUBSTRATE_PUSH_VESSELS:-activity-api analysis-vessel boredom-vessel concept-db cpg-inference-ts development-vessel discovery-vessel goal-host-vessel ias-executor-ts identity-vessel light-dispatch-vessel llm-resolver-vessel local-tools-vessel obsidian-vessel ribosome-vessel stateful-ui-vessel}"

# 1. System git identity + credential helper (reads PAT from env at push time;
#    the token is never written into any git config file).
git config --system user.name  "$AUTHOR_NAME"
git config --system user.email "$AUTHOR_EMAIL"
git config --system credential.helper '!f() { echo username=x-access-token; echo "password=$SUBSTRATE_GIT_PAT"; }; f'
echo "[setup-git-push] system git identity + credential helper configured"

if [ -z "$SUBSTRATE_GIT_PAT" ]; then
  echo "[setup-git-push] no SUBSTRATE_GIT_PAT — skipping clones; self-push disabled (drafts won't land)"
  exit 0
fi

# 2. Idempotent writable clones on dev.
mkdir -p "$CLONE_DIR"
for v in $VESSELS; do
  d="$CLONE_DIR/$v"
  url="https://github.com/AviGopal/$v.git"
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
echo "[setup-git-push] done"
