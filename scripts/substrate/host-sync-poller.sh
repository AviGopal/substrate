#!/usr/bin/env bash
# host-sync-poller.sh — Host-side companion for substrate-authored mitosis cutovers.
#
# WHY: The substrate runs inside `substrate-live` where the host super-repo is
# bind-mounted READ-ONLY at /workspace/repos. Substrate-authored commits
# therefore cannot write directly to the host git tree. The cutover resolver
# (vessel-mitosis-cutover.ts, MITOSIS_HOST_SYNC_MODE=1) emits an intent record
# to /workspace/mitosis-applied-host-sync.jsonl instead. This poller reads
# those intents from the host side, applies the staged files, runs git
# add + commit + push, and writes a result back.
#
# Resilience: re-checks base_sha freshness; refuses on scope creep; never
# force-pushes; never pushes to main; never bypasses hooks. Idempotent via a
# lock file tracking processed intent_ids.
#
# Operator install (one-time):
#   ln -sf $(pwd)/scripts/substrate/host-sync-poller.service \
#     ~/.config/systemd/user/host-sync-poller.service
#   ln -sf $(pwd)/scripts/substrate/host-sync-poller.timer \
#     ~/.config/systemd/user/host-sync-poller.timer
#   systemctl --user daemon-reload
#   systemctl --user enable --now host-sync-poller.timer
#
# Direct invocation:
#   bash scripts/substrate/host-sync-poller.sh --once

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
WORKSPACE_DIR="${WORKSPACE_DIR:-$REPO_ROOT/scripts/substrate/workspace}"
INTENT_FILE="${INTENT_FILE:-$WORKSPACE_DIR/mitosis-applied-host-sync.jsonl}"
RESULTS_FILE="${RESULTS_FILE:-$WORKSPACE_DIR/mitosis-applied-host-sync-results.jsonl}"
LOCK_FILE="${LOCK_FILE:-$HOME/.host-sync-applied.lock}"
CONTAINER="${CONTAINER:-substrate-live}"
ONCE=0

[[ "${1:-}" == "--once" ]] && ONCE=1

log() { echo "[host-sync-poller $(date -Iseconds)] $*" >&2; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || { log "ERROR: missing $1"; exit 1; }; }
require_cmd jq
require_cmd git
require_cmd docker

mkdir -p "$WORKSPACE_DIR"
touch "$LOCK_FILE" "$RESULTS_FILE"

write_result() {
  local intent_id="$1" git_sha="$2" push_status="$3" detail="${4:-}"
  jq -nc --arg intent_id "$intent_id" --arg git_sha "$git_sha" \
        --arg push_status "$push_status" --arg detail "$detail" \
        --arg completed_at "$(date -Iseconds)" \
        '{intent_id:$intent_id, git_sha:$git_sha, push_status:$push_status, detail:$detail, completed_at:$completed_at}' \
    >> "$RESULTS_FILE"
  echo "$intent_id" >> "$LOCK_FILE"
}

