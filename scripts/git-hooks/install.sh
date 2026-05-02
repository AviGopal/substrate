#!/usr/bin/env bash
#
# Install git hooks for this super-repo clone, or for a vessel repo.
#
# Usage:
#   scripts/git-hooks/install.sh                         # super-repo hooks
#   scripts/git-hooks/install.sh --vessel repos/<name>   # vessel hook
#
# Super-repo mode sets core.hooksPath to scripts/git-hooks/ so versioned
# hooks here run on commit. Idempotent.
#
# Vessel mode copies vessel-pre-commit into <vessel>/.git-hooks/pre-commit
# and sets core.hooksPath=.git-hooks inside that repo. Safe to re-run.
# Commit .git-hooks/pre-commit in the vessel repo to share it with the team.
set -euo pipefail

SUPER_ROOT="$(git rev-parse --show-toplevel)"
HOOK_DIR="$SUPER_ROOT/scripts/git-hooks"

# ─── argument parsing ────────────────────────────────────────────────────────
VESSEL_PATH=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --vessel)
      VESSEL_PATH="$2"; shift 2 ;;
    *)
      echo "error: unknown argument '$1'" >&2
      echo "usage: install.sh [--vessel repos/<name>]" >&2
      exit 1 ;;
  esac
done

gitleaks_hint() {
  if ! command -v gitleaks >/dev/null 2>&1; then
    cat <<'EOF'

note: gitleaks is not installed; the pre-commit hook will skip the secrets
      scan and print a hint until you install it.
      install:  brew install gitleaks
                go install github.com/gitleaks/gitleaks/v8@latest
                https://github.com/gitleaks/gitleaks/releases
EOF
  fi
}

# ─── vessel mode ─────────────────────────────────────────────────────────────
if [[ -n "$VESSEL_PATH" ]]; then
  # Accept both relative (from super-root) and absolute paths.
  if [[ "$VESSEL_PATH" != /* ]]; then
    VESSEL_PATH="$SUPER_ROOT/$VESSEL_PATH"
  fi

  if [[ ! -d "$VESSEL_PATH" ]]; then
    echo "error: vessel directory not found: $VESSEL_PATH" >&2
    exit 1
  fi

  if [[ ! -e "$VESSEL_PATH/.git" ]]; then
    echo "error: $VESSEL_PATH is not a git repository (no .git entry)" >&2
    exit 1
  fi

  VESSEL_TEMPLATE="$HOOK_DIR/vessel-pre-commit"
  if [[ ! -f "$VESSEL_TEMPLATE" ]]; then
    echo "error: vessel hook template not found: $VESSEL_TEMPLATE" >&2
    exit 1
  fi

  VESSEL_HOOK_DIR="$VESSEL_PATH/.git-hooks"
  mkdir -p "$VESSEL_HOOK_DIR"
  cp "$VESSEL_TEMPLATE" "$VESSEL_HOOK_DIR/pre-commit"
  chmod +x "$VESSEL_HOOK_DIR/pre-commit"

  git -C "$VESSEL_PATH" config core.hooksPath .git-hooks
  echo "vessel: $(basename "$VESSEL_PATH")"
  echo "  core.hooksPath -> .git-hooks"
  echo "  pre-commit     -> .git-hooks/pre-commit  (from vessel-pre-commit template)"
  echo ""
  echo "Commit .git-hooks/pre-commit inside the vessel repo to share it with collaborators."
  gitleaks_hint
  exit 0
fi

# ─── super-repo mode ─────────────────────────────────────────────────────────
cd "$SUPER_ROOT"

if [[ ! -d "$HOOK_DIR" ]]; then
  echo "error: $HOOK_DIR not found; run from the metabob-devbob super-repo." >&2
  exit 1
fi

# Make every hook executable.
chmod +x "$HOOK_DIR"/* 2>/dev/null || true

git config core.hooksPath "$HOOK_DIR"
echo "core.hooksPath -> $HOOK_DIR"
echo "hooks: $(ls "$HOOK_DIR" | grep -v '\.\(md\|sh\|toml\)$' | tr '\n' ' ')"

gitleaks_hint