process_intent() {
  local line="$1"
  local intent_id vessel_name mitosis_root base_sha proposal_id gap_id mitosis_version_id status
  intent_id=$(jq -r '.intent_id' <<<"$line")
  status=$(jq -r '.status' <<<"$line")
  [[ "$status" != "pending" ]] && return 0
  if grep -qxF "$intent_id" "$LOCK_FILE"; then
    log "skip already-processed $intent_id"
    return 0
  fi
  vessel_name=$(jq -r '.vessel_name' <<<"$line")
  mitosis_root=$(jq -r '.mitosis_root' <<<"$line")
  base_sha=$(jq -r '.base_sha // ""' <<<"$line")
  proposal_id=$(jq -r '.proposal_id' <<<"$line")
  gap_id=$(jq -r '.gap_id' <<<"$line")
  mitosis_version_id=$(jq -r '.mitosis_version_id' <<<"$line")
  local staged_files
  staged_files=$(jq -r '.staged_files[]' <<<"$line")

  local host_vessel_root="$REPO_ROOT/repos/$vessel_name"
  if [[ ! -d "$host_vessel_root/.git" ]] && [[ ! -f "$host_vessel_root/.git" ]]; then
    log "reject $intent_id: host_vessel_root not a git repo: $host_vessel_root"
    write_result "$intent_id" "" "rejected_host_repo_missing" "no .git at $host_vessel_root"
    return 0
  fi

  # Re-check base_sha freshness against current host source.
  # apply_proposal_as_patch computes base_sha from the FILE IT'S PATCHING
  # (the first staged file), not from src/index.ts. Using src/index.ts as
  # the freshness sentinel causes every cutover to reject with
  # base_sha_mismatch unless the patch happens to target src/index.ts.
  # Hash the first staged file instead — matches what apply hashed.
  if [[ -n "$base_sha" ]]; then
    local sentinel_rel sentinel_path current_sha
    sentinel_rel=$(jq -r '.staged_files[0] // "src/index.ts"' <<<"$line")
    sentinel_path="$host_vessel_root/$sentinel_rel"
    if [[ -f "$sentinel_path" ]]; then
      current_sha=$(sha256sum "$sentinel_path" | cut -c1-12)
      if [[ "$current_sha" != "$base_sha" ]]; then
        log "reject $intent_id: base_sha mismatch on $sentinel_rel (intent=$base_sha current=$current_sha)"
        write_result "$intent_id" "" "rejected_base_sha" "sentinel=$sentinel_rel intent=$base_sha current=$current_sha"
        return 0
      fi
    fi
  fi

  # Copy each staged file from container's mitosis_root to host vessel root.
  local f tmpfile
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if [[ "$f" == /* ]] || [[ "$f" == *..* ]]; then
      log "reject $intent_id: unsafe staged path $f"
      write_result "$intent_id" "" "rejected_unsafe_path" "$f"
      return 0
    fi
    tmpfile=$(mktemp)
    if ! docker exec "$CONTAINER" cat "$mitosis_root/$f" > "$tmpfile" 2>/dev/null; then
      rm -f "$tmpfile"
      log "reject $intent_id: cannot read $mitosis_root/$f from container"
      write_result "$intent_id" "" "rejected_source_missing" "$mitosis_root/$f"
      return 0
    fi
    mkdir -p "$(dirname "$host_vessel_root/$f")"
    mv "$tmpfile" "$host_vessel_root/$f"
  done <<<"$staged_files"

  # Scope-creep gate: only staged_files may be dirty among TRACKED files.
  # NB (2026-06-17): untracked files (porcelain "??") are excluded. We commit via
  # `git add <explicit staged_files>` below, so untracked files can NEVER enter
  # the commit — they are not a scope-creep risk. They also survive `git checkout
  # -- .` (which only reverts tracked changes), so flagging them rejected EVERY
  # intent forever: persistent untracked WIP (e.g. unregistered in-progress
  # resolvers) blocked all autonomous cutovers for 3 days. Only tracked
  # modifications outside the staged set are real scope creep.
  local porcelain unexpected=()
  porcelain=$(cd "$host_vessel_root" && git status --porcelain)
  while IFS= read -r entry; do
    [[ -z "$entry" ]] && continue
    [[ "${entry:0:2}" == "??" ]] && continue   # untracked — cannot pollute an explicit-add commit
    local path="${entry:3}"
    if ! grep -qxF "$path" <<<"$staged_files"; then
      unexpected+=("$path")
    fi
  done <<<"$porcelain"
  if (( ${#unexpected[@]} > 0 )); then
    log "reject $intent_id: scope creep — extras: ${unexpected[*]}"
    (cd "$host_vessel_root" && git checkout -- . 2>/dev/null || true)
    write_result "$intent_id" "" "rejected_scope_creep" "${unexpected[*]}"
    return 0
  fi

  # git add (explicit file list — never `git add .`).
  local add_args=()
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    add_args+=("$f")
  done <<<"$staged_files"
  (cd "$host_vessel_root" && git add "${add_args[@]}")

  # git commit.
  local msg
  msg=$(cat <<EOF
substrate-authored: apply $proposal_id via mitosis cutover (host-sync)

Applied autonomously by apply_proposal_as_patch + vessel_mitosis_cutover via host-sync.
Gap: $gap_id
Proposal: $proposal_id
Mitosis: $mitosis_version_id
Base SHA at staging: $base_sha
Intent: $intent_id
EOF
)
  # Use a distinct git identity for substrate-autonomous commits so they can be
  # cleanly disambiguated from operator + agent commits (both of which use the
  # host's global DevBob Assistant identity). Counting commits by
  # "Substrate Autonomous" gives a clean measurement of autonomous fixes.
  # Identity is overridden via environment variables for THIS commit only —
  # the host's global config is unaffected.
  if ! (cd "$host_vessel_root" && \
        GIT_AUTHOR_NAME="Substrate Autonomous" \
        GIT_AUTHOR_EMAIL="substrate-autonomous@metabob.com" \
        GIT_COMMITTER_NAME="Substrate Autonomous" \
        GIT_COMMITTER_EMAIL="substrate-autonomous@metabob.com" \
        git commit -m "$msg") >/dev/null 2>&1; then
    log "reject $intent_id: git commit failed (possibly nothing to commit)"
    write_result "$intent_id" "" "rejected_commit_failed" "see host repo $host_vessel_root"
    return 0
  fi

  local git_sha
  git_sha=$(cd "$host_vessel_root" && git rev-parse HEAD)

  # Safety: refuse to push to anything but dev; never force.
  local current_branch
  current_branch=$(cd "$host_vessel_root" && git symbolic-ref --short HEAD)
  if [[ "$current_branch" != "dev" ]]; then
    log "reject push for $intent_id: branch=$current_branch (expected dev); commit kept local"
    write_result "$intent_id" "$git_sha" "local_only" "branch=$current_branch"
    return 0
  fi

  if (cd "$host_vessel_root" && git push origin dev) >/dev/null 2>&1; then
    log "ok $intent_id: committed $git_sha and pushed origin dev"
    write_result "$intent_id" "$git_sha" "pushed" "origin dev"
  else
    log "warn $intent_id: commit $git_sha created but push failed"
    write_result "$intent_id" "$git_sha" "local_only" "push failed"
  fi

  # Clear the singleton pending-mitosis once THIS mitosis has landed (2026-06-18).
  # In host-sync mode the land is async (here, on the host) so the in-container
  # cutover returns before the land and never clears /workspace/mitosis-pending.json.
  # Left in place, apply-proposal-as-patch refuses new work ("pending mitosis in
  # flight") for the full 30m stale window — throttling sustained self-alteration to
  # ~1 land / 30m. Clearing it on confirmed land unblocks the apply loop immediately,
  # which is what lets the substrate self-develop at a STEADY pace. Match by version id
  # so we never clear a different in-flight stage.
  local pending_file="$WORKSPACE_DIR/mitosis-pending.json"
  if [[ -n "$mitosis_version_id" && -f "$pending_file" ]]; then
    local pend_ver; pend_ver=$(jq -r '.mitosis_version_id // ""' "$pending_file" 2>/dev/null)
    if [[ "$pend_ver" == "$mitosis_version_id" ]]; then
      rm -f "$pending_file" && log "cleared pending-mitosis $mitosis_version_id (landed) — apply loop unblocked"
    fi
  fi

  # Mirror patched files back into the container's /vessels/<vessel>/ tree.
  # Without this, the container's source drifts behind host after each
  # autonomous commit — apply-proposal-as-patch re-reads the still-original
  # file, stages with the same base_sha, the next intent's freshness
  # check rejects on host (current_sha now matches the committed patch,
  # not the staged sentinel). Chain produces exactly one commit and stops.
  # Mirror = `docker cp host_path container_path` for each staged file.
  local f
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    docker cp "$host_vessel_root/$f" "$CONTAINER:/vessels/$vessel_name/$f" 2>/dev/null \
      && log "mirrored $f → container:/vessels/$vessel_name/$f" \
      || log "warn: mirror failed for $f (chain may stall on next intent)"
  done <<<"$staged_files"
}

main_loop_once() {
  [[ -f "$INTENT_FILE" ]] || { log "no intent file yet at $INTENT_FILE"; return 0; }
  local line
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    process_intent "$line" || log "intent processing errored, continuing"
  done < "$INTENT_FILE"
}

main_loop_once

if [[ "$ONCE" == "0" ]]; then
  while true; do
    sleep 60
    main_loop_once
  done
fi
